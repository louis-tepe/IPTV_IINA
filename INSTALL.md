# Installation Guide

This guide explains how to install the IPTV IINA Plugin after building it.

## Quick Install (Recommended)

The easiest way to install the plugin is to use the provided install script:

```bash
npm run install-plugin
```

This script will:
1. Build the project (`npm run build`)
2. Copy the built files to IINA's plugins directory
3. Optionally restart IINA

## Manual Installation

If you prefer to install manually or need to troubleshoot:

### Step 1: Build the Project

```bash
npm run build
```

This creates the `dist/` folder with the bundled plugin files.

### Step 2: Copy Files to IINA Plugins Directory

**Option A: Copy only the dist folder contents**

```bash
cp -R dist/* "$HOME/Library/Application Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin/"
```

**Option B: Copy all necessary files**

```bash
# Create the plugin directory if it doesn't exist
mkdir -p "$HOME/Library/Application Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin"

# Copy the built files
cp -R dist/* "$HOME/Library/Application Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin/"

# Copy the manifest file
cp Info.json "$HOME/Library/Application Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin/"

# Copy preferences file (optional, for native UI)
cp Preferences.xib "$HOME/Library/Application Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin/" 2>/dev/null || true
```

### Step 3: Restart IINA

```bash
killall IINA && open -a IINA
```

Or simply quit and reopen IINA manually.

## Paths Reference

| Location | Path |
|----------|------|
| **Project Directory** | `/Users/tepe/Documents/Code/Project/IPTV_INNA/` |
| **Build Output** | `/Users/tepe/Documents/Code/Project/IPTV_INNA/dist/` |
| **IINA Plugins Directory** | `~/Library/Application Support/com.colliderli.iina/plugins/` |
| **Plugin Installation Directory** | `~/Library/Application Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin/` |

## Troubleshooting

### Plugin not appearing in IINA

1. **Check the installation directory:**
   ```bash
   ls -la "$HOME/Library/Application Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin/"
   ```
   
   You should see:
   - `main.js`
   - `global.js`
   - `Info.json`
   - Other bundled files

2. **Verify the build succeeded:**
   ```bash
   ls -la dist/
   ```
   
   You should see:
   - `main.js`
   - `global.js`
   - Other bundled files

3. **Check IINA's developer console:**
   - Open IINA
   - Right-click anywhere in the player window
   - Select "Developer Tools"
   - Check for any errors related to the plugin

### Build errors

If the build fails:
1. Make sure you have Node.js installed: `node --version`
2. Install dependencies: `npm install`
3. Clean and rebuild: `npm run clean && npm run build`

### Permission errors

If you get permission errors when copying files:
```bash
sudo cp -R dist/* "$HOME/Library/Application Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin/"
```

However, this should rarely be necessary since you're copying to your own user directory.

## Development Workflow

For active development, you can use watch mode:

```bash
# Terminal 1: Watch for changes and rebuild
npm run dev

# Terminal 2: After changes, install the plugin
npm run install-plugin
```

Or create a simple alias in your shell:

```bash
# Add to ~/.zshrc or ~/.bashrc
alias iptv-install='cd /Users/tepe/Documents/Code/Project/IPTV_INNA && npm run install-plugin'

# Then use it anytime
iptv-install
```

## Uninstalling

To remove the plugin:

```bash
rm -rf "$HOME/Library/Application Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin"
```

Then restart IINA.
