import { Member, MemberNodeData } from './types';
import { EventBus } from './EventBus';

/**
 * MemberService - Manages chat room members and their online status
 *
 * Handles member join/leave events, online status tracking,
 * and nickname changes. Publishes events to the EventBus for UI updates.
 */

// ZKClient interface for dependency injection
export interface ZKClientInterface {
  setMemberData(roomId: string, userId: string, data: MemberNodeData): Promise<void>;
}

// PeerService interface for dependency injection
export interface PeerServiceInterface {
  broadcast(message: { type: string; senderId: string; senderNickname: string; roomId: string; timestamp: number; payload: any }): void;
}

export class MemberService {
  private members: Map<string, Member>;
  private eventBus: EventBus;
  private zkClient: ZKClientInterface | null;
  private peerService: PeerServiceInterface | null;
  private currentRoomId: string = '';

  constructor(eventBus: EventBus, zkClient?: ZKClientInterface, peerService?: PeerServiceInterface) {
    this.members = new Map();
    this.eventBus = eventBus;
    this.zkClient = zkClient || null;
    this.peerService = peerService || null;
  }

  /**
   * Get all members, sorted by joinedAt descending (newest first)
   * Returns copies to prevent external mutation
   */
  getMembers(): Member[] {
    const membersArray = Array.from(this.members.values());
    return membersArray
      .sort((a, b) => b.joinedAt - a.joinedAt)
      .map(member => ({ ...member }));
  }

  /**
   * Get a specific member by userId
   * Returns a copy to prevent external mutation
   */
  getMember(userId: string): Member | undefined {
    const member = this.members.get(userId);
    return member ? { ...member } : undefined;
  }

  /**
   * Check if a member is currently online
   */
  isOnline(userId: string): boolean {
    const member = this.members.get(userId);
    return member?.status === 'online';
  }

  /**
   * Handle a member joining the chat room
   * Updates existing member or adds new member, then publishes member_join event
   */
  onMemberJoin(member: Member): void {
    // Update existing member or add new one
    // For new members, default status to 'online' if not specified
    const existingMember = this.members.get(member.userId);
    const status = existingMember
      ? member.status
      : (member.status || 'online');

    this.members.set(member.userId, {
      ...member,
      status,
    });

    // Publish member join event
    this.eventBus.publish('member_join', member);
  }

  /**
   * Handle a member leaving the chat room
   * Removes member from the list and publishes member_leave event
   */
  onMemberLeave(userId: string): void {
    // Check if member exists
    if (!this.members.has(userId)) {
      return;
    }

    // Remove member from map
    this.members.delete(userId);

    // Publish member leave event
    this.eventBus.publish('member_leave', { userId });
  }

  /**
   * Update all members from ZK sync
   * Replaces all current members with the provided list
   */
  updateMembers(members: Member[]): void {
    // Clear existing members
    this.members.clear();

    // Add all new members
    for (const member of members) {
      this.members.set(member.userId, member);
    }
  }

  /**
   * Set the current room ID for ZK operations
   */
  setCurrentRoomId(roomId: string): void {
    this.currentRoomId = roomId;
  }

  /**
   * Get the current room ID
   */
  getCurrentRoomId(): string {
    return this.currentRoomId;
  }

  /**
   * Rename a member's nickname
   * Updates the member data, ZK node, and broadcasts to peers
   *
   * M3.4.2: Update ZK node data when renaming
   * M3.4.3: Broadcast nickname change via PeerService
   */
  async rename(userId: string, newNickname: string): Promise<void> {
    const member = this.members.get(userId);
    if (!member) {
      throw new Error(`Member not found: ${userId}`);
    }

    const oldNickname = member.nickname;

    // Update member nickname locally
    this.members.set(userId, {
      ...member,
      nickname: newNickname,
    });

    // M3.4.2: Update ZK node data if zkClient is available
    if (this.zkClient && this.currentRoomId) {
      try {
        const nodeData: MemberNodeData = {
          nickname: newNickname,
          status: 'online',
          ip: member.ip,
          port: member.port,
          userId: member.userId,
          joinedAt: member.joinedAt,
        };
        await this.zkClient.setMemberData(this.currentRoomId, userId, nodeData);
      } catch (error) {
        // Log error but continue with local update and broadcast
        console.error('Failed to update ZK node data:', error);
      }
    }

    // M3.4.3: Broadcast nickname change via PeerService
    if (this.peerService) {
      try {
        this.peerService.broadcast({
          type: 'nick_change',
          senderId: userId,
          senderNickname: oldNickname,
          roomId: this.currentRoomId,
          timestamp: Date.now(),
          payload: {
            oldNickname,
            newNickname,
          },
        });
      } catch (error) {
        // Log error but continue
        console.error('Failed to broadcast nick_change:', error);
      }
    }

    // Publish local nick change event for UI update
    this.eventBus.publish('nick_change', {
      userId,
      oldNickname,
      newNickname,
    });
  }

  /**
   * Force a member to go offline (used for testing or timeout scenarios)
   * Sets status to 'offline' instead of removing them
   */
  forceOffline(userId: string): void {
    const member = this.members.get(userId);
    if (!member) {
      return;
    }

    this.members.set(userId, {
      ...member,
      status: 'offline',
    });
  }

  /**
   * Broadcast current user's status to other members
   * Called when joining a room or when status changes
   */
  broadcastStatus(): void {
    // This method is a placeholder for P2P status broadcasting
    // Actual implementation would use PeerService to broadcast
  }

  /**
   * Create Member data for ZK node creation
   */
  static createMemberNodeData(
    nickname: string,
    ip: string,
    port: number,
    userId: string
  ): MemberNodeData {
    return {
      nickname,
      status: 'online',
      ip,
      port,
      userId,
      joinedAt: Date.now(),
    };
  }
}
