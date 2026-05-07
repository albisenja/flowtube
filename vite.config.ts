import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

function copyExtensionFiles(): Plugin {
  return {
    name: "copy-extension-files",
    closeBundle() {
      const root = __dirname;
      const dist = resolve(root, "dist");

      mkdirSync(dist, { recursive: true });
      copyFileSync(resolve(root, "manifest.json"), resolve(dist, "manifest.json"));
      copyFileSync(resolve(root, "src", "popup.html"), resolve(dist, "popup.html"));
      copyFileSync(resolve(root, "src", "popup.css"), resolve(dist, "popup.css"));
    }
  };
}

export default defineConfig({
  publicDir: "public",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background.ts"),
        content: resolve(__dirname, "src/content.ts"),
        popup: resolve(__dirname, "src/popup.ts")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  },
  plugins: [copyExtensionFiles()]
});
