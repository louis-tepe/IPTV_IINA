# IINA IPTV Plugin

A powerful IPTV plugin for [IINA](https://iina.io) media player, supporting the Xtream Codes API for live TV, movies (VOD), and series.

![IINA IPTV Plugin](https://img.shields.io/badge/IINA-1.4.0+-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

- 📺 **Live TV** - Watch live channels with EPG support
- 🎬 **Movies (VOD)** - Browse and play video on demand content
- 📺 **Series** - Navigate seasons and episodes
- ⭐ **Favorites** - Save your favorite content for quick access
- 📜 **History** - Resume where you left off
- 🔍 **Search** - Search across all content types
- 🎨 **Modern UI** - Beautiful dark theme sidebar interface
- 🔌 **Modular Architecture** - Built with ES Modules and bundled with esbuild

## Requirements

- macOS 10.14 or later
- IINA 1.4.0 or later
- An IPTV subscription with Xtream Codes API support

## Installation

### Method 1: From GitHub (Recommended)

1. Open IINA
2. Go to **IINA → Preferences → Plugins**
3. Click **+** and enter the repository URL
4. The plugin will be installed automatically

### Method 2: Manual Installation

1. Download or clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the plugin:
   ```bash
   npm run build
   ```
4. Pack the plugin:
   ```bash
   /Applications/IINA.app/Contents/MacOS/iina-plugin pack .
   ```
5. Double-click the generated `.iinaplgz` file to install

## Configuration

1. Open **IINA → Preferences → Plugins → IPTV Settings**
2. Enter your IPTV credentials:
   - **Server URL**: Your provider's server URL (e.g., `http://example.com:8080`)
   - **Username**: Your IPTV username
   - **Password**: Your IPTV password
   - **Name**: Optional display name

Alternatively, configure directly in the sidebar when first launching.

## Usage

### Opening the IPTV Browser

- Click the **IPTV** tab in IINA's sidebar
- Or use the menu: **Plugins → IPTV → Open IPTV Browser**

### Navigation

- **Live TV Tab** - Browse live channels by category
- **Movies Tab** - Browse movies/VOD content by category
- **Series Tab** - Browse series, seasons, and episodes
- **Favorites Tab** - Access your saved content
- **History Tab** - Resume recently watched content

## Development

### Project Structure (Refactored)

```
IPTV_IINA/
├── dist/                  # Compiled output (generated)
├── src/                   # Source code
│   ├── browser/           # UI Logic (Browser window)
│   ├── global/            # Plugin Backend (Node.js/IINA API)
│   ├── main/              # Main Window Entry
│   └── shared/            # Shared Utilities
├── styles.css             # Stylesheet
├── scripts/               # Build scripts
├── Info.json              # Plugin manifest
└── package.json           # Dependencies & Scripts
```

### Building

```bash
npm run build
```

This uses `esbuild` to bundle the modular code in `src/` into the `dist/` directory (or root for legacy support).

### Debugging

1. Enable Safari's Develop menu
2. Open **Develop → IINA → your-plugin-context**
3. Use the Web Inspector to debug JavaScript

### Troubleshooting

#### Plugin not appearing in menu

- Check IINA Console (**Window → Console**) for errors starting with `[IPTV]`.
- verify "iina.menu API not available" -> Update IINA.

#### Common Errors

- `iina.utils.exec API not available`: Update IINA.
- `Failed to register menu item`: Reinstall plugin.

### Manual Reset

If you need to completely remove the plugin:

```bash
rm -rf ~/Library/Application\ Support/com.colliderli.iina/plugins/com.iptv.iina-plugin.iinaplugin*
```

Plugin files are located in: `~/Library/Application Support/com.colliderli.iina/plugins/`

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

- [IINA](https://iina.io) - The modern media player for macOS
- [Xtream Codes API](https://github.com/topics/xtream-codes-api) - API documentation
