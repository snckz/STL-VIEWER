// Prüft Auswahl per Antippen, Doppeltippen-Zoom und das Drehen einzelner Teile.
import { chromium, devices } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const shots = process.argv[2];
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await (await b.newContext(devices["Pixel 7"])).newPage(); const errs = [];
p.on("pageerror", e => errs.push(e.message));
await p.goto("file://" + process.cwd() + "/dist/index.html"); await p.waitForTimeout(500);
let fails = 0; const check = (n, c, g) => { if (!c) { fails++; console.log("FEHLER", n, JSON.stringify(g)); } else console.log("ok   ", n); };
await p.setInputFiles("#fileInput", ["test/cube20.stl", "test/tall.stl", "test/cube.obj"]); await p.waitForTimeout(800);
await p.evaluate(() => { toast.hidden = true; hint.classList.add("gone"); });
// Bildschirmposition der Mitte eines Teils berechnen (gleiche Kamera wie draw())
const screenOf = (i) => p.evaluate((i) => {
  const m = __viewer.state.mesh, pt = m.parts[i], s = __viewer.state.scale; let x = 0, y = 0, z = 0, n = 0;
  for (let k = pt.start; k < pt.end; k += 3) { x += m.pos[k]; y += m.pos[k + 1]; z += m.pos[k + 2]; n++; }
  const P = [x / n * s, y / n * s, z / n * s], c = __viewer.state.cam;
  const e = [c.target[0] + c.dist * Math.cos(c.phi) * Math.cos(c.theta), c.target[1] + c.dist * Math.cos(c.phi) * Math.sin(c.theta), c.target[2] + c.dist * Math.sin(c.phi)];
  const sub = (a, b) => a.map((v, k) => v - b[k]), dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  const cr = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]], nm = (a) => { const l = Math.hypot(...a); return a.map(v => v / l); };
  const f = nm(sub(c.target, e)), r = nm(cr(f, [0, 0, 1])), u = cr(r, f), q = sub(P, e), dz = dot(q, f);
  const t = Math.tan(20 * Math.PI / 180), rect = document.getElementById("gl").getBoundingClientRect(), asp = rect.width / rect.height;
  const nx = dot(q, r) / dz / t / asp, ny = dot(q, u) / dz / t;
  return [rect.left + (nx + 1) / 2 * rect.width, rect.top + (1 - ny) / 2 * rect.height];
}, i);
const tap = async (x, y) => p.evaluate(([x, y]) => { const c = document.getElementById("gl");
  const ev = (t) => c.dispatchEvent(new PointerEvent(t, { pointerId: 3, clientX: x, clientY: y, bubbles: true, pointerType: "touch", isPrimary: true }));
  ev("pointerdown"); ev("pointerup"); }, [x, y]);
const sel = () => p.evaluate(() => __viewer.state.sel);
// Antippen wählt das Teil
let [x, y] = await screenOf(1); await tap(x, y); await p.waitForTimeout(400);
check("Antippen wählt den Zylinder (Teil 2)", await sel() === 1, await sel());
check("Liste markiert ihn", await p.evaluate(() => document.querySelectorAll("#partsList li.sel").length === 1 && document.querySelector("#partsList li.sel .p-name").textContent === "tall.stl"), null);
if (shots) await p.screenshot({ path: shots + "/25_selected.png" });
// Ins Leere tippen hebt die Auswahl auf
await tap(30, 330); await p.waitForTimeout(400);
check("Tippen ins Leere hebt Auswahl auf", await sel() === -1, await sel());
// Doppeltippen zoomt auf das kleine Teil
[x, y] = await screenOf(2); const d0 = await p.evaluate(() => __viewer.state.cam.dist);
await tap(x, y); await p.waitForTimeout(60); await tap(x, y); await p.waitForTimeout(400);
const cam = await p.evaluate(() => ({ dist: __viewer.state.cam.dist, t: __viewer.state.cam.target, sel: __viewer.state.sel }));
check("Doppeltippen: OBJ-Würfel ausgewählt und herangezoomt", cam.sel === 2 && cam.dist < d0 * 0.5, [cam, d0]);
if (shots) await p.screenshot({ path: shots + "/26_focus.png" });
// Teil drehen: nur der Zylinder liegt danach
await p.evaluate(() => { toast.hidden = true; });
await p.click("#tab-model"); await p.click("#partsList li:nth-child(2) .p-name"); await p.waitForTimeout(300);
const before = await p.evaluate(() => { const m = __viewer.state.mesh; return m.parts.map(pt => [pt.start, pt.end]); });
const box = (i) => p.evaluate((i) => { const m = __viewer.state.mesh, pt = m.parts[i]; const mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
  for (let k = pt.start; k < pt.end; k += 3) for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], m.pos[k+j]); mx[j] = Math.max(mx[j], m.pos[k+j]); }
  return { size: mx.map((v, j) => +(v - mn[j]).toFixed(2)), c: [(mn[0]+mx[0])/2, (mn[1]+mx[1])/2].map(v => +v.toFixed(2)), minZ: +mn[2].toFixed(3) }; }, i);
const b0 = await box(0), b1 = await box(1), vol0 = await p.evaluate(() => vol.textContent);
await p.click("#tab-edit");
check("Drehen-Tab zeigt das Ziel", await p.evaluate(() => !rotTarget.hidden && rotTargetName.textContent === "tall.stl" && !rotAll.hidden), null);
await p.click('[data-rot90="y"]'); await p.waitForTimeout(300);
const a0 = await box(0), a1 = await box(1);
check("Nur der Zylinder liegt jetzt (300 → 60 hoch)", a1.size[2] === 60 && a1.size[0] === 300 && a1.minZ === 0, [b1, a1]);
check("Mitte des Zylinders bleibt", Math.abs(a1.c[0] - b1.c[0]) < 0.01 && Math.abs(a1.c[1] - b1.c[1]) < 0.01, [b1.c, a1.c]);
check("Anderes Teil unverändert", JSON.stringify(a0) === JSON.stringify(b0), [b0, a0]);
check("Volumen gleich", await p.evaluate(() => vol.textContent) === vol0, null);
check("Winkel des Teils: Y 90°", await p.evaluate(() => rotYOut.value === "90"), null);
// Regler live ziehen
await p.evaluate(() => { const el = rotZ; el.value = 45; el.dispatchEvent(new Event("input")); });
await p.waitForTimeout(200);
await p.evaluate(() => rotZ.dispatchEvent(new Event("change"))); await p.waitForTimeout(200);
const a2 = await box(1);
check("Regler Z 45° dreht das Teil", a2.size[0] < 300 && a2.size[1] > 60 && a2.minZ === 0, a2);
// Zurücksetzen bringt das Teil in die Ausgangslage
await p.click("#rotReset"); await p.waitForTimeout(200);
const a3 = await box(1);
check("Zurücksetzen: Zylinder steht wieder", a3.size[2] === 300 && Math.abs(a3.size[0] - 60) < 0.1, a3);
// Flach hinlegen nur für das Teil
await p.click('[data-rot90="x"]'); await p.click("#layFlat"); await p.waitForTimeout(200);
const a4 = await box(1);
check("Flach hinlegen: Zylinder auf Stirnfläche", a4.size[2] === 300, a4);
// Ganze Platte wieder als Ziel
await p.click("#rotAll"); await p.waitForTimeout(200);
check("„Ganze Platte“ hebt Auswahl auf", await sel() === -1 && await p.evaluate(() => rotTargetName.textContent === "alle Teile zusammen" && rotYOut.value === "0"), null);
await p.click('[data-rot90="z"]'); await p.waitForTimeout(300);
check("Platte gedreht: Breite ↔ Tiefe", await p.evaluate(() => [dimX.textContent, dimY.textContent]).then(v => v[0] === "60,00"), await p.evaluate(() => [dimX.textContent, dimY.textContent]));
// Einzelmodell: kein Auswahl-Modus
await p.setInputFiles("#fileInput", "test/cube20.stl"); await p.waitForTimeout(500);
[x, y] = await screenOf(0); await tap(x, y); await p.waitForTimeout(300);
check("Einzelmodell: keine Auswahl, kein Drehziel", await sel() === -1 && await p.evaluate(() => rotTarget.hidden), null);
console.log(fails ? fails + " Fehler" : "alles ok", errs); await b.close(); process.exit(fails ? 1 : 0);
