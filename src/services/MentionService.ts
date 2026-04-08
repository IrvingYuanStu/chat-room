import { Member } from './types';
import { MemberService } from './MemberService';

/**
 * Result of processing input for @ mentions
 */
export interface ProcessInputResult {
  /** Whether the user is currently typing a @ mention */
  isMentioning: boolean;
  /** List of members that match the current @ partial input */
  members: Member[];
}

/**
 * MentionService - Handles @ mention detection, parsing, and highlighting
 *
 * Provides functionality for:
 * - Detecting when user is typing a @ mention (for autocomplete)
 * - Parsing @ mentions from message content
 * - Highlighting @ mentions in messages for display
 */
export class MentionService {
  private memberService: MemberService;

  constructor(memberService: MemberService) {
    this.memberService = memberService;
  }

  /**
   * Process user input to detect @ mention state and provide autocomplete suggestions
   *
   * @param input - The current input text from the user
   * @returns Object containing isMentioning flag and matching members for autocomplete
   *
   * @example
   * // User types "@Ali"
   * processInput("Hello @Ali")
   * // Returns: { isMentioning: true, members: [Member{ nickname: "Alice", ... }] }
   */
  processInput(input: string): ProcessInputResult {
    // Find the last @ symbol in the input
    const lastAtIndex = input.lastIndexOf('@');

    // No @ found
    if (lastAtIndex === -1) {
      return {
        isMentioning: false,
        members: [],
      };
    }

    // Get the text after @
    const afterAt = input.slice(lastAtIndex + 1);

    // If there's text after @ (before any space), it's an active mention
    // We trim to handle the case where @ is followed by only spaces
    const trimmedAfterAt = afterAt.trim();

    // If there's non-space content after @, filter by it
    // If @ is followed only by spaces (or nothing), show all online members
    const partialNickname = trimmedAfterAt.length > 0 ? trimmedAfterAt : '';

    // User is actively mentioning if:
    // 1. @ is the last @ symbol (we're not in the middle of typing another @)
    // 2. The character immediately after @ is not a space, OR there are only spaces
    //    which means user just triggered @ and is about to type a name
    const lastAtIsActive = !afterAt.includes('@');

    if (!lastAtIsActive) {
      return {
        isMentioning: false,
        members: [],
      };
    }

    // User is mentioning if:
    // - @ is followed by text (partial name match)
    // - @ is followed only by spaces (show all online members)
    const isMentioning = true;
    const members = this.getMatchingMembers(partialNickname);

    return {
      isMentioning,
      members,
    };
  }

  /**
   * Parse message content and extract userIds of mentioned members
   *
   * @param content - The message content to parse
   * @returns Array of userIds that were mentioned
   *
   * @example
   * parseMentions("Hello @Alice and @Bob!")
   * // Returns: ["user-001", "user-002"] (assuming those are Alice and Bob's userIds)
   */
  parseMentions(content: string): string[] {
    if (!content || content.trim() === '') {
      return [];
    }

    const mentions: string[] = [];
    const nicknameToUserId = this.buildNicknameToUserIdMap();

    // Find all @ patterns in the content
    // Match @ followed by nickname (alphanumeric, underscore, hyphen, Chinese chars)
    const mentionRegex = /@([a-zA-Z0-9_\-\u4e00-\u9fa5]+)/g;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      const nickname = match[1];

      // Look up userId by nickname (case-sensitive)
      const userId = nicknameToUserId.get(nickname);

      if (userId && !mentions.includes(userId)) {
        mentions.push(userId);
      }
    }

    return mentions;
  }

  /**
   * Highlight @ mentions in content for display
   *
   * @param content - The message content
   * @param mentions - Array of userIds that should be highlighted
   * @returns Content with @ mentions highlighted
   *
   * @example
   * highlightMentions("Hello @Alice", ["user-001"])
   * // Returns: "Hello @Alice" (with highlighting applied)
   */
  highlightMentions(content: string, mentions: string[]): string {
    if (!mentions || mentions.length === 0) {
      return content;
    }

    const userIdToNickname = this.buildUserIdToNicknameMap();

    let result = content;

    for (const userId of mentions) {
      const nickname = userIdToNickname.get(userId);

      if (nickname) {
        // Replace @nickname with highlighted version
        // We mark it for highlighting with a special format
        result = result.replace(
          new RegExp(`@${this.escapeRegex(nickname)}`, 'g'),
          `@${nickname}` // In a real React/Ink context, this would wrap in a styled component
        );
      }
    }

    return result;
  }

  /**
   * Get members that match a partial nickname input
   * Only returns online members
   */
  private getMatchingMembers(partialNickname: string): Member[] {
    const allMembers = this.memberService.getMembers();

    // Filter to only online members that match the partial input
    return allMembers.filter((member) => {
      if (member.status !== 'online') {
        return false;
      }

      // Case-sensitive prefix match
      return member.nickname.startsWith(partialNickname);
    });
  }

  /**
   * Build a map from lowercase nickname to userId for fast lookup
   * Note: Matching is case-sensitive, but we build this for efficiency
   */
  private buildNicknameToUserIdMap(): Map<string, string> {
    const members = this.memberService.getMembers();
    const map = new Map<string, string>();

    for (const member of members) {
      map.set(member.nickname, member.userId);
    }

    return map;
  }

  /**
   * Build a map from userId to nickname for highlighting
   */
  private buildUserIdToNicknameMap(): Map<string, string> {
    const members = this.memberService.getMembers();
    const map = new Map<string, string>();

    for (const member of members) {
      map.set(member.userId, member.nickname);
    }

    return map;
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
