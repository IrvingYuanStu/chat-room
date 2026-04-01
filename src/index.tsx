#!/usr/bin/env node
import React from "react";
import { render } from "ink";
import { ConfigStore } from "./store/ConfigStore.js";
import { HistoryStore } from "./store/HistoryStore.js";
import { ZKClient } from "./network/ZKClient.js";
import { MemberService } from "./services/MemberService.js";
import { MentionService } from "./services/MentionService.js";
import { PeerService } from "./services/PeerService.js";
import { ChatService } from "./services/ChatService.js";
import { ConfigService } from "./services/ConfigService.js";
import { HistoryService } from "./services/HistoryService.js";
import { RoomService } from "./services/RoomService.js";
import { App } from "./ui/App.js";

let isShuttingDown = false;

/**
 * Main application entry point
 */
async function main() {
  try {
    // Create store instances
    const configStore = new ConfigStore();
    const historyStore = new HistoryStore();

    // Create service instances
    const configService = new ConfigService(configStore);
    const historyService = new HistoryService(historyStore);
    const zkClient = new ZKClient();
    const memberService = new MemberService();
    const mentionService = new MentionService(memberService);
    const peerService = new PeerService(memberService);
    const chatService = new ChatService(
      historyService,
      peerService,
      mentionService,
      configService,
      memberService
    );
    const roomService = new RoomService(
      zkClient,
      memberService,
      historyService,
      configService
    );

    // Setup peer service to forward messages to chat service
    peerService.onMessage(async (roomId, protocolMsg) => {
      await chatService.handleIncoming(roomId, protocolMsg);
    });

    // Load config
    const config = await configService.load();

    if (config) {
      // Connect to ZK if config exists
      try {
        await zkClient.connect(config.zkAddresses);

        // If there's a current room, reconnect
        if (config.currentRoomId) {
          // Cleanup old messages
          await historyService.cleanupOldMessages(config.currentRoomId);
        }
      } catch (err) {
        console.error("Failed to connect to ZK:", err);
        // Continue anyway, will show config screen
      }
    }

    // Render the app
    const { unmount } = render(
      <App
        zkClient={zkClient}
        configService={configService}
        roomService={roomService}
        chatService={chatService}
        memberService={memberService}
        mentionService={mentionService}
        peerService={peerService}
        historyService={historyService}
      />
    );

    // Handle graceful shutdown
    const gracefulShutdown = async () => {
      if (isShuttingDown) {
        // Second Ctrl+C, force exit
        process.exit(1);
      }

      isShuttingDown = true;

      try {
        const currentConfig = configService.getConfig();
        const currentRoomId = roomService.getCurrentRoomId();

        // If in a room, notify and disconnect
        if (currentRoomId && currentConfig) {
          try {
            await chatService.sendLeave(currentRoomId);
            await peerService.disconnectAll(currentRoomId);
            await zkClient.leaveRoom(currentRoomId, currentConfig.nickname);
          } catch (err) {
            console.warn("Failed to properly leave room:", err);
          }
        }

        // Save config
        if (currentConfig) {
          await configService.save();
        }

        // Stop P2P server
        peerService.stopServer();

        // Disconnect ZK
        await zkClient.disconnect();

        // Unmount React app
        unmount();

        // Exit
        process.exit(0);
      } catch (err) {
        console.error("Error during shutdown:", err);
        process.exit(1);
      }
    };

    // Register signal handlers
    process.on("SIGINT", gracefulShutdown);
    process.on("SIGTERM", gracefulShutdown);

    // Handle uncaught errors
    process.on("uncaughtException", (err) => {
      console.error("Uncaught exception:", err);
      gracefulShutdown();
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("Unhandled rejection at:", promise, "reason:", reason);
      gracefulShutdown();
    });

  } catch (err) {
    console.error("Failed to start application:", err);
    process.exit(1);
  }
}

// Run the application
main();
