import { useEffect, useState, useCallback, useRef } from "react";
import { Box, Text } from "ink";
import { useInput } from "ink";
import type { ChatMessage, ReplyToInfo } from "../../services/types.js";
import { SystemBar } from "../components/SystemBar.js";
import { ChatView, type ChatViewRef } from "../components/ChatView.js";
import { MemberList } from "../components/MemberList.js";
import { InputBox, type InputBoxRef } from "../components/InputBox.js";
import { RoomService } from "../../services/RoomService.js";
import { ChatService } from "../../services/ChatService.js";
import { MemberService } from "../../services/MemberService.js";
import { MentionService } from "../../services/MentionService.js";
import { ConfigService } from "../../services/ConfigService.js";
import { HistoryService } from "../../services/HistoryService.js";
import { PeerService } from "../../services/PeerService.js";
import { eventBus } from "../../services/EventBus.js";

interface ChatScreenProps {
  roomId: string;
  roomService: RoomService;
  chatService: ChatService;
  memberService: MemberService;
  mentionService: MentionService;
  configService: ConfigService;
  historyService: HistoryService;
  peerService: PeerService;
  onExitRoom: () => void;
  onQuit: () => void;
}

export function ChatScreen({
  roomId,
  roomService,
  chatService,
  memberService,
  mentionService,
  configService,
  historyService,
  peerService,
  onExitRoom,
  onQuit,
}: ChatScreenProps) {
  const chatViewRef = useRef<ChatViewRef>(null);
  const inputBoxRef = useRef<InputBoxRef>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [confirmExit, setConfirmExit] = useState(false);
  const [memberCount, setMemberCount] = useState(0);

  const currentUserId = configService.getUserId();
  const nickname = configService.getNickname();

  // Load history on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await historyService.loadHistory(roomId);
        setMessages(history);
        roomService.setMessages(roomId, history);
      } catch (err) {
        console.warn("Failed to load history:", err);
      }
    };

    loadHistory();
  }, [roomId, historyService, roomService]);

  // Subscribe to new messages
  useEffect(() => {
    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.roomId === roomId) {
        setMessages((prev) => {
          const next = [...prev, msg];
          // Trim to max 500 messages
          if (next.length > 500) {
            return next.slice(-500);
          }
          return next;
        });

        // Also update room service cache
        roomService.addMessage(roomId, msg);
      }
    };

    eventBus.on("new-message", handleNewMessage);

    return () => {
      eventBus.off("new-message", handleNewMessage);
    };
  }, [roomId, roomService]);

  // Subscribe to member count changes
  useEffect(() => {
    const handleMembersChanged = (changedRoomId: string) => {
      if (changedRoomId === roomId) {
        setMemberCount(memberService.getMemberCount(roomId));
      }
    };

    // Initial count
    setMemberCount(memberService.getMemberCount(roomId));

    eventBus.on("members-changed", handleMembersChanged);

    return () => {
      eventBus.off("members-changed", handleMembersChanged);
    };
  }, [roomId, memberService]);

  // Handle message send
  const handleSend = useCallback(
    async (content: string, replyTo?: ReplyToInfo) => {
      try {
        await chatService.send(roomId, content, replyTo);
      } catch (err) {
        console.error("Failed to send message:", err);
        const errorMsg: ChatMessage = {
          id: Date.now().toString(),
          type: "system",
          senderId: "system",
          senderNickname: "系统",
          content: `发送失败: ${err instanceof Error ? err.message : String(err)}`,
          roomId,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    },
    [roomId, chatService]
  );

  // Handle command input
  const handleCommand = useCallback(
    async (command: string) => {
      const parts = command.trim().split(/\s+/);
      const cmd = parts[0]?.toLowerCase();
      const args = parts.slice(1);

      switch (cmd) {
        case "/rename": {
          const newNickname = args.join(" ");
          if (!newNickname) {
            const errorMsg: ChatMessage = {
              id: Date.now().toString(),
              type: "system",
              senderId: "system",
              senderNickname: "系统",
              content: "用法: /rename 新昵称",
              roomId,
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, errorMsg]);
            return;
          }

          try {
            const oldNickname = configService.getNickname();
            await configService.updateNickname(newNickname);
            await chatService.sendRename(roomId, oldNickname, newNickname);

            const successMsg: ChatMessage = {
              id: Date.now().toString(),
              type: "system",
              senderId: "system",
              senderNickname: "系统",
              content: `昵称已修改: ${oldNickname} → ${newNickname}`,
              roomId,
              timestamp: Date.now(),
            };
            setMessages((prev) => [...prev, successMsg]);
          } catch (err) {
            console.error("Failed to rename:", err);
          }
          break;
        }

        case "/exit-room": {
          setConfirmExit(true);
          break;
        }

        case "/quit": {
          onQuit();
          break;
        }

        default: {
          const errorMsg: ChatMessage = {
            id: Date.now().toString(),
            type: "system",
            senderId: "system",
            senderNickname: "系统",
            content: `未知命令: ${cmd}. 可用命令: /rename, /exit-room, /quit`,
            roomId,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, errorMsg]);
          break;
        }
      }
    },
    [roomId, configService, chatService, onQuit]
  );

  // Handle exit confirmation
  const handleExitConfirm = useCallback(async (key: string) => {
    if (key === "y" || key === "Y") {
      try {
        await chatService.sendLeave(roomId);
        await peerService.disconnectAll(roomId);
        await roomService.leaveRoom(roomId);
        onExitRoom();
      } catch (err) {
        console.error("Failed to leave room:", err);
      }
    } else if (key === "n" || key === "N" || key === "escape") {
      setConfirmExit(false);
    }
  }, [roomId, roomService, chatService, peerService, onExitRoom]);

  // Handle keyboard input
  useInput((input, key) => {
    if (confirmExit) {
      if (input === "y" || input === "Y") {
        handleExitConfirm(input);
      } else if (input === "n" || input === "N" || key.escape) {
        handleExitConfirm(input === "escape" ? "escape" : input);
      }
      return;
    }

    // Handle message selection navigation
    if (key.upArrow) {
      chatViewRef.current?.moveSelection("up");
    } else if (key.downArrow) {
      chatViewRef.current?.moveSelection("down");
    } else if (key.return && chatViewRef.current) {
      chatViewRef.current.confirmSelection();
    } else if (key.escape) {
      chatViewRef.current?.exitSelectMode();
      inputBoxRef.current?.handleEscape();
    } else if (key.shift && key.return) {
      inputBoxRef.current?.handleShiftEnter();
    }
  });

  // Handle message selection for reply
  const handleMessageSelect = useCallback(
    (message: ChatMessage) => {
      // Trigger reply mode in InputBox
      inputBoxRef.current?.setReplyTo(message);
    },
    []
  );

  return (
    <Box flexDirection="column" height="100%">
      {/* System Bar */}
      <SystemBar roomId={roomId} memberCount={memberCount} />

      {/* Main Content Area */}
      <Box flexGrow={1}>
        {/* Chat View (70% width) */}
        <Box
          flexGrow={1}
          flexDirection="column"
          borderStyle="single"
          borderColor="gray"
          marginRight={1}
        >
          {confirmExit ? (
            <Box
              flexGrow={1}
              justifyContent="center"
              alignItems="center"
              flexDirection="column"
            >
              <Text bold color="yellow">
                确定退出聊天室 {roomId}? (y/n)
              </Text>
            </Box>
          ) : (
            <>
              {/* Chat Messages (70% height) */}
              <Box flexGrow={7} flexDirection="column" overflow="hidden">
                <ChatView
                  ref={chatViewRef}
                  roomId={roomId}
                  currentUserId={currentUserId}
                  messages={messages}
                  mentionService={mentionService}
                  onMessageSelect={handleMessageSelect}
                />
              </Box>

              {/* Input Box (30% height) */}
              <Box flexGrow={3}>
                <InputBox
                  ref={inputBoxRef}
                  nickname={nickname}
                  roomId={roomId}
                  mentionService={mentionService}
                  onSend={handleSend}
                  onCommand={handleCommand}
                />
              </Box>
            </>
          )}
        </Box>

        {/* Member List (30% width) */}
        <Box width={30}>
          <MemberList roomId={roomId} memberService={memberService} />
        </Box>
      </Box>
    </Box>
  );
}
