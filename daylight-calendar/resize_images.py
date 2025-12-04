#!/usr/bin/env python3
"""
Image Resizing Utility
Resizes images to specified resolution to save storage space
"""

import sys
import json
import os
from PIL import Image
from pathlib import Path

# Register HEIC support
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass  # HEIC support not available

def resize_image(input_path, output_path, max_width, max_height, quality=85):
    """
    Resize an image while maintaining aspect ratio.
    """
    try:
        with Image.open(input_path) as img:
            # Convert HEIC and other formats to RGB
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            
            # Calculate new dimensions maintaining aspect ratio
            img.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
            
            # Save resized image
            img.save(output_path, 'JPEG', quality=quality, optimize=True)
            
            # Get file sizes
            original_size = os.path.getsize(input_path)
            new_size = os.path.getsize(output_path)
            
            return {
                "success": True,
                "original_size": original_size,
                "new_size": new_size,
                "savings": original_size - new_size,
                "dimensions": img.size
            }
            
    except Exception as e:
        return {
            "success": False,
            "error": str(type(e).__name__),
            "message": str(e)
        }

def resize_directory(input_dir, output_dir, max_width, max_height, quality=85):
    """
    Resize all images in a directory.
    """
    try:
        results = {
            "success": True,
            "processed": 0,
            "failed": 0,
            "total_savings": 0,
            "errors": []
        }
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
        
        # Supported image extensions (including HEIC which we'll convert)
        image_extensions = {'.jpg', '.jpeg', '.png', '.heic', '.heif'}
        
        # Process each image
        for filename in os.listdir(input_dir):
            file_path = os.path.join(input_dir, filename)
            
            # Skip if not a file or not an image
            if not os.path.isfile(file_path):
                continue
            
            ext = Path(filename).suffix.lower()
            if ext not in image_extensions:
                continue
            
            # Always output as JPG (converts HEIC if needed)
            output_filename = Path(filename).stem + '.jpg'
            output_path = os.path.join(output_dir, output_filename)
            
            # Skip if output already exists
            if os.path.exists(output_path):
                results["processed"] += 1
                # Delete original HEIC if JPG exists
                if ext in ('.heic', '.heif') and file_path != output_path:
                    try:
                        os.remove(file_path)
                    except:
                        pass
                continue
            
            # Resize image (also converts HEIC to JPG)
            result = resize_image(file_path, output_path, max_width, max_height, quality)
            
            if result["success"]:
                results["processed"] += 1
                results["total_savings"] += result["savings"]
                
                # Delete original HEIC after successful conversion
                if ext in ('.heic', '.heif') and file_path != output_path:
                    try:
                        os.remove(file_path)
                    except:
                        pass
            else:
                results["failed"] += 1
                results["errors"].append({
                    "file": filename,
                    "error": result.get("message", "Unknown error")
                })
        
        results["message"] = f"Processed {results['processed']} images, {results['failed']} failed"
        return results
        
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
    
    result = None
    
    if command == "resize":
        input_path = command_data.get("input_path")
        output_path = command_data.get("output_path")
        max_width = command_data.get("max_width", 1920)
        max_height = command_data.get("max_height", 1080)
        quality = command_data.get("quality", 85)
        
        result = resize_image(input_path, output_path, max_width, max_height, quality)
        
    elif command == "resize_directory":
        input_dir = command_data.get("input_dir")
        output_dir = command_data.get("output_dir")
        max_width = command_data.get("max_width", 1920)
        max_height = command_data.get("max_height", 1080)
        quality = command_data.get("quality", 85)
        
        result = resize_directory(input_dir, output_dir, max_width, max_height, quality)
        
    else:
        result = {
            "success": False,
            "error": "Unknown command",
            "message": f"Command '{command}' is not recognized"
        }
    
    # Output result as JSON
    print(json.dumps(result))
    sys.exit(0 if result.get("success", False) else 1)

