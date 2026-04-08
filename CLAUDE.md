# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a P2P chat room terminal tool built with TypeScript. It uses **Ink** (React for CLI) for the terminal UI, **ZooKeeper** for node discovery/registration, and **P2P TCP connections** for decentralized message delivery. The architecture follows a service-oriented design with an event bus for loose coupling between components.

## Common Commands

```bash
# Build
npm run build          # TypeScript compilation to dist/

# Development
npm run dev            # Run with ts-node (src/index.tsx)
npm start              # Run compiled version

# Testing
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Generate coverage report

# Single test file
npm test -- ChatService.test.ts
```

## Architecture Overview

```
┌─────────────────────────────────────────┐
│  UI Layer (Ink/React)                   │
│  ConfigScreen → RoomSelect → ChatScreen │
└─────────────────────────────────────────┘
                ↓ events
┌─────────────────────────────────────────┐
│  Service Layer                          │
│  ChatService | MemberService | Room     │
│  EventBus (pub/sub)                     │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│  Network Layer                          │
│  ZKClient (node discovery)              │
│  P2PServer/P2PClient (TCP messaging)    │
│  P2PTransport (protocol encoding)       │
└─────────────────────────────────────────┘
```

## Key Architectural Patterns

### Event Bus (src/services/EventBus.ts)
The **central communication mechanism**. Services publish events; UI components subscribe. Use `getEventBus()` for the singleton instance.

**Event types**: `message`, `member_join`, `member_leave`, `zk_connected`, `zk_disconnected`, `warning`, `error`

### P2P Message Protocol (src/network/P2PTransport.ts)
TCP messages use **Magic + Length + Payload** framing:
- Magic: `0x4348` ('CH')
- Length: 4 bytes big-endian
- Payload: JSON-encoded `P2PMessage`

### Service Dependencies
Services are initialized in a specific order due to dependencies:
1. `EventBus` (singleton)
2. `ZKClient` → connects to ZooKeeper
3. `MemberService` → uses ZKClient
4. `RoomService` → uses ZKClient + MemberService
5. `ChatService` → uses PeerService + EventBus
6. UI components subscribe to events

### ZooKeeper Integration (src/network/ZKClient.ts)
- Root path: `/libra-regions`
- Room path: `/libra-regions/{roomId}/members/{userId}`
- **Ephemeral nodes** for member registration (auto-delete on disconnect)
- Watches trigger `member_join`/`member_leave` events

## Type System (src/services/types.ts)

Core types are centralized:
- `Config` - Application configuration
- `Member` - Chat room member
- `ChatMessage` - Displayed message with metadata
- `P2PMessage` - Network protocol message
- `EventPayload` - Typed event payloads

## Testing Guidelines

- Tests use **Jest + ts-jest**
- Test timeout is 30s (configured in jest.config.cjs)
- Use `resetEventBus()` in `beforeEach` to isolate tests
- Mock network services with simple objects
- Test files mirror `src/` structure under `test/`

## Important Conventions

1. **Logger**: Use `getLogger(module)` from `src/utils/logger.ts`. Logs go to `/tmp/chat-room/logs/`
2. **User IDs**: Generated as `user-{timestamp}-{random}` format
3. **Message timestamps**: Unix milliseconds (`Date.now()`)
4. **Room IDs**: Last segment of ZK path (e.g., `general` from `/libra-regions/general`)
5. **Config storage**: `~/.chat-room/config.json`
6. **Message history**: `/tmp/chat-room/{roomId}/history.txt`

## CLI Arguments (src/cli.ts)

All options are configurable via CLI:
- `--zk-addresses`: ZooKeeper hosts (default: `127.0.0.1:2181`)
- `--port`: P2P listening port (default: `9001`)
- `--config`: Config file path
- `--nickname`: User nickname
- `--data-dir`: Data storage path
- `--log-dir`: Log output path
- `--log-level`: debug/info/warn/error

## Module System Notes

- ESNext modules with `moduleResolution: "bundler"`
- JSX: `react-jsx` (React 17+ transform)
- `src/index.tsx` is the main entry point
- `src/cli.ts` handles argument parsing

## Common Development Tasks

### Adding a new event type
1. Add to `EventType` union in `src/services/types.ts`
2. Add payload type to `EventPayload` interface
3. Publish from service: `eventBus.publish('new_event', payload)`
4. Subscribe in component: `eventBus.subscribe('new_event', handler)`

### Adding a new P2P message type
1. Add to `P2PMessageType` union
2. Define payload interface
3. Handle in `P2PServer.onMessage` callback
4. Add encoding/encoding logic if needed in `P2PTransport`

### Testing network code
- Use dynamic ports (`testPort = 18888 + Math.floor(Math.random() * 10000)`)
- Call `disconnectAll()` in `afterEach`
- Use `setTimeout` for async propagation delays
