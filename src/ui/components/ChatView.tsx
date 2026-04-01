import { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { Box, Text } from "ink";
import type { ChatMessage } from "../../services/types.js";
import { eventBus } from "../../services/EventBus.js";
import { MentionService } from "../../services/MentionService.js";

export interface ChatViewRef {
  moveSelection: (direction: "up" | "down") => void;
  confirmSelection: () => void;
  exitSelectMode: () => void;
}

interface ChatViewProps {
  roomId: string;
  currentUserId: string;
  messages: ChatMessage[];
  mentionService: MentionService;
  onMessageSelect?: (message: ChatMessage) => void;
}

export const ChatView = forwardRef<ChatViewRef, ChatViewProps>(({ roomId, currentUserId, messages, mentionService, onMessageSelect }: ChatViewProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Format timestamp to HH:mm:ss
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  // Format message for display
  const formatMessage = useCallback(
    (msg: ChatMessage): string => {
      const time = formatTime(msg.timestamp);
      const isSelf = msg.senderId === currentUserId;

      switch (msg.type) {
        case "text":
          if (isSelf) {
            return `[${time}] 我: ${msg.content}`;
          }
          return `[${time}] ${msg.senderNickname}: ${msg.content}`;

        case "system":
        case "join":
        case "leave":
        case "rename":
          return `[${time}] 系统: ${msg.content}`;

        case "reply":
          const prefix = isSelf ? "我" : msg.senderNickname;
          const quote = msg.replyTo
            ? `[回复 ${msg.replyTo.senderNickname}: ${msg.replyTo.content}]`
            : "";
          return `[${time}] ${prefix} ${quote}: ${msg.content}`;

        default:
          return "";
      }
    },
    [currentUserId]
  );

  // Truncate text for reply preview
  const truncate = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  };

  // Check if message is mentioned
  const isMentioned = useCallback(
    (msg: ChatMessage): boolean => {
      return mentionService.isMentioned(msg, currentUserId);
    },
    [mentionService, currentUserId]
  );

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (data: unknown) => {
      // Keyboard handling is done at parent level
      // This component just displays selection state
    };

    // Handle selection from parent
    if (isSelectMode && messages.length > 0) {
      if (selectedIndex >= messages.length) {
        setSelectedIndex(messages.length - 1);
      }
    }

    return () => {};
  }, [isSelectMode, selectedIndex, messages.length]);

  const moveSelection = useCallback((direction: "up" | "down") => {
    if (!isSelectMode) {
      setIsSelectMode(true);
      setSelectedIndex(direction === "up" ? messages.length - 1 : 0);
      return;
    }

    if (direction === "up" && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    } else if (direction === "down" && selectedIndex < messages.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  }, [isSelectMode, selectedIndex, messages.length]);

  const confirmSelection = useCallback(() => {
    if (isSelectMode && selectedIndex >= 0 && selectedIndex < messages.length) {
      const selectedMsg = messages[selectedIndex];
      if (onMessageSelect) {
        onMessageSelect(selectedMsg);
      }
      exitSelectMode();
    }
  }, [isSelectMode, selectedIndex, messages, onMessageSelect]);

  const exitSelectMode = useCallback(() => {
    setIsSelectMode(false);
    setSelectedIndex(-1);
  }, []);

  // Expose keyboard handlers to parent via ref
  useImperativeHandle(ref, () => ({
    moveSelection,
    confirmSelection,
    exitSelectMode,
  }), [moveSelection, confirmSelection, exitSelectMode]);

  // Flash terminal title on new message
  useEffect(() => {
    const handleNewMessage = () => {
      // Flash terminal title
      process.stdout.write("\x1b]2;🔔 新消息\x07");
      setTimeout(() => {
        process.stdout.write("\x1b]2;chat-room\x07");
      }, 2000);
    };

    eventBus.on("new-message", handleNewMessage);

    return () => {
      eventBus.off("new-message", handleNewMessage);
    };
  }, []);

  if (messages.length === 0) {
    return (
      <Box flexGrow={1} paddingX={1} justifyContent="center" alignItems="center">
        <Text dimColor>暂无消息，开始聊天吧！</Text>
      </Box>
    );
  }

  return (
    <Box
      flexGrow={1}
      flexDirection="column"
      paddingX={1}
      overflow="hidden"
    >
      {messages.map((msg, index) => {
        const formatted = formatMessage(msg);
        const mentioned = isMentioned(msg);
        const selected = isSelectMode && index === selectedIndex;

        return (
          <Box key={msg.id} marginBottom={index === messages.length - 1 ? 0 : 1}>
            <Text
              color={
                selected
                  ? "blue"
                  : mentioned
                  ? "yellow"
                  : msg.type === "system" || msg.type === "join" || msg.type === "leave" || msg.type === "rename"
                  ? "gray"
                  : msg.senderId === currentUserId
                  ? "green"
                  : undefined
              }
              bold={selected}
              inverse={selected}
            >
              {formatted}
            </Text>
            {selected && (
              <Text color="blue" dimColor>
                {" "}[回复 (Enter)]
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
});

ChatView.displayName = "ChatView";
