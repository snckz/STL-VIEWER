// Erzeugt aus viewer.html ein vollständiges HTML-Dokument (für die Android-App und lokale Tests).
// Aufruf: node web/build.mjs [ziel.html] [--offline]
//   --offline  entfernt die Google-Fonts-Links (die App soll ohne Netz sofort starten; es greifen die System-Schriften)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, "viewer.html"), "utf8");
const split = src.indexOf('<div class="app"');
if (split < 0) throw new Error('viewer.html: <div class="app"> nicht gefunden');

const args = process.argv.slice(2);
const offline = args.includes("--offline");
const target = args.find((a) => !a.startsWith("--"));
let head = src.slice(0, split).trim();
if (offline) head = head.split("\n").filter((l) => !/fonts\.(googleapis|gstatic)\.com/.test(l)).join("\n");
const body = src.slice(split).trim();
const out = target ? resolve(target) : resolve(here, "../dist/index.html");

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="theme-color" content="#14171c">
${head}
</head>
<body>
${body}
</body>
</html>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log("geschrieben:", out, html.length, "Bytes", offline ? "(offline)" : "");
