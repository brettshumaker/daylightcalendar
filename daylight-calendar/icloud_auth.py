#!/usr/bin/env python3
"""
iCloud Authentication and Session Management
Handles login, 2FA, and session persistence for icloudpd
"""

import sys
import json
import os
from pyicloud import PyiCloudService
from pyicloud.exceptions import PyiCloudFailedLoginException

def authenticate(apple_id, password, cookie_directory):
    """
    Authenticate with iCloud and handle 2FA if required.
    Returns status and session info.
    """
    try:
        # Initialize iCloud service
        api = PyiCloudService(
            apple_id,
            password,
            cookie_directory=cookie_directory
        )
        
        # Check if 2FA is required
        if api.requires_2fa:
            return {
                "success": False,
                "requires_2fa": True,
                "message": "Two-factor authentication required"
            }
        
        # Check if 2SA (older 2-step) is required
        if api.requires_2sa:
            return {
                "success": False,
                "requires_2sa": True,
                "message": "Two-step authentication required"
            }
        
        # Authentication successful
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
    # Read command from stdin
    command_data = json.loads(sys.stdin.read())
    
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
    print(json.dumps(result))
    sys.exit(0 if result.get("success", False) else 1)

