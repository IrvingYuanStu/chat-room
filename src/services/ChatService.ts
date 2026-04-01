import { v4 as uuidv4 } from "uuid";
import type { ChatMessage, P2PProtocolMessage, UserId, ReplyToInfo } from "./types.js";
import { HistoryService } from "./HistoryService.js";
import { PeerService } from "./PeerService.js";
import { MentionService } from "./MentionService.js";
import { ConfigService } from "./ConfigService.js";
import { MemberService } from "./MemberService.js";
import { eventBus } from "./EventBus.js";

export class ChatService {
  constructor(
    private historyService: HistoryService,
    private peerService: PeerService,
    private mentionService: MentionService,
    private configService: ConfigService,
    private memberService: MemberService,
  ) {}

  /**
   * Send a message to current room
   */
  async send(roomId: string, content: string, replyTo?: ReplyToInfo): Promise<void> {
    const userId = this.configService.getUserId();
    const nickname = this.configService.getNickname();

    // Parse mentions
    const members = this.memberService.getMembers(roomId);
    const mentions = this.mentionService.parseMentions(content, members);

    // Generate message
    const message: ChatMessage = {
      id: uuidv4(),
      type: replyTo ? "reply" : "text",
      senderId: userId,
      senderNickname: nickname,
      content,
      roomId,
      timestamp: Date.now(),
      mentions: mentions.length > 0 ? mentions : undefined,
      replyTo,
    };

    // Persist to history
    await this.historyService.appendMessage(message);

    // Emit event for UI
    eventBus.emit("new-message", message);

    // Broadcast to peers
    const protocolMsg: P2PProtocolMessage = {
      version: 1,
      type: "chat",
      payload: message,
      timestamp: message.timestamp,
      senderId: userId,
    };

    this.peerService.broadcast(roomId, protocolMsg);

    // Check for offline mentions and show warning
    const offlineMentions = this.mentionService.hasOfflineMention(roomId, mentions);
    if (offlineMentions.length > 0) {
      const offlineNicknames = offlineMentions.map((m) => m.nickname).join(", ");
      const warningMsg: ChatMessage = {
        id: uuidv4(),
        type: "system",
        senderId: "system",
        senderNickname: "系统",
        content: `用户 "${offlineNicknames}" 当前离线，消息可能无法送达`,
        roomId,
        timestamp: Date.now(),
      };

      await this.historyService.appendMessage(warningMsg);
      eventBus.emit("new-message", warningMsg);
    }
  }

  /**
   * Handle incoming P2P message
   */
  async handleIncoming(roomId: string, protocolMsg: P2PProtocolMessage): Promise<void> {
    if (protocolMsg.type === "chat") {
      await this.handleChatMessage(roomId, protocolMsg);
    } else if (protocolMsg.type === "join") {
      await this.handleJoinMessage(roomId, protocolMsg);
    } else if (protocolMsg.type === "leave") {
      await this.handleLeaveMessage(roomId, protocolMsg);
    } else if (protocolMsg.type === "rename") {
      await this.handleRenameMessage(roomId, protocolMsg);
    }
  }

  /**
   * Handle chat message
   */
  private async handleChatMessage(roomId: string, protocolMsg: P2PProtocolMessage): Promise<void> {
    const message = protocolMsg.payload as ChatMessage;

    // Validate room ID
    if (message.roomId !== roomId) {
      console.warn(`Received message for wrong room: ${message.roomId} (expected ${roomId})`);
      return;
    }

    // Persist to history
    await this.historyService.appendMessage(message);

    // Emit event for UI
    eventBus.emit("new-message", message);
  }

  /**
   * Handle join message
   */
  private async handleJoinMessage(roomId: string, protocolMsg: P2PProtocolMessage): Promise<void> {
    const payload = protocolMsg.payload as { userId: UserId; nickname: string };

    // Add member
    this.memberService.addMember(roomId, {
      userId: payload.userId,
      nickname: payload.nickname,
      status: "online",
      address: { ip: "", port: 0 }, // Will be filled by actual connection
      joinedAt: Date.now(),
    });

    // Generate system message
    const systemMsg: ChatMessage = {
      id: uuidv4(),
      type: "join",
      senderId: "system",
      senderNickname: "系统",
      content: `${payload.nickname} 加入了聊天室`,
      roomId,
      timestamp: Date.now(),
    };

    await this.historyService.appendMessage(systemMsg);
    eventBus.emit("new-message", systemMsg);
  }

  /**
   * Handle leave message
   */
  private async handleLeaveMessage(roomId: string, protocolMsg: P2PProtocolMessage): Promise<void> {
    const payload = protocolMsg.payload as { userId: UserId; nickname: string };

    // Mark offline
    this.memberService.markOffline(roomId, payload.userId);

    // Generate system message
    const systemMsg: ChatMessage = {
      id: uuidv4(),
      type: "leave",
      senderId: "system",
      senderNickname: "系统",
      content: `${payload.nickname} 离开了聊天室`,
      roomId,
      timestamp: Date.now(),
    };

    await this.historyService.appendMessage(systemMsg);
    eventBus.emit("new-message", systemMsg);
  }

  /**
   * Handle rename message
   */
  private async handleRenameMessage(roomId: string, protocolMsg: P2PProtocolMessage): Promise<void> {
    const payload = protocolMsg.payload as { userId: UserId; oldNickname: string; newNickname: string };

    // Update nickname
    this.memberService.updateNickname(roomId, payload.userId, payload.newNickname);

    // Generate system message
    const systemMsg: ChatMessage = {
      id: uuidv4(),
      type: "rename",
      senderId: "system",
      senderNickname: "系统",
      content: `${payload.oldNickname} 修改昵称为 ${payload.newNickname}`,
      roomId,
      timestamp: Date.now(),
    };

    await this.historyService.appendMessage(systemMsg);
    eventBus.emit("new-message", systemMsg);
  }

  /**
   * Send rename message
   */
  async sendRename(roomId: string, oldNickname: string, newNickname: string): Promise<void> {
    const userId = this.configService.getUserId();

    const protocolMsg: P2PProtocolMessage = {
      version: 1,
      type: "rename",
      payload: {
        userId,
        oldNickname,
        newNickname,
      },
      timestamp: Date.now(),
      senderId: userId,
    };

    this.peerService.broadcast(roomId, protocolMsg);
  }

  /**
   * Send leave message
   */
  async sendLeave(roomId: string): Promise<void> {
    const userId = this.configService.getUserId();
    const nickname = this.configService.getNickname();

    const protocolMsg: P2PProtocolMessage = {
      version: 1,
      type: "leave",
      payload: {
        userId,
        nickname,
      },
      timestamp: Date.now(),
      senderId: userId,
    };

    this.peerService.broadcast(roomId, protocolMsg);
  }
}
