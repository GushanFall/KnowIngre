import { readFileSync } from "node:fs";
import { corsHeaders } from "./http";

const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/index.html": { file: "index.html", type: "text/html; charset=utf-8" },
  "/login.html": { file: "login.html", type: "text/html; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
  "/ui.css": { file: "ui.css", type: "text/css; charset=utf-8" },
  "/app.js": { file: "app.js", type: "application/javascript; charset=utf-8" },
  "/frontend/api.js": { file: "frontend/api.js", type: "application/javascript; charset=utf-8" },
  "/frontend/download.js": { file: "frontend/download.js", type: "application/javascript; charset=utf-8" },
  "/frontend/ai-recipe.js": { file: "frontend/ai-recipe.js", type: "application/javascript; charset=utf-8" },
  "/frontend/menu-readiness.js": { file: "frontend/menu-readiness.js", type: "application/javascript; charset=utf-8" },
};

export function serveStatic(pathname: string): Response | null {
  const asset = STATIC_FILES[pathname];
  if (!asset) return null;
  return new Response(readFileSync(new URL("../" + asset.file, import.meta.url)), {
    headers: { "Content-Type": asset.type, ...corsHeaders() },
  });
}

