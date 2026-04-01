import { useEffect, useState } from "react";
import { Box, Text } from "ink";
import type { Member } from "../../services/types.js";
import { MemberService } from "../../services/MemberService.js";
import { eventBus } from "../../services/EventBus.js";

interface MemberListProps {
  roomId: string;
  memberService: MemberService;
}

export function MemberList({ roomId, memberService }: MemberListProps) {
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    // Load initial members
    const loadMembers = () => {
      const roomMembers = memberService.getMembers(roomId);
      // Sort by joinedAt descending (newest first)
      const sorted = [...roomMembers].sort((a, b) => b.joinedAt - a.joinedAt);
      setMembers(sorted);
    };

    loadMembers();

    // Subscribe to member changes
    const handler = () => {
      loadMembers();
    };

    eventBus.on("members-changed", handler);

    return () => {
      eventBus.off("members-changed", handler);
    };
  }, [roomId, memberService]);

  // Count online members
  const onlineCount = members.filter((m) => m.status === "online").length;
  const offlineCount = members.length - onlineCount;

  console.log(`[MemberList] Room: ${roomId}, Total: ${members.length}, Online: ${onlineCount}, Offline: ${offlineCount}`);
  console.log(`[MemberList] Members:`, members.map(m => `${m.nickname}(${m.status})`).join(", "));

  return (
    <Box
      flexGrow={1}
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
    >
      <Box borderBottom={true} borderColor="gray" marginBottom={1} paddingBottom={1}>
        <Text bold>成员 ({members.length})</Text>
        <Text dimColor> - </Text>
        <Text color="green">{onlineCount}</Text>
        <Text dimColor>/</Text>
        <Text color="white">{members.length}</Text>
      </Box>

      <Box flexDirection="column" overflow="hidden">
        {members.length === 0 ? (
          <Text dimColor>暂无成员</Text>
        ) : (
          members.map((member) => (
            <Box key={member.userId} marginBottom={1}>
              <Text
                color={member.status === "online" ? "green" : "gray"}
              >
                {member.status === "online" ? "●" : "○"} {member.nickname}
              </Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}
