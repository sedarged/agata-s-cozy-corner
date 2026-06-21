// Agata — assets repository. Metadata lives in the DB; bytes are written to
// $DATA_DIR/assets/<id>.<ext> by the server route.
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getDb, getDataDir } from "../client";
import { assets } from "../schema";
import type { AssetRow } from "../types";

const nowIso = () => new Date().toISOString();

function assetsDir() {
  return join(getDataDir(), "assets");
}

function ensureAssetsDir() {
  mkdirSync(assetsDir(), { recursive: true });
}

export async function listAssets(): Promise<AssetRow[]> {
  return getDb().select().from(assets).all() as AssetRow[];
}

export async function getAsset(id: string): Promise<AssetRow | undefined> {
  return getDb().select().from(assets).where(eq(assets.id, id)).get() as AssetRow | undefined;
}

export interface AssetInput {
  id: string;
  filename: string;
  mime: string;
  bytes: Buffer;
}

export async function putAsset(input: AssetInput): Promise<AssetRow> {
  ensureAssetsDir();
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const existing = getDb().select().from(assets).where(eq(assets.sha256, sha256)).get() as
    | AssetRow
    | undefined;
  if (existing) return existing;

  const ext = (input.filename.split(".").pop() || "bin").slice(0, 16);
  const path = join(assetsDir(), `${input.id}.${ext}`);
  writeFileSync(path, input.bytes);
  const row: AssetRow = {
    id: input.id,
    filename: input.filename,
    mime: input.mime,
    bytes: input.bytes.length,
    sha256,
    createdAt: nowIso(),
  };
  getDb()
    .insert(assets)
    .values(row)
    .onConflictDoUpdate({
      target: assets.id,
      set: { filename: row.filename, mime: row.mime, bytes: row.bytes, sha256: row.sha256 },
    })
    .run();
  return row;
}

export async function readAssetBytes(
  id: string,
): Promise<{ row: AssetRow; bytes: Buffer } | undefined> {
  const row = await getAsset(id);
  if (!row) return undefined;
  const ext = row.filename.split(".").pop() || "bin";
  const path = join(assetsDir(), `${row.id}.${ext}`);
  if (!existsSync(path)) return undefined;
  return { row, bytes: readFileSync(path) };
}

export async function deleteAsset(id: string): Promise<boolean> {
  const row = await getAsset(id);
  if (!row) return false;
  const ext = row.filename.split(".").pop() || "bin";
  try {
    const path = join(assetsDir(), `${row.id}.${ext}`);
    if (existsSync(path)) {
      // unlinkSync would be cleaner; leaving import surface narrow for now.
      const { unlinkSync } = await import("node:fs");
      unlinkSync(path);
    }
  } catch {
    /* ignore — metadata delete is what counts */
  }
  const res = getDb().delete(assets).where(eq(assets.id, id)).run();
  return res.changes > 0;
}
