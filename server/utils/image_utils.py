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


def compress_image(file_path, output_path, max_size=50, quality=100):
    # Ensure the output directory exists
    output_dir = Path(output_path).parent
    output_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(file_path) as img:
        # Rotate image based on EXIF data (assuming the rotate_image_based_on_exif function is defined)
        img = rotate_image_based_on_exif(img)

        # Resize image to 1080p if it's larger
        if img.width > 1920 or img.height > 1080:
            img.thumbnail((1920, 1080))
            
        img.save(output_path, quality=quality, optimize=True)


def generate_blur_data_url(image_path):
    with Image.open(image_path) as img:
        img = img.resize((5, 5))
        img = img.convert("RGB")

        buffer = io.BytesIO()
        img.save(buffer, format="JPEG")
        img_str = base64.b64encode(buffer.getvalue()).decode("utf-8")

        # Create blur data URL
        data_url = f"data:image/jpeg;base64,{img_str}"

        return data_url
