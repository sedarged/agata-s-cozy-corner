import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

const NATIVE = ["better-sqlite3"];

// Nitro defaults buildDir to `node_modules/.nitro`. On a shared VPS where
// node_modules was installed by root, that dir is not writable for the
// current user — and `vite build` writes into it (services/ssr/assets)
// even when not explicitly asked to. Override the buildDir to a path we
// own (in /tmp) so dev / build can re-run as the unprivileged user.
const NITRO_BUILD_DIR = process.env.NITRO_BUILD_DIR ?? "/tmp/agata-nitro";

// The TanStack Start plugin generates `#tanstack-router-entry` /
// `#tanstack-start-entry` virtual imports and rewrites them via Vite
// `resolve.alias` at build time. Node's runtime resolver has no idea
// about these — they're not real package exports. If we externalise the
// framework packages, the bundler skips them and Node then tries to
// resolve the virtual imports against the consuming package's
// `imports` field, which doesn't define them, and crashes.
//
// So: externalise ONLY the packages that genuinely must not be bundled.
//   - `better-sqlite3` is a native addon (`.node` binding) — must stay
//     external so Node resolves it at runtime.
//   - `h3-v2` lives in `node_modules/h3-v2/` but its package.json
//     declares `"name": "h3"`. Rolldown's resolver matches the directory
//     name, so without externalising, it looks for a package called
//     `h3-v2` and fails (no such package).
// The TanStack plugin sets `resolve.noExternal` automatically for its
// own packages — do NOT add framework packages here.
const SSR_EXTERNAL: string[] = ["better-sqlite3", "h3-v2"];

// The nitro environment bundles the SSR bundle into the final server
// output. After the SSR env bundled everything else, the bare
// specifiers the nitro pass sees are framework packages whose aliases
// have already been resolved. Externalising them lets Nitro skip
// re-bundling and let Node resolve them at runtime via node_modules.
const NITRO_EXTERNAL: string[] = [
  "better-sqlite3",
  "h3-v2",
  "react",
  "react/jsx-runtime",
  "react-dom",
  "react-dom/server",
  "@tanstack/history",
  "@tanstack/react-router",
  "@tanstack/react-router/ssr/server",
  "@tanstack/router-core",
  "@tanstack/router-core/ssr/server",
  "@tanstack/router-core/ssr/client",
  "@tanstack/react-start",
  "@tanstack/start-server-core",
  "@tanstack/start-client-core",
  "@tanstack/react-query",
  "seroval",
  "seroval-plugins",
  "iron-webcrypto",
  "uncrypto",
  "ufo",
  "destr",
  "unctx",
  "ofetch",
  "ohash",
  "pathe",
  "radix3",
  "scule",
  "srvx",
  "std-env",
  "croner",
  "hookable",
  "cookie-es",
  "zod",
  "zod-to-json-schema",
  "isbot",
  "nanoid",
  "listhen",
  "jiti",
  "cjs-module-lexer",
  "tsx",
  "tslib",
  "@standard-schema/spec",
  "@standard-schema/utils",
  "fetchdts",
  "drizzle-orm",
  "drizzle-orm/better-sqlite3",
  "drizzle-orm/sqlite-core",
  "lucide-react",
  "@radix-ui/react-popover",
  "@radix-ui/react-slot",
  "sonner",
  "ai",
  "@ai-sdk/openai-compatible",
  "ai/test",
  "clsx",
  "class-variance-authority",
  "tailwind-merge",
  "recharts",
];

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({ server: { entry: "server" } }),
    viteReact(),
    nitro({
      preset: "node-server",
      buildDir: NITRO_BUILD_DIR,
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
  environments: {
    ssr: {
      build: {
        rollupOptions: {
          external: SSR_EXTERNAL,
        },
      },
    },
    nitro: {
      build: {
        rollupOptions: {
          external: NITRO_EXTERNAL,
        },
      },
    },
  },
});
