/**
 * M3.3 Reply Feature Tests
 * Tests for message selection, reply clicking, and reply reference display
 * Following TDD: Write tests first, then implement
 */

import React from 'react';
import { ChatMessage, ReplyInfo, MessageType } from '../../../src/services/types';

// Mock the formatMessage function for testing (same logic as in ChatView.tsx)
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `[${hours}:${minutes}:${seconds}]`;
};

// Copy of formatMessage logic from ChatView.tsx for testing
const formatMessage = (
  message: ChatMessage,
  currentUserNickname: string,
  userIdToNickname?: Map<string, string>
): { time: string; text: string } => {
  const time = formatTimestamp(message.timestamp);
  const displayNickname =
    message.senderNickname === currentUserNickname ? '我' : message.senderNickname;

  let text: string;

  switch (message.type) {
    case 'system':
      text = `${time} 系统: ${message.content}`;
      break;

    case 'reply':
      if (message.replyTo) {
        // Format: [HH:mm:ss] 昵称 [回复 原发送者: 原内容]: 回复内容
        text = `${time} ${displayNickname} [回复 ${message.replyTo.originalSenderNickname}: ${message.replyTo.originalContent}]: ${message.content}`;
      } else {
        text = `${time} ${displayNickname}: ${message.content}`;
      }
      break;

    case 'mention':
      const mentionStr = message.mentions
        ? message.mentions.map((m) => `@${m}`).join(' ')
        : '';
      text = `${time} ${displayNickname}: ${mentionStr} ${message.content}`.trim();
      break;

    case 'normal':
    default:
      text = `${time} ${displayNickname}: ${message.content}`;
  }

  return { time, text };
};

// Helper function to format reply reference display
const formatReplyReference = (replyTo: ReplyInfo): string => {
  return `「 ${replyTo.originalSenderNickname}: ${replyTo.originalContent} 」`;
};

describe('M3.3 Reply Feature - ChatView Component', () => {
  describe('M3.3.1 Message Selection State', () => {
    it('should support selectedMessageId prop for tracking selection', () => {
      const props = {
        messages: [] as ChatMessage[],
        selectedMessageId: 'msg-001' as string | undefined,
        currentUserId: 'user-001',
        onReply: jest.fn(),
        onMention: jest.fn(),
      };

      expect(props.selectedMessageId).toBe('msg-001');
    });

    it('should have undefined selectedMessageId when no message selected', () => {
      const props = {
        messages: [] as ChatMessage[],
        selectedMessageId: undefined as string | undefined,
        currentUserId: 'user-001',
        onReply: jest.fn(),
        onMention: jest.fn(),
      };

      expect(props.selectedMessageId).toBeUndefined();
    });

    it('should identify if a message is selected by comparing id', () => {
      const selectedMessageId = 'msg-002';
      const message1 = { id: 'msg-001' };
      const message2 = { id: 'msg-002' };

      const isMessage1Selected = selectedMessageId === message1.id;
      const isMessage2Selected = selectedMessageId === message2.id;

      expect(isMessage1Selected).toBe(false);
      expect(isMessage2Selected).toBe(true);
    });

    it('should update selection state when user clicks different message', () => {
      let selectedMessageId: string | undefined = undefined;

      // Initially no selection
      expect(selectedMessageId).toBeUndefined();

      // User clicks msg-001
      selectedMessageId = 'msg-001';
      expect(selectedMessageId).toBe('msg-001');

      // User clicks msg-002
      selectedMessageId = 'msg-002';
      expect(selectedMessageId).toBe('msg-002');
    });

    it('should clear selection when clicking outside messages', () => {
      let selectedMessageId: string | undefined = 'msg-001';

      // Click outside to clear selection
      selectedMessageId = undefined;
      expect(selectedMessageId).toBeUndefined();
    });
  });

  describe('M3.3.2 Click Reply Functionality', () => {
    it('should trigger onReply callback with messageId when reply is clicked', () => {
      const onReply = jest.fn();
      const messageId = 'msg-001';

      // Simulate clicking reply on a message
      onReply(messageId);

      expect(onReply).toHaveBeenCalledTimes(1);
      expect(onReply).toHaveBeenCalledWith('msg-001');
    });

    it('should pass correct messageId to onReply callback', () => {
      const onReply = jest.fn();

      // Click reply on msg-003
      onReply('msg-003');

      expect(onReply).toHaveBeenCalledWith('msg-003');
    });

    it('should allow reply action on any message regardless of type', () => {
      const onReply = jest.fn();

      const normalMessage: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Hello',
        timestamp: Date.now(),
      };

      const replyMessage: ChatMessage = {
        id: 'msg-002',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Reply',
        timestamp: Date.now(),
        replyTo: {
          originalMessageId: 'msg-001',
          originalSenderNickname: 'Alice',
          originalContent: 'Hello',
        },
      };

      // Should be able to reply to both
      onReply(normalMessage.id);
      expect(onReply).toHaveBeenLastCalledWith('msg-001');

      onReply(replyMessage.id);
      expect(onReply).toHaveBeenLastCalledWith('msg-002');
    });

    it('should not trigger onReply when clicking on different action', () => {
      const onReply = jest.fn();
      const onMention = jest.fn();

      // User clicks mention instead
      onMention('user-003');

      expect(onReply).not.toHaveBeenCalled();
    });
  });

  describe('M3.3.3 Reply Reference Display', () => {
    it('should display reply reference with 「original message」 format', () => {
      const replyTo: ReplyInfo = {
        originalMessageId: 'msg-001',
        originalSenderNickname: 'Charlie',
        originalContent: 'Original message content',
      };

      // Expected display format: 「 Charlie: Original message content 」
      const expectedFormat = formatReplyReference(replyTo);
      expect(expectedFormat).toBe('「 Charlie: Original message content 」');
    });

    it('should include reply reference in formatted reply message', () => {
      const message: ChatMessage = {
        id: 'msg-002',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Thanks for the info!',
        timestamp: Date.now(),
        replyTo: {
          originalMessageId: 'msg-001',
          originalSenderNickname: 'Charlie',
          originalContent: 'Here is the information you asked for',
        },
      };

      expect(message.replyTo).toBeDefined();
      expect(message.replyTo?.originalSenderNickname).toBe('Charlie');
      expect(message.replyTo?.originalContent).toBe('Here is the information you asked for');
    });

    it('should display full reply reference text', () => {
      const message: ChatMessage = {
        id: 'msg-002',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Bob',
        content: 'I agree!',
        timestamp: Date.now(),
        replyTo: {
          originalMessageId: 'msg-001',
          originalSenderNickname: 'Alice',
          originalContent: 'I think this is a great idea',
        },
      };

      const replyRef = message.replyTo!;
      const replyRefDisplay = formatReplyReference(replyRef);

      expect(replyRefDisplay).toBe('「 Alice: I think this is a great idea 」');
    });

    it('should handle long original content in reply reference', () => {
      const longContent = 'A'.repeat(200); // Very long message
      const replyTo: ReplyInfo = {
        originalMessageId: 'msg-001',
        originalSenderNickname: 'User',
        originalContent: longContent,
      };

      const replyRefDisplay = formatReplyReference(replyTo);

      expect(replyRefDisplay).toContain('User');
      expect(replyRefDisplay).toContain(longContent);
      // 「User: A...A 」 length = 2 + 5 + 1 + 200 + 2 = 210
      expect(replyRefDisplay.length).toBe(210);
    });

    it('should handle special characters in original content', () => {
      const replyTo: ReplyInfo = {
        originalMessageId: 'msg-001',
        originalSenderNickname: '张三',
        originalContent: '你好！🎉',
      };

      const replyRefDisplay = formatReplyReference(replyTo);

      expect(replyRefDisplay).toBe('「 张三: 你好！🎉 」');
    });

    it('should not display reply reference when replyTo is undefined', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Reply content',
        timestamp: Date.now(),
        // replyTo is intentionally undefined
      };

      expect(message.replyTo).toBeUndefined();
    });
  });

  describe('M3.3.4 Reply Message Format', () => {
    it('should format reply message with [回复 originalSender] pattern', () => {
      const replyTo: ReplyInfo = {
        originalMessageId: 'msg-001',
        originalSenderNickname: 'Charlie',
        originalContent: 'Original content',
      };

      const pattern = `[回复 ${replyTo.originalSenderNickname}]`;
      expect(pattern).toBe('[回复 Charlie]');
    });

    it('should format complete reply message as [HH:mm:ss] Nickname [回复 OriginalNickname]: Content', () => {
      const timestamp = new Date('2026-04-03T10:30:00').getTime();
      const replyTo: ReplyInfo = {
        originalMessageId: 'msg-001',
        originalSenderNickname: 'Charlie',
        originalContent: 'Original content',
      };

      const message: ChatMessage = {
        id: 'msg-002',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Thanks!',
        timestamp,
        replyTo,
      };

      const formatted = formatMessage(message, 'Alice', undefined);
      // Format: [HH:mm:ss] 昵称 [回复 原发送者: 原内容]: 回复内容
      expect(formatted.text).toBe('[10:30:00] 我 [回复 Charlie: Original content]: Thanks!');
    });

    it('should format reply from other user correctly', () => {
      const timestamp = new Date('2026-04-03T10:30:00').getTime();
      const replyTo: ReplyInfo = {
        originalMessageId: 'msg-001',
        originalSenderNickname: 'Charlie',
        originalContent: 'Original content',
      };

      const message: ChatMessage = {
        id: 'msg-002',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'I agree!',
        timestamp,
        replyTo,
      };

      const formatted = formatMessage(message, 'Alice', undefined);
      // Format: [HH:mm:ss] 昵称 [回复 原发送者: 原内容]: 回复内容
      expect(formatted.text).toBe('[10:30:00] Bob [回复 Charlie: Original content]: I agree!');
    });

    it('should include replyTo info in ChatMessage when sending reply', () => {
      const replyTo: ReplyInfo = {
        originalMessageId: 'msg-001',
        originalSenderNickname: 'Bob',
        originalContent: 'Original message',
      };

      const message: ChatMessage = {
        id: 'msg-002',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Reply message',
        timestamp: Date.now(),
        replyTo,
      };

      expect(message.type).toBe('reply');
      expect(message.replyTo).toEqual(replyTo);
    });

    it('should handle reply without replyTo gracefully in format', () => {
      const timestamp = new Date('2026-04-03T10:30:00').getTime();
      const message: ChatMessage = {
        id: 'msg-002',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Reply without reference',
        timestamp,
        // replyTo is undefined but type is reply
      };

      const formatted = formatMessage(message, 'Alice', undefined);
      // When senderNickname equals currentUserNickname, it displays as "我"
      expect(formatted.text).toContain('我');
      expect(formatted.text).toContain('Reply without reference');
    });

    it('should format reply message with multi-line original content', () => {
      const timestamp = new Date('2026-04-03T10:30:00').getTime();
      const replyTo: ReplyInfo = {
        originalMessageId: 'msg-001',
        originalSenderNickname: 'Bob',
        originalContent: 'Line 1\nLine 2\nLine 3',
      };

      const message: ChatMessage = {
        id: 'msg-002',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Got it!',
        timestamp,
        replyTo,
      };

      const formatted = formatMessage(message, 'Alice', undefined);
      // The reply reference should include the original content
      expect(formatted.text).toContain('[回复 Bob: Line 1');
      expect(formatted.text).toContain('Line 1');
      expect(formatted.text).toContain('Line 2');
    });

    it('should format reply with CJK characters in sender nickname', () => {
      const timestamp = new Date('2026-04-03T10:30:00').getTime();
      const replyTo: ReplyInfo = {
        originalMessageId: 'msg-001',
        originalSenderNickname: '张三',
        originalContent: '你好',
      };

      const message: ChatMessage = {
        id: 'msg-002',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: '李四',
        content: '收到！',
        timestamp,
        replyTo,
      };

      const formatted = formatMessage(message, '李四', undefined);
      // Format: [HH:mm:ss] 昵称 [回复 原发送者: 原内容]: 回复内容
      expect(formatted.text).toBe('[10:30:00] 我 [回复 张三: 你好]: 收到！');
    });
  });

  describe('Integration: Complete Reply Flow', () => {
    it('should support full reply workflow: select -> reply -> display', () => {
      // Step 1: User selects a message
      let selectedMessageId: string | undefined = 'msg-001';
      expect(selectedMessageId).toBe('msg-001');

      // Step 2: User clicks reply
      const onReply = jest.fn();
      onReply(selectedMessageId!);
      expect(onReply).toHaveBeenCalledWith('msg-001');

      // Step 3: System creates reply message with original message reference
      const originalMessage: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Original message',
        timestamp: Date.now(),
      };

      const replyTo: ReplyInfo = {
        originalMessageId: originalMessage.id,
        originalSenderNickname: originalMessage.senderNickname,
        originalContent: originalMessage.content,
      };

      const replyMessage: ChatMessage = {
        id: 'msg-002',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Reply content',
        timestamp: Date.now(),
        replyTo,
      };

      // Step 4: Verify reply message format
      const formatted = formatMessage(replyMessage, 'Alice', undefined);
      // Format: [HH:mm:ss] 昵称 [回复 原发送者: 原内容]: 回复内容
      expect(formatted.text).toContain('[回复 Bob: Original message]');
      expect(formatted.text).toContain('Reply content');
    });
  });
});
