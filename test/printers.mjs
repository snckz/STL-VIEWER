// Prüft Druckerliste, FDM-/Resin-Umschaltung und die Resin-Zeitschätzung.
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 412, height: 870 } }); const errs = [];
p.on("pageerror", e => errs.push(e.message));
await p.goto("file://" + process.cwd() + "/dist/index.html"); await p.waitForTimeout(500);
let fails = 0; const check = (n, c, g) => { if (!c) { fails++; console.log("FEHLER", n, JSON.stringify(g)); } else console.log("ok   ", n); };
const get = () => p.evaluate(() => ({ time: estTime.textContent, w: estWeight.textContent, len: estLen.textContent, layers: estLayers.textContent, lh: estLayerH.textContent,
  matLabel: estMatLabel.textContent, price: priceLabel.textContent, mats: [...document.querySelectorAll("#material option")].map(o => o.value),
  lhs: [...document.querySelectorAll("#layerH option")].map(o => o.value), infillHidden: document.querySelector("#infill").closest("[data-fdm]").hidden,
  hollowHidden: document.getElementById("optHollow").closest("[data-resin]").hidden, fit: document.getElementById("fit-chip").textContent, cost: estCostNote.textContent }));
const info = await p.evaluate(() => ({ groups: [...document.querySelectorAll("#printer optgroup")].map(g => g.label + ":" + g.children.length), total: document.querySelectorAll("#printer option").length }));
console.log(JSON.stringify(info));
check("mindestens 50 Drucker, gruppiert", info.total >= 50 && info.groups.length >= 10, info);
await p.setInputFiles("#fileInput", "test/cube20.stl"); await p.waitForTimeout(400);
await p.click("#tab-print");
const fdm = await get();
check("FDM: Filament-Materialien und Füllung sichtbar", fdm.mats.includes("pla") && !fdm.infillHidden && fdm.hollowHidden && fdm.matLabel === "Filament", fdm);
await p.selectOption("#printer", "saturn4u"); await p.waitForTimeout(200);
const r1 = await get();
check("Resin: Harze, Schichthöhen, Labels", r1.mats.includes("std") && r1.lhs.includes("0.05") && r1.infillHidden && !r1.hollowHidden && r1.matLabel === "Harz" && r1.price.includes("Liter") && r1.cost.includes("€/l"), r1);
check("Resin: 20-mm-Würfel = 400 Schichten à 0,05 mm", r1.layers === "400", r1);
check("Resin: 8 cm³ ≈ 8 ml", r1.w === "8,0 ml", r1);
const mins = (t) => { const h = /(\d+) h/.exec(t), m = /(\d+) min/.exec(t); return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0); };
check("Resin: Zeit plausibel (20–60 min)", mins(r1.time) >= 20 && mins(r1.time) <= 60, r1.time);
await p.check("#optSupport", { force: true }); await p.waitForTimeout(150);
const r2 = await get();
check("Resin + Stützen: +5 mm = 500 Schichten, mehr Harz", r2.layers === "500" && parseFloat(r2.w.replace(",", ".")) > 8, r2);
await p.evaluate(() => { const el = document.getElementById("layerSlider"); el.value = 50; el.dispatchEvent(new Event("input")); });
const lay = await p.evaluate(() => [layerOut.textContent, __viewer.state.clipZ]);
check("Schichtvorschau: Schicht 50 liegt in den Stützen", lay[0].includes("(Stützen)") && lay[1] < 0, lay);
await p.evaluate(() => { const el = document.getElementById("layerSlider"); el.value = el.max; el.dispatchEvent(new Event("input")); });
await p.uncheck("#optSupport", { force: true });
await p.check("#optHollow", { force: true }); await p.waitForTimeout(150);
const r3 = await get();
check("Hohl: 24 cm² × 2 mm = 4,8 ml", r3.w === "4,8 ml", r3);
await p.uncheck("#optHollow", { force: true });
await p.selectOption("#layerH", "0.1"); const r4 = await get();
check("0,1 mm = 200 Schichten, schneller", r4.layers === "200" && mins(r4.time) < mins(r1.time), [r4.time, r1.time]);
await p.selectOption("#material", "abs"); const r5 = await get();
check("ABS-ähnliches Harz belichtet länger", mins(r5.time) >= mins(r4.time), [r5.time, r4.time]);
// Werte je Typ merken: zurück zu FDM und wieder zu Resin
await p.selectOption("#printer", "bambu"); await p.waitForTimeout(150); const f2 = await get();
check("zurück zu FDM: PLA und 0,20 mm", f2.mats.includes("pla") && f2.lh === "à 0,20 mm" && f2.matLabel === "Filament", f2);
await p.selectOption("#printer", "mars5u"); await p.waitForTimeout(150);
const back = await p.evaluate(() => [material.value, layerH.value]);
check("Resin-Einstellungen gemerkt (ABS-ähnlich, 0,1 mm)", back[0] === "abs" && back[1] === "0.1", back);
// großes Modell passt nicht auf kleines Resin-Bett
await p.setInputFiles("#fileInput", "test/tall.stl"); await p.waitForTimeout(400);
check("300 mm hoch passt nicht auf Mars 5 Ultra", (await get()).fit.startsWith("Nein"), null);
// Neu laden: Auswahl bleibt erhalten
await p.reload(); await p.waitForTimeout(500);
const persisted = await p.evaluate(() => [printer.value, material.value, layerH.value, estMatLabel.textContent]);
check("Nach Neustart: Mars 5 Ultra mit Resin-Einstellungen", persisted.join() === "mars5u,abs,0.1,Harz", persisted);
console.log(fails ? fails + " Fehler" : "alles ok", errs);
await b.close(); process.exit(fails ? 1 : 0);
