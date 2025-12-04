# Changelog

## [1.1.8.0-alpha-37] - 2025-12-04

**Fixed icloudpd Command & HEIC Handling**

- **Fixed hallucination** - Removed non-existent `--convert-to-jpeg` and `--jpeg-quality` flags
- **Kept flat directory** - `--folder-structure=none` IS a real flag and works great!
- **Added HEIC conversion back** - Resize script converts HEIC → JPG using pillow-heif
- Re-added `pillow-heif` dependency for proper HEIC support
- Updated photo counting to include HEIC files before conversion
- Slideshow only shows JPG/PNG (after HEIC conversion)
- Auto-deletes HEIC files after successful JPG conversion

## [1.1.8.0-alpha-36] - 2025-12-04

**Simplified Photo Storage & Auto-Sync on Album Change**

- **Flat directory structure** - Added `--folder-structure=none` to icloudpd (no more subdirectories!)
- ~~JPG conversion at download~~ - This flag doesn't exist, fixed in alpha-37
- **Auto-sync on album change** - Automatically clears photos and syncs when selecting a new album
- **Auto-clear photos** - When switching albums, old photos are cleared automatically
- Added user feedback messages when selecting albums

## [1.1.8.0-alpha-35] - 2025-12-04

**CRITICAL FIX: Recursive Photo Scanning & HEIC Support** (REVERTED IN alpha-36)

- Fixed photo counting to scan subdirectories recursively
- Added HEIC support with pillow-heif
- Added recursive file scanning throughout

This version discovered that icloudpd was creating subdirectories, but alpha-36 fixes it properly!

## [1.1.8.0-alpha-34] - 2025-12-04

**Album List & Sync Debugging Improvements**

- Fixed album list to filter out icloudpd log lines (INFO/DEBUG/etc)
- Fixed password redaction in logs (was showing plaintext)
- Added detailed sync logging to troubleshoot why photos aren't downloading
- Added UI note that SHARED albums are required (not regular albums)
- Improved album parsing to only show actual album names
- Added stdout/stderr preview logging for sync operations

## [1.1.8.0-alpha-33] - 2025-12-04

**Album Browser & Sync Fixes**

- Added "Browse Albums" button to list and select albums
- Added `/api/icloud/albums` endpoint to fetch album list
- Fixed credential saving - now saves when 2FA is required (was causing 400 error)
- Added logging to icloud_sync.py for debugging photo sync
- Album selection UI with clickable list

## [1.1.8.0-alpha-32] - 2025-12-04

**Debug 2FA Validation & Critical Fix**

- **FIXED:** Credentials now saved when 2FA is required (was causing "credentials not found" error)
- Added logging to 2FA validation endpoint
- Will show what's received in request body
- Will show if credentials are present in settings

## [1.1.8.0-alpha-31] - 2025-12-04

**Enhanced Python Logging**

- Added detailed logging around 2FA/2SA checks
- Added try/catch around property access to catch any exceptions
- Log result output before sending to stdout
- Fixed exit code logic to not fail when 2FA is required
- This will pinpoint exactly where the script is failing

## [1.1.8.0-alpha-30] - 2025-12-04

**Added Debug Endpoint**

- Added `/api/debug/env` endpoint to check environment without Python
- Shows Node version, Python version, installed pip packages, file listings
- Accessible from browser to debug container environment

## [1.1.8.0-alpha-29] - 2025-12-04

**CRITICAL FIX: Python Module Installation**

- Fixed pyicloud not being found by changing `pip3` to `python3 -m pip`
- This ensures packages install to the correct Python environment
- Added verification step to confirm pyicloud imports successfully during build
- This was the root cause of authentication failures

## [1.1.8.0-alpha-28] - 2025-12-04

**Enhanced Debugging**

- Added stderr capture for Python script execution
- Added test endpoint `/api/icloud/test` to verify Python environment
- Enhanced error logging to capture Python stderr output
- Will now show actual Python errors in logs

## [1.1.8.0-alpha-27] - 2025-12-04

**Debugging & Error Handling**

- Added detailed error logging for iCloud authentication
- Improved Python script error handling with try/catch wrapper
- Added console logging to trace authentication flow
- Better error messages returned to frontend

## [1.1.8.0-alpha-26] - 2025-12-04

**Cryptography Version Fix**

- Upgraded `cryptography` package to version 40+ to fix import errors
- Removed Alpine's old `py3-cryptography` (v3.3.2) package
- Added build dependencies for compiling cryptography from source
- Fixed ImportError: cannot import name 'types' from cryptography

## [1.1.8.0-alpha-25] - 2025-12-04

**Dependency Fix**

- Added explicit `pyicloud` installation to Dockerfile
- Fixed ModuleNotFoundError for pyicloud module

## [1.1.8.0-alpha-24] - 2025-12-04

**Runtime Fix**

- Removed `sharp` dependency (not needed - using Pillow in Python for image resizing)
- Fixed runtime error on Node.js 16 (sharp requires Node 18+)
- All image resizing handled by Python/Pillow instead of Node.js/sharp

## [1.1.8.0-alpha-23] - 2025-12-04

**Build & Runtime Fix**

- Removed `sharp` dependency (not needed - using Pillow in Python for image resizing)
- Fixed runtime error on Node.js 16 (sharp requires Node 18+)
- Added BUILD_VERSION ARG to Dockerfile to fix undefined variable warning
- Fixed Dockerfile to avoid distutils packaging conflict
- Simplified pip upgrade to use --ignore-installed flag
- Install icloudpd without upgrading setuptools/wheel to avoid Alpine Linux package conflicts

## [1.1.8.0-alpha-22] - 2025-12-04

**Build Fix**

- Fixed Dockerfile to properly install icloudpd by upgrading pip/setuptools/wheel first
- Resolved TOML parser error during Python dependency installation

## [1.1.8.0-alpha-21] - 2025-12-04

**🎨 iCloud Photos Screensaver**

Major new feature: Display photos from your iCloud shared albums as a beautiful screensaver when the display dims!

### New Features

- **iCloud Integration**
  - Secure authentication with Apple ID and password
  - Two-factor authentication (2FA) support
  - Session management with ~60-day token lifespan
  - Automatic session expiration warnings (7 days before expiry)

- **Photo Syncing**
  - Sync photos from iCloud shared albums
  - Configurable sync frequency (1-24 hours)
  - Background automatic syncing
  - Manual sync button for immediate updates

- **Storage Management**
  - Configurable storage limits (100MB - 5GB, default: 500MB)
  - Automatic cleanup of oldest photos when limit reached
  - Real-time storage usage display with progress bar
  - Photo count tracking

- **Image Optimization**
  - Configurable output resolution: 4K, 1080p (default), 720p, or Original
  - Automatic image resizing to save storage space
  - JPEG compression with quality optimization

- **Screensaver Mode**
  - Full-screen photo slideshow when display dims
  - Smooth fade transitions between photos (2-second fade)
  - 10-second display per photo
  - Random shuffle of photos
  - Clock display in corner showing time and date
  - Tap anywhere to exit screensaver

- **Settings UI**
  - Complete settings panel in Settings tab
  - Visual status indicators (Connected/Disconnected/Warning)
  - Storage usage bar with visual warning when near limit
  - Last sync timestamp with human-readable format
  - One-click cache clearing
  - 2FA modal for authentication

### Technical Implementation

- Added Python scripts for iCloud authentication and photo syncing
- Integrated `icloudpd` for photo downloading
- Added image resizing with Pillow
- New API endpoints for iCloud management
- Background sync scheduler
- Session monitoring system

### Dependencies Added

- Python: `icloudpd`, `pyicloud`, `Pillow`, `py3-pillow`, `jpeg-dev`, `zlib-dev`
- Node.js: `python-shell`

### Files Added

- `icloud_auth.py` - Authentication and session management
- `icloud_sync.py` - Photo syncing logic
- `resize_images.py` - Image optimization
- `ICLOUD_SCREENSAVER.md` - Complete feature documentation

See `ICLOUD_SCREENSAVER.md` for detailed setup instructions and usage guide.

## [1.1.7.2-alpha-20] - 2025-12-02

- **Made reward points optional** - Chores can now have 0 reward points
- Changed default reward points from 10 to 0
- Label updated to "Reward Points (optional)"
- Description clarifies: "0 = no reward"
- Reward badge only displays when points > 0

## [1.1.7.2-alpha-19] - 2025-12-02

- **Fixed build error** - Removed duplicate `addChoreButton` declaration

## [1.1.7.2-alpha-18] - 2025-12-02

**Chore Rewards & Editing**

- **Added reward points system** - Chores can now have reward points assigned (default: 10 points)
- **Reward points input** - New field in chore form to set custom reward value
- **Reward display** - Chore cards show gold badge with star icon and points (e.g., "⭐ 15 pts")
- **Edit chore functionality** - Added edit button to chore cards
- **Smart modal** - Same form for adding and editing, automatically populates existing data
- **Form improvements**:
  - Hidden choreId field tracks which chore is being edited
  - Submit button changes text/icon based on mode (Add vs Save)
  - Modal title updates (Add New Chore vs Edit Chore)
- **Backend integration** - Uses PATCH `/api/chores/:id` for updates
- **Visual polish** - Tooltips on action buttons, gold/orange reward badge styling

## [1.1.7.2-alpha-17] - 2025-12-02

- **Fixed chore completion persistence** - Chore completed/pending status now saves to backend via PATCH request
- Toggle button now makes API call to `/api/chores/:id` to update `completed` field
- Status persists across page refreshes and sessions

## [1.1.7.2-alpha-16] - 2025-12-02

**Fixed Chore Assignment System**

- **Chores now use user IDs** - Changed from `assigneeName` (string) to `userId` (proper reference)
- **Dynamic assignee dropdown** - Chore assignment dropdown now populates from actual user profiles
- **User-colored lanes** - Kanban lanes show user's profile color and icon
- **Proper user lookup** - Chores are now properly associated with user profiles
- **Handles deleted users** - Gracefully skips chores assigned to deleted users
- **Backend updated** - POST `/api/chores` now expects `userId` instead of `assigneeName`

## [1.1.7.2-alpha-15] - 2025-12-02

- **Multi-day event support** - Events spanning multiple days now appear on every day within their range
- **Smart day indicators** - Multi-day all-day events show:
  - First day: Date range (e.g., "Dec 22 - Jan 2")
  - Middle days: Progress (e.g., "Day 5 of 11")
  - Final day: "Final day"
- Single-day all-day events show "All day"
- Added event deduplication to prevent duplicates on same day
- Uses existing border styling (no visual changes to borders)

## [1.1.7.2-alpha-14] - 2025-12-02

- **Fixed readData error** - Fixed undefined function error in calendar endpoint

## [1.1.7.2-alpha-13] - 2025-12-02

- **Fixed calendar events not loading** - Updated `/api/calendar` endpoint to fetch events for assigned calendars only (30 days range)
- **Optimized calendar event fetching** - Only fetch events for calendars assigned to users (reads users.json first)
- Returns empty array if no calendars are assigned to any users
- Significantly improves performance when there are many unassigned calendars

## [1.1.7.2-alpha-12] - 2025-12-02

**Major Feature Release: User-Specific Calendar Management & Custom Calendar Views**

### Calendar Assignment System

- **Added calendar-to-user mapping** - Each user profile can now be assigned a specific Home Assistant calendar
- **New API endpoint** - `GET /api/calendars/list` fetches available calendars with friendly names
- **Smart calendar dropdown** - Shows which calendars are already assigned and prevents conflicts
- **Unassign support** - Users can have no calendar assigned and won't appear in toggles
- User toggles now only show users with assigned calendars

### Custom Calendar Views

- **Replaced FullCalendar** - Built custom grid-based calendar for better control and performance
- **5 view modes** with intelligent date ranges starting from current day:
  - **Today**: Single day column view
  - **Tomorrow**: 2-column view (today + tomorrow)
  - **Week**: 7-day view starting today
  - **2 Weeks**: 2 rows × 7 columns (14 days)
  - **Month**: 4 rows × 7 columns (28 days)
- **View persistence** - Selected view saves to localStorage and persists across page refreshes
- **Default view** - Week view on first load

### Enhanced Event Display

- **User-colored events** - Events automatically colored by their assigned user's profile color
- **Weather integration** - Each day column shows weather icon and high/low temps from forecast
- **Past event dimming** - Past events appear grayed out at 20% opacity
- **All-day event indicators** - Visual distinction for all-day events
- **Event details** - Shows time, title, location (with icon) for each event
- **Click to preview** - Clicking events shows details in footer next event section

### User Filtering with Animation

- **Toggle user events** - Click user icons to show/hide their events
- **Smooth fade animation** - Events fade out and collapse smoothly when filtered (0.3s CSS transition)
- **Filter completely removes** - Filtered events disappear from view entirely (not just hidden)
- **Multi-user filtering** - Filter any combination of users simultaneously

### Profile Management Enhancements

- **Calendar assignment field** - Added to user profile edit form
- **Calendar dropdown** - Populated from Home Assistant calendars
- **Assignment validation** - Prevents assigning the same calendar to multiple users
- **Data structure update** - Users now include `calendarEntity` and `gameTimeLimit` fields
- **Backward compatibility** - Existing users get default values on first load

### UI/UX Improvements

- **View selector toolbar** - Prominent buttons for switching between calendar views
- **Improved calendar grid** - Clean, modern card-based event layout matching design system
- **Responsive day columns** - Flexible layout adapts to different view modes
- **Today highlighting** - Current day has orange background on day number
- **No events indicator** - Graceful "No events" message when days are empty
- **No users message** - Helpful message when no calendars are assigned yet

### Technical Improvements

- **Removed FullCalendar dependency** - Lighter bundle size and better control
- **localStorage integration** - Persistent view preferences
- **Event fetching optimization** - Only fetch calendars for users with assignments
- **Calendar re-rendering** - Smart updates when changing views, filtering, or data updates
- **Tab visibility handling** - Calendar re-renders when switching to calendar tab

### Breaking Changes

- Users without assigned calendars will not appear in the calendar user toggles
- Old calendar view preferences are not migrated (will default to Week view)
- Custom FullCalendar themes no longer apply (uses new custom styling)

## [1.1.7.2-alpha-11] - 2025-12-02

- **Fixed build error** - Removed duplicate `addProfileButton` event listener (was already set up earlier in the file)

## [1.1.7.2-alpha-10] - 2025-12-02

- **Fixed profile saving** - Implemented actual API calls to save user profiles (was just simulation before)
- **Fixed profile creation** - Add Profile button now opens modal properly
- **Fixed profile deletion** - Implemented actual API call to delete profiles
- Profile changes now properly persist to `/api/users` endpoints
- Added POST /api/users for creating new profiles
- Added PUT /api/users/:id for updating existing profiles
- Added DELETE /api/users/:id for deleting profiles
- User toggles reload after profile save/delete to keep calendar in sync

## [1.1.7.2-alpha-9] - 2025-12-02

- **Fixed weather forecast API call** - Corrected REST API structure (flat, not nested target/data)
- **Fixed forecast response parsing** - Now correctly extracts forecast from `service_response` wrapper
- Added detailed logging for forecast data debugging
- Forecast now returns 5-6 days with condition, temperature, templow, wind, humidity, precipitation

## [1.1.7.2-alpha-8] - 2025-12-02

- **Fixed sunrise/sunset icons** - Replaced Font Awesome Pro icons (`fa-sunrise`, `fa-sunset`) with free alternatives (`fa-sun`, `fa-moon`)

## [1.1.7.2-alpha-7] - 2025-12-02

- **Fixed forecast API call** - Added `?return_response=1` query parameter to service call
- **Fixed missing initial data** - Added initial calls to `fetchWeather()`, `fetchSunTimes()`, and `fetchWeatherForecast()` on page load
- **Fixed config update** - All weather functions now called when config updates and weather is enabled
- Sunrise/sunset icons now display properly with times from sun entity

## [1.1.7.2-alpha-6] - 2025-12-02

- **Major header redesign** to match dashboard YAML structure:
  - Left: Date & Time (day, full date, large time)
  - Center: Weather icon + current temp/condition/wind + details (humidity, pressure, sunrise, sunset)
  - Right: 5-day forecast ONLY
- **Sunrise/sunset times** now fetched from `sun.sun` entity (more accurate)
- **Weather forecast** now fetched via `weather.get_forecasts` service call
- Added `/api/sun` endpoint to get sun entity data
- Added `/api/weather/forecast` endpoint to call get_forecasts service
- Improved weather details layout with icon + temp side-by-side
- Enhanced forecast display with proper day names and high/low temps
- Better responsive design for mobile devices

## [1.1.7.2-alpha-5] - 2025-12-02

- Redesigned header to match dashboard YAML 3-column layout
- Left column: Day of week, full date, large time display (like better-moment-card)
- Center column: Large weather icon with humidity, pressure, sunrise/sunset details
- Right column: Current temperature with 5-day forecast display
- Added forecast cards showing next 5 days with icons and high/low temps
- Improved responsive design with single-column layout on mobile
- Enhanced date/time formatting to match LLLL format

## [1.1.7.2-alpha-4] - 2025-12-02

- Enhanced weather widget UI with detailed information
- Added humidity, pressure, sunrise/sunset times display
- Added wind speed and direction display
- Redesigned weather layout with larger icon and better organization
- Improved responsive design for weather widget

## [1.1.7.2-alpha-3] - 2025-12-02

- Fixed weather condition text showing as "Unknown"
- Changed to read condition from `data.state` instead of `data.attributes.condition`
- Added weather condition logging on backend

## [1.1.7.2-alpha-2] - 2025-12-02

- Added `homeassistant_api: true` to config for Core API access
- Fixed 401 Unauthorized errors for calendar and weather endpoints
- Added authentication debugging and logging

## [1.1.7.2-alpha-1] - 2025-12-02

- Initial attempt at fixing 401s with enhanced logging

## [1.1.7.2-alpha] - 2025-12-02

- Testing some changes

## [1.1.7.1] - 2025-05-12

- Correct build errors

## [1.1.7] - 2025-05-12

### Added

- Screen burn prevention feature that automatically dims the display after a period of inactivity
- Auto night mode that shifts to warmer colors based on time to reduce blue light at night
- Persistent clock display option for always visible time
- Display settings in the Settings tab for configuring screen protection features
- Countdown timer when screen is dimmed with tap-to-wake functionality

## [1.1.6] - 2025-05-09

### Added

- Added Hextris hexagonal puzzle game to Games tab
- Added Clumsy Bird arcade game to Games tab
- Improved game modal interface for consistent user experience

## [1.1.5] - 2025-05-09

### Added

- Recipe book feature with ingredient tracking
- Grocery list management system
- Integration between recipe ingredients and grocery list
- Ability to track ingredient availability and purchase dates
- Select recipes when adding to meal plan

## [1.1.4] - 2025-05-09

### Added

- Expanded "Chores" feature with interactive Kanban board.
- New "Meals" tab for meal planning functionality.
- New "Games" tab placeholder for future functionality.
- Added Geometry Dash to the Games tab with fullscreen modal play capability.
- Added modals for adding new chores and meals.
- Implemented user color coding system.

### Changed

- Enhanced UI with improved styles and layout.
- Better mobile responsiveness.
- Optimized sidebar navigation with toggle functionality.

---

## [1.1.3] - 2025-05-09

### Fixed

- Re-enabled `/api/calendar` and `/api/weather` endpoints in `index.js`.
- Added more detailed error logging for these API calls.

---

## [1.1.2] - 2025-05-09

### Fixed

- Ensured `options.json` is included in the Git repository for the Docker build process.

---

## [1.1.1] - 2025-05-09

### Fixed

- Corrected Dockerfile to properly build and place application files in `/app`.
- Simplified and fixed `rootfs/etc/cont-init.d/setup.sh` to work with the new Dockerfile structure, resolving startup errors when running the add-on via S6 init.

---

## [1.1.0] - 2025-05-09

### Added

- Sidebar navigation with tabs for "Calendar" and "Chores".
- Basic display for "Chore Chart" feature (read-only from sample data).
- Icons to sidebar tabs.
- Fallback mechanism to load local `options.json` for easier local development.

### Changed

- Main UI restructured to support tabbed content.
- Webpack configuration updated to correctly bundle client-side assets (`public/script.js`) and not server-side code.
- `public/index.html` updated to load bundled JavaScript (`dist/bundle.js`).

### Fixed

- Initial Webpack build errors due to incorrect entry point and missing Node.js core module polyfills for client-side context.
- JavaScript error preventing chore chart from displaying.
- Error preventing server startup (`npm start`) locally due to missing `/data/options.json`.

---

## [1.0.0] - Initial Release

- Basic calendar display from Home Assistant.
- Weather integration.
- Light and dark themes.
- Kiosk mode.
