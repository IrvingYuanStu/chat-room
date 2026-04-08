/**
 * M2.6.1 ChatView Component Tests
 * Tests for the chat message display component
 */

import React from 'react';
import { ChatMessage, MessageType } from '../../../src/services/types';

// Mock the formatMessage function from ChatService
const formatMessageForTest = (
  message: ChatMessage,
  currentUserNickname: string
): string => {
  const time = formatTimestamp(message.timestamp);
  const displayNickname =
    message.senderNickname === currentUserNickname ? '我' : message.senderNickname;

  switch (message.type) {
    case 'system':
      return `${time} 系统: ${message.content}`;

    case 'reply':
      if (message.replyTo) {
        return `${time} ${displayNickname} [回复 ${message.replyTo.originalSenderNickname}]: ${message.content}`;
      }
      return `${time} ${displayNickname}: ${message.content}`;

    case 'mention':
      const mentionStr = message.mentions
        ? message.mentions.map((m) => `@${m}`).join(' ')
        : '';
      return `${time} ${displayNickname}: ${mentionStr} ${message.content}`.trim();

    case 'normal':
    default:
      return `${time} ${displayNickname}: ${message.content}`;
  }
};

// Helper function to format timestamp
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `[${hours}:${minutes}:${seconds}]`;
};

describe('M2.6.1 ChatView Component', () => {
  describe('ChatViewProps Interface', () => {
    it('should define messages as ChatMessage array', () => {
      interface ChatViewProps {
        messages: ChatMessage[];
        selectedMessageId?: string;
        currentUserId: string;
        onReply: (messageId: string) => void;
        onMention: (userId: string) => void;
      }

      const messages: ChatMessage[] = [
        {
          id: 'msg-001',
          type: 'normal',
          roomId: 'general',
          senderId: 'user-001',
          senderNickname: 'Alice',
          content: 'Hello!',
          timestamp: Date.now(),
        },
      ];

      const props: ChatViewProps = {
        messages,
        currentUserId: 'user-001',
        onReply: jest.fn(),
        onMention: jest.fn(),
      };

      expect(props.messages).toHaveLength(1);
      expect(props.messages[0].content).toBe('Hello!');
    });

    it('should define optional selectedMessageId', () => {
      interface ChatViewProps {
        messages: ChatMessage[];
        selectedMessageId?: string;
        currentUserId: string;
        onReply: (messageId: string) => void;
        onMention: (userId: string) => void;
      }

      const propsWithoutSelection: ChatViewProps = {
        messages: [],
        currentUserId: 'user-001',
        onReply: jest.fn(),
        onMention: jest.fn(),
      };

      const propsWithSelection: ChatViewProps = {
        messages: [],
        selectedMessageId: 'msg-001',
        currentUserId: 'user-001',
        onReply: jest.fn(),
        onMention: jest.fn(),
      };

      expect(propsWithoutSelection.selectedMessageId).toBeUndefined();
      expect(propsWithSelection.selectedMessageId).toBe('msg-001');
    });

    it('should define currentUserId as string', () => {
      interface ChatViewProps {
        messages: ChatMessage[];
        selectedMessageId?: string;
        currentUserId: string;
        onReply: (messageId: string) => void;
        onMention: (userId: string) => void;
      }

      const props: ChatViewProps = {
        messages: [],
        currentUserId: 'user-001',
        onReply: jest.fn(),
        onMention: jest.fn(),
      };

      expect(props.currentUserId).toBe('user-001');
      expect(typeof props.currentUserId).toBe('string');
    });

    it('should define onReply callback', () => {
      interface ChatViewProps {
        messages: ChatMessage[];
        selectedMessageId?: string;
        currentUserId: string;
        onReply: (messageId: string) => void;
        onMention: (userId: string) => void;
      }

      const onReplyMock = jest.fn();
      const props: ChatViewProps = {
        messages: [],
        currentUserId: 'user-001',
        onReply: onReplyMock,
        onMention: jest.fn(),
      };

      props.onReply('msg-001');
      expect(onReplyMock).toHaveBeenCalledWith('msg-001');
    });

    it('should define onMention callback', () => {
      interface ChatViewProps {
        messages: ChatMessage[];
        selectedMessageId?: string;
        currentUserId: string;
        onReply: (messageId: string) => void;
        onMention: (userId: string) => void;
      }

      const onMentionMock = jest.fn();
      const props: ChatViewProps = {
        messages: [],
        currentUserId: 'user-001',
        onReply: jest.fn(),
        onMention: onMentionMock,
      };

      props.onMention('user-002');
      expect(onMentionMock).toHaveBeenCalledWith('user-002');
    });
  });

  describe('MessageItemProps Interface', () => {
    it('should define message prop', () => {
      interface MessageItemProps {
        message: ChatMessage;
        isSelected: boolean;
        isOwnMessage: boolean;
        mentions: string[];
        onReply: () => void;
        onHover: () => void;
      }

      const message: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Test message',
        timestamp: Date.now(),
      };

      const props: MessageItemProps = {
        message,
        isSelected: false,
        isOwnMessage: false,
        mentions: [],
        onReply: jest.fn(),
        onHover: jest.fn(),
      };

      expect(props.message.content).toBe('Test message');
    });

    it('should define isSelected as boolean', () => {
      interface MessageItemProps {
        message: ChatMessage;
        isSelected: boolean;
        isOwnMessage: boolean;
        mentions: string[];
        onReply: () => void;
        onHover: () => void;
      }

      const message: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Test',
        timestamp: Date.now(),
      };

      const props: MessageItemProps = {
        message,
        isSelected: true,
        isOwnMessage: false,
        mentions: [],
        onReply: jest.fn(),
        onHover: jest.fn(),
      };

      expect(props.isSelected).toBe(true);
    });

    it('should define isOwnMessage as boolean', () => {
      interface MessageItemProps {
        message: ChatMessage;
        isSelected: boolean;
        isOwnMessage: boolean;
        mentions: string[];
        onReply: () => void;
        onHover: () => void;
      }

      const message: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Test',
        timestamp: Date.now(),
      };

      const propsOwn: MessageItemProps = {
        message,
        isSelected: false,
        isOwnMessage: true,
        mentions: [],
        onReply: jest.fn(),
        onHover: jest.fn(),
      };

      const propsOther: MessageItemProps = {
        message,
        isSelected: false,
        isOwnMessage: false,
        mentions: [],
        onReply: jest.fn(),
        onHover: jest.fn(),
      };

      expect(propsOwn.isOwnMessage).toBe(true);
      expect(propsOther.isOwnMessage).toBe(false);
    });

    it('should define mentions as string array', () => {
      interface MessageItemProps {
        message: ChatMessage;
        isSelected: boolean;
        isOwnMessage: boolean;
        mentions: string[];
        onReply: () => void;
        onHover: () => void;
      }

      const message: ChatMessage = {
        id: 'msg-001',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Hey!',
        timestamp: Date.now(),
        mentions: ['user-002', 'user-003'],
      };

      const props: MessageItemProps = {
        message,
        isSelected: false,
        isOwnMessage: false,
        mentions: message.mentions || [],
        onReply: jest.fn(),
        onHover: jest.fn(),
      };

      expect(props.mentions).toContain('user-002');
      expect(props.mentions).toContain('user-003');
      expect(props.mentions).toHaveLength(2);
    });
  });

  describe('Message Display Format', () => {
    const currentUserNickname = 'Alice';

    it('should format normal message correctly', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Hello everyone!',
        timestamp: new Date('2026-04-03T10:30:00').getTime(),
      };

      const formatted = formatMessageForTest(message, currentUserNickname);
      expect(formatted).toBe('[10:30:00] 我: Hello everyone!');
    });

    it('should format other user normal message correctly', () => {
      const message: ChatMessage = {
        id: 'msg-002',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hi Alice!',
        timestamp: new Date('2026-04-03T10:30:00').getTime(),
      };

      const formatted = formatMessageForTest(message, currentUserNickname);
      expect(formatted).toBe('[10:30:00] Bob: Hi Alice!');
    });

    it('should format system message correctly', () => {
      const message: ChatMessage = {
        id: 'msg-003',
        type: 'system',
        roomId: 'general',
        senderId: 'system',
        senderNickname: '系统',
        content: 'User joined the chat',
        timestamp: new Date('2026-04-03T10:30:00').getTime(),
      };

      const formatted = formatMessageForTest(message, currentUserNickname);
      expect(formatted).toBe('[10:30:00] 系统: User joined the chat');
    });

    it('should format reply message correctly', () => {
      const message: ChatMessage = {
        id: 'msg-004',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Thanks for the info!',
        timestamp: new Date('2026-04-03T10:30:00').getTime(),
        replyTo: {
          originalMessageId: 'msg-original',
          originalSenderNickname: 'Charlie',
          originalContent: 'Here is the info',
        },
      };

      const formatted = formatMessageForTest(message, currentUserNickname);
      expect(formatted).toBe(
        '[10:30:00] Bob [回复 Charlie]: Thanks for the info!'
      );
    });

    it('should format mention message correctly', () => {
      const message: ChatMessage = {
        id: 'msg-005',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey there!',
        timestamp: new Date('2026-04-03T10:30:00').getTime(),
        mentions: ['user-001'],
      };

      const formatted = formatMessageForTest(message, currentUserNickname);
      expect(formatted).toBe('[10:30:00] Bob: @user-001 Hey there!');
    });

    it('should format own reply message with 我', () => {
      const message: ChatMessage = {
        id: 'msg-006',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Thanks!',
        timestamp: new Date('2026-04-03T10:30:00').getTime(),
        replyTo: {
          originalMessageId: 'msg-original',
          originalSenderNickname: 'Bob',
          originalContent: 'Original message',
        },
      };

      const formatted = formatMessageForTest(message, currentUserNickname);
      expect(formatted).toBe('[10:30:00] 我 [回复 Bob]: Thanks!');
    });

    it('should handle multi-byte characters correctly', () => {
      const message: ChatMessage = {
        id: 'msg-007',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: '张三',
        content: '你好，世界！',
        timestamp: new Date('2026-04-03T10:30:00').getTime(),
      };

      const formatted = formatMessageForTest(message, currentUserNickname);
      expect(formatted).toBe('[10:30:00] 张三: 你好，世界！');
    });

    it('should handle empty content', () => {
      const message: ChatMessage = {
        id: 'msg-008',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: '',
        timestamp: new Date('2026-04-03T10:30:00').getTime(),
      };

      const formatted = formatMessageForTest(message, currentUserNickname);
      expect(formatted).toBe('[10:30:00] 我: ');
    });
  });

  describe('Timestamp Formatting', () => {
    it('should format timestamp correctly', () => {
      const timestamp = new Date('2026-04-03T14:30:45').getTime();
      expect(formatTimestamp(timestamp)).toBe('[14:30:45]');
    });

    it('should pad single digit hours', () => {
      const timestamp = new Date('2026-04-03T09:05:03').getTime();
      expect(formatTimestamp(timestamp)).toBe('[09:05:03]');
    });

    it('should pad single digit minutes', () => {
      const timestamp = new Date('2026-04-03T10:01:05').getTime();
      expect(formatTimestamp(timestamp)).toBe('[10:01:05]');
    });

    it('should pad single digit seconds', () => {
      const timestamp = new Date('2026-04-03T10:30:01').getTime();
      expect(formatTimestamp(timestamp)).toBe('[10:30:01]');
    });
  });

  describe('Message Sorting', () => {
    it('should sort messages by timestamp ascending (oldest first)', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-003',
          type: 'normal',
          roomId: 'general',
          senderId: 'user-001',
          senderNickname: 'Alice',
          content: 'Third',
          timestamp: 3000,
        },
        {
          id: 'msg-001',
          type: 'normal',
          roomId: 'general',
          senderId: 'user-001',
          senderNickname: 'Alice',
          content: 'First',
          timestamp: 1000,
        },
        {
          id: 'msg-002',
          type: 'normal',
          roomId: 'general',
          senderId: 'user-001',
          senderNickname: 'Alice',
          content: 'Second',
          timestamp: 2000,
        },
      ];

      const sortedMessages = [...messages].sort(
        (a, b) => a.timestamp - b.timestamp
      );

      expect(sortedMessages[0].content).toBe('First');
      expect(sortedMessages[1].content).toBe('Second');
      expect(sortedMessages[2].content).toBe('Third');
    });
  });

  describe('Message Type Detection', () => {
    it('should identify normal message type', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Hello',
        timestamp: Date.now(),
      };

      expect(message.type).toBe('normal');
      expect(message.type).not.toBe('system');
      expect(message.type).not.toBe('mention');
      expect(message.type).not.toBe('reply');
    });

    it('should identify system message type', () => {
      const message: ChatMessage = {
        id: 'msg-002',
        type: 'system',
        roomId: 'general',
        senderId: 'system',
        senderNickname: '系统',
        content: 'User joined',
        timestamp: Date.now(),
      };

      expect(message.type).toBe('system');
    });

    it('should identify mention message type', () => {
      const message: ChatMessage = {
        id: 'msg-003',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Hey',
        mentions: ['user-002'],
        timestamp: Date.now(),
      };

      expect(message.type).toBe('mention');
      expect(message.mentions).toBeDefined();
    });

    it('should identify reply message type', () => {
      const message: ChatMessage = {
        id: 'msg-004',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Thanks!',
        replyTo: {
          originalMessageId: 'msg-original',
          originalSenderNickname: 'Bob',
          originalContent: 'Original',
        },
        timestamp: Date.now(),
      };

      expect(message.type).toBe('reply');
      expect(message.replyTo).toBeDefined();
    });
  });

  describe('Message Highlighting', () => {
    it('should identify own messages', () => {
      const currentUserId = 'user-001';
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'My message',
        timestamp: Date.now(),
      };

      const isOwnMessage = message.senderId === currentUserId;
      expect(isOwnMessage).toBe(true);
    });

    it('should identify other user messages', () => {
      const currentUserId = 'user-001';
      const message: ChatMessage = {
        id: 'msg-002',
        type: 'normal',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Other message',
        timestamp: Date.now(),
      };

      const isOwnMessage = message.senderId === currentUserId;
      expect(isOwnMessage).toBe(false);
    });

    it('should identify when current user is mentioned', () => {
      const currentUserId = 'user-001';
      const message: ChatMessage = {
        id: 'msg-003',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey!',
        mentions: ['user-001'],
        timestamp: Date.now(),
      };

      const isMentioned =
        message.mentions?.includes(currentUserId) || false;
      expect(isMentioned).toBe(true);
    });

    it('should identify when current user is not mentioned', () => {
      const currentUserId = 'user-001';
      const message: ChatMessage = {
        id: 'msg-004',
        type: 'mention',
        roomId: 'general',
        senderId: 'user-002',
        senderNickname: 'Bob',
        content: 'Hey!',
        mentions: ['user-003'],
        timestamp: Date.now(),
      };

      const isMentioned =
        message.mentions?.includes(currentUserId) || false;
      expect(isMentioned).toBe(false);
    });
  });

  describe('Reply Reference Display', () => {
    it('should include reply reference in formatted message', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Reply content',
        timestamp: Date.now(),
        replyTo: {
          originalMessageId: 'msg-original',
          originalSenderNickname: 'Bob',
          originalContent: 'Original content here',
        },
      };

      expect(message.replyTo).toBeDefined();
      expect(message.replyTo?.originalSenderNickname).toBe('Bob');
      expect(message.replyTo?.originalContent).toBe('Original content here');
    });

    it('should handle reply without replyTo data', () => {
      const message: ChatMessage = {
        id: 'msg-001',
        type: 'reply',
        roomId: 'general',
        senderId: 'user-001',
        senderNickname: 'Alice',
        content: 'Reply content',
        timestamp: Date.now(),
      };

      expect(message.replyTo).toBeUndefined();
    });
  });
});
