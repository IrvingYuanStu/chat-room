#!/bin/bash

# Chat Room Node.js Client Installation Script
# Usage: curl -fsSL hhttps://github.com/IrvingYuanStu/chat-room/main/install.sh | bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  Chat Room Installer${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    *)          MACHINE="UNKNOWN:${OS}"
esac

echo "Detected OS: ${MACHINE}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js is not installed.${NC}"
    echo "Please install Node.js first:"
    echo "  - macOS: brew install node"
    echo "  - Ubuntu: curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  - Or visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js ${NODE_VERSION} installed${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ npm is not installed${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ npm ${NPM_VERSION} installed${NC}"
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}⚠ git is not installed. Installing...${NC}"

    if [ "${MACHINE}" = "Mac" ]; then
        xcode-select --install 2>/dev/null || true
    elif [ "${MACHINE}" = "Linux" ]; then
        sudo apt-get update && sudo apt-get install -y git
    fi
fi

echo -e "${GREEN}✓ git $(git --version | awk '{print $3}') installed${NC}"
echo ""

# Prompt for ZooKeeper address
echo -e "${BLUE}📡 ZooKeeper Configuration${NC}"
echo ""
read -p "Enter ZooKeeper address (default: 127.0.0.1:2181): " ZK_ADDRESS
ZK_ADDRESS=${ZK_ADDRESS:-"127.0.0.1:2181"}

echo ""
echo -e "${BLUE}📥 Installing Chat Room${NC}"
echo ""

# Create installation directory
INSTALL_DIR="$HOME/chat-room"
echo "Installing to: ${INSTALL_DIR}"

mkdir -p "${INSTALL_DIR}"
cd "${INSTALL_DIR}"

# Clone or update repository
REPO_URL="https://github.com/yourusername/chat-room.git"

if [ -d "chat-room" ]; then
    echo "Directory exists, updating..."
    cd chat-room
    git pull origin main || {
        echo -e "${YELLOW}Git pull failed, reinstalling...${NC}"
        cd ..
        rm -rf chat-room
        git clone "${REPO_URL}" chat-room
        cd chat-room
    }
else
    echo "Cloning repository..."
    git clone "${REPO_URL}" chat-room
    cd chat-room
fi

echo ""

# Install dependencies
echo "Installing dependencies..."
npm install --silent

echo ""

# Build the project
echo "Building project..."
npm run build

echo ""

# Create config directory
CONFIG_DIR="$HOME/.chat-room"
mkdir -p "${CONFIG_DIR}"

# Generate user ID
USER_ID="user-$(date +%s)-$RANDOM"

# Create config file
cat > "${CONFIG_DIR}/config.json" << EOF
{
  "userId": "${USER_ID}",
  "nickname": "User$RANDOM",
  "p2pPort": 9000,
  "zkAddress": ["${ZK_ADDRESS}"],
  "recentRooms": []
}
EOF

echo -e "${GREEN}✓ Config created: ${CONFIG_DIR}/config.json${NC}"
echo ""

# Create global symlink (optional)
read -p "Create global command 'chat-room'? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Creating global command..."
    sudo npm link -g 2>/dev/null || {
        echo -e "${YELLOW}⚠ Requires sudo permissions. Skipping global command.${NC}"
    }
fi

echo ""
echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  Installation Complete! 🎉${NC}"
echo -e "${GREEN}=====================================${NC}"
echo ""
echo -e "${BLUE}📝 Quick Start:${NC}"
echo ""
echo "1. Make sure ZooKeeper is running:"
echo "   - macOS: brew services start zookeeper"
echo "   - Linux: sudo systemctl start zookeeper"
echo ""
echo "2. Start the chat room:"
echo "   - cd ${INSTALL_DIR}/chat-room && node dist/index.js"
echo "   - Or globally: chat-room"
echo ""
echo "3. Configuration:"
echo "   - Edit: ${CONFIG_DIR}/config.json"
echo "   - Change your nickname and other settings"
echo ""
echo -e "${YELLOW}⚠️  Important:${NC}"
echo "   - ZooKeeper must be running before starting the chat room"
echo "   - Default ZooKeeper: ${ZK_ADDRESS}"
echo "   - Config file: ${CONFIG_DIR}/config.json"
echo ""
