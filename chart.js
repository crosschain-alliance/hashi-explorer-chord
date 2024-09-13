// Description: This file contains the code to create the chord chart.

// Read the data from the json api, and create the chord chart
url = "https://hashi-explorer.xyz/iframe/api/query"

// read odata from querystring if present, and use it instead of the api
const urlParams = new URLSearchParams(window.location.search);
const dataParam = urlParams.get('data');

if (dataParam) {
    loadChordChart(JSON.parse(dataParam));
} else {
    fetch(url).then(response => response.json()).then(data => {
        loadChordChart(data);
    });
}

function beautifyTimeDiff(msDiff) {
    const seconds = Math.floor(msDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);
  
    if (seconds < 60) return `~ ${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    if (minutes < 60) return `~ ${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `~ ${hours} hour${hours !== 1 ? 's' : ''} ago`;
    if (days < 7) return `~ ${days} day${days !== 1 ? 's' : ''} ago`;
    if (weeks < 5) return `~ ${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    if (months < 12) return `~ ${months} month${months !== 1 ? 's' : ''} ago`;
    return `~ ${years} year${years !== 1 ? 's' : ''} ago`;
  }

  function beatifyChainName(chain){
    if (chain == "bnb") return "BNB Chain";
    if (chain == "gnosis") return "Gnosis Chain";
    if (chain == "polygon") return "Polygon";
    if (chain == "base") return "Base";
    if (chain == "optimism") return "Optimism";
    if (chain == "arbitrum") return "Arbitrum";
    return chain;
  }
  
  


function loadChordChart(odata){
    const THRESHOLD = 1000 * 60 * 60 * 24 * 7 * 6; // 6 weeks
    // convert odata to data
    data = [];
    for (var i = 0; i < odata.length; i++) {
        value = 1; //odata[i].value;
        last_agreed_block_time = new Date().toISOString();
        if (typeof odata[i].last_agreed_block_time !== 'undefined')
            last_agreed_block_time = odata[i].last_agreed_block_time;
        age = Math.floor((new Date() - new Date(last_agreed_block_time)));
        if (age > THRESHOLD) continue;
        data.push({source: beatifyChainName(odata[i].source_chain), target: beatifyChainName(odata[i].target_chain), value: value, age: age});
    }

    //data.push({source: "BNB Chain", target: "Gnosis Chain", value: 1, age: 1000*3600});
    //data.push({target: "BNB Chain", source: "Gnosis Chain", value: 1, age: 0});

    function getAge(source, destination){
        for (var i = 0; i < data.length; i++) {
            if (data[i].source == source && data[i].target == destination){
                return beautifyTimeDiff(data[i].age);
            }
        }
        return -1;
    }

    function opacityFor(source, destination){
        for (var i = 0; i < data.length; i++) {
            if (data[i].source == source && data[i].target == destination){
                age = data[i].age;
                if (age < 1000 * 60 * 15) return 0.75; // up to 15 minutes
                if (age < 1000 * 60 * 60) return 0.65; // up to 1 hour
                if (age < 1000 * 60 * 60 * 6) return 0.55; // up to 6 hours
                if (age < 1000 * 60 * 60 * 24) return 0.5; // 6-24 hours
                if (age < 1000 * 60 * 60 * 24 * 3) return 0.4; // 1-3 days
                if (age < 1000 * 60 * 60 * 24 * 7) return 0.3; // 3-7 days
                if (age < 1000 * 60 * 60 * 24 * 7 * 4) return 0.2; // 1-4 weeks
                return 0.1;
            }
        }
        return 0;
    }

    const width = 1080; // Base width for calculations
    const height = width; // Maintain square aspect ratio
    const innerRadius = Math.min(width, height) * 0.5 - 20;
    const outerRadius = innerRadius + 6;

    const names = Array.from(new Set(data.flatMap(d => [d.source, d.target])));
    const index = new Map(names.map((name, i) => [name, i]));
    const matrix = Array.from(index, () => new Array(names.length).fill(0));

    for (const { source, target, value } of data) {
      matrix[index.get(source)][index.get(target)] += value;
    }

    const chord = d3.chordDirected()
      .padAngle(12 / innerRadius)
      .sortSubgroups(d3.descending)
      .sortChords(d3.descending);

    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);
    
      const ribbon = d3.ribbonArrow()
  .radius(innerRadius - 0.5)
  .padAngle(0.01) // Very small padding, arrows almost touch
  .headRadius(innerRadius * 0.1); // Moderately pointed arrowhead for a balanced look

    const colors = d3.schemeCategory10;

    const formatValue = x => `${x.toFixed(0)}B`;

    const svg = d3.select("#chart").append("svg")
    .attr("viewBox", [-width / 2 - 200, -height / 2 - 200, width + 400, height + 400].join(' ')) // Added extra padding
    .attr("preserveAspectRatio", "xMidYMid meet") // Keeps aspect ratio when resizing
      //.attr("style", "font: 10px sans-serif;");

    // Create the tooltip reference
    const tooltip = d3.select("#tooltip");

    const chords = chord(matrix);

    // Draw ribbons (the arcs that connect groups)
    svg.append("g")
        .selectAll("path")
        .data(chords)
        .join("path")
        .attr("d", ribbon)
        .attr("fill-opacity", function (d){ return opacityFor(names[d.source.index], names[d.target.index]) })
        .attr("fill", function(d){ return colors[d.source.index] })
        .style("mix-blend-mode", "multiply")
        .on("mouseover", (event, d) => {
            tooltip.style("opacity", 1) // Show tooltip
                .html(`The last <b>${names[d.source.index]}</b> block header was propagated on <b>${names[d.target.index]}</b> `+getAge(names[d.source.index], names[d.target.index])) // Update tooltip content
                .style("left", (event.pageX + 10) + "px") // Position tooltip near mouse
                .style("top", (event.pageY - 10) + "px");

            d3.select(event.target)
                .attr("fill-opacity", 1); // Highlight the selected arrow by changing its opacity
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.pageX + 10) + "px") // Move tooltip with the mouse
                .style("top", (event.pageY - 10) + "px");
        })
        .on("mouseout", (event, d) => {
            tooltip.style("opacity", 0); // Hide tooltip

            d3.select(event.target)
                .attr("fill-opacity", opacityFor(names[d.source.index], names[d.target.index])); // Reset the opacity of the arrow
        })
        //.append("title")
        //.text(d => `${names[d.source.index]} owes ${names[d.target.index]} ${formatValue(d.source.value)}`);

    // Draw groups (the outer arc for each group)
    const group = svg.append("g")
      .selectAll("g")
      .data(chords.groups)
      .join("g");

    group.append("path")
      .attr("d", arc)
      .attr("fill", function(d){ return colors[d.index] })
      .attr("stroke", "#fff");

    group.append("text")
      .attr("dy", -3)
      .attr("transform", d => {
        const angle = (d.startAngle + d.endAngle) / 2;
        const rotate = angle * 180 / Math.PI - 90;
        return `rotate(${rotate}) translate(${outerRadius + 10}) ${angle > Math.PI ? "rotate(180)" : ""}`;
      })
      .attr("text-anchor", d => (d.startAngle + d.endAngle) / 2 > Math.PI ? "end" : null)
      .text(d => names[d.index]);

}
