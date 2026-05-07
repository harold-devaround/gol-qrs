import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";

/**
 * Serve static assets that already live at the project root (CPs/, tuiles/,
 * top-level JPGs) without forcing a move into `public/`. Keeps legacy paths
 * working in dev; for production they are copied into `dist/` by buildEnd.
 */
const ROOT_ASSET_PATTERNS = [
  /^\/CPs\//,
  /^\/tuiles\//,
  /^\/2019_WorldMap_MHF_1\.2x1\.6m\.jpg$/,
  /^\/data\.json$/,
];

const PROD_COPY = [
  { from: "CPs", to: "CPs" },
  { from: "tuiles", to: "tuiles" },
  {
    from: "2019_WorldMap_MHF_1.2x1.6m.jpg",
    to: "2019_WorldMap_MHF_1.2x1.6m.jpg",
  },
  { from: "data.json", to: "data.json" },
];

function copyDir(src: string, dst: string) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function rootAssets(): Plugin {
  return {
    name: "gol-root-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        if (!ROOT_ASSET_PATTERNS.some((rx) => rx.test(url))) return next();
        const filePath = path.join(__dirname, decodeURIComponent(url));
        fs.stat(filePath, (err, stat) => {
          if (err || !stat.isFile()) return next();
          res.setHeader("Cache-Control", "public, max-age=3600");
          fs.createReadStream(filePath).pipe(res);
        });
      });
    },
    closeBundle() {
      // Copy game assets into dist/ so the production build is self-contained
      // (Render publish directory = `dist`).
      const outDir = path.join(__dirname, "dist");
      for (const { from, to } of PROD_COPY) {
        const src = path.join(__dirname, from);
        const dst = path.join(outDir, to);
        if (!fs.existsSync(src)) continue;
        const stat = fs.statSync(src);
        if (stat.isDirectory()) copyDir(src, dst);
        else {
          fs.mkdirSync(path.dirname(dst), { recursive: true });
          fs.copyFileSync(src, dst);
        }
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), rootAssets()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    extensions: [".mjs", ".js", ".ts", ".tsx", ".jsx", ".json"],
  },
  server: {
    port: 5173,
    open: true,
  },
  optimizeDeps: {
    entries: ["index.html", "src/**/*.{ts,tsx}"],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: { main: path.resolve(__dirname, "index.html") },
    },
  },
  publicDir: "public",
});
