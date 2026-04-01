#!/bin/bash

# Output version information for installation scripts
VERSION=$(node -p "require('./package.json').version")
echo "chat-room version ${VERSION}"
