import type { P2PProtocolMessage, UserId, PeerAddress, Member, HandshakeResponsePayload } from "./types.js";
import { P2PServer } from "../network/P2PServer.js";
import { P2PClient } from "../network/P2PClient.js";
import { PeerConnection } from "../network/PeerConnection.js";
import { MemberService } from "./MemberService.js";
import { eventBus } from "./EventBus.js";

export class PeerService {
  // Map<roomId, Map<userId, PeerConnection>>
  private connections: Map<string, Map<UserId, PeerConnection>> = new Map();
  private server: P2PServer | null = null;
  private client: P2PClient | null = null;
  private messageCallback: ((roomId: string, msg: P2PProtocolMessage) => void) | null = null;

  // Local peer info
  private localUserId: UserId | null = null;
  private localNickname: string | null = null;
  private localRoomId: string | null = null;
  private localAddress: PeerAddress | null = null;

  constructor(
    private memberService: MemberService,
  ) {}

  /**
   * Set message callback
   */
  onMessage(callback: (roomId: string, msg: P2PProtocolMessage) => void): void {
    this.messageCallback = callback;
  }

  /**
   * Start P2P server
   */
  async startServer(port: number): Promise<number> {
    if (!this.localUserId || !this.localNickname || !this.localRoomId || !this.localAddress) {
      throw new Error("Local peer info not set. Call setLocalInfo first.");
    }

    this.server = new P2PServer(
      this.localUserId,
      this.localNickname,
      this.localRoomId,
      this.localAddress
    );
    const actualPort = await this.server.start(port);

    this.server.onConnection((connection) => {
      this.handleIncomingConnection(connection, this.localRoomId!);
    });

    return actualPort;
  }

  /**
   * Set local peer info
   */
  setLocalInfo(userId: UserId, nickname: string, roomId: string, address: PeerAddress): void {
    this.localUserId = userId;
    this.localNickname = nickname;
    this.localRoomId = roomId;
    this.localAddress = address;
  }

  /**
   * Initialize P2P client
   */
  initClient(userId: UserId, nickname: string, roomId: string, address: PeerAddress): void {
    this.client = new P2PClient(userId, nickname, roomId, address);
  }

  /**
   * Connect to a peer
   */
  async connectToPeer(roomId: string, member: Member): Promise<void> {
    if (!this.client) {
      throw new Error("P2P client not initialized");
    }

    // Check if already connected
    if (this.isConnected(roomId, member.userId)) {
      return;
    }

    try {
      const connection = await this.client.connect(member.address);

      // Set up connection handlers
      this.setupConnectionHandlers(connection, roomId);

      // Set up message handler for this connection
      connection.onMessage((msg: P2PProtocolMessage) => {
        if (msg.type === "handshake") {
          const payload = msg.payload as HandshakeResponsePayload;

          // Verify it's a handshake response (has members field)
          if ("members" in payload) {
            connection.processHandshakeResponse(msg);
            this.addConnection(roomId, member.userId, connection);

            // Emit peer connected event
            eventBus.emit("peer-connected", roomId, member);
          }
        } else {
          // Forward other messages to chat service
          this.messageCallback?.(roomId, msg);
        }
      });

      // Initiate handshake
      connection.initiateHandshake();
    } catch (err) {
      console.warn(`Failed to connect to peer ${member.nickname} at ${member.address.ip}:${member.address.port}:`, err);
      throw err;
    }
  }

  /**
   * Handle incoming connection
   */
  private handleIncomingConnection(connection: PeerConnection, roomId: string): void {
    this.setupConnectionHandlers(connection, roomId);

    connection.onMessage((msg: P2PProtocolMessage) => {
      if (msg.type === "handshake") {
        const payload = msg.payload as HandshakeResponsePayload;

        // Check if this is a handshake request (no members field = request)
        if (!("members" in payload)) {
          // Handshake already handled by PeerConnection, just add to connections
          const remoteUserId = connection.getRemoteUserId();
          if (remoteUserId) {
            this.addConnection(roomId, remoteUserId, connection);

            // Create member object for event
            const remoteInfo = connection.getRemoteInfo();
            if (remoteInfo) {
              const member: Member = {
                userId: remoteInfo.userId,
                nickname: remoteInfo.nickname,
                status: "online",
                address: remoteInfo.address,
                joinedAt: Date.now(),
              };

              // Emit peer connected event
              eventBus.emit("peer-connected", roomId, member);
            }
          }
        }
      } else {
        // Forward other messages to chat service
        this.messageCallback?.(roomId, msg);
      }
    });
  }

  /**
   * Set up connection message and timeout handlers
   */
  private setupConnectionHandlers(connection: PeerConnection, roomId: string): void {
    connection.onTimeout(() => {
      const remoteUserId = connection.getRemoteUserId();
      if (remoteUserId) {
        console.warn(`Peer ${remoteUserId} in room ${roomId} timeout`);
        this.disconnectPeer(roomId, remoteUserId);
        this.memberService.markOffline(roomId, remoteUserId);
      }
    });

    connection.onClose(() => {
      const remoteUserId = connection.getRemoteUserId();
      if (remoteUserId) {
        this.removeConnection(roomId, remoteUserId);
        eventBus.emit("peer-disconnected", roomId, remoteUserId);
      }
    });
  }

  /**
   * Disconnect a specific peer
   */
  disconnectPeer(roomId: string, userId: string): void {
    const roomConnections = this.connections.get(roomId);
    if (!roomConnections) return;

    const connection = roomConnections.get(userId);
    if (connection) {
      connection.close();
      roomConnections.delete(userId);
    }
  }

  /**
   * Disconnect all peers in a room
   */
  disconnectAll(roomId: string): void {
    const roomConnections = this.connections.get(roomId);
    if (!roomConnections) return;

    for (const [userId, connection] of roomConnections) {
      connection.close();
    }

    this.connections.delete(roomId);
  }

  /**
   * Broadcast message to all peers in a room
   */
  broadcast(roomId: string, message: P2PProtocolMessage): void {
    const roomConnections = this.connections.get(roomId);
    if (!roomConnections) return;

    const disconnected: UserId[] = [];

    for (const [userId, connection] of roomConnections) {
      if (connection.isAlive()) {
        connection.send(message);
      } else {
        disconnected.push(userId);
      }
    }

    // Clean up disconnected peers
    for (const userId of disconnected) {
      this.disconnectPeer(roomId, userId);
    }
  }

  /**
   * Get all connections for a room
   */
  getConnections(roomId: string): Map<UserId, PeerConnection> {
    if (!this.connections.has(roomId)) {
      this.connections.set(roomId, new Map());
    }
    return this.connections.get(roomId)!;
  }

  /**
   * Check if connected to a specific peer
   */
  isConnected(roomId: string, userId: string): boolean {
    const roomConnections = this.connections.get(roomId);
    return roomConnections?.has(userId) ?? false;
  }

  /**
   * Add connection to map
   */
  private addConnection(roomId: string, userId: string, connection: PeerConnection): void {
    if (!this.connections.has(roomId)) {
      this.connections.set(roomId, new Map());
    }
    this.connections.get(roomId)!.set(userId, connection);
  }

  /**
   * Remove connection from map
   */
  private removeConnection(roomId: string, userId: string): void {
    const roomConnections = this.connections.get(roomId);
    if (!roomConnections) return;

    roomConnections.delete(userId);

    // Clean up empty room maps
    if (roomConnections.size === 0) {
      this.connections.delete(roomId);
    }
  }

  /**
   * Stop server and clean up
   */
  stopServer(): void {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }

    // Close all connections
    for (const [roomId, roomConnections] of this.connections) {
      for (const [userId, connection] of roomConnections) {
        connection.close();
      }
    }

    this.connections.clear();
  }
}
