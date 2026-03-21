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

const loadGcodeBtn = document.getElementById("load-gcode-btn");
const gcodeFileInput = document.getElementById("gcode-file-input");

const helpModal = document.getElementById("helpModal");

const canvas = document.getElementById("machineCanvas");
const ctx = canvas.getContext("2d");

const xLimitEl = document.getElementById("xLimit");
const yLimitEl = document.getElementById("yLimit");
const zUpLimitEl = document.getElementById("zUpLimit");
const zDownLimitEl = document.getElementById("zDownLimit");

const SAFE_Z = 5;



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
  zUpMax: 100,
  zDownMax: 60
}
};

let toolpath = [];
let isConnected = false;
let simulationIndex = 0;
let simulationTimer = null;
let simulationPhase = "idle";
let returnTarget = null;
let isPaused = false;
let pausedPhase = null;
let spindleTargetRPM = 12000;
let spindleRampTimer = null;
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

  if (nextZ > machine.workspace.zUpMax || nextZ < -machine.workspace.zDownMax) {
    addLog(`Z limit reached (-${machine.workspace.zDownMax} to +${machine.workspace.zUpMax})`);
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
function startSpindle(targetRPM = 12000) {
  if (machine.spindleOn && machine.rpm === targetRPM) return;

  machine.spindleOn = true;
  animateSpindleTo(targetRPM);
  addLog(`Spindle starting to ${targetRPM} RPM`);
}

function animateSpindleTo(targetRPM) {
  if (spindleRampTimer) {
    clearInterval(spindleRampTimer);
    spindleRampTimer = null;
  }

  spindleTargetRPM = targetRPM;

  spindleRampTimer = setInterval(() => {
    if (machine.rpm < spindleTargetRPM) {
      machine.rpm = Math.min(machine.rpm + 500, spindleTargetRPM);
    } else if (machine.rpm > spindleTargetRPM) {
      machine.rpm = Math.max(machine.rpm - 500, spindleTargetRPM);
    }

    updateRPMDisplay();

    if (machine.rpm === spindleTargetRPM) {
      clearInterval(spindleRampTimer);
      spindleRampTimer = null;
    }
  }, 80);
}

function stopSpindle() {
  if (!machine.spindleOn && machine.rpm === 0) return;

  machine.spindleOn = false;

  // stop machine movement when spindle is stopped
  stopSimulation();

  if (simulationPhase !== "idle") {
    simulationPhase = "idle";
    targetPosition = null;
    returnTarget = null;
    isPaused = false;
    pausedPhase = null;
    addLog("Spindle stopped - machine motion interrupted");
  } else {
    addLog("Spindle stopped");
  }

  animateSpindleTo(0);
  drawMachinePosition();
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
function showHelp() {
  alert(`CNC DASHBOARD HELP

BASIC WORKFLOW
1. Click Connect
2. Load or paste G-code
3. Click Load to parse the toolpath
4. Click Run to start the simulation
5. Use Pause to temporarily stop motion
6. Use Run again to resume
7. Use Reset to clear the current simulation

BUTTONS
Connect
- Enables machine controls and simulation

Load File
- Loads a local .gcode, .nc, or .txt file into the G-code editor

Load
- Parses the G-code from the editor and prepares the toolpath

Run
- Starts the automatic cycle
- If paused, resumes the simulation

Pause
- Temporarily pauses machine motion
- Keeps the current simulation state

Stop Spindle
- Stops the spindle
- Interrupts machine motion for safety

Reset
- Stops the simulation and resets machine position/state

Clear
- Clears the G-code editor and loaded toolpath

SUPPORTED G-CODE
G21 - millimeters
G90 - absolute positioning
G0  - rapid move
G1  - linear cutting move
M3  - spindle on
M5  - spindle off

NOTES
- G0 moves are shown as rapid motion
- G1 moves represent cutting moves
- After cycle completion, only cutting paths remain highlighted
- The simulation returns to safe Z and then back to origin at the end
- Z can move upward above zero and downward below zero
- Example workspace: Z from -60 mm to +100 mm
- Safe Z uses a positive height above the work surface
`);


}
function applyWorkspaceLimits() {
  const newX = parseFloat(xLimitEl.value);
  const newY = parseFloat(yLimitEl.value);
  const newZUp = parseFloat(zUpLimitEl.value);
  const newZDown = parseFloat(zDownLimitEl.value);

  if (newX <= 0 || newY <= 0 || newZUp <= 0 || newZDown <= 0) {
    addLog("Workspace limits must be greater than zero");
    return;
  }

  machine.workspace.xMax = newX;
  machine.workspace.yMax = newY;
  machine.workspace.zUpMax = newZUp;
  machine.workspace.zDownMax = newZDown;

  addLog(
    `Workspace updated: X ${newX}, Y ${newY}, Z ${-newZDown} to +${newZUp} ${machine.unit}`
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

loadGcodeBtn.addEventListener("click", () => {
  gcodeFileInput.click();
});

gcodeFileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    const content = e.target.result;
    gcodeInput.value = content;
    addLog(`G-code file loaded: ${file.name}`);
  };

  reader.onerror = function () {
    addLog("Error loading G-code file.");
  };

  reader.readAsText(file);
});

// =====================
// SIMULATION
// =====================
function runSimulation() {
  if (!isConnected) {
    addLog("Connect first");
    return;
  }

  if (isPaused) {
    isPaused = false;
    simulationPhase = pausedPhase || "cutting";
    pausedPhase = null;

    addLog("Simulation resumed");
    startSimulationLoop();
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

  startSpindle(12000);

  simulationIndex = 0;
  executedSegments = [];
  simulationPhase = "safeZUp";
  returnTarget = null;
  targetPosition = toolpath[1];
  isPaused = false;
  pausedPhase = null;

  currentPosition.x = toolpath[0].x;
  currentPosition.y = toolpath[0].y;

  machine.x = currentPosition.x;
  machine.y = currentPosition.y;

  addLog("Auto cycle started");
  startSimulationLoop();
}

function startSimulationLoop() {
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

        // remove executed G0 moves after cycle is complete
        executedSegments = executedSegments.filter(segment => segment.type === "G1");

        drawMachinePosition();
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

function pauseSimulation() {
  if (!simulationTimer) {
    addLog("No active simulation to pause");
    return;
  }

  pausedPhase = simulationPhase;
  isPaused = true;

  stopSimulation();
  addLog("Simulation paused");
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
  returnTarget = null;
  simulationPhase = "idle";
  isPaused = false;
  pausedPhase = null;

  if (toolpath.length === 0) {
    machine.x = 0;
    machine.y = 0;
  } else {
    simulationIndex = 0;
    machine.x = toolpath[0].x;
    machine.y = toolpath[0].y;
  }

  machine.z = 0;
  currentPosition.x = machine.x;
  currentPosition.y = machine.y;

  stopSpindle();
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

function toCanvasX(x, z = 0) {
  return originX + x * scale + z * 2.2;
}

function toCanvasY(y, z = 0) {
  return originY - y * scale - z * 1.2;
}

function projectPoint(x, y, z = 0) {
  return {
    x: toCanvasX(x, z),
    y: toCanvasY(y, z)
  };
}

  // workspace pseudo-3D block
  const topLeft = projectPoint(0, machine.workspace.yMax, 0);
  const topRight = projectPoint(machine.workspace.xMax, machine.workspace.yMax, 0);
  const bottomLeft = projectPoint(0, 0, 0);
  const bottomRight = projectPoint(machine.workspace.xMax, 0, 0);

  const depthOffsetX = 18;
  const depthOffsetY = 12;

  const topLeftBack = { x: topLeft.x + depthOffsetX, y: topLeft.y + depthOffsetY };
  const topRightBack = { x: topRight.x + depthOffsetX, y: topRight.y + depthOffsetY };
  const bottomLeftBack = { x: bottomLeft.x + depthOffsetX, y: bottomLeft.y + depthOffsetY };
  const bottomRightBack = { x: bottomRight.x + depthOffsetX, y: bottomRight.y + depthOffsetY };

  // back face
  ctx.fillStyle = "rgba(70, 90, 110, 0.15)";
  ctx.beginPath();
  ctx.moveTo(topLeftBack.x, topLeftBack.y);
  ctx.lineTo(topRightBack.x, topRightBack.y);
  ctx.lineTo(bottomRightBack.x, bottomRightBack.y);
  ctx.lineTo(bottomLeftBack.x, bottomLeftBack.y);
  ctx.closePath();
  ctx.fill();

  // side connections
  ctx.strokeStyle = "#243544";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topLeftBack.x, topLeftBack.y);
  ctx.moveTo(topRight.x, topRight.y);
  ctx.lineTo(topRightBack.x, topRightBack.y);
  ctx.moveTo(bottomLeft.x, bottomLeft.y);
  ctx.lineTo(bottomLeftBack.x, bottomLeftBack.y);
  ctx.moveTo(bottomRight.x, bottomRight.y);
  ctx.lineTo(bottomRightBack.x, bottomRightBack.y);
  ctx.stroke();

  // front face
  ctx.strokeStyle = "#35566a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(topLeft.x, topLeft.y);
  ctx.lineTo(topRight.x, topRight.y);
  ctx.lineTo(bottomRight.x, bottomRight.y);
  ctx.lineTo(bottomLeft.x, bottomLeft.y);
  ctx.closePath();
  ctx.stroke();

  // grid
  ctx.strokeStyle = "#1c2733";
  ctx.lineWidth = 1;

  const gridStep = 25;
  for (let x = 0; x <= machine.workspace.xMax; x += gridStep) {
    const p1 = projectPoint(x, 0, 0);
    const p2 = projectPoint(x, machine.workspace.yMax, 0);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  for (let y = 0; y <= machine.workspace.yMax; y += gridStep) {
    const p1 = projectPoint(0, y, 0);
    const p2 = projectPoint(machine.workspace.xMax, y, 0);

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // full path
  if (toolpath.length > 1) {
    for (let i = 1; i < toolpath.length; i++) {

      const prev = toolpath[i - 1];
      const curr = toolpath[i];

 const zPreview = curr.type === "G1" ? -12 : SAFE_Z;

const p1 = projectPoint(prev.x, prev.y, zPreview);
const p2 = projectPoint(curr.x, curr.y, zPreview);

      const x1 = p1.x;
      const y1 = p1.y;
      const x2 = p2.x;
      const y2 = p2.y;

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

     const zExecuted = segment.type === "G1" ? -12 : SAFE_Z;

const p1 = projectPoint(segment.x1, segment.y1, zExecuted);
const p2 = projectPoint(segment.x2, segment.y2, zExecuted);

      const x1 = p1.x;
      const y1 = p1.y;
      const x2 = p2.x;
      const y2 = p2.y;

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

       const p = projectPoint(point.x, point.y, 0);
      const px = p.x;
      const py = p.y;

      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

   // tool pseudo-3D

 const visualToolZ = targetPosition && targetPosition.type === "G1" ? -6 : SAFE_Z;

const toolTop = projectPoint(machine.x, machine.y, SAFE_Z);
const toolTip = projectPoint(machine.x, machine.y, visualToolZ);

  ctx.strokeStyle = "#8bdfff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(toolTop.x, toolTop.y);
  ctx.lineTo(toolTip.x, toolTip.y);
  ctx.stroke();

  ctx.fillStyle = "#00c2ff";
  ctx.beginPath();
  ctx.arc(toolTip.x, toolTip.y, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(0, 194, 255, 0.35)";
  ctx.beginPath();
  ctx.arc(toolTop.x, toolTop.y, 4, 0, Math.PI * 2);
  ctx.fill();

  // origin marker
  const originPoint = projectPoint(0, 0, 0);

  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(originPoint.x, originPoint.y, 5, 0, Math.PI * 2);
  ctx.fill();

  // labels
  ctx.fillStyle = "#dce7f5";
  ctx.font = "14px Arial";
  ctx.fillText(`X: ${machine.x.toFixed(2)} ${machine.unit}`, 15, 20);
  ctx.fillText(`Y: ${machine.y.toFixed(2)} ${machine.unit}`, 15, 40);
  ctx.fillText(`Z: ${machine.z.toFixed(2)} ${machine.unit}`, 15, 60);

   ctx.fillStyle = "#9aa4b2";
  ctx.fillText("Origin", originPoint.x + 8, originPoint.y - 8);
  ctx.fillText(`X max: ${machine.workspace.xMax}`, topRight.x - 90, bottomRight.y + 20);
  ctx.fillText(`Y max: ${machine.workspace.yMax}`, topLeft.x - 4, topLeft.y - 10);
}

// =====================
// INIT
// =====================

gcodeInput.value = 
`G21
G90
G17
G0 Z5

; =====================
; JVR (top)
; =====================

; J
G0 X85 Y175
G1 X115 Y175
G1 X115 Y135
G1 X108 Y128
G1 X92 Y128
G1 X85 Y135

G0 Z5

; V
G0 X130 Y175
G1 X145 Y128
G1 X160 Y175

G0 Z5

; R
G0 X175 Y128
G1 X175 Y175
G1 X200 Y175
G1 X208 Y167
G1 X208 Y155
G1 X200 Y147
G1 X175 Y147
G0 X193 Y147
G1 X212 Y128

G0 Z5

; =====================
; CNC (bottom)
; =====================

; C
G0 X90 Y95
G1 X100 Y95
G1 X90 Y95
G1 X80 Y85
G1 X80 Y55
G1 X90 Y45
G1 X100 Y45

G0 Z5

; N
G0 X120 Y45
G1 X120 Y95
G1 X150 Y45
G1 X150 Y95

G0 Z5

; C
G0 X185 Y95
G1 X195 Y95
G1 X185 Y95
G1 X175 Y85
G1 X175 Y55
G1 X185 Y45
G1 X195 Y45

G0 Z10
G0 X0 Y0
M5`;updateStatus(false);
updateAllUI();
drawMachinePosition();

addLog("System ready");
addLog("Jog control ready");
addLog("G-code parser ready");