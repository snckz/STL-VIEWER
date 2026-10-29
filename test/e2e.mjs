import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
import { resolve } from "node:path";
const root = resolve(process.argv[2] || ".");
const shots = process.argv[3];
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 870 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/fonts\.(googleapis|gstatic)/.test(m.text()) && !/ERR_|Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
await page.goto("file://" + root + "/dist/index.html");
await page.waitForTimeout(800);
const r = {};
const info = async () => page.evaluate(() => ({ name: document.getElementById("fileName").textContent, x: dimX.textContent, y: dimY.textContent, z: dimZ.textContent,
  vol: vol.textContent, area: area.textContent, tris: tris.textContent, verts: verts.textContent, mf: manifold.textContent, fit: document.getElementById("fit-chip").textContent,
  w: estWeight.textContent, fil: estLen.textContent, time: estTime.textContent, toast: toast.hidden ? null : toastText.textContent }));
r.demo = await info();
await page.screenshot({ path: shots + "/01_demo.png" });
// Pixel-Check: Mitte des Canvas darf nicht Hintergrund sein
const nonBg = async () => page.evaluate(() => { const c = document.getElementById("gl"); const g = c.getContext("webgl2"); const px = new Uint8Array(4);
  g.readPixels(c.width >> 1, c.height >> 1, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); return Array.from(px); });
r.demoCenterPixel = await nonBg();
for (const f of ["cube20.stl", "cube_ascii.stl", "open.stl", "cube.obj", "tall.stl", "garbage.stl"]) {
  await page.setInputFiles("#fileInput", root + "/test/" + f);
  await page.waitForTimeout(500);
  r[f] = await info();
  if (f === "cube20.stl") { r.cubeCenterPixel = await nonBg(); await page.screenshot({ path: shots + "/02_cube.png" }); }
  if (f === "tall.stl") await page.screenshot({ path: shots + "/03_tall.png" });
}
await page.click("#toastClose").catch(() => {});
// Zurück zum Würfel, Farbe, Skalierung, Rotation, Zoom
await page.setInputFiles("#fileInput", root + "/test/cube20.stl"); await page.waitForTimeout(300);
const d0 = await page.evaluate(() => __viewer.state.cam.dist);
await page.click("#zoomIn"); const d1 = await page.evaluate(() => __viewer.state.cam.dist);
await page.click("#zoomOut"); await page.click("#zoomOut"); const d2 = await page.evaluate(() => __viewer.state.cam.dist);
r.zoom = { d0, d1, d2, ok: d1 < d0 && d2 > d1 };
// Wischgeste (Touch-Drehen) über Pointer-Events simulieren
const th0 = await page.evaluate(() => __viewer.state.cam.theta);
await page.evaluate(() => { const c = document.getElementById("gl"); const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: "touch", isPrimary: true }));
  ev("pointerdown", 200, 300); for (let i = 1; i <= 10; i++) ev("pointermove", 200 + i * 10, 300); ev("pointerup", 300, 300); });
r.rotate = { th0, th1: await page.evaluate(() => __viewer.state.cam.theta) };
// Pinch
const pd0 = await page.evaluate(() => __viewer.state.cam.dist);
await page.evaluate(() => { const c = document.getElementById("gl"); const ev = (t, id, x, y) => c.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: "touch" }));
  ev("pointerdown", 1, 180, 300); ev("pointerdown", 2, 220, 300); for (let i = 1; i <= 8; i++) { ev("pointermove", 1, 180 - i * 10, 300); ev("pointermove", 2, 220 + i * 10, 300); } ev("pointerup", 1, 100, 300); ev("pointerup", 2, 300, 300); });
r.pinch = { pd0, pd1: await page.evaluate(() => __viewer.state.cam.dist) };
await page.click("#fit"); await page.click("#tab-color"); await page.click('.sw[aria-label="Blau"]');
r.color = await page.evaluate(() => __viewer.state.color.map(v => +v.toFixed(3)));
await page.screenshot({ path: shots + "/04_color.png" });
await page.click("#tab-view"); await page.check('#optWire', {force:true}); await page.check('#optOverhang', {force:true}); await page.click('[data-view="front"]');
r.switches = await page.evaluate(() => [__viewer.state.wire, __viewer.state.overhang]);
await page.screenshot({ path: shots + "/05_view.png" });
await page.click("#tab-rotate"); await page.click('[data-scale="200"]');
r.scaled = await info();
await page.click('[data-rot90="x"]'); r.rotX = await info();
await page.click("#tab-print"); await page.selectOption("#printer", { label: "Bambu A1 mini" });
await page.screenshot({ path: shots + "/06_print.png" });
// Base64 Schnittstelle der Android-App
const b64 = (await import("node:fs")).readFileSync(root + "/test/cube20.stl").toString("base64");
await page.evaluate(([b]) => window.loadModelBase64("geteilt.stl", b), [b64]); await page.waitForTimeout(400);
r.bridge = await info();
// Desktop-Layout
await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(300);
await page.screenshot({ path: shots + "/07_desktop.png" });
r.hScroll = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
r.errors = errors;
console.log(JSON.stringify(r, null, 1));
await browser.close();
