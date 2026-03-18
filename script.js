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