
async function computeRoute() {
    const gridWidth = parseInt(document.getElementById("gridWidth").value, 10);
    const gridHeight = parseInt(document.getElementById("gridHeight").value, 10);
    const startX = parseInt(document.getElementById("startX").value, 10);
    const startY = parseInt(document.getElementById("startY").value, 10);
    const endX = parseInt(document.getElementById("endX").value, 10);
    const endY = parseInt(document.getElementById("endY").value, 10);
    const heuristic = document.getElementById("heuristic").value;

    const body = {
        gridWidth,
        gridHeight,
        startX,
        startY,
        endX,
        endY,
        heuristic,
        cells: [] // TODO: send obstacles from a grid UI
    };

    try {
        const response = await fetch("http://localhost:8080/api/route", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const metricsDiv = document.getElementById("metrics");
        const pathOutput = document.getElementById("pathOutput");

        if (!response.ok) {
            const errorText = await response.text();
            metricsDiv.innerHTML = `<span class="error">Error: ${response.status} ${errorText}</span>`;
            pathOutput.textContent = "";
            return;
        }

        const data = await response.json();

        // Show metrics
        metricsDiv.innerHTML = `
            <p><strong>Total distance:</strong> ${data.totalDistance}</p>
            <p><strong>Visited nodes:</strong> ${data.visitedNodes}</p>
            <p><strong>Time (ms):</strong> ${data.timeMs}</p>
        `;

        // Show the raw path as text for now
        if (Array.isArray(data.path)) {
            const formattedPath = data.path
                .map(p => `(${p.x}, ${p.y})`)
                .join(" -> ");
            pathOutput.textContent = formattedPath;
        } else {
            pathOutput.textContent = "No path returned";
        }

    } catch (err) {
        document.getElementById("metrics").innerHTML =
            `<span class="error">Network or JS error: ${err}</span>`;
        document.getElementById("pathOutput").textContent = "";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const runButton = document.getElementById("runButton");
    runButton.addEventListener("click", (e) => {
        e.preventDefault();
        computeRoute();
    });
});
