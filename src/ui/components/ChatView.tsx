/**
 * ChatView Component - Displays chat messages
 * M2.6.1: Show message list with formatting
 * M3.2.3: @ mention highlighting (yellow for mentioned messages)
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { ChatMessage } from '../../services/types';

export interface ChatViewProps {
  messages: ChatMessage[];
  selectedMessageId?: string;
  currentUserId: string;
  onReply: (messageId: string) => void;
  onMention: (userId: string) => void;
  /** Optional map of userId to nickname for display */
  userIdToNickname?: Map<string, string>;
}

export interface MessageItemProps {
  message: ChatMessage;
  isSelected: boolean;
  isOwnMessage: boolean;
  isMentioned: boolean;
  onReply: () => void;
  onHover: () => void;
  userIdToNickname?: Map<string, string>;
}

/**
 * Format timestamp to HH:mm:ss format
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `[${hours}:${minutes}:${seconds}]`;
}

/**
 * Get display mentions (convert userIds to nicknames)
 */
export function getDisplayMentions(
  mentions: string[] | undefined,
  userIdToNickname?: Map<string, string>
): string[] {
  if (!mentions) return [];
  return mentions.map(userId => {
    const nickname = userIdToNickname?.get(userId);
    return nickname ? `@${nickname}` : `@${userId}`;
  });
}

/**
 * Format a message for display
 */
export function formatMessage(
  message: ChatMessage,
  currentUserNickname: string,
  userIdToNickname?: Map<string, string>
): { time: string; text: string } {
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
      const displayMentions = getDisplayMentions(message.mentions, userIdToNickname);
      const mentionStr = displayMentions.join(' ');
      text = `${time} ${displayNickname}: ${mentionStr} ${message.content}`.trim();
      break;

    case 'normal':
    default:
      text = `${time} ${displayNickname}: ${message.content}`;
  }

  return { time, text };
}

/**
 * Check if a message should be highlighted (current user is mentioned)
 */
export function shouldHighlight(
  message: ChatMessage,
  currentUserId: string
): boolean {
  return message.mentions?.includes(currentUserId) || false;
}

/**
 * Check if current user sent the message
 */
export function isOwnMessage(
  message: ChatMessage,
  currentUserId: string
): boolean {
  return message.senderId === currentUserId;
}

/**
 * Get message text color based on message type and highlight status
 * M3.2.3: Yellow highlight for @mentions when current user is mentioned
 */
export function getMessageColor(
  message: ChatMessage,
  currentUserId: string
): 'white' | 'green' | 'gray' | 'yellow' {
  // Yellow for mentions when current user is mentioned
  if (message.type === 'mention' && shouldHighlight(message, currentUserId)) {
    return 'yellow';
  }

  // Gray for system messages
  if (message.type === 'system') {
    return 'gray';
  }

  // Green for own messages
  if (isOwnMessage(message, currentUserId)) {
    return 'green';
  }

  return 'white';
}

/**
 * MessageItem - Renders a single chat message
 * M3.2.3: Yellow highlight for @mentions when current user is mentioned
 */
export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isSelected,
  isOwnMessage,
  isMentioned,
  onReply,
  onHover,
  userIdToNickname,
}) => {
  const formatted = useMemo(
    () => formatMessage(message, '', userIdToNickname),
    [message, userIdToNickname]
  );

  // M3.2.3: Yellow for mentions when current user is mentioned
  // We need to check if the message is a mention type AND if current user is among the mentions
  const currentUserIsMentioned = message.type === 'mention' && isMentioned;
  const textColor = currentUserIsMentioned ? 'yellow' : getMessageColor(message, message.senderId);

  return (
    <Box
      flexDirection="column"
      paddingX={1}
      {...(isSelected ? { borderStyle: 'single' as const, borderColor: 'cyan' } : {})}
    >
      <Box>
        <Text
          color={textColor}
          bold={isSelected || currentUserIsMentioned}
          inverse={isSelected}
        >
          {formatted.text}
        </Text>
      </Box>
      {currentUserIsMentioned && !isSelected && (
        <Box>
          <Text dimColor italic>
            (mentioned)
          </Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * ChatView - Displays a list of chat messages
 * M3.2.3: @ mention highlighting - messages where current user is mentioned show in yellow
 */
export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  selectedMessageId,
  currentUserId,
  onReply,
  onMention,
  userIdToNickname,
}) => {
  // Sort messages by timestamp ascending (oldest first)
  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.timestamp - b.timestamp),
    [messages]
  );

  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      <Box flexDirection="column" overflow="visible">
        {sortedMessages.length === 0 ? (
          <Box padding={1}>
            <Text dimColor>No messages yet. Start the conversation!</Text>
          </Box>
        ) : (
          sortedMessages.map((message) => {
            const ownMessage = isOwnMessage(message, currentUserId);
            // M3.2.3: Check if current user is mentioned (for yellow highlighting)
            const isMentioned = shouldHighlight(message, currentUserId);

            return (
              <MessageItem
                key={message.id}
                message={message}
                isSelected={selectedMessageId === message.id}
                isOwnMessage={ownMessage}
                isMentioned={isMentioned}
                onReply={() => onReply(message.id)}
                onHover={() => {}}
                userIdToNickname={userIdToNickname}
              />
            );
          })
        )}
      </Box>
    </Box>
  );
};

export default ChatView;
