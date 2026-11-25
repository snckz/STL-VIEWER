// Prüft das Umbenennen beim Export: Android-Brücke (Teilen / Speichern unter) und iPhone-Teilen-Menü.
import { chromium, devices } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const shots = process.argv[2];
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
let fails = 0; const check = (n, c, g) => { if (!c) { fails++; console.log("FEHLER", n, JSON.stringify(g)); } else console.log("ok   ", n); };
const url = "file://" + process.cwd() + "/dist/index.html";

// --- Android: Datei geht unter dem eingegebenen Namen an die App
{ const ctx = await b.newContext(devices["Pixel 7"]);
  await ctx.addInitScript(() => { window.__br = { begin: [], bytes: 0, share: [], save: [] };
    window.Android = { getVersionCode: () => 99, getVersionName: () => "1.0.99", downloadUpdate() {}, saveImage() {},
      fileBegin: (n) => { window.__br.begin.push(n); window.__br.bytes = 0; return n; },
      fileAppend: (t, b64) => { window.__br.bytes += atob(b64).length; return true; },
      fileShare: (t, m) => window.__br.share.push(t), fileSave: (t, m) => window.__br.save.push(t) }; });
  await ctx.route("https://api.github.com/**", r => r.abort());
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(500);
  await p.setInputFiles("#fileInput", "test/bambu_two.3mf"); await p.waitForTimeout(600);
  await p.click("#exportBtn"); await p.click("#exp3mf"); await p.waitForSelector("#expReady:not([hidden])");
  const st = await p.evaluate(() => ({ v: expName.value, ext: expExt.textContent, begin: __br.begin.slice() }));
  check("Android: Vorschlag ist der Dateiname der 3MF (nicht „Platte“)", st.v === "bambu_two" && st.ext === ".3mf" && st.begin.join() === "bambu_two.3mf", st);
  if (shots) { await p.waitForTimeout(300); await p.screenshot({ path: shots + "/60_name.png" }); }
  await p.fill("#expName", "Bohrschablone links"); await p.click("#expShare"); await p.waitForTimeout(300);
  let br = await p.evaluate(() => window.__br);
  check("Android Teilen: neuer Name mit Leerzeichen", br.share.at(-1) === "Bohrschablone links.3mf" && br.begin.at(-1) === "Bohrschablone links.3mf" && br.bytes > 0, br);
  await p.click("#expSave"); await p.waitForTimeout(300); br = await p.evaluate(() => window.__br);
  check("Android Speichern: gleicher Name, keine zweite Übertragung", br.save.at(-1) === "Bohrschablone links.3mf" && br.begin.length === 2, br);
  await p.fill("#expName", "   "); await p.locator("#expName").blur();
  check("Leerer Name: Vorschlag kommt zurück", await p.evaluate(() => expName.value === "bambu_two"), await p.evaluate(() => expName.value));
  check("keine JS-Fehler (Android)", errs.length === 0, errs); await ctx.close(); }

// --- iPhone: Teilen-Menü bekommt die Datei mit dem neuen Namen
{ const ctx = await b.newContext(devices["iPhone 15 Pro"]);
  await ctx.addInitScript(() => { window.__shared = []; navigator.canShare = () => true; navigator.share = async (d) => { window.__shared.push(d.files.map(f => f.name + ":" + f.size)); }; });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(500);
  await p.setInputFiles("#fileInput", "test/cube20.stl"); await p.waitForTimeout(500);
  await p.click("#exportBtn"); await p.click("#expStl"); await p.waitForSelector("#expReady:not([hidden])");
  check("iPhone: Knopf „Teilen / In Dateien sichern“", await p.evaluate(() => !expShare.hidden && expShare.textContent.includes("In Dateien sichern")), null);
  await p.fill("#expName", "Würfel 20mm"); await p.click("#expShare"); await p.waitForTimeout(200);
  const sh = await p.evaluate(() => window.__shared);
  check("iPhone: geteilte Datei heißt „Würfel 20mm.stl“", sh.length === 1 && sh[0][0] === "Würfel 20mm.stl:684", sh);
  check("Download-Link heißt ebenso", await p.evaluate(() => expDownload.download === "Würfel 20mm.stl"), await p.evaluate(() => expDownload.download));
  check("keine JS-Fehler (iPhone)", errs.length === 0, errs); await ctx.close(); }
await b.close();
console.log(fails ? fails + " Fehler" : "alles ok"); process.exit(fails ? 1 : 0);
