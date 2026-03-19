// =====================
// ELEMENTS
// =====================
const logBox = document.getElementById("log");

const xEl = document.getElementById("x");
const yEl = document.getElementById("y");
const zEl = document.getElementById("z");

const rpmEl = document.getElementById("rpm");
const feedEl = document.getElementById("feed");
const feedValueEl = document.getElementById("feedValue");

const unitSelect = document.getElementById("unitSelect");
const jogStepSelect = document.getElementById("jogStep");
const unitDisplay = document.getElementById("unitDisplay");

const statusEl = document.getElementById("machineStatus");
const gcodeInput = document.getElementById("gcodeInput");
const helpModal = document.getElementById("helpModal");

const canvas = document.getElementById("machineCanvas");
const ctx = canvas.getContext("2d");

// =====================
// STATE
// =====================
let machine = {
  x: 0,
  y: 0,
  z: 0,
  unit: "mm",
  spindleOn: false,
  rpm: 0,
  feedRate: 100
};

let toolpath = [];
let isConnected = false;
let simulationIndex = 0;
let simulationTimer = null;

// =====================
// LOG
// =====================
function addLog(message) {
  const entry = document.createElement("div");
  entry.className = "log-entry";

  const time = new Date().toLocaleTimeString();
  entry.innerHTML = `<span>${time}</span>${message}`;

  logBox.prepend(entry);
}

function clearLog() {
  logBox.innerHTML = "";
  addLog("Log cleared");
}

// =====================
// UI UPDATE
// =====================
function updateCoordinates() {
  xEl.textContent = machine.x.toFixed(2);
  yEl.textContent = machine.y.toFixed(2);
  zEl.textContent = machine.z.toFixed(2);
  unitDisplay.textContent = machine.unit;
  drawMachinePosition();
}

function updateFeedDisplay() {
  feedValueEl.textContent = `${machine.feedRate}%`;
}

function updateRPMDisplay() {
  rpmEl.textContent = machine.rpm;
}

function updateAllUI() {
  updateCoordinates();
  updateFeedDisplay();
  updateRPMDisplay();
}

// =====================
// JOG
// =====================
function getJogStep() {
  return parseFloat(jogStepSelect.value);
}

function jog(axis, direction) {
  if (!isConnected) {
    addLog("Connect machine first");
    return;
  }

  const step = getJogStep();

  if (axis === "X") machine.x += step * direction;
  if (axis === "Y") machine.y += step * direction;
  if (axis === "Z") machine.z += step * direction;

  updateCoordinates();
  addLog(`Jog ${axis} ${direction > 0 ? "+" : "-"}${step} ${machine.unit}`);
}

function zeroAxis(axis) {
  if (axis === "X") machine.x = 0;
  if (axis === "Y") machine.y = 0;
  if (axis === "Z") machine.z = 0;

  updateCoordinates();
  addLog(`${axis} zeroed`);
}

function zeroAllAxes() {
  machine.x = 0;
  machine.y = 0;
  machine.z = 0;

  updateCoordinates();
  addLog("All axes zeroed");
}

function homeAxes() {
  machine.x = 0;
  machine.y = 0;
  machine.z = 0;

  updateCoordinates();
  addLog("Machine homed");
}

// =====================
// SPINDLE
// =====================
function startSpindle() {
  machine.spindleOn = true;
  machine.rpm = 12000;
  updateRPMDisplay();
  addLog("Spindle started");
}

function stopSpindle() {
  machine.spindleOn = false;
  machine.rpm = 0;
  updateRPMDisplay();
  addLog("Spindle stopped");
}

// =====================
// FEED RATE
// =====================
feedEl.addEventListener("input", () => {
  machine.feedRate = parseInt(feedEl.value, 10);
  updateFeedDisplay();
  addLog(`Feed rate changed to ${machine.feedRate}%`);
});

// =====================
// UNIT
// =====================
unitSelect.addEventListener("change", () => {
  machine.unit = unitSelect.value;
  updateCoordinates();
  addLog(`Unit set to ${machine.unit}`);
});

// =====================
// CONNECTION
// =====================
function updateStatus(connected) {
  isConnected = connected;

  if (connected) {
    statusEl.textContent = "● Connected";
    statusEl.classList.remove("disconnected");
    statusEl.classList.add("connected");
    addLog("Machine connected");
  } else {
    statusEl.textContent = "● Disconnected";
    statusEl.classList.remove("connected");
    statusEl.classList.add("disconnected");
    addLog("Machine disconnected");
  }
}

function connectMachine() {
  if (isConnected) {
    addLog("Machine is already connected");
    return;
  }
  updateStatus(true);
}

function disconnectMachine() {
  if (!isConnected) {
    addLog("Machine is already disconnected");
    return;
  }

  stopSimulation();
  updateStatus(false);
}

// =====================
// HELP
// =====================
function toggleHelp() {
  helpModal.classList.toggle("hidden");
}

// =====================
// GCODE
// =====================
function loadGcode() {
  const gcodeText = gcodeInput.value;
  toolpath = parseGcode(gcodeText);

  if (toolpath.length === 0) {
    addLog("No valid G-code found");
    drawMachinePosition();
    return;
  }

  simulationIndex = 0;
  machine.x = toolpath[0].x;
  machine.y = toolpath[0].y;

  updateCoordinates();
  addLog(`Loaded ${toolpath.length} points`);
}

function clearGcode() {
  stopSimulation();
  gcodeInput.value = "";
  toolpath = [];
  simulationIndex = 0;
  drawMachinePosition();
  addLog("G-code cleared");
}

function parseGcode(text) {
  const lines = text.split("\n");
  const points = [];

  let x = 0;
  let y = 0;

  for (let line of lines) {
    line = line.trim().toUpperCase();
    if (!line) continue;
    if (line.startsWith(";")) continue;

    if (!line.includes("G0") && !line.includes("G1")) continue;

    const xMatch = line.match(/X(-?\d+(\.\d+)?)/);
    const yMatch = line.match(/Y(-?\d+(\.\d+)?)/);

    if (xMatch) x = parseFloat(xMatch[1]);
    if (yMatch) y = parseFloat(yMatch[1]);

    points.push({ x, y });
  }

  return points;
}

// =====================
// SIMULATION
// =====================
function runSimulation() {
  if (!isConnected) {
    addLog("Connect first");
    return;
  }

  if (toolpath.length === 0) {
    addLog("Load G-code first");
    return;
  }

  if (simulationTimer) {
    addLog("Simulation already running");
    return;
  }

  addLog("Simulation started");

  simulationTimer = setInterval(() => {
    if (simulationIndex >= toolpath.length) {
      stopSimulation();
      addLog("Simulation finished");
      return;
    }

    machine.x = toolpath[simulationIndex].x;
    machine.y = toolpath[simulationIndex].y;

    updateCoordinates();
    simulationIndex++;
  }, 300);
}

function stopSimulation() {
  if (simulationTimer) {
    clearInterval(simulationTimer);
    simulationTimer = null;
  }
}

function resetSimulation() {
  stopSimulation();

  if (toolpath.length === 0) {
    machine.x = 0;
    machine.y = 0;
  } else {
    simulationIndex = 0;
    machine.x = toolpath[0].x;
    machine.y = toolpath[0].y;
  }

  updateCoordinates();
  addLog("Simulation reset");
}

// =====================
// CANVAS
// =====================
function drawMachinePosition() {
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // background
  ctx.fillStyle = "#0a0f14";
  ctx.fillRect(0, 0, w, h);

  const centerX = w / 2;
  const centerY = h / 2;
  const scale = 8;

  // grid
  ctx.strokeStyle = "#1c2733";
  ctx.lineWidth = 1;

  for (let i = 0; i < w; i += 25) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, h);
    ctx.stroke();
  }

  for (let i = 0; i < h; i += 25) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(w, i);
    ctx.stroke();
  }

  // axes
  ctx.strokeStyle = "#35566a";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(w, centerY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, h);
  ctx.stroke();

  // full path
  if (toolpath.length > 0) {
    ctx.strokeStyle = "#5c6470";
    ctx.lineWidth = 2;
    ctx.beginPath();

    toolpath.forEach((p, i) => {
      const px = centerX + p.x * scale;
      const py = centerY - p.y * scale;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });

    ctx.stroke();
  }

  // executed path
  if (simulationIndex > 0) {
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.beginPath();

    for (let i = 0; i < simulationIndex && i < toolpath.length; i++) {
      const p = toolpath[i];
      const px = centerX + p.x * scale;
      const py = centerY - p.y * scale;

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    ctx.stroke();
  }

  // path points
  if (toolpath.length > 0) {
    toolpath.forEach((p) => {
      const px = centerX + p.x * scale;
      const py = centerY - p.y * scale;

      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // tool
  const px = centerX + machine.x * scale;
  const py = centerY - machine.y * scale;

  ctx.fillStyle = "#00c2ff";
  ctx.beginPath();
  ctx.arc(px, py, 6, 0, Math.PI * 2);
  ctx.fill();

  // origin
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
  ctx.fill();

  // text
  ctx.fillStyle = "#dce7f5";
  ctx.font = "14px Arial";
  ctx.fillText(`X: ${machine.x.toFixed(2)} ${machine.unit}`, 15, 22);
  ctx.fillText(`Y: ${machine.y.toFixed(2)} ${machine.unit}`, 15, 42);
  ctx.fillText(`Z: ${machine.z.toFixed(2)} ${machine.unit}`, 15, 62);

  ctx.fillStyle = "#9aa4b2";
  ctx.fillText("Origin", centerX + 10, centerY - 10);
}

// =====================
// INIT
// =====================
updateStatus(false);
updateAllUI();
drawMachinePosition();

addLog("System ready");
addLog("Jog control ready");
addLog("G-code parser ready");