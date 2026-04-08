/**
 * InputBox Component - Message input field
 * M2.6.3: Input box with nickname display and command support
 * M3.2.1: @ mention autocomplete popup
 * M3.2.2: Member selection in autocomplete
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { Member } from '../../services/types';

export interface InputBoxProps {
  nickname: string;
  isMultiLine?: boolean;
  onSubmit: (content: string) => void;
  onCancel?: () => void;
  /** Online members for @ autocomplete */
  onlineMembers?: Member[];
}

/**
 * Props for the mention autocomplete popup
 */
export interface MentionAutocompletePopupProps {
  isVisible: boolean;
  members: Member[];
  selectedIndex: number;
  onSelect: (member: Member) => void;
  onClose: () => void;
}

// ============ Helper Functions ============

/**
 * Get the last @ index in a string
 */
export function getLastAtIndex(input: string): number {
  return input.lastIndexOf('@');
}

/**
 * Get the partial mention text after the last @
 */
export function getPartialMention(input: string): string {
  const atIndex = getLastAtIndex(input);
  if (atIndex === -1) return '';
  return input.slice(atIndex + 1);
}

/**
 * Check if autocomplete should be triggered
 */
export function shouldTriggerAutocomplete(input: string): boolean {
  return /@\w*$/.test(input);
}

/**
 * Filter members by partial nickname (case-insensitive prefix match)
 */
export function filterMembersByPartial(
  members: Member[],
  partialName: string
): Member[] {
  if (!partialName) {
    return members.filter(m => m.status === 'online');
  }
  return members.filter(
    m =>
      m.status === 'online' &&
      m.nickname.toLowerCase().startsWith(partialName.toLowerCase())
  );
}

/**
 * Navigate selection up (with wrap-around)
 */
export function navigateSelectionUp(
  currentIndex: number,
  maxIndex: number
): number {
  if (maxIndex < 0) return -1;
  if (currentIndex <= 0) return maxIndex;
  return currentIndex - 1;
}

/**
 * Navigate selection down (with wrap-around)
 */
export function navigateSelectionDown(
  currentIndex: number,
  maxIndex: number
): number {
  if (maxIndex < 0) return -1;
  if (currentIndex >= maxIndex) return 0;
  return currentIndex + 1;
}

/**
 * Insert selected member's nickname into input at the @ position
 */
export function insertMemberNickname(
  input: string,
  nickname: string
): string {
  const atIndex = getLastAtIndex(input);
  if (atIndex === -1) return input;

  const partialMention = getPartialMention(input);
  const beforeAt = input.substring(0, atIndex);
  const afterPartial = input.substring(atIndex + 1 + partialMention.length);

  return `${beforeAt}@${nickname}${afterPartial}`.trim();
}

// ============ MentionAutocompletePopup Component ============

/**
 * MentionAutocompletePopup - Displays a list of members for @ mention selection
 */
export const MentionAutocompletePopup: React.FC<MentionAutocompletePopupProps> = ({
  isVisible,
  members,
  selectedIndex,
}) => {
  if (!isVisible || members.length === 0) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="cyan"
      marginTop={1}
    >
      <Box paddingX={1} paddingY={0}>
        <Text bold dimColor>
          Select member:
        </Text>
      </Box>
      {members.slice(0, 5).map((member, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Box
            key={member.userId}
            paddingX={1}
            paddingY={0}
          >
            <Text
              bold={isSelected}
              inverse={isSelected}
              color={isSelected ? 'black' : member.status === 'online' ? 'green' : 'gray'}
            >
              {isSelected ? '> ' : '  '}
              {member.nickname}
              {member.status === 'offline' && ' (offline)'}
            </Text>
          </Box>
        );
      })}
      <Box paddingX={1} paddingY={0}>
        <Text dimColor>
          ↑↓ navigate, Enter select, Esc close
        </Text>
      </Box>
    </Box>
  );
};

// ============ Command Detection Functions ============

/**
 * Check if content is a command
 */
export function isCommand(content: string): boolean {
  return content.startsWith('/');
}

/**
 * Parse /rename command
 */
export function parseRenameCommand(
  content: string
): { isCommand: boolean; newNickname?: string } {
  const match = content.match(/^\/rename\s+(.+)$/);
  if (match && match[1].trim().length > 0) {
    return { isCommand: true, newNickname: match[1].trim() };
  }
  return { isCommand: false };
}

/**
 * Check if content is /exit-room command
 */
export function isExitRoomCommand(content: string): boolean {
  return content === '/exit-room';
}

/**
 * Check if content is /quit command
 */
export function isQuitCommand(content: string): boolean {
  return content === '/quit';
}

/**
 * Check if input has mention trigger
 */
export function hasMentionTrigger(content: string): boolean {
  return content.includes('@');
}

/**
 * Extract partial mention text (after @)
 */
export function extractPartialMention(content: string): string | null {
  const match = content.match(/@(\w*)$/);
  return match ? match[1] : null;
}

/**
 * Validate input before sending
 */
export function isValidInput(content: string): boolean {
  return content.trim().length > 0;
}

/**
 * Format input prompt label
 */
export function formatInputPrompt(nickname: string): string {
  return `[${nickname}]`;
}

// ============ InputBox Component ============

/**
 * Single-line input with Enter to submit
 */
interface SingleLineInputProps {
  value: string;
  setValue: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  showAutocomplete: boolean;
  onAutocompleteKey: (key: string) => void;
}

const SingleLineInput: React.FC<SingleLineInputProps> = ({
  value,
  setValue,
  onSubmit,
  placeholder = "Type a message...",
  showAutocomplete,
  onAutocompleteKey,
}) => {
  // Track if autocomplete is active to control keyboard handling
  useInput(
    (input, key) => {
      // If autocomplete is showing, let the parent handle it
      if (showAutocomplete) {
        if (key.upArrow) {
          onAutocompleteKey('arrowUp');
          return;
        }
        if (key.downArrow) {
          onAutocompleteKey('arrowDown');
          return;
        }
        if (key.return) {
          onAutocompleteKey('enter');
          return;
        }
        if (key.escape) {
          onAutocompleteKey('escape');
          return;
        }
        if (key.tab) {
          onAutocompleteKey('tab');
          return;
        }
        // Don't process other keys when autocomplete is active
        return;
      }
    },
    { isActive: true }
  );

  return (
    <TextInput
      value={value}
      onChange={setValue}
      placeholder={placeholder}
      onSubmit={showAutocomplete ? () => {} : onSubmit}
    />
  );
};

/**
 * InputBox - Message input component with @ mention autocomplete
 */
export const InputBox: React.FC<InputBoxProps> = ({
  nickname,
  isMultiLine = false,
  onSubmit,
  onCancel,
  onlineMembers = [],
}) => {
  const [value, setValue] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const prompt = formatInputPrompt(nickname);

  // Compute autocomplete state
  const isAutocompleteActive = useMemo(
    () => shouldTriggerAutocomplete(value),
    [value]
  );

  const partialMention = useMemo(
    () => getPartialMention(value),
    [value]
  );

  const filteredMembers = useMemo(
    () => filterMembersByPartial(onlineMembers, partialMention),
    [onlineMembers, partialMention]
  );

  const showAutocomplete = isAutocompleteActive && filteredMembers.length > 0;

  // Reset selected index when filtered members change
  useEffect(() => {
    if (selectedIndex >= filteredMembers.length) {
      setSelectedIndex(Math.max(0, filteredMembers.length - 1));
    }
  }, [filteredMembers.length, selectedIndex]);

  const handleSubmit = useCallback(() => {
    if (!value.trim()) {
      return;
    }

    // Handle commands
    if (isCommand(value)) {
      const renameResult = parseRenameCommand(value);
      if (renameResult.isCommand) {
        // /rename command - handled by parent
        onSubmit(value);
        setValue('');
        return;
      }

      if (isExitRoomCommand(value) || isQuitCommand(value)) {
        onSubmit(value);
        setValue('');
        return;
      }
    }

    // Regular message
    onSubmit(value);
    setValue('');
  }, [value, onSubmit]);

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue);
    // Reset selected index when input changes
    setSelectedIndex(0);
  }, []);

  const handleAutocompleteKey = useCallback((key: string) => {
    if (key === 'arrowUp') {
      setSelectedIndex(prev =>
        navigateSelectionUp(prev, filteredMembers.length - 1)
      );
      return;
    }

    if (key === 'arrowDown') {
      setSelectedIndex(prev =>
        navigateSelectionDown(prev, filteredMembers.length - 1)
      );
      return;
    }

    if (key === 'enter') {
      // Select currently highlighted member
      if (filteredMembers.length > 0 && selectedIndex >= 0) {
        const selectedMember = filteredMembers[selectedIndex];
        const newValue = insertMemberNickname(value, selectedMember.nickname);
        setValue(newValue);
        setSelectedIndex(0);
      }
      return;
    }

    if (key === 'escape') {
      // Close autocomplete
      setSelectedIndex(0);
      return;
    }

    if (key === 'tab') {
      // Auto-complete with first matching member
      if (filteredMembers.length > 0) {
        const newValue = insertMemberNickname(value, filteredMembers[0].nickname);
        setValue(newValue);
      }
      return;
    }
  }, [filteredMembers, selectedIndex, value]);

  return (
    <Box flexDirection="column" width="100%">
      <Box
        flexDirection="column"
        paddingX={1}
        borderStyle="single"
        borderColor="cyan"
        width="100%"
      >
        <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
          <Box>
            <Text bold>{prompt}</Text>
          </Box>
          <Box>
            <Text dimColor>Enter: 发送 | @: 提示成员</Text>
          </Box>
        </Box>
        <Box flexGrow={1}>
          <SingleLineInput
            value={value}
            setValue={handleChange}
            onSubmit={handleSubmit}
            placeholder="输入消息... (@ 提及成员)"
            showAutocomplete={showAutocomplete}
            onAutocompleteKey={handleAutocompleteKey}
          />
        </Box>
      </Box>
      <MentionAutocompletePopup
        isVisible={showAutocomplete}
        members={filteredMembers}
        selectedIndex={selectedIndex}
        onSelect={(member) => {
          const newValue = insertMemberNickname(value, member.nickname);
          setValue(newValue);
          setSelectedIndex(0);
        }}
        onClose={() => {
          setSelectedIndex(0);
        }}
      />
    </Box>
  );
};

export default InputBox;
