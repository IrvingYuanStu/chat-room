import type { Socket } from "node:net";
import { P2PTransport, FrameReassembler } from "./P2PTransport.js";
import type {
  P2PProtocolMessage,
  HandshakePayload,
  HandshakeResponsePayload,
  HeartbeatPayload,
  Member,
  PeerAddress,
} from "../services/types.js";

export type ConnectionState = "pending" | "handshaking" | "ready" | "closed";

type MessageCallback = (message: P2PProtocolMessage) => void;
type TimeoutCallback = () => void;
type CloseCallback = () => void;

export class PeerConnection {
  private socket: Socket;
  private state: ConnectionState = "pending";
  private reassembler: FrameReassembler;
  private messageCallback: MessageCallback | null = null;
  private timeoutCallback: TimeoutCallback | null = null;
  private closeCallback: CloseCallback | null = null;

  private remoteInfo: {
    userId: string;
    nickname: string;
    roomId: string;
    address: PeerAddress;
  } | null = null;

  // Heartbeat
  private heartbeatSequence = 0;
  private lastSeen = Date.now();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatCheckTimer: ReturnType<typeof setInterval> | null = null;
  private readonly HEARTBEAT_INTERVAL = 30_000;
  private readonly HEARTBEAT_TIMEOUT = 90_000;

  // Local info
  private localUserId: string;
  private localNickname: string;
  private localRoomId: string;
  private localAddress: PeerAddress;

  constructor(
    socket: Socket,
    localUserId: string,
    localNickname: string,
    localRoomId: string,
    localAddress: PeerAddress,
  ) {
    this.socket = socket;
    this.localUserId = localUserId;
    this.localNickname = localNickname;
    this.localRoomId = localRoomId;
    this.localAddress = localAddress;
    this.reassembler = P2PTransport.createFrameReassembler();
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.socket.on("data", (data: Buffer) => {
      const messages = this.reassembler.feed(data);
      for (const msg of messages) {
        this.handleMessage(msg);
      }
    });

    this.socket.on("close", () => {
      this.stopHeartbeat();
      if (this.state !== "closed") {
        this.state = "closed";
        this.closeCallback?.();
      }
    });

    this.socket.on("error", () => {
      // Connection-level errors are handled by close event
    });
  }

  private handleMessage(msg: P2PProtocolMessage): void {
    this.lastSeen = Date.now();

    if (msg.type === "heartbeat") {
      return;
    }

    if (msg.type === "handshake") {
      this.handleIncomingHandshake(msg);
      return;
    }

    this.messageCallback?.(msg);
  }

  /** Send handshake as the connecting peer (client side) */
  initiateHandshake(): void {
    this.state = "handshaking";

    const payload: HandshakePayload = {
      userId: this.localUserId,
      nickname: this.localNickname,
      roomId: this.localRoomId,
      address: this.localAddress,
    };

    const msg: P2PProtocolMessage = {
      version: 1,
      type: "handshake",
      payload,
      timestamp: Date.now(),
      senderId: this.localUserId,
    };

    this.sendRaw(msg);
  }

  /** Handle an incoming handshake (server side). Responds with handshake-response. */
  private handleIncomingHandshake(msg: P2PProtocolMessage): void {
    const payload = msg.payload as HandshakePayload;

    if (payload.roomId !== this.localRoomId) {
      this.destroy();
      return;
    }

    this.remoteInfo = {
      userId: payload.userId,
      nickname: payload.nickname,
      roomId: payload.roomId,
      address: payload.address,
    };

    // Send handshake response
    const response: HandshakeResponsePayload = {
      userId: this.localUserId,
      nickname: this.localNickname,
      roomId: this.localRoomId,
      address: this.localAddress,
      members: [], // Populated by PeerService before forwarding
    };

    const responseMsg: P2PProtocolMessage = {
      version: 1,
      type: "handshake",
      payload: response,
      timestamp: Date.now(),
      senderId: this.localUserId,
    };

    this.sendRaw(responseMsg);
    this.state = "ready";
    this.startHeartbeat();

    // Forward to PeerService for member list injection and processing
    this.messageCallback?.(responseMsg);
  }

  /** Process a handshake response received from remote peer (client side) */
  processHandshakeResponse(msg: P2PProtocolMessage): boolean {
    const payload = msg.payload as HandshakeResponsePayload;

    if (payload.roomId !== this.localRoomId) {
      this.destroy();
      return false;
    }

    this.remoteInfo = {
      userId: payload.userId,
      nickname: payload.nickname,
      roomId: payload.roomId,
      address: payload.address,
    };

    this.state = "ready";
    this.startHeartbeat();
    return true;
  }

  send(message: P2PProtocolMessage): void {
    if (this.state === "closed") return;
    this.sendRaw(message);
  }

  private sendRaw(message: P2PProtocolMessage): void {
    try {
      const frame = P2PTransport.encode(message);
      this.socket.write(frame);
    } catch {
      // Socket might be closed
    }
  }

  onMessage(callback: MessageCallback): void {
    this.messageCallback = callback;
  }

  onTimeout(callback: TimeoutCallback): void {
    this.timeoutCallback = callback;
  }

  onClose(callback: CloseCallback): void {
    this.closeCallback = callback;
  }

  private startHeartbeat(): void {
    this.lastSeen = Date.now();
    this.heartbeatSequence = 0;

    this.heartbeatTimer = setInterval(() => {
      if (this.state !== "ready") return;

      const payload: HeartbeatPayload = {
        sequence: ++this.heartbeatSequence,
      };

      const msg: P2PProtocolMessage = {
        version: 1,
        type: "heartbeat",
        payload,
        timestamp: Date.now(),
        senderId: this.localUserId,
      };

      this.sendRaw(msg);
    }, this.HEARTBEAT_INTERVAL);

    this.heartbeatCheckTimer = setInterval(() => {
      if (this.state !== "ready") return;

      if (Date.now() - this.lastSeen > this.HEARTBEAT_TIMEOUT) {
        this.timeoutCallback?.();
        this.close();
      }
    }, 10_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatCheckTimer) {
      clearInterval(this.heartbeatCheckTimer);
      this.heartbeatCheckTimer = null;
    }
  }

  getRemoteInfo(): typeof this.remoteInfo {
    return this.remoteInfo;
  }

  getRemoteUserId(): string | null {
    return this.remoteInfo?.userId ?? null;
  }

  isAlive(): boolean {
    return this.state === "ready" && !this.socket.destroyed;
  }

  getState(): ConnectionState {
    return this.state;
  }

  close(): void {
    this.state = "closed";
    this.stopHeartbeat();
    this.reassembler.reset();
    this.socket.end();
  }

  destroy(): void {
    this.state = "closed";
    this.stopHeartbeat();
    this.reassembler.reset();
    this.socket.destroy();
  }
}
