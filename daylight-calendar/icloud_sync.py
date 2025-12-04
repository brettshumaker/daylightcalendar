#!/usr/bin/env python3
"""
iCloud Photo Sync
Downloads photos from iCloud shared albums using icloudpd
"""

import sys
import json
import os
import subprocess
import time
from datetime import datetime

# Helper function to log to stderr
def log(message):
    print(f"[Python Sync] {message}", file=sys.stderr, flush=True)

def sync_photos(apple_id, password, cookie_directory, output_directory, album_name=None):
    """
    Sync photos from iCloud using icloudpd command-line tool.
    """
    try:
        log(f"Starting photo sync to {output_directory}")
        log(f"Album filter: {album_name if album_name else 'All Photos'}")
        
        # Ensure output directory exists
        os.makedirs(output_directory, exist_ok=True)
        log(f"Output directory ready")
        
        # Build icloudpd command
        # NOTE: icloudpd only downloads from ALL photos or specific SHARED albums
        # Regular albums cannot be downloaded individually
        cmd = [
            "icloudpd",
            "--username", apple_id,
            "--password", password,
            "--cookie-directory", cookie_directory,
            "--directory", output_directory,
            "--recent", "500",  # Download most recent 500 photos
            "--skip-videos",  # Skip videos by default to save space
            "--skip-live-photos",  # Skip live photos
            "--no-progress-bar",  # Disable progress bar for cleaner output
            "--threads-num", "3"  # Use 3 threads for faster download
        ]
        
        # Add album filter if specified (must be a SHARED album)
        if album_name:
            cmd.extend(["--album", album_name])
            log(f"Added shared album filter: {album_name}")
        else:
            log("No album specified - will download from All Photos")
        
        log(f"Running icloudpd command...")
        # Actually hide the password in logs
        safe_cmd = cmd.copy()
        if '--password' in safe_cmd:
            pwd_idx = safe_cmd.index('--password')
            safe_cmd[pwd_idx + 1] = '*****'
        log(f"Command: {' '.join(safe_cmd)}")
        
        # Run icloudpd
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        log(f"icloudpd completed with return code: {result.returncode}")
        log(f"icloudpd stdout length: {len(result.stdout)} chars")
        log(f"icloudpd stderr length: {len(result.stderr)} chars")
        
        # Log first 500 chars of output for debugging
        if result.stdout:
            log(f"stdout preview: {result.stdout[:500]}")
        if result.stderr:
            log(f"stderr preview: {result.stderr[:500]}")
        
        # Check for authentication errors
        if "authentication failed" in result.stderr.lower() or "2fa" in result.stderr.lower():
            log("Authentication error detected in stderr")
            return {
                "success": False,
                "error": "Authentication required",
                "message": "Session expired or 2FA required",
                "stderr": result.stderr
            }
        
        # Count downloaded photos
        photo_files = [f for f in os.listdir(output_directory) 
                      if f.lower().endswith(('.jpg', '.jpeg', '.png', '.heic'))]
        
        log(f"Found {len(photo_files)} photos in output directory")
        
        return {
            "success": True,
            "message": f"Successfully synced {len(photo_files)} photos",
            "photo_count": len(photo_files),
            "synced_at": datetime.now().isoformat(),
            "stdout": result.stdout[:1000] if result.stdout else None,  # Limit stdout size
            "stderr": result.stderr[:1000] if result.returncode != 0 and result.stderr else None
        }
        
    except subprocess.TimeoutExpired:
        return {
            "success": False,
            "error": "Timeout",
            "message": "Photo sync timed out after 5 minutes"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(type(e).__name__),
            "message": str(e)
        }

def list_albums(apple_id, password, cookie_directory):
    """
    List available albums from iCloud.
    """
    try:
        log("Listing iCloud albums...")
        cmd = [
            "icloudpd",
            "--username", apple_id,
            "--password", password,
            "--cookie-directory", cookie_directory,
            "--list-albums"
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        log(f"icloudpd output received, parsing albums...")
        
        # Parse album names from output, filtering out log lines
        albums = []
        in_albums_section = False
        
        for line in result.stdout.split('\n'):
            line = line.strip()
            
            # Skip empty lines
            if not line:
                continue
            
            # Skip log lines (INFO, DEBUG, WARNING, ERROR)
            if any(level in line for level in ['INFO', 'DEBUG', 'WARNING', 'ERROR', 'Processing user']):
                continue
            
            # Mark when we reach the "Albums:" header
            if line == 'Albums:':
                in_albums_section = True
                continue
            
            # Skip separator lines
            if line.startswith('-'):
                continue
            
            # Only add lines after "Albums:" header
            if in_albums_section:
                albums.append(line)
        
        log(f"Found {len(albums)} albums after filtering")
        
        return {
            "success": True,
            "albums": albums,
            "message": f"Found {len(albums)} albums"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(type(e).__name__),
            "message": str(e)
        }

if __name__ == "__main__":
    # Read command from stdin
    command_data = json.loads(sys.stdin.read())
    
    command = command_data.get("command")
    apple_id = command_data.get("apple_id")
    password = command_data.get("password")
    cookie_directory = command_data.get("cookie_directory")
    
    result = None
    
    if command == "sync":
        output_directory = command_data.get("output_directory")
        album_name = command_data.get("album_name")
        result = sync_photos(apple_id, password, cookie_directory, output_directory, album_name)
    elif command == "list_albums":
        result = list_albums(apple_id, password, cookie_directory)
    else:
        result = {
            "success": False,
            "error": "Unknown command",
            "message": f"Command '{command}' is not recognized"
        }
    
    # Output result as JSON
    print(json.dumps(result))
    sys.exit(0 if result.get("success", False) else 1)

