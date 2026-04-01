import type { Member, UserId, ChatMessage } from "./types.js";
import { MemberService } from "./MemberService.js";

export class MentionService {
  private memberService: MemberService;

  constructor(memberService: MemberService) {
    this.memberService = memberService;
  }

  /**
   * Get matching member candidates for mention
   */
  getCandidates(roomId: string, filter: string): Member[] {
    const members = this.memberService.getOnlineMembers(roomId);

    if (!filter) {
      return members;
    }

    const lowerFilter = filter.toLowerCase();
    return members.filter((m) => m.nickname.toLowerCase().includes(lowerFilter));
  }

  /**
   * Parse mentions from message content
   */
  parseMentions(content: string, members: Member[]): UserId[] {
    const mentionRegex = /@(\S+)/g;
    const matches = content.matchAll(mentionRegex);

    const mentionedUserIds: UserId[] = [];
    const nicknames = new Map(members.map((m) => [m.nickname.toLowerCase(), m.userId]));

    for (const match of matches) {
      const nickname = match[1].toLowerCase();
      const userId = nicknames.get(nickname);
      if (userId) {
        mentionedUserIds.push(userId);
      }
    }

    return mentionedUserIds;
  }

  /**
   * Check if a message mentions the current user
   */
  isMentioned(msg: ChatMessage, currentUserId: string): boolean {
    if (!msg.mentions || msg.mentions.length === 0) {
      return false;
    }
    return msg.mentions.includes(currentUserId);
  }

  /**
   * Check if mentioned members include offline ones
   */
  hasOfflineMention(roomId: string, mentions: UserId[]): Member[] {
    if (mentions.length === 0) return [];

    const offlineMembers: Member[] = [];
    for (const userId of mentions) {
      const member = this.memberService.getMemberByUserId(roomId, userId);
      if (member && member.status === "offline") {
        offlineMembers.push(member);
      }
    }

    return offlineMembers;
  }
}
