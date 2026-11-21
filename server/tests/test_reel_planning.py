import pytest

from services import reel_renderer as rr
from services.reel_renderer import ReelError, ReelItem, ReelShot, _Plate


def shot(duration, idx=0, rect0=(0.0, 0.0, 100.0, 100.0), rect1=(0.0, 0.0, 100.0, 100.0)):
    return ReelShot(
        index=idx,
        start=0.0,
        duration=duration,
        layout="crop",
        space=(100, 100),
        rect0=rect0,
        rect1=rect1,
        faces=[],
        focus=None,
        zoom_in=True,
    )


def plate(duration, idx=0):
    return _Plate(
        path=f"plate{idx}.jpg",
        ox=0.0,
        oy=0.0,
        scale=1.0,
        size=(100, 100),
        shot=shot(duration, idx=idx),
    )


def approx_box(box, expected, tol=1e-6):
    assert len(box) == len(expected)
    for got, want in zip(box, expected):
        assert got == pytest.approx(want, abs=tol)


def test_focus_box_pads_faces_and_clamps_to_frame():
    assert rr.focus_box([], 200, 200) is None
    # a 40 px face gets 14 px of hair and shoulder room each side, clamped at 0
    approx_box(rr.focus_box([(10, 10, 50, 50)], 200, 200), (0.0, 0.0, 64.0, 64.0))
    approx_box(rr.focus_box([(180, 180, 195, 195)], 200, 200), (174.75, 172.5, 200.0, 200.0))


def test_base_window_fits_the_target_aspect_inside_the_space():
    approx_box(rr.base_window(1000, 1000, 9 / 16), (562.5, 1000.0))
    approx_box(rr.base_window(400, 1000, 1.0), (400.0, 400.0))


@pytest.mark.parametrize("idx", [0, 1, 2, 3])
def test_plan_window_keeps_every_face_in_both_windows(idx):
    sw, sh, aspect = 1080.0, 1920.0, 16 / 9
    focus = (400.0, 800.0, 680.0, 1000.0)
    r0, r1, _ = rr.plan_window(sw, sh, aspect, focus, (0.5, 0.5), idx)
    fx0, fy0, fx1, fy1 = focus
    for x, y, w, h in (r0, r1):
        assert x >= -1e-6 and y >= -1e-6
        assert x + w <= sw + 1e-6 and y + h <= sh + 1e-6
        assert x <= fx0 + 1e-6 and x + w >= fx1 - 1e-6
        assert y <= fy0 + 1e-6 and y + h >= fy1 - 1e-6
        assert w / h == pytest.approx(aspect, rel=1e-6)


def test_plan_window_zooms_in_on_even_shots_and_out_on_odd():
    focus = (100.0, 100.0, 200.0, 200.0)
    r0, r1, zoom_in = rr.plan_window(1000.0, 1000.0, 1.0, focus, (0.5, 0.5), idx=0)
    assert zoom_in is True and r0[2] > r1[2]
    r0, r1, zoom_in = rr.plan_window(1000.0, 1000.0, 1.0, focus, (0.5, 0.5), idx=1)
    assert zoom_in is False and r0[2] < r1[2]


def test_plan_window_without_faces_stays_inside_the_space():
    r0, r1, _ = rr.plan_window(1080.0, 1920.0, 9 / 16, None, (0.9, 0.1), idx=0)
    for x, y, w, h in (r0, r1):
        assert 0 <= x and x + w <= 1080.0 + 1e-6
        assert 0 <= y and y + h <= 1920.0 + 1e-6


def test_choose_layout_crops_when_faces_fit_and_blurs_when_they_do_not():
    small_face = ReelItem(path="a", width=1000, height=1000, faces=[(400, 400, 450, 450)])
    assert rr.choose_layout(small_face, 1.0) == "crop"
    huge_face = ReelItem(path="b", width=1000, height=1000, faces=[(50, 50, 950, 950)])
    assert rr.choose_layout(huge_face, 9 / 16) == "blur"


def test_choose_layout_without_faces_depends_on_how_much_is_kept():
    wide = ReelItem(path="c", width=1000, height=1000)
    assert rr.choose_layout(wide, 9 / 16) == "crop"
    tall = ReelItem(path="d", width=1000, height=1000)
    assert rr.choose_layout(tall, 0.25) == "blur"


def test_allocate_durations_splits_the_target_across_free_shots():
    durations = rr.allocate_durations([None, None], target=5.0)
    assert durations == pytest.approx([2.7, 2.7])
    assert rr.total_length(durations) == pytest.approx(5.0)
    assert rr.total_length(rr.allocate_durations([None] * 4, target=6.0)) == pytest.approx(6.0)


def test_allocate_durations_honors_fixed_lengths():
    assert rr.allocate_durations([2.0, None], target=10.0) == [2.0, rr.MAX_SHOT]
    assert rr.allocate_durations([1.0, 2.0], target=5.0) == [rr.MIN_SHOT, 2.0]
    assert rr.allocate_durations([0.1, None], target=2.0)[0] == rr.MIN_SHOT


def test_allocate_durations_single_shot_is_capped():
    assert rr.allocate_durations([None], target=20.0) == [6.0]


def test_total_length_subtracts_crossfades():
    assert rr.total_length([2.0, 2.0]) == pytest.approx(3.6)
    assert rr.total_length([2.0]) == pytest.approx(2.0)


def test_piece_graph_frame_counts_add_up_to_the_reel_length():
    plates = [plate(2.0, 0), plate(2.0, 1), plate(2.0, 2)]
    counts = []
    for k in range(len(plates)):
        _, reads, n = rr.piece_graph(plates, k, 1080, 1920)
        counts.append(n)
        assert reads[0] == plates[k].path
    assert counts == [60, 48, 48]
    assert sum(counts) == round(rr.total_length([2.0, 2.0, 2.0]) * rr.FPS)


def test_piece_graph_reads_the_next_plate_for_the_crossfade():
    plates = [plate(2.0, 0), plate(2.0, 1)]
    _, reads, _ = rr.piece_graph(plates, 0, 1080, 1920)
    assert reads == ["plate0.jpg", "plate1.jpg"]
    _, reads, _ = rr.piece_graph(plates, 1, 1080, 1920)
    assert reads == ["plate1.jpg"]


def test_piece_graph_rejects_a_shot_shorter_than_its_crossfades():
    plates = [plate(2.0, 0), plate(0.5, 1), plate(2.0, 2)]
    with pytest.raises(ReelError):
        rr.piece_graph(plates, 1, 1080, 1920)


def test_encoder_graph_adds_fades_and_counts_music_copies():
    graph, copies = rr.encoder_graph(total=30.0, music=None)
    assert "[vout]" in graph and copies == 0
    graph, copies = rr.encoder_graph(total=30.0, music=10.0)
    assert copies == 4
    assert "[aout]" in graph
    _, copies = rr.encoder_graph(total=30.0, music=40.0)
    assert copies == 1
