from PIL import Image
import PIL.ExifTags
import base64
import io
from pathlib import Path
import os 

def rotate_image_based_on_exif(img):
    try:
        # Loop through all the tags in the image's EXIF data
        for orientation in PIL.ExifTags.TAGS.keys():
            if PIL.ExifTags.TAGS[orientation] == "Orientation":
                break

        # Get the EXIF data from the image
        exif = dict(img._getexif().items())

        # Rotate the image based on the orientation
        if exif[orientation] == 3:
            img = img.rotate(180, expand=True)
        elif exif[orientation] == 6:
            img = img.rotate(270, expand=True)
        elif exif[orientation] == 8:
            img = img.rotate(90, expand=True)

    except (AttributeError, KeyError, IndexError):
        # If there was an error reading the EXIF data, do nothing
        pass

    return img

def generate_blur_data_url(image_content):
    try:
        image = Image.open(io.BytesIO(image_content))

        # Convert to RGB if necessary (handles RGBA, P, etc.)
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")

        # Rotate based on EXIF orientation
        image = rotate_image_based_on_exif(image)

        # Create small blurred version
        image = image.resize((10, 10), Image.Resampling.LANCZOS)

        buffered = io.BytesIO()
        image.save(buffered, format="JPEG", quality=85)

        # Return data URL format
        encoded_img = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return f"data:image/jpeg;base64,{encoded_img}"

    except Exception as e:
        print(f"Error generating blur data URL: {e}")
        # Return a minimal 1x1 transparent placeholder
        return "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlCyQhQTlUYfmvzaGBg="
