/**
 * ConfigService - Configuration management service
 * M1.5: Load, save, and manage application configuration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { Config } from './types';

interface ConfigServiceOptions {
  configPath?: string;
}

const DEFAULT_CONFIG: Omit<Config, 'nickname' | 'currentRoomId' | 'recentRooms'> & {
  nickname?: string;
  currentRoomId?: string;
  recentRooms?: string[];
} = {
  zkAddresses: ['127.0.0.1:2181'],
  currentRoomId: '',
  nickname: undefined, // Will be generated
  recentRooms: [],
  port: 9001,
  dataDir: '/tmp/chat-room',
  logDir: '/tmp/chat-room/logs',
  logLevel: 'info'
};

function generateDefaultNickname(): string {
  const randomNum = Math.floor(100 + Math.random() * 900); // 100-999
  return `User${randomNum}`;
}

export class ConfigService {
  private configPath: string;
  private config: Config | null = null;

  constructor(options: ConfigServiceOptions = {}) {
    // Resolve the config path, expanding ~ to home directory
    const resolvedPath = options.configPath
      ? path.resolve(options.configPath.replace(/^~/, process.env.HOME || ''))
      : path.resolve(process.env.HOME || '', '.chat-room', 'config.json');

    this.configPath = resolvedPath;
  }

  /**
   * Load configuration from file
   * Returns default config if file doesn't exist or is invalid
   */
  async load(): Promise<Config> {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(content);

        // Merge with defaults for missing fields
        this.config = this.mergeWithDefaults(parsed);
      } else {
        // Return default config if file doesn't exist
        this.config = this.getDefaultConfig();
      }
    } catch (error) {
      // If JSON is malformed or any other error, return defaults
      this.config = this.getDefaultConfig();
    }

    return this.config;
  }

  /**
   * Save configuration to file
   * @param config - Full or partial config to save
   */
  async save(config: Partial<Config>): Promise<void> {
    // Load current config if not already loaded
    if (this.config === null) {
      await this.load();
    }

    // Merge partial config with existing (filter out undefined values)
    const mergedConfig: Config = {
      ...this.config!,
      ...Object.fromEntries(
        Object.entries(config).filter(([, v]) => v !== undefined)
      )
    };

    // Ensure parent directory exists
    const parentDir = path.dirname(this.configPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Write to file
    fs.writeFileSync(
      this.configPath,
      JSON.stringify(mergedConfig, null, 2),
      'utf-8'
    );

    // Update internal state
    this.config = mergedConfig;
  }

  /**
   * Get a single configuration value
   * @param key - Configuration key
   */
  get<K extends keyof Config>(key: K): Config[K] {
    if (this.config === null) {
      throw new Error('Config not loaded. Call load() first.');
    }
    return this.config[key];
  }

  /**
   * Set a single configuration value and persist
   * @param key - Configuration key
   * @param value - New value
   */
  async set<K extends keyof Config>(key: K, value: Config[K]): Promise<void> {
    if (this.config === null) {
      await this.load();
    }

    await this.save({ [key]: value });
  }

  /**
   * Get the configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Interactive configuration prompt
   * @param zkAddresses - Pre-provided ZK addresses (optional)
   * @returns Promise resolving to configured Config
   */
  async promptConfig(zkAddresses?: string): Promise<Config> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (prompt: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
          resolve(answer.trim());
        });
      });
    };

    let config: Config;

    // Load existing config if available
    try {
      config = await this.load();
    } catch {
      config = this.getDefaultConfig();
    }

    // If zkAddresses provided, use them; otherwise prompt
    if (!zkAddresses) {
      const existingZk = config.zkAddresses.join(', ');
      const zkInput = await question(`ZooKeeper addresses (default: ${existingZk}): `);
      if (zkInput) {
        config.zkAddresses = zkInput.split(',').map((s) => s.trim()).filter(Boolean);
      }
    } else {
      config.zkAddresses = zkAddresses.split(',').map((s) => s.trim()).filter(Boolean);
    }

    // Prompt for nickname
    const nicknameInput = await question(`Nickname (default: ${config.nickname}): `);
    if (nicknameInput) {
      config.nickname = nicknameInput;
    }

    rl.close();

    // Save the configuration
    await this.save(config);

    return config;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): Config {
    return {
      ...DEFAULT_CONFIG,
      nickname: generateDefaultNickname(),
      recentRooms: []
    } as Config;
  }

  /**
   * Merge parsed config with defaults
   */
  private mergeWithDefaults(parsed: Record<string, unknown>): Config {
    const defaults = this.getDefaultConfig();

    return {
      zkAddresses: Array.isArray(parsed.zkAddresses)
        ? parsed.zkAddresses
        : defaults.zkAddresses,
      currentRoomId: typeof parsed.currentRoomId === 'string'
        ? parsed.currentRoomId
        : defaults.currentRoomId,
      nickname: typeof parsed.nickname === 'string' && parsed.nickname
        ? parsed.nickname
        : defaults.nickname,
      recentRooms: Array.isArray(parsed.recentRooms)
        ? parsed.recentRooms
        : defaults.recentRooms,
      port: typeof parsed.port === 'number' ? parsed.port : defaults.port,
      dataDir: typeof parsed.dataDir === 'string' ? parsed.dataDir : defaults.dataDir,
      logDir: typeof parsed.logDir === 'string' ? parsed.logDir : defaults.logDir,
      logLevel: ['debug', 'info', 'warn', 'error'].includes(parsed.logLevel as string)
        ? parsed.logLevel as Config['logLevel']
        : defaults.logLevel
    };
  }
}
