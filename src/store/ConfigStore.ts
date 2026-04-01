import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { AppConfig } from "../services/types.js";

export class ConfigStore {
  private readonly configPath: string;

  constructor() {
    this.configPath = path.join(os.homedir(), ".chat-room", "config.json");
  }

  getConfigPath(): string {
    return this.configPath;
  }

  load(): AppConfig | null {
    try {
      const raw = fs.readFileSync(this.configPath, "utf-8");
      return JSON.parse(raw) as AppConfig;
    } catch (err: unknown) {
      if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw err;
    }
  }

  save(config: AppConfig): void {
    const dir = path.dirname(this.configPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf-8");
  }
}
