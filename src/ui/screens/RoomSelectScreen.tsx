import { useState, useEffect } from "react";
import { Box, Text, Spacer } from "ink";
import { useInput } from "ink";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import type { RoomInfo } from "../../services/types.js";
import { RoomService } from "../../services/RoomService.js";

interface RoomSelectScreenProps {
  roomService: RoomService;
  recentRooms: string[];
  onRoomJoined: (roomId: string) => void;
}

export function RoomSelectScreen({ roomService, recentRooms, onRoomJoined }: RoomSelectScreenProps) {
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [customRoomId, setCustomRoomId] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCustomMode, setIsCustomMode] = useState(false);

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      setError(null);
      const roomList = await roomService.listAvailableRooms();
      setRooms(roomList);

      // If there are recent rooms, prioritize the first one
      if (recentRooms.length > 0) {
        const recentIndex = roomList.findIndex((r) => r.roomId === recentRooms[0]);
        if (recentIndex !== -1) {
          setSelectedIndex(recentIndex);
        }
      }
    } catch (err) {
      setError(`加载聊天室列表失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (roomId: string) => {
    try {
      setJoining(true);
      setError(null);

      const exists = rooms.some((r) => r.roomId === roomId);

      if (exists) {
        await roomService.joinRoom(roomId);
      } else {
        // Create and join new room
        await roomService.createAndJoin(roomId);
      }

      onRoomJoined(roomId);
    } catch (err) {
      setError(`加入聊天室失败: ${err instanceof Error ? err.message : String(err)}`);
      setJoining(false);
    }
  };

  const handleCustomSubmit = async (value: string) => {
    if (!value.trim()) {
      setIsCustomMode(false);
      return;
    }

    await handleJoin(value.trim());
  };

  const handleNavigationSubmit = () => {
    if (rooms.length > 0 && selectedIndex >= 0 && selectedIndex < rooms.length) {
      handleJoin(rooms[selectedIndex].roomId);
    }
  };

  const handleKeyDown = (data: unknown) => {
    // Keyboard navigation is handled through useInput
  };

  const toggleCustomMode = () => {
    setIsCustomMode(!isCustomMode);
    setCustomRoomId("");
  };

  // Handle keyboard input for navigation
  useInput((input, key) => {
    if (isCustomMode) {
      if (key.escape) {
        setIsCustomMode(false);
        setCustomRoomId("");
      }
      return;
    }

    if (loading || joining) return;

    // Handle arrow keys for navigation
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : rooms.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => (prev < rooms.length - 1 ? prev + 1 : 0));
    }
    // Handle Enter to join selected room
    else if (key.return && rooms.length > 0) {
      handleNavigationSubmit();
    }
    // Handle 'c' key to create custom room
    else if (input.toLowerCase() === "c") {
      toggleCustomMode();
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Box marginBottom={1}>
          <Text>
            <Spinner type="dots" /> 正在加载聊天室列表...
          </Text>
        </Box>
      </Box>
    );
  }

  if (joining) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Box marginBottom={1}>
          <Text>
            <Spinner type="dots" /> 正在加入聊天室...
          </Text>
        </Box>
      </Box>
    );
  }

  if (isCustomMode) {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Box marginBottom={1}>
          <Text bold>创建/加入新聊天室</Text>
        </Box>

        <Box marginBottom={1}>
          <Text>请输入聊天室 ID（不存在则自动创建）:</Text>
        </Box>

        <Box marginBottom={1}>
          <Text color="blue">{'>'} 聊天室 ID: </Text>
          <TextInput
            value={customRoomId}
            onChange={setCustomRoomId}
            onSubmit={handleCustomSubmit}
            placeholder="general"
          />
        </Box>

        <Box>
          <Text dimColor>按 Esc 返回列表</Text>
        </Box>

        <Box marginTop={1}>
          {error && <Text color="red">✗ {error}</Text>}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box marginBottom={1}>
        <Text bold>选择聊天室</Text>
        <Spacer />
        <Text dimColor>上下键选择，Enter 加入，C 创建新聊天室</Text>
      </Box>

      {rooms.length === 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <Text dimColor>暂无可用聊天室</Text>
          </Box>

          <Box>
            <Text color="yellow">按 C 创建新聊天室</Text>
          </Box>
        </Box>
      ) : (
        <>
          {recentRooms.length > 0 && (
            <Box marginBottom={1}>
              <Text color="gray" dimColor>
                最近访问: {recentRooms.join(", ")}
              </Text>
            </Box>
          )}

          <Box flexDirection="column" marginBottom={1}>
            {rooms.map((room, index) => (
              <Box key={room.roomId}>
                <Text
                  color={index === selectedIndex ? "blue" : "white"}
                  bold={index === selectedIndex}
                >
                  {index === selectedIndex ? "> " : "  "}
                  {index + 1}. {room.roomId} ({room.memberCount} 位成员)
                  {recentRooms.includes(room.roomId) && (
                    <Text color="yellow"> [最近]</Text>
                  )}
                </Text>
              </Box>
            ))}
          </Box>
        </>
      )}

      {error && (
        <Box marginTop={1}>
          <Text color="red">✗ {error}</Text>
        </Box>
      )}
    </Box>
  );
}
