import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/dojo-deckbuilder/",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "structured-effects",
              test: /app[\\/]data[\\/]card-effects\.json$/,
              priority: 20,
            },
          ],
        },
      },
    },
  },
});
