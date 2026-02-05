#!/bin/bash

# Configuration
PLUGIN_NAME="IPTV_IINA"
OUTPUT_FILE="${PLUGIN_NAME}.iinaplgz"
STAGING_DIR="dist/staging"
DIST_DIR="dist"

# Files to include (Globs)
INCLUDE_FILES=(
  "Info.json"
  "*.js"
  "*.html"
  "*.css"
  "LICENSE"
  "README.md"
  "CHANGELOG.md"
  "INSTALLATION_GUIDE.md"
  "mpv.conf"
)

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== IINA Plugin Packager ===${NC}"

# 1. Cleanup
echo -e "${BLUE}[1/4] Cleaning previous builds...${NC}"
rm -rf "$DIST_DIR"
rm -f "$OUTPUT_FILE"
mkdir -p "$STAGING_DIR"

# 2. Copy Files
echo -e "${BLUE}[2/4] Copying files to staging...${NC}"

for pattern in "${INCLUDE_FILES[@]}"; do
  # Find files matching pattern at root depth only
  find . -maxdepth 1 -name "$pattern" -type f -exec cp "{}" "$STAGING_DIR/" \;
done

# Copy docs/ folder if it exists
if [ -d "docs" ]; then
    cp -r "docs" "$STAGING_DIR/"
fi

# Verify Info.json exists
if [ ! -f "$STAGING_DIR/Info.json" ]; then
    echo -e "${RED}Error: Info.json not found in staging area!${NC}"
    exit 1
fi

# 3. Zip content
echo -e "${BLUE}[3/4] Creating .iinaplgz package...${NC}"
cd "$STAGING_DIR" || exit
# Zip recursively, excluding DS_Store hidden files just in case
zip -r -q -X "../../$OUTPUT_FILE" . -x "*.DS_Store"
cd ../..

# 4. Verify
if [ -f "$OUTPUT_FILE" ]; then
    SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
    echo -e "${GREEN}✓ Success! Package created:${NC} $OUTPUT_FILE ($SIZE)"
    echo -e "${GREEN}✓ Ready for deployment.${NC}"
else
    echo -e "${RED}Error: Output file not created.${NC}"
    exit 1
fi
