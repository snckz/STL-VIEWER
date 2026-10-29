// Erzeugt aus viewer.html ein vollständiges HTML-Dokument.
// Aufruf:
//   node web/build.mjs [ziel.html] [--offline]   Einzelne Seite (Tests, Android-App)
//   node web/build.mjs --pwa <ordner>              Installierbare Web-App (iPhone/iPad, GitHub Pages)
//   --offline  entfernt die Google-Fonts-Links (die App soll ohne Netz sofort starten; es greifen die System-Schriften)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, "viewer.html"), "utf8");
const split = src.indexOf('<div class="app"');
if (split < 0) throw new Error('viewer.html: <div class="app"> nicht gefunden');

const args = process.argv.slice(2);
const pwaIdx = args.indexOf("--pwa");
const pwaDir = pwaIdx >= 0 ? args[pwaIdx + 1] : null;
if (pwaIdx >= 0 && !pwaDir) throw new Error("--pwa braucht einen Zielordner");
const offline = args.includes("--offline") || !!pwaDir;
const target = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--pwa");

let head = src.slice(0, split).trim();
if (offline) head = head.split("\n").filter((l) => !/fonts\.(googleapis|gstatic)\.com/.test(l)).join("\n");
const body = src.slice(split).trim();

const pwaHead = `<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Modellblick">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="description" content="STL, 3MF, OBJ und PLY ansehen, drehen, einfärben und vor dem 3D-Druck prüfen – mit Druckzeit-Schätzung.">`;
const swScript = `<script>
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
</script>`;

const html = `<!doctype html>
<html lang="de"${pwaDir ? ' class="pwa"' : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#14171c">
${pwaDir ? pwaHead + "\n" : ""}${head}
</head>
<body>
${body}
${pwaDir ? swScript + "\n" : ""}</body>
</html>
`;

if (pwaDir) {
  const out = resolve(pwaDir); mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "index.html"), html);
  const assets = ["manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
  const hash = createHash("sha256").update(html);
  for (const a of assets) { copyFileSync(resolve(here, "pwa", a), join(out, a)); hash.update(readFileSync(resolve(here, "pwa", a))); }
  const version = hash.digest("hex").slice(0, 12);
  writeFileSync(join(out, "sw.js"), readFileSync(resolve(here, "pwa", "sw.js"), "utf8").replace("__VERSION__", version));
  writeFileSync(join(out, ".nojekyll"), "");
  console.log("Web-App geschrieben:", out, "Version", version);
} else {
  const out = target ? resolve(target) : resolve(here, "../dist/index.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log("geschrieben:", out, html.length, "Bytes", offline ? "(offline)" : "");
}
