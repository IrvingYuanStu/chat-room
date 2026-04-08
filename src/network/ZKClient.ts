import zookeeper, { Client, CreateMode } from 'node-zookeeper-client';
import { EventBus, getEventBus } from '../services/EventBus';
import { Member, MemberNodeData } from '../services/types';
import { Logger, getLogger } from '../utils/logger';

// ZooKeeper constants
const ZK_ROOT_PATH = '/libra-regions';
const ZK_MEMBERS_PATH = '/members';
const RECONNECT_INTERVAL = 5000; // 5 seconds

export interface ZKClientOptions {
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// Re-export types for external use
export type { Member, MemberNodeData };

/**
 * ZooKeeper Client for Chat Room node registration and discovery
 */
export class ZKClient {
  private client: Client | null = null;
  private addresses: string[] = [];
  private isConnectedFlag: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private eventBus: EventBus;
  private logger: Logger;
  private memberWatchers: Map<string, Set<(members: Member[]) => void>> = new Map();
  private roomWatcher: ((rooms: string[]) => void) | null = null;

  constructor(options: ZKClientOptions = {}) {
    this.eventBus = getEventBus();
    // Use a default logger if no logger is initialized
    try {
      this.logger = getLogger();
    } catch {
      // Create a temporary logger for initialization
      this.logger = new Logger({
        logDir: '/tmp/chat-room/logs',
        logLevel: options.logLevel || 'info',
        module: 'ZKClient'
      });
    }
  }

  /**
   * Connect to ZooKeeper server(s)
   */
  async connect(addresses: string[]): Promise<void> {
    this.addresses = addresses;
    const connectionString = addresses.join(',');

    return new Promise<void>((resolve, reject) => {
      try {
        this.client = zookeeper.createClient(connectionString, {
          sessionTimeout: 10000,
          spinDelay: 1000,
          retries: 3
        });

        // Set up event handlers using proper event names
        this.client.on('connected', () => {
          this.logger.info('ZooKeeper connected');
          this.isConnectedFlag = true;
          this.eventBus.publish('zk_connected', undefined);
          resolve();
        });

        this.client.on('disconnected', () => {
          this.logger.warn('ZooKeeper disconnected');
          this.isConnectedFlag = false;
          this.eventBus.publish('zk_disconnected', undefined);
          this.scheduleReconnect();
        });

        this.client.on('expired', () => {
          this.logger.warn('ZooKeeper session expired');
          this.eventBus.publish('zk_session_expired', undefined);
          this.scheduleReconnect();
        });

        // Attempt connection
        this.client.connect();

        // The client connects asynchronously, but we need to wait
        // We'll use a timeout as a fallback
        const timeout = setTimeout(() => {
          if (!this.isConnectedFlag) {
            reject(new Error('ZooKeeper connection timeout'));
          }
        }, 10000);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        this.logger.info('Attempting ZooKeeper reconnection...');
        await this.connect(this.addresses);
        this.eventBus.publish('zk_reconnected', undefined);
        this.logger.info('ZooKeeper reconnected successfully');
      } catch (err) {
        this.logger.warn('Reconnection failed, will retry...');
        this.scheduleReconnect();
      }
    }, RECONNECT_INTERVAL);
  }

  /**
   * Disconnect from ZooKeeper
   */
  async disconnect(): Promise<void> {
    // Clear any pending reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (!this.client) {
      return;
    }

    return new Promise<void>((resolve) => {
      this.client!.close();
      this.isConnectedFlag = false;
      this.client = null;
      resolve();
    });
  }

  /**
   * Check if connected to ZooKeeper
   */
  isConnected(): boolean {
    return this.isConnectedFlag;
  }

  /**
   * Ensure root node exists
   */
  async ensureRootNode(): Promise<void> {
    if (!this.client || !this.isConnectedFlag) {
      throw new Error('Not connected to ZooKeeper');
    }

    return new Promise<void>((resolve, reject) => {
      this.client!.exists(
        ZK_ROOT_PATH,
        (err: Error | zookeeper.Exception | null, stat: zookeeper.Stat) => {
          if (err) {
            reject(err);
            return;
          }

          if (stat) {
            // Root node exists (stat is non-null when node exists)
            resolve();
            return;
          }

          // Create root node - use Buffer.from for data
          this.client!.create(
            ZK_ROOT_PATH,
            Buffer.from(''),
            CreateMode.PERSISTENT,
            (createErr: Error | zookeeper.Exception | null) => {
              if (createErr) {
                // Node might already exist (race condition)
                if (createErr instanceof zookeeper.Exception &&
                    createErr.code === zookeeper.Exception.NODE_EXISTS) {
                  resolve();
                  return;
                }
                reject(createErr);
                return;
              }
              resolve();
            }
          );
        }
      );
    });
  }

  /**
   * Create a member node (ephemeral) for registration
   */
  async createMemberNode(roomId: string, data: MemberNodeData): Promise<string> {
    if (!this.client || !this.isConnectedFlag) {
      throw new Error('Not connected to ZooKeeper');
    }

    // Ensure root and room paths exist
    await this.ensureRootNode();
    await this.ensureRoomPath(roomId);

    const path = `${ZK_ROOT_PATH}/${roomId}${ZK_MEMBERS_PATH}/${data.userId}`;

    return new Promise<string>((resolve, reject) => {
      this.client!.create(
        path,
        Buffer.from(JSON.stringify(data)),
        CreateMode.EPHEMERAL,
        (err: Error | zookeeper.Exception | null, createdPath: string) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(createdPath);
        }
      );
    });
  }

  /**
   * Ensure room path exists
   */
  private async ensureRoomPath(roomId: string): Promise<void> {
    const roomPath = `${ZK_ROOT_PATH}/${roomId}`;
    const membersPath = `${roomPath}${ZK_MEMBERS_PATH}`;

    return new Promise<void>((resolve, reject) => {
      this.client!.exists(roomPath, (err: Error | zookeeper.Exception | null, stat: zookeeper.Stat) => {
        if (err) {
          reject(err);
          return;
        }

        if (!stat) {
          // Create room node
          this.client!.create(
            roomPath,
            Buffer.from(''),
            CreateMode.PERSISTENT,
            (createErr: Error | zookeeper.Exception | null) => {
              if (createErr) {
                // Node might already exist (race condition)
                if (!(createErr instanceof zookeeper.Exception) ||
                    createErr.code !== zookeeper.Exception.NODE_EXISTS) {
                  reject(createErr);
                  return;
                }
              }
              // Now create members path
              this.client!.create(
                membersPath,
                Buffer.from(''),
                CreateMode.PERSISTENT,
                (membersErr: Error | zookeeper.Exception | null) => {
                  if (membersErr) {
                    // Node might already exist (race condition)
                    if (!(membersErr instanceof zookeeper.Exception) ||
                        membersErr.code !== zookeeper.Exception.NODE_EXISTS) {
                      reject(membersErr);
                      return;
                    }
                  }
                  resolve();
                }
              );
            }
          );
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Delete a member node
   */
  async deleteMemberNode(roomId: string, userId: string): Promise<void> {
    if (!this.client || !this.isConnectedFlag) {
      throw new Error('Not connected to ZooKeeper');
    }

    const path = `${ZK_ROOT_PATH}/${roomId}${ZK_MEMBERS_PATH}/${userId}`;

    return new Promise<void>((resolve, reject) => {
      this.client!.remove(path, (err: Error | zookeeper.Exception | null) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Update member node data
   */
  async setMemberData(roomId: string, userId: string, data: MemberNodeData): Promise<void> {
    if (!this.client || !this.isConnectedFlag) {
      throw new Error('Not connected to ZooKeeper');
    }

    const path = `${ZK_ROOT_PATH}/${roomId}${ZK_MEMBERS_PATH}/${userId}`;

    return new Promise<void>((resolve, reject) => {
      this.client!.setData(path, Buffer.from(JSON.stringify(data)), (err: Error | zookeeper.Exception | null) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Get members of a room
   */
  async getMembers(roomId: string): Promise<Member[]> {
    if (!this.client || !this.isConnectedFlag) {
      throw new Error('Not connected to ZooKeeper');
    }

    const membersPath = `${ZK_ROOT_PATH}/${roomId}${ZK_MEMBERS_PATH}`;

    return new Promise<Member[]>((resolve, reject) => {
      this.client!.getChildren(membersPath, (err: Error | zookeeper.Exception | null, children: string[]) => {
        if (err) {
          // No members or path doesn't exist
          if (err instanceof zookeeper.Exception && err.code === zookeeper.Exception.NO_NODE) {
            resolve([]);
            return;
          }
          reject(err);
          return;
        }

        if (!children || children.length === 0) {
          resolve([]);
          return;
        }

        // Get data for each member
        const memberPromises = children.map((childId: string): Promise<Member | null> => {
          return new Promise<Member | null>((res) => {
            if (!this.client) {
              res(null);
              return;
            }
            const childPath = `${membersPath}/${childId}`;
            this.client.getData(childPath, (getErr: Error | zookeeper.Exception | null, data: Buffer) => {
              if (getErr || !data) {
                res(null);
                return;
              }

              try {
                const nodeData: MemberNodeData = JSON.parse(data.toString());
                const member: Member = {
                  userId: nodeData.userId,
                  nickname: nodeData.nickname,
                  status: nodeData.status,
                  ip: nodeData.ip,
                  port: nodeData.port,
                  joinedAt: nodeData.joinedAt
                };
                res(member);
              } catch {
                res(null);
              }
            });
          });
        });

        Promise.all(memberPromises).then((members) => {
          resolve(members.filter((m): m is Member => m !== null));
        });
      });
    });
  }

  /**
   * List all rooms
   */
  async listRooms(): Promise<string[]> {
    if (!this.client || !this.isConnectedFlag) {
      throw new Error('Not connected to ZooKeeper');
    }

    return new Promise<string[]>((resolve, reject) => {
      // First ensure root exists
      this.client!.exists(ZK_ROOT_PATH, (err: Error | zookeeper.Exception | null, stat: zookeeper.Stat) => {
        if (err) {
          reject(err);
          return;
        }

        if (!stat) {
          resolve([]);
          return;
        }

        this.client!.getChildren(ZK_ROOT_PATH, (listErr: Error | zookeeper.Exception | null, children: string[]) => {
          if (listErr) {
            reject(listErr);
            return;
          }
          resolve(children || []);
        });
      });
    });
  }

  /**
   * Watch for member changes in a room
   * Supports multiple watchers per room - all callbacks will be notified on changes
   */
  watchMembers(roomId: string, callback: (members: Member[]) => void): void {
    if (!this.client || !this.isConnectedFlag) {
      throw new Error('Not connected to ZooKeeper');
    }

    const membersPath = `${ZK_ROOT_PATH}/${roomId}${ZK_MEMBERS_PATH}`;

    // Add callback to set (avoids duplicates)
    if (!this.memberWatchers.has(roomId)) {
      this.memberWatchers.set(roomId, new Set());
    }
    this.memberWatchers.get(roomId)!.add(callback);

    // Set up a watch on the members path
    const watchCallback = () => {
      if (!this.client || !this.isConnectedFlag) {
        return;
      }

      this.getMembers(roomId)
        .then((members) => {
          if (!this.client || !this.isConnectedFlag) {
            return;
          }
          // Notify all watchers for this room
          const watchers = this.memberWatchers.get(roomId);
          if (watchers) {
            watchers.forEach((watcher) => {
              try {
                watcher(members);
              } catch (err) {
                this.logger.error('Error in member watcher:', err);
              }
            });
          }
          // Re-watch for future changes
          this.watchMembers(roomId, callback);
        })
        .catch((err: Error) => {
          this.logger.error('Error watching members:', err);
        });
    };

    // Initial fetch and watch with watcher
    this.client.getChildren(membersPath, (err: Error | zookeeper.Exception | null, _children: string[]) => {
      if (err) {
        this.logger.error('Error setting up member watch:', err);
        return;
      }
      watchCallback();
    });
  }

  /**
   * Watch for room list changes
   */
  watchRooms(callback: (rooms: string[]) => void): void {
    if (!this.client || !this.isConnectedFlag) {
      throw new Error('Not connected to ZooKeeper');
    }

    this.roomWatcher = callback;

    const watchCallback = () => {
      if (!this.client || !this.isConnectedFlag) {
        return;
      }

      this.listRooms()
        .then((rooms) => {
          if (!this.client || !this.isConnectedFlag) {
            return;
          }
          if (this.roomWatcher) {
            this.roomWatcher(rooms);
          }
          // Re-watch for future changes
          this.watchRooms(callback);
        })
        .catch((err: Error) => {
          this.logger.error('Error watching rooms:', err);
        });
    };

    // Initial fetch and watch
    this.client.getChildren(ZK_ROOT_PATH, (err: Error | zookeeper.Exception | null, _children: string[]) => {
      if (err) {
        this.logger.error('Error setting up room watch:', err);
        return;
      }
      watchCallback();
    });
  }

  /**
   * Stop watching members for a room
   */
  stopWatchingMembers(roomId: string): void {
    this.memberWatchers.delete(roomId);
  }

  /**
   * Stop watching rooms
   */
  stopWatchingRooms(): void {
    this.roomWatcher = null;
  }
}
