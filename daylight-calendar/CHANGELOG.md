# Changelog

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
