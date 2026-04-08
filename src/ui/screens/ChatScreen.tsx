/**
 * ChatScreen Component - Main chat room screen
 * M2.6.4: Composes ChatView, MemberList, InputBox, and SystemBar
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import { ChatView } from '../components/ChatView';
import { MemberList } from '../components/MemberList';
import { InputBox } from '../components/InputBox';
import { SystemBar, ConnectionStatus } from '../components/SystemBar';
import { ChatMessage, Member, ReplyInfo } from '../../services/types';
import { EventBus, getEventBus } from '../../services/EventBus';
import { ChatService } from '../../services/ChatService';

export interface ChatScreenProps {
  roomId: string;
  onExitRoom: () => void;
  /** Callback to quit the entire application with full cleanup (M4.4.3) */
  onQuitApp?: () => void;
  /** Initial members list - passed from App */
  members?: Member[];
  /** Initial connection status - passed from App */
  connectionStatus?: ConnectionStatus;
  /** Current user ID - passed from App */
  currentUserId?: string;
  /** Current user nickname - passed from App */
  currentUserNickname?: string;
  /** ChatService for sending messages */
  chatService?: ChatService | null;
  /** Online members for @ mention autocomplete */
  onlineMembers?: Member[];
}

export interface ChatScreenState {
  messages: ChatMessage[];
  members: Member[];
  selectedMessageId: string | null;
  currentUserId: string;
  currentUserNickname: string;
  replyTo: ReplyInfo | null;
  connectionStatus: ConnectionStatus;
  messageCount: number;
  /** M4.4.2: Exit confirmation state - type of confirmation pending */
  pendingConfirmation: 'exit-room' | 'quit' | null;
}

/**
 * ChatScreen - Main chat room interface
 */
export const ChatScreen: React.FC<ChatScreenProps> = ({
  roomId,
  onExitRoom,
  onQuitApp,
  members: initialMembers = [],
  connectionStatus: initialConnectionStatus = 'disconnected',
  currentUserId: initialUserId = 'user-001',
  currentUserNickname: initialNickname = 'User001',
  chatService,
  onlineMembers = [],
}) => {
  const [state, setState] = useState<ChatScreenState>({
    messages: [],
    members: initialMembers,
    selectedMessageId: null,
    currentUserId: initialUserId,
    currentUserNickname: initialNickname,
    replyTo: null,
    connectionStatus: initialConnectionStatus,
    messageCount: 0,
    pendingConfirmation: null, // M4.4.2: No pending confirmation initially
  });

  const eventBus = getEventBus();

  // Subscribe to events
  useEffect(() => {
    const unsubscribeMessage = eventBus.subscribe(
      'message',
      (message: ChatMessage) => {
        setState((prev) => ({
          ...prev,
          messages: [...prev.messages, message],
          messageCount: prev.messageCount + 1,
        }));
      }
    );

    const unsubscribeMemberJoin = eventBus.subscribe(
      'member_join',
      (member: Member) => {
        setState((prev) => {
          // Check if member already exists
          const existingIndex = prev.members.findIndex(
            (m) => m.userId === member.userId
          );
          if (existingIndex >= 0) {
            // Update existing member
            const newMembers = [...prev.members];
            newMembers[existingIndex] = member;
            return { ...prev, members: newMembers };
          }
          // Add new member
          return { ...prev, members: [...prev.members, member] };
        });
      }
    );

    const unsubscribeMemberLeave = eventBus.subscribe(
      'member_leave',
      ({ userId }: { userId: string }) => {
        setState((prev) => ({
          ...prev,
          members: prev.members.filter((m) => m.userId !== userId),
        }));
      }
    );

    const unsubscribeNickChange = eventBus.subscribe(
      'nick_change',
      ({
        userId,
        newNickname,
      }: {
        userId: string;
        oldNickname: string;
        newNickname: string;
      }) => {
        setState((prev) => ({
          ...prev,
          members: prev.members.map((m) =>
            m.userId === userId ? { ...m, nickname: newNickname } : m
          ),
        }));
      }
    );

    const unsubscribeZKConnected = eventBus.subscribe(
      'zk_connected',
      () => {
        setState((prev) => ({ ...prev, connectionStatus: 'connected' }));
      }
    );

    const unsubscribeZKDisconnected = eventBus.subscribe(
      'zk_disconnected',
      () => {
        setState((prev) => ({ ...prev, connectionStatus: 'disconnected' }));
        // M4.2.1: Show disconnect warning as system message
        const warningMessage: ChatMessage = {
          id: `zk-warn-${Date.now()}`,
          type: 'system',
          roomId: roomId,
          senderId: 'system',
          senderNickname: '系统',
          content: 'ZooKeeper 连接断开，正在尝试重新连接...',
          timestamp: Date.now(),
        };
        eventBus.publish('message', warningMessage);
      }
    );

    const unsubscribeZKReconnected = eventBus.subscribe(
      'zk_reconnected',
      () => {
        setState((prev) => ({ ...prev, connectionStatus: 'connected' }));
        // M4.2.2: Show reconnect success as system message
        const successMessage: ChatMessage = {
          id: `zk-reconn-${Date.now()}`,
          type: 'system',
          roomId: roomId,
          senderId: 'system',
          senderNickname: '系统',
          content: 'ZooKeeper 重连成功',
          timestamp: Date.now(),
        };
        eventBus.publish('message', successMessage);
      }
    );

    return () => {
      unsubscribeMessage();
      unsubscribeMemberJoin();
      unsubscribeMemberLeave();
      unsubscribeNickChange();
      unsubscribeZKConnected();
      unsubscribeZKDisconnected();
      unsubscribeZKReconnected();
    };
  }, [eventBus]);

  // Handle message reply
  const handleReply = useCallback((messageId: string) => {
    setState((prev) => {
      const message = prev.messages.find((m) => m.id === messageId);
      if (!message) return prev;

      return {
        ...prev,
        selectedMessageId: messageId,
        replyTo: {
          originalMessageId: message.id,
          originalSenderNickname: message.senderNickname,
          originalContent: message.content,
        },
      };
    });
  }, []);

  // Handle mention click
  const handleMention = useCallback((userId: string) => {
    // Could open a DM or show user info
    console.log('Mention clicked:', userId);
  }, []);

  // Handle message submit
  const handleSubmit = useCallback(
    (content: string) => {
      // M4.4.2: Handle exit confirmation
      if (state.pendingConfirmation) {
        if (content.toLowerCase() === 'y') {
          // User confirmed
          if (state.pendingConfirmation === 'exit-room') {
            setState((prev) => ({ ...prev, pendingConfirmation: null }));
            onExitRoom();
          } else if (state.pendingConfirmation === 'quit') {
            setState((prev) => ({ ...prev, pendingConfirmation: null }));
            if (onQuitApp) {
              onQuitApp();
            } else {
              process.exit(0);
            }
          }
        } else {
          // User cancelled
          setState((prev) => ({ ...prev, pendingConfirmation: null }));
        }
        return;
      }

      // M4.4.1: Handle /exit-room command with confirmation
      if (content === '/exit-room') {
        setState((prev) => ({ ...prev, pendingConfirmation: 'exit-room' }));
        // Show confirmation prompt as system message
        const confirmMsg: ChatMessage = {
          id: `confirm-${Date.now()}`,
          type: 'system',
          roomId: roomId,
          senderId: 'system',
          senderNickname: '系统',
          content: '确定要退出当前聊天室吗？(y/n)',
          timestamp: Date.now(),
        };
        eventBus.publish('message', confirmMsg);
        return;
      }

      // M4.4.3: Handle /quit command with confirmation
      if (content === '/quit') {
        setState((prev) => ({ ...prev, pendingConfirmation: 'quit' }));
        // Show confirmation prompt as system message
        const confirmMsg: ChatMessage = {
          id: `confirm-${Date.now()}`,
          type: 'system',
          roomId: roomId,
          senderId: 'system',
          senderNickname: '系统',
          content: '确定要退出程序吗？(y/n)',
          timestamp: Date.now(),
        };
        eventBus.publish('message', confirmMsg);
        return;
      }

      // Handle /rename command
      const renameMatch = content.match(/^\/rename\s+(.+)$/);
      if (renameMatch) {
        const newNickname = renameMatch[1].trim();
        if (newNickname.length > 0 && newNickname.length <= 32) {
          eventBus.publish('nick_change', {
            userId: state.currentUserId,
            oldNickname: state.currentUserNickname,
            newNickname,
          });
          setState((prev) => ({ ...prev, currentUserNickname: newNickname }));
          // Update nickname in chatService
          if (chatService) {
            chatService.updateNickname(newNickname);
          }
        }
        return;
      }

      // Send regular message
      if (chatService) {
        chatService.sendMessage(content, state.replyTo || undefined);
      } else {
        console.error('ChatService not available, cannot send message');
      }

      // Clear reply state after sending
      setState((prev) => ({ ...prev, replyTo: null }));
    },
    [onExitRoom, onQuitApp, eventBus, state.currentUserId, state.currentUserNickname, state.pendingConfirmation, roomId, chatService, state.replyTo]
  );

  // Handle member click
  const handleMemberClick = useCallback((userId: string) => {
    // Could show user details or start a DM
    console.log('Member clicked:', userId);
  }, []);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* System Bar - Header */}
      <SystemBar
        roomId={roomId}
        isConnected={state.connectionStatus === 'connected'}
        connectionStatus={state.connectionStatus}
        messageCount={state.messageCount}
      />

      {/* Main Content Area */}
      <Box flexGrow={1} flexDirection="row">
        {/* Left: Chat Area */}
        <Box flexDirection="column" flexGrow={1} marginRight={1}>
          {/* ChatView */}
          <Box flexGrow={1}>
            <ChatView
              messages={state.messages}
              selectedMessageId={state.selectedMessageId || undefined}
              currentUserId={state.currentUserId}
              onReply={handleReply}
              onMention={handleMention}
            />
          </Box>

          {/* InputBox */}
          <Box>
            <InputBox
              nickname={state.currentUserNickname}
              onSubmit={handleSubmit}
              onlineMembers={onlineMembers}
            />
          </Box>
        </Box>

        {/* Right: Member List */}
        <Box width={30}>
          <MemberList
            members={state.members}
            currentUserId={state.currentUserId}
            onMemberClick={handleMemberClick}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default ChatScreen;
