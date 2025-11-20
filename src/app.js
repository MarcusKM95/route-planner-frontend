
const GRID_WIDTH = 30;
const GRID_HEIGHT = 20;
const CELL_SIZE = 20;
let canvas, ctx;
let cityTypes = []; // Array of city type objects from backend
let stops = [];         // array of { x, y, label }
let currentPath = [];   // last route path from backend


let restaurants = [];
let selectedRestaurant = null;

async function loadRestaurants() {
    try {
        const response = await fetch("http://localhost:8080/api/restaurants");
        if (!response.ok) {
            console.error("Failed to load restaurants:", response.status);
            return;
        }

        restaurants = await response.json();

        const select = document.getElementById("restaurantSelect");
        select.innerHTML = ""; // clear "Loading..." option

        if (restaurants.length === 0) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "No restaurants available";
            select.appendChild(opt);
            return;
        }

        const defaultOpt = document.createElement("option");
        defaultOpt.value = "";
        defaultOpt.textContent = "Choose a restaurant";
        select.appendChild(defaultOpt);

        restaurants.forEach(r => {
            const opt = document.createElement("option");
            opt.value = r.id;       // "pizzaplanet"
            opt.textContent = r.name; // "Pizza Planet"
            select.appendChild(opt);
        });

    } catch (err) {
        console.error("Error loading restaurants:", err);
    }
}

async function loadCityLayout() {
    try {
        const response = await fetch("http://localhost:8080/api/city/layout");
        if (!response.ok) {
            console.error("Failed to load city layout:", response.status);
            return;
        }

        const cells = await response.json();

        // Initialize array with default "ROAD"
        cityTypes = [];
        for (let y = 0; y < GRID_HEIGHT; y++) {
            cityTypes[y] = [];
            for (let x = 0; x < GRID_WIDTH; x++) {
                cityTypes[y][x] = "ROAD";
            }
        }

        // Fill with types from backend
        cells.forEach(cell => {
            const x = cell.x;
            const y = cell.y;
            const type = cell.type || "ROAD";
            if (
                y >= 0 && y < GRID_HEIGHT &&
                x >= 0 && x < GRID_WIDTH
            ) {
                cityTypes[y][x] = type;
            }
        });

        // Redraw with updated layout
        drawEmptyCity();

    } catch (err) {
        console.error("Error loading city layout:", err);
    }
}


function onRestaurantChange() {
    const select = document.getElementById("restaurantSelect");
    const selectedId = select.value;

    const startXInput = document.getElementById("startX");
    const startYInput = document.getElementById("startY");

    if (!selectedId) {
        selectedRestaurant = null;
        startXInput.value = "";
        startYInput.value = "";
        return;
    }

    const restaurant = restaurants.find(r => r.id === selectedId);
    selectedRestaurant = restaurant || null;

    if (selectedRestaurant) {
        startXInput.value = selectedRestaurant.x;
        startYInput.value = selectedRestaurant.y;

        // Reset path and stops when changing restaurant
        currentPath = [];
        stops = [];
        drawCity(currentPath, selectedRestaurant, stops);
    }
}

function initCanvas() {
    canvas = document.getElementById("cityCanvas");
    if (!canvas) return;

    // Set canvas size based on grid size
    canvas.width = GRID_WIDTH * CELL_SIZE;
    canvas.height = GRID_HEIGHT * CELL_SIZE;

    ctx = canvas.getContext("2d");

    drawEmptyCity();
}

function drawEmptyCity() {
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Overall background
    ctx.fillStyle = "#050816";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw cells by type
    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            const type =
                cityTypes[y] && cityTypes[y][x]
                    ? cityTypes[y][x]
                    : "ROAD";

            switch (type) {
                case "BUILDING":
                    ctx.fillStyle = "#4b5563";
                    break;
                case "PARK":
                    ctx.fillStyle = "#14532d";
                    break;
                case "RIVER":
                    ctx.fillStyle = "#1d4ed8";
                    break;
                case "ROAD":
                default:
                    ctx.fillStyle = "#101827";
                    break;
            }

            ctx.fillRect(
                x * CELL_SIZE,
                y * CELL_SIZE,
                CELL_SIZE,
                CELL_SIZE
            );
        }
    }

    // Draw grid lines over the colored cells
    ctx.strokeStyle = "#1f364d";
    ctx.lineWidth = 1;

    for (let x = 0; x <= GRID_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL_SIZE + 0.5, 0);
        ctx.lineTo(x * CELL_SIZE + 0.5, canvas.height);
        ctx.stroke();
    }

    for (let y = 0; y <= GRID_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL_SIZE + 0.5);
        ctx.lineTo(canvas.width, y * CELL_SIZE + 0.5);
        ctx.stroke();
    }
}

function drawCity(path, restaurant, stopsArray) {
    drawEmptyCity();

    if (!ctx) return;

    // Draw restaurant
    if (restaurant) {
        drawCellCircle(restaurant.x, restaurant.y, "#3b82f6"); // blue
    }

    // Draw all stops
    if (Array.isArray(stopsArray)) {
        for (const s of stopsArray) {
            drawCellCircle(s.x, s.y, "#22c55e"); // green
        }
    }

    // Draw path
    if (Array.isArray(path) && path.length > 1) {
        ctx.strokeStyle = "#ef4444"; // red
        ctx.lineWidth = 3;
        ctx.beginPath();

        const first = path[0];
        ctx.moveTo(
            first.x * CELL_SIZE + CELL_SIZE / 2,
            first.y * CELL_SIZE + CELL_SIZE / 2
        );

        for (let i = 1; i < path.length; i++) {
            const p = path[i];
            ctx.lineTo(
                p.x * CELL_SIZE + CELL_SIZE / 2,
                p.y * CELL_SIZE + CELL_SIZE / 2
            );
        }

        ctx.stroke();
    }
}

function drawCellCircle(x, y, color) {
    if (!ctx) return;

    ctx.fillStyle = color;
    const cx = x * CELL_SIZE + CELL_SIZE / 2;
    const cy = y * CELL_SIZE + CELL_SIZE / 2;
    const r = CELL_SIZE * 0.35;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
}

function onCanvasClick(event) {
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const x = Math.floor(offsetX / CELL_SIZE);
    const y = Math.floor(offsetY / CELL_SIZE);

    // Check bounds
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
        return;
    }

    // Update End X / End Y inputs
    const endXInput = document.getElementById("endX");
    const endYInput = document.getElementById("endY");

    endXInput.value = x;
    endYInput.value = y;
    const label = `Stop ${stops.length + 1}`;
    stops.push({ x, y, label });

    // Redraw map with all stops and existing path if there is one
    drawCity(currentPath, selectedRestaurant, stops);
}


async function computeRoute() {
    const endX = parseInt(document.getElementById("endX").value, 10);
    const endY = parseInt(document.getElementById("endY").value, 10);
    const heuristic = document.getElementById("heuristic").value;

    const metricsDiv = document.getElementById("metrics");
    const pathOutput = document.getElementById("pathOutput");

    if (!selectedRestaurant) {
        metricsDiv.innerHTML = `<span class="error">Please choose a restaurant first.</span>`;
        pathOutput.textContent = "";
        return;
    }

    // Build stops list for request, fallback to single end point if no stops.
    let stopsForRequest;

    if (stops.length > 0) {
        stopsForRequest = stops.map((s, index) => ({
            x: s.x,
            y: s.y,
            label: s.label || `Stop ${index + 1}`
        }));
    } else {
        if (!Number.isFinite(endX) || !Number.isFinite(endY)) {
            metricsDiv.innerHTML = `<span class="error">Click on the map or enter a valid destination first.</span>`;
            pathOutput.textContent = "";
            return;
        }

        stopsForRequest = [
            { x: endX, y: endY, label: "Stop 1" }
        ];
    }

    const body = {
        restaurantId: selectedRestaurant.id,
        stops: stopsForRequest,
        heuristic,
        strategy: "IN_ORDER"
    };

    try {
        const response = await fetch("http://localhost:8080/api/route/multi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            metricsDiv.innerHTML = `<span class="error">Error: ${response.status} ${errorText}</span>`;
            pathOutput.textContent = "";
            return;
        }

        const data = await response.json();

        currentPath = Array.isArray(data.path) ? data.path : [];

        metricsDiv.innerHTML = `
            <p><strong>Restaurant:</strong> ${selectedRestaurant.name} (${selectedRestaurant.x}, ${selectedRestaurant.y})</p>
            <p><strong>Stops:</strong> ${stopsForRequest.map(s => `(${s.x}, ${s.y})`).join(" → ")}</p>
            <p><strong>Total distance:</strong> ${data.totalDistance}</p>
            <p><strong>Visited nodes (total):</strong> ${data.visitedNodes}</p>
            <p><strong>Total time (ms):</strong> ${data.timeMs}</p>
        `;

        // Draw multi-stop path & stops
        drawCity(currentPath, selectedRestaurant, stopsForRequest);

        if (Array.isArray(data.path)) {
            const formattedPath = data.path
                .map(p => `(${p.x}, ${p.y})`)
                .join(" -> ");
            pathOutput.textContent = formattedPath;
        } else {
            pathOutput.textContent = "No path returned";
        }

    } catch (err) {
        metricsDiv.innerHTML =
            `<span class="error">Network or JS error: ${err}</span>`;
        pathOutput.textContent = "";
    }
}


document.addEventListener("DOMContentLoaded", () => {
    loadRestaurants();
    initCanvas();
    loadCityLayout();

    //click handler implementation
    const canvasElement = document.getElementById("cityCanvas");
    if (canvasElement) {
        canvasElement.addEventListener("click", onCanvasClick);
    }

    const restaurantSelect = document.getElementById("restaurantSelect");
    restaurantSelect.addEventListener("change", onRestaurantChange);

    const runButton = document.getElementById("runButton");
    runButton.addEventListener("click", (e) => {
        e.preventDefault();
        computeRoute();
    });

    // These are just display values after the implementation in the backend
    document.getElementById("gridWidth").value = 30;
    document.getElementById("gridHeight").value = 20;
});
