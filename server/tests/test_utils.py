from datetime import datetime
from types import SimpleNamespace

import pytest

from utils import utils as u


@pytest.mark.parametrize(
    "name, expected",
    [
        ("Hawaiian Pep Rally - 8/28/26", "hawaiian-pep-rally-8-28-26"),
        ("Café Déjà Vu", "cafe-deja-vu"),
        ("  spaced   out  ", "spaced-out"),
        ("", "album"),
        ("---", "album"),
    ],
)
def test_slugify(name, expected):
    assert u.slugify(name) == expected


def test_exif_datetime_parses_camera_format():
    assert u._exif_datetime("2026:08:28 17:04:11") == datetime(2026, 8, 28, 17, 4, 11)


def test_exif_datetime_rejects_other_formats():
    with pytest.raises(ValueError):
        u._exif_datetime("2026-08-28 17:04:11")


def test_capture_time_prefers_exif_original():
    meta = {
        "file_metadata": {
            "exif_data": '{"DateTimeOriginal": "2026:08:28 09:15:00"}',
            "upload_date": datetime(2026, 9, 1),
        }
    }
    assert u.capture_time(meta) == datetime(2026, 8, 28, 9, 15)


def test_capture_time_falls_back_to_upload_when_exif_is_bad():
    meta = SimpleNamespace(exif_data="not json", upload_date=datetime(2026, 9, 1))
    assert u.capture_time(meta) == datetime(2026, 9, 1)


def test_capture_time_without_any_date_sorts_first():
    meta = SimpleNamespace(exif_data=None, upload_date=None)
    assert u.capture_time(meta) == datetime.min


@pytest.mark.parametrize(
    "filename, expected",
    [
        ("IMG_1234.jpg", "img_1234"),
        ("IMG_1234_v2.JPG", "img_1234"),
        ("img_1234 v3.png", "img_1234"),
        ("IMG_1234_v2-r2.jpg", "img_1234"),
        ("Party-171-preview-r2.jpg", "party-171-preview-r2"),
        (None, ""),
    ],
)
def test_base_name_of_strips_version_suffix(filename, expected):
    assert u.base_name_of(filename) == expected


def test_original_key_uses_hold_copy_only_when_held():
    held = SimpleNamespace(held=True, original_filename="raw.cr3", filename="web.jpg")
    assert u.original_key("wedding", held, "tok") == "wedding/_hold/tok/raw.cr3"
    plain = SimpleNamespace(held=False, original_filename="raw.cr3", filename="web.jpg")
    assert u.original_key("wedding", plain, "tok") == "wedding/web.jpg"


def test_proof_ready_gates_locked_albums():
    assert u.proof_ready(SimpleNamespace(held=False, content_type="image/jpeg"), locked=False)
    assert not u.proof_ready(SimpleNamespace(held=False, content_type="image/jpeg"), locked=True)
    assert u.proof_ready(SimpleNamespace(held=True, content_type="image/jpeg"), locked=True)
    assert u.proof_ready(SimpleNamespace(held=False, content_type="video/mp4"), locked=True)


def test_json_response_serializes_datetimes_as_iso():
    body = u.json_response({"n": 1, "when": datetime(2026, 8, 28, 17, 4)}).body
    assert body == b'{"n":1,"when":"2026-08-28T17:04:00"}'
