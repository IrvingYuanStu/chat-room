import { createClient, CreateMode } from "node-zookeeper-client";
import type { Client } from "node-zookeeper-client";
import type { Member, MemberInfo } from "../services/types.js";

const BASE_PATH = "/libra-regions";

export type ZKState = "connected" | "disconnected" | "expired";

type StateChangeCallback = (state: ZKState) => void;
type MembersCallback = (members: Member[]) => void;

function promisify<T>(
  fn: (cb: (err: Error | null, result?: T) => void) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((err, result) => {
      if (err) reject(err);
      else resolve(result as T);
    });
  });
}

export class ZKClient {
  private client: Client | null = null;
  private state: ZKState = "disconnected";
  private stateChangeCallbacks: StateChangeCallback[] = [];
  private addresses: string[] = [];
  private currentRoomId: string | null = null;
  private currentMemberInfo: MemberInfo | null = null;
  private membersCallback: MembersCallback | null = null;
  private membersWatcherSet = false;

  async connect(addresses: string[]): Promise<void> {
    this.addresses = addresses;

    return new Promise((resolve, reject) => {
      const connectionString = addresses.join(",");
      this.client = createClient(connectionString);

      this.client!.on("connected", () => {
        this.state = "connected";
        this.notifyStateChange();
        resolve(undefined);
      });

      this.client!.on("disconnected", () => {
        this.state = "disconnected";
        this.notifyStateChange();
      });

      this.client!.on("expired", () => {
        this.state = "expired";
        this.notifyStateChange();
      });

      this.client!.on("error", () => {
        if (this.state === "disconnected") {
          reject(new Error("ZooKeeper connection error"));
        }
      });

      this.client!.connect();
    });
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    this.currentRoomId = null;
    this.currentMemberInfo = null;
    this.membersCallback = null;
    this.membersWatcherSet = false;

    return new Promise((resolve) => {
      // Suppress NO_NODE errors during disconnect
      const errorHandler = (err: any) => {
        if (err && err.code !== -101) {
          console.error("ZK error during disconnect:", err);
        }
      };
      // Use type assertion to bypass type checking for error event
      (this.client! as any).on("error", errorHandler);

      this.client!.close();
      this.client = null;
      this.state = "disconnected";
      this.notifyStateChange();
      resolve(undefined);
    });
  }

  isConnected(): boolean {
    return this.state === "connected";
  }

  getState(): ZKState {
    return this.state;
  }

  onStateChange(callback: StateChangeCallback): void {
    this.stateChangeCallbacks.push(callback);
  }

  private notifyStateChange(): void {
    for (const cb of this.stateChangeCallbacks) {
      try { cb(this.state); } catch { /* ignore */ }
    }
  }

  async ensureBasePath(): Promise<void> {
    await this.mkdirp(BASE_PATH);
  }

  async listRooms(): Promise<string[]> {
    try {
      return await this.getChildren(BASE_PATH);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "NO_NODE") {
        return [];
      }
      throw err;
    }
  }

  async createRoom(roomId: string): Promise<void> {
    const roomPath = `${BASE_PATH}/${roomId}`;
    const membersPath = `${roomPath}/members`;
    await this.mkdirp(roomPath);
    await this.mkdirp(membersPath);
  }

  async joinRoom(roomId: string, memberInfo: MemberInfo): Promise<void> {
    if (!this.client) {
      throw new Error("ZooKeeper client is not connected");
    }

    const membersPath = `${BASE_PATH}/${roomId}/members`;
    await this.mkdirp(membersPath);

    const data = Buffer.from(JSON.stringify(memberInfo), "utf-8");
    const nodePath = `${membersPath}/${memberInfo.nickname}`;

    await promisify<void>((cb) => {
      this.client!.create(nodePath, data, CreateMode.EPHEMERAL, (err) => cb(err as Error | null));
    });

    this.currentRoomId = roomId;
    this.currentMemberInfo = memberInfo;
  }

  async leaveRoom(roomId: string, nickname: string): Promise<void> {
    if (!this.client) {
      throw new Error("ZooKeeper client is not connected");
    }

    const nodePath = `${BASE_PATH}/${roomId}/members/${nickname}`;

    try {
      await promisify<void>((cb) => {
        this.client!.remove(nodePath, (err) => cb(err as Error | null));
      });
      this.currentRoomId = null;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "NO_NODE") {
        return; // Already gone
      }
      throw err;
    }
  }

  async updateMember(roomId: string, nickname: string, data: string): Promise<void> {
    if (!this.client) {
      throw new Error("ZooKeeper client is not connected");
    }

    const nodePath = `${BASE_PATH}/${roomId}/members/${nickname}`;
    const dataBuffer = Buffer.from(data, "utf-8");

    await promisify<void>((cb) => {
      this.client!.setData(nodePath, dataBuffer, (err) => cb(err as Error | null));
    });

    if (this.currentMemberInfo) {
      this.currentMemberInfo = JSON.parse(data) as MemberInfo;
    }
  }

  async getRoomMembers(roomId: string): Promise<Member[]> {
    const membersPath = `${BASE_PATH}/${roomId}/members`;

    let children: string[];
    try {
      children = await this.getChildren(membersPath);
      console.log(`[ZKClient] getRoomMembers for ${roomId}: found ${children.length} children: ${children.join(", ")}`);
    } catch (err) {
      console.error(`[ZKClient] getRoomMembers for ${roomId} failed:`, err);
      return [];
    }

    if (children.length === 0) {
      console.log(`[ZKClient] getRoomMembers for ${roomId}: no members found`);
      return [];
    }

    const members: Member[] = [];
    for (const child of children) {
      const data = await this.getNodeData(`${membersPath}/${child}`);
      if (data) {
        members.push({
          userId: child,
          nickname: data.nickname,
          status: data.status,
          address: { ip: data.ip, port: data.port },
          joinedAt: 0,
        });
      }
    }

    return members;
  }

  watchMembers(roomId: string, callback: MembersCallback): void {
    console.log(`[ZKClient] watchMembers called for room: ${roomId}`);
    this.membersCallback = callback;
    this.membersWatcherSet = false;
    this.setupMembersWatcher(roomId);

    // Immediately fetch initial members
    this.getRoomMembers(roomId)
      .then((members) => {
        console.log(`[ZKClient] Initial members fetched for ${roomId}:`, members.map(m => m.nickname));
        if (this.membersCallback) {
          this.membersCallback(members);
        }
      })
      .catch((err) => {
        console.error("[ZKClient] Failed to fetch initial members:", err);
      });
  }

  async reconnect(): Promise<void> {
    if (this.state === "connected") return;

    if (this.client) {
      try { await this.disconnect(); } catch { /* ignore */ }
    }

    await this.connect(this.addresses);
    await this.ensureBasePath();

    if (this.currentRoomId && this.currentMemberInfo) {
      await this.joinRoom(this.currentRoomId, this.currentMemberInfo);
      if (this.membersCallback) {
        this.watchMembers(this.currentRoomId, this.membersCallback);
      }
    }
  }

  // ===== Internal helpers =====

  private mkdirp(zkPath: string): Promise<void> {
    if (!this.client) {
      return Promise.reject(new Error("ZooKeeper client is not connected"));
    }
    return promisify<void>((cb) => {
      this.client!.mkdirp(zkPath, (err) => cb(err as Error | null));
    });
  }

  private getChildren(zkPath: string): Promise<string[]> {
    if (!this.client) {
      return Promise.reject(new Error("ZooKeeper client is not connected"));
    }
    return promisify<string[]>((cb) => {
      this.client!.getChildren(zkPath, (err, children) => {
        if (err) cb(err as Error | null);
        else cb(null, children || []);
      });
    });
  }

  private getNodeData(nodePath: string): Promise<MemberInfo | null> {
    if (!this.client) {
      return Promise.reject(new Error("ZooKeeper client is not connected"));
    }
    return promisify<Buffer | null>((cb) => {
      this.client!.getData(nodePath, (err, data) => {
        if (err) {
          if ((err as NodeJS.ErrnoException).code === "NO_NODE") {
            cb(null, null);
            return;
          }
          cb(err as Error | null);
          return;
        }
        cb(null, data);
      });
    }).then((data) => {
      if (!data) return null;
      try {
        return JSON.parse(data.toString("utf-8")) as MemberInfo;
      } catch {
        return null;
      }
    });
  }

  private setupMembersWatcher(roomId: string): void {
    const membersPath = `${BASE_PATH}/${roomId}/members`;

    const watcher = () => {
      this.membersWatcherSet = false;
      if (this.membersCallback) {
        this.getRoomMembers(roomId)
          .then((members) => {
            if (this.membersCallback) {
              this.membersCallback(members);
            }
            this.setupMembersWatcher(roomId);
          })
          .catch(() => {
            setTimeout(() => this.setupMembersWatcher(roomId), 1000);
          });
      }
    };

    if (!this.membersWatcherSet && this.client && this.state === "connected") {
      this.membersWatcherSet = true;
      this.client.getChildren(membersPath, watcher, () => {
        // Ignore initial callback errors
      });
    }
  }
}
