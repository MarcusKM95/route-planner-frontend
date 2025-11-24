
const GRID_WIDTH = 30;
const GRID_HEIGHT = 20;
const CELL_SIZE = 20;
let canvas, ctx;
let ordersCanvas, ordersCtx;
let cityTypes = []; // Array of city type objects from backend
let stops = [];         // array of { x, y, label }
let currentPath = [];   // last route path from backend
let restaurants = [];
let selectedRestaurant = null;
let orderSelectedRestaurant = null;
let couriers = [];
let orders = [];


async function loadRestaurants() {
    try {
        const response = await fetch("http://localhost:8080/api/restaurants");
        if (!response.ok) {
            console.error("Failed to load restaurants:", response.status);
            return;
        }

        restaurants = await response.json();

        const plannerSelect = document.getElementById("restaurantSelect");
        const orderSelect = document.getElementById("orderRestaurantSelect");

        function populateSelect(selectElem) {
            if (!selectElem) return;

            selectElem.innerHTML = "";

            if (restaurants.length === 0) {
                const opt = document.createElement("option");
                opt.value = "";
                opt.textContent = "No restaurants available";
                selectElem.appendChild(opt);
                return;
            }

            const defaultOpt = document.createElement("option");
            defaultOpt.value = "";
            defaultOpt.textContent = "Choose a restaurant";
            selectElem.appendChild(defaultOpt);

            restaurants.forEach(r => {
                const opt = document.createElement("option");
                opt.value = r.id;
                opt.textContent = r.name;
                selectElem.appendChild(opt);
            });
        }

        populateSelect(plannerSelect);
        populateSelect(orderSelect);

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
        if (ordersCtx) {
            drawOrdersEmptyCity();
        }

    } catch (err) {
        console.error("Error loading city layout:", err);
    }
}

function drawOrdersCity() {
    drawOrdersEmptyCity();
    if (!ordersCtx) return;

    // Draw all restaurants (blue)
    if (Array.isArray(restaurants)) {
        for (const r of restaurants) {
            drawOrdersCircle(r.x, r.y, "#3b82f6");
        }
    }

    // Draw all orders (green)
    if (Array.isArray(orders)) {
        for (const o of orders) {
            drawOrdersCircle(o.x, o.y, "#22c55e");
        }
    }

    // Draw couriers (yellow)
    if (Array.isArray(couriers)) {
        for (const c of couriers) {
            if (typeof c.currentX === "number" && typeof c.currentY === "number") {
                drawOrdersCircle(c.currentX, c.currentY, "#eab308");
            }
        }
    }
}

function drawOrdersCircle(x, y, color) {
    if (!ordersCtx) return;

    ordersCtx.fillStyle = color;
    const cx = x * CELL_SIZE + CELL_SIZE / 2;
    const cy = y * CELL_SIZE + CELL_SIZE / 2;
    const r = CELL_SIZE * 0.35;

    ordersCtx.beginPath();
    ordersCtx.arc(cx, cy, r, 0, Math.PI * 2);
    ordersCtx.fill();
}

async function updateCourierMarkers() {
    try {
        const [courierRes, orderRes] = await Promise.all([
            fetch("http://localhost:8080/api/couriers"),
            fetch("http://localhost:8080/api/orders")
        ]);

        if (!courierRes.ok || !orderRes.ok) {
            console.error("Failed to load couriers or orders", courierRes.status, orderRes.status);
            return;
        }

        couriers = await courierRes.json();
        orders = await orderRes.json();

        // Redraw main planner map
        drawCity(currentPath, selectedRestaurant, stops);

        // Redraw orders/live map
        drawOrdersCity();

    } catch (err) {
        console.error("Error updating simulation:", err);
    }
}

function onOrderRestaurantChange() {
    const select = document.getElementById("orderRestaurantSelect");
    const selectedId = select ? select.value : "";

    if (!selectedId) {
        orderSelectedRestaurant = null;
        return;
    }

    const restaurant = restaurants.find(r => r.id === selectedId);
    orderSelectedRestaurant = restaurant || null;
}

async function createAndAssignOrder(restaurantId, x, y) {
    const infoDiv = document.getElementById("ordersInfo");

    try {
        // 1) Create order
        const createRes = await fetch("http://localhost:8080/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                restaurantId,
                x,
                y,
                label: `Frontend order (${x},${y})`
            })
        });

        if (!createRes.ok) {
            const txt = await createRes.text();
            console.error("Create order failed:", txt);
            if (infoDiv) infoDiv.textContent = `Error creating order: ${txt}`;
            return;
        }

        const order = await createRes.json();

        // 2) Assign order
        const assignRes = await fetch(`http://localhost:8080/api/orders/${order.id}/assign`, {
            method: "POST"
        });

        if (!assignRes.ok) {
            const txt = await assignRes.text();
            console.error("Assign order failed:", txt);
            if (infoDiv) infoDiv.textContent = `Error assigning courier: ${txt}`;
            return;
        }

        const assignment = await assignRes.json();

        if (infoDiv) {
            infoDiv.innerHTML = `
                <p><strong>Created order #${order.id}</strong> at (${order.x}, ${order.y})</p>
                <p><strong>Assigned courier:</strong> ${assignment.courier.name} (${assignment.courier.id})</p>
            `;
        }

        // 3) Refresh maps
        await updateCourierMarkers();

    } catch (err) {
        console.error("Error creating/assigning order:", err);
        if (infoDiv) infoDiv.textContent = `Error: ${err}`;
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

function initOrdersCanvas() {
    ordersCanvas = document.getElementById("ordersCanvas");
    if (!ordersCanvas) return;

    ordersCanvas.width = GRID_WIDTH * CELL_SIZE;
    ordersCanvas.height = GRID_HEIGHT * CELL_SIZE;

    ordersCtx = ordersCanvas.getContext("2d");

    drawOrdersEmptyCity();
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

    if (Array.isArray(couriers)) {
        for (const c of couriers) {
            if (typeof c.currentX === "number" && typeof c.currentY === "number") {
                drawCellCircle(c.currentX, c.currentY, "#eab308");
            }
        }
    }
}

function drawOrdersEmptyCity() {
    if (!ordersCtx || !ordersCanvas) return;

    ordersCtx.clearRect(0, 0, ordersCanvas.width, ordersCanvas.height);

    // Background
    ordersCtx.fillStyle = "#050816";
    ordersCtx.fillRect(0, 0, ordersCanvas.width, ordersCanvas.height);

    // Terrain tiles
    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            const type =
                cityTypes[y] && cityTypes[y][x]
                    ? cityTypes[y][x]
                    : "ROAD";

            switch (type) {
                case "BUILDING":
                    ordersCtx.fillStyle = "#4b5563";
                    break;
                case "PARK":
                    ordersCtx.fillStyle = "#14532d";
                    break;
                case "RIVER":
                    ordersCtx.fillStyle = "#1d4ed8";
                    break;
                case "ROAD":
                default:
                    ordersCtx.fillStyle = "#101827";
                    break;
            }

            ordersCtx.fillRect(
                x * CELL_SIZE,
                y * CELL_SIZE,
                CELL_SIZE,
                CELL_SIZE
            );
        }
    }

    // Grid lines
    ordersCtx.strokeStyle = "#1f364d";
    ordersCtx.lineWidth = 1;

    for (let x = 0; x <= GRID_WIDTH; x++) {
        ordersCtx.beginPath();
        ordersCtx.moveTo(x * CELL_SIZE + 0.5, 0);
        ordersCtx.lineTo(x * CELL_SIZE + 0.5, ordersCanvas.height);
        ordersCtx.stroke();
    }

    for (let y = 0; y <= GRID_HEIGHT; y++) {
        ordersCtx.beginPath();
        ordersCtx.moveTo(0, y * CELL_SIZE + 0.5);
        ordersCtx.lineTo(ordersCanvas.width, y * CELL_SIZE + 0.5);
        ordersCtx.stroke();
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

function onOrdersCanvasClick(event) {
    if (!ordersCanvas) return;

    if (!orderSelectedRestaurant) {
        alert("Please choose a restaurant for the order first.");
        return;
    }

    const rect = ordersCanvas.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    const x = Math.floor(offsetX / CELL_SIZE);
    const y = Math.floor(offsetY / CELL_SIZE);

    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) {
        return;
    }

    // Create and assign order at clicked location
    createAndAssignOrder(orderSelectedRestaurant.id, x, y);
}


function resetRoute() {
    stops = [];
    currentPath = [];

    // Clear destination inputs
    const endXInput = document.getElementById("endX");
    const endYInput = document.getElementById("endY");
    if (endXInput) endXInput.value = "";
    if (endYInput) endYInput.value = "";

    // Clear metrics & path output
    const metricsDiv = document.getElementById("metrics");
    const pathOutput = document.getElementById("pathOutput");
    if (metricsDiv) metricsDiv.innerHTML = "";
    if (pathOutput) pathOutput.textContent = "";

    // Redraw map with only restaurant
    drawCity(currentPath, selectedRestaurant, stops);
}

async function computeRoute() {
    const endX = parseInt(document.getElementById("endX").value, 10);
    const endY = parseInt(document.getElementById("endY").value, 10);
    const heuristic = document.getElementById("heuristic").value;
    const strategySelect = document.getElementById("strategy");
    const strategy = strategySelect ? strategySelect.value : "IN_ORDER";
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
        strategy
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
            <p><strong>Strategy:</strong> ${strategy}</p>
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

    const resetButton = document.getElementById("resetButton");
    if (resetButton) {
        resetButton.addEventListener("click", (e) => {
            e.preventDefault();
            resetRoute();
        });
    }

    initOrdersCanvas();

    const ordersCanvasElement = document.getElementById("ordersCanvas");
    if (ordersCanvasElement) {
        ordersCanvasElement.addEventListener("click", onOrdersCanvasClick);
    }

    const orderRestaurantSelect = document.getElementById("orderRestaurantSelect");
    if (orderRestaurantSelect) {
        orderRestaurantSelect.addEventListener("change", onOrderRestaurantChange);
    }

    setInterval(async () => {
        await fetch("http://localhost:8080/api/sim/step", { method: "POST" });
        await updateCourierMarkers();
    }, 1000);



    // These are just display values after the implementation in the backend
    document.getElementById("gridWidth").value = 30;
    document.getElementById("gridHeight").value = 20;
});
