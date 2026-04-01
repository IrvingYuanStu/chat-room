import net from "node:net";
import type { Server } from "node:net";
import { PeerConnection } from "./PeerConnection.js";
import type { PeerAddress, UserId } from "../services/types.js";

type ConnectionCallback = (connection: PeerConnection) => void;

const PORT_MIN = 9001;
const PORT_MAX = 9010;

export class P2PServer {
  private server: Server | null = null;
  private port: number = PORT_MIN;
  private connectionCallback: ConnectionCallback | null = null;
  private activeConnections: PeerConnection[] = [];

  // Local peer info for creating PeerConnection instances
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

  start(port: number = PORT_MIN): Promise<number> {
    this.port = port;

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        const connection = new PeerConnection(
          socket,
          this.localUserId,
          this.localNickname,
          this.localRoomId,
          this.localAddress,
        );

        this.activeConnections.push(connection);

        connection.onClose(() => {
          const idx = this.activeConnections.indexOf(connection);
          if (idx !== -1) {
            this.activeConnections.splice(idx, 1);
          }
        });

        this.connectionCallback?.(connection);
      });

      this.server.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE" && this.port < PORT_MAX) {
          this.port++;
          this.server!.listen(this.port, "0.0.0.0");
        } else {
          reject(err);
        }
      });

      this.server.listen(this.port, "0.0.0.0", () => {
        resolve(this.port);
      });
    });
  }

  onConnection(callback: ConnectionCallback): void {
    this.connectionCallback = callback;
  }

  getPort(): number {
    return this.port;
  }

  stop(): void {
    for (const connection of this.activeConnections) {
      connection.destroy();
    }
    this.activeConnections = [];

    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}
