# 二进制打包状态说明

## ❌ 当前状态：暂不支持

由于技术限制，Chat Room 项目**目前无法打包成独立的二进制可执行文件**。

## 技术原因

Chat Room 使用了 **ES Modules** (import/export) 和现代 Node.js 特性：
- TypeScript + ES modules
- React/Ink UI 框架
- Top-level await
- 动态 import

而 `pkg` 打包工具目前对 ES modules 的支持有限，无法正确处理这些特性。

## 推荐的部署方式

### ✅ 方式 1: 一键安装脚本（推荐）

```bash
curl -fsSL hhttps://github.com/IrvingYuanStu/chat-room/main/install.sh | bash
```

**要求：** 用户需要安装 Node.js（安装脚本会检查）

**优点：**
- 配置灵活
- 功能完整
- 易于更新

### ✅ 方式 2: Docker 部署

```bash
git clone https://github.com/yourusername/chat-room.git
cd chat-room
docker-compose up -d
```

**要求：** 需要安装 Docker

**优点：**
- 完全隔离
- 开箱即用
- 易于管理

### ✅ 方式 3: NPM 全局安装

```bash
npm install -g chat-room
chat-room
```

**要求：** 需要 Node.js 环境

**优点：**
- 安装简单
- 自动管理依赖

## 为什么不提供二进制包？

| 问题 | 说明 |
|------|------|
| **ES Modules** | pkg 对 ES modules 支持不完善 |
| **React/Ink** | 终端 UI 框架有大量动态依赖 |
| **文件大小** | 打包后体积会很大（100MB+） |
| **兼容性** | 不同平台需要分别构建和测试 |
| **维护成本** | 需要持续更新每个平台的二进制包 |

## 替代方案

### 对于企业/团队

**推荐：Docker 私有镜像**

```bash
# 构建镜像
docker build -t your-registry/chat-room:latest .

# 推送到私有镜像仓库
docker push your-registry/chat-room:latest

# 用户使用
docker pull your-registry/chat-room:latest
docker run -d chat-room
```

### 对于个人用户

**推荐：一键安装脚本**

脚本会：
1. 检查 Node.js
2. 如果没有，提示安装方法
3. 克隆代码
4. 安装依赖
5. 生成配置

## 未来可能性

当以下条件满足时，可以考虑添加二进制包支持：

1. ✅ pkg 完善 ES modules 支持
2. ✅ 或改用其他支持 ES modules 的打包工具
3. ✅ 或项目改用 CommonJS（工作量大）

## 相关文档

- [二进制打包限制说明](./二进制打包限制说明.md) - 详细技术说明
- [快速安装指南](./快速安装指南.md) - 源码安装指南
- [一键安装配置指南](./一键安装配置指南.md) - 安装脚本配置

## 结论

虽然无法提供传统的二进制可执行文件，但通过以下方式可以获得类似甚至更好的用户体验：

- **一键安装脚本** - 几乎同样的用户体验
- **Docker** - 真正的开箱即用
- **NPM** - 标准的 Node.js 包管理

这些都是成熟、稳定且易于维护的部署方式。
