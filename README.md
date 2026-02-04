# IINA IPTV Plugin v8.0.0

A powerful IPTV plugin for [IINA](https://iina.io) media player, supporting the Xtream Codes API for live TV, movies (VOD), and series.

![IINA IPTV Plugin](https://img.shields.io/badge/IINA-1.4.0+-blue.svg)
![Version](https://img.shields.io/badge/version-8.0.0-orange.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

- 📺 **Live TV** - Watch live channels with EPG support
- 🎬 **Movies (VOD)** - Browse and play video on demand content
- 📺 **Series** - Navigate seasons and episodes with enhanced metadata
- ⭐ **Favorites** - Save your favorite content for quick access
- 📜 **History** - Resume where you left off (persistent across sessions)
- 🔍 **Search** - Search across all content types
- 🎨 **Modern UI** - Beautiful dark theme sidebar interface

## Performance Features (v8.0.0)

- ⚡ **Virtual Scrolling** - Smooth 60fps performance with 1000+ items
- 🖼️ **Lazy Image Loading** - Images load only when near viewport
- 🔄 **Request Deduplication** - Prevents duplicate API calls
- 💾 **Persistent Cache** - Cache survives IINA restarts
- 🔧 **Debug Mode** - Press 'D' key to toggle debug panel
- 🌍 **Internationalization** - Full i18n support (FR/EN) with automatic language detection
- 📡 **Event-Driven Architecture** - No polling, uses IINA event system for real-time updates
- 🔍 **Optimized Search** - Preloaded search data with debouncing for instant results
- 🎯 **Modular Design** - Clean separation of concerns with dedicated modules for API, storage, caching, and UI

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
2. Pack the plugin:
   ```bash
   /Applications/IINA.app/Contents/MacOS/iina-plugin pack .
   ```
3. Double-click the generated `.iinaplgz` file to install

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

### Playing Content

- Click any channel, movie, or episode to start playback
- For series, click the series to see seasons and episodes

### Managing Favorites

- Click the ❤️ heart icon on any content to add/remove from favorites
- Access all favorites from the **Favorites** tab

## API Compatibility

This plugin supports the **Xtream Codes API** format, which is the standard for most IPTV providers. The following endpoints are used:

| Content Type | Endpoints Used                                           |
| ------------ | -------------------------------------------------------- |
| Live TV      | `get_live_categories`, `get_live_streams`                |
| Movies       | `get_vod_categories`, `get_vod_streams`, `get_vod_info`  |
| Series       | `get_series_categories`, `get_series`, `get_series_info` |

## File Structure

```
IPTV_IINA/
├── Info.json              # Plugin manifest (v8.0.0)
├── global.js              # Global entry point - UI, API, caching, storage
├── main.js                # Player entry point - playback, resume tracking
├── styles.css             # Shared styles including virtual scroll styles
├── Preferences.xib        # Settings UI
├── src/                   # Modular source code
│   ├── api/               # API layer
│   │   └── xtream.js      # Xtream Codes API client
│   ├── core/              # Core utilities
│   │   ├── state.js       # Global state and constants
│   │   ├── i18n.js        # Internationalization system
│   │   └── dictionary.js  # Translation dictionaries
│   ├── managers/          # Business logic
│   │   ├── cache.js       # Caching with virtual scrolling support
│   │   ├── storage.js     # Credentials, history, favorites, resume positions
│   │   └── search.js      # Search functionality with preloading
│   ├── ui/                # Frontend modularized
│   │   ├── app.js         # Main UI application
│   │   ├── i18n-loader.js # i18n initialization
│   │   ├── components/    # UI components
│   │   │   ├── virtualScroll.js
│   │   │   ├── imageLoader.js
│   │   │   ├── series.js
│   │   │   ├── history.js
│   │   │   └── epg.js
│   │   └── utils/         # UI utilities
│   │       ├── dom.js
│   │       ├── i18n.js
│   │       └── debug.js
│   └── utils/             # Helper utilities
│       └── helpers.js     # Base64, timeout wrapper, Logger
├── ui/                    # HTML assets
│   ├── browser.html       # Main browser interface
│   └── connection.html    # Connection/login screen
├── CHANGELOG.md           # Version history
├── README.md              # Documentation
└── LICENSE                # MIT License
```

## Troubleshooting

### Connection Failed

- Verify your server URL includes the port (e.g., `:8080`)
- Check that your credentials are correct
- Ensure your subscription is active

### No Content Loading

- Try clicking the refresh button
- Check your internet connection
- Some providers may have rate limiting

### Playback Issues

- Some streams may require specific codecs
- Try a different stream to verify connectivity
- Check IINA's console for error messages

## Development

### Building

```bash
cd IPTV_IINA
/Applications/IINA.app/Contents/MacOS/iina-plugin pack .
```

### Debugging

1. Enable Safari's Develop menu
2. Open **Develop → IINA → your-plugin-context**
3. Use the Web Inspector to debug JavaScript

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

- [IINA](https://iina.io) - The modern media player for macOS
- [Xtream Codes API](https://github.com/topics/xtream-codes-api) - API documentation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
# IPTV_IINA
