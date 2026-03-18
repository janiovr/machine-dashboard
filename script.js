// DRO
setInterval(() => {
  document.getElementById("x").textContent = (Math.random()*200).toFixed(2);
  document.getElementById("y").textContent = (Math.random()*200).toFixed(2);
  document.getElementById("z").textContent = (Math.random()*200).toFixed(2);
}, 1000);

// FEED
const feed = document.getElementById("feed");
const feedValue = document.getElementById("feedValue");

feed.addEventListener("input", () => {
  feedValue.textContent = feed.value + "%";
});

// SPINDLE
let spindleOn = false;
const rpm = document.getElementById("rpm");

document.getElementById("spindleToggle").onclick = () => {
  spindleOn = !spindleOn;
  rpm.textContent = spindleOn ? "12000 RPM" : "0 RPM";
};

// RPM CONTROL
const rpmControl = document.getElementById("rpmControl");
const rpmValue = document.getElementById("rpmValue");

rpmControl.addEventListener("input", () => {
  rpmValue.textContent = rpmControl.value + " RPM";
});

// LOGS
const log = document.getElementById("log");

function addLog(message) {
  const p = document.createElement("p");
  p.textContent = new Date().toLocaleTimeString() + " - " + message;
  log.prepend(p);
}

// CONTROLES
const startBtn = document.getElementById("start");
const stopBtn = document.getElementById("stop");

startBtn.onclick = () => {
  document.body.style.background = "#020617";
  addLog("Machine Started");
};

stopBtn.onclick = () => {
  document.body.style.background = "#0b1220";
  addLog("Machine Stopped");
};

// EMERGENCY
document.getElementById("estop").onclick = () => {
  alert("🚨 EMERGENCY STOP!");

  spindleOn = false;
  rpm.textContent = "0 RPM";

  feed.value = 100;
  feedValue.textContent = "100%";

  document.body.style.background = "#0b1220";

  addLog("EMERGENCY STOP");
};

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

(Math.random()*200)

let x = 0, y = 0, z = 0;

setInterval(() => {
  x += Math.random() * 2;
  y += Math.random() * 2;
  z += Math.random() * 2;

  document.getElementById("x").textContent = x.toFixed(2);
  document.getElementById("y").textContent = y.toFixed(2);
  document.getElementById("z").textContent = z.toFixed(2);
}, 1000);

const status = document.querySelector(".status");

setInterval(() => {
  const online = Math.random() > 0.1;

  status.textContent = online ? "● Connected" : "● Disconnected";
  status.style.color = online ? "#22c55e" : "#ef4444";

}, 5000);