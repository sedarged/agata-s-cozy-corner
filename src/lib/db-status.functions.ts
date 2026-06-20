import { createServerFn } from "@tanstack/react-start";

export type StorageHealth = {
  ok: boolean;
  nodeVersion: string;
  platform: string;
  uptime: number;
  timestamp: string;
};

export const getStorageHealth = createServerFn({ method: "POST" }).handler(
  async (): Promise<StorageHealth> => {
    return {
      ok: true,
      nodeVersion: process.version,
      platform: process.platform,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  },
);
