let gdpData = [];
let unemploymentData = [];
const tooltip = d3.select("#tooltip");

// Helper function to get dimensions from container
function getDimensions(selector) {
  const container = d3.select(selector).node();
  return {
    width: container.clientWidth,
    height: container.clientHeight
  };
}

// Initialize all charts
function initCharts() {
  Promise.all([
    d3.json("/data/covid"),
    d3.json("/data/gdp_vs_cases"),
    d3.json("/data/unemployment")
  ]).then(([covidData, gdpLoaded, unempLoaded]) => {
    gdpData = gdpLoaded;
    unemploymentData = unempLoaded;

    // Set up country selector
    const select = d3.select("#countrySelect");
    const countries = [...new Set(covidData.map(d => d.location))]; // Remove duplicates
    
    select.selectAll("option")
      .data(countries)
      .enter()
      .append("option")
      .attr("value", d => d)
      .text(d => d)
      .property("selected", (d, i) => i < 2);

    const defaultCountries = countries.slice(0, 2);
    updateAllCharts(defaultCountries);

    select.on("change", function() {
      const selected = Array.from(this.selectedOptions).map(opt => opt.value);
      updateAllCharts(selected);
    });
  }).catch(error => {
    console.error("Error loading data:", error);
  });
}

// Update all charts with new country selection
function updateAllCharts(selectedCountries) {
  updateCasesChart(selectedCountries);
  updateScatterPlot(selectedCountries);
  updateUnemploymentPlot(selectedCountries);
  updateVaccinationPlot(selectedCountries);
  updateBubbleChart(selectedCountries);
  updateStockMarketPlot(selectedCountries);
}

// Cases and Deaths Over Time Chart
function updateCasesChart(selectedCountries) {
  d3.json("/data/covid").then(covidData => {
    // Handle both array and single country selection
    const filtered = covidData.filter(d =>
      Array.isArray(selectedCountries)
        ? selectedCountries.includes(d.location)
        : d.location === selectedCountries
    );

    if (filtered.length === 0) {
      const svg = d3.select("#casesPlot");
      svg.selectAll("*").remove();
      svg.append("text")
        .attr("x", svg.node().clientWidth/2)
        .attr("y", svg.node().clientHeight/2)
        .attr("text-anchor", "middle")
        .text("No data available for selected country");
      return;
    }

    const dim = getDimensions("#casesPlot");
    const margin = {top: 50, right: 160, bottom: 70, left: 80};
    const width = dim.width - margin.left - margin.right;
    const height = dim.height - margin.top - margin.bottom;

    const svg = d3.select("#casesPlot");
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const allDates = filtered.flatMap(d => d.values.map(p => new Date(p.date)));
    const allCases = filtered.flatMap(d => d.values.map(p => p.cases));
    const allDeaths = filtered.flatMap(d => d.values.map(p => p.deaths));

    // X-axis with original formatting
    const x = d3.scaleTime()
      .domain(d3.extent(allDates))
      .range([0, width]);

    const yCases = d3.scaleLinear()
      .domain([0, d3.max(allCases)])
      .range([height, 0])
      .nice();

    const yDeaths = d3.scaleLinear()
      .domain([0, d3.max(allDeaths)])
      .range([height, 0])
      .nice();

    // Use two different color scales for cases and deaths
    const colorCases = d3.scaleOrdinal(d3.schemeTableau10);
    const colorDeaths = d3.scaleOrdinal(d3.schemeDark2);

    // Add x-axis (keeping original formatting)
    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .append("text")
      .attr("x", width/2)
      .attr("y", 40)
      .attr("fill", "#000")
      .attr("text-anchor", "middle")
      .style("font-weight", "bold")
      .text("Date");

    // Add y-axis for cases with label
    g.append("g")
      .attr("class", "y-axis-cases")
      .call(d3.axisLeft(yCases)
        .tickFormat(d => d3.format(",")(d)) // Format with commas
      )
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -50)
      .attr("x", -height/2)
      .attr("fill", "#000")
      .attr("text-anchor", "middle")
      .style("font-weight", "bold")
      .text("Number of Cases");

    // Add y-axis for deaths with label
    g.append("g")
      .attr("class", "y-axis-deaths")
      .attr("transform", `translate(${width}, 0)`)
      .call(d3.axisRight(yDeaths)
        .tickFormat(d => d3.format(",")(d)) // Format with commas
      )
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 60)
      .attr("x", height/2)
      .attr("fill", "#000")
      .attr("text-anchor", "middle")
      .style("font-weight", "bold")
      .text("Number of Deaths");

    // Create line generators
    const lineCases = d3.line()
      .x(d => x(new Date(d.date)))
      .y(d => yCases(d.cases));

    const lineDeaths = d3.line()
      .x(d => x(new Date(d.date)))
      .y(d => yDeaths(d.deaths));

    // Draw lines only
    filtered.forEach(country => {
      // Cases line (solid)
      g.append("path")
        .datum(country.values)
        .attr("class", "cases-line")
        .attr("d", lineCases)
        .attr("stroke", colorCases(country.location))
        .attr("stroke-width", 2)
        .attr("fill", "none")
        .on("mouseover", function(event) {
          d3.select(this).attr("stroke-width", 3);
          const date = x.invert(d3.pointer(event)[0]);
          const closest = d3.least(country.values, d => Math.abs(new Date(d.date) - date));
          showTooltip(event, `
            <b>${country.location} - Cases</b><br>
            Date: ${closest.date}<br>
            Cases: ${d3.format(",")(Math.round(closest.cases))}
          `);
        })
        .on("mouseout", function() {
          d3.select(this).attr("stroke-width", 2);
          hideTooltip();
        });

      // Deaths line (solid, different color)
      g.append("path")
        .datum(country.values)
        .attr("class", "deaths-line")
        .attr("d", lineDeaths)
        .attr("stroke", colorDeaths(country.location))
        .attr("stroke-width", 2)
        .attr("fill", "none")
        .on("mouseover", function(event) {
          d3.select(this).attr("stroke-width", 3);
          const date = x.invert(d3.pointer(event)[0]);
          const closest = d3.least(country.values, d => Math.abs(new Date(d.date) - date));
          showTooltip(event, `
            <b>${country.location} - Deaths</b><br>
            Date: ${closest.date}<br>
            Deaths: ${d3.format(",")(Math.round(closest.deaths))}
          `);
        })
        .on("mouseout", function() {
          d3.select(this).attr("stroke-width", 2);
          hideTooltip();
        });
    });

    // Add legend with both cases and deaths
    const legend = svg.append("g")
      .attr("transform", `translate(${width - 220}, ${margin.top + 10})`);

    filtered.forEach((country, i) => {
      const yPos = i * 40;

      // Cases legend item
      legend.append("line")
        .attr("x1", 0)
        .attr("y1", yPos)
        .attr("x2", 20)
        .attr("y2", yPos)
        .attr("stroke", colorCases(country.location))
        .attr("stroke-width", 2);

      legend.append("text")
        .attr("x", 30)
        .attr("y", yPos + 5)
        .text(`${country.location} Cases`)
        .style("font-size", "12px");

      // Deaths legend item
      legend.append("line")
        .attr("x1", 0)
        .attr("y1", yPos + 20)
        .attr("x2", 20)
        .attr("y2", yPos + 20)
        .attr("stroke", colorDeaths(country.location))
        .attr("stroke-width", 2);

      legend.append("text")
        .attr("x", 30)
        .attr("y", yPos + 25)
        .text(`${country.location} Deaths`)
        .style("font-size", "12px");
    });

    // Add chart title
    svg.append("text")
      .attr("x", width/2 + margin.left)
      .attr("y", margin.top/2)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text(`COVID-19 Cases and Deaths${filtered.length === 1 ? ` in ${filtered[0].location}` : ""}`);
  }).catch(error => {
    console.error("Error loading COVID data:", error);
    const svg = d3.select("#casesPlot");
    svg.selectAll("*").remove();
    svg.append("text")
      .attr("x", dim.width/2)
      .attr("y", dim.height/2)
      .attr("text-anchor", "middle")
      .text("Error loading data");
  });
}

// GDP vs Cases Scatter Plot
function updateScatterPlot(selectedCountries) {
  // Filter data with better validation
  const selectedData = gdpData.filter(d =>
    selectedCountries.includes(d.location) &&
    !isNaN(d.total_cases) &&
    !isNaN(d.gdp_per_capita) &&
    d.total_cases > 0 &&
    d.gdp_per_capita > 0
  );

  const dim = getDimensions("#scatterPlot");
  const margin = {top: 50, right: 30, bottom: 50, left: 60};
  const width = dim.width - margin.left - margin.right;
  const height = dim.height - margin.top - margin.bottom;

  const svg = d3.select("#scatterPlot");
  svg.selectAll("*").remove();

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  if (selectedData.length === 0) {
    g.append("text")
      .attr("x", width/2)
      .attr("y", height/2)
      .attr("text-anchor", "middle")
      .text("No valid data available for selected countries");
    return;
  }

  // Log data for debugging
  console.log("Selected countries data:", selectedData);

  // Set domains with padding but without extreme values distorting scale
  const xExtent = d3.extent(selectedData, d => d.total_cases);
  const yExtent = d3.extent(selectedData, d => d.gdp_per_capita);

  const x = d3.scaleLinear()
    .domain([0, xExtent[1] * 1.1]) // Start at 0 for cases
    .range([0, width])
    .nice();

  const y = d3.scaleLinear()
    .domain([0, yExtent[1] * 1.1]) // Start at 0 for GDP
    .range([height, 0])
    .nice();

  // Add axes with improved formatting
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x)
      .ticks(5)
      .tickFormat(d => d3.format("~s")(d).replace("G","B"))); // Replace G with B for billions

  g.append("g")
    .call(d3.axisLeft(y)
      .ticks(5)
      .tickFormat(d => "$" + d3.format("~s")(d)));

  // Add axis labels
  g.append("text")
    .attr("x", width / 2)
    .attr("y", height + 40)
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .text("Total COVID-19 Cases");

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -45)
    .attr("text-anchor", "middle")
    .style("font-weight", "bold")
    .text("GDP per Capita (USD)");

  // Add circles with better positioning logic
  g.selectAll("circle")
    .data(selectedData)
    .enter()
    .append("circle")
    .attr("cx", d => x(d.total_cases))
    .attr("cy", d => y(d.gdp_per_capita))
    .attr("r", 8) // Fixed size for better visibility
    .style("fill", "orange")
    .style("opacity", 0.8)
    .on("mouseover", (event, d) => showTooltip(event,
       `<b>${d.location}</b><br>
        Cases: ${d3.format(",")(d.total_cases)}<br>
        GDP: $${d3.format(",")(d.gdp_per_capita)}`))
    .on("mouseout", hideTooltip);

  // Add country labels with collision avoidance
  const labels = g.selectAll("text.label")
    .data(selectedData)
    .enter()
    .append("text")
    .attr("x", d => x(d.total_cases) + 10)
    .attr("y", d => y(d.gdp_per_capita) + 4)
    .text(d => d.location)
    .attr("class", "country-label")
    .style("font-size", "10px")
    .style("fill", "#333")
    .style("pointer-events", "none");

  // Simple collision avoidance
  labels.each(function() {
    const thisLabel = d3.select(this);
    const thisY = parseFloat(thisLabel.attr("y"));

    labels.each(function() {
      const otherLabel = d3.select(this);
      if (thisLabel.node() !== otherLabel.node()) {
        const otherY = parseFloat(otherLabel.attr("y"));
        if (Math.abs(thisY - otherY) < 15) { // If labels overlap vertically
          // Adjust one of them
          otherLabel.attr("y", otherY + 15);
        }
      }
    });
  });
}

// Unemployment Before/After Chart
function updateUnemploymentPlot(selectedCountries) {
  const data = unemploymentData.filter(d => selectedCountries.includes(d.location));
  const dim = getDimensions("#unemploymentPlot");
  
  const margin = {top: 50, right: 30, bottom: 100, left: 60};
  const width = dim.width - margin.left - margin.right;
  const height = dim.height - margin.top - margin.bottom;

  const svg = d3.select("#unemploymentPlot");
  svg.selectAll("*").remove();

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  if (data.length === 0) return;

  const x0 = d3.scaleBand()
    .domain(data.map(d => d.location))
    .range([0, width])
    .paddingInner(0.2);
    
  const x1 = d3.scaleBand()
    .domain(["before", "after"])
    .range([0, x0.bandwidth()])
    .padding(0.05);
    
  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => Math.max(d.before, d.after)) * 1.1])
    .range([height, 0]);
    
  const color = d3.scaleOrdinal()
    .domain(["before", "after"])
    .range(["#4daf4a", "#e41a1c"]);

  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x0))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  g.append("g").call(d3.axisLeft(y));

  g.selectAll("g.bar-group")
    .data(data)
    .enter()
    .append("g")
    .attr("class", "bar-group")
    .attr("transform", d => `translate(${x0(d.location)},0)`)
    .selectAll("rect")
    .data(d => ["before", "after"].map(key => ({key: key, value: d[key]})))
    .enter()
    .append("rect")
    .attr("x", d => x1(d.key))
    .attr("y", d => y(d.value))
    .attr("width", x1.bandwidth())
    .attr("height", d => height - y(d.value))
    .attr("fill", d => color(d.key))
    .on("mouseover", (event, d) => showTooltip(event, `<b>${d.key === "before" ? "2019" : "2021"}</b><br>Rate: ${d.value.toFixed(2)}%`))
    .on("mouseout", hideTooltip);

  const legend = svg.append("g")
    .attr("transform", `translate(${width - 120}, 20)`);
    
  ["before", "after"].forEach((label, i) => {
    const yOffset = i * 25;
    legend.append("rect")
      .attr("x", 0)
      .attr("y", yOffset)
      .attr("width", 18)
      .attr("height", 18)
      .attr("fill", color(label));
      
    legend.append("text")
      .attr("x", 24)
      .attr("y", yOffset + 14)
      .text(label === "before" ? "2019 (Before)" : "2021 (After)");
  });
}

// Vaccination Rate Chart
function updateVaccinationPlot(selectedCountries) {
  d3.json("/data/covid").then(covidData => {
    const dim = getDimensions("#vaxPlot");
    const margin = {top: 50, right: 30, bottom: 100, left: 60};
    const width = dim.width - margin.left - margin.right;
    const height = dim.height - margin.top - margin.bottom;

    const svg = d3.select("#vaxPlot");
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

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

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -45)
      .attr("text-anchor", "middle")
      .style("font-weight", "bold")
      .text("% Fully Vaccinated");
  });
}

// Vaccination vs GDP Bubble Chart
function updateBubbleChart(selectedCountries) {
  d3.json("/data/vax_gdp_bubble").then(data => {
    // Filter data - ensure it works with single country (string) or multiple countries (array)
    const filtered = data.filter(d =>
      (Array.isArray(selectedCountries)
        ? selectedCountries.includes(d.location)
        : d.location === selectedCountries) &&
      d.vax_rate != null &&
      d.gdp_change != null &&
      d.population != null
    );

    const dim = getDimensions("#bubbleChart");
    const margin = { top: 50, right: 30, bottom: 60, left: 80 };
    const width = dim.width - margin.left - margin.right;
    const height = dim.height - margin.top - margin.bottom;

    const svg = d3.select("#bubbleChart");
    svg.selectAll("*").remove();

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    if (filtered.length === 0) {
      g.append("text")
        .attr("x", width/2)
        .attr("y", height/2)
        .attr("text-anchor", "middle")
        .text("No data available for selected country");
      return;
    }

    // Find the maximum radius to adjust domain
    const maxPopulation = d3.max(filtered, d => d.population);
    const r = d3.scaleSqrt()
      .domain([0, maxPopulation])
      .range([10, 40]); // Increased minimum size for single country

    // Adjust domains to show all bubbles clearly
    const x = d3.scaleLinear()
      .domain([
        d3.min(filtered, d => d.vax_rate) * 0.9,
        d3.max(filtered, d => d.vax_rate) * 1.1
      ])
      .range([0, width])
      .nice();

    const y = d3.scaleLinear()
      .domain([
        d3.min(filtered, d => d.gdp_change) * 1.1,
        d3.max(filtered, d => d.gdp_change) * 1.1
      ])
      .range([height, 0])
      .nice();

    // Clip bubbles to chart area
    g.append("clipPath")
      .attr("id", "chart-clip")
      .append("rect")
      .attr("width", width)
      .attr("height", height);

    // Draw axes
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

    // Create bubble groups
    const bubbleGroups = g.append("g")
      .attr("clip-path", "url(#chart-clip)")
      .selectAll(".bubble-group")
      .data(filtered)
      .enter()
      .append("g")
      .attr("class", "bubble-group");

    // Add bubbles
    bubbleGroups.append("circle")
      .attr("cx", d => x(d.vax_rate))
      .attr("cy", d => y(d.gdp_change))
      .attr("r", d => r(d.population))
      .style("fill", d => filtered.length === 1 ? "#2ca02c" : "teal") // Different color for single country
      .style("opacity", 0.7)
      .on("mouseover", function(event, d) {
        d3.select(this).style("opacity", 1);
        showTooltip(event, `
          <b>${d.location}</b><br>
          Vaccination Rate: ${d.vax_rate.toFixed(1)}%<br>
          GDP Change: $${d3.format(",.2f")(d.gdp_change)}<br>
          Population: ${d3.format(",")(d.population)}
        `);
      })
      .on("mouseout", function() {
        d3.select(this).style("opacity", 0.7);
        hideTooltip();
      });

    // Add country names on top of bubbles
    bubbleGroups.append("text")
      .attr("x", d => x(d.vax_rate))
      .attr("y", d => y(d.gdp_change))
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .text(d => d.location)
      .style("font-size", d => `${Math.min(14, r(d.population)/2)}px`) // Dynamic font size
      .style("font-weight", "bold")
      .style("fill", "white")
      .style("pointer-events", "none")
      .style("text-shadow", "1px 1px 2px rgba(0,0,0,0.7)");

    // Add title showing selected countries
    svg.append("text")
      .attr("x", width/2 + margin.left)
      .attr("y", margin.top/2)
      .attr("text-anchor", "middle")
      .text(`Vaccination vs GDP Change${filtered.length === 1 ? ` (${filtered[0].location})` : ""}`);

  }).catch(error => {
    console.error("Error loading bubble chart data:", error);
    const svg = d3.select("#bubbleChart");
    svg.selectAll("*").remove();
    svg.append("text")
      .attr("x", dim.width/2)
      .attr("y", dim.height/2)
      .attr("text-anchor", "middle")
      .text("Error loading data");
  });
}

// Stock Market vs COVID Trends
// Stock Market vs COVID Trends
function updateStockMarketPlot(selectedCountries) {
  const url = `/data/stock_market?${selectedCountries.map(c => `country=${encodeURIComponent(c)}`).join('&')}`;

  d3.json(url).then(response => {
    const data = response.data;
    const countriesIncluded = response.countries_included;

    // Increase right margin to accommodate larger legend
    const dim = getDimensions("#stockPlot");
    const margin = {top: 60, right: 150, bottom: 60, left: 60};  // Increased right margin
    const width = dim.width - margin.left - margin.right;
    const height = dim.height - margin.top - margin.bottom;

    const svg = d3.select("#stockPlot");
    svg.selectAll("*").remove();

    // Create group for the chart
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    if (!data || data.length === 0) {
      g.append("text")
        .attr("x", width/2)
        .attr("y", height/2)
        .attr("text-anchor", "middle")
        .text(response.message || "No data available");
      return;
    }

    // Parse dates and prepare data
    const parseDate = d3.timeParse("%Y-%m");
    const processedData = data.map(d => ({
      date: parseDate(d.month),
      stock_price: +d.stock_price,
      covid_cases: +d.covid_cases,
      covid_deaths: +d.covid_deaths,
      location: d.location
    })).filter(d => d.date instanceof Date && !isNaN(d.date));

    // Set up color scales using a wider palette
    const colorPalette = [
      "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
      "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
      "#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5"
    ];

    const colorScale = d3.scaleOrdinal()
      .domain(["Stock Market", ...countriesIncluded])
      .range(colorPalette);

    // Set up scales
    const x = d3.scaleTime()
      .domain(d3.extent(processedData, d => d.date))
      .range([0, width])
      .nice();

    const yLeft = d3.scaleLinear()
      .domain([0, d3.max(processedData, d => d.stock_price) * 1.1])
      .range([height, 0])
      .nice();

    const maxCovidValue = d3.max(processedData, d => Math.max(d.covid_cases, d.covid_deaths));
    const yRight = d3.scaleLinear()
      .domain([0, maxCovidValue * 1.2])
      .range([height, 0])
      .nice();

    // Create line generators
    const lineStock = d3.line()
      .x(d => x(d.date))
      .y(d => yLeft(d.stock_price));

    const lineCases = d3.line()
      .x(d => x(d.date))
      .y(d => yRight(d.covid_cases));

    const lineDeaths = d3.line()
      .x(d => x(d.date))
      .y(d => yRight(d.covid_deaths));

    // Draw stock price line (always shown)
    const stockLine = g.append("path")
      .datum(processedData.filter((d, i, arr) =>
        arr.findIndex(a => +a.date === +d.date) === i
      ))
      .attr("class", "line")
      .attr("d", lineStock)
      .attr("stroke", colorScale("Stock Market"))
      .attr("stroke-width", 2)
      .style("opacity", 0.9);

    // Add tooltip for stock line
    stockLine.on("mouseover", function(event) {
      const date = x.invert(d3.pointer(event, this)[0]);
      const closest = d3.least(processedData, d => Math.abs(d.date - date));

      showTooltip(event, `
        <b>S&P 500 Index</b><br>
        Date: ${d3.timeFormat("%b %Y")(closest.date)}<br>
        Value: ${d3.format(",.2f")(closest.stock_price)}
      `);
    }).on("mouseout", hideTooltip);

    // Draw COVID data for each selected country
    countriesIncluded.forEach(country => {
      const countryData = processedData.filter(d => d.location === country);

      // Cases line
      const casesLine = g.append("path")
        .datum(countryData)
        .attr("class", "line")
        .attr("d", lineCases)
        .attr("stroke", colorScale(country))
        .attr("stroke-width", 2)
        .style("opacity", 0.8);

      // Add tooltip for cases line
      casesLine.on("mouseover", function(event) {
        const date = x.invert(d3.pointer(event, this)[0]);
        const closest = d3.least(countryData, d => Math.abs(d.date - date));

        showTooltip(event, `
          <b>${country} - Cases</b><br>
          Date: ${d3.timeFormat("%b %Y")(closest.date)}<br>
          Cases: ${d3.format(",")(closest.covid_cases)}
        `);
      }).on("mouseout", hideTooltip);

      // Deaths line (dashed)
      const deathsLine = g.append("path")
        .datum(countryData)
        .attr("class", "line")
        .attr("d", lineDeaths)
        .attr("stroke", d3.color(colorScale(country)).darker(0.5))
        .attr("stroke-width", 2)
        .style("stroke-dasharray", "4 2")
        .style("opacity", 0.8);

      // Add tooltip for deaths line
      deathsLine.on("mouseover", function(event) {
        const date = x.invert(d3.pointer(event, this)[0]);
        const closest = d3.least(countryData, d => Math.abs(d.date - date));

        showTooltip(event, `
          <b>${country} - Deaths</b><br>
          Date: ${d3.timeFormat("%b %Y")(closest.date)}<br>
          Deaths: ${d3.format(",")(closest.covid_deaths)}
        `);
      }).on("mouseout", hideTooltip);
    });

    // Add axes
    g.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(d3.timeMonth.every(3)));

    g.append("g")
      .call(d3.axisLeft(yLeft))
      .append("text")
      .attr("fill", "#000")
      .attr("transform", "rotate(-90)")
      .attr("y", -40)
      .attr("x", -height/2)
      .attr("text-anchor", "middle")
      .text("S&P 500 Index");

    g.append("g")
      .attr("transform", `translate(${width},0)`)
      .call(d3.axisRight(yRight))
      .append("text")
      .attr("fill", "#000")
      .attr("transform", "rotate(-90)")
      .attr("y", 50)
      .attr("x", height/2)
      .attr("text-anchor", "middle")
      .text("COVID Cases/Deaths");

    // Add dynamic legend in top-right corner with more spacing
    const legend = svg.append("g")
      .attr("transform", `translate(${width - 120},${margin.top - 20})`);  // Adjusted position

    // Add stock legend item with increased vertical spacing
    legend.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", 30)
      .attr("y2", 0)
      .style("stroke", colorScale("Stock Market"))
      .style("stroke-width", 2);

    legend.append("text")
      .attr("x", 40)
      .attr("y", 5)
      .text("S&P 500")
      .style("font-size", "12px");

    // Add country-specific legend items with increased spacing
    const itemsPerColumn = Math.ceil(countriesIncluded.length / 2);
    const columnWidth = 120;
    const verticalSpacing = 25;  // Increased from 20 to 25

    countriesIncluded.forEach((country, i) => {
      const column = i < itemsPerColumn ? 0 : 1;
      const row = i < itemsPerColumn ? i : i - itemsPerColumn;
      const yPos = (row + 1) * verticalSpacing;  // Using increased spacing
      const xPos = column * columnWidth;

      // Cases legend
      legend.append("line")
        .attr("x1", xPos)
        .attr("y1", yPos)
        .attr("x2", xPos + 30)
        .attr("y2", yPos)
        .style("stroke", colorScale(country))
        .style("stroke-width", 2);

      legend.append("text")
        .attr("x", xPos + 40)
        .attr("y", yPos + 5)
        .text(`${country} Cases`)
        .style("font-size", "12px");

      // Deaths legend with additional spacing
      legend.append("line")
        .attr("x1", xPos)
        .attr("y1", yPos + 15)
        .attr("x2", xPos + 30)
        .attr("y2", yPos + 15)
        .style("stroke", d3.color(colorScale(country)).darker(0.5))
        .style("stroke-width", 2)
        .style("stroke-dasharray", "4 2");

      legend.append("text")
        .attr("x", xPos + 40)
        .attr("y", yPos + 20)
        .text(`${country} Deaths`)
        .style("font-size", "12px");
    });

    // Add title
    svg.append("text")
      .attr("x", width/2 + margin.left)
      .attr("y", margin.top/2)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .text("Stock Market vs COVID Trends");

  }).catch(error => {
    console.error("Error loading stock market data:", error);
    const svg = d3.select("#stockPlot");
    svg.selectAll("*").remove();
    svg.append("text")
      .attr("x", dim.width/2)
      .attr("y", dim.height/2)
      .attr("text-anchor", "middle")
      .text("Error loading data. Please try again.");
  });
}


// Tooltip functions
function showTooltip(event, content) {
  tooltip.html(content)
    .style("visibility", "visible")
    .style("left", (event.pageX + 10) + "px")
    .style("top", (event.pageY - 30) + "px");
}

function hideTooltip() {
  tooltip.style("visibility", "hidden");
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
  initCharts();
  
  // Handle window resize with debounce
  let resizeTimer;
  window.addEventListener("resize", function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      const select = d3.select("#countrySelect");
      const selected = Array.from(select.node().selectedOptions).map(opt => opt.value);
      if (selected.length > 0) {
        updateAllCharts(selected);
      }
    }, 250);
  });
});