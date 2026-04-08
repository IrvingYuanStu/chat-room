/**
 * App Component - Main application component with screen routing
 * M1.8.4: Route between ConfigScreen, RoomSelectScreen, and ChatScreen
 */

import React, { useState, useEffect } from 'react';
import { Box } from 'ink';
import { Config, Member } from '../services/types';
import { EventBus, getEventBus } from '../services/EventBus';
import { ConfigScreen } from './screens/ConfigScreen';
import { RoomSelectScreen } from './screens/RoomSelectScreen';
import { ConnectionStatus } from './components/SystemBar';
import { ChatScreen } from './screens/ChatScreen';
import { ZKClient } from '../network/ZKClient';
import { MemberService } from '../services/MemberService';
import { RoomService, UserInfo } from '../services/RoomService';
import { ChatService } from '../services/ChatService';
import { P2PTransport } from '../network/P2PTransport';
import { P2PServer } from '../network/P2PServer';
import { PeerService } from '../services/PeerService';
import { ChatMessage, P2PMessage, ChatPayload } from '../services/types';

export type Screen = 'config' | 'roomSelect' | 'chat';

export interface AppProps {
  initialConfig?: Partial<Config>;
  /** ZooKeeper client instance */
  zkClient?: ZKClient;
  /** Callback to quit the entire application with full cleanup */
  onQuitApp?: () => void;
  /** Whether the app should handle quit internally (for CLI mode) */
  internalQuit?: boolean;
}

export interface AppState {
  screen: Screen;
  config: Config | null;
  currentRoomId: string | null;
  connectionStatus: ConnectionStatus;
  recentRooms: string[];
  currentMembers: Member[];
}

// Generate a unique user ID for this instance
function generateUserId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * App - Main application component with screen routing
 */
export const App: React.FC<AppProps> = ({ initialConfig, zkClient, onQuitApp, internalQuit = false }) => {
  const [state, setState] = useState<AppState>({
    screen: initialConfig ? 'roomSelect' : 'config',
    config: initialConfig ? {
      zkAddresses: initialConfig.zkAddresses || ['127.0.0.1:2181'],
      currentRoomId: initialConfig.currentRoomId || '',
      nickname: initialConfig.nickname || 'User001',
      recentRooms: initialConfig.recentRooms || [],
      port: initialConfig.port || 9001,
      dataDir: initialConfig.dataDir || '/tmp/chat-room',
      logDir: initialConfig.logDir || '/tmp/chat-room/logs',
      logLevel: initialConfig.logLevel || 'info'
    } : null,
    currentRoomId: null,
    connectionStatus: 'disconnected',
    recentRooms: initialConfig?.recentRooms || [],
    currentMembers: []
  });

  const eventBus = getEventBus();

  // Initialize connection status from zkClient if already connected
  // This handles the case where zkClient.connect() completed before App mounted
  useEffect(() => {
    if (zkClient && zkClient.isConnected()) {
      setState(prev => ({ ...prev, connectionStatus: 'connected' }));
    }
  }, [zkClient]);

  // Services - created when zkClient is available
  const [memberService] = useState<MemberService | null>(() =>
    zkClient ? new MemberService(eventBus, zkClient) : null
  );
  const [roomService, setRoomService] = useState<RoomService | null>(null);
  const [userId] = useState<string>(() => generateUserId());

  // P2P Services
  const [p2pTransport] = useState<P2PTransport>(() => new P2PTransport());
  const [p2pServer] = useState<P2PServer>(() => new P2PServer(p2pTransport));
  const [peerService, setPeerService] = useState<PeerService | null>(null);
  const [chatService, setChatService] = useState<ChatService | null>(null);

  // Initialize RoomService when zkClient and config are available
  useEffect(() => {
    if (zkClient && state.config && memberService && !roomService) {
      const userInfo: UserInfo = {
        userId: userId,
        nickname: state.config.nickname || 'User001',
        ip: '127.0.0.1',
        port: state.config.port || 9001
      };
      const rs = new RoomService(zkClient, memberService, eventBus, userInfo);
      setRoomService(rs);
    }
  }, [zkClient, state.config, memberService, roomService, userId, eventBus]);

  // Subscribe to events
  useEffect(() => {
    const unsubscribeZKConnected = eventBus.subscribe('zk_connected', () => {
      setState(prev => ({ ...prev, connectionStatus: 'connected' }));
    });

    const unsubscribeZKDisconnected = eventBus.subscribe('zk_disconnected', () => {
      setState(prev => ({ ...prev, connectionStatus: 'disconnected' }));
    });

    const unsubscribeZKReconnecting = eventBus.subscribe('zk_reconnected', () => {
      setState(prev => ({ ...prev, connectionStatus: 'connected' }));
    });

    // Subscribe to member events to update currentMembers
    const unsubscribeMemberJoin = eventBus.subscribe('member_join', (member: Member) => {
      setState(prev => {
        const exists = prev.currentMembers.some(m => m.userId === member.userId);
        if (exists) {
          return {
            ...prev,
            currentMembers: prev.currentMembers.map(m => m.userId === member.userId ? member : m)
          };
        }
        return {
          ...prev,
          currentMembers: [...prev.currentMembers, member]
        };
      });
    });

    const unsubscribeMemberLeave = eventBus.subscribe('member_leave', ({ userId: leaveUserId }: { userId: string }) => {
      setState(prev => ({
        ...prev,
        currentMembers: prev.currentMembers.filter(m => m.userId !== leaveUserId)
      }));
    });

    return () => {
      unsubscribeZKConnected();
      unsubscribeZKDisconnected();
      unsubscribeZKReconnecting();
      unsubscribeMemberJoin();
      unsubscribeMemberLeave();
    };
  }, [eventBus]);

  // Start P2P server when config is available
  useEffect(() => {
    if (state.config) {
      const port = state.config.port || 9001;
      p2pServer.start(port).catch((error) => {
        console.error('Failed to start P2P server:', error);
      });
    }

    return () => {
      p2pServer.stop().catch(console.error);
    };
  }, [state.config, p2pServer]);

  // Create PeerService when we have the server info
  useEffect(() => {
    if (state.config) {
      const port = state.config.port || 9001;
      const ps = new PeerService(p2pTransport, '127.0.0.1', port);
      setPeerService(ps);
    }
  }, [state.config, p2pTransport]);

  // Create ChatService when we have all dependencies
  useEffect(() => {
    if (peerService && state.config && state.currentRoomId) {
      const cs = new ChatService(peerService, eventBus, {
        userId,
        nickname: state.config.nickname || 'User001',
        roomId: state.currentRoomId,
      });
      setChatService(cs);
    }
  }, [peerService, state.config, state.currentRoomId, userId, eventBus]);

  // Wire up P2P server to handle incoming messages
  useEffect(() => {
    const handleMessage = (p2pMessage: P2PMessage) => {
      // Only handle 'chat' type messages
      if (p2pMessage.type !== 'chat') {
        return;
      }

      // Ignore messages from ourselves (they were already published by ChatService)
      if (p2pMessage.senderId === userId) {
        return;
      }

      // Type guard: ensure payload is ChatPayload
      const payload = p2pMessage.payload as ChatPayload;
      if (!payload.messageId || !payload.content) {
        return;
      }

      // Convert P2PMessage to ChatMessage for local display
      const chatMessage: ChatMessage = {
        id: payload.messageId,
        type: 'normal',
        roomId: p2pMessage.roomId,
        senderId: p2pMessage.senderId,
        senderNickname: p2pMessage.senderNickname,
        content: payload.content,
        timestamp: p2pMessage.timestamp,
        replyTo: payload.replyTo ? {
          originalMessageId: payload.replyTo.originalMessageId,
          originalSenderNickname: payload.replyTo.originalSenderNickname,
          originalContent: payload.replyTo.originalContent,
        } : undefined,
        mentions: payload.mentions,
      };
      eventBus.publish('message', chatMessage);
    };

    // Register the handler and store the unsubscribe function
    const unsubscribe = p2pServer.onMessage(handleMessage);

    // Cleanup: unregister the handler when effect re-runs or unmounts
    return () => {
      unsubscribe();
    };
  }, [p2pServer, eventBus, userId]);

  // Handle config completion
  const handleConfigComplete = (config: Config) => {
    setState(prev => ({
      ...prev,
      screen: 'roomSelect',
      config,
      recentRooms: config.recentRooms || []
    }));
  };

  // Handle room selection - join the room and load members
  const handleSelectRoom = async (roomId: string) => {
    if (roomService && memberService) {
      try {
        await roomService.joinRoom(roomId);
        // Get initial members from the service
        const members = memberService.getMembers();
        setState(prev => ({
          ...prev,
          screen: 'chat',
          currentRoomId: roomId,
          recentRooms: prev.recentRooms.includes(roomId)
            ? prev.recentRooms
            : [roomId, ...prev.recentRooms].slice(0, 10),
          currentMembers: members
        }));
      } catch (error) {
        console.error('Failed to join room:', error);
        // Still transition to chat screen but with empty members
        setState(prev => ({
          ...prev,
          screen: 'chat',
          currentRoomId: roomId,
          recentRooms: prev.recentRooms.includes(roomId)
            ? prev.recentRooms
            : [roomId, ...prev.recentRooms].slice(0, 10),
          currentMembers: []
        }));
      }
    } else {
      // No roomService available yet, just transition
      setState(prev => ({
        ...prev,
        screen: 'chat',
        currentRoomId: roomId,
        recentRooms: prev.recentRooms.includes(roomId)
          ? prev.recentRooms
          : [roomId, ...prev.recentRooms].slice(0, 10),
        currentMembers: []
      }));
    }
  };

  // Handle room creation
  const handleCreateRoom = (roomId: string) => {
    handleSelectRoom(roomId);
  };

  // Handle back navigation
  const handleBack = () => {
    // From config screen, there's nowhere to go
    // But we need this for RoomSelectScreen
  };

  // Handle exit room
  const handleExitRoom = () => {
    setState(prev => ({
      ...prev,
      screen: 'roomSelect',
      currentRoomId: null,
      currentMembers: []
    }));
  };

  // Handle quit application - triggers full cleanup
  const handleQuitApp = () => {
    // Call the onQuitApp callback if provided
    if (onQuitApp) {
      onQuitApp();
    } else if (internalQuit) {
      // If internal quit mode, just exit
      process.exit(0);
    }
  };

  // Render current screen
  const renderScreen = () => {
    switch (state.screen) {
      case 'config':
        return (
          <ConfigScreen
            onConfigComplete={handleConfigComplete}
            initialConfig={state.config || undefined}
          />
        );

      case 'roomSelect':
        return (
          <RoomSelectScreen
            rooms={[]} // Will be populated from ZK in M1.7
            recentRooms={state.recentRooms}
            onSelectRoom={handleSelectRoom}
            onCreateRoom={handleCreateRoom}
            onBack={handleBack}
          />
        );

      case 'chat':
        return (
          <ChatScreen
            roomId={state.currentRoomId || 'unknown'}
            onExitRoom={handleExitRoom}
            onQuitApp={handleQuitApp}
            members={state.currentMembers}
            connectionStatus={state.connectionStatus}
            currentUserId={userId}
            currentUserNickname={state.config?.nickname || 'User001'}
            chatService={chatService}
            onlineMembers={state.currentMembers.filter(m => m.status === 'online')}
          />
        );
    }
  };

  return (
    <Box flexDirection="column">
      {/* Main Content */}
      <Box flexGrow={1}>
        {renderScreen()}
      </Box>
    </Box>
  );
};

export default App;
