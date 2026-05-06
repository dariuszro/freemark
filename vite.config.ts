import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("@codemirror/lang-markdown") ||
            id.includes("@lezer/markdown")
          ) {
            return "codemirror-markdown";
          }
          if (id.includes("@codemirror") || id.includes("@lezer")) return "codemirror-core";
          if (id.includes("react") || id.includes("react-dom")) return "react";
          if (id.includes("marked") || id.includes("dompurify")) return "markdown-vendor";
          return "vendor";
        }
      }
    }
  }
});
