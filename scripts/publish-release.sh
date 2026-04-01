#!/bin/bash

# GitHub Release Publisher
# Creates a GitHub release and uploads binary packages

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

VERSION=${1:-$(node -p "require('./package.json').version")}

echo -e "${GREEN}🚀 Publishing Release v${VERSION}${NC}"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}GitHub CLI not found. Install from: https://cli.github.com/${NC}"
    exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo -e "${YELLOW}Not authenticated with GitHub. Run: gh auth login${NC}"
    exit 1
fi

# Build binaries first
echo "Building binaries..."
./scripts/build-binaries.sh

echo ""
echo "Creating GitHub release..."

# Create release notes
NOTES_FILE="release-notes.md"
cat > $NOTES_FILE << EOF
# Chat Room v${VERSION}

## 📦 Downloads

Choose your platform:

- **macOS**: \`chat-room-macos-x64.tar.gz\`
- **Linux**: \`chat-room-linux-x64.tar.gz\`
- **Windows**: \`chat-room-win-x64.zip\`

## 🚀 Quick Start

### macOS / Linux:
\`\`\`bash
# Download and extract
curl -L https://github.com/yourusername/chat-room/releases/download/v${VERSION}/chat-room-macos-x64.tar.gz | tar xz

# Make executable
chmod +x chat-room-macos

# Run
./chat-room-macos
\`\`\`

### Windows:
\`\`\`powershell
# Download and extract
Invoke-WebRequest -Uri "https://github.com/yourusername/chat-room/releases/download/v${VERSION}/chat-room-win-x64.zip" -OutFile "chat-room.zip"
Expand-Archive -Path chat-room.zip -DestinationPath .

# Run
.\chat-room-win.exe
\`\`\`

## 📝 Configuration

First run creates config file at:
- **macOS/Linux**: \`~/.chat-room/config.json\`
- **Windows**: \`%USERPROFILE%\.chat-room\config.json\`

Edit the file to set your nickname and ZooKeeper address.

## ✨ Features

- P2P chat with automatic node discovery
- @ mentions and message replies
- Message persistence
- Multi-room support
- Terminal UI with keyboard shortcuts

## 🐛 Bug Fixes

See CHANGELOG.md for details.

## 📚 Documentation

- [User Guide](https://github.com/yourusername/chat-room/blob/main/docs/用户使用说明文档.md)
- [Installation Guide](https://github.com/yourusername/chat-room/blob/main/docs/快速安装指南.md)
EOF

# Create release
gh release create "v${VERSION}" \
  --title "Chat Room v${VERSION}" \
  --notes-file $NOTES_FILE \
  --draft

echo ""
echo "Uploading binary packages..."

# Upload binaries
cd binaries

for file in *.tar.gz *.zip; do
    if [ -f "$file" ]; then
        echo "Uploading $file..."
        gh release upload "v${VERSION}" "$file" --clobber
    fi
done

cd ..

# Clean up
rm $NOTES_FILE

echo ""
echo -e "${GREEN}✅ Release v${VERSION} published successfully!${NC}"
echo ""
echo "Release URL: https://github.com/yourusername/chat-room/releases/tag/v${VERSION}"
echo ""
echo "Next steps:"
echo "1. Review the release at the URL above"
echo "2. Edit release notes if needed"
echo "3. Publish the release (remove draft status)"
echo ""
