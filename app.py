
from flask import Flask, render_template, jsonify, request
import pandas as pd

app = Flask(__name__)

# Load initial COVID data
covid_df = pd.read_csv("static/data/filtered_data.csv")
covid_df['date'] = pd.to_datetime(covid_df['date'], errors='coerce')

# Preprocess for case/death trends
covid_task1_df = covid_df[['location', 'date', 'new_cases_smoothed', 'new_deaths_smoothed']].dropna()

# Preprocess for GDP vs cases plot
covid_gdp_df = (
    covid_df.sort_values("date")
    .groupby("location", as_index=False)
    .last()[["location", "total_cases", "gdp_per_capita"]]
    .dropna()
)

@app.route('/')
def index():
    return render_template('index_new.html')

@app.route('/data/covid')
def covid_cases_data():
    result = []
    countries_with_gdp = covid_df[
        (covid_df['gdp_per_capita'].notna()) & (covid_df['gdp_per_capita'] > 0)
    ]['location'].unique()

    enriched_df = covid_df[
        (covid_df['location'].isin(countries_with_gdp)) &
        (covid_df['new_cases_smoothed'].notna()) &
        (covid_df['new_deaths_smoothed'].notna())
    ][['location', 'date', 'new_cases_smoothed', 'new_deaths_smoothed', 'people_fully_vaccinated_per_hundred']]

    for location, group in enriched_df.groupby('location'):
        values = [
            {
                'date': row['date'].strftime('%Y-%m-%d'),
                'cases': round(row['new_cases_smoothed'], 2),
                'deaths': round(row['new_deaths_smoothed'], 2),
                'people_fully_vaccinated_per_hundred': round(row['people_fully_vaccinated_per_hundred'], 2)
                if pd.notna(row['people_fully_vaccinated_per_hundred']) else None
            }
            for _, row in group.iterrows()
        ]
        result.append({'location': location, 'values': values})
    return jsonify(result)

@app.route('/data/gdp_vs_cases')
def gdp_vs_cases():
    return jsonify(covid_gdp_df.to_dict(orient="records"))

@app.route('/data/unemployment')
def unemployment_data():
    df = pd.read_csv("static/data/unemployment-rate.csv")
    df = df[df["Year"].isin([2019, 2021])]
    df = df.rename(columns={
        "Entity": "location",
        "Unemployment, total (% of total labor force) (modeled ILO estimate)": "unemployment_rate"
    })
    pivot_df = df.pivot(index="location", columns="Year", values="unemployment_rate").dropna().reset_index()
    pivot_df.columns.name = None
    pivot_df = pivot_df.rename(columns={2019: "before", 2021: "after"})
    return jsonify(pivot_df.to_dict(orient="records"))

@app.route('/data/vax_gdp_bubble')
def vax_gdp_bubble():
    gdp_df = pd.read_csv("static/data/gdp_data.csv")
    gdp_df = gdp_df.rename(columns={"Country Name": "location"})
    gdp_df = gdp_df[["location", "2019", "2021"]].dropna()
    gdp_df = gdp_df.rename(columns={"2019": "gdp_2019", "2021": "gdp_2021"})
    gdp_df["gdp_recovery"] = gdp_df["gdp_2021"] - gdp_df["gdp_2019"]

    vax_df = covid_df[["location", "date", "people_fully_vaccinated_per_hundred", "population"]].dropna()
    vax_df['date'] = pd.to_datetime(vax_df['date'])
    latest_vax = vax_df.sort_values("date").groupby("location").last().reset_index()

    merged = pd.merge(gdp_df, latest_vax, on="location")
    merged = merged.dropna(subset=["people_fully_vaccinated_per_hundred", "gdp_recovery", "population"])
    merged["gdp_recovery"] = merged["gdp_recovery"] / merged["population"]
    merged = merged.rename(columns={
        "people_fully_vaccinated_per_hundred": "vax_rate",
        "gdp_recovery": "gdp_change"
    })
    return jsonify(merged[["location", "vax_rate", "gdp_change", "population"]].to_dict(orient="records"))

@app.route('/data/stock_market')
def stock_market_covid():
    try:
        selected_countries = request.args.getlist('country')
        if not selected_countries:
            selected_countries = ['United States']

        stock_data = pd.read_csv("static/data/Stock Market Dataset.csv")
        stock_data['date'] = pd.to_datetime(stock_data['Date'], errors='coerce')
        stock_data = stock_data.dropna(subset=['date'])
        stock_data['month'] = stock_data['date'].dt.strftime('%Y-%m')
        stock_data = stock_data[['month', 'S&P_500_Price']].rename(columns={"S&P_500_Price": "stock_price"})
        stock_data['stock_price'] = pd.to_numeric(stock_data['stock_price'].str.replace(',', ''), errors='coerce')
        stock_data = stock_data.dropna(subset=['stock_price'])

        stock_monthly = stock_data.groupby('month').agg({'stock_price': 'mean'}).reset_index()

        covid_data = covid_df[covid_df['location'].isin(selected_countries)].copy()
        covid_data['date'] = pd.to_datetime(covid_data['date'], errors='coerce')
        covid_data = covid_data.dropna(subset=['date'])
        covid_data['month'] = covid_data['date'].dt.strftime('%Y-%m')
        covid_data = covid_data.rename(columns={
            "new_cases_smoothed": "covid_cases",
            "new_deaths_smoothed": "covid_deaths"
        })
        covid_data = covid_data.dropna(subset=['covid_cases', 'covid_deaths'])

        covid_monthly = covid_data.groupby(['month', 'location']).agg({
            'covid_cases': 'mean',
            'covid_deaths': 'mean'
        }).reset_index()

        merged = pd.merge(stock_monthly, covid_monthly, on="month", how="inner")

        if merged.empty:
            return jsonify({
                "data": [],
                "countries_included": list(covid_data['location'].unique()),
                "message": "No overlapping months between stock and COVID data",
                "status": "success"
            })

        result = merged.round(2).to_dict(orient='records')
        return jsonify({
            "data": result,
            "countries_included": list(merged['location'].unique()),
            "status": "success"
        })

    except Exception as e:
        return jsonify({
            "error": f"Unexpected error: {str(e)}",
            "status": "error"
        }), 500

if __name__ == '__main__':
    app.run(debug=True)
