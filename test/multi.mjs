// Prüft ZIP-Dateien, Mehrfachauswahl, Hinzufügen/Entfernen und das Ziehen der Bedienleiste.
import { chromium, devices } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const shots = process.argv[2];
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await (await b.newContext(devices["Pixel 7"])).newPage(); const errs = [];
p.on("pageerror", e => errs.push(e.message));
await p.goto("file://" + process.cwd() + "/dist/index.html"); await p.waitForTimeout(500);
let fails = 0; const check = (n, c, g) => { if (!c) { fails++; console.log("FEHLER", n, JSON.stringify(g)); } else console.log("ok   ", n); };
const info = () => p.evaluate(() => ({ name: fileName.textContent, meta: fileMeta.textContent, vol: vol.textContent, tris: tris.textContent, mf: manifold.textContent,
  parts: [...document.querySelectorAll("#partsList .p-name")].map(e => e.textContent), partsShown: !partsBox.hidden, add: !addBtn.hidden,
  toast: toast.hidden ? null : toastText.textContent, x: dimX.textContent, y: dimY.textContent, z: dimZ.textContent }));
const wait = () => p.waitForTimeout(700);
check("Hinzufügen-Knopf beim Beispiel versteckt", !(await info()).add, null);
// ZIP
await p.setInputFiles("#fileInput", "test/models.zip"); await p.waitForSelector("#zipBackdrop:not([hidden])"); await p.click("#zipOk"); await wait();
let r = await info();
check("ZIP: 3 Modelle, Müll/Nicht-Modelle ignoriert", r.name === "3 Teile" && r.parts.join("|") === "Würfel.obj|cube_le.ply|cube20.stl" && r.partsShown, r);
check("ZIP: Volumen = 1 + 8 + 1 cm³", /^10,00? cm³$/.test(r.vol) && r.mf.includes("geschlossen"), r);
check("ZIP: nebeneinander mit 5 mm Abstand (10+5+20+5+10 = 50 mm)", r.x === "50,00" && r.z === "20,00", r);
if (shots) { await p.screenshot({ path: shots + "/24_zip.png" }); }
// Hinzufügen
await p.setInputFiles("#addInput", ["test/tall.stl"]); await wait();
r = await info();
check("Hinzufügen: 4 Modelle, Volumen addiert", r.name === "4 Teile" && r.parts.length === 4 && r.parts[3] === "tall.stl", r);
// Entfernen
await p.click('#partsList li:nth-child(4) button'); await wait();
r = await info();
check("Entfernen: zurück auf 3 Modelle, 10 cm³", r.name === "3 Teile" && /^10,00? cm³$/.test(r.vol) && r.parts.length === 3, r);
await p.click('#partsList li:nth-child(1) button'); await p.waitForTimeout(400); await p.click('#partsList li:nth-child(1) button'); await wait();
r = await info();
check("Bis auf eines entfernt: Liste weg, Dateiname", r.name === "cube20.stl" && !r.partsShown, r);
// Mehrere Dateien auf einmal (ersetzt)
await p.setInputFiles("#fileInput", ["test/cube20.stl", "test/bambu.3mf", "test/garbage.stl"]); await wait();
r = await info();
check("Mehrfachauswahl: 2 gelesen, kaputte übersprungen (3MF mit 2 Objekten = 2 Teile)", r.name === "3 Teile" && r.parts.join("|") === "cube20.stl|bambu · Teil 1|bambu · Teil 2" && r.vol === "24,0 cm³" && /übersprungen: garbage\.stl/.test(r.toast || ""), r);
await p.evaluate(() => { toast.hidden = true; });
// Hinzufügen ersetzt das Beispielmodell
await p.reload(); await p.waitForTimeout(500);
await p.setInputFiles("#addInput", ["test/cube20.stl"]); await wait();
r = await info();
check("Hinzufügen zum Beispiel ersetzt es", r.name === "cube20.stl" && !r.partsShown, r);
// Leere ZIP
await p.setInputFiles("#fileInput", "test/empty.zip"); await wait();
r = await info();
check("ZIP ohne Modelle: verständliche Meldung, altes Modell bleibt", /kein 3D-Modell gefunden/.test(r.toast || "") && r.name === "cube20.stl", r);
// Bedienleiste am Griff ziehen
const h = async () => p.evaluate(() => ({ h: Math.round(panel.getBoundingClientRect().height), c: panel.classList.contains("collapsed"), t: panel.classList.contains("tall"), app: Math.round(app.getBoundingClientRect().height) }));
const dragBy = async (dy) => p.evaluate(async (dy) => {
  const hd = document.querySelector(".handle"), r = hd.getBoundingClientRect(), x = r.left + 30, y = r.top + 8;
  const ev = (t, yy) => hd.dispatchEvent(new PointerEvent(t, { pointerId: 9, clientX: x, clientY: yy, bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true }));
  ev("pointerdown", y); for (let i = 1; i <= 10; i++) { ev("pointermove", y + dy * i / 10); await new Promise(r => setTimeout(r, 10)); } ev("pointerup", y + dy);
}, dy);
await p.evaluate(() => { toast.hidden = true; }); await p.click("#tab-print");
const h0 = await h();
await dragBy(-250); await p.waitForTimeout(800); const h1 = await h();
check("Griff nach oben: Leiste groß (so hoch wie der Inhalt)", h1.t && h1.h > h0.h + 80, [h0, h1]);
await dragBy(600); await p.waitForTimeout(800); const h2 = await h();
check("Griff ganz nach unten: eingeklappt", h2.c && h2.h <= 90, h2);   // schwebende Glas-Leiste: 76 px + Rand
await dragBy(-120); await p.waitForTimeout(800); const h3 = await h();
check("kurz nach oben: wieder normal", !h3.c && !h3.t && Math.abs(h3.h - h3.app * 0.46) < 30, h3);
await p.click("#tab-look");
check("Tabs funktionieren weiter", await p.evaluate(() => !document.getElementById("pane-look").hidden), null);
console.log(fails ? fails + " Fehler" : "alles ok", errs); await b.close(); process.exit(fails ? 1 : 0);
