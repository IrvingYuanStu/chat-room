#!/bin/bash

# Release Script
# Usage: ./scripts/release.sh [version]

set -e

VERSION=${1:-"patch"}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}📦 Releasing Chat Room v${VERSION}${NC}"
echo ""

# Check if git is clean
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Run tests
echo "Running tests..."
npm test

# Build
echo "Building..."
npm run build

# Update version
echo "Updating version to ${VERSION}..."
npm version ${VERSION} -m "Release version %s"

# Create release tag
echo "Creating release tag..."
git push --follow-tags

# Create GitHub Release (requires gh CLI)
if command -v gh &> /dev/null; then
    echo "Creating GitHub Release..."
    gh release create v${VERSION} \
        --title "Chat Room v${VERSION}" \
        --notes "See CHANGELOG.md for details" \
        --draft
fi

echo ""
echo -e "${GREEN}✅ Release v${VERSION} created successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Review and publish the GitHub release: https://github.com/yourusername/chat-room/releases"
echo "2. Update install.sh with the new version"
echo "3. Announce the release"
