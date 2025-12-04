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
        
        # Add album filter if specified
        if album_name:
            cmd.extend(["--album", album_name])
            log(f"Added album filter: {album_name}")
        
        log(f"Running icloudpd command...")
        log(f"Command: {' '.join(cmd[:8])}... (password hidden)")
        
        # Run icloudpd
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        # Check for authentication errors
        if "authentication failed" in result.stderr.lower() or "2fa" in result.stderr.lower():
            return {
                "success": False,
                "error": "Authentication required",
                "message": "Session expired or 2FA required",
                "stderr": result.stderr
            }
        
        # Count downloaded photos
        photo_files = [f for f in os.listdir(output_directory) 
                      if f.lower().endswith(('.jpg', '.jpeg', '.png', '.heic'))]
        
        return {
            "success": True,
            "message": f"Successfully synced {len(photo_files)} photos",
            "photo_count": len(photo_files),
            "synced_at": datetime.now().isoformat(),
            "stdout": result.stdout,
            "stderr": result.stderr if result.returncode != 0 else None
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
        
        # Parse album names from output
        albums = []
        for line in result.stdout.split('\n'):
            line = line.strip()
            if line and not line.startswith('-'):
                albums.append(line)
        
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

