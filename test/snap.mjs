// Prüft intelligentes Messen (Einrasten an Ecke, Kante, Bohrung), Wischen zwischen den Bereichen und einmalige Hinweise.
import { chromium, devices } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const shots = process.argv[2];
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const ctx = await b.newContext(devices["Pixel 7"]); const p = await ctx.newPage(); const errs = [];
p.on("pageerror", e => errs.push(e.message));
const url = "file://" + process.cwd() + "/dist/index.html";
await p.goto(url); await p.waitForTimeout(500);
let fails = 0; const check = (n, c, g) => { if (!c) { fails++; console.log("FEHLER", n, JSON.stringify(g)); } else console.log("ok   ", n); };
const V = (f, a) => p.evaluate(f, a);
const scr = (P) => V((P) => { const vp = __viewer.state.lastVP, s = __viewer.state.scale, [x, y, z] = P.map(c => c * s);
  const cx = vp[0]*x + vp[4]*y + vp[8]*z + vp[12], cy = vp[1]*x + vp[5]*y + vp[9]*z + vp[13], cw = vp[3]*x + vp[7]*y + vp[11]*z + vp[15];
  const r = document.getElementById("gl").getBoundingClientRect(); return [r.left + (cx / cw * 0.5 + 0.5) * r.width, r.top + (0.5 - cy / cw * 0.5) * r.height]; }, P);
const tap = (x, y) => V(([x, y]) => { const c = document.getElementById("gl");
  const ev = (t) => c.dispatchEvent(new PointerEvent(t, { pointerId: 4, clientX: x, clientY: y, bubbles: true, pointerType: "touch", isPrimary: true, button: 0 }));
  ev("pointerdown"); ev("pointerup"); }, [x, y]);
const pts = () => V(() => __viewer.state.measure.pts.map(q => ({ p: q.p.map(v => Math.round(v * 1000) / 1000), kind: q.kind, d: q.circle ? Math.round(q.circle.r * 2000) / 1000 : null })));

// --- Hinweis beim ersten Start sichtbar, beim zweiten Start nicht mehr
check("Gesten-Hinweis beim ersten Start", await V(() => !hint.classList.contains("gone")), null);
await p.setInputFiles("#fileInput", "test/plate_hole.stl"); await p.waitForTimeout(500);
await p.evaluate(() => { toast.hidden = true; });
check("Testplatte: geschlossen, 40 × 40 × 10", await V(() => { const m = __viewer.state.mesh; return m.manifold && !m.manifold.open && Math.abs(m.max[0] - m.min[0] - 40) < 1e-3 && Math.abs(m.max[2] - 10) < 1e-3; }), null);

// --- Messen mit Einrasten
await V(() => { const c = __viewer.state.cam; c.theta = -Math.PI / 2 + 0.35; c.phi = 0.95; c.target = [0, 0, 5]; c.dist = 95; __viewer.state.dirty = true; });
await p.click("#measureBtn"); await p.waitForTimeout(150);
check("Einrasten standardmäßig an", await V(() => snapBtn.getAttribute("aria-pressed") === "true"), null);
// Neben den Bohrungsrand auf die Oberseite tippen → Mitte der Bohrung, ⌀ 8
let [x, y] = await scr([5.2, 0.6, 10]); await tap(x, y); await p.waitForTimeout(100);
let q = await pts();
check("Bohrung: Mitte und ⌀ 8 mm", q.length === 1 && q[0].kind === "hole" && Math.hypot(q[0].p[0], q[0].p[1]) < 0.02 && Math.abs(q[0].p[2] - 10) < 0.01 && Math.abs(q[0].d - 8) < 0.05, q);
check("Anzeige: Bohrung ⌀ 8,00 mm", await V(() => /^⌀ (7,99|8,00|8,01) mm$/.test(measureMain.textContent) && measureSub.textContent.startsWith("Bohrung")), await V(() => measureMain.textContent));
if (shots) { await p.waitForTimeout(150); await p.screenshot({ path: shots + "/50_hole.png" }); }
// Knapp neben die Ecke tippen → exakt die Ecke
let c = await scr([19.2, -19.0, 10]); await p.waitForTimeout(400); await tap(c[0], c[1]); await p.waitForTimeout(100);
q = await pts();
check("Ecke exakt getroffen", q.length === 2 && q[1].kind === "corner" && q[1].p.join() === "20,-20,10", q);
check("Abstand Mitte → Ecke = 28,28 mm", await V(() => /^28,2[78] mm$/.test(measureMain.textContent) && measureKind.textContent.startsWith("Bohrung ⌀")), await V(() => [measureMain.textContent, measureKind.textContent]));
if (shots) { await p.waitForTimeout(150); await p.screenshot({ path: shots + "/51_hole_corner.png" }); }
// Neuer Messvorgang: nahe an die Vorderkante tippen → exakt auf der Kante (y = −20)
await p.waitForTimeout(400); c = await scr([6, -19.3, 10]); await tap(c[0], c[1]); await p.waitForTimeout(100);
q = await pts();
check("Kante exakt getroffen", q.length === 1 && q[0].kind === "edge" && Math.abs(q[0].p[1] + 20) < 1e-3 && Math.abs(q[0].p[2] - 10) < 1e-3 && Math.abs(q[0].p[0] - 6) < 1.5, q);
// Mitten auf der Fläche bleibt der Punkt frei
await p.waitForTimeout(400); c = await scr([12, 10, 10]); await tap(c[0], c[1]); await p.waitForTimeout(100);
q = await pts();
check("Fläche: freier Punkt", q.length === 2 && q[1].kind === "free" && Math.abs(q[1].p[2] - 10) < 1e-3, q);
// Einrasten aus → kein Einrasten an der Ecke
await p.click("#snapBtn"); await V(() => toast.hidden = true);
await p.waitForTimeout(400); c = await scr([19.2, -19.0, 10]); await tap(c[0], c[1]); await p.waitForTimeout(100);
q = await pts();
check("Einrasten aus: angetippter Punkt", q.length === 1 && q[0].kind === "free" && q[0].p.join() !== "20,-20,10", q);
await p.click("#snapBtn"); await p.click("#measureDone");

// --- Wischen zwischen den Bereichen
const swipe = (sel, dx) => V(([sel, dx]) => { const el = document.querySelector(sel), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 30;
  const ev = (t, xx) => el.dispatchEvent(new PointerEvent(t, { pointerId: 8, clientX: xx, clientY: y, bubbles: true, pointerType: "touch", isPrimary: true }));
  ev("pointerdown", x); ev("pointerup", x + dx); }, [sel, dx]);
const cur = () => V(() => document.querySelector(".tab[aria-selected=true]").id);
await p.click("#tab-model");
await swipe("#pane-model .dims", -140); check("Wischen nach links → Bearbeiten", await cur() === "tab-edit", await cur());
await swipe("#pane-edit .sec", -140); check("Weiter → Druck", await cur() === "tab-print", await cur());
await swipe("#pane-print .estimate", 140); check("Wischen nach rechts → Bearbeiten", await cur() === "tab-edit", await cur());
await swipe("#rotX", -140); check("Wischen auf einem Regler wechselt nicht", await cur() === "tab-edit", await cur());
await p.click("#tab-model"); await swipe("#pane-model .dims", 140); check("Am Anfang: nicht weiter nach rechts", await cur() === "tab-model", await cur());

// --- Hinweise nur einmal: Teile-Hinweis
await p.setInputFiles("#fileInput", ["test/cube20.stl", "test/cube.obj"]); await p.waitForTimeout(600);
check("Teile-Hinweis beim ersten Mal", await V(() => !toast.hidden && /Tippe ein Teil an/.test(toastText.textContent)), null);
await V(() => toast.hidden = true);
await p.setInputFiles("#fileInput", ["test/cube20.stl", "test/tall.stl"]); await p.waitForTimeout(600);
check("Teile-Hinweis kein zweites Mal", await V(() => toast.hidden || !/Tippe ein Teil an/.test(toastText.textContent)), null);
// Neustart der App: Gesten-Hinweis bleibt weg
await V(() => document.getElementById("gl").dispatchEvent(new PointerEvent("pointerdown", { pointerId: 9, clientX: 50, clientY: 300, bubbles: true, pointerType: "touch" })));
await p.reload(); await p.waitForTimeout(500);
check("Nach Neustart kein Gesten-Hinweis", await V(() => hint.classList.contains("gone")), null);

check("keine JS-Fehler", errs.length === 0, errs);
await b.close();
console.log(fails ? fails + " Fehler" : "alles ok"); process.exit(fails ? 1 : 0);
