let log = document.getElementById("log");

// ===== LOG SYSTEM =====
function addLog(message) {
  const p = document.createElement("p");
  p.textContent = new Date().toLocaleTimeString() + " - " + message;

  log.prepend(p);

  // mantém só 10 logs
  if (log.children.length > 10) {
    log.removeChild(log.lastChild);
  }
}

// ===== DRO MOVEMENT =====
let x = 0, y = 0, z = 0;

setInterval(() => {
  x += Math.random() * 2;
  y += Math.random() * 2;
  z += Math.random() * 2;

  document.getElementById("x").textContent = x.toFixed(2);
  document.getElementById("y").textContent = y.toFixed(2);
  document.getElementById("z").textContent = z.toFixed(2);
}, 1000);

// ===== STATUS =====
const status = document.querySelector(".status");

setInterval(() => {
  const online = Math.random() > 0.1;

  status.textContent = online ? "● Connected" : "● Disconnected";
  status.style.color = online ? "#22c55e" : "#ef4444";
}, 5000);

// ===== SPINDLE =====
function startSpindle() {
  document.getElementById("rpm").textContent = 12000;
  addLog("Spindle started");
}

function stopSpindle() {
  document.getElementById("rpm").textContent = 0;
  addLog("Spindle stopped");
}

// ===== FEED RATE =====
const feed = document.getElementById("feed");
const feedValue = document.getElementById("feedValue");

feed.addEventListener("input", () => {
  feedValue.textContent = feed.value;
});

// ===== MACHINE CONTROL =====
function startMachine() {
  addLog("Machine started");
}

function pauseMachine() {
  addLog("Machine paused");
}

function stopMachine() {
  addLog("Machine stopped");
}

// ===== AUTO LOGS =====
setInterval(() => {
  const messages = [
    "Monitoring system...",
    "Checking temperature...",
    "Idle state...",
    "Awaiting command..."
  ];

  const random = messages[Math.floor(Math.random() * messages.length)];
  addLog(random);

}, 4000);