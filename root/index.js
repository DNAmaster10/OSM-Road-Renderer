async function parseOSMUrl() {
    const url = document.getElementById("url_input_box").value;
    const match = url.match(/#map=(\d+)\/([-\d.]+)\/([-\d.]+)/);
    if (!match) {
        document.getElementById("error_output").innerHTML = "Error parsing URL!";
        return;
    }
    document.getElementById("error_output").innerHTML = "";

    const zoom = +match[1];
    const lat  = +match[2];
    const lon  = +match[3];

    const deg   = 360 / Math.pow(2, zoom);
    const south = lat - deg;
    const north = lat + deg;
    const west  = lon - deg;
    const east  = lon + deg;

    document.getElementById("error_output").innerHTML = "Fetching...";

    const query = `
        [out:json][bbox:${south},${west},${north},${east}];
        (
            way[highway];
            way["area:highway"];
            way[landuse];
            way[building];
            way[natural];
        );
        out geom;
    `;

    const res = await fetch("https://overpass.kumi.systems/api/interpreter", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "data=" + encodeURIComponent(query)
    });
    const data = await res.json();

    console.log(data.elements); // just to check it's working
    document.getElementById("error_output").innerHTML = "Done! Got " + data.elements.length + " features.";

    // Draw to canvas
    const canvas = document.getElementById("map_canvas");
    const ctx = canvas.getContext("2d");

    // Clear canvas
    ctx.fillStyle = "#f2efe9";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Project function
    function project(lat, lon) {
        const x = (lon - west) / (east - west) * canvas.width;
        const y = (north - lat) / (north - south) * canvas.height;
        return [x, y];
    }

    // Draw all ways as lines just to see something
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 1;

    // bucket by layer
    const buckets = {};
    for (const way of data.elements) {
        const layer = parseInt(way.tags?.layer ?? "0");
        (buckets[layer] ??= []).push(way);
    }

    const layerNums = Object.keys(buckets).map(Number).sort((a, b) => a - b);

    for (const layerNum of layerNums) {
        const features = buckets[layerNum];

        // 1. landuse
        for (const way of features) {
            if (!way.geometry || !way.tags?.landuse) continue;
            ctx.beginPath();
            way.geometry.forEach(({lat, lon}, i) => {
                const [x, y] = project(lat, lon);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.fillStyle = "#c8d8a8";
            ctx.fill();
        }
        
        if (layerNum > 0) {
            ctx.shadowColor = "rgba(0,0,0,0.4)";
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
        }
        
        // 2. area:highway
        for (const way of features) {
            if (!way.geometry || !way.tags?.["area:highway"]) continue;
            ctx.beginPath();
            way.geometry.forEach(({lat, lon}, i) => {
                const [x, y] = project(lat, lon);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.fillStyle = "#e0d8d0";
            ctx.fill();
        }

        for (const way of features) {
            if (!way.geometry || !way.tags?.highway) continue;
            ctx.beginPath();
            way.geometry.forEach(({lat, lon}, i) => {
                const [x, y] = project(lat, lon);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.strokeStyle = "#999";
            ctx.lineWidth = 5;
            ctx.stroke();
        }
        // turn shadow off immediately after casings
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // 4. road fills
        for (const way of features) {
            if (!way.geometry || !way.tags?.highway) continue;
            ctx.beginPath();
            way.geometry.forEach(({lat, lon}, i) => {
                const [x, y] = project(lat, lon);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        // 5. buildings
        for (const way of features) {
            if (!way.geometry || !way.tags?.building) continue;
            ctx.beginPath();
            way.geometry.forEach(({lat, lon}, i) => {
                const [x, y] = project(lat, lon);
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.fillStyle = "#d9c8b4";
            ctx.strokeStyle = "#b8a898";
            ctx.lineWidth = 1;
            ctx.fill();
            ctx.stroke();
        }
    }
}