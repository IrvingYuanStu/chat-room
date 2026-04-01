import { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { ConfigScreen } from "./screens/ConfigScreen.js";
import { RoomSelectScreen } from "./screens/RoomSelectScreen.js";
import { ChatScreen } from "./screens/ChatScreen.js";
import { ConfigService } from "../services/ConfigService.js";
import { RoomService } from "../services/RoomService.js";
import { ChatService } from "../services/ChatService.js";
import { MemberService } from "../services/MemberService.js";
import { MentionService } from "../services/MentionService.js";
import { PeerService } from "../services/PeerService.js";
import { HistoryService } from "../services/HistoryService.js";
import { ZKClient } from "../network/ZKClient.js";
import { eventBus } from "../services/EventBus.js";
import type { AppConfig } from "../services/types.js";

type Screen = "config" | "room-select" | "chat";

interface AppProps {
  zkClient: ZKClient;
  configService: ConfigService;
  roomService: RoomService;
  chatService: ChatService;
  memberService: MemberService;
  mentionService: MentionService;
  peerService: PeerService;
  historyService: HistoryService;
}

export function App({
  zkClient,
  configService,
  roomService,
  chatService,
  memberService,
  mentionService,
  peerService,
  historyService,
}: AppProps) {
  const [screen, setScreen] = useState<Screen>("config");
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isShuttingDown, setIsShuttingDown] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Load config
        const loadedConfig = await configService.load();

        if (!loadedConfig) {
          // No config, show config screen
          setScreen("config");
          return;
        }

        setConfig(loadedConfig);

        // Connect to ZK
        await zkClient.connect(loadedConfig.zkAddresses);

        // Check if there's a current room
        if (loadedConfig.currentRoomId) {
          setCurrentRoomId(loadedConfig.currentRoomId);
          setScreen("chat");
        } else {
          setScreen("room-select");
        }
      } catch (err) {
        console.error("Failed to initialize:", err);
        // Show config screen on error
        setScreen("config");
      }
    };

    initialize();
  }, [zkClient, configService]);

  const handleConfigComplete = () => {
    const loadedConfig = configService.getConfig();
    if (loadedConfig) {
      setConfig(loadedConfig);
      setScreen("room-select");
    }
  };

  const handleRoomJoined = async (roomId: string) => {
    try {
      setCurrentRoomId(roomId);

      // Get config for peer info
      const config = configService.getConfig();
      if (!config) {
        throw new Error("No config available");
      }

      // Set local peer info
      peerService.setLocalInfo(
        config.userId,
        config.nickname,
        roomId,
        { ip: "127.0.0.1", port: config.p2pPort }
      );

      // Start P2P server
      const port = config.p2pPort;
      await peerService.startServer(port);

      setScreen("chat");
    } catch (err) {
      console.error("Failed to join room:", err);
    }
  };

  const handleExitRoom = async () => {
    try {
      if (currentRoomId) {
        await roomService.leaveRoom(currentRoomId);
      }
      setCurrentRoomId(null);
      setScreen("room-select");
    } catch (err) {
      console.error("Failed to exit room:", err);
    }
  };

  const handleQuit = async () => {
    setIsShuttingDown(true);
    try {
      // Leave current room if in one
      if (currentRoomId) {
        await chatService.sendLeave(currentRoomId);
        await peerService.disconnectAll(currentRoomId);
        await zkClient.leaveRoom(currentRoomId, configService.getNickname());
      }

      // Cleanup old messages
      if (currentRoomId) {
        await historyService.cleanupOldMessages(currentRoomId);
      }

      // Save config
      await configService.save();

      // Stop P2P server
      await peerService.stopServer();

      // Disconnect ZK
      await zkClient.disconnect();

      // Exit process
      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  };

  // Handle SIGINT/SIGTERM for graceful shutdown
  useEffect(() => {
    const handleSignal = async () => {
      await handleQuit();
    };

    process.on("SIGINT", handleSignal);
    process.on("SIGTERM", handleSignal);

    return () => {
      process.off("SIGINT", handleSignal);
      process.off("SIGTERM", handleSignal);
    };
  }, [currentRoomId]);

  if (isShuttingDown) {
    return (
      <Box paddingX={2}>
        <Text>
          <Text color="yellow">正在关闭...</Text>
        </Text>
      </Box>
    );
  }

  if (screen === "config") {
    return <ConfigScreen configService={configService} existingConfig={config} onComplete={handleConfigComplete} />;
  }

  if (screen === "room-select") {
    if (!config) {
      return (
        <Box paddingX={2}>
          <Text color="red">错误: 配置未加载</Text>
        </Box>
      );
    }

    return (
      <RoomSelectScreen
        roomService={roomService}
        recentRooms={config.recentRooms}
        onRoomJoined={handleRoomJoined}
      />
    );
  }

  if (screen === "chat") {
    if (!currentRoomId) {
      return (
        <Box paddingX={2}>
          <Text color="red">错误: 未选择聊天室</Text>
        </Box>
      );
    }

    return (
      <ChatScreen
        roomId={currentRoomId}
        roomService={roomService}
        chatService={chatService}
        memberService={memberService}
        mentionService={mentionService}
        configService={configService}
        historyService={historyService}
        peerService={peerService}
        onExitRoom={handleExitRoom}
        onQuit={handleQuit}
      />
    );
  }

  return (
    <Box paddingX={2}>
      <Text>Loading...</Text>
    </Box>
  );
}
