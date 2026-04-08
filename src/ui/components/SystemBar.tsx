/**
 * SystemBar Component - Status bar at the bottom of the screen
 * M1.8.3: Display connection status and message count
 */

import React from 'react';
import { Box, Text } from 'ink';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface SystemBarProps {
  roomId: string;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  messageCount: number;
}

/**
 * Get display text for connection status
 */
function getConnectionText(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'reconnecting':
      return 'Reconnecting...';
    case 'disconnected':
      return 'Disconnected';
  }
}

/**
 * Get color for connection status
 */
function getConnectionColor(status: ConnectionStatus): string {
  switch (status) {
    case 'connected':
      return 'green';
    case 'reconnecting':
      return 'yellow';
    case 'disconnected':
      return 'red';
  }
}

/**
 * SystemBar - Displays connection status and message count
 */
export const SystemBar: React.FC<SystemBarProps> = ({
  roomId,
  isConnected,
  connectionStatus,
  messageCount
}) => {
  const statusText = getConnectionText(connectionStatus);
  const statusColor = getConnectionColor(connectionStatus);

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      paddingX={1}
      borderStyle="single"
      borderColor="cyan"
    >
      {/* Left: Room ID */}
      <Box>
        <Text bold>chat-room - [{roomId}]</Text>
      </Box>

      {/* Center: Connection Status */}
      <Box>
        <Text color={statusColor}>
          {statusText}
        </Text>
      </Box>

      {/* Right: Message Count */}
      <Box>
        <Text dimColor>
          {messageCount} {messageCount === 1 ? 'message' : 'messages'}
        </Text>
      </Box>
    </Box>
  );
};

// Helper exports for testing
export { getConnectionText, getConnectionColor };

export default SystemBar;
