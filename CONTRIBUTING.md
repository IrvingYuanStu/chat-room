# Contributing to Chat Room

感谢您对 Chat Room 项目的关注！我们欢迎任何形式的贡献。

---

## 如何贡献

### 报告 Bug

如果您发现了 bug，请：

1. 检查 [Issues](https://github.com/your-org/chat-room/issues) 是否已有相同问题
2. 如果没有，创建新的 Issue，包含：
   - 清晰的标题
   - 详细的问题描述
   - 复现步骤
   - 期望行为
   - 实际行为
   - 环境信息（操作系统、Node.js 版本等）
   - 相关日志或截图

**Bug 报告模板**：

```markdown
### 问题描述
[简要描述问题]

### 复现步骤
1. 步骤一
2. 步骤二
3. 步骤三

### 期望行为
[描述期望的行为]

### 实际行为
[描述实际发生的行为]

### 环境信息
- 操作系统: [e.g. macOS 14.0]
- Node.js 版本: [e.g. 22.0.0]
- Chat Room 版本: [e.g. 0.1.0]

### 附加信息
[日志、截图等]
```

### 提交功能建议

如果您有好的想法，请：

1. 检查 [Issues](https://github.com/your-org/chat-room/issues) 是否已有类似建议
2. 如果没有，创建新的 Feature Request
3. 说明：
   - 功能描述和用例
   - 为什么这个功能重要
   - 可能的实现方案
   - 是否愿意参与开发

### 提交代码

#### 开发流程

1. **Fork 项目**
   ```bash
   # 在 GitHub 上 Fork 项目
   git clone https://github.com/YOUR_USERNAME/chat-room.git
   cd chat-room
   ```

2. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

3. **开发**
   ```bash
   npm install
   npm run dev
   ```

4. **编写测试**
   ```bash
   npm test -- --watch
   ```

5. **代码检查**
   ```bash
   npm run lint
   npm run build
   ```

6. **提交更改**
   ```bash
   git add .
   git commit -m "feat: add XYZ feature"
   ```

7. **推送分支**
   ```bash
   git push origin feature/your-feature-name
   ```

8. **创建 Pull Request**
   - 在 GitHub 上创建 PR
   - 填写 PR 模板
   - 等待代码审查

#### 提交信息规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型 (type)**：
- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 重构（不是新功能也不是修复）
- `test`: 添加测试
- `chore`: 构建/工具链更新

**示例**：

```bash
feat(chat): add message reply functionality

Implement reply feature with quote preview.
Users can now reply to specific messages using
arrow keys to select and Enter to reply.

Closes #123
```

#### 代码规范

**TypeScript/JavaScript**：
- 使用 2 空格缩进
- 使用单引号（除非字符串内包含单引号）
- 每行最大长度 100 字符
- 使用箭头函数
- 添加适当的类型注解

**React/Ink 组件**：
- 使用函数组件和 Hooks
- 组件名使用 PascalCase
- 文件名使用 PascalCase（组件）或 camelCase（工具）
- Props 定义接口

**示例**：

```typescript
// ✅ Good
import { useState, useEffect } from "react";
import { Box, Text } from "ink";

interface MyComponentProps {
  title: string;
  count: number;
}

export function MyComponent({ title, count }: MyComponentProps) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    // side effects
  }, []);

  return (
    <Box>
      <Text>{title}: {count}</Text>
    </Box>
  );
}
```

### 测试要求

**单元测试**：
- 所有新功能需要单元测试
- 测试覆盖率目标：75%
- 使用 Vitest 框架

**集成测试**：
- 跨模块功能需要集成测试
- 测试关键用户流程

**示例**：

```typescript
import { describe, it, expect } from "vitest";
import { ChatService } from "../ChatService";

describe("ChatService", () => {
  it("should send message", async () => {
    const service = new ChatService(/* deps */);
    await service.send("room-1", "Hello");
    // assertions
  });
});
```

### 文档

**代码文档**：
- 公共 API 需要 JSDoc 注释
- 复杂逻辑需要注释说明

**README 更新**：
- 新功能需要更新 README
- 添加使用示例

**变更日志**：
- 重要更改需要更新 CHANGELOG.md

### Pull Request 检查清单

提交 PR 前请确认：

- [ ] 代码通过所有测试（`npm test`）
- [ ] 代码通过 ESLint 检查（`npm run lint`）
- [ ] 代码可以成功构建（`npm run build`）
- [ ] 添加了必要的测试
- [ ] 更新了相关文档
- [ ] 提交信息符合规范
- [ ] PR 描述清晰完整

---

## 开发环境设置

### 必需工具

- Node.js 22+
- npm 9+
- Git

### 推荐工具

- VS Code（配置见[部署开发说明文档](./docs/部署开发说明文档.md)）
- nvm（Node.js 版本管理）

### 初次设置

```bash
# 1. Clone 项目
git clone https://github.com/YOUR_USERNAME/chat-room.git
cd chat-room

# 2. 安装依赖
npm install

# 3. 构建
npm run build

# 4. 运行测试
npm test

# 5. 启动开发模式
npm run dev
```

---

## 项目结构

```
chat-room/
├── src/
│   ├── ui/              # UI 层
│   ├── services/        # 业务逻辑
│   ├── network/         # 网络层
│   ├── store/           # 存储层
│   └── index.tsx        # 入口
├── tests/               # 测试
├── spec/                # 规格文档
├── docs/                # 文档
├── package.json
└── tsconfig.json
```

---

## 获取帮助

- **GitHub Issues**: [报告问题或建议](https://github.com/your-org/chat-room/issues)
- **Discussions**: [社区讨论](https://github.com/your-org/chat-room/discussions)
- **Email**: support@example.com

---

## 行为准则

### 我们的承诺

为了营造开放和友好的环境，我们承诺让每个人参与我们的项目和社区都能享受无骚扰的体验。

### 我们的标准

积极行为包括：
- 使用友好和包容的语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

不可接受的行为包括：
- 使用性化语言或图像
- 恶意攻击或侮辱性评论
- 骚扰、跟踪或未经同意的联系方式
- 未经许可发布他人的私人信息
- 其他不专业或不适当的行为

### 责任

项目维护者负责阐明可接受行为的标准，并应对任何不可接受的行为采取适当和公平的纠正措施。

---

## 许可证

通过贡献代码，您同意您的贡献将根据项目的 [ISC 许可证](LICENSE) 进行许可。

---

**再次感谢您的贡献！🎉**
