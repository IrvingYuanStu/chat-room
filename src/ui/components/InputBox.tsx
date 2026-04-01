import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { ChatMessage, ReplyToInfo } from "../../services/types.js";
import { MentionService } from "../../services/MentionService.js";
import { MemberService } from "../../services/MemberService.js";

export interface InputBoxRef {
  handleShiftEnter: () => void;
  handleEscape: () => void;
  setReplyTo: (message: ChatMessage) => void;
}

interface InputBoxProps {
  nickname: string;
  roomId: string;
  mentionService: MentionService;
  onSend: (content: string, replyTo?: ReplyToInfo) => void;
  onCommand: (command: string) => void;
}

interface MentionCandidate {
  member: {
    userId: string;
    nickname: string;
  };
  index: number;
}

export const InputBox = forwardRef<InputBoxRef, InputBoxProps>(({
  nickname,
  roomId,
  mentionService,
  onSend,
  onCommand,
}: InputBoxProps, ref) => {
  const [input, setInput] = useState("");
  const [multiline, setMultiline] = useState<string[]>([]);
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [replyMode, setReplyMode] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<ReplyToInfo | null>(null);

  // Update mention candidates when filter changes
  useEffect(() => {
    if (showMentionPopup) {
      const members = mentionService.getCandidates(roomId, mentionFilter);
      const candidates: MentionCandidate[] = members.map((member, index) => ({
        member: {
          userId: member.userId,
          nickname: member.nickname,
        },
        index,
      }));
      setMentionCandidates(candidates);
      setSelectedMentionIndex(0);
    }
  }, [showMentionPopup, mentionFilter, roomId, mentionService]);

  // Handle input change
  const handleChange = (value: string) => {
    // Check for @ trigger
    const lastChar = value.slice(-1);
    const beforeLastChar = value.slice(-2, -1);

    if (lastChar === "@" && (beforeLastChar === undefined || beforeLastChar === " ")) {
      // Trigger mention popup
      setShowMentionPopup(true);
      setMentionFilter("");
    } else if (showMentionPopup) {
      // Update filter while popup is open
      const lastAtIndex = value.lastIndexOf("@");
      if (lastAtIndex !== -1) {
        const filterText = value.slice(lastAtIndex + 1);
        if (filterText.includes(" ")) {
          // Space closes the popup
          setShowMentionPopup(false);
          setMentionFilter("");
        } else {
          setMentionFilter(filterText);
        }
      } else {
        setShowMentionPopup(false);
        setMentionFilter("");
      }
    }

    setInput(value);
  };

  // Handle submit (Enter)
  const handleSubmit = useCallback(() => {
    if (showMentionPopup) {
      // Confirm mention selection
      confirmMention();
      return;
    }

    const content = multiline.length > 0 ? [...multiline, input].join("\n") : input;

    if (!content.trim()) {
      return;
    }

    // Check for command
    if (content.startsWith("/")) {
      onCommand(content);
    } else {
      onSend(content, replyToMessage || undefined);
    }

    // Reset input
    setInput("");
    setMultiline([]);
    setReplyMode(false);
    setReplyToMessage(null);
  }, [showMentionPopup, multiline, input, onCommand, onSend, replyToMessage]);

  // Handle Shift+Enter for multiline
  const handleShiftEnter = useCallback(() => {
    if (showMentionPopup) {
      // Move to next mention candidate
      setSelectedMentionIndex((prev) => (prev + 1) % mentionCandidates.length);
      return;
    }

    if (input.trim()) {
      setMultiline([...multiline, input]);
      setInput("");
    }
  }, [showMentionPopup, input, multiline, mentionCandidates.length]);

  // Handle Escape
  const handleEscape = useCallback(() => {
    if (showMentionPopup) {
      setShowMentionPopup(false);
      setMentionFilter("");
    } else if (replyMode) {
      setReplyMode(false);
      setReplyToMessage(null);
    }
  }, [showMentionPopup, replyMode]);

  // Confirm mention selection
  const confirmMention = () => {
    if (mentionCandidates.length === 0) return;

    const selected = mentionCandidates[selectedMentionIndex];
    const lastAtIndex = input.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const beforeMention = input.slice(0, lastAtIndex);
      const newInput = `${beforeMention}@${selected.member.nickname} `;
      setInput(newInput);
      setShowMentionPopup(false);
      setMentionFilter("");
    }
  };

  // Set reply mode
  const setReplyTo = useCallback((message: ChatMessage) => {
    setReplyMode(true);
    setReplyToMessage({
      messageId: message.id,
      senderNickname: message.senderNickname,
      content: message.content,
    });
  }, []);

  // Expose handlers to parent via ref
  useImperativeHandle(ref, () => ({
    handleShiftEnter,
    handleEscape,
    setReplyTo,
  }), [handleShiftEnter, handleEscape, setReplyTo]);

  return (
    <Box
      flexGrow={1}
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
    >
      {/* Reply preview */}
      {replyMode && replyToMessage && (
        <Box marginBottom={1}>
          <Text color="gray" dimColor>
            {" "}&gt; {replyToMessage.senderNickname}: {replyToMessage.content}
          </Text>
        </Box>
      )}

      {/* Mention popup */}
      {showMentionPopup && mentionCandidates.length > 0 && (
        <Box
          borderStyle="single"
          borderColor="yellow"
          paddingX={1}
          flexDirection="column"
          marginBottom={1}
        >
          {mentionCandidates.slice(0, 5).map((candidate, index) => (
            <Box key={candidate.member.userId}>
              <Text
                color={index === selectedMentionIndex ? "yellow" : "white"}
                bold={index === selectedMentionIndex}
              >
                {index === selectedMentionIndex ? "> " : "  "}
                {candidate.member.nickname}
              </Text>
            </Box>
          ))}
          {mentionCandidates.length > 5 && (
            <Text dimColor>... 还有 {mentionCandidates.length - 5} 位</Text>
          )}
        </Box>
      )}

      {/* Multiline preview */}
      {multiline.length > 0 && (
        <Box marginBottom={1} flexDirection="column">
          {multiline.map((line, index) => (
            <Text key={index} dimColor>
              {line}
            </Text>
          ))}
        </Box>
      )}

      {/* Input */}
      <Box>
        <Text color="green" bold>
          {nickname}
        </Text>
        <Text>: </Text>
        <TextInput
          value={input}
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder="输入消息... (Enter 发送, Shift+Enter 换行, @ 提及)"
        />
      </Box>
    </Box>
  );
});

InputBox.displayName = "InputBox";
