import type { Room, RoomInfo, MemberInfo, UserId, PeerAddress, ChatMessage } from "./types.js";
import { ZKClient } from "../network/ZKClient.js";
import { MemberService } from "./MemberService.js";
import { HistoryService } from "./HistoryService.js";
import { ConfigService } from "./ConfigService.js";

export class RoomService {
  private currentRoomId: string | null = null;
  private joinedRooms: Map<string, Room> = new Map();
  private roomMessages: Map<string, ChatMessage[]> = new Map();
  private readonly MAX_MESSAGES_PER_ROOM = 500;

  constructor(
    private zkClient: ZKClient,
    private memberService: MemberService,
    private historyService: HistoryService,
    private configService: ConfigService,
  ) {}

  /**
   * Get list of available rooms with member counts
   */
  async listAvailableRooms(): Promise<RoomInfo[]> {
    const roomIds = await this.zkClient.listRooms();
    const roomInfos: RoomInfo[] = [];

    for (const roomId of roomIds) {
      try {
        const members = await this.zkClient.getRoomMembers(roomId);
        roomInfos.push({
          roomId,
          memberCount: members.length,
        });
      } catch {
        // Skip rooms that can't be queried
        roomInfos.push({
          roomId,
          memberCount: 0,
        });
      }
    }

    return roomInfos;
  }

  /**
   * Create and join a room
   */
  async createAndJoin(roomId: string): Promise<void> {
    await this.zkClient.ensureBasePath();
    await this.zkClient.createRoom(roomId);
    await this.joinRoom(roomId);
  }

  /**
   * Join an existing room
   */
  async joinRoom(roomId: string): Promise<void> {
    const userId = this.configService.getUserId();
    const nickname = this.configService.getNickname();
    const port = this.configService.getP2pPort();

    // Get local IP address (simplified - would use actual network interface detection)
    const ip = "127.0.0.1"; // TODO: Get actual local IP

    const memberInfo: MemberInfo = {
      nickname,
      status: "online",
      ip,
      port,
    };

    // Join room in ZK
    await this.zkClient.joinRoom(roomId, memberInfo);

    // Watch for member changes
    this.zkClient.watchMembers(roomId, async (members) => {
      await this.memberService.syncMembers(roomId, members);
    });

    // Create room object
    if (!this.joinedRooms.has(roomId)) {
      this.joinedRooms.set(roomId, {
        roomId,
        members: new Map(),
        createdAt: Date.now(),
      });
    }

    // Set as current room
    this.currentRoomId = roomId;

    // Add to recent rooms
    await this.configService.addRecentRoom(roomId);

    // Update config
    const config = this.configService.getConfig();
    if (config) {
      config.currentRoomId = roomId;
      await this.configService.save();
    }
  }

  /**
   * Leave a room
   */
  async leaveRoom(roomId: string): Promise<void> {
    const nickname = this.configService.getNickname();

    // Leave ZK room
    try {
      await this.zkClient.leaveRoom(roomId, nickname);
    } catch (err) {
      const errorCode = (err as any)?.code;
      // NO_NODE error is expected if node has expired - silently ignore
      if (errorCode !== -101 && errorCode !== "NO_NODE") {
        console.warn(`Failed to leave room ${roomId} in ZK:`, err);
      }
    }

    // Clear members
    this.memberService.clearRoom(roomId);

    // Remove from joined rooms
    this.joinedRooms.delete(roomId);
    this.roomMessages.delete(roomId);

    // Update current room if leaving current room
    if (this.currentRoomId === roomId) {
      this.currentRoomId = null;
      // Note: config.currentRoomId set to null when no active room
      const config = this.configService.getConfig();
      if (config) {
        config.currentRoomId = null;
        await this.configService.save();
      }
    }

    // Cleanup old messages
    await this.historyService.cleanupOldMessages(roomId);
  }

  /**
   * Switch to a different room
   */
  async switchRoom(roomId: string): Promise<void> {
    if (this.currentRoomId === roomId) {
      return; // Already in this room
    }

    this.currentRoomId = roomId;

    // Update config
    const config = this.configService.getConfig();
    if (config) {
      config.currentRoomId = roomId;
      await this.configService.save();
    }
  }

  /**
   * Get current room ID
   */
  getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  /**
   * Get room object
   */
  getRoom(roomId: string): Room | undefined {
    return this.joinedRooms.get(roomId);
  }

  /**
   * Add a message to room cache
   */
  addMessage(roomId: string, message: ChatMessage): void {
    if (!this.roomMessages.has(roomId)) {
      this.roomMessages.set(roomId, []);
    }

    const messages = this.roomMessages.get(roomId)!;
    messages.push(message);

    // Trim to max messages
    if (messages.length > this.MAX_MESSAGES_PER_ROOM) {
      messages.splice(0, messages.length - this.MAX_MESSAGES_PER_ROOM);
    }
  }

  /**
   * Get messages for a room
   */
  getMessages(roomId: string): ChatMessage[] {
    return this.roomMessages.get(roomId) || [];
  }

  /**
   * Set messages for a room (when loading history)
   */
  setMessages(roomId: string, messages: ChatMessage[]): void {
    this.roomMessages.set(roomId, messages);
  }

  /**
   * Get list of joined room IDs
   */
  getJoinedRoomIds(): string[] {
    return Array.from(this.joinedRooms.keys());
  }

  /**
   * Check if joined a room
   */
  hasJoined(roomId: string): boolean {
    return this.joinedRooms.has(roomId);
  }
}
