// Drizzle Kit — generates SQL migrations from src/lib/db/schema.ts.
// Run via the npm script `db:generate` / `db:migrate` defined in package.json.
import { defineConfig } from "drizzle-kit";

const dataDir = process.env.DATA_DIR || "./.agata-data";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: `${dataDir}/agata.db`,
  },
  verbose: true,
  strict: true,
});