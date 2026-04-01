import { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { eventBus } from "../../services/EventBus.js";

interface SystemBarProps {
  roomId: string | null;
  memberCount: number;
}

export function SystemBar({ roomId, memberCount }: SystemBarProps) {
  const [zkStatus, setZkStatus] = useState<"connected" | "disconnected" | "reconnected">("connected");

  useEffect(() => {
    const onDisconnected = () => {
      setZkStatus("disconnected");
    };

    const onReconnected = () => {
      setZkStatus("reconnected");
      // Reset to connected after 3 seconds
      setTimeout(() => {
        setZkStatus("connected");
      }, 3000);
    };

    eventBus.on("zk-disconnected", onDisconnected);
    eventBus.on("zk-reconnected", onReconnected);

    return () => {
      eventBus.off("zk-disconnected", onDisconnected);
      eventBus.off("zk-reconnected", onReconnected);
    };
  }, []);

  const getStatusText = () => {
    switch (zkStatus) {
      case "connected":
        return <Text color="green">● 已连接</Text>;
      case "disconnected":
        return <Text color="yellow">● 断开中</Text>;
      case "reconnected":
        return <Text color="green">● 已重连</Text>;
    }
  };

  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      paddingY={1}
      flexDirection="column"
      width="100%"
    >
      <Box justifyContent="space-between" width="100%">
        <Box>
          <Text bold>chat-room</Text>
          {roomId && (
            <>
              <Text> - </Text>
              <Text color="cyan">{roomId}</Text>
            </>
          )}
        </Box>
        <Box gap={2}>
          {roomId && (
            <Text>
              在线: <Text color="blue">{memberCount}</Text>
            </Text>
          )}
          {getStatusText()}
        </Box>
      </Box>
    </Box>
  );
}
