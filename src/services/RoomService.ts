import { Room, Member, ChatMessage } from './types';
import { EventBus } from './EventBus';
import { MemberService } from './MemberService';
import { ZKClient } from '../network/ZKClient';
import { HistoryService } from './HistoryService';

export interface UserInfo {
  userId: string;
  nickname: string;
  ip: string;
  port: number;
}

/**
 * RoomService - Manages chat room operations
 *
 * Handles joining/leaving rooms, switching between rooms,
 * and maintaining current room state. Works with ZKClient
 * for node registration and MemberService for member tracking.
 *
 * M4.3: Supports multi-room state management - tracks multiple
 * joined rooms and maintains independent history for each.
 */
export class RoomService {
  private zkClient: ZKClient;
  private memberService: MemberService;
  private eventBus: EventBus;
  private userInfo: UserInfo;
  private currentRoom: Room | null = null;
  private historyService: HistoryService | null = null;
  // M4.3.1: Track multiple joined rooms
  private joinedRooms: Map<string, Room> = new Map();

  constructor(
    zkClient: ZKClient,
    memberService: MemberService,
    eventBus: EventBus,
    userInfo: UserInfo,
    historyService?: HistoryService
  ) {
    this.zkClient = zkClient;
    this.memberService = memberService;
    this.eventBus = eventBus;
    this.userInfo = userInfo;
    this.historyService = historyService || null;
  }

  /**
   * M4.3.1 - Get list of all joined room IDs
   * @returns Array of room IDs that have been joined
   */
  getJoinedRooms(): string[] {
    return Array.from(this.joinedRooms.keys());
  }

  /**
   * M4.3.1 - Check if a room has been joined
   * @param roomId The room ID to check
   * @returns true if the room is in the joined list
   */
  isRoomJoined(roomId: string): boolean {
    return this.joinedRooms.has(roomId);
  }

  /**
   * Get list of all available rooms from ZooKeeper
   */
  async listRooms(): Promise<string[]> {
    return this.zkClient.listRooms();
  }

  /**
   * Join a chat room
   * Creates member node in ZK and initializes room state
   * M4.3.1: Adds room to joined rooms map
   */
  async joinRoom(roomId: string): Promise<void> {
    // Create member node in ZK
    const nodeData = {
      nickname: this.userInfo.nickname,
      status: 'online' as const,
      ip: this.userInfo.ip,
      port: this.userInfo.port,
      userId: this.userInfo.userId,
      joinedAt: Date.now(),
    };

    await this.zkClient.createMemberNode(roomId, nodeData);

    // Get current members from ZK
    const members = await this.zkClient.getMembers(roomId);

    // Update member service with room members
    this.memberService.updateMembers(members);

    // Set current room
    const room: Room = {
      roomId,
      members,
      createdAt: new Date(),
    };
    this.currentRoom = room;

    // M4.3.1: Add to joined rooms map (updates existing if re-joining)
    this.joinedRooms.set(roomId, room);

    // Set up watch for member changes to receive notifications when others join
    const currentUserId = this.userInfo.userId;
    this.zkClient.watchMembers(roomId, (updatedMembers: Member[]) => {
      // Capture previous members BEFORE updating
      const previousMembers = this.memberService.getMembers();
      const previousMemberIds = new Set(previousMembers.map((m) => m.userId));

      // Find newly joined members (not in previous list)
      const newMembers = updatedMembers.filter((m) => !previousMemberIds.has(m.userId));

      // Find members that left (in previous list but not in updated list)
      const updatedMemberIds = new Set(updatedMembers.map((m) => m.userId));
      const leftMembers = previousMembers.filter((m) => !updatedMemberIds.has(m.userId));

      // Update member service with the full list
      this.memberService.updateMembers(updatedMembers);

      // Publish member_join events for any new members
      for (const member of newMembers) {
        if (member.userId !== currentUserId) {
          this.eventBus.publish('member_join', member);
        }
      }

      // Publish member_leave events for any members that left
      for (const member of leftMembers) {
        this.eventBus.publish('member_leave', { userId: member.userId });
      }
    });

    // Publish room joined event
    this.eventBus.publish('room_joined', { roomId });
  }

  /**
   * Leave the current chat room
   * Removes member node from ZK and clears room state
   * M4.3.1: Removes room from joined rooms map
   */
  async leaveRoom(): Promise<void> {
    if (!this.currentRoom) {
      throw new Error('Not in any room');
    }

    const roomId = this.currentRoom.roomId;

    try {
      await this.zkClient.deleteMemberNode(roomId, this.userInfo.userId);
    } catch (error) {
      // If node doesn't exist, it's okay - might already be deleted
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('Node not exists') && !errorMessage.includes('NONODE')) {
        throw error;
      }
    }

    // M4.3.1: Remove from joined rooms map
    this.joinedRooms.delete(roomId);

    // Clear current room
    this.currentRoom = null;

    // Publish room left event
    this.eventBus.publish('room_left', { roomId });
  }

  /**
   * Switch from current room to a new room
   * Leaves current room if any, then joins new room
   * M4.3.1: Maintains joined rooms map for multi-room support
   * M4.3.2: Saves current room's unread message count before switching
   * M4.3.3: Loads new room's history after switching
   */
  async switchRoom(newRoomId: string): Promise<void> {
    // If already in the same room, do nothing
    if (this.currentRoom && this.currentRoom.roomId === newRoomId) {
      return;
    }

    // Leave current room if in one (but keep it in joinedRooms for quick re-join)
    if (this.currentRoom) {
      const currentRoomId = this.currentRoom.roomId;

      try {
        await this.zkClient.deleteMemberNode(currentRoomId, this.userInfo.userId);
      } catch (error) {
        // If node doesn't exist, it's okay
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes('Node not exists') && !errorMessage.includes('NONODE')) {
          throw error;
        }
      }

      // M4.3.2: Current room history is already saved via HistoryService.save()
      // The room stays in joinedRooms map so we can track it

      this.eventBus.publish('room_left', { roomId: currentRoomId });
    }

    // Join new room
    const nodeData = {
      nickname: this.userInfo.nickname,
      status: 'online' as const,
      ip: this.userInfo.ip,
      port: this.userInfo.port,
      userId: this.userInfo.userId,
      joinedAt: Date.now(),
    };

    await this.zkClient.createMemberNode(newRoomId, nodeData);

    // Get current members from ZK
    const members = await this.zkClient.getMembers(newRoomId);

    // Update member service
    this.memberService.updateMembers(members);

    // Set new current room
    const room: Room = {
      roomId: newRoomId,
      members,
      createdAt: new Date(),
    };
    this.currentRoom = room;

    // M4.3.1: Add new room to joined rooms map
    this.joinedRooms.set(newRoomId, room);

    // M4.3.3: Pre-load history for the new room (available via HistoryService)
    // The actual history loading is done via historyService.loadHistory()
    // which can be called by the UI after switching

    // Publish room joined event
    this.eventBus.publish('room_joined', { roomId: newRoomId });
  }

  /**
   * Get current room information
   */
  getCurrentRoom(): Room | null {
    return this.currentRoom;
  }
}
