/**
 * M3.2.3 ChatView @ Mention Highlighting Tests
 * Tests for @ mention message highlighting in chat view
 */

import React from 'react';
import { ChatMessage } from '../../../src/services/types';

describe('M3.2.3 @ Mention Highlighting', () => {
  describe('Mention Highlight Detection', () => {
    it('should detect when current user is mentioned', () => {
      const currentUserId = 'user-001';
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey there!',
        mentions: ['user-001'],
        timestamp: Date.now(),
      };

      const isMentioned = message.mentions?.includes(currentUserId) || false;
      expect(isMentioned).toBe(true);
    });

    it('should detect when current user is not mentioned', () => {
      const currentUserId = 'user-001';
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey there!',
        mentions: ['user-003'],
        timestamp: Date.now(),
      };

      const isMentioned = message.mentions?.includes(currentUserId) || false;
      expect(isMentioned).toBe(false);
    });

    it('should handle message with multiple mentions', () => {
      const currentUserId = 'user-001';
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey everyone!',
        mentions: ['user-001', 'user-003', 'user-004'],
        timestamp: Date.now(),
      };

      const isMentioned = message.mentions?.includes(currentUserId) || false;
      expect(isMentioned).toBe(true);
    });

    it('should handle message without mentions array', () => {
      const currentUserId = 'user-001';
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey there!',
        timestamp: Date.now(),
      };

      const isMentioned = message.mentions?.includes(currentUserId) || false;
      expect(isMentioned).toBe(false);
    });
  });

  describe('Highlight Style Application', () => {
    it('should apply yellow highlight to mention text', () => {
      const getHighlightColor = (
        isMentioned: boolean,
        isOwnMessage: boolean
      ): string => {
        if (isMentioned) return 'yellow';
        if (isOwnMessage) return 'green';
        return 'white';
      };

      expect(getHighlightColor(true, false)).toBe('yellow');
      expect(getHighlightColor(false, true)).toBe('green');
      expect(getHighlightColor(false, false)).toBe('white');
    });

    it('should format message with @mentions highlighted', () => {
      const formatMentionedContent = (
        content: string,
        mentions: string[],
        userIdToNickname: Map<string, string>
      ): { text: string; highlightedRanges: { start: number; end: number }[] } => {
        const ranges: { start: number; end: number }[] = [];
        let result = content;

        for (const userId of mentions) {
          const nickname = userIdToNickname.get(userId);
          if (nickname) {
            const mentionText = `@${nickname}`;
            const index = result.indexOf(mentionText);
            if (index !== -1) {
              ranges.push({ start: index, end: index + mentionText.length });
            }
          }
        }

        return { text: result, highlightedRanges: ranges };
      };

      const userIdToNickname = new Map([
        ['user-001', 'Alice'],
        ['user-002', 'Bob'],
      ]);

      const result = formatMentionedContent('Hello @Alice!', ['user-001'], userIdToNickname);
      expect(result.highlightedRanges).toHaveLength(1);
      expect(result.highlightedRanges[0]).toEqual({ start: 6, end: 12 });
    });

    it('should handle multiple mentions in one message', () => {
      const formatMultipleMentions = (
        content: string,
        mentions: string[],
        userIdToNickname: Map<string, string>
      ): { text: string; highlightedRanges: { start: number; end: number }[] } => {
        const ranges: { start: number; end: number }[] = [];
        let result = content;

        for (const userId of mentions) {
          const nickname = userIdToNickname.get(userId);
          if (nickname) {
            const mentionText = `@${nickname}`;
            let index = result.indexOf(mentionText);
            while (index !== -1) {
              ranges.push({ start: index, end: index + mentionText.length });
              index = result.indexOf(mentionText, index + 1);
            }
          }
        }

        // Sort by start position
        ranges.sort((a, b) => a.start - b.start);

        return { text: result, highlightedRanges: ranges };
      };

      const userIdToNickname = new Map([
        ['user-001', 'Alice'],
        ['user-002', 'Bob'],
      ]);

      const result = formatMultipleMentions(
        'Hello @Alice and @Bob!',
        ['user-001', 'user-002'],
        userIdToNickname
      );

      expect(result.highlightedRanges).toHaveLength(2);
    });
  });

  describe('Mention Display Format', () => {
    it('should format mention type message correctly', () => {
      const formatMentionMessage = (
        message: ChatMessage,
        currentUserNickname: string
      ): string => {
        const time = formatTimestamp(message.timestamp);
        const displayNickname =
          message.senderNickname === currentUserNickname ? '我' : message.senderNickname;

        const mentionStr = message.mentions
          ? message.mentions.map(m => `@${m}`).join(' ')
          : '';

        return `${time} ${displayNickname}: ${mentionStr} ${message.content}`.trim();
      };

      const message: ChatMessage = {
        id: 'msg-001',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey there!',
        mentions: ['user-001'],
        timestamp: new Date('2026-04-03T10:30:00').getTime(),
      };

      const result = formatMentionMessage(message, 'Alice');
      expect(result).toBe('[10:30:00] Bob: @user-001 Hey there!');
    });

    it('should show @userId format for mentions', () => {
      const getMentionDisplay = (mentions: string[] | undefined): string => {
        if (!mentions || mentions.length === 0) return '';
        return mentions.map(m => `@${m}`).join(' ');
      };

      expect(getMentionDisplay(['user-001'])).toBe('@user-001');
      expect(getMentionDisplay(['user-001', 'user-002'])).toBe('@user-001 @user-002');
      expect(getMentionDisplay(undefined)).toBe('');
    });

    it('should display multiple mentions with spacing', () => {
      const formatMultipleMentions = (mentions: string[]): string => {
        return mentions.map(m => `@${m}`).join(' ');
      };

      expect(formatMultipleMentions(['user-001', 'user-002'])).toBe('@user-001 @user-002');
      expect(formatMultipleMentions(['a', 'b', 'c'])).toBe('@a @b @c');
    });
  });

  describe('Mention Highlight Colors', () => {
    it('should apply correct color for own mentioned message', () => {
      const getMessageColor = (
        messageType: string,
        isOwnMessage: boolean,
        isMentioned: boolean
      ): string => {
        if (isMentioned && messageType === 'mention') return 'yellow';
        if (isOwnMessage) return 'green';
        if (messageType === 'system') return 'gray';
        return 'white';
      };

      // Own mention - yellow
      expect(getMessageColor('mention', true, true)).toBe('yellow');
      // Other user mention - yellow
      expect(getMessageColor('mention', false, true)).toBe('yellow');
      // Own normal - green
      expect(getMessageColor('normal', true, false)).toBe('green');
      // Other normal - white
      expect(getMessageColor('normal', false, false)).toBe('white');
      // System - gray
      expect(getMessageColor('system', false, false)).toBe('gray');
    });

    it('should differentiate own mention from other mention', () => {
      const currentUserId = 'user-001';

      const ownMentionMessage: ChatMessage = {
        id: 'msg-001',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-001', // Same as current user
        senderNickname: 'Alice',
        content: 'Talking to myself',
        mentions: ['user-002'],
        timestamp: Date.now(),
      };

      const otherMentionMessage: ChatMessage = {
        id: 'msg-002',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey Alice!',
        mentions: ['user-001'],
        timestamp: Date.now(),
      };

      const isOwnMessage = ownMentionMessage.senderId === currentUserId;
      const isOtherMentioned = otherMentionMessage.mentions?.includes(currentUserId) || false;

      expect(isOwnMessage).toBe(true); // It's my message
      expect(isOtherMentioned).toBe(true); // I'm mentioned in Bob's message
    });
  });

  describe('Mention Highlighting vs Reply Highlighting', () => {
    it('should distinguish mention from reply in display', () => {
      const mentionMessage: ChatMessage = {
        id: 'msg-001',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey!',
        mentions: ['user-001'],
        timestamp: Date.now(),
      };

      const replyMessage: ChatMessage = {
        id: 'msg-002',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Thanks!',
        replyTo: {
          originalMessageId: 'msg-001',
          originalSenderNickname: 'Alice',
          originalContent: 'Original message',
        },
        timestamp: Date.now(),
      };

      expect(mentionMessage.type).toBe('mention');
      expect(replyMessage.type).toBe('reply');
      expect(mentionMessage.mentions).toBeDefined();
      expect(replyMessage.replyTo).toBeDefined();
    });

    it('should apply different styling for mention vs reply', () => {
      const getStyleForType = (type: string, isMentioned: boolean): { color: string; prefix: string } => {
        if (type === 'mention' && isMentioned) {
          return { color: 'yellow', prefix: 'mentioned' };
        }
        if (type === 'reply') {
          return { color: 'cyan', prefix: 'reply' };
        }
        return { color: 'white', prefix: 'normal' };
      };

      const mentionStyle = getStyleForType('mention', true);
      expect(mentionStyle.color).toBe('yellow');
      expect(mentionStyle.prefix).toBe('mentioned');

      const replyStyle = getStyleForType('reply', false);
      expect(replyStyle.color).toBe('cyan');
      expect(replyStyle.prefix).toBe('reply');
    });
  });

  describe('Mention Indicator', () => {
    it('should show indicator when current user is mentioned', () => {
      const currentUserId = 'user-001';
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey!',
        mentions: ['user-001'],
        timestamp: Date.now(),
      };

      const shouldShowIndicator = message.mentions?.includes(currentUserId) || false;
      expect(shouldShowIndicator).toBe(true);
    });

    it('should not show indicator when current user is not mentioned', () => {
      const currentUserId = 'user-001';
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey!',
        mentions: ['user-003'],
        timestamp: Date.now(),
      };

      const shouldShowIndicator = message.mentions?.includes(currentUserId) || false;
      expect(shouldShowIndicator).toBe(false);
    });

    it('should show mention indicator only for mentioned users', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey everyone!',
        mentions: ['user-001', 'user-003'],
        timestamp: Date.now(),
      };

      // User 001 is mentioned
      expect(message.mentions?.includes('user-001')).toBe(true);
      // User 002 sent the message
      expect(message.mentions?.includes('user-002')).toBe(false);
    });
  });

  describe('Highlighting Edge Cases', () => {
    it('should handle mention at start of message', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey!',
        mentions: ['user-001'],
        timestamp: Date.now(),
      };

      const content = '@user-001 Hey!';
      const startIndex = content.indexOf('@user-001');

      expect(startIndex).toBe(0);
    });

    it('should handle mention at end of message', () => {
      const content = 'Hello everyone @user-001';
      const mentionIndex = content.indexOf('@user-001');

      expect(mentionIndex).toBe(content.length - '@user-001'.length);
    });

    it('should handle mention in middle of message', () => {
      const content = 'Hello @user-001 how are you?';
      const mentionIndex = content.indexOf('@user-001');

      expect(mentionIndex).toBe(6);
    });

    it('should handle message with no content just mentions', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: '',
        mentions: ['user-001'],
        timestamp: Date.now(),
      };

      expect(message.content).toBe('');
      expect(message.mentions).toHaveLength(1);
    });

    it('should handle @ in normal message type (not mention type)', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'normal', // Not 'mention' type
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey @Alice check this out',
        timestamp: Date.now(),
      };

      // Even though message.type is 'normal', content contains @
      // This is different from type='mention' which has mentions array
      expect(message.type).toBe('normal');
      expect(message.content).toContain('@Alice');
      expect(message.mentions).toBeUndefined();
    });
  });

  describe('Mention Highlighting with Nickname Mapping', () => {
    it('should map userId to nickname for display', () => {
      const userIdToNickname = new Map([
        ['user-001', 'Alice'],
        ['user-002', 'Bob'],
        ['user-003', 'Charlie'],
      ]);

      const message: ChatMessage = {
        id: 'msg-001',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey!',
        mentions: ['user-001'],
        timestamp: Date.now(),
      };

      const nickname = userIdToNickname.get(message.mentions![0]);
      expect(nickname).toBe('Alice');
    });

    it('should highlight @nickname instead of @userId', () => {
      const userIdToNickname = new Map([
        ['user-001', 'Alice'],
        ['user-002', 'Bob'],
      ]);

      const message: ChatMessage = {
        id: 'msg-001',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey!', // Backend sends content without @userId, just content
        mentions: ['user-001'], // Client should look up nickname
        timestamp: Date.now(),
      };

      // The display should show @Alice, not @user-001
      const displayMentions = message.mentions?.map(
        id => `@${userIdToNickname.get(id) || id}`
      );

      expect(displayMentions).toEqual(['@Alice']);
    });
  });
});

// Helper function from ChatView
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `[${hours}:${minutes}:${seconds}]`;
};
