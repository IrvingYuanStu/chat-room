/**
 * RoomSelectScreen Component - Room selection interface
 * M1.8.2: Display room list, support create/join room
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

export interface RoomSelectScreenProps {
  rooms: string[];
  recentRooms: string[];
  onSelectRoom: (roomId: string) => void;
  onCreateRoom: (roomId: string) => void;
  onBack: () => void;
}

/**
 * Validate room ID format (alphanumeric, underscore, hyphen)
 */
function isValidRoomId(roomId: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(roomId);
}

/**
 * RoomSelectScreen - Room selection interface
 */
export const RoomSelectScreen: React.FC<RoomSelectScreenProps> = ({
  rooms,
  recentRooms,
  onSelectRoom,
  onCreateRoom,
  onBack
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [newRoomId, setNewRoomId] = useState<string>('');
  const [error, setError] = useState<string>('');

  // Memoize displayRooms and otherRooms to prevent recalculation on every render
  const { displayRooms, otherRooms } = useMemo(() => {
    const allRooms = [...new Set([...recentRooms, ...rooms])];
    const other = allRooms.filter(room => !recentRooms.includes(room));
    return {
      displayRooms: [...recentRooms, ...other],
      otherRooms: other
    };
  }, [recentRooms, rooms]);

  // Reset selection when displayRooms length changes (not when selectedIndex changes)
  useEffect(() => {
    if (selectedIndex >= displayRooms.length && displayRooms.length > 0) {
      setSelectedIndex(displayRooms.length - 1);
    }
  }, [displayRooms.length]);

  // Memoize callbacks to prevent useInput re-registration
  const handleSelectRoom = useCallback((roomId: string) => {
    onSelectRoom(roomId);
  }, [onSelectRoom]);

  const handleCreateNewRoom = useCallback(() => {
    setIsCreating(true);
    setNewRoomId('');
  }, []);

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false);
    setNewRoomId('');
    setError('');
  }, []);

  // Handle keyboard navigation with useInput hook
  useInput((input, key) => {
    if (isCreating) {
      // When creating, only handle escape to cancel
      if (key.escape) {
        handleCancelCreate();
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(displayRooms.length, prev + 1));
    } else if (key.return) {
      if (selectedIndex < displayRooms.length) {
        handleSelectRoom(displayRooms[selectedIndex]);
      } else {
        // Last item is "Create new room"
        handleCreateNewRoom();
      }
    } else if (key.escape) {
      onBack();
    }
  });

  // Handle creating a new room
  const handleCreateRoom = () => {
    const trimmedId = newRoomId.trim();

    if (!trimmedId) {
      setError('Room ID cannot be empty');
      return;
    }

    if (!isValidRoomId(trimmedId)) {
      setError('Room ID can only contain letters, numbers, underscore, and hyphen');
      return;
    }

    // Check if room already exists
    if (rooms.includes(trimmedId)) {
      setError('Room already exists. Select it from the list.');
      return;
    }

    setError('');
    onCreateRoom(trimmedId);
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Title */}
      <Box>
        <Text bold>Select Chat Room</Text>
      </Box>

      <Box marginY={1}>
        <Text dimColor>{"=".repeat(40)}</Text>
      </Box>

      {/* Room List */}
      {!isCreating && (
        <Box flexDirection="column">
          {/* Recent Rooms Section */}
          {recentRooms.length > 0 && (
            <>
              <Box marginBottom={1}>
                <Text dimColor>Recent:</Text>
              </Box>
              {recentRooms.map((room, index) => {
                const actualIndex = index;
                const isSelected = selectedIndex === actualIndex;
                return (
                  <Box key={room} marginLeft={2}>
                    <Text
                      color={isSelected ? 'cyan' : undefined}
                      bold={isSelected}
                    >
                      {isSelected ? '> ' : '  '}
                      {room}
                    </Text>
                  </Box>
                );
              })}
            </>
          )}

          {/* All Rooms Section */}
          {otherRooms.length > 0 && (
            <>
              <Box marginTop={1} marginBottom={1}>
                <Text dimColor>All Rooms:</Text>
              </Box>
              {otherRooms.map((room) => {
                const actualIndex = recentRooms.length + otherRooms.indexOf(room);
                const isSelected = selectedIndex === actualIndex;
                return (
                  <Box key={room} marginLeft={2}>
                    <Text
                      color={isSelected ? 'cyan' : undefined}
                      bold={isSelected}
                    >
                      {isSelected ? '> ' : '  '}
                      {room}
                    </Text>
                  </Box>
                );
              })}
            </>
          )}

          {/* Create New Room Option */}
          <Box marginTop={1}>
            <Text
              color={selectedIndex === displayRooms.length ? 'cyan' : undefined}
              bold={selectedIndex === displayRooms.length}
            >
              {selectedIndex === displayRooms.length ? '> ' : '  '}
              + Create new room
            </Text>
          </Box>

          {/* Navigation Help */}
          <Box marginTop={2}>
            <Text dimColor>↑↓ Navigate | Enter Select | Esc Back</Text>
          </Box>
        </Box>
      )}

      {/* Create New Room Form */}
      {isCreating && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Enter new room ID:</Text>
          </Box>
          <Box>
            <Text dimColor>Room ID: </Text>
            <TextInput
              value={newRoomId}
              onChange={(value: string) => {
                setNewRoomId(value);
                setError('');
              }}
              onSubmit={handleCreateRoom}
              placeholder="my-room"
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Letters, numbers, underscore, hyphen only</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Enter Confirm | Esc Cancel</Text>
          </Box>
        </Box>
      )}

      {/* Error Display */}
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
};

// Helper export for testing
export { isValidRoomId };

export default RoomSelectScreen;
