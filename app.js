"use strict";

// Browser calculation of a declared four-cell finite model. Native CDC uses
// its own numeric contract; no native receipt or U1/U2 result is issued here.
const presets = {balanced: [0, Math.PI, 0, Math.PI], held: [Math.PI, 0, 0, Math.PI], aperture: [Math.PI / 2, Math.PI / 2, Math.PI / 2, Math.PI / 2]};
const frequencies = [1, -0.5, 0.5, -1];
const labels = ["A", "B", "C", "D"];
let phases = [...presets.balanced];
let latches = null;
let steps = 0;
let attempt = null;
const byId = id => document.getElementById(id);
const svgNS = "http://www.w3.org/2000/svg";
const signText = value => value > 0 ? "+1" : value < 0 ? "−1" : "0";

function parameter(id) {
  const control = byId(id);
  const value = Number(control.value);
  if (control.value.trim() === "" || !Number.isFinite(value) || !control.checkValidity()) {
    control.reportValidity();
    return null;
  }
  return value;
}

function observation() {
  const deadband = parameter("deadband");
  if (deadband === null) return null;
  const trits = phases.map(theta => Math.cos(theta) > deadband ? 1 : Math.cos(theta) < -deadband ? -1 : 0);
  let sum = 0;
  const prefixes = trits.map(trit => sum += trit);
  return {trits, prefixes, firstNegative: prefixes.findIndex(value => value < 0)};
}

function render() {
  const state = observation();
  if (!state) return;
  const {trits, prefixes, firstNegative} = state;
  byId("phase-circles").innerHTML = phases.map((theta, index) => {
    const degrees = theta * 180 / Math.PI;
    const x = 34 + Math.cos(theta) * 24;
    const y = 34 - Math.sin(theta) * 24;
    const normalized = ((degrees + 180) % 360 + 360) % 360 - 180;
    byId(`phase-${index}`).value = String(Math.round(normalized));
    byId(`angle-${index}`).textContent = `${degrees.toFixed(1)}°`;
    return `<div><span>${labels[index]}</span><svg viewBox="0 0 68 68" role="img" aria-label="Cell ${labels[index]}, ${degrees.toFixed(1)} degrees, trit ${trits[index]}"><circle cx="34" cy="34" r="25" class="phase-ring"/><line x1="34" y1="34" x2="${x}" y2="${y}" class="phase-hand"/><circle cx="${x}" cy="${y}" r="4" class="phase-dot"/></svg><strong>${signText(trits[index])}</strong></div>`;
  }).join("");
  byId("trit-expression").textContent = trits.map(signText).join("  ");
  const points = [0, ...prefixes].map((value, index) => [25 + index * 107.5, 98 - value * 17]);
  byId("prefix-path").setAttribute("d", points.map((point, i) => `${i ? "L" : "M"}${point[0]} ${point[1]}`).join(" "));
  byId("prefix-path").setAttribute("class", firstNegative < 0 ? "accepted-path" : "held-path");
  byId("prefix-plot").querySelector(".zero-line").setAttribute("y1", "98");
  byId("prefix-plot").querySelector(".zero-line").setAttribute("y2", "98");
  byId("prefix-plot").querySelector("text").setAttribute("y", "102");
  byId("prefix-points").replaceChildren();
  points.forEach(([x, y], index) => {
    const circle = document.createElementNS(svgNS, "circle");
    circle.setAttribute("cx", String(x)); circle.setAttribute("cy", String(y)); circle.setAttribute("r", "4");
    const number = document.createElementNS(svgNS, "text");
    number.setAttribute("x", String(x)); number.setAttribute("y", String(y - 11)); number.setAttribute("text-anchor", "middle");
    number.textContent = String(index ? prefixes[index - 1] : 0);
    byId("prefix-points").append(circle, number);
  });
  byId("prefix-title").textContent = `Prefix sums: ${prefixes.join(", ")}. ${firstNegative < 0 ? "All nonnegative." : `First negative at cell ${labels[firstNegative]}.`}`;
  const accepted = firstNegative < 0;
  byId("verdict").className = `verdict ${accepted ? "accepted" : "held"}`;
  byId("verdict").textContent = attempt === "accepted" ? "Commit accepted" : attempt === "held" ? "Commit held" : accepted ? "Commit available" : "The prefix barrier would hold";
  byId("reason").textContent = accepted ? `Prefixes ${prefixes.join(", ")} stay nonnegative. ${attempt === "accepted" ? "The current trits are now latched." : "This ordered walk may commit."}` : `Prefix ${firstNegative + 1} reaches ${prefixes[firstNegative]}. ${attempt === "held" ? "Previous latches are unchanged." : "A commit cannot pass this boundary."}`;
  byId("latches").textContent = latches ? `Latches: ${latches.map(signText).join("  ")}` : "Latches: empty";
  byId("step-count").textContent = `${steps} flow ${steps === 1 ? "step" : "steps"}`;
}

function startTrial(name = "balanced") {
  phases = [...presets[name]]; latches = null; steps = 0; attempt = null;
  for (const button of document.querySelectorAll("[data-preset]")) button.setAttribute("aria-pressed", String(button.dataset.preset === name));
  byId("last-action").textContent = "New trial. Latches cleared.";
  render();
}

for (const button of document.querySelectorAll("[data-preset]")) button.addEventListener("click", () => startTrial(button.dataset.preset));
for (let i = 0; i < 4; i++) byId(`phase-${i}`).addEventListener("input", event => {
  phases[i] = Number(event.target.value) * Math.PI / 180;
  latches = null; steps = 0; attempt = null;
  for (const button of document.querySelectorAll("[data-preset]")) button.setAttribute("aria-pressed", "false");
  byId("last-action").textContent = "Phase edited. New trial.";
  render();
});
byId("deadband").addEventListener("input", () => {attempt = null; render();});
byId("flow").addEventListener("click", () => {
  const duration = parameter("duration"), gain = parameter("gain");
  if (duration === null || gain === null) return;
  const previous = [...phases];
  phases = previous.map((theta, i) => theta + frequencies[i] * duration + gain * duration * Math.sin(previous[(i + 3) % 4] - theta));
  steps++; attempt = null;
  byId("last-action").textContent = `Synchronous flow, d = ${duration}.`;
  render();
});
byId("commit").addEventListener("click", () => {
  const state = observation();
  if (!state) return;
  attempt = state.firstNegative < 0 ? "accepted" : "held";
  if (attempt === "accepted") latches = [...state.trits];
  byId("last-action").textContent = attempt === "accepted" ? "Commit wrote four latches." : "Commit held. No latch writes.";
  render();
});
byId("reset").addEventListener("click", () => {byId("duration").value = "0.25"; byId("gain").value = "0.15"; byId("deadband").value = "0.5"; startTrial();});
render();
