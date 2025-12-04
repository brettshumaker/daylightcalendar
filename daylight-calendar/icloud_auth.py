#!/usr/bin/env python3
"""
iCloud Authentication and Session Management
Handles login, 2FA, and session persistence for icloudpd
"""

import sys
import json
import os

# Helper function to log to stderr (shows in HA addon logs)
def log(message):
    print(f"[Python] {message}", file=sys.stderr, flush=True)

log("icloud_auth.py script starting...")

try:
    log("Attempting to import pyicloud...")
    from pyicloud import PyiCloudService
    from pyicloud.exceptions import PyiCloudFailedLoginException
    log("pyicloud imported successfully!")
except ImportError as e:
    log(f"FAILED to import pyicloud: {e}")
    log(f"Python path: {sys.path}")
    log(f"Python executable: {sys.executable}")
    result = {
        "success": False,
        "error": "ImportError",
        "message": f"Failed to import pyicloud: {str(e)}",
        "python_path": sys.path,
        "python_executable": sys.executable
    }
    print(json.dumps(result))
    sys.exit(1)

def authenticate(apple_id, password, cookie_directory):
    """
    Authenticate with iCloud and handle 2FA if required.
    Returns status and session info.
    """
    try:
        log(f"Authenticating with Apple ID: {apple_id[:3]}...@...")
        log(f"Cookie directory: {cookie_directory}")
        
        # Initialize iCloud service
        api = PyiCloudService(
            apple_id,
            password,
            cookie_directory=cookie_directory
        )
        
        log("PyiCloudService initialized successfully")
        
        # Check if 2FA is required
        log("Checking if 2FA is required...")
        try:
            requires_2fa = api.requires_2fa
            log(f"requires_2fa = {requires_2fa}")
        except Exception as e:
            log(f"Error checking requires_2fa: {e}")
            requires_2fa = False
        
        if requires_2fa:
            log("2FA is required, returning response")
            return {
                "success": False,
                "requires_2fa": True,
                "message": "Two-factor authentication required"
            }
        
        # Check if 2SA (older 2-step) is required
        log("Checking if 2SA is required...")
        try:
            requires_2sa = api.requires_2sa
            log(f"requires_2sa = {requires_2sa}")
        except Exception as e:
            log(f"Error checking requires_2sa: {e}")
            requires_2sa = False
        
        if requires_2sa:
            log("2SA is required, returning response")
            return {
                "success": False,
                "requires_2sa": True,
                "message": "Two-step authentication required"
            }
        
        # Authentication successful
        log("Authentication successful, no 2FA/2SA required")
        return {
            "success": True,
            "requires_2fa": False,
            "message": "Authentication successful"
        }
        
    except PyiCloudFailedLoginException as e:
        return {
            "success": False,
            "error": "Invalid credentials",
            "message": str(e)
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(type(e).__name__),
            "message": str(e)
        }

def validate_2fa_code(apple_id, password, cookie_directory, code):
    """
    Validate 2FA code and establish trusted session.
    """
    try:
        api = PyiCloudService(
            apple_id,
            password,
            cookie_directory=cookie_directory
        )
        
        if not api.requires_2fa:
            return {
                "success": True,
                "message": "Already authenticated"
            }
        
        # Validate the 2FA code
        result = api.validate_2fa_code(code)
        
        if not result:
            return {
                "success": False,
                "error": "Invalid code",
                "message": "Failed to verify security code"
            }
        
        # Trust this session to avoid frequent 2FA prompts
        if not api.is_trusted_session:
            api.trust_session()
        
        return {
            "success": True,
            "message": "Two-factor authentication successful"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(type(e).__name__),
            "message": str(e)
        }

def check_session(apple_id, password, cookie_directory):
    """
    Check if existing session is still valid.
    """
    try:
        api = PyiCloudService(
            apple_id,
            password,
            cookie_directory=cookie_directory
        )
        
        # Try to access a service to verify session is valid
        api.drive  # This will raise an exception if session is invalid
        
        return {
            "success": True,
            "valid": True,
            "message": "Session is valid"
        }
        
    except Exception as e:
        return {
            "success": True,
            "valid": False,
            "message": "Session expired or invalid"
        }

if __name__ == "__main__":
    try:
        log("Reading command from stdin...")
        # Read command from stdin
        stdin_data = sys.stdin.read()
        log(f"Received {len(stdin_data)} bytes from stdin")
        command_data = json.loads(stdin_data)
        log(f"Parsed command: {command_data.get('command')}")
        
        command = command_data.get("command")
        apple_id = command_data.get("apple_id")
        password = command_data.get("password")
        cookie_directory = command_data.get("cookie_directory")
        
        result = None
        
        if command == "authenticate":
            result = authenticate(apple_id, password, cookie_directory)
        elif command == "validate_2fa":
            code = command_data.get("code")
            result = validate_2fa_code(apple_id, password, cookie_directory, code)
        elif command == "check_session":
            result = check_session(apple_id, password, cookie_directory)
        else:
            result = {
                "success": False,
                "error": "Unknown command",
                "message": f"Command '{command}' is not recognized"
            }
        
        # Output result as JSON
        log(f"Outputting result: {result}")
        print(json.dumps(result), flush=True)
        exit_code = 0 if result.get("success", False) or result.get("requires_2fa", False) or result.get("requires_2sa", False) else 1
        log(f"Exiting with code {exit_code}")
        sys.exit(exit_code)
    
    except Exception as e:
        # Catch any unhandled exceptions and return as JSON
        error_result = {
            "success": False,
            "error": str(type(e).__name__),
            "message": str(e)
        }
        print(json.dumps(error_result))
        sys.exit(1)

