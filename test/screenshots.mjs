// Erzeugt die Bilder für die README (docs/*.png)
import { chromium } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
await p.goto("file://" + process.cwd() + "/dist/index.html"); await p.waitForTimeout(600);
await p.evaluate(() => document.getElementById("hint").classList.add("gone")); await p.waitForTimeout(600);
await p.screenshot({ path: "docs/screen-info.png" });
await p.click("#tab-color"); await p.click('.sw[aria-label="Türkis"]');
await p.evaluate(() => { __viewer.state.cam.theta = -1.1; __viewer.state.cam.phi = 0.35; __viewer.state.dirty = true; });
await p.waitForTimeout(300); await p.screenshot({ path: "docs/screen-color.png" });
await p.click("#tab-view"); await p.check("#optOverhang", { force: true });
await p.evaluate(() => { __viewer.state.cam.phi = -0.3; __viewer.state.dirty = true; });
await p.waitForTimeout(300); await p.screenshot({ path: "docs/screen-overhang.png" });
await p.click('.sw[aria-label="Türkis"]').catch(() => {});
await p.uncheck("#optOverhang", { force: true });
await p.setInputFiles("#fileInput", "test/tall.stl"); await p.waitForTimeout(400);
await p.click("#tab-print"); await p.waitForTimeout(300); await p.screenshot({ path: "docs/screen-print.png" });
await b.close();
