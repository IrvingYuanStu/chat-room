import { v4 as uuidv4 } from "uuid";
import type { AppConfig, UserId } from "./types.js";
import { ConfigStore } from "../store/ConfigStore.js";

export class ConfigService {
  private config: AppConfig | null = null;
  private store: ConfigStore;

  constructor(store?: ConfigStore) {
    this.store = store || new ConfigStore();
  }

  /**
   * Load config from store
   */
  async load(): Promise<AppConfig | null> {
    try {
      this.config = this.store.load();
      return this.config;
    } catch (err) {
      console.warn("Failed to load config, will reset:", err);
      return null;
    }
  }

  /**
   * Save current config to store
   */
  async save(): Promise<void> {
    if (!this.config) {
      throw new Error("No config to save");
    }
    this.store.save(this.config);
  }

  /**
   * Initialize config on first run
   */
  async init(zkAddresses: string[], nickname: string): Promise<AppConfig> {
    const config: AppConfig = {
      userId: uuidv4() as UserId,
      nickname,
      zkAddresses,
      p2pPort: 9001,
      currentRoomId: null,
      recentRooms: [],
    };

    this.config = config;
    await this.save();
    return config;
  }

  /**
   * Get current config
   */
  getConfig(): AppConfig | null {
    return this.config;
  }

  /**
   * Get user ID
   */
  getUserId(): UserId {
    if (!this.config) {
      throw new Error("Config not loaded");
    }
    return this.config.userId;
  }

  /**
   * Get nickname
   */
  getNickname(): string {
    if (!this.config) {
      throw new Error("Config not loaded");
    }
    return this.config.nickname;
  }

  /**
   * Get ZooKeeper addresses
   */
  getZkAddresses(): string[] {
    if (!this.config) {
      throw new Error("Config not loaded");
    }
    return this.config.zkAddresses;
  }

  /**
   * Get P2P port
   */
  getP2pPort(): number {
    if (!this.config) {
      throw new Error("Config not loaded");
    }
    return this.config.p2pPort;
  }

  /**
   * Get current room ID
   */
  getCurrentRoomId(): string | null {
    return this.config?.currentRoomId ?? null;
  }

  /**
   * Get recent rooms
   */
  getRecentRooms(): string[] {
    return this.config?.recentRooms ?? [];
  }

  /**
   * Update nickname
   */
  async updateNickname(newNickname: string): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }
    this.config.nickname = newNickname;
    await this.save();
  }

  /**
   * Update current room ID
   */
  async updateCurrentRoom(roomId: string | null): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }
    this.config.currentRoomId = roomId;
    await this.save();
  }

  /**
   * Add room to recent rooms list
   */
  async addRecentRoom(roomId: string): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    // Remove if already exists
    const index = this.config.recentRooms.indexOf(roomId);
    if (index !== -1) {
      this.config.recentRooms.splice(index, 1);
    }

    // Add to front
    this.config.recentRooms.unshift(roomId);

    // Keep only last 10
    if (this.config.recentRooms.length > 10) {
      this.config.recentRooms = this.config.recentRooms.slice(0, 10);
    }

    await this.save();
  }

  /**
   * Remove room from recent rooms list
   */
  async removeRecentRoom(roomId: string): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const index = this.config.recentRooms.indexOf(roomId);
    if (index !== -1) {
      this.config.recentRooms.splice(index, 1);
      await this.save();
    }
  }
}
