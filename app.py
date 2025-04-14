from flask import Flask, render_template, jsonify
import pandas as pd

app = Flask(__name__)

# Load data once (you can reload if using updated datasets)
covid_df = pd.read_csv("static/data/owid-covid-data.csv")
covid_df['date'] = pd.to_datetime(covid_df['date'], errors='coerce')

# Preprocess for Task 1
covid_task1_df = covid_df[['location', 'date', 'new_cases_smoothed', 'new_deaths_smoothed']].dropna()

# Preprocess for Task 2: Last row per location for total_cases & GDP
covid_gdp_df = (
    covid_df.sort_values("date")
    .groupby("location", as_index=False)
    .last()[["location", "total_cases", "gdp_per_capita"]]
    .dropna()
)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/data/covid')
def covid_cases_data():
    result = []
    enriched_df = covid_df[['location', 'date', 'new_cases_smoothed', 'new_deaths_smoothed', 'people_fully_vaccinated_per_hundred']].dropna(subset=['new_cases_smoothed', 'new_deaths_smoothed'])

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

    # Pivot into { location, 2019: rate, 2021: rate }
    pivot_df = df.pivot(index="location", columns="Year", values="unemployment_rate").dropna().reset_index()
    pivot_df.columns.name = None  # Remove pandas' MultiIndex
    pivot_df = pivot_df.rename(columns={2019: "before", 2021: "after"})
    return jsonify(pivot_df.to_dict(orient="records"))


@app.route('/data/vax_gdp_bubble')
def vax_gdp_bubble():
    # Load GDP
    gdp_df = pd.read_csv("static/data/gdp_data.csv")
    gdp_df = gdp_df.rename(columns={"Country Name": "location"})

    # Filter only 2019 and 2021
    gdp_df = gdp_df[["location", "2019", "2021"]].dropna()
    gdp_df = gdp_df.rename(columns={"2019": "gdp_2019", "2021": "gdp_2021"})

    # Calculate GDP recovery
    gdp_df["gdp_recovery"] = gdp_df["gdp_2021"] - gdp_df["gdp_2019"]

    # Vaccination and population data from OWID
    vax_df = covid_df[["location", "date", "people_fully_vaccinated_per_hundred", "population"]].dropna()
    vax_df['date'] = pd.to_datetime(vax_df['date'])
    latest_vax = vax_df.sort_values("date").groupby("location").last().reset_index()

    # Merge
    merged = pd.merge(gdp_df, latest_vax, on="location")
    merged = merged.dropna(subset=["people_fully_vaccinated_per_hundred", "gdp_recovery", "population"])

    # Rename for frontend
    merged = merged.rename(columns={
        "people_fully_vaccinated_per_hundred": "vax_rate",
        "gdp_recovery": "gdp_change"
    })

    return jsonify(merged[["location", "vax_rate", "gdp_change", "population"]].to_dict(orient="records"))


@app.route('/data/stock_market')
def stock_market_covid():
    # Load datasets
    stock_df = pd.read_csv("static/data/Stock Market Dataset.csv")
    covid_subset = covid_df[['date', 'new_cases_smoothed', 'new_deaths_smoothed']].copy()

    # Parse dates
    stock_df['date'] = pd.to_datetime(stock_df['Date'], errors='coerce')
    covid_subset['date'] = pd.to_datetime(covid_subset['date'], errors='coerce')

    # Keep relevant columns and rename
    stock_df = stock_df[['date', 'S&P_500_Price']].rename(columns={"S&P_500_Price": "stock_price"})
    covid_subset = covid_subset.rename(columns={
        "new_cases_smoothed": "covid_cases",
        "new_deaths_smoothed": "covid_deaths"
    })

    # Merge
    merged = pd.merge(stock_df, covid_subset, on="date", how="inner")

    print("Merged columns:", merged.columns.tolist())
    print("Sample merged rows:\n", merged.head())

    # Check if expected columns exist before dropna
    required_cols = ["date", "stock_price", "covid_cases", "covid_deaths"]
    for col in required_cols:
        if col not in merged.columns:
            return jsonify({"error": f"Missing column: {col}"}), 500

    # Clean
    merged = merged.dropna(subset=required_cols)

    # Return cleaned data
    result = merged.to_dict(orient='records')

    merged['stock_price'] = merged['stock_price'].replace(',', '', regex=True).astype(float)
    merged['covid_cases'] = merged['covid_cases'].astype(float)
    merged['covid_deaths'] = merged['covid_deaths'].astype(float)

    return jsonify(merged.to_dict(orient="records"))



if __name__ == '__main__':
    app.run(debug=True)
