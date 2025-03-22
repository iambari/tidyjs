#!/bin/bash

# Stop script if an error occurs
set -e

# Clean dist folder
echo "🧹 Cleaning dist folder..."
rm -rf dist

# Build the extension
echo "🔨 Building extension..."
npm run build-prod

# Create symbolic link to VSCode extensions folder
EXTENSION_PATH="$HOME/.vscode/extensions/asmir.tidyjs-1.1.3"

echo "🔗 Installing extension..."
# Remove old link if exists
rm -rf "$EXTENSION_PATH"

# Create parent directory if needed
mkdir -p "$HOME/.vscode/extensions"

# Create symbolic link
ln -s "$(pwd)" "$EXTENSION_PATH"

echo "✅ Extension installed successfully!"
echo "📝 Restart VSCode to activate the extension"
