import { createServerFn } from "@tanstack/react-start";

export type ServerHealth = {
  ok: boolean;
  nodeVersion: string;
  platform: string;
  uptime: number;
  timestamp: string;
};

export const getServerHealth = createServerFn({ method: "POST" }).handler(
  async (): Promise<ServerHealth> => {
    return {
      ok: true,
      nodeVersion: process.version,
      platform: process.platform,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  },
);
