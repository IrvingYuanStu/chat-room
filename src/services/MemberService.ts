import type { Member, UserId } from "./types.js";
import { eventBus } from "./EventBus.js";

export class MemberService {
  private members: Map<string, Map<UserId, Member>> = new Map();

  /**
   * Sync members list (called from ZK watcher callback)
   */
  async syncMembers(roomId: string, newMembers: Member[]): Promise<void> {
    console.log(`[MemberService] syncMembers called for ${roomId}: ${newMembers.length} members`);
    const currentMembers = this.members.get(roomId) || new Map<UserId, Member>();
    const newMembersMap = new Map(newMembers.map((m) => [m.userId, m]));

    const added: Member[] = [];
    const removed: UserId[] = [];

    // Find new members
    for (const [userId, member] of newMembersMap) {
      if (!currentMembers.has(userId)) {
        added.push(member);
      }
    }

    // Find removed members
    for (const userId of currentMembers.keys()) {
      if (!newMembersMap.has(userId)) {
        removed.push(userId);
      }
    }

    console.log(`[MemberService] Added: ${added.map(m => m.nickname).join(", ")}, Removed: ${removed.join(", ")}`);

    // Update members map
    for (const member of added) {
      this.addMember(roomId, member);
    }

    for (const userId of removed) {
      this.markOffline(roomId, userId);
    }

    // Emit event if there were changes
    if (added.length > 0 || removed.length > 0) {
      console.log(`[MemberService] Emitting members-changed event for ${roomId}`);
      eventBus.emit("members-changed", roomId);
    }
  }

  /**
   * Add a single member
   */
  addMember(roomId: string, member: Member): void {
    console.log(`[MemberService] addMember called for ${roomId}: ${member.nickname} (${member.userId})`);
    if (!this.members.has(roomId)) {
      this.members.set(roomId, new Map());
      console.log(`[MemberService] Created new members map for ${roomId}`);
    }
    this.members.get(roomId)!.set(member.userId, member);
    console.log(`[MemberService] Member added. Map size now: ${this.members.get(roomId)!.size}`);
  }

  /**
   * Mark member as offline
   */
  markOffline(roomId: string, userId: string): void {
    const roomMembers = this.members.get(roomId);
    if (!roomMembers) return;

    const member = roomMembers.get(userId);
    if (member) {
      member.status = "offline";
    }
  }

  /**
   * Update member nickname
   */
  updateNickname(roomId: string, userId: string, nickname: string): void {
    const roomMembers = this.members.get(roomId);
    if (!roomMembers) return;

    const member = roomMembers.get(userId);
    if (member) {
      member.nickname = nickname;
    }

    // Emit event
    eventBus.emit("members-changed", roomId);
  }

  /**
   * Get all members in a room
   */
  getMembers(roomId: string): Member[] {
    const roomMembers = this.members.get(roomId);
    if (!roomMembers) return [];
    return Array.from(roomMembers.values());
  }

  /**
   * Get online members in a room
   */
  getOnlineMembers(roomId: string): Member[] {
    return this.getMembers(roomId).filter((m) => m.status === "online");
  }

  /**
   * Get member count in a room
   */
  getMemberCount(roomId: string): number {
    const roomMembers = this.members.get(roomId);
    const count = roomMembers?.size || 0;
    console.log(`[MemberService] getMemberCount for ${roomId}: ${count} members (map exists: ${!!roomMembers})`);
    if (roomMembers && roomMembers.size > 0) {
      console.log(`[MemberService] Members in map:`, Array.from(roomMembers.keys()));
    }
    return count;
  }

  /**
   * Get member by user ID
   */
  getMemberByUserId(roomId: string, userId: string): Member | undefined {
    const roomMembers = this.members.get(roomId);
    if (!roomMembers) return undefined;
    return roomMembers.get(userId);
  }

  /**
   * Remove all members for a room (when leaving)
   */
  clearRoom(roomId: string): void {
    this.members.delete(roomId);
  }

  /**
   * Check if a member exists in a room
   */
  hasMember(roomId: string, userId: string): boolean {
    const roomMembers = this.members.get(roomId);
    return roomMembers?.has(userId) ?? false;
  }
}
