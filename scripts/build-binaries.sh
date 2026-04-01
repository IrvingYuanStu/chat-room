#!/bin/bash

# Build Binary Packages Script
# Creates standalone binary executables for different platforms

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}📦 Chat Room Binary Builder v${VERSION}${NC}"
echo ""

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
rm -rf binaries
mkdir -p binaries

# Build TypeScript first
echo -e "${YELLOW}Building TypeScript...${NC}"
npm run build

# Package for different platforms
echo -e "${YELLOW}Packaging for different platforms...${NC}"
echo ""

# macOS
echo -e "${GREEN}Building for macOS...${NC}"
pkg . --targets node18-macos-x64 --output ./binaries/chat-room-macos
if [ -f "./binaries/chat-room-macos" ]; then
    chmod +x ./binaries/chat-room-macos
    echo -e "${GREEN}✓ macOS binary created${NC}"
fi
echo ""

# Linux
echo -e "${GREEN}Building for Linux...${NC}"
pkg . --targets node18-linux-x64 --output ./binaries/chat-room-linux
if [ -f "./binaries/chat-room-linux" ]; then
    chmod +x ./binaries/chat-room-linux
    echo -e "${GREEN}✓ Linux binary created${NC}"
fi
echo ""

# Windows
echo -e "${GREEN}Building for Windows...${NC}"
pkg . --targets node18-win-x64 --output ./binaries/chat-room-win.exe
if [ -f "./binaries/chat-room-win.exe" ]; then
    echo -e "${GREEN}✓ Windows binary created${NC}"
fi
echo ""

# Create archives
echo -e "${YELLOW}Creating release archives...${NC}"
cd binaries

# macOS
if [ -f "chat-room-macos" ]; then
    tar -czf chat-room-macos-x64.tar.gz chat-room-macos
    echo -e "${GREEN}✓ chat-room-macos-x64.tar.gz${NC}"
fi

# Linux
if [ -f "chat-room-linux" ]; then
    tar -czf chat-room-linux-x64.tar.gz chat-room-linux
    echo -e "${GREEN}✓ chat-room-linux-x64.tar.gz${NC}"
fi

# Windows
if [ -f "chat-room-win.exe" ]; then
    zip chat-room-win-x64.zip chat-room-win.exe
    echo -e "${GREEN}✓ chat-room-win-x64.zip${NC}"
fi

cd ..

# Show file sizes
echo ""
echo -e "${BLUE}📊 Build Summary:${NC}"
echo ""
ls -lh binaries/ | grep -E "chat-room|\.tar|\.zip" | awk '{print $9, $5}'

echo ""
echo -e "${GREEN}✅ Build complete!${NC}"
echo ""
echo "Binaries location: ./binaries/"
echo ""
echo "To test:"
echo "  ./binaries/chat-room-macos  # macOS"
echo "  ./binaries/chat-room-linux   # Linux"
echo ""
