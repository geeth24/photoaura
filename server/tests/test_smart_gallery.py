from datetime import datetime, timedelta

import numpy as np
import pytest

from services import smart_gallery as sg
from services.smart_gallery import Moment, Rec

START = datetime(2026, 8, 28, 17, 0, 0)


def unit(*vals):
    v = np.array(vals, dtype=np.float32)
    return v / np.linalg.norm(v)


def make_rec(i, t=None, clip=None, **overrides):
    fields = dict(
        id=i,
        filename=f"IMG_{i:04d}.jpg",
        t=t if t is not None else START + timedelta(seconds=i),
        has_time=True,
        portrait=False,
        aesthetic=0.5,
        sharpness=800.0,
        exposure=(0.0, 0.0, 0.5),
        clip=clip if clip is not None else unit(1, 0, 0, 0),
        faces=[],
    )
    fields.update(overrides)
    return Rec(**fields)


def face(box=(0, 0, 200, 200), **signals):
    return {"box": box, "blur": 150.0, "person": "ana", **signals}


@pytest.mark.parametrize("n, cap", [(0, 3), (48, 3), (80, 5), (160, 10), (1000, 14)])
def test_moment_cap_scales_with_album_size(n, cap):
    assert sg.moment_cap(n) == cap


@pytest.mark.parametrize("n, expected", [(10, 20), (400, 48), (10000, 80)])
def test_target_size_is_bounded(n, expected):
    assert sg.target_size(n) == expected


def test_main_faces_drops_small_and_background_faces():
    big = face(box=(0, 0, 200, 200))
    background = face(box=(0, 0, 80, 80))  # under half the biggest face
    speck = face(box=(0, 0, 30, 30))
    assert sg.main_faces([big, background, speck]) == [big]


def test_score_faces_flags_closed_eyes_on_the_main_face():
    rec = make_rec(1, faces=[face(eye_open=0.10, yaw=0, pitch=0)])
    sg.score_faces(rec)
    assert rec.closed is True
    assert rec.main_faces == 1
    assert rec.persons == frozenset({"ana"})


def test_score_faces_keeps_open_eyes_and_flags_soft_frames():
    rec = make_rec(1, faces=[face(eye_open=0.35, yaw=0, pitch=0)])
    sg.score_faces(rec)
    assert rec.closed is False
    assert rec.soft is False


def test_score_faces_without_people_uses_frame_sharpness():
    rec = make_rec(1, sharpness=50.0)
    sg.score_faces(rec)
    assert rec.soft is True
    assert rec.people == 0.0


def test_build_stacks_groups_close_look_alikes_only():
    a = make_rec(1, t=START, clip=unit(1, 0, 0, 0))
    b = make_rec(2, t=START + timedelta(seconds=2), clip=unit(1, 0.01, 0, 0))
    far = make_rec(3, t=START + timedelta(hours=1), clip=unit(1, 0, 0, 0))
    other_look = make_rec(4, t=START + timedelta(seconds=1), clip=unit(0, 1, 0, 0))
    groups = sorted((sorted(r.id for r in g) for g in sg.build_stacks([a, b, far, other_look])))
    assert groups == [[1, 2], [3], [4]]


def test_select_keeps_one_best_per_stack_and_flags_the_rest():
    recs = [
        make_rec(1, t=START, aesthetic=0.2),
        make_rec(2, t=START + timedelta(seconds=1), aesthetic=0.9),
        make_rec(3, t=START + timedelta(seconds=2), aesthetic=0.5),
    ]
    sg.select(recs)
    best = [r for r in recs if r.is_best]
    assert [r.id for r in best] == [2]
    assert {r.id: r.review for r in recs} == {1: "duplicate", 2: None, 3: "duplicate"}


def test_select_flags_soft_frames_as_blurry():
    rec = make_rec(1, sharpness=50.0)
    sg.select([rec])
    assert rec.review == "blurry"


def test_segment_moments_needs_enough_photos():
    recs = [make_rec(i) for i in range(sg.CONFIG.moment_min_photos * 2 - 1)]
    assert sg.segment_moments(recs) == []


def test_segment_moments_cuts_on_a_long_shooting_gap():
    first = [make_rec(i, t=START + timedelta(seconds=10 * i)) for i in range(6)]
    later_start = START + timedelta(hours=2)
    second = [make_rec(10 + i, t=later_start + timedelta(seconds=10 * i)) for i in range(6)]
    segments = sg.segment_moments(first + second)
    assert [[r.id for r in seg] for seg in segments] == [
        [0, 1, 2, 3, 4, 5],
        [10, 11, 12, 13, 14, 15],
    ]


def test_segment_moments_folds_small_segments_into_a_neighbor():
    big = [make_rec(i, t=START + timedelta(seconds=10 * i)) for i in range(6)]
    tiny_start = START + timedelta(hours=1)
    tiny = [make_rec(20 + i, t=tiny_start + timedelta(seconds=10 * i)) for i in range(2)]
    later = START + timedelta(hours=2)
    rest = [make_rec(30 + i, t=later + timedelta(seconds=10 * i)) for i in range(6)]
    segments = sg.segment_moments(big + tiny + rest)
    assert all(len(seg) >= sg.CONFIG.moment_min_photos for seg in segments)
    assert sum(len(seg) for seg in segments) == len(big) + len(tiny) + len(rest)


def test_segment_moments_skips_hidden_and_untimed_photos():
    first = [make_rec(i, t=START + timedelta(seconds=10 * i)) for i in range(10)]
    second_start = START + timedelta(hours=2)
    second = [make_rec(20 + i, t=second_start + timedelta(seconds=10 * i)) for i in range(10)]
    first[0].review_override = "hide"
    first[1].has_time = False
    segments = sg.segment_moments(first + second)
    ids = {r.id for seg in segments for r in seg}
    assert 0 not in ids and 1 not in ids
    assert len(ids) == 18


def test_label_moments_names_each_segment_after_its_clear_winner():
    vocab_labels = ["beach", "forest", "city"]
    vectors = np.stack([unit(1, 0, 0, 0, 0, 0), unit(0, 1, 0, 0, 0, 0), unit(0, 0, 1, 0, 0, 0)])
    beach = [make_rec(i, clip=unit(1, 0.02 * i, 0, 0, 0, 0)) for i in range(6)]
    forest = [make_rec(10 + i, clip=unit(0.02 * i, 1, 0, 0, 0, 0)) for i in range(6)]
    moments = sg.label_moments([beach, forest], np.stack([r.clip for r in beach + forest]), (vocab_labels, vectors))
    assert [m.label for m in moments] == ["beach", "forest"]
    assert [m.matched for m in moments] == ["beach", "forest"]


def test_label_moments_falls_back_without_a_vocabulary():
    segments = [[make_rec(1)], [make_rec(2)]]
    moments = sg.label_moments(segments, np.stack([unit(1, 0, 0, 0)] * 2), None)
    assert [m.label for m in moments] == ["Moment 1", "Moment 2"]


def test_label_moments_reuses_a_label_at_most_twice():
    vectors = np.stack([unit(1, 0, 0, 0), unit(0, 1, 0, 0)])
    beach = [[make_rec(i * 10 + j, clip=unit(1, 0.01 * j, 0, 0)) for j in range(6)] for i in range(3)]
    forest = [[make_rec(100 + i * 10 + j, clip=unit(0.01 * j, 1, 0, 0)) for j in range(6)] for i in range(3)]
    segments = beach + forest
    clips = np.stack([r.clip for seg in segments for r in seg])
    labels = [m.label for m in sg.label_moments(segments, clips, (["beach", "forest"], vectors))]
    assert labels.count("beach") == 1 and labels.count("beach 2") == 1
    assert labels.count("forest") == 1 and labels.count("forest 2") == 1
    assert sum(label.startswith("Moment") for label in labels) == 2


def test_find_moments_records_each_photos_moment_key():
    recs = [make_rec(i, t=START + timedelta(seconds=10 * i)) for i in range(6)]
    recs += [make_rec(10 + i, t=START + timedelta(hours=2, seconds=10 * i)) for i in range(6)]
    moments = sg.find_moments(recs, vocab=None)
    assert [m.key for m in moments] == ["m1", "m2"]
    assert {r.id: r.moment_key for r in recs}[0] == "m1"
    assert {r.id: r.moment_key for r in recs}[10] == "m2"


def test_carry_custom_labels_follows_the_photos_not_the_key():
    recs_a = [make_rec(i) for i in (1, 2, 3, 5)]
    recs_b = [make_rec(i) for i in (9, 10)]
    moments = [Moment(1, recs_a, "Moment 1"), Moment(2, recs_b, "Moment 2")]
    sg.carry_custom_labels(moments, {"m1": {1, 2, 3, 4}}, {"m1": "Ceremony"})
    assert moments[0].label == "Ceremony" and moments[0].custom is True
    assert moments[1].label == "Moment 2" and moments[1].custom is False


def test_carry_custom_labels_needs_half_the_photos_in_common():
    moments = [Moment(1, [make_rec(i) for i in (1, 2, 8, 9)], "Moment 1")]
    sg.carry_custom_labels(moments, {"m1": {1, 2, 3, 4}}, {"m1": "Ceremony"})
    assert moments[0].label == "Moment 1"


def test_carry_custom_labels_gives_each_moment_one_name():
    moments = [Moment(1, [make_rec(i) for i in (1, 2, 3, 4)], "Moment 1")]
    sg.carry_custom_labels(
        moments,
        {"m1": {1, 2, 3, 4}, "m2": {3, 4}},
        {"m1": "Ceremony", "m2": "Toasts"},
    )
    assert moments[0].label == "Ceremony"
