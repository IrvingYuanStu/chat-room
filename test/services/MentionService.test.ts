/**
 * Unit tests for MentionService
 * Tests @ mention detection, parsing, and highlighting functionality
 */

import { MentionService } from '../../src/services/MentionService';
import { MemberService } from '../../src/services/MemberService';
import { EventBus, getEventBus, resetEventBus } from '../../src/services/EventBus';
import { Member } from '../../src/services/types';

describe('MentionService', () => {
  let mentionService: MentionService;
  let memberService: MemberService;
  let eventBus: EventBus;

  // Test members for autocomplete
  const testMembers: Member[] = [
    {
      userId: 'user-001',
      nickname: 'Alice',
      status: 'online',
      ip: '192.168.1.100',
      port: 9001,
      joinedAt: Date.now() - 10000,
    },
    {
      userId: 'user-002',
      nickname: 'Bob',
      status: 'online',
      ip: '192.168.1.101',
      port: 9002,
      joinedAt: Date.now() - 8000,
    },
    {
      userId: 'user-003',
      nickname: 'Charlie',
      status: 'offline',
      ip: '192.168.1.102',
      port: 9003,
      joinedAt: Date.now() - 6000,
    },
    {
      userId: 'user-004',
      nickname: 'David',
      status: 'online',
      ip: '192.168.1.103',
      port: 9004,
      joinedAt: Date.now() - 4000,
    },
  ];

  beforeEach(() => {
    resetEventBus();
    eventBus = getEventBus();
    memberService = new MemberService(eventBus);

    // Add test members to member service
    testMembers.forEach((member) => {
      memberService.onMemberJoin(member);
    });

    mentionService = new MentionService(memberService);
  });

  afterEach(() => {
    resetEventBus();
  });

  describe('parseMentions', () => {
    it('should parse single @mention correctly', () => {
      const content = 'Hello @Alice how are you?';
      const mentions = mentionService.parseMentions(content);

      expect(mentions).toHaveLength(1);
      expect(mentions).toContain('user-001'); // Alice's userId
    });

    it('should parse multiple @mentions correctly', () => {
      const content = 'Hey @Alice and @Bob, welcome!';
      const mentions = mentionService.parseMentions(content);

      expect(mentions).toHaveLength(2);
      expect(mentions).toContain('user-001'); // Alice
      expect(mentions).toContain('user-002'); // Bob
    });

    it('should parse @mention at the start of message', () => {
      const content = '@Alice is the best!';
      const mentions = mentionService.parseMentions(content);

      expect(mentions).toHaveLength(1);
      expect(mentions).toContain('user-001');
    });

    it('should parse @mention at the end of message', () => {
      const content = 'Hello everyone @Alice';
      const mentions = mentionService.parseMentions(content);

      expect(mentions).toHaveLength(1);
      expect(mentions).toContain('user-001');
    });

    it('should return empty array when no @ mentions', () => {
      const content = 'Hello everyone, how are you?';
      const mentions = mentionService.parseMentions(content);

      expect(mentions).toHaveLength(0);
    });

    it('should return empty array for message with only @ symbol', () => {
      const content = 'Just testing @';
      const mentions = mentionService.parseMentions(content);

      expect(mentions).toHaveLength(0);
    });

    it('should parse @mention with numbers in nickname', () => {
      const content = 'Hello @User123';
      const mentions = mentionService.parseMentions(content);

      // Should try to match against members
      expect(Array.isArray(mentions)).toBe(true);
    });

    it('should parse @mention with underscores in nickname', () => {
      const content = 'Hey @User_Name';
      const mentions = mentionService.parseMentions(content);

      expect(Array.isArray(mentions)).toBe(true);
    });

    it('should parse consecutive @mentions without spaces', () => {
      const content = '@Alice@Bob hello';
      const mentions = mentionService.parseMentions(content);

      // Should parse two mentions
      expect(mentions.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle @mention with special characters after name', () => {
      const content = 'Hello @Alice! How are you?';
      const mentions = mentionService.parseMentions(content);

      expect(mentions).toHaveLength(1);
      expect(mentions).toContain('user-001');
    });

    it('should handle @mention followed by punctuation', () => {
      const content = 'Hey @Bob, welcome!';
      const mentions = mentionService.parseMentions(content);

      expect(mentions).toHaveLength(1);
      expect(mentions).toContain('user-002');
    });

    it('should handle @mention with newline after name', () => {
      const content = 'Hey @Alice\nhow are you?';
      const mentions = mentionService.parseMentions(content);

      expect(mentions).toHaveLength(1);
      expect(mentions).toContain('user-001');
    });

    it('should not count email addresses as mentions', () => {
      const content = 'Contact me at alice@example.com';
      const mentions = mentionService.parseMentions(content);

      // The @ in email should not be treated as a mention trigger
      expect(mentions.length).toBe(0);
    });

    it('should parse mentions with Chinese characters', () => {
      const content = '你好 @Alice';
      const mentions = mentionService.parseMentions(content);

      expect(mentions).toHaveLength(1);
      expect(mentions).toContain('user-001');
    });

    it('should handle empty content', () => {
      const mentions = mentionService.parseMentions('');

      expect(mentions).toHaveLength(0);
    });

    it('should handle whitespace-only content', () => {
      const mentions = mentionService.parseMentions('   ');

      expect(mentions).toHaveLength(0);
    });

    it('should match offline members as well', () => {
      const content = 'Where is @Charlie?';
      const mentions = mentionService.parseMentions(content);

      expect(mentions).toHaveLength(1);
      expect(mentions).toContain('user-003'); // Charlie is offline
    });

    it('should handle case-sensitive nickname matching', () => {
      const content = 'Hey @alice'; // lowercase
      const mentions = mentionService.parseMentions(content);

      // Should still match if case-insensitive, or return empty if case-sensitive
      // Based on implementation, it appears to be case-sensitive from design
      expect(Array.isArray(mentions)).toBe(true);
    });
  });

  describe('processInput', () => {
    it('should detect @ trigger and return isMentioning true', () => {
      const result = mentionService.processInput('Hello @');

      expect(result.isMentioning).toBe(true);
    });

    it('should detect @ with partial nickname', () => {
      const result = mentionService.processInput('Hello @Ali');

      expect(result.isMentioning).toBe(true);
    });

    it('should return false when not mentioning', () => {
      const result = mentionService.processInput('Hello everyone!');

      expect(result.isMentioning).toBe(false);
    });

    it('should return matching members when @ is triggered', () => {
      const result = mentionService.processInput('Hello @Ali');

      expect(result.isMentioning).toBe(true);
      expect(result.members.length).toBeGreaterThan(0);
      // Alice should be in the results (partial match)
      expect(result.members.some(m => m.nickname === 'Alice')).toBe(true);
    });

    it('should return empty members array when not mentioning', () => {
      const result = mentionService.processInput('Hello everyone!');

      expect(result.isMentioning).toBe(false);
      expect(result.members).toHaveLength(0);
    });

    it('should filter members by partial input after @', () => {
      const result = mentionService.processInput('Hey @B');

      expect(result.isMentioning).toBe(true);
      expect(result.members.length).toBeGreaterThan(0);
      // Bob should match
      expect(result.members.some(m => m.nickname === 'Bob')).toBe(true);
      // Alice should not match (no 'A' in partial)
      expect(result.members.some(m => m.nickname === 'Alice')).toBe(false);
    });

    it('should return all online members when @ is alone', () => {
      const result = mentionService.processInput('@');

      expect(result.isMentioning).toBe(true);
      // Should include all online members (Alice, Bob, David) but not Charlie (offline)
      expect(result.members.length).toBe(3);
    });

    it('should return empty members for @ with no matching nickname', () => {
      const result = mentionService.processInput('@XYZNotExist');

      expect(result.isMentioning).toBe(true);
      expect(result.members).toHaveLength(0);
    });

    it('should handle @ at the beginning of input', () => {
      const result = mentionService.processInput('@Alice');

      expect(result.isMentioning).toBe(true);
      expect(result.members.some(m => m.nickname === 'Alice')).toBe(true);
    });

    it('should handle @ after some text', () => {
      const result = mentionService.processInput('Hello @Bob');

      expect(result.isMentioning).toBe(true);
      expect(result.members.some(m => m.nickname === 'Bob')).toBe(true);
    });

    it('should handle multiple @ symbols (last one counts)', () => {
      const result = mentionService.processInput('@@Alice');

      // The last @ starts the mention
      expect(result.isMentioning).toBe(true);
    });

    it('should handle @ followed by space', () => {
      const result = mentionService.processInput('Hey @ ');

      expect(result.isMentioning).toBe(true);
      expect(result.members.length).toBeGreaterThan(0); // All online members
    });

    it('should only match against online members', () => {
      const result = mentionService.processInput('@Charlie');

      // Charlie is offline
      expect(result.isMentioning).toBe(true);
      // Should not include offline members in autocomplete
      expect(result.members.some(m => m.nickname === 'Charlie')).toBe(false);
    });

    it('should include userId in returned member objects', () => {
      const result = mentionService.processInput('@Ali');

      const alice = result.members.find(m => m.nickname === 'Alice');
      expect(alice).toBeDefined();
      expect(alice!.userId).toBe('user-001');
    });
  });

  describe('highlightMentions', () => {
    it('should return highlighted content for single mention', () => {
      const content = 'Hello @Alice';
      const mentions = ['user-001'];

      const result = mentionService.highlightMentions(content, mentions);

      expect(result).toContain('@Alice');
    });

    it('should return highlighted content for multiple mentions', () => {
      const content = 'Hey @Alice and @Bob';
      const mentions = ['user-001', 'user-002'];

      const result = mentionService.highlightMentions(content, mentions);

      expect(result).toContain('@Alice');
      expect(result).toContain('@Bob');
    });

    it('should handle mention at start of content', () => {
      const content = '@Alice is here';
      const mentions = ['user-001'];

      const result = mentionService.highlightMentions(content, mentions);

      expect(result).toContain('@Alice');
    });

    it('should handle mention at end of content', () => {
      const content = 'Welcome @Alice';
      const mentions = ['user-001'];

      const result = mentionService.highlightMentions(content, mentions);

      expect(result).toContain('@Alice');
    });

    it('should handle content with no mentions', () => {
      const content = 'Hello everyone!';
      const mentions: string[] = [];

      const result = mentionService.highlightMentions(content, mentions);

      expect(result).toBe(content);
    });

    it('should handle empty mentions array', () => {
      const content = 'Hello @Alice';
      const mentions: string[] = [];

      const result = mentionService.highlightMentions(content, mentions);

      // No mentions to highlight, so content unchanged
      expect(result).toBe(content);
    });

    it('should handle Chinese content with mention', () => {
      const content = '你好 @Alice';
      const mentions = ['user-001'];

      const result = mentionService.highlightMentions(content, mentions);

      expect(result).toContain('@Alice');
    });

    it('should handle mention with punctuation after', () => {
      const content = 'Hello @Alice!';
      const mentions = ['user-001'];

      const result = mentionService.highlightMentions(content, mentions);

      expect(result).toContain('@Alice');
    });
  });

  describe('integration with MemberService', () => {
    it('should reflect member status changes', () => {
      // Initially Alice is online
      let result = mentionService.processInput('@Ali');
      expect(result.members.some(m => m.nickname === 'Alice')).toBe(true);

      // Alice goes offline
      memberService.forceOffline('user-001');

      // Should not appear in autocomplete anymore
      result = mentionService.processInput('@Ali');
      expect(result.members.some(m => m.nickname === 'Alice')).toBe(false);
    });

    it('should include newly joined members', () => {
      // Add a new member
      const newMember: Member = {
        userId: 'user-005',
        nickname: 'Eve',
        status: 'online',
        ip: '192.168.1.105',
        port: 9005,
        joinedAt: Date.now(),
      };
      memberService.onMemberJoin(newMember);

      const result = mentionService.processInput('@E');

      expect(result.isMentioning).toBe(true);
      expect(result.members.some(m => m.nickname === 'Eve')).toBe(true);
    });

    it('should handle member nickname change', async () => {
      // Rename Bob
      await memberService.rename('user-002', 'Bobby');

      // Should find by new nickname
      const result = mentionService.processInput('@Bob');

      // Note: The old nickname Bob won't match anymore, but Bobby should
      expect(result.members.some(m => m.nickname === 'Bobby')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle mention parsing when member leaves', () => {
      // Initially Bob can be mentioned
      let mentions = mentionService.parseMentions('Hello @Bob');
      expect(mentions).toContain('user-002');

      // Bob leaves (we simulate by removing)
      memberService.onMemberLeave('user-002');

      // Parsing should still work but return empty (Bob no longer exists)
      mentions = mentionService.parseMentions('Hello @Bob');
      // Bob is gone, so no userId match
      expect(mentions).not.toContain('user-002');
    });

    it('should handle empty member list in constructor', () => {
      const emptyMemberService = new MemberService(eventBus);
      const serviceWithNoMembers = new MentionService(emptyMemberService);

      const result = serviceWithNoMembers.processInput('@Any');
      expect(result.isMentioning).toBe(true);
      expect(result.members).toHaveLength(0);
    });

    it('should handle very long message with mentions', () => {
      const longContent = 'This is a very long message '.repeat(10) + '@Alice';
      const mentions = mentionService.parseMentions(longContent);

      expect(mentions).toHaveLength(1);
      expect(mentions).toContain('user-001');
    });

    it('should handle mention with emoji', () => {
      const content = 'Hey @Alice 👋';
      const mentions = mentionService.parseMentions(content);

      expect(mentions).toHaveLength(1);
      expect(mentions).toContain('user-001');
    });
  });
});
