import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Native modules (better-sqlite3 ships a .node binding) cannot be loaded
// through Vite's SSR ESM transform — they have to be `external` for SSR and
// `exclude`d from dep optimisation so Vite leaves the require() call alone.
const NATIVE = ["better-sqlite3"];

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
    nitro({
      preset: "node-server",
    }),
    tsConfigPaths(),
  ],
  ssr: {
    external: NATIVE,
    noExternal: [],
  },
  optimizeDeps: {
    exclude: NATIVE,
  },
  build: {
    rollupOptions: {
      external: NATIVE,
    },
  },
});
