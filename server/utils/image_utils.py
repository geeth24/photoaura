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
    image = Image.open(io.BytesIO(image_content))
    image = image.resize((10, 10), Image.ANTIALIAS)
    buffered = io.BytesIO()
    image.save(buffered, format="JPEG")
    return base64.b64encode(buffered.getvalue()).decode("utf-8")
