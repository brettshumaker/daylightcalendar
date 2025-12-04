# Quick Setup Guide: iCloud Photos Screensaver

## Prerequisites

1. An Apple ID with iCloud Photos enabled
2. A shared iCloud Photos album created
3. Photos added to the shared album
4. Home Assistant with Daylight Calendar addon installed

## Step-by-Step Setup

### 1. Create Shared Album (iOS)

**IMPORTANT:** You **MUST** create a **SHARED** album. Regular albums will not work with icloudpd!

**On your iPhone or iPad:**

1. Open the **Photos** app
2. Tap **Albums** tab at the bottom
3. Tap the **+** button (top left)
4. Select **New Shared Album** ⚠️ (NOT "New Album")
5. Name it: `Calendar Screensaver` (or your preferred name)
6. Tap **Next**
7. **Add family members** (REQUIRED for shared album):
   - Tap **Invite**
   - Select contacts or enter email addresses
   - You must invite at least one person for it to be a shared album
   - Tap **Create**
8. Add photos to the album:
   - Open the shared album
   - Tap **+** or the camera icon
   - Select photos to add
   - Tap **Done**

**Note:** 
- All invited family members can add photos to this shared album from their devices!
- The album **MUST** be shared with at least one person to work with icloudpd
- Regular (non-shared) albums will appear in the browse list but won't sync any photos

### 2. Configure Daylight Calendar

**In the Daylight Calendar web interface:**

1. Click the **Settings** icon (⚙️) in the sidebar
2. Scroll down to **iCloud Photos Screensaver** section

### 3. Login to iCloud

1. Enter your **Apple ID** (email address)
2. Enter your **Apple ID password**
3. Click **Login to iCloud**
4. If you have 2FA enabled:
   - A 6-digit code will be sent to your trusted device
   - Enter the code in the popup
   - Click **Verify**
5. Wait for "Successfully authenticated" message

### 4. Configure Settings

**Recommended settings for first-time setup:**

- **Shared Album Name**: `Calendar Screensaver` (must match exactly)
- **Storage Limit**: `500` MB (adjust based on your SD card size)
- **Sync Frequency**: `Every 6 hours`
- **Image Resolution**: `1920x1080` (1080p - good balance)

Click **Save Settings**

### 5. Initial Sync

1. Click **Sync Now** button
2. Wait for sync to complete (may take a few minutes for first sync)
3. You should see:
   - Photo count increase
   - Storage usage update
   - "Last synced: Just now" message

### 6. Test the Screensaver

**Option A: Wait for Auto-Dim**
- Don't interact with the screen for the configured time (default: 10 minutes)
- The screen will dim and screensaver should start

**Option B: Manually Trigger (for testing)**
- You can adjust the "Dim After" setting to 1 minute for quick testing
- Or modify the code temporarily to trigger immediately

### 7. Exit Screensaver

- Simply **tap anywhere** on the screen
- The calendar view will return

## Troubleshooting

### "Session Expired" Error
- Re-login with your Apple ID credentials
- You'll need to do this approximately every 60 days

### No Photos Showing
- Verify the album name matches exactly (case-sensitive)
- Check that photos exist in the shared album
- Run manual sync
- Check storage usage - might be at limit

### Authentication Failed
- Double-check Apple ID and password
- Ensure 2FA code is correct (they expire quickly)
- Try logging in to iCloud.com in a browser to verify credentials

### Sync Taking Too Long
- First sync downloads all photos (up to 500)
- Subsequent syncs are faster (only new photos)
- Lower resolution settings sync faster

## Storage Recommendations

**For 32GB SD card (with ~15-20GB available):**
- 500MB storage limit = ~50-100 photos at 1080p
- 1GB storage limit = ~100-200 photos at 1080p
- 2GB storage limit = ~200-400 photos at 1080p

**Tips:**
- Start with 500MB and increase if needed
- Monitor storage usage in Settings
- Lower resolution saves significant space
- Clear cache and re-sync if needed

## Adding More Photos

**From any family member's iPhone:**

1. Open **Photos** app
2. Go to **Albums** → **Shared Albums**
3. Open the "Calendar Screensaver" album
4. Tap **+** or camera icon
5. Select photos to add
6. Tap **Done**

Photos will automatically sync to the calendar on the next scheduled sync (or click "Sync Now")!

## Security Notes

- Your Apple ID password is stored locally on your Raspberry Pi
- No data is sent outside your home network
- Photos are stored locally in `/data/screensaver_photos/`
- Session tokens expire every ~60 days for security

## Next Steps

Once configured:
- Photos sync automatically every X hours (based on your setting)
- Screensaver activates when display dims
- Add new photos anytime from any family member's device
- Monitor storage in Settings tab

Enjoy your personal photo frame! 📸

