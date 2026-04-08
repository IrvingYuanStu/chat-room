/**
 * ConfigScreen Component - Configuration screen for first-time setup
 * M1.8.1: First startup configuration interface
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { Config } from '../../services/types';

export interface ConfigScreenProps {
  onConfigComplete: (config: Config) => void;
  initialConfig?: Partial<Config>;
}

/**
 * Generate a default nickname with random suffix
 */
function generateDefaultNickname(): string {
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `User${randomNum}`;
}

/**
 * Validate address format (host:port)
 */
function isValidAddressFormat(address: string): boolean {
  return /^\d+\.\d+\.\d+\.\d+:\d+$/.test(address) || /^[\w.-]+:\d+$/.test(address);
}

/**
 * ConfigScreen - Configuration interface for first-time users
 */
export const ConfigScreen: React.FC<ConfigScreenProps> = ({
  onConfigComplete,
  initialConfig
}) => {
  const [zkAddressInput, setZkAddressInput] = useState<string>(
    initialConfig?.zkAddresses?.join(', ') || '127.0.0.1:2181'
  );
  const [nickname, setNickname] = useState<string>(
    initialConfig?.nickname || generateDefaultNickname()
  );
  const [step, setStep] = useState<'zk' | 'nickname' | 'confirm'>('zk');
  const [error, setError] = useState<string>('');

  // Handle ZooKeeper address submission
  const handleZkSubmit = () => {
    const addresses = zkAddressInput.split(',').map(s => s.trim()).filter(Boolean);

    if (addresses.length === 0) {
      setError('Please enter at least one ZooKeeper address');
      return;
    }

    for (const addr of addresses) {
      if (!isValidAddressFormat(addr)) {
        setError(`Invalid address format: ${addr}. Expected format: host:port`);
        return;
      }
    }

    setError('');
    setStep('nickname');
  };

  // Handle nickname submission
  const handleNicknameSubmit = () => {
    if (!nickname.trim()) {
      setError('Please enter a nickname');
      return;
    }

    if (nickname.length > 32) {
      setError('Nickname must be 32 characters or less');
      return;
    }

    setError('');
    setStep('confirm');
  };

  // Handle final confirmation
  const handleConfirm = () => {
    const addresses = zkAddressInput.split(',').map(s => s.trim()).filter(Boolean);

    const config: Config = {
      zkAddresses: addresses,
      currentRoomId: initialConfig?.currentRoomId || '',
      nickname: nickname.trim(),
      recentRooms: initialConfig?.recentRooms || [],
      port: initialConfig?.port || 9001,
      dataDir: initialConfig?.dataDir || '/tmp/chat-room',
      logDir: initialConfig?.logDir || '/tmp/chat-room/logs',
      logLevel: initialConfig?.logLevel || 'info'
    };

    onConfigComplete(config);
  };

  // Handle key press for navigation
  const handleKeyPress = (key: string) => {
    if (key === 'enter') {
      if (step === 'zk') {
        handleZkSubmit();
      } else if (step === 'nickname') {
        handleNicknameSubmit();
      }
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Title */}
      <Box>
        <Text bold>Chat Room Configuration</Text>
      </Box>

      <Box marginY={1}>
        <Text dimColor>{"=".repeat(40)}</Text>
      </Box>

      {/* Step 1: ZooKeeper Address */}
      {step === 'zk' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Enter ZooKeeper addresses:</Text>
          </Box>
          <Box marginLeft={2}>
            <Text dimColor>Multiple addresses separated by comma</Text>
          </Box>
          <Box marginTop={1}>
            <Text>{"> "}</Text>
            <TextInput
              value={zkAddressInput}
              onChange={setZkAddressInput}
              onSubmit={handleZkSubmit}
              placeholder="127.0.0.1:2181"
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to continue</Text>
          </Box>
        </Box>
      )}

      {/* Step 2: Nickname */}
      {step === 'nickname' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text>Enter your nickname:</Text>
          </Box>
          <Box marginLeft={2}>
            <Text dimColor>Max 32 characters</Text>
          </Box>
          <Box marginTop={1}>
            <Text>{"> "}</Text>
            <TextInput
              value={nickname}
              onChange={setNickname}
              onSubmit={handleNicknameSubmit}
              placeholder="User001"
            />
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to continue</Text>
          </Box>
        </Box>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Configuration Summary:</Text>
          </Box>
          <Box marginLeft={2} marginY={0}>
            <Text dimColor>ZooKeeper: </Text>
            <Text>{zkAddressInput}</Text>
          </Box>
          <Box marginLeft={2} marginY={0}>
            <Text dimColor>Nickname: </Text>
            <Text>{nickname}</Text>
          </Box>

          <Box marginTop={2}>
            <Text dimColor>Press Enter to confirm or Esc to go back</Text>
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

export default ConfigScreen;
