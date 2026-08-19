import { join, resolve } from "node:path";

const packageRoot = resolve(import.meta.dir, "..");
const build = await Bun.build({
  entrypoints: [join(import.meta.dir, "fixtures", "browser-entry.tsx")],
  format: "esm",
  minify: true,
  target: "browser",
  write: false,
});
if (!build.success || !build.outputs[0]) {
  throw new Error("Atelier browser fixture failed to build.");
}
const script = await build.outputs[0].text();

Bun.serve({
  hostname: "127.0.0.1",
  port: 4317,
  fetch(request) {
    if (new URL(request.url).pathname === "/app.js") {
      return new Response(script, {
        headers: { "Content-Type": "text/javascript; charset=utf-8" },
      });
    }
    return new Response(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>html,body{margin:0}nav{position:sticky;top:0;z-index:2;display:flex;gap:8px;padding:8px;background:white}.atelier-site{max-width:100%;overflow:hidden}.atelier-columns{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,1fr);gap:16px;padding:16px}img{max-width:100%}@media(max-width:700px){.atelier-columns{grid-template-columns:1fr}}</style></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  },
});

console.log(`Atelier browser fixture: ${packageRoot}`);
