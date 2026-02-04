#!/bin/bash

# IINA Plugin Install Script
# This script builds the plugin and copies it to the IINA plugins directory

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IINA_PLUGINS_DIR="$HOME/Library/Application Support/com.colliderli.iina/plugins"
PLUGIN_NAME="com.iptv.iina-plugin.iinaplugin"
DEST_DIR="$IINA_PLUGINS_DIR/$PLUGIN_NAME"

echo -e "${YELLOW}=== IINA Plugin Install Script ===${NC}"
echo ""

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo -e "${RED}Error: Project directory not found: $PROJECT_DIR${NC}"
    exit 1
fi

# Navigate to project directory
cd "$PROJECT_DIR"

# Step 1: Build the project
echo -e "${YELLOW}Step 1: Building the project...${NC}"
if ! npm run build; then
    echo -e "${RED}Error: Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build completed${NC}"
echo ""

# Step 2: Check if IINA plugins directory exists
echo -e "${YELLOW}Step 2: Checking IINA plugins directory...${NC}"
if [ ! -d "$IINA_PLUGINS_DIR" ]; then
    echo -e "${RED}Error: IINA plugins directory not found: $IINA_PLUGINS_DIR${NC}"
    echo "Please make sure IINA is installed and has been run at least once."
    exit 1
fi
echo -e "${GREEN}✓ IINA plugins directory found${NC}"
echo ""

# Step 3: Create destination directory if it doesn't exist
echo -e "${YELLOW}Step 3: Preparing destination directory...${NC}"
if [ ! -d "$DEST_DIR" ]; then
    echo "Creating plugin directory: $DEST_DIR"
    mkdir -p "$DEST_DIR"
fi
echo -e "${GREEN}✓ Destination directory ready${NC}"
echo ""

# Copy dist folder contents to IINA plugins
echo -e "${YELLOW}Step 4: Copying built files to IINA plugins directory...${NC}"
if [ -d "$PROJECT_DIR/dist" ]; then
    # Copy all files from dist/ to the plugin directory
    cp -R "$PROJECT_DIR/dist/"* "$DEST_DIR/"
    echo -e "${GREEN}✓ Files copied successfully${NC}"
else
    echo -e "${RED}Error: dist/ directory not found. Build may have failed.${NC}"
    exit 1
fi
echo ""

# Step 5: Copy Info.json if it doesn't exist in destination
echo -e "${YELLOW}Step 5: Ensuring Info.json is present...${NC}"
if [ -f "$PROJECT_DIR/Info.json" ]; then
    cp "$PROJECT_DIR/Info.json" "$DEST_DIR/"
    echo -e "${GREEN}✓ Info.json copied${NC}"
else
    echo -e "${YELLOW}Warning: Info.json not found in project root${NC}"
fi
echo ""

# Step 6: Verify Info.json is present (copied in Step 5)
echo -e "${YELLOW}Step 6: Verifying installation components...${NC}"
if [ -f "$DEST_DIR/Info.json" ]; then
    echo -e "${GREEN}✓ Info.json present${NC}"
else
    echo -e "${RED}Error: Info.json missing in destination${NC}"
fi

# ui/ and styles.css are now part of dist/ (copied in Step 4), so no manual copy needed.


# Step 7: Copy Preferences.xib if it exists
echo -e "${YELLOW}Step 7: Checking for Preferences.xib...${NC}"
if [ -f "$PROJECT_DIR/Preferences.xib" ]; then
  cp "$PROJECT_DIR/Preferences.xib" "$DEST_DIR/"
  echo -e "${GREEN}✓ Preferences.xib copied${NC}"
else
  echo -e "${YELLOW}Note: Preferences.xib not found (optional file)${NC}"
fi
echo ""

# Summary
echo -e "${GREEN}=== Installation Complete ===${NC}"
echo ""
echo "Plugin installed to: $DEST_DIR"
echo ""
echo "Next steps:"
echo "1. Restart IINA if it's currently running"
echo "2. The plugin should now be loaded with the latest changes"
echo ""
echo "To restart IINA, you can:"
echo "  - Quit and reopen IINA manually"
echo "  - Or run: killall IINA && open -a IINA"
echo ""

# Ask if user wants to restart IINA
read -p "Do you want to restart IINA now? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Restarting IINA...${NC}"
    killall IINA 2>/dev/null || true
    sleep 1
    open -a IINA
    echo -e "${GREEN}✓ IINA restarted${NC}"
else
    echo "Please restart IINA manually to load the updated plugin."
fi