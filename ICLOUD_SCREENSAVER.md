# iCloud Photos Screensaver Feature

## Overview

This feature adds iCloud Photos integration to Daylight Calendar, allowing you to display photos from a shared iCloud album as a screensaver when the display goes idle.

## Features Implemented

### 1. **iCloud Authentication**
- Secure login with Apple ID and password
- Two-factor authentication (2FA) support
- Session management with ~60-day token lifespan
- Automatic session expiration warnings

### 2. **Photo Syncing**
- Sync photos from iCloud shared albums
- Configurable sync frequency (1-24 hours)
- Background automatic syncing
- Manual sync option

### 3. **Storage Management**
- Configurable storage limits (100MB - 5GB)
- Automatic cleanup of oldest photos when limit reached
- Real-time storage usage display
- Photo count tracking

### 4. **Image Optimization**
- Configurable output resolution:
  - 4K (3840x2160)
  - 1080p (1920x1080) - Default
  - 720p (1280x720)
  - Original (no resize)
- Automatic image resizing to save space
- JPEG compression with quality optimization

### 5. **Screensaver Mode**
- Full-screen photo slideshow
- Smooth fade transitions between photos
- 10-second display per photo
- Random shuffle of photos
- Clock display in corner showing time and date
- Tap anywhere to exit

### 6. **Settings UI**
- Complete settings panel in Settings tab
- Visual status indicators (Connected/Disconnected/Warning)
- Storage usage bar with visual warning when near limit
- Last sync timestamp
- One-click cache clearing

## How to Use

### Initial Setup

1. **Navigate to Settings Tab**
   - Open the Daylight Calendar app
   - Click on the Settings icon in the sidebar

2. **Scroll to "iCloud Photos Screensaver" Section**

3. **Login to iCloud**
   - Enter your Apple ID email
   - Enter your Apple ID password
   - Click "Login to iCloud"
   - If 2FA is enabled, enter the 6-digit code sent to your trusted device

4. **Configure Settings**
   - **Shared Album Name**: Enter the name of your iCloud shared album (default: "Calendar Screensaver")
   - **Storage Limit**: Set maximum storage (default: 500MB)
   - **Sync Frequency**: Choose how often to sync (default: Every 6 hours)
   - **Image Resolution**: Select resolution (default: 1080p)
   - Click "Save Settings"

5. **Initial Sync**
   - Click "Sync Now" to download photos for the first time
   - Wait for sync to complete

### Creating the Shared Album (iOS)

1. Open the Photos app on your iPhone/iPad
2. Tap "Albums" at the bottom
3. Tap the "+" button to create a new album
4. Select "New Shared Album"
5. Name it "Calendar Screensaver" (or your chosen name)
6. Add family members as subscribers
7. Add photos to the album
8. Family members can also add photos from their devices

### Daily Use

- The screensaver will automatically activate when the screen dims (after configured inactivity period)
- Photos sync automatically based on your configured frequency
- Tap anywhere on the screensaver to return to the calendar
- Check Settings tab to monitor storage usage and sync status

### Re-authentication

- iCloud sessions expire after ~60 days for security
- You'll receive a warning 7 days before expiration
- When expired, simply re-login with your credentials and 2FA

## Technical Details

### Files Added

- **`icloud_auth.py`**: Python script for iCloud authentication and session management
- **`icloud_sync.py`**: Python script for syncing photos using icloudpd
- **`resize_images.py`**: Python script for image resizing and optimization

### Files Modified

- **`Dockerfile`**: Added Python dependencies (icloudpd, Pillow, etc.)
- **`package.json`**: Added Node.js dependencies (python-shell, sharp)
- **`index.js`**: Added iCloud API endpoints and background sync scheduler
- **`public/index.html`**: Added iCloud settings UI and screensaver overlay
- **`public/script.js`**: Added iCloud settings handlers and screensaver logic
- **`public/styles.css`**: Added styles for iCloud UI and screensaver

### API Endpoints

- `GET /api/icloud/settings` - Get current settings
- `POST /api/icloud/settings` - Update settings
- `POST /api/icloud/authenticate` - Initial login
- `POST /api/icloud/validate-2fa` - Verify 2FA code
- `GET /api/icloud/status` - Check authentication status
- `POST /api/icloud/sync` - Trigger manual sync
- `GET /api/icloud/photos` - List available photos
- `GET /api/icloud/photo/:filename` - Get individual photo
- `DELETE /api/icloud/cache` - Clear photo cache

### Data Storage

- **Settings**: `/data/icloud-settings.json`
- **Session Cookies**: `/data/icloud_session/`
- **Photos**: `/data/screensaver_photos/`

### Dependencies

**Python:**
- `icloudpd` - iCloud photo downloader
- `pyicloud` - iCloud API wrapper
- `Pillow (py3-pillow)` - Image processing

**Node.js:**
- `python-shell` - Execute Python scripts from Node.js
- `sharp` - High-performance image processing

## Security Considerations

1. **Credentials Storage**: Apple ID password is stored in `/data/icloud-settings.json`. In a production environment, consider encrypting this file.

2. **Session Tokens**: Session tokens are stored in `/data/icloud_session/` and are used to avoid frequent 2FA prompts.

3. **Network Security**: Ensure your Home Assistant instance is properly secured with HTTPS and authentication.

4. **Photo Privacy**: Photos are stored locally on your Raspberry Pi and are not transmitted outside your network.

## Troubleshooting

### Login Fails
- Verify your Apple ID and password are correct
- Check if 2FA code was entered correctly
- Ensure your network can reach Apple's servers

### Sync Not Working
- Check if session has expired (re-login required)
- Verify the shared album name matches exactly
- Ensure there's enough storage space available

### No Photos Showing
- Check if sync has been run at least once
- Verify photos exist in the shared album
- Check storage usage - may be at limit

### Storage Full
- Increase storage limit in settings
- Lower the image resolution setting
- Clear cache and re-sync with new settings

## Future Enhancements

Possible improvements for future versions:

- Encrypted credential storage
- Multiple album support
- Photo filtering by date range
- Transition effect options
- Manual photo upload via web interface
- Integration with other photo services (Google Photos, etc.)

## Credits

This feature was implemented to provide functionality similar to the Skylight Calendar's photo screensaver feature, adapted specifically for the Daylight Calendar Home Assistant add-on.

