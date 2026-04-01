import net from "node:net";
import type { PeerAddress, UserId } from "../services/types.js";
import { PeerConnection } from "./PeerConnection.js";

export class P2PClient {
  private localUserId: UserId;
  private localNickname: string;
  private localRoomId: string;
  private localAddress: PeerAddress;

  constructor(
    localUserId: UserId,
    localNickname: string,
    localRoomId: string,
    localAddress: PeerAddress,
  ) {
    this.localUserId = localUserId;
    this.localNickname = localNickname;
    this.localRoomId = localRoomId;
    this.localAddress = localAddress;
  }

  async connect(address: PeerAddress): Promise<PeerConnection> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();

      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Connection timeout to ${address.ip}:${address.port}`));
      }, 10_000);

      socket.connect(address.port, address.ip, () => {
        clearTimeout(timeout);

        const connection = new PeerConnection(
          socket,
          this.localUserId,
          this.localNickname,
          this.localRoomId,
          this.localAddress,
        );

        resolve(connection);
      });

      socket.once("error", (err: Error) => {
        clearTimeout(timeout);
        socket.destroy();
        reject(err);
      });
    });
  }

  async connectWithRetry(
    address: PeerAddress,
    maxRetries: number = 3,
    baseInterval: number = 1000,
  ): Promise<PeerConnection> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.connect(address);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = baseInterval * Math.pow(2, attempt);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError || new Error(`Failed to connect to ${address.ip}:${address.port} after ${maxRetries} retries`);
  }
}
