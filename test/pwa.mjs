// Prüft die Web-App so, wie GitHub Pages sie ausliefert (Unterordner), inkl. Offline-Start über den Service Worker.
import { chromium, devices } from "/opt/npm-tools/node_modules/playwright/index.mjs";
import http from "node:http"; import { readFileSync, existsSync } from "node:fs"; import { join, extname } from "node:path";
const root = process.argv[2] || "site"; const shots = process.argv[3];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const srv = http.createServer((q, s) => { let p = decodeURIComponent(q.url.split("?")[0]);
  if (!p.startsWith("/STL-VIEWER/")) { s.writeHead(404); return s.end(); }
  p = p.slice("/STL-VIEWER/".length) || "index.html"; const f = join(root, p);
  if (!existsSync(f)) { s.writeHead(404); return s.end(); }
  s.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); s.end(readFileSync(f)); }).listen(8766);
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const ctx = await b.newContext({ ...devices["iPhone 15 Pro Max"], serviceWorkers: "allow" });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", e => errs.push(e.message));
let fails = 0; const check = (n, c, g) => { if (!c) { fails++; console.log("FEHLER", n, JSON.stringify(g)); } else console.log("ok   ", n); };
await p.goto("http://127.0.0.1:8766/STL-VIEWER/"); await p.waitForTimeout(800);
const man = await p.evaluate(async () => { const r = await fetch(document.querySelector('link[rel=manifest]').href); return r.ok ? r.json() : null; });
check("Manifest erreichbar und gültig", man && man.display === "standalone" && man.icons.length === 3 && man.start_url === "./", man);
const icons = await p.evaluate(async () => Promise.all(["icon-192.png", "icon-512.png", "apple-touch-icon.png"].map(async f => (await fetch(f)).ok)));
check("Icons erreichbar", icons.every(Boolean), icons);
const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
check("Service Worker aktiv", sw, sw);
check("iOS: Dateiauswahl ohne Typfilter", await p.evaluate(() => !document.getElementById("fileInput").hasAttribute("accept")), null);
check("Klasse pwa gesetzt", await p.evaluate(() => document.documentElement.classList.contains("pwa")), null);
await p.reload(); await p.waitForTimeout(600);
await ctx.setOffline(true); srv.close();
await p.reload(); await p.waitForTimeout(800);
const off = await p.evaluate(() => [document.getElementById("fileName").textContent, document.getElementById("estTime").textContent]);
check("Startet offline", off[0] === "Beispielmodell" && off[1].startsWith("≈"), off);
await ctx.setOffline(false);
await p.setInputFiles("#fileInput", "test/bambu.3mf"); await p.waitForTimeout(500);
check("3MF am iPhone-Viewport", await p.evaluate(() => fileName.textContent === "bambu.3mf"), null);
check("keine horizontale Scrollbar", await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), null);
if (shots) await p.screenshot({ path: shots + "/12_pwa_iphone.png" });
console.log(fails ? fails + " Fehler" : "alles ok", errs); await b.close(); process.exit(fails ? 1 : 0);
