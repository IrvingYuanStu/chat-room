/**
 * Type declarations for zookeeper module
 */

declare module 'zookeeper' {
  export const ErrorCode: {
    NODEEXISTS: number;
    NONODE: number;
    [key: string]: number;
  };

  export const CreateMode: {
    PERSISTENT: number;
    EPHEMERAL: number;
    [key: string]: number;
  };

  export const ZooKeeperLogLevel: {
    ERROR: number;
    WARN: number;
    INFO: number;
    DEBUG: number;
    [key: string]: number;
  };

  export interface ClientOptions {
    connect: string;
    timeout?: number;
    debug_level?: number;
    host_order_deterministic?: boolean;
  }

  export interface Stat {
    exists: boolean;
    czxid?: number;
    mzxid?: number;
    ctime?: number;
    mtime?: number;
    version?: number;
    children_count?: number;
  }

  export interface ZooKeeperClient {
    on(event: 'connected' | 'disconnected' | 'expired', callback: () => void): void;
    connect(addresses: string, timeout: number, callback: (err: Error | null) => void): void;
    close(callback: () => void): void;
    waitUntilConnected(callback: (err: Error | null) => void): void;
    create(path: string, data: string, flags: number, callback: (err: Error | null, path: string) => void): void;
    exists(path: string, watch: boolean | null, callback: (err: Error | null, stat: Stat | null) => void): void;
    get(path: string, watch: boolean | null, callback: (err: Error | null, data: string, stat: Stat | null) => void): void;
    set(path: string, data: string, version: number, callback: (err: Error | null) => void): void;
    remove(path: string, version: number, callback: (err: Error | null) => void): void;
    getChildren(path: string, watch: boolean | null, callback: (err: Error | null, children: string[]) => void): void;
  }

  export function createClient(options: ClientOptions | string): ZooKeeperClient;

  export class MockError {
    constructor(code: number);
    getCode(): number;
  }
}
