/**
 * MemberList Component - Displays chat room members
 * M2.6.2: Show member list with online status
 */

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { Member } from '../../services/types';

export interface MemberListProps {
  members: Member[];
  currentUserId: string;
  onMemberClick?: (userId: string) => void;
}

/**
 * Get status indicator symbol
 */
export function getStatusIndicator(status: 'online' | 'offline'): string {
  return status === 'online' ? '●' : '○';
}

/**
 * Get color for status
 */
export function getStatusColor(status: 'online' | 'offline'): string {
  return status === 'online' ? 'green' : 'gray';
}

/**
 * Check if member is current user
 */
export function isCurrentUser(memberId: string, currentUserId: string): boolean {
  return memberId === currentUserId;
}

/**
 * Format member display name with current user label
 */
export function formatMemberDisplayName(
  nickname: string,
  isCurrentUser: boolean
): string {
  return isCurrentUser ? `${nickname} (我)` : nickname;
}

/**
 * Format member count header
 */
export function formatMemberCount(count: number): string {
  return `成员列表 (${count})`;
}

/**
 * MemberItem - Renders a single member entry
 */
export interface MemberItemProps {
  member: Member;
  isCurrentUser: boolean;
  onClick?: () => void;
}

export const MemberItem: React.FC<MemberItemProps> = ({
  member,
  isCurrentUser,
  onClick,
}) => {
  const indicator = getStatusIndicator(member.status);
  const color = getStatusColor(member.status);
  const displayName = formatMemberDisplayName(member.nickname, isCurrentUser);

  return (
    <Box>
      <Text color={color}>{indicator}</Text>
      <Text
        color={isCurrentUser ? 'blue' : 'white'}
        bold={isCurrentUser}
      >
        {` ${displayName}`}
      </Text>
    </Box>
  );
};

/**
 * MemberList - Displays all members in the chat room
 */
export const MemberList: React.FC<MemberListProps> = ({
  members,
  currentUserId,
  onMemberClick,
}) => {
  // Sort members by joinedAt descending (newest first)
  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => b.joinedAt - a.joinedAt),
    [members]
  );

  const onlineCount = useMemo(
    () => members.filter((m) => m.status === 'online').length,
    [members]
  );

  return (
    <Box
      flexDirection="column"
      width={30}
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold>成员列表 ({members.length})</Text>
      </Box>

      {/* Online status summary */}
      <Box marginBottom={1}>
        <Text dimColor>
          在线: {onlineCount} / 离线: {members.length - onlineCount}
        </Text>
      </Box>

      {/* Divider */}
      <Box marginBottom={1}>
        <Text dimColor>{'─'.repeat(25)}</Text>
      </Box>

      {/* Member list */}
      <Box flexDirection="column" overflow="visible">
        {sortedMembers.length === 0 ? (
          <Box>
            <Text dimColor>No members yet</Text>
          </Box>
        ) : (
          sortedMembers.map((member) => (
            <Box key={member.userId}>
              <MemberItem
                member={member}
                isCurrentUser={isCurrentUser(member.userId, currentUserId)}
                onClick={() => onMemberClick?.(member.userId)}
              />
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

export default MemberList;
