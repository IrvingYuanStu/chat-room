# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Chat Room Terminal Tool
- P2P chat room functionality with ZooKeeper node discovery
- Terminal UI built with Ink/React
- Message persistence and history loading
- @mention and reply features
- Multi-room support

## [0.1.0] - 2026-04-01

### Added
- **Core Features**
  - P2P mesh network topology with TCP connections
  - ZooKeeper-based node discovery and registration
  - Real-time group messaging
  - Message local persistence
  - User status management (online/offline)
  - Multi-room support with switching capability

- **UI Components**
  - SystemBar with connection status
  - ChatView with message list and formatting
  - MemberList with online/offline indicators
  - InputBox with multi-line input and @autocomplete
  - ConfigScreen for initial setup
  - RoomSelectScreen for room management
  - ChatScreen as main interface

- **Commands**
  - `/rename` - Change nickname
  - `/exit-room` - Exit current room
  - `/quit` - Quit application

- **Services**
  - ChatService - Message routing and dispatch
  - PeerService - P2P connection management
  - MemberService - Member state tracking
  - RoomService - Room lifecycle management
  - MentionService - @mention parsing and completion
  - ConfigService - Configuration management
  - HistoryService - Message persistence

- **Network Layer**
  - ZKClient - ZooKeeper integration
  - P2PServer/P2PClient - TCP server/client
  - P2PTransport - Frame protocol encoding/decoding
  - PeerConnection - Single connection lifecycle management

- **Storage Layer**
  - ConfigStore - Configuration file I/O
  - HistoryStore - Message history file I/O

- **Features**
  - Message @mentioning with autocomplete popup
  - Reply to specific messages with quote preview
  - Terminal title flash on new message
  - Auto-reconnection to ZooKeeper
  - Heartbeat mechanism for connection health
  - Automatic history cleanup (30 days)
  - Graceful shutdown on SIGINT/SIGTERM

### Technical Details
- **Technology Stack**
  - Node.js 22+
  - TypeScript 5.9
  - Ink 5.x (React for CLI)
  - React 18.x
  - ZooKeeper 3.5.9+
  - TCP protocol for P2P communication

- **Performance**
  - Message latency: < 500ms (LAN)
  - Memory usage: < 100MB
  - Startup time: < 3 seconds
  - Max concurrent users: 50+

- **Data Persistence**
  - Config: `~/.chat-room/config.json`
  - History: `/tmp/chat-room/{roomId}/history.txt`
  - Max messages in memory: 500 per room
  - Auto-cleanup: Messages older than 30 days

### Known Limitations
- macOS only (Darwin)
- No offline message delivery
- No file/image sharing
- No message editing/deletion
- No private messaging (1-on-1)
- No permission/admin system
- No "typing" indicator

### Security Notes
- Messages stored in plain text
- No encryption for P2P communication
- Trusts all nodes in the same ZK ensemble
- Designed for trusted LAN environments only

---

## [Future Plans]

### v0.2.0 (Planned)
- [ ] Support for Linux and Windows
- [ ] Encrypted P2P communication
- [ ] File sharing capability
- [ ] Message editing and deletion
- [ ] Private messaging (1-on-1)
- [ ] Typing indicators
- [ ] Custom themes and colors

### v0.3.0 (Planned)
- [ ] Voice messaging
- [ ] Emoji support
- [ ] Message search
- [ ] Export chat history
- [ ] Multi-language support
- [ ] Accessibility improvements

### v1.0.0 (Future)
- [ ] Production-ready stability
- [ ] Comprehensive test coverage
- [ ] Full documentation
- [ ] Performance optimizations
- [ ] Security audit

---

## Version History Summary

| Version | Date | Description |
|---------|------|-------------|
| 0.1.0 | 2026-04-01 | Initial release - MVP features complete |

---

**Note**: This project is in active development. APIs and features may change before 1.0.0 release.
