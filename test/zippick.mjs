// Prüft die ZIP-Auswahl: Ordnerbaum, Ordner/Dateien abwählen, Abbrechen, später weitere Dateien aus derselben ZIP nachladen.
import { chromium, devices } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const shots = process.argv[2];
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await (await b.newContext(devices["Pixel 7"])).newPage(); const errs = [];
p.on("pageerror", e => errs.push(e.message));
await p.goto("file://" + process.cwd() + "/dist/index.html"); await p.waitForTimeout(500);
let fails = 0; const check = (n, c, g) => { if (!c) { fails++; console.log("FEHLER", n, JSON.stringify(g)); } else console.log("ok   ", n); };
const V = (f, a) => p.evaluate(f, a);
const dlg = () => V(() => ({ open: !zipBackdrop.hidden, sub: zipSub.textContent, count: zipCount.textContent, ok: zipOk.textContent, okDis: zipOk.disabled,
  folders: [...document.querySelectorAll("#zipTree .zfolder > .zrow")].map(r => r.querySelector(".zname").textContent + (r.querySelector("input").indeterminate ? "~" : r.querySelector("input").checked ? "+" : "-")),
  files: [...document.querySelectorAll("#zipTree li:not(.zfolder) > .zrow")].map(r => r.querySelector(".zname").textContent + (r.querySelector("input").disabled ? "#" : r.querySelector("input").checked ? "+" : "-")) }));
const parts = () => V(() => __viewer.state.mesh.demo ? [] : __viewer.state.mesh.parts.map(x => x.name));

// 1. Abbrechen: nichts ändert sich
await p.setInputFiles("#fileInput", "test/folders.zip"); await p.waitForSelector("#zipBackdrop:not([hidden])");
let d = await dlg();
check("Dialog zeigt Ordnerbaum", d.folders.join() === "Projekt+,Gehäuse+,Halter+" && d.files.length === 4 && d.files.every(f => f.endsWith("+")), d);
check("Übersicht: 4 Modelle in 3 Ordnern", /folders\.zip · 4 Modelle in 3 Ordnern/.test(d.sub) && d.ok === "4 Modelle öffnen", d);
if (shots) { await p.waitForTimeout(500); await p.screenshot({ path: shots + "/40_zip_dialog.png" }); }
await p.keyboard.press("Escape"); await p.waitForTimeout(300);
check("Escape bricht ab, Beispiel bleibt", await V(() => zipBackdrop.hidden && __viewer.state.mesh.demo && toast.hidden), null);

// 2. Ordner „Gehäuse“ abwählen → nur Halter + Schraube
await p.setInputFiles("#fileInput", "test/folders.zip"); await p.waitForSelector("#zipBackdrop:not([hidden])");
await V(() => { const r = [...document.querySelectorAll("#zipTree .zfolder > .zrow")].find(r => r.querySelector(".zname").textContent === "Gehäuse"); r.querySelector("input").click(); });
d = await dlg();
check("Ordner abgewählt: Projekt teilweise", d.folders.join() === "Projekt~,Gehäuse-,Halter+" && d.ok === "2 Modelle öffnen", d);
// Ordner zuklappen versteckt die Dateien, Auswahl bleibt
await V(() => [...document.querySelectorAll("#zipTree .zfolder")].find(li => li.querySelector(".zname").textContent === "Halter").querySelector(".zchev").click());
check("Ordner zuklappen", await V(() => [...document.querySelectorAll("#zipTree .zfolder")].find(li => li.querySelector(".zname").textContent === "Halter").querySelector("ul").hidden), null);
await p.click("#zipOk"); await p.waitForTimeout(700);
check("Nur gewählte Modelle geladen", JSON.stringify((await parts()).sort()) === JSON.stringify(["Halter.obj", "Schraube.ply"]), await parts());
const row = await V(() => ({ shown: !zipRow.hidden, name: zipRowName.textContent, info: zipRowInfo.textContent }));
check("Modell-Tab zeigt ZIP mit „2 von 4“", row.shown && row.name === "folders.zip" && row.info === "2 von 4 Modellen auf der Platte", row);

// 3. Weitere Dateien wählen: geladene sind markiert, nichts vorausgewählt
await p.click("#zipMore"); await p.waitForSelector("#zipBackdrop:not([hidden])");
d = await dlg();
check("Nachladen: Geladene gesperrt, Rest abgewählt", d.files.filter(f => f.endsWith("#")).length === 2 && await V(() => [...document.querySelectorAll("#zipTree input:disabled")].every(i => i.checked)) && d.files.filter(f => f.endsWith("-")).length === 2 && d.okDis && d.count.startsWith("0 von 2"), d);
check("Titel „Weitere Dateien wählen“", await V(() => zipTitle.textContent === "Weitere Dateien wählen"), null);
await V(() => { const r = [...document.querySelectorAll("#zipTree li:not(.zfolder) > .zrow")].find(r => r.querySelector(".zname").textContent === "Deckel"); r.querySelector("input").click(); });
if (shots) { await V(() => toast.hidden = true); await p.waitForTimeout(500); await p.screenshot({ path: shots + "/41_zip_more.png" }); }
await p.click("#zipOk"); await p.waitForTimeout(700);
check("Deckel dazugeladen (3 Teile)", JSON.stringify((await parts()).sort()) === JSON.stringify(["Deckel.stl", "Halter.obj", "Schraube.ply"]), await parts());
check("Zeile: 3 von 4", await V(() => zipRowInfo.textContent === "3 von 4 Modellen auf der Platte"), await V(() => zipRowInfo.textContent));

// 4. „Alles auswählen“ beim Nachladen
await p.click("#zipMore"); await p.waitForSelector("#zipBackdrop:not([hidden])");
await p.click("#zipAll"); d = await dlg();
check("Alles auswählen: nur der Rest", d.ok === "1 Modell öffnen", d);
await p.click("#zipOk"); await p.waitForTimeout(700);
check("Alle 4 auf der Platte", (await parts()).length === 4 && await V(() => zipRowInfo.textContent === "4 von 4 Modellen auf der Platte"), await parts());

// 5. Neue Einzeldatei öffnen → ZIP-Zeile verschwindet
await p.setInputFiles("#fileInput", "test/cube20.stl"); await p.waitForTimeout(500);
check("Andere Datei: ZIP-Zeile weg", await V(() => zipRow.hidden), null);
check("keine JS-Fehler", errs.length === 0, errs);
await b.close();
console.log(fails ? fails + " Fehler" : "alles ok"); process.exit(fails ? 1 : 0);
