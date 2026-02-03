# Changelog

## [6.2.0] - 2026-02-03 - HISTORY-RESUME-PERSISTENCE

### Added
- **File-Based Persistent Storage**: History and resume positions now saved to JSON files that survive IINA restarts
- **Enhanced Metadata Parsing**: Improved `episode.info` parsing with better error handling and more field fallbacks
- **Rating Display**: Episode cards now display rating/score when available from API
- **Automatic Migration**: Old preference-based data automatically migrated to file-based storage on first load

### Fixed
- **History Not Persisting**: Implemented file-based storage (`iptv_history.json`) with preferences fallback
- **Resume Positions Lost**: Implemented file-based storage (`iptv_resume_positions.json`) with preferences fallback
- **History Limited to 1 Item**: Fixed `addToHistory()` to use `series_id` as unique key for episodes, preventing duplicate entries
- **Sync Frequency Too Low**: Increased resume position sync from 15s to 5s for better accuracy
- **Episode Metadata Missing**: Enhanced `parseEpisodeInfo()` with aggressive JSON cleanup and better error logging
- **Missing Episode Fields**: Added more fallback fields for metadata extraction (banner, synopsis, release_date, air_date, audio_language, audio_codec, bit_rate, rating_5stars)

### Changed
- **global.js**:
  - Added `getHistoryFilePath()` and `getResumePositionsFilePath()` functions
  - Added `writeHistoryToFile()` and `readHistoryFromFile()` functions (~200 lines)
  - Added `writeResumePositionsToFile()` and `readResumePositionsFromFile()` functions (~200 lines)
  - Updated `loadHistory()` to async with file-first loading strategy
  - Updated `saveHistory()` to async with file + preferences redundancy
  - Updated `saveResumePositions()` to async with file + preferences redundancy
  - Updated `updateResumePosition()` to async
  - Updated `addToHistory()` to use `series_id` for episode grouping
  - Updated `showWindow()` to async to await `loadHistory()`
  - Changed sync interval from 15s to 5s
- **browser.js**:
  - Enhanced `parseEpisodeInfo()` with better error handling and verbose logging
  - Enhanced `extractEpisodeMetadata()` with more field fallbacks and rating extraction
  - Updated `renderEpisodesList()` to display rating badges
- **Info.json**: Updated version to 6.2.0 with new feature descriptions

### Technical Details
- **Storage Pattern**: Three-tier fallback - File (primary) → Preferences (fallback) → Empty state
- **File Locations**: 
  - `iptv_history.json` in plugin Application Support directory
  - `iptv_resume_positions.json` in plugin Application Support directory
- **Communication Flow**: main.js → `iptv_current_resume` pref → global.js (sync every 5s) → File + Preferences
- **Async/Await**: Several functions now async and must be awaited properly
- **Modified Files**: `global.js`, `browser.js`, `Info.json`
- **Lines Added**: ~450 lines of new code for file-based storage and enhanced metadata parsing

### User Experience
- History now persists across IINA restarts (close and reopen IINA, history still there)
- Resume positions now persist across IINA restarts (stop watching, close IINA, reopen, can resume)
- Episodes from same series now grouped as single history entry (clicking loads series page)
- Episode metadata more reliably displays (images, descriptions, ratings)
- Better accuracy for resume positions (5s sync instead of 15s)

---

## [6.0.0] - 2026-02-03 - HISTORY-AND-RESUME

### Added
- **Custom Base64 Encoding/Decoding**: Pure JavaScript implementation (`base64Encode`, `base64Decode`) compatible with IINA's JavaScript environment where standard `btoa`/`atob` functions are not available
- **Playback Progress Tracking**: Real-time position monitoring using `iina.mpv.getNumber('time-pos')` in main.js with automatic saving every 10 seconds
- **Resume Position Persistence**: Positions stored in `iina.preferences` with automatic sync from main.js to global.js every 15 seconds
- **User-Friendly Resume Dialog**: French prompt showing time position (e.g., "Reprendre la lecture depuis 12:34 (45% visionné)?") with OK/Cancel choice
- **Automatic Position Clearing**: Resume data automatically cleared when playback completes via `iina.event.on('mpv.end-file')`
- **Enhanced History Storage**: Improved JSON serialization with type checking for both string and object formats
- **Resume Position Sync**: Background sync mechanism reads `iptv_current_resume` preference from main.js and updates stored positions
- **Stream ID Tracking**: Play requests now include `streamId` parameter for accurate position tracking across sessions

### Fixed
- **btoa/atob Error**: Replaced standard Base64 functions with custom implementations that work in IINA's JavaScript context
- **History Not Persisting**: Added proper JSON serialization with type checking and better error handling in `loadHistory()` and `saveHistory()`
- **Resume Positions Not Saving**: Implemented complete tracking pipeline from main.js → preferences → global.js → persistent storage
- **Missing Resume Prompt**: Integrated resume dialog into play flow with proper async handling and user choice processing
- **Position Data Loss**: Added periodic sync (every 15s) from main.js to ensure positions are saved even if playback ends unexpectedly

### Changed
- **main.js**: 
  - Added `startPlaybackTracking()` function with periodic position saving
  - Added `saveCurrentPosition()` function called every 10 seconds during playback
  - Added `clearResumePosition()` function for playback completion
  - Added event listeners for `iina.event.on('iina.file-loaded')` and `iina.event.on('mpv.end-file')`
  - Enhanced `playStream()` to accept `resumePosition` parameter and seek to position if provided
- **global.js**:
  - Added `base64Encode()` and `base64Decode()` utility functions
  - Updated `encodePassword()` and `decodePassword()` to use custom Base64 functions
  - Enhanced `loadHistory()` with type checking for string/object formats
  - Enhanced `saveHistory()` and `saveResumePositions()` with explicit JSON serialization
  - Added background sync interval (15s) to read `iptv_current_resume` from main.js
  - Updated `handlePlay()` to accept and pass `resumePosition` parameter
- **browser.js**:
  - Updated `playStream()` to check for resume positions before playing
  - Enhanced `resumePosition` message handler to show French dialog and process user choice
  - Added `window._pendingPlay` tracking for async resume flow
- **Info.json**: Updated version to 6.0.0-HISTORY-AND-RESUME with comprehensive description

### Technical Details
- **Modified Files**: `global.js`, `main.js`, `browser.js`, `Info.json`
- **Lines Added**: ~250 lines of new code for history and resume functionality
- **APIs Used**:
  - `iina.mpv.getNumber('time-pos')` - Get current playback position
  - `iina.mpv.getNumber('duration')` - Get total duration
  - `iina.mpv.command('seek', [pos, 'absolute'])` - Seek to position
  - `iina.event.on('iina.file-loaded', callback)` - Detect new file load
  - `iina.event.on('mpv.end-file', callback)` - Detect playback end
  - `iina.preferences.get/set()` - Cross-context data sharing
- **Communication Flow**: main.js → `iptv_current_resume` preference → global.js (sync every 15s) → `iptv_resume_positions` preference → persistent storage
- **Resume Threshold**: Only prompt if user has watched >10 seconds AND more than 30 seconds remaining

### User Experience
- When starting a previously watched video, users see: "Reprendre la lecture depuis [time] ([percent]% visionné)?"
- Users can click OK to resume or Cancel to restart from beginning
- Positions are automatically saved every 10 seconds during playback
- When a video is finished, the resume position is automatically cleared
- History persists across IINA restarts with thumbnails and metadata

---

## [5.4.0] - 2026-02-03 - ROBUST-METADATA-PARSING

### Fixed
- **CRITICAL BUG FIX**: Episode metadata now displays correctly with robust JSON parsing
- Fixed issue where episode thumbnails and descriptions were not showing due to JSON parsing failures
- Enhanced `episode.info` parsing with aggressive cleanup for malformed JSON strings
- Improved error handling with detailed logging for parsing failures
- Fixed HTML generation to use data attributes and event listeners instead of inline onclick handlers

### Changed
- **New `parseEpisodeInfo()` function**:
  - Handles both JSON string and object formats for `episode.info`
  - Performs aggressive cleanup of escaped characters, newlines, tabs, and control characters
  - Provides detailed error logging with raw value inspection
  - Falls back to alternative parsing methods when initial parsing fails
- **New `extractEpisodeMetadata()` function**:
  - Centralized metadata extraction with clear priority order
  - Comprehensive fallback chain for thumbnails (13+ locations)
  - Comprehensive fallback chain for descriptions (7+ locations)
  - Comprehensive fallback chain for duration (6+ locations)
  - Comprehensive fallback chain for quality (6+ locations)
- **Improved `renderEpisodesList()` function**:
  - Uses DOM API with `createElement` instead of innerHTML strings
  - Adds event listeners programmatically for better reliability
  - Provides detailed statistics on rendered/skipped/error episodes
  - Enhanced debug logging at each step of the rendering process

### Technical Details
- **Root Cause**: `episode.info` field from Xtream API is a JSON-encoded string that may contain:
  - Escaped quotes (`\"`) that break standard JSON parsing
  - Newline and tab characters (`\n`, `\t`) embedded in the string
  - Control characters that cause parse errors
- **Solution**: Multi-stage parsing approach:
  1. First attempt: Clean common escape sequences and parse
  2. Second attempt: Remove all control characters and parse
  3. Fallback: Use empty object if all parsing fails
- **HTML Generation**: Switched from inline `onclick` attributes to event listeners
  - Prevents issues with special characters in attribute values
  - Better security (XSS prevention)
  - More reliable event handling

### Debug Features
- Detailed logging for each episode's parsing stage
- Raw `episode.info` value inspection (first 300 chars)
- Episode info keys logging after successful parsing
- Final extraction results with YES/NO indicators
- Statistics summary: Success/Skipped/Errors counts

---

## [5.3.0] - 2026-02-03 - EPISODE-METADATA-FIX

### Fixed
- **CRITICAL BUG FIX**: Episode metadata now displays correctly with images, descriptions, and all information
- Fixed issue where episode thumbnails and descriptions were not showing
- Enhanced parsing of `episode.info` field - now handles both JSON string and object formats
- Improved thumbnail extraction with 18+ fallback locations for maximum compatibility
- Enhanced metadata extraction: plot, duration, quality, container format now display properly

### Changed
- **Episode Metadata Extraction**:
  - Added automatic JSON parsing for `episode.info` when it's a string
  - Expanded thumbnail sources: stream_icon, cover_big, movie_image, cover, thumbnail, backdrop_path, poster_path, poster, logo, fanart
  - Expanded description sources: plot, overview, description
  - Expanded quality sources: quality, video_quality
  - Added detailed debug logging for each episode's metadata extraction
- **CSS Enhancements**:
  - Added `.episode-quality` style for container format badge (MKV, MP4, etc.)
  - Added `.episode-quality-badge` style for quality indicator (HD, 4K, etc.)
  - Improved episode card visual layout

### Technical Details
- **Root Cause**: `episode.info` field from Xtream API can be either a JSON string or an object, and the code only handled object format
- **Solution**: Added type detection and JSON parsing for string format, with fallback to empty object
- **Metadata Fields**:
  - Thumbnails: 18+ possible locations checked in priority order
  - Descriptions: 6 possible locations (plot, overview, description) in both episode.info and direct episode fields
  - Duration: 4 possible locations (duration, runtime) in both episode.info and direct episode fields
  - Quality: 4 possible locations (quality, video_quality) in both episode.info and direct episode fields
- **Compatibility**: Works with all Xtream Codes API providers regardless of their metadata format

### Debug Features
- Detailed logging for each episode's raw data structure
- Logs for episode.info type and content
- Logs for each metadata field extraction attempt
- Final extraction results summary

---

## [5.2.0] - 2026-02-03 - SHELL-STORAGE

### Fixed
- **CRITICAL BUG FIX**: Credentials now persist correctly using shell commands via `iina.utils.exec`
- Fixed issue where `iina.fileSystem` API was not available in global.js context
- Replaced fileSystem-based storage with shell command execution for file I/O operations
- Credentials are now reliably saved to `iptv_credentials.json` using macOS/Linux shell commands

### Changed
- **Storage Architecture**: Shell-based file operations using `echo` and `cat` commands
- `saveCredentials()`: Uses shell redirection to write credentials to JSON file
- `loadCredentials()`: Uses shell `cat` command to read credentials from JSON file
- `credentialsFileExists()`: Uses shell `test` command to check file existence
- Enhanced error handling with detailed logging for debugging storage operations

### Technical Details
- **Root Cause**: `iina.fileSystem` API is not available in the global.js context (only in main.js)
- **Solution**: Use `iina.utils.exec()` to execute shell commands for file I/O operations
- **File Location**: `~/Library/Application Support/com.iinaltd.iina/plugins/data/iptv_credentials.json`
- **Commands Used**:
  - Write: `echo '{"key":"value"}' > /path/to/file.json`
  - Read: `cat /path/to/file.json`
  - Check: `test -f /path/to/file.json`
- **Compatibility**: Works on macOS and Linux systems
- **Fallback**: Maintains preference-based storage as secondary fallback

### Security Notes
- Passwords are Base64 encoded for basic obfuscation (not encryption)
- Credentials are stored in plugin's private data directory
- File permissions restrict access to the user only

---

## [5.1.0] - 2026-02-03 - FILE-STORAGE-FIX

### Fixed
- **CRITICAL BUG FIX**: Credentials now persist correctly between IINA sessions
- Fixed issue where "Remember Me" checkbox did not save account information
- Implemented hybrid storage system using `iina.fileSystem` as primary storage
- Credentials are now reliably saved to `iptv_credentials.json` file
- Added automatic migration from old preference-based storage to new file-based storage

### Changed
- **Storage Architecture**: Three-tier fallback system - File > Preferences (new) > Preferences (old)
- Enhanced credential loading with detailed logging for debugging
- Improved error handling and recovery for storage operations
- Password encoding (Base64) maintained for basic obfuscation
- Better user feedback when credentials are saved or loaded

### Technical Details
- **Root Cause**: `iina.preferences` does not persist reliably between IINA sessions in version 1.4.1
- **Solution**: Hybrid storage using `iina.fileSystem.write()` to save credentials to JSON file
- **File Location**: `iptv_credentials.json` in plugin data directory
- **Migration**: Automatically migrates existing credentials from preferences to file on first load
- **Redundancy**: Maintains both file and preference storage for maximum reliability
- **Compatibility**: Fully backward compatible with existing saved credentials

### Security Notes
- Passwords are Base64 encoded for basic obfuscation (not encryption)
- Credentials are stored in plugin's private data directory
- File permissions restrict access to the plugin only

---

## [5.0.0] - 2024-01-XX - CREDENTIAL-STORAGE

### Added
- **Credential Persistence**: User credentials (server URL, username, password) are now saved between IINA sessions
- **"Remember Me" Checkbox**: New checkbox on the connection form allows users to choose whether to save their credentials
- **Password Encoding**: Basic base64 encoding for stored passwords (obfuscation, not encryption)
- **Prefixed Storage Keys**: All stored values now use `iptv_` prefix to avoid conflicts with other plugins
- **Credential Migration**: Automatic migration from old storage format to new format
- **Storage Validation**: Added error handling and validation for all storage operations

### Changed
- **Disconnect Behavior**: Disconnect now preserves saved credentials (use Logout to clear them)
- **Auto-connect Logic**: Auto-connect only happens when "Remember Me" was enabled
- **Storage Functions**: Updated `loadCredentials()`, `saveCredentials()`, and added `clearCredentials()`

### Fixed
- Credentials are no longer lost when closing and reopening IINA
- Fixed storage key conflicts with generic keys
- Fixed credentials being cleared on disconnect

### Technical Details
- Storage keys changed from `server`, `username`, `password` to `iptv_server`, `iptv_username`, `iptv_password`, `iptv_remember_me`
- Password stored with base64 encoding (basic obfuscation)
- Backward compatible: migrates old credentials automatically
- Disconnect: Keeps saved credentials, just disconnects from server
- Logout (future): Will clear credentials and disconnect

### Migration Notes
- Existing users with saved credentials will be automatically migrated to the new format
- Old storage keys (`server`, `username`, `password`) are cleared after migration
- No action required from users

---

## [4.1.0] - Previous Release - THUMBNAIL-FIX

### Fixed
- Episode thumbnails with enhanced fallback locations
- Series cover as fallback for episode thumbnails

---

## [4.0.0] - Previous Release - ENHANCED

### Added
- Enhanced History with thumbnails
- Resume position tracking
- Auto-reconnect feature
