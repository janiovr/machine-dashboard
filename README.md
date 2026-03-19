# CNC Machine Dashboard

A web-based CNC machine control dashboard built with HTML, CSS, and JavaScript, designed to simulate real-world machine operations and visualize G-code toolpaths.

## 🚀 Overview

This project was created as part of my transition from a hardware-focused background (CNC machines, 3D printers, Arduino, Linux) into software development.

The dashboard simulates a CNC control interface, including machine movement, toolpath visualization, and basic operational workflow.

## ✨ Features

- 📍 Real-time coordinate display (DRO)
- 🎮 Jog control (X, Y, Z axes)
- ⚙️ Spindle control (auto start/stop)
- 📊 Feed rate adjustment
- 🧾 G-code parser (G0 / G1 support)
- 🖥️ Toolpath visualization using Canvas
- 🎞️ Smooth motion simulation
- 🔁 Automatic cycle:
  - Safe Z move
  - Execution
  - Return to origin
- 📏 Configurable machine workspace (X, Y, Z limits)
- ⚠️ Boundary validation
- 📜 System log panel
- 🎨 Responsive UI layout

## 🧠 Technical Highlights

- Custom G-code parsing using JavaScript and regex
- 2D coordinate transformation and scaling for canvas rendering
- Motion interpolation for smooth tool movement
- State management for machine simulation
- Modular UI components using vanilla JS

## 🖥️ Demo

👉 https://janiovr.github.io/machine-dashboard/

## 🛠️ Tech Stack

- HTML5
- CSS3 (Grid + Responsive Design)
- JavaScript (Vanilla)
- Canvas API

## 📦 Project Structure
