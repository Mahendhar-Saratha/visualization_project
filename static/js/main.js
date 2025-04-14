
let gdpData = [];
let unemploymentData = [];
const tooltip = d3.select("#tooltip");

const svg = d3.select("svg"),
      margin = {top: 50, right: 160, bottom: 50, left: 60},
      width = +svg.attr("width") - margin.left - margin.right,
      height = +svg.attr("height") - margin.top - margin.bottom;

const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
const x = d3.scaleTime().range([0, width]);
const yCases = d3.scaleLinear().range([height, 0]);
const yDeaths = d3.scaleLinear().range([height, 0]);
const color = d3.scaleOrdinal(d3.schemeTableau10);

const xAxis = g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height})`);
const yAxisCases = g.append("g").attr("class", "y-axis-cases");
const yAxisDeaths = g.append("g").attr("class", "y-axis-deaths").attr("transform", `translate(${width}, 0)`);

const lineCases = d3.line().x(d => x(new Date(d.date))).y(d => yCases(d.cases));
const lineDeaths = d3.line().x(d => x(new Date(d.date))).y(d => yDeaths(d.deaths));

Promise.all([
  d3.json("/data/covid"),
  d3.json("/data/gdp_vs_cases"),
  d3.json("/data/unemployment")
]).then(([covidData, gdpLoaded, unempLoaded]) => {
  gdpData = gdpLoaded;
  unemploymentData = unempLoaded;

  const select = d3.select("#countrySelect");
  const countries = covidData.map(d => d.location);

  select.selectAll("option")
    .data(countries)
    .enter()
    .append("option")
    .attr("value", d => d)
    .text(d => d)
    .property("selected", (d, i) => i < 2);

  const defaultCountries = countries.slice(0, 2);
  updateChart(defaultCountries);

  select.on("change", function () {
    const selected = Array.from(this.selectedOptions).map(opt => opt.value);
    updateChart(selected);
  });

  function updateChart(selectedCountries) {
    const filtered = covidData.filter(d => selectedCountries.includes(d.location));
    if (filtered.length === 0) return;

    const allDates = filtered.flatMap(d => d.values.map(p => new Date(p.date)));
    const allCases = filtered.flatMap(d => d.values.map(p => p.cases));
    const allDeaths = filtered.flatMap(d => d.values.map(p => p.deaths));

    x.domain(d3.extent(allDates));
    yCases.domain([0, d3.max(allCases)]);
    yDeaths.domain([0, d3.max(allDeaths)]);

    xAxis.call(d3.axisBottom(x));
    yAxisCases.call(d3.axisLeft(yCases));
    yAxisDeaths.call(d3.axisRight(yDeaths));

    g.selectAll(".line").remove();
    g.selectAll(".circle").remove();
    svg.selectAll(".legend").remove();

    filtered.forEach(country => {
      g.append("path").datum(country.values).attr("class", "line")
        .attr("d", lineCases).attr("stroke", color(country.location));
      g.append("path").datum(country.values).attr("class", "line")
        .attr("d", lineDeaths).attr("stroke", color(country.location)).style("stroke-dasharray", "4 2");

      country.values.forEach(point => {
        g.append("circle").attr("class", "circle")
          .attr("cx", x(new Date(point.date))).attr("cy", yCases(point.cases)).attr("r", 4)
          .style("fill", color(country.location)).style("opacity", 0.6)
          .on("mouseover", event => showTooltip(event, `<b>${country.location}</b><br>${point.date}<br>Cases: ${point.cases}`))
          .on("mouseout", hideTooltip);

        g.append("circle").attr("class", "circle")
          .attr("cx", x(new Date(point.date))).attr("cy", yDeaths(point.deaths)).attr("r", 4)
          .style("fill", color(country.location)).style("opacity", 0.6)
          .on("mouseover", event => showTooltip(event, `<b>${country.location}</b><br>${point.date}<br>Deaths: ${point.deaths}`))
          .on("mouseout", hideTooltip);
      });
    });

    const legend = svg.append("g")
      .attr("transform", `translate(${width - 220}, ${margin.top + 10})`);
    filtered.forEach((d, i) => {
      const yPos = i * 30;
      legend.append("circle").attr("cx", 0).attr("cy", yPos).attr("r", 6).style("fill", color(d.location));
      legend.append("text").attr("x", 10).attr("y", yPos + 5).text(d.location).attr("class", "legend");
    });
    legend.append("text").attr("x", 0).attr("y", filtered.length * 30 + 20)
      .text("Solid = Cases, Dashed = Deaths").style("font-style", "italic").attr("class", "legend");

    updateScatterPlot(selectedCountries);
    updateUnemploymentPlot(selectedCountries);
    updateVaccinationPlot(selectedCountries);
    updateBubbleChart(selectedCountries);
    updateStockMarketPlot();
  }

  function updateScatterPlot(selectedCountries) {
    const selectedData = gdpData.filter(d => selectedCountries.includes(d.location));
    const svg2 = d3.select("#scatterPlot");
    svg2.selectAll("*").remove();

    const margin = {top: 50, right: 30, bottom: 50, left: 60},
          width = +svg2.attr("width") - margin.left - margin.right,
          height = +svg2.attr("height") - margin.top - margin.bottom;

    const g = svg2.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    if (selectedData.length === 0) return;

    const xExtent = d3.extent(selectedData, d => d.total_cases);
    const yExtent = d3.extent(selectedData, d => d.gdp_per_capita);

    const xMin = Math.max(1, xExtent[0]);
    const yMin = Math.max(1, yExtent[0]);

    const x = d3.scaleLinear().domain([xMin * 0.9, xExtent[1] * 1.1]).range([0, width]);
    const y = d3.scaleLinear().domain([yMin * 0.9, yExtent[1] * 1.1]).range([height, 0]);

    g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).ticks(6).tickFormat(d3.format(".2s")));
    g.append("g").call(d3.axisLeft(y).ticks(6).tickFormat(d3.format("$.2s")));

    g.append("text").attr("x", width / 2).attr("y", height + 40)
      .attr("text-anchor", "middle").style("font-weight", "bold").text("Total COVID-19 Cases");

    g.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", -45)
      .attr("text-anchor", "middle").style("font-weight", "bold").text("GDP per Capita (USD)");

    g.selectAll("circle")
      .data(selectedData)
      .enter().append("circle")
      .attr("cx", d => x(d.total_cases))
      .attr("cy", d => y(d.gdp_per_capita))
      .attr("r", d => Math.max(4, Math.sqrt(d.total_cases) * 0.002))
      .style("fill", "orange")
      .style("opacity", 0.8)
      .on("mouseover", (event, d) => showTooltip(event, `<b>${d.location}</b><br>Cases: ${d.total_cases}<br>GDP: $${d.gdp_per_capita}`))
      .on("mouseout", hideTooltip);

    g.selectAll("text.label")
      .data(selectedData)
      .enter().append("text")
      .attr("x", d => Math.min(x(d.total_cases) + 8, width - 60))
      .attr("y", d => Math.max(y(d.gdp_per_capita), 10))
      .text(d => d.location)
      .style("font-size", "11px")
      .style("fill", "#333");
  }

  function updateUnemploymentPlot(selectedCountries) {
    const data = unemploymentData.filter(d => selectedCountries.includes(d.location));
    const svg3 = d3.select("#unemploymentPlot");
    svg3.selectAll("*").remove();

    const margin = {top: 50, right: 30, bottom: 100, left: 60},
          width = +svg3.attr("width") - margin.left - margin.right,
          height = +svg3.attr("height") - margin.top - margin.bottom;

    const g = svg3.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    if (data.length === 0) return;

    const x0 = d3.scaleBand().domain(data.map(d => d.location)).range([0, width]).paddingInner(0.2);
    const x1 = d3.scaleBand().domain(["before", "after"]).range([0, x0.bandwidth()]).padding(0.05);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => Math.max(d.before, d.after)) * 1.1]).range([height, 0]);
    const color = d3.scaleOrdinal().domain(["before", "after"]).range(["#4daf4a", "#e41a1c"]);

    g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x0))
     .selectAll("text").attr("transform", "rotate(-45)").style("text-anchor", "end");

    g.append("g").call(d3.axisLeft(y));

    g.selectAll("g.bar-group")
      .data(data)
      .enter().append("g")
      .attr("class", "bar-group")
      .attr("transform", d => `translate(${x0(d.location)},0)`)
      .selectAll("rect")
      .data(d => ["before", "after"].map(key => ({key: key, value: d[key]})))
      .enter().append("rect")
      .attr("x", d => x1(d.key))
      .attr("y", d => y(d.value))
      .attr("width", x1.bandwidth())
      .attr("height", d => height - y(d.value))
      .attr("fill", d => color(d.key))
      .on("mouseover", (event, d) => showTooltip(event, `<b>${d.key === "before" ? "2019" : "2021"}</b><br>Rate: ${d.value.toFixed(2)}%`))
      .on("mouseout", hideTooltip);

    const legend = svg3.append("g").attr("transform", `translate(${width - 120}, 20)`);
    ["before", "after"].forEach((label, i) => {
      const yOffset = i * 25;
      legend.append("rect").attr("x", 0).attr("y", yOffset).attr("width", 18).attr("height", 18).attr("fill", color(label));
      legend.append("text").attr("x", 24).attr("y", yOffset + 14).text(label === "before" ? "2019 (Before)" : "2021 (After)");
    });
  }
  function updateVaccinationPlot(selectedCountries) {
  const svg4 = d3.select("#vaxPlot");
  svg4.selectAll("*").remove();

  const margin = { top: 50, right: 30, bottom: 100, left: 60 },
        width = +svg4.attr("width") - margin.left - margin.right,
        height = +svg4.attr("height") - margin.top - margin.bottom;

  const g = svg4.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // Flatten the latest available vaccination data
  const latestData = [];
  covidData.forEach(country => {
    if (selectedCountries.includes(country.location)) {
      const values = country.values.filter(d => d.people_fully_vaccinated_per_hundred != null);
      if (values.length > 0) {
        const latest = values[values.length - 1];
        latestData.push({
          location: country.location,
          value: +latest.people_fully_vaccinated_per_hundred
        });
      }
    }
  });

  if (latestData.length === 0) return;

  const x = d3.scaleBand()
    .domain(latestData.map(d => d.location))
    .range([0, width])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(latestData, d => d.value) * 1.1])
    .range([height, 0]);

  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  g.append("g").call(d3.axisLeft(y));

  g.selectAll("rect")
    .data(latestData)
    .enter()
    .append("rect")
    .attr("x", d => x(d.location))
    .attr("y", d => y(d.value))
    .attr("width", x.bandwidth())
    .attr("height", d => height - y(d.value))
    .attr("fill", "#66c2a5")
    .on("mouseover", (event, d) => {
      showTooltip(event, `<b>${d.location}</b><br>${d.value.toFixed(1)}% vaccinated`);
    })
    .on("mouseout", hideTooltip);

  // y-axis label
  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .text("% Fully Vaccinated");
}

function updateBubbleChart(selectedCountries) {
  d3.json("/data/vax_gdp_bubble").then(data => {
    const filtered = data.filter(d =>
      selectedCountries.includes(d.location) &&
      d.vax_rate != null &&
      d.gdp_change != null &&
      d.population != null &&
      !isNaN(d.vax_rate) &&
      !isNaN(d.gdp_change) &&
      !isNaN(d.population)
    );

    const svg5 = d3.select("#bubbleChart");
    svg5.selectAll("*").remove();

    const margin = { top: 50, right: 30, bottom: 60, left: 80 },
          width = +svg5.attr("width") - margin.left - margin.right,
          height = +svg5.attr("height") - margin.top - margin.bottom;

    const g = svg5.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    if (filtered.length === 0) return;

    const x = d3.scaleLinear()
      .domain([0, d3.max(filtered, d => d.vax_rate) * 1.05])
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([
        d3.min(filtered, d => d.gdp_change) * 1.05,
        d3.max(filtered, d => d.gdp_change) * 1.05
      ])
      .range([height, 0]);

    const r = d3.scaleSqrt()
      .domain([0, d3.max(filtered, d => d.population)])
      .range([4, 40]);

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x));
    g.append("g")
      .call(d3.axisLeft(y).tickFormat(d3.format("~s")));


    // Axis labels
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height + 45)
      .attr("text-anchor", "middle")
      .style("font-weight", "bold")
      .text("Vaccination Rate (%)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -55)
      .attr("text-anchor", "middle")
      .style("font-weight", "bold")
      .text("GDP Change (USD)");

    // Bubbles
    g.selectAll("circle")
      .data(filtered)
      .enter()
      .append("circle")
      .attr("cx", d => x(d.vax_rate))
      .attr("cy", d => y(d.gdp_change))
      .attr("r", d => r(d.population))
      .style("fill", "teal")
      .style("opacity", 0.7)
      .on("mouseover", (event, d) => {
        showTooltip(event, `
          <b>${d.location}</b><br>
          Vaccination Rate: ${d.vax_rate.toFixed(1)}%<br>
          GDP Change: $${d3.format(",.2f")(d.gdp_change)}<br>
          Population: ${d3.format(",")(d.population)}
        `);
      })
      .on("mouseout", hideTooltip);

    // Country labels
    g.selectAll("text.country-label")
      .data(filtered)
      .enter()
      .append("text")
      .attr("x", d => x(d.vax_rate) + 5)
      .attr("y", d => y(d.gdp_change))
      .text(d => d.location)
      .attr("class", "country-label")
      .style("font-size", "10px")
      .style("fill", "#444");
  });
}


function updateStockMarketPlot() {
  d3.json("/data/stock_market").then(data => {
    const svg6 = d3.select("#stockPlot");
    svg6.selectAll("*").remove();

    const margin = { top: 50, right: 150, bottom: 60, left: 60 },
          width = +svg6.attr("width") - margin.left - margin.right,
          height = +svg6.attr("height") - margin.top - margin.bottom;

    const g = svg6.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

data.forEach(d => {
  d.date = new Date(d.date);
  d.cases = +d.covid_cases;
  d.deaths = +d.covid_deaths;
  d.sp500 = +d.stock_price;
});


    const x = d3.scaleTime()
      .domain(d3.extent(data, d => d.date))
      .range([0, width]);

    const yLeft = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.sp500) * 1.1])
      .range([height, 0]);

    const yRight = d3.scaleLinear()
      .domain([0, d3.max(data, d => Math.max(d.cases, d.deaths)) * 1.2])
      .range([height, 0]);

    const lineStock = d3.line().x(d => x(d.date)).y(d => yLeft(d.sp500));
    const lineCases = d3.line().x(d => x(d.date)).y(d => yRight(d.cases));
    const lineDeaths = d3.line().x(d => x(d.date)).y(d => yRight(d.deaths));

    g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    g.append("g").call(d3.axisLeft(yLeft));
    g.append("g").attr("transform", `translate(${width},0)`).call(d3.axisRight(yRight));

    const cleanData = data.filter(d =>
  d.date instanceof Date &&
  !isNaN(d.sp500) &&
  !isNaN(d.cases) &&
  !isNaN(d.deaths)
);
console.log("Cleaned Data", cleanData.slice(0, 5));
      cleanData.forEach(d => {
        g.append("circle").attr("cx", x(d.date)).attr("cy", yLeft(d.sp500)).attr("r", 3).attr("fill", "steelblue")
          .on("mouseover", event => showTooltip(event, `<b>${d.date.toDateString()}</b><br>S&P 500: ${d.sp500.toFixed(2)}`))
          .on("mouseout", hideTooltip);

        g.append("circle").attr("cx", x(d.date)).attr("cy", yRight(d.cases)).attr("r", 3).attr("fill", "orange")
          .on("mouseover", event => showTooltip(event, `<b>${d.date.toDateString()}</b><br>Cases: ${Math.round(d.cases).toLocaleString()}`))
          .on("mouseout", hideTooltip);

        g.append("circle").attr("cx", x(d.date)).attr("cy", yRight(d.deaths)).attr("r", 3).attr("fill", "red")
          .on("mouseover", event => showTooltip(event, `<b>${d.date.toDateString()}</b><br>Deaths: ${Math.round(d.deaths).toLocaleString()}`))
          .on("mouseout", hideTooltip);
      });
    const legend = svg6.append("g").attr("transform", `translate(${width + margin.left + 10},${margin.top})`);

    const legendData = [
      { label: "S&P 500 Index", color: "steelblue" },
      { label: "COVID-19 Cases", color: "orange" },
      { label: "COVID-19 Deaths", color: "red", dashed: true }
    ];

    legendData.forEach((d, i) => {
      const y = i * 25;
      legend.append("line")
        .attr("x1", 0).attr("y1", y).attr("x2", 30).attr("y2", y)
        .style("stroke", d.color)
        .style("stroke-width", 2)
        .style("stroke-dasharray", d.dashed ? "4 2" : "none");

      legend.append("text")
        .attr("x", 40)
        .attr("y", y + 5)
        .text(d.label)
        .style("font-size", "12px");
    });
  });
}
  function showTooltip(event, content) {
    tooltip.html(content)
      .style("visibility", "visible")
      .style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 30) + "px");
  }

  function hideTooltip() {
    tooltip.style("visibility", "hidden");
  }
});
