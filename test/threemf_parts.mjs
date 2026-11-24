// Prüft: Mehrere Objekte in einer 3MF werden einzelne Teile – mit Namen, Lage aus dem Slicer, auswählbar.
import { chromium, devices } from "/opt/npm-tools/node_modules/playwright/index.mjs";
const b = await chromium.launch({ args: ["--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"] });
const p = await (await b.newContext(devices["Pixel 7"])).newPage(); const errs = [];
p.on("pageerror", e => errs.push(e.message));
await p.goto("file://" + process.cwd() + "/dist/index.html"); await p.waitForTimeout(500);
let fails = 0; const check = (n, c, g) => { if (!c) { fails++; console.log("FEHLER", n, JSON.stringify(g)); } else console.log("ok   ", n); };
const V = (f, a) => p.evaluate(f, a);
const box = (i) => V((i) => { const m = __viewer.state.mesh, pt = m.parts[i], mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
  for (let k = pt.start; k < pt.end; k += 3) for (let a = 0; a < 3; a++) { mn[a] = Math.min(mn[a], m.pos[k+a]); mx[a] = Math.max(mx[a], m.pos[k+a]); } return { mn, mx }; }, i);

await p.setInputFiles("#fileInput", "test/bambu_two.3mf"); await p.waitForTimeout(600);
const info = await V(() => ({ n: __viewer.state.mesh.parts.length, names: __viewer.state.mesh.parts.map(x => x.name), title: fileName.textContent, tris: __viewer.state.mesh.triCount }));
check("Bambu-3MF: zwei einzelne Teile", info.n === 2 && info.tris === 24, info);
check("Namen aus Bambu-Projekt (inkl. &)", info.names.join("|") === "Deckel|Halter & Clip", info.names);
check("Kopfzeile zeigt den Dateinamen", info.title === "bambu_two.3mf", info.title);
const a = await box(0), c = await box(1);
check("Lage aus dem Slicer bleibt (40 mm versetzt, beide auf dem Bett)", Math.abs((c.mn[0] - a.mn[0]) - 40) < 1e-3 && Math.abs(c.mn[1] - a.mn[1]) < 1e-3 && a.mn[2] === 0 && c.mn[2] === 0, [a, c]);
check("Maße der Teile stimmen", Math.abs(a.mx[0] - a.mn[0] - 20) < 1e-3 && Math.abs(c.mx[1] - c.mn[1] - 30) < 1e-3 && Math.abs(c.mx[2] - 5) < 1e-3, [a, c]);
// Teil antippen → ausgewählt
await V(() => { __viewer.state.cam.theta = -Math.PI / 2; __viewer.state.cam.phi = 1.2; __viewer.state.dirty = true; });
await p.waitForTimeout(200);
const scr = await V(() => { const m = __viewer.state.mesh, pt = m.parts[1], s = __viewer.state.scale; let cx = 0, cy = 0, n = 0;
  for (let k = pt.start; k < pt.end; k += 3) { cx += m.pos[k]; cy += m.pos[k+1]; n++; }
  const P = [cx / n * s, cy / n * s, 5 * s], vp = __viewer.state.lastVP;
  const X = vp[0]*P[0] + vp[4]*P[1] + vp[8]*P[2] + vp[12], Y = vp[1]*P[0] + vp[5]*P[1] + vp[9]*P[2] + vp[13], W = vp[3]*P[0] + vp[7]*P[1] + vp[11]*P[2] + vp[15];
  const r = document.getElementById("gl").getBoundingClientRect(); return [r.left + (X / W * 0.5 + 0.5) * r.width, r.top + (0.5 - Y / W * 0.5) * r.height]; });
await V(([x, y]) => { const c = document.getElementById("gl"); for (const t of ["pointerdown", "pointerup"]) c.dispatchEvent(new PointerEvent(t, { pointerId: 2, clientX: x, clientY: y, bubbles: true, pointerType: "touch", isPrimary: true, button: 0 })); }, scr);
await p.waitForTimeout(200);
check("Antippen wählt „Halter & Clip“", await V(() => __viewer.state.sel === 1 && !selBar.hidden && selName.textContent === "Halter & Clip"), await V(() => [__viewer.state.sel, selName.textContent]));
check("Teile-Liste zeigt beide", await V(() => [...document.querySelectorAll("#partsList .p-name")].map(x => x.textContent).join("|") === "Deckel|Halter & Clip"), null);
// Eigenes 3MF-Export (Objektnamen als name="…") wieder einlesen → wieder einzelne Teile
await p.click("#exportBtn"); await p.click("#exp3mf"); await p.waitForSelector("#expReady:not([hidden])");
const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#expDownload")]);
const buf = (await import("node:fs")).readFileSync(await dl.path()); await p.click("#expClose"); await p.waitForTimeout(300);
await V((b64) => window.loadModelBase64("Platte.3mf", b64), buf.toString("base64")); await p.waitForTimeout(600);
check("Eigenen 3MF-Export wieder öffnen: Teile und Namen bleiben", await V(() => __viewer.state.mesh.parts.map(x => x.name).join("|") === "Deckel|Halter & Clip"), await V(() => __viewer.state.mesh.parts.map(x => x.name)));
// 3MF mit nur einem Objekt bleibt ein Teil mit Dateinamen
await p.setInputFiles("#fileInput", "test/cube.3mf").catch(() => {}); await p.waitForTimeout(500);
const one = await V(() => ({ n: __viewer.state.mesh.parts.length, name: __viewer.state.mesh.parts[0].name }));
check("3MF mit einem Objekt: ein Teil mit Dateinamen", one.n === 1 && /\.3mf$/.test(one.name), one);
check("keine JS-Fehler", errs.length === 0, errs);
await b.close();
console.log(fails ? fails + " Fehler" : "alles ok"); process.exit(fails ? 1 : 0);
