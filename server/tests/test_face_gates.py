import pytest

from utils import face_recog as fr


def face(**overrides):
    base = {
        "bbox": [0, 0, 200, 200],
        "det_score": 0.95,
        "yaw": 0.0,
        "pitch": 0.0,
        "roll": 0.0,
        "blur": 90.0,
        "landmark_agreement": 0.05,
        "emb_norm": 20.0,
        "eye_open": 0.35,
        "gaze": 0.0,
        "smile": 0.0,
        "sharpness": 200.0,
    }
    base.update(overrides)
    return base


def old_row(**overrides):
    """A face stored before the face service sent quality signals."""
    row = {"bbox": [0, 0, 200, 200], "det_score": 0.95, "sharpness": 200.0}
    row.update(overrides)
    return row


def test_should_index_drops_low_confidence_and_tiny_faces():
    assert fr.should_index(face(det_score=0.2)) == (False, "low confidence")
    assert fr.should_index(face(bbox=[0, 0, 40, 200])) == (False, "too small")


def test_should_index_drops_non_faces_and_mush():
    assert fr.should_index(face(landmark_agreement=0.6)) == (False, "not a face")
    assert fr.should_index(face(emb_norm=5.0)) == (False, "not a face")
    assert fr.should_index(face(blur=2.0)) == (False, "mush")


def test_should_index_keeps_turned_and_soft_faces():
    assert fr.should_index(face(yaw=60.0, blur=10.0)) == (True, "")


def test_should_index_uses_old_sharpness_for_old_rows():
    assert fr.should_index(old_row(sharpness=5.0)) == (False, "garbage blur")
    assert fr.should_index(old_row()) == (True, "")


def test_is_core_accepts_old_rows_unconditionally():
    assert fr.is_core(old_row()) is True


@pytest.mark.parametrize(
    "overrides",
    [
        {"yaw": 50.0},
        {"pitch": 35.0},
        {"bbox": [0, 0, 60, 200]},
        {"landmark_agreement": 0.2},
        {"blur": 10.0},
        {"emb_norm": 10.0},
    ],
)
def test_is_core_rejects_faces_that_cannot_define_a_person(overrides):
    assert fr.is_core(face(**overrides)) is False


def test_is_core_accepts_a_clear_frontal_face():
    assert fr.is_core(face()) is True


def test_is_chip_worthy_is_stricter_than_core():
    assert fr.is_chip_worthy(face()) is True
    assert fr.is_chip_worthy(face(eye_open=0.1)) is False
    assert fr.is_chip_worthy(face(gaze=0.2)) is False
    assert fr.is_chip_worthy(face(roll=40.0)) is False


def test_is_chip_worthy_old_rows_use_the_original_bar():
    assert fr.is_chip_worthy(old_row()) is True
    assert fr.is_chip_worthy(old_row(det_score=0.5)) is False
    assert fr.is_chip_worthy(old_row(sharpness=50.0)) is False


def test_face_score_rewards_smiles_and_frontal_faces():
    assert fr.face_score(face(smile=0.9)) > fr.face_score(face(smile=0.0))
    assert fr.face_score(face(yaw=0.0)) > fr.face_score(face(yaw=30.0))


def test_face_score_signals_outrank_old_rows():
    best_old = fr.face_score(old_row(bbox=[0, 0, 300, 300], det_score=1.0, sharpness=400.0, eye_open=0.9))
    assert best_old == pytest.approx(195.0)
    assert fr.face_score(face(smile=0.0)) >= fr.SCORED_BASE


def test_face_score_uses_typical_similarity_when_given():
    assert fr.face_score(face(), typical=1.0) > fr.face_score(face(), typical=0.0)
