# 二进制包快速指南

## 为用户：如何使用二进制包

### 1. 下载

从 [GitHub Releases](https://github.com/yourusername/chat-room/releases) 下载对应平台：

- `chat-room-macos-x64.tar.gz` - macOS 用户
- `chat-room-linux-x64.tar.gz` - Linux 用户
- `chat-room-win-x64.zip` - Windows 用户

### 2. 解压并运行

**macOS / Linux:**
```bash
# 解压
tar -xzf chat-room-*-x64.tar.gz

# 添加执行权限
chmod +x chat-room-*

# 运行
./chat-room-macos  # macOS
./chat-room-linux  # Linux
```

**Windows:**
```powershell
# 解压 zip 文件
# 双击运行 chat-room-win.exe
```

### 3. 配置

首次运行会自动创建配置文件：

- **macOS/Linux**: `~/.chat-room/config.json`
- **Windows**: `%USERPROFILE%\.chat-room\config.json`

编辑配置文件，设置你的昵称和 ZooKeeper 地址。

## 为开发者：如何构建二进制包

### 快速构建

```bash
# 克隆仓库
git clone https://github.com/yourusername/chat-room.git
cd chat-room

# 安装依赖
npm install

# 构建所有平台（推荐）
./scripts/build-binaries.sh

# 或使用 npm
npm run package
```

### 单平台构建

```bash
npm run package:macos   # 仅 macOS
npm run package:linux   # 仅 Linux
npm run package:win     # 仅 Windows
```

### 输出位置

构建完成后，二进制文件在 `binaries/` 目录：

```
binaries/
├── chat-room-macos          # macOS 可执行文件
├── chat-room-linux          # Linux 可执行文件
├── chat-room-win.exe        # Windows 可执行文件
├── chat-room-macos-x64.tar.gz
├── chat-room-linux-x64.tar.gz
└── chat-room-win-x64.zip
```

### 发布到 GitHub

```bash
# 1. 更新版本
npm version patch

# 2. 构建
./scripts/build-binaries.sh

# 3. 发布（需要 GitHub CLI）
./scripts/publish-release.sh
```

## 文件大小

- **未压缩**: 约 50-60 MB（包含 Node.js 运行时）
- **压缩后**: 约 15-20 MB

## 常见问题

**Q: 为什么这么大？**
A: 包含了完整的 Node.js 运行时，用户无需安装 Node.js。

**Q: 如何减小体积？**
A: 可以使用 UPX 压缩：
```bash
brew install upx  # macOS
upx --best --lzma binaries/chat-room-macos
```

**Q: macOS 提示"来自身份不明开发者"？**
A: 在系统偏好设置允许，或运行：
```bash
sudo xattr -cr chat-room-macos
```

## 相关文档

- 📖 [完整使用指南](./二进制包使用指南.md)
- 🔧 [开发者构建指南](./开发者构建指南.md)
- 📦 [快速安装指南](./快速安装指南.md)
