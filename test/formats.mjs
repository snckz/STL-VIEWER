// Prüft das Einlesen aller unterstützten Formate über den Datei-Dialog.
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 412, height: 870 } }); const errs = [];
p.on("pageerror", e => errs.push(e.message));
await p.goto("file://" + process.cwd() + "/dist/index.html"); await p.waitForTimeout(500);
const expect = {
  "cube.3mf":     { x: "20,00", y: "20,00", z: "20,00", vol: "8,00 cm³", mf: "Ja, geschlossen", note: "Erstellt mit PrusaSlicer-2.8" },
  "bambu.3mf":    { x: "50,00", y: "20,00", z: "20,00", vol: "16,0 cm³", mf: "Ja, geschlossen", note: "Erstellt mit BambuStudio-02.03 · 2 Teile" },
  "inch.3mf":     { x: "25,40", vol: "16,4 cm³", mf: "Ja, geschlossen" },
  "sliced.3mf":   { toast: "Diese 3MF enthält nur G-Code (geslicte Datei) und kein Modell." },
  "cube_ascii.ply": { x: "10,00", vol: "1,00 cm³", mf: "Ja, geschlossen", note: "Dateikopf: Scanner-Test" },
  "cube_le.ply":  { x: "10,00", vol: "1,00 cm³", mf: "Ja, geschlossen" },
  "cube_be.ply":  { x: "10,00", vol: "1,00 cm³", mf: "Ja, geschlossen" },
  "cloud.ply":    { toast: "Die PLY-Datei ist eine reine Punktwolke ohne Flächen und lässt sich nicht als Modell anzeigen." },
  "cube20.stl":   { x: "20,00", vol: "8,00 cm³", mf: "Ja, geschlossen" },
  "cube.obj":     { x: "10,00", vol: "1,00 cm³", mf: "Ja, geschlossen" },
};
let fails = 0;
for (const [f, exp] of Object.entries(expect)) {
  await p.evaluate(() => { document.getElementById("toast").hidden = true; });
  await p.setInputFiles("#fileInput", "test/" + f); await p.waitForTimeout(900);
  const got = await p.evaluate(() => ({ name: fileName.textContent, x: dimX.textContent, y: dimY.textContent, z: dimZ.textContent, vol: vol.textContent, mf: manifold.textContent,
    note: headerNote.hidden ? "" : headerNote.textContent, fmt: fmt.textContent, toast: toast.hidden ? null : toastText.textContent }));
  const bad = Object.entries(exp).filter(([k, v]) => got[k] !== v);
  if (!exp.toast && got.name !== f) bad.push(["name", f]);
  if (bad.length) { fails++; console.log("FEHLER", f, JSON.stringify(got), "erwartet", JSON.stringify(Object.fromEntries(bad))); } else console.log("ok   ", f, got.fmt);
}
console.log(fails ? fails + " Fehler" : "alle Formate ok", errs.length ? errs : "");
await b.close(); process.exit(fails ? 1 : 0);
