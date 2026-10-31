// Prüft den Update-Hinweis der Android-App mit nachgebildeter App-Brücke und GitHub-Antwort.
import { chromium, devices } from "/opt/npm-tools/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
const shots = process.argv[2];
const notes = readFileSync("RELEASE_NOTES.md", "utf8").split("\n").filter(l => /^- /.test(l)).join("\n");
const release = (code) => ({ tag_name: "v1.0." + code, html_url: "https://github.com/snckz/STL-VIEWER/releases/tag/v1.0." + code,
  body: "## Neu in dieser Version\n\n" + notes + "\n\n---\n\n**Installieren:** …",
  assets: [{ name: "Modellblick-" + code + ".apk", browser_download_url: "https://github.com/snckz/STL-VIEWER/releases/download/v1.0." + code + "/Modellblick-" + code + ".apk" }] });
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
let fails = 0; const check = (n, c, g) => { if (!c) { fails++; console.log("FEHLER", n, JSON.stringify(g)); } else console.log("ok   ", n); };
async function open(installed, latest) {
  const ctx = await b.newContext({ ...devices["Pixel 7"] });
  await ctx.addInitScript((v) => { window.__dl = []; window.Android = { getVersionCode: () => v, getVersionName: () => "1.0." + v,
    downloadUpdate: (u, n) => window.__dl.push([u, n]), saveImage: () => {} }; }, installed);
  await ctx.route("https://api.github.com/**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(release(latest)) }));
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
  await p.goto("file://" + process.cwd() + "/dist/index.html"); await p.waitForTimeout(2200);
  return { p, ctx, errs };
}
{ const { p, ctx, errs } = await open(10, 11);
  const st = await p.evaluate(() => ({ shown: !updBackdrop.hidden, from: updFrom.textContent, to: updTo.textContent, notes: [...document.querySelectorAll("#updNotes li")].map(l => l.textContent), ver: appVer.textContent, row: !appVerRow.hidden }));
  check("Hinweis erscheint bei neuerer Version", st.shown && st.from === "1.0.10" && st.to === "1.0.11", st);
  const expected = notes.split("\n").map(l => l.replace(/^- /, ""));
  check("Neuerungen aus den Release-Notizen", JSON.stringify(st.notes) === JSON.stringify(expected), [st.notes, expected]);
  check("App-Version im Info-Tab", st.row && st.ver === "1.0.10", st);
  if (shots) await p.screenshot({ path: shots + "/22_update_android.png" });
  await p.click("#updNow");
  const dl = await p.evaluate(() => window.__dl);
  check("Jetzt aktualisieren startet Download der APK", dl.length === 1 && dl[0][0].endsWith("/Modellblick-11.apk") && dl[0][1] === "1.0.11", dl);
  await p.evaluate(() => window.updateState("downloading"));
  check("Status: lädt", await p.evaluate(() => updNow.disabled && !updStatus.hidden), null);
  if (shots) await p.screenshot({ path: shots + "/23_update_downloading.png" });
  await p.evaluate(() => window.updateState("installing"));
  await p.click("#updLater");
  check("Später schließt und merkt die Version", await p.evaluate(() => updBackdrop.hidden && localStorage.getItem("modellblick-update-skip") === "11"), null);
  await p.evaluate(() => localStorage.removeItem("modellblick-update-check")); await p.reload(); await p.waitForTimeout(2200);
  check("Übersprungene Version erscheint nicht erneut", await p.evaluate(() => updBackdrop.hidden), null);
  await p.click("#updCheck"); await p.waitForTimeout(500);
  check("Manuelle Suche zeigt sie trotzdem", await p.evaluate(() => !updBackdrop.hidden), null);
  check("keine Fehler", errs.length === 0, errs); await ctx.close(); }
{ const { p, ctx } = await open(11, 11);
  check("Aktuelle Version: kein Hinweis", await p.evaluate(() => updBackdrop.hidden), null);
  await p.click("#updCheck"); await p.waitForTimeout(500);
  check("Manuell: „neueste Version“", await p.evaluate(() => !toast.hidden && toastText.textContent.includes("neueste")), null);
  await ctx.close(); }
{ const ctx = await b.newContext(devices["Pixel 7"]); const p = await ctx.newPage(); let hit = false;
  await ctx.route("https://api.github.com/**", r => { hit = true; r.abort(); });
  await p.goto("file://" + process.cwd() + "/dist/index.html"); await p.waitForTimeout(2200);
  check("Web/iPhone: keine Abfrage, kein Versions-Eintrag", !hit && await p.evaluate(() => appVerRow.hidden && updBackdrop.hidden), hit);
  await ctx.close(); }
console.log(fails ? fails + " Fehler" : "alles ok"); await b.close(); process.exit(fails ? 1 : 0);
