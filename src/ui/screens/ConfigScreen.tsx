import { useState, useEffect } from "react";
import { Box, Text, Spacer } from "ink";
import TextInput from "ink-text-input";
import type { AppConfig } from "../../services/types.js";
import { ConfigService } from "../../services/ConfigService.js";

interface ConfigScreenProps {
  configService: ConfigService;
  existingConfig: AppConfig | null;
  onComplete: () => void;
}

export function ConfigScreen({ configService, existingConfig, onComplete }: ConfigScreenProps) {
  const [step, setStep] = useState<"zk" | "nickname" | "confirm" | "done">(
    existingConfig ? "confirm" : "zk"
  );
  const [zkAddresses, setZkAddresses] = useState(
    existingConfig?.zkAddresses.join(",") || ""
  );
  const [nickname, setNickname] = useState(existingConfig?.nickname || "");
  const [error, setError] = useState<string | null>(null);

  // For edit mode
  const [editingField, setEditingField] = useState<"zk" | "nickname" | null>(null);

  useEffect(() => {
    if (step === "done") {
      onComplete();
    }
  }, [step, onComplete]);

  const handleZkSubmit = async (value: string) => {
    // Validate ZK addresses
    const addresses = value.split(",").map((a) => a.trim()).filter((a) => a);

    if (addresses.length === 0) {
      setError("请至少输入一个 ZooKeeper 地址");
      return;
    }

    // Basic validation
    const isValid = addresses.every((addr) => {
      const parts = addr.split(":");
      if (parts.length !== 2) return false;
      const host = parts[0];
      const port = parseInt(parts[1], 10);
      return host.length > 0 && !isNaN(port) && port > 0 && port < 65536;
    });

    if (!isValid) {
      setError("地址格式无效，应为 host:port，多个地址用逗号分隔");
      return;
    }

    setZkAddresses(value);
    setError(null);
    setStep("nickname");
  };

  const handleNicknameSubmit = async (value: string) => {
    // Validate nickname
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      setError("昵称不能为空");
      return;
    }

    if (trimmed.length > 20) {
      setError("昵称不能超过 20 个字符");
      return;
    }

    // Check for special characters (allow letters, numbers, Chinese, and basic symbols)
    const isValid = /^[\u4e00-\u9fa5a-zA-Z0-9_-]+$/.test(trimmed);

    if (!isValid) {
      setError("昵称只能包含中文、字母、数字、下划线和连字符");
      return;
    }

    setNickname(trimmed);
    setError(null);
    setStep("confirm");
  };

  const handleConfirmSave = async () => {
    try {
      const addresses = zkAddresses.split(",").map((a) => a.trim()).filter((a) => a);

      if (existingConfig) {
        // Update existing config
        await configService.init(addresses, nickname);
      } else {
        // Create new config
        await configService.init(addresses, nickname);
      }

      setStep("done");
    } catch (err) {
      setError(`保存配置失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleEditZk = () => {
    setEditingField("zk");
    setStep("zk");
  };

  const handleEditNickname = () => {
    setEditingField("nickname");
    setStep("nickname");
  };

  const handleSkipEdit = () => {
    setStep("done");
  };

  // Input field for ZK addresses
  if (step === "zk") {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Box marginBottom={1}>
          <Text bold>配置 ZooKeeper 地址</Text>
        </Box>

        <Box marginBottom={1}>
          <Text>请输入 ZooKeeper 集群地址，格式: host:port</Text>
        </Box>

        <Box marginBottom={1}>
          <Text>多个地址用逗号分隔，例如: 127.0.0.1:2181,127.0.0.1:2182</Text>
        </Box>

        <Box marginBottom={1}>
          <Text color="blue">{'>'} ZooKeeper 地址: </Text>
          <TextInput
            value={zkAddresses}
            onChange={setZkAddresses}
            onSubmit={handleZkSubmit}
            placeholder="127.0.0.1:2181"
          />
        </Box>

        {error && (
          <Box>
            <Text color="red">✗ {error}</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Input field for nickname
  if (step === "nickname") {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Box marginBottom={1}>
          <Text bold>配置昵称</Text>
        </Box>

        <Box marginBottom={1}>
          <Text>请输入您的显示昵称 (1-20 个字符)</Text>
        </Box>

        <Box marginBottom={1}>
          <Text color="blue">{'>'} 昵称: </Text>
          <TextInput
            value={nickname}
            onChange={setNickname}
            onSubmit={handleNicknameSubmit}
            placeholder="张三"
          />
        </Box>

        {error && (
          <Box>
            <Text color="red">✗ {error}</Text>
          </Box>
        )}
      </Box>
    );
  }

  // Confirmation screen
  if (step === "confirm") {
    return (
      <Box flexDirection="column" paddingX={2}>
        <Box marginBottom={1}>
          <Text bold>配置确认</Text>
        </Box>

        <Box flexDirection="column" marginBottom={1}>
          <Box marginBottom={1}>
            <Text>ZooKeeper 地址:</Text>
            <Spacer />
            <Text color="cyan">{zkAddresses}</Text>
          </Box>

          <Box marginBottom={1}>
            <Text>昵称:</Text>
            <Spacer />
            <Text color="cyan">{nickname}</Text>
          </Box>

          {existingConfig && (
            <Box marginBottom={1}>
              <Text>用户 ID:</Text>
              <Spacer />
              <Text color="gray">{existingConfig.userId.substring(0, 8)}...</Text>
            </Box>
          )}
        </Box>

        {error && (
          <Box marginBottom={1}>
            <Text color="red">✗ {error}</Text>
          </Box>
        )}

        <Box marginBottom={1}>
          <Text dimColor>按 Enter 确认保存，Esc 重新输入</Text>
        </Box>

        <TextInput
          value=""
          onChange={() => {}}
          onSubmit={handleConfirmSave}
          placeholder="按 Enter 确认..."
        />
      </Box>
    );
  }

  // Loading/done state
  return (
    <Box paddingX={2}>
      <Text color="green">✓ 配置已保存</Text>
    </Box>
  );
}
