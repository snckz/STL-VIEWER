// Prüft die Bearbeiten-Funktionen: Messen, Teil verschieben, Kopie, Anordnen, Entfernen, Druck-Check, Export (STL/3MF) und Ansicht-Menü.
import { chromium, devices } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const shots = process.argv[2];
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await (await b.newContext({ ...devices["Pixel 7"], acceptDownloads: true })).newPage(); const errs = [];
p.on("pageerror", e => errs.push(e.message));
await p.goto("file://" + process.cwd() + "/dist/index.html"); await p.waitForTimeout(500);
let fails = 0; const check = (n, c, g) => { if (!c) { fails++; console.log("FEHLER", n, JSON.stringify(g)); } else console.log("ok   ", n); };
const V = (f, a) => p.evaluate(f, a);
const ptr = (list) => V((list) => { const c = document.getElementById("gl");
  for (const [t, x, y] of list) c.dispatchEvent(new PointerEvent(t, { pointerId: 5, clientX: x, clientY: y, bubbles: true, pointerType: "touch", isPrimary: true, button: 0 })); }, list);
// Weltpunkt (Modellkoordinaten) → Bildschirm: dieselbe Matrix wie der letzte gezeichnete Frame (inkl. Versatz der Glas-Bedienfläche)
const screen = (P) => V(async (P) => {
  __viewer.state.dirty = true; await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const vp = __viewer.state.lastVP, s = __viewer.state.scale, [x, y, z] = P.map(v => v * s);
  const cx = vp[0]*x + vp[4]*y + vp[8]*z + vp[12], cy = vp[1]*x + vp[5]*y + vp[9]*z + vp[13], cw = vp[3]*x + vp[7]*y + vp[11]*z + vp[15];
  const r = document.getElementById("gl").getBoundingClientRect();
  return [r.left + (cx / cw * 0.5 + 0.5) * r.width, r.top + (0.5 - cy / cw * 0.5) * r.height];
}, P);
const partCenter = (i) => V((i) => { const m = __viewer.state.mesh, pt = m.parts[i]; const mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
  for (let k = pt.start; k < pt.end; k += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], m.pos[k+a]); mx[a] = Math.max(mx[a], m.pos[k+a]); }
  return { c: [0,1,2].map(a => (mn[a] + mx[a]) / 2), mn, mx }; }, i);

// --- Einzelner Würfel: Messen
await p.setInputFiles("#fileInput", "test/cube20.stl"); await p.waitForTimeout(500);
await V(() => { toast.hidden = true; });
check("Druck-Check: Würfel passt, Netz geschlossen, gute Auflage", await V(() => { const t = [...document.querySelectorAll("#checks .check")].map(l => l.className + ":" + l.querySelector("b").textContent);
  return t.some(x => x.includes("ok:Passt")) && t.some(x => x.includes("ok:Geschlossenes")) && t.some(x => x.includes("ok:Gute Auflage")) && printDot.hidden; }), null);
await p.click("#measureBtn");
check("Messmodus aktiv", await V(() => !modeBar.hidden && measureBtn.getAttribute("aria-pressed") === "true"), null);
await p.click("#tab-look"); await p.click("#tab-model");   // Ansicht bleibt
// Würfel liegt nach placeOnBed bei x,y ∈ [-10,10], z ∈ [0,20] → zwei Punkte auf der Oberseite
await V(() => { __viewer.state.cam.theta = -Math.PI / 2; __viewer.state.cam.phi = Math.PI / 2 - 0.01; __viewer.state.dirty = true; });
let a = await screen([-8, 0, 20]), c2 = await screen([8, 0, 20]);
await ptr([["pointerdown", ...a], ["pointerup", ...a]]); await p.waitForTimeout(100);
check("Erster Punkt gesetzt", await V(() => __viewer.state.measure.pts.length === 1 && measureMain.textContent.includes("Zweiten")), null);
await p.waitForTimeout(400);
await ptr([["pointerdown", ...c2], ["pointerup", ...c2]]); await p.waitForTimeout(200);
const meas = await V(() => ({ main: measureMain.textContent, sub: measureSub.textContent, label: !measureLabel.hidden }));
check("Abstand ≈ 16 mm gemessen", /^1[56],\d\d mm$/.test(meas.main) && meas.label, meas);
if (shots) await p.screenshot({ path: shots + "/30_measure.png" });
await p.click("#measureDone");
check("Messmodus beendet", await V(() => modeBar.hidden && measureLabel.hidden), null);

// --- Kopie des einzelnen Modells
await p.click("#tab-edit"); await p.click("#dupBtn"); await p.waitForTimeout(300);
const afterCopy = await V(() => ({ n: __viewer.state.mesh.parts.length, names: __viewer.state.mesh.parts.map(x => x.name), sel: __viewer.state.sel, tris: __viewer.state.mesh.triCount }));
check("Kopie angelegt und ausgewählt", afterCopy.n === 2 && afterCopy.names[1] === "cube20.stl (2)" && afterCopy.sel === 1 && afterCopy.tris === 24, afterCopy);
const pc0 = await partCenter(0), pc1 = await partCenter(1);
check("Kopie liegt daneben, nicht überlappend", Math.abs(pc1.c[0] - pc0.c[0]) >= 24.9 && Math.abs(pc1.c[2] - pc0.c[2]) < 1e-3, [pc0.c, pc1.c]);
check("Auswahl-Leiste sichtbar", await V(() => !selBar.hidden && selName.textContent === "cube20.stl (2)"), null);
if (shots) await p.screenshot({ path: shots + "/31_copy.png" });

// --- Teil verschieben durch Ziehen
await V(() => { const c = __viewer.state.cam; c.theta = -Math.PI / 2; c.phi = Math.PI / 2 - 0.01; c.target = [0, 0, 0]; c.dist = 160; __viewer.state.dirty = true; });
const from = await screen([pc1.c[0], pc1.c[1], 20]), to = await screen([pc1.c[0] + 30, pc1.c[1] - 40, 20]);
const moves = [["pointerdown", ...from]]; for (let i = 1; i <= 10; i++) moves.push(["pointermove", from[0] + (to[0] - from[0]) * i / 10, from[1] + (to[1] - from[1]) * i / 10]); moves.push(["pointerup", ...to]);
const th = await V(() => __viewer.state.cam.theta);
await ptr(moves); await p.waitForTimeout(200);
const pm = await partCenter(1);
check("Teil um ≈ (+30, −40) mm verschoben", Math.abs(pm.c[0] - pc1.c[0] - 30) < 1.5 && Math.abs(pm.c[1] - pc1.c[1] + 40) < 1.5 && Math.abs(pm.mn[2]) < 1e-4, [pc1.c, pm.c]);
check("Kamera hat sich dabei nicht gedreht", Math.abs(await V(() => __viewer.state.cam.theta) - th) < 1e-9, null);
check("Anderes Teil unverändert", JSON.stringify((await partCenter(0)).c) === JSON.stringify(pc0.c), null);

// --- Weit wegschieben → Druck-Check meldet es, Anordnen behebt es
await V(() => { const m = __viewer.state.mesh, pt = m.parts[1]; });
const far = await screen([pm.c[0] + 400, pm.c[1], 20]);
const from2 = await screen([pm.c[0], pm.c[1], 20]);
await ptr([["pointerdown", ...from2], ...Array.from({ length: 10 }, (_, i) => ["pointermove", from2[0] + (far[0] - from2[0]) * (i + 1) / 10, from2[1]]), ["pointerup", ...far]]); await p.waitForTimeout(200);
await p.click("#tab-print");
const outChk = await V(() => [...document.querySelectorAll("#checks .check b")].map(b => b.textContent));
check("Druck-Check: Teil außerhalb / zu groß erkannt", outChk.some(t => /ragen über|Zu groß/.test(t)), outChk);
await p.click("#tab-model"); await p.click("#arrangeBtn2"); await p.waitForTimeout(300);
const arr = await V(() => { const m = __viewer.state.mesh; return { min: m.min, max: m.max, n: m.parts.length }; });
check("Anordnen: alles wieder auf dem Bett", arr.n === 2 && arr.max[0] - arr.min[0] < 50 && Math.abs(arr.min[2]) < 1e-4, arr);
const okChk = await V(() => [...document.querySelectorAll("#checks .check")].filter(l => !l.classList.contains("ok")).map(l => l.querySelector("b").textContent));
check("Druck-Check danach ohne Warnungen", okChk.length === 0, okChk);

// --- Entfernen über die Auswahl-Leiste
await V(() => { document.querySelector("#partsList li:nth-child(2) .p-name").click(); });
await p.click("#selRemove"); await p.waitForTimeout(300);
check("Teil entfernt", await V(() => __viewer.state.mesh.parts.length === 1 && selBar.hidden), null);

// --- Export STL (Download) und 3MF (Rundlauf durch den eigenen Parser)
await V(() => __viewer.state.scale = 1);
await p.click("#exportBtn"); await p.click("#expStl"); await p.waitForSelector("#expReady:not([hidden])");
check("STL fertig, Dateiname als Vorschlag", await V(() => expName.value === "cube20" && expExt.textContent === ".stl" && expSize.textContent === "684 B"), await V(() => [expName.value, expExt.textContent, expSize.textContent]));
// Umbenennen: Name eintippen, Endung bleibt; verbotene Zeichen werden ersetzt
await p.fill("#expName", "Mein Halter: V2");
await p.keyboard.press("Enter");
const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#expDownload")]);
const stl = (await import("node:fs")).readFileSync(await dl.path());
check("Download heißt wie eingegeben (mit Endung)", dl.suggestedFilename() === "Mein Halter_ V2.stl", dl.suggestedFilename());
check("STL binär mit 12 Dreiecken", stl.length === 684 && stl.readUInt32LE(80) === 12, stl.length);
await p.click("#expClose"); await p.waitForTimeout(300);
// Zweites Modell dazu und als 3MF wieder einlesen
await p.setInputFiles("#addInput", "test/tall.stl"); await p.waitForTimeout(500);
const before = await V(() => ({ tris: __viewer.state.mesh.triCount, vol: __viewer.state.mesh.vol, dims: [0,1,2].map(k => __viewer.state.mesh.max[k] - __viewer.state.mesh.min[k]) }));
await p.click("#exportBtn"); await p.click("#exp3mf"); await p.waitForSelector("#expReady:not([hidden])");
const [dl3] = await Promise.all([p.waitForEvent("download"), p.click("#expDownload")]);
const buf = (await import("node:fs")).readFileSync(await dl3.path());
check("3MF heißt Platte.3mf", dl3.suggestedFilename() === "Platte.3mf", dl3.suggestedFilename());
await p.click("#expClose"); await p.waitForTimeout(300);
await V((b64) => window.loadModelBase64("Platte.3mf", b64), buf.toString("base64")); await p.waitForTimeout(600);
const after = await V(() => ({ tris: __viewer.state.mesh.triCount, vol: __viewer.state.mesh.vol, fmt: __viewer.state.mesh.fmt, n: __viewer.state.mesh.parts.length, mf: __viewer.state.mesh.manifold,
  dims: [0,1,2].map(k => __viewer.state.mesh.max[k] - __viewer.state.mesh.min[k]) }));
check("3MF-Rundlauf: gleiche Dreiecke, Volumen und Maße", after.tris === before.tris && Math.abs(after.vol - before.vol) / before.vol < 1e-4 && after.dims.every((d, k) => Math.abs(d - before.dims[k]) < 0.01) && after.fmt === "3MF", [before, after]);
check("3MF-Rundlauf: Netz geschlossen", after.mf && !after.mf.open && !after.mf.nonManifold, after.mf);

// --- Anordnen beachtet die Größe (200 %): 8 Würfel à 40 mm passen in zwei Reihen auf 256 mm
await p.setInputFiles("#fileInput", Array(8).fill("test/cube20.stl").map((f, i) => f)); await p.waitForTimeout(600);
await p.click("#tab-edit"); await p.click('[data-scale="200"]'); await p.click("#arrangeBtn"); await p.waitForTimeout(300);
const sc = await V(() => { const m = __viewer.state.mesh, s = __viewer.state.scale; return { w: (m.max[0] - m.min[0]) * s, d: (m.max[1] - m.min[1]) * s, n: m.parts.length }; });
check("Anordnen bei 200 %: passt aufs Bett", sc.n === 8 && sc.w <= 256 && sc.d <= 256, sc);
// Escape im Export-Dialog behält die Auswahl
await V(() => document.querySelector("#partsList li:nth-child(2) .p-name").click());
await p.click("#exportBtn"); await p.keyboard.press("Escape"); await p.waitForTimeout(300);
check("Escape schließt nur den Dialog", await V(() => expBackdrop.hidden && __viewer.state.sel === 1), await V(() => __viewer.state.sel));
await p.click("#tab-model");

// --- Ansicht-Menü
await p.click("#viewMenuBtn");
check("Ansicht-Menü offen", await V(() => !viewMenu.hidden && viewMenuBtn.getAttribute("aria-expanded") === "true"), null);
if (shots) await p.screenshot({ path: shots + "/32_viewmenu.png" });
await p.click('[data-view="top"]');
check("Blickrichtung „Oben“ und Menü zu", await V(() => viewMenu.hidden && __viewer.state.cam.phi > 1.5), null);
await p.click("#viewMenuBtn"); await p.keyboard.press("Escape");
check("Escape schließt Menü", await V(() => viewMenu.hidden), null);

// --- Druck-Check: zu groß → passend verkleinern
await p.setInputFiles("#fileInput", "test/tall.stl"); await p.waitForTimeout(400);
await p.click("#tab-print"); await p.selectOption("#printer", "bambuMini"); await p.waitForTimeout(200);
const big = await V(() => ({ dot: !printDot.hidden, t: document.querySelector("#checks .check.bad b")?.textContent }));
check("Zu groß erkannt, Punkt am Druck-Tab", big.dot && /Zu groß/.test(big.t || ""), big);
await p.click("#checks .check.bad .btn"); await p.waitForTimeout(200);
check("Passend verkleinert", await V(() => !document.querySelector("#checks .check.bad") && printDot.hidden && __viewer.state.scale < 1), await V(() => __viewer.state.scale));
if (shots) await p.screenshot({ path: shots + "/33_check.png" });

check("keine JS-Fehler", errs.length === 0, errs);
await b.close();
console.log(fails ? fails + " Fehler" : "alles ok"); process.exit(fails ? 1 : 0);
