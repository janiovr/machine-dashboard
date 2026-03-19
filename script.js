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

const xLimitEl = document.getElementById("xLimit");
const yLimitEl = document.getElementById("yLimit");
const zLimitEl = document.getElementById("zLimit");

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
  feedRate: 100,
  workspace: {
    xMax: 300,
    yMax: 200,
    zMax: 50
  }
};

let toolpath = [];
let isConnected = false;
let simulationIndex = 0;
let simulationTimer = null;
let simulationPhase = "idle";
let returnTarget = null;
const SAFE_Z = 5;

let currentPosition = { x: 0, y: 0 };
let targetPosition = null;
let executedSegments = [];

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

  currentPosition.x = machine.x;
  currentPosition.y = machine.y;

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

  let nextX = machine.x;
  let nextY = machine.y;
  let nextZ = machine.z;

  if (axis === "X") nextX += step * direction;
  if (axis === "Y") nextY += step * direction;
  if (axis === "Z") nextZ += step * direction;

  if (nextX < 0 || nextX > machine.workspace.xMax) {
    addLog(`X limit reached (0 to ${machine.workspace.xMax})`);
    return;
  }

  if (nextY < 0 || nextY > machine.workspace.yMax) {
    addLog(`Y limit reached (0 to ${machine.workspace.yMax})`);
    return;
  }

  if (nextZ > 0 || nextZ < -machine.workspace.zMax) {
    addLog(`Z limit reached (0 to -${machine.workspace.zMax})`);
    return;
  }

  machine.x = nextX;
  machine.y = nextY;
  machine.z = nextZ;

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
  if (machine.spindleOn) return;

  machine.spindleOn = true;
  machine.rpm = 12000;
  updateRPMDisplay();
  addLog("Spindle started");
}

function stopSpindle() {
  if (!machine.spindleOn) return;

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

function applyWorkspaceLimits() {
  const newX = parseFloat(xLimitEl.value);
  const newY = parseFloat(yLimitEl.value);
  const newZ = parseFloat(zLimitEl.value);

  if (newX <= 0 || newY <= 0 || newZ <= 0) {
    addLog("Workspace limits must be greater than zero");
    return;
  }

  machine.workspace.xMax = newX;
  machine.workspace.yMax = newY;
  machine.workspace.zMax = newZ;

  addLog(
    `Workspace updated: X ${newX}, Y ${newY}, Z -${newZ} to 0 ${machine.unit}`
  );

  drawMachinePosition();
}

// =====================
// GCODE
// =====================
function validateToolpath(points) {
  let hasOutOfBounds = false;

  for (const point of points) {
    if (point.x < 0 || point.x > machine.workspace.xMax) {
      hasOutOfBounds = true;
      addLog(`Warning: X out of bounds at ${point.x}`);
    }

    if (point.y < 0 || point.y > machine.workspace.yMax) {
      hasOutOfBounds = true;
      addLog(`Warning: Y out of bounds at ${point.y}`);
    }
  }

  return !hasOutOfBounds;
}

function loadGcode() {
  const gcodeText = gcodeInput.value;
  const parsed = parseGcode(gcodeText);

  stopSimulation();
  executedSegments = [];
  targetPosition = null;

  if (parsed.length === 0) {
    toolpath = [];
    addLog("No valid G-code found");
    drawMachinePosition();
    return;
  }

  toolpath = parsed;
  validateToolpath(toolpath);

  simulationIndex = 0;
  machine.x = toolpath[0].x;
  machine.y = toolpath[0].y;

  if (machine.x < 0) machine.x = 0;
  if (machine.y < 0) machine.y = 0;
  if (machine.x > machine.workspace.xMax) machine.x = machine.workspace.xMax;
  if (machine.y > machine.workspace.yMax) machine.y = machine.workspace.yMax;

  currentPosition.x = machine.x;
  currentPosition.y = machine.y;

  updateCoordinates();
  addLog(`Loaded ${toolpath.length} points`);
}

function clearGcode() {
  stopSimulation();
  gcodeInput.value = "";
  toolpath = [];
  simulationIndex = 0;
  executedSegments = [];
  targetPosition = null;
  drawMachinePosition();
  addLog("G-code cleared");
}

function parseGcode(text) {
  const lines = text.split("\n");
  const points = [];

  let x = 0;
  let y = 0;
  let currentType = "G0";

  for (let line of lines) {
    line = line.trim().toUpperCase();

    if (!line) continue;
    if (line.startsWith(";")) continue;

    if (line.includes("G0")) currentType = "G0";
    if (line.includes("G1")) currentType = "G1";

    if (!line.includes("G0") && !line.includes("G1")) continue;

    const xMatch = line.match(/X(-?\d+(\.\d+)?)/);
    const yMatch = line.match(/Y(-?\d+(\.\d+)?)/);

    if (xMatch) x = parseFloat(xMatch[1]);
    if (yMatch) y = parseFloat(yMatch[1]);

    points.push({
      x,
      y,
      type: currentType
    });
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

  if (toolpath.length < 2) {
    addLog("Load G-code first");
    return;
  }

  if (simulationTimer) {
    addLog("Simulation already running");
    return;
  }

  startSpindle();

  simulationIndex = 0;
  executedSegments = [];
  simulationPhase = "safeZUp";
  returnTarget = null;

  currentPosition.x = toolpath[0].x;
  currentPosition.y = toolpath[0].y;

  machine.x = currentPosition.x;
  machine.y = currentPosition.y;
  targetPosition = toolpath[1];
  simulationIndex = 1;

  addLog("Auto cycle started");

  simulationTimer = setInterval(() => {
    // phase 1: raise to safe Z before motion
    if (simulationPhase === "safeZUp") {
      const zSpeed = 0.5;

      if (machine.z < SAFE_Z) {
        machine.z = Math.min(machine.z + zSpeed, SAFE_Z);
        updateCoordinates();
        return;
      }

      simulationPhase = "cutting";
      addLog(`Safe Z reached: ${SAFE_Z}`);
      return;
    }

    // phase 2: run toolpath
    if (simulationPhase === "cutting") {
      if (!targetPosition) {
        simulationPhase = "returnZUp";
        addLog("Toolpath finished");
        return;
      }

      const motionType = targetPosition.type || "G1";

      const dx = targetPosition.x - currentPosition.x;
      const dy = targetPosition.y - currentPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const speed =
        motionType === "G0"
          ? Math.max(0.12, machine.feedRate / 90)
          : Math.max(0.05, machine.feedRate / 200);

      if (distance <= speed) {
        const startX = currentPosition.x;
        const startY = currentPosition.y;

        currentPosition.x = targetPosition.x;
        currentPosition.y = targetPosition.y;

        machine.x = currentPosition.x;
        machine.y = currentPosition.y;

        executedSegments.push({
          x1: startX,
          y1: startY,
          x2: currentPosition.x,
          y2: currentPosition.y,
          type: motionType
        });

        if (simulationIndex < toolpath.length - 1) {
          targetPosition = toolpath[simulationIndex + 1];
          simulationIndex++;
        } else {
          targetPosition = null;
        }

        updateCoordinates();
        return;
      }

      const moveX = (dx / distance) * speed;
      const moveY = (dy / distance) * speed;

      const startX = currentPosition.x;
      const startY = currentPosition.y;

      currentPosition.x += moveX;
      currentPosition.y += moveY;

      machine.x = currentPosition.x;
      machine.y = currentPosition.y;

      executedSegments.push({
        x1: startX,
        y1: startY,
        x2: currentPosition.x,
        y2: currentPosition.y,
        type: motionType
      });

      updateCoordinates();
      return;
    }

    // phase 3: raise Z after finishing
    if (simulationPhase === "returnZUp") {
      const zSpeed = 0.5;

      if (machine.z < SAFE_Z) {
        machine.z = Math.min(machine.z + zSpeed, SAFE_Z);
        updateCoordinates();
        return;
      }

      simulationPhase = "returnHome";
      returnTarget = { x: 0, y: 0 };
      addLog("Returning to origin");
      return;
    }

    // phase 4: move back to origin
    if (simulationPhase === "returnHome") {
      const dx = returnTarget.x - currentPosition.x;
      const dy = returnTarget.y - currentPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const speed = Math.max(0.12, machine.feedRate / 90);

      if (distance <= speed) {
        currentPosition.x = returnTarget.x;
        currentPosition.y = returnTarget.y;

        machine.x = currentPosition.x;
        machine.y = currentPosition.y;

        updateCoordinates();

        simulationPhase = "idle";
        stopSimulation();
        stopSpindle();
        addLog("Cycle complete");
        return;
      }

      currentPosition.x += (dx / distance) * speed;
      currentPosition.y += (dy / distance) * speed;

      machine.x = currentPosition.x;
      machine.y = currentPosition.y;

      updateCoordinates();
    }
  }, 30);
}

function stopSimulation() {
  if (simulationTimer) {
    clearInterval(simulationTimer);
    simulationTimer = null;
  }
}

function resetSimulation() {
  stopSimulation();
  executedSegments = [];
  targetPosition = null;

  if (toolpath.length === 0) {
    machine.x = 0;
    machine.y = 0;
  } else {
    simulationIndex = 0;
    machine.x = toolpath[0].x;
    machine.y = toolpath[0].y;
  }

  currentPosition.x = machine.x;
  currentPosition.y = machine.y;

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

  const padding = 30;
  const workspaceWidth = w - padding * 2;
  const workspaceHeight = h - padding * 2;

  const xScale = workspaceWidth / machine.workspace.xMax;
  const yScale = workspaceHeight / machine.workspace.yMax;
  const scale = Math.min(xScale, yScale);

  const drawWidth = machine.workspace.xMax * scale;
  const drawHeight = machine.workspace.yMax * scale;

  const originX = padding;
  const originY = h - padding;

  function toCanvasX(x) {
    return originX + x * scale;
  }

  function toCanvasY(y) {
    return originY - y * scale;
  }

  // workspace border
  ctx.strokeStyle = "#35566a";
  ctx.lineWidth = 2;
  ctx.strokeRect(originX, originY - drawHeight, drawWidth, drawHeight);

  // grid
  ctx.strokeStyle = "#1c2733";
  ctx.lineWidth = 1;

  const gridStep = 25;
  for (let x = 0; x <= machine.workspace.xMax; x += gridStep) {
    const cx = toCanvasX(x);
    ctx.beginPath();
    ctx.moveTo(cx, originY);
    ctx.lineTo(cx, originY - drawHeight);
    ctx.stroke();
  }

  for (let y = 0; y <= machine.workspace.yMax; y += gridStep) {
    const cy = toCanvasY(y);
    ctx.beginPath();
    ctx.moveTo(originX, cy);
    ctx.lineTo(originX + drawWidth, cy);
    ctx.stroke();
  }

  // full path
  if (toolpath.length > 1) {
    for (let i = 1; i < toolpath.length; i++) {
      const prev = toolpath[i - 1];
      const curr = toolpath[i];

      const x1 = toCanvasX(prev.x);
      const y1 = toCanvasY(prev.y);
      const x2 = toCanvasX(curr.x);
      const y2 = toCanvasY(curr.y);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);

      if (curr.type === "G0") {
        ctx.strokeStyle = "#4b5563";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
      } else {
        ctx.strokeStyle = "#5c6470";
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
      }

      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  // executed path
  if (executedSegments.length > 0) {
    executedSegments.forEach((segment) => {
      const x1 = toCanvasX(segment.x1);
      const y1 = toCanvasY(segment.y1);
      const x2 = toCanvasX(segment.x2);
      const y2 = toCanvasY(segment.y2);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);

      if (segment.type === "G0") {
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
      } else {
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
      }

      ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  // points
  if (toolpath.length > 0) {
    toolpath.forEach((point) => {
      const px = toCanvasX(point.x);
      const py = toCanvasY(point.y);

      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // tool
  const toolX = toCanvasX(machine.x);
  const toolY = toCanvasY(machine.y);

  ctx.fillStyle = "#00c2ff";
  ctx.beginPath();
  ctx.arc(toolX, toolY, 6, 0, Math.PI * 2);
  ctx.fill();

  // origin marker
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(originX, originY, 5, 0, Math.PI * 2);
  ctx.fill();

  // labels
  ctx.fillStyle = "#dce7f5";
  ctx.font = "14px Arial";
  ctx.fillText(`X: ${machine.x.toFixed(2)} ${machine.unit}`, 15, 20);
  ctx.fillText(`Y: ${machine.y.toFixed(2)} ${machine.unit}`, 15, 40);
  ctx.fillText(`Z: ${machine.z.toFixed(2)} ${machine.unit}`, 15, 60);

  ctx.fillStyle = "#9aa4b2";
  ctx.fillText("Origin", originX + 8, originY - 8);
  ctx.fillText(`X max: ${machine.workspace.xMax}`, originX + drawWidth - 80, originY + 18);
  ctx.fillText(`Y max: ${machine.workspace.yMax}`, originX - 5, originY - drawHeight - 10);
}

// =====================
// INIT
// =====================
gcodeInput.value = `G0 X0 Y0
G0 X20 Y20
G1 X120 Y20
G1 X120 Y80
G0 X60 Y120
G1 X20 Y40`;
updateStatus(false);
updateAllUI();
drawMachinePosition();

addLog("System ready");
addLog("Jog control ready");
addLog("G-code parser ready");