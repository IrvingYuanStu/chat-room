#!/bin/bash

# Quick Install Script - Clone and Setup
# Usage: curl -fsSL https://github.com/IrvingYuanStu/chat-room/main/quick-install.sh | bash

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}🚀 Chat Room Quick Install${NC}"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}❌ Node.js not found. Please install Node.js first.${NC}"
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

if ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}❌ npm not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ npm $(npm -v)${NC}"

if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}❌ git not found. Please install git first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ git $(git --version | awk '{print $3}')${NC}"

echo ""
echo -e "${BLUE}📡 ZooKeeper Configuration${NC}"
echo ""

# Check if ZooKeeper is accessible
read -p "Enter ZooKeeper address (default: 127.0.0.1:2181): " ZK_ADDRESS
ZK_ADDRESS=${ZK_ADDRESS:-"127.0.0.1:2181"}

# Test ZooKeeper connection
echo "Testing ZooKeeper connection..."
if echo ruok | nc ${ZK_ADDRESS%:*} ${ZK_ADDRESS#*:} 2>/dev/null | grep -q imok; then
    echo -e "${GREEN}✓ ZooKeeper is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Cannot connect to ZooKeeper at ${ZK_ADDRESS}${NC}"
    echo "   Please make sure ZooKeeper is running before starting the chat room"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "Installing chat room client..."

# Clone repository
INSTALL_DIR="$HOME/chat-room"
if [ -d "$INSTALL_DIR/chat-room" ]; then
    echo "Directory exists, updating..."
    cd "$INSTALL_DIR/chat-room"
    git pull
else
    echo "Cloning repository..."
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    git clone https://github.com/yourusername/chat-room.git
    cd chat-room
fi

# Install dependencies
echo "Installing dependencies..."
npm install --silent

# Build
echo "Building..."
npm run build

# Create config
CONFIG_DIR="$HOME/.chat-room"
mkdir -p "$CONFIG_DIR"

USER_ID="user-$(date +%s)-$RANDOM"
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

# Create symlink for global command (optional)
read -p "Create global command 'chat-room'? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Creating global command..."
    sudo npm link -g 2>/dev/null || {
        echo -e "${YELLOW}⚠ Requires sudo permissions. Skipping global command.${NC}"
    }
fi

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo -e "${BLUE}📝 Quick Start:${NC}"
echo ""
echo "1. Start the chat room:"
echo "   cd $INSTALL_DIR/chat-room"
echo "   npm start"
echo ""
echo "2. Or use global command:"
echo "   chat-room"
echo ""
echo "3. Configure your nickname:"
echo "   vim ${CONFIG_DIR}/config.json"
echo ""
echo -e "${YELLOW}⚠️  Make sure ZooKeeper is running at: ${ZK_ADDRESS}${NC}"
echo ""
