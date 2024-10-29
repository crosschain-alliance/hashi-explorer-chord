// Description: This file contains the code to create the chord chart.

// Read the data from the json api, and create the chord chart
const apiUrl = "https://hashi-explorer.xyz/iframe/api/query";

// Read odata from querystring if present, and use it instead of the api
const urlParams = new URLSearchParams(window.location.search);
const dataParam = urlParams.get('data');

let originalData = []; // To store the fetched data
let currentType = 'mainnet'; // Default view

if (dataParam) {
    try {
        originalData = JSON.parse(dataParam);
        loadChordChart();
    } catch (e) {
        console.error('Invalid JSON in data parameter:', e);
        displayError('Invalid data provided.');
    }
} else {
    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            originalData = data;
            loadChordChart();
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            displayError('Failed to fetch data.');
        });
}

function displayError(message) {
    d3.select("#chart").append("svg")
        .attr("width", 640)
        .attr("height", 480)
        .append("text")
        .attr("x", 320)
        .attr("y", 240)
        .attr("text-anchor", "middle")
        .attr("font-size", "24px")
        .attr("fill", "red")
        .text(message);
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

function beautifyChainName(chain){
    const chainMap = {
        "bnb": "BNB Chain",
        "gnosis": "Gnosis Chain",
        "polygon": "Polygon",
        "base": "Base",
        "optimism": "Optimism",
        "arbitrum": "Arbitrum",
        "ethereum_sepolia": "Ethereum Sepolia",
        "unichain_sepolia": "Unichain Testnet",
        "gnosis_chiado": "Gnosis Chiado"
    };
    return chainMap[chain] || chain;
}

function loadChordChart() {
    // Initial rendering based on the default type
    renderChart(currentType);
    
    // Add event listener to the switch
    const viewSwitch = document.getElementById('viewSwitch');
    viewSwitch.addEventListener('change', () => {
        currentType = viewSwitch.checked ? 'testnet' : 'mainnet';
        renderChart(currentType);
    });
}

function renderChart(type) {
    // Clear any existing SVG
    d3.select("#chart").selectAll("svg").remove();

    const THRESHOLD = 1000 * 60 * 60 * 24 * 7 * 6; // 6 weeks

    // Process originalData to compute type if not already present
    const processedData = originalData.map(item => {
        let type = "mainnet";
        if (
            (item.source_chain && item.source_chain.includes("_") && !item.source_chain.includes("_mainnet")) ||
            (item.target_chain && item.target_chain.includes("_") && !item.target_chain.includes("_mainnet"))
        ) {
            type = "testnet";
        }
        let lastAgreedBlockTime = item.last_agreed_block_time || new Date().toISOString();
        let age = Date.now() - new Date(lastAgreedBlockTime).getTime();
        return {
            source: beautifyChainName(item.source_chain),
            target: beautifyChainName(item.target_chain),
            type: type,
            value: 1, // Assuming each connection has a value of 1
            age: age
        };
    }).filter(d => d.age <= THRESHOLD && d.type === type); // Filter based on age and current type

    // If no data is available for the selected type, display a message
    if (processedData.length === 0) {
        d3.select("#chart").append("svg")
            .attr("width", 640)
            .attr("height", 480)
            .append("text")
            .attr("x", 320)
            .attr("y", 240)
            .attr("text-anchor", "middle")
            .attr("font-size", "24px")
            .text(`No ${capitalize(type)} data available`);
        return;
    }

    // Continue with chord chart creation
    const data = processedData;

    function getAge(source, destination){
        for (let i = 0; i < data.length; i++) {
            if (data[i].source === source && data[i].target === destination){
                return beautifyTimeDiff(data[i].age);
            }
        }
        return 'Unknown';
    }

    function opacityFor(source, destination){
        for (let i = 0; i < data.length; i++) {
            if (data[i].source === source && data[i].target === destination){
                const age = data[i].age;
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
    const padding = 150; // Reduced padding to minimize empty space while preventing label cropping
    const innerRadius = Math.min(width, height) * 0.5 - 20;
    const outerRadius = innerRadius + 6;

    const names = Array.from(new Set(data.flatMap(d => [d.source, d.target])));
    const index = new Map(names.map((name, i) => [name, i]));
    const matrix = Array.from(index, () => new Array(names.length).fill(0));

    for (const { source, target, value } of data) {
      matrix[index.get(source)][index.get(target)] += value;
    }

    const chordGenerator = d3.chordDirected()
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

    const svg = d3.select("#chart").append("svg")
        .attr("viewBox", [
            -width / 2 - padding, 
            -height / 2 - padding, 
            width + padding * 2, 
            height + padding * 2
        ].join(' '))
        .attr("preserveAspectRatio", "xMidYMid meet");

    // Create the tooltip reference
    const tooltip = d3.select("#tooltip");

    const chords = chordGenerator(matrix);

    // Draw ribbons (the arcs that connect groups)
    svg.append("g")
        .selectAll("path")
        .data(chords)
        .join("path")
        .attr("d", ribbon)
        .attr("fill-opacity", d => opacityFor(names[d.source.index], names[d.target.index]))
        .attr("fill", d => colors[d.source.index % colors.length]) // Ensure color index is within bounds
        .style("mix-blend-mode", "multiply")
        .on("mouseover", (event, d) => {
            tooltip.style("opacity", 1) // Show tooltip
                .html(`The last <b>${names[d.source.index]}</b> block header was propagated on <b>${names[d.target.index]}</b> ${getAge(names[d.source.index], names[d.target.index])}`) // Update tooltip content
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
        });

    // Draw groups (the outer arc for each group)
    const group = svg.append("g")
      .selectAll("g")
      .data(chords.groups)
      .join("g");

    group.append("path")
      .attr("d", arc)
      .attr("fill", d => colors[d.index % colors.length])
      .attr("stroke", "#fff");

    group.append("text")
      .attr("dy", -3)
      .attr("transform", d => {
          const angle = (d.startAngle + d.endAngle) / 2;
          const rotate = angle * 180 / Math.PI - 90;
          return `rotate(${rotate}) translate(${outerRadius + 15}) ${angle > Math.PI ? "rotate(180)" : ""}`; // Adjusted translation to fit within reduced padding
      })
      .attr("text-anchor", d => (d.startAngle + d.endAngle) / 2 > Math.PI ? "end" : "start")
      .attr("font-size", "16px") // Ensure readability
      .text(d => names[d.index]);
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}