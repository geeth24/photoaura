"""Turn a list of photos into a short music-video MP4 (a "reel").

Pure Python + Pillow + ffmpeg. Each photo becomes a shot: Pillow builds a plate
(a crop of the photo, or the photo over a blurred copy of itself), the camera
path is planned so every face stays inside the frame, and ffmpeg does the
zoom/pan and crossfades one shot at a time, streaming raw frames into a single
encoder that adds the fades and audio. Only two plates are ever open at once,
so memory stays flat however many photos the reel has.
"""

from __future__ import annotations

import itertools
import json
import math
import os
import shutil
import subprocess
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from typing import Callable, List, Optional, Sequence, Tuple

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

ASPECTS = {"9:16": (1080, 1920), "16:9": (1920, 1080)}
FPS = 30
MIN_TARGET, MAX_TARGET, DEFAULT_TARGET = 15.0, 30.0, 20.0
MIN_SHOT, MAX_SHOT = 1.2, 3.0
XFADE = 0.4
FADE_IO = 0.5
ZOOM = 1.08
BLUR_ZOOM = 1.06
PAN_FRAC = 0.28
SUPERSAMPLE = 2
MIN_FACE_FRAC = 0.03
MUSIC_FADE_IN, MUSIC_FADE_OUT = 1.0, 1.5
RENDER_TIMEOUT = 900
# each worker holds a decoded 24 MP photo (~300 MB); the API pod has 1.5 GB
PLATE_WORKERS = 1

Box = Tuple[float, float, float, float]
Rect = Tuple[float, float, float, float]  # x, y, w, h


class ReelError(Exception):
    pass


@dataclass
class ReelItem:
    path: str
    width: int
    height: int
    faces: List[Box] = field(default_factory=list)
    duration: Optional[float] = None


@dataclass
class ReelShot:
    index: int
    start: float
    duration: float
    layout: str  # "crop" or "blur"
    # all geometry below is in the shot's own space: photo pixels for "crop",
    # the composed canvas for "blur" (that is where the faces were mapped to)
    space: Tuple[int, int]
    rect0: Rect
    rect1: Rect
    faces: List[Box]
    focus: Optional[Box]
    zoom_in: bool

    def rect_at(self, t: float) -> Rect:
        u = min(max(t / self.duration, 0.0), 1.0) if self.duration else 0.0
        return tuple(a + (b - a) * u for a, b in zip(self.rect0, self.rect1))  # type: ignore


@dataclass
class ReelResult:
    path: str
    width: int
    height: int
    duration: float
    fps: int
    aspect: str
    shots: List[ReelShot]
    dropped: int = 0
    poster_time: float = 1.0


# ---------- framing ----------


def _usable_faces(item: ReelItem) -> List[Box]:
    out = []
    for f in item.faces or []:
        x1, y1, x2, y2 = (float(v) for v in f)
        if x2 <= x1 or y2 <= y1:
            continue
        if (y2 - y1) < MIN_FACE_FRAC * item.height:
            continue
        out.append((x1, y1, x2, y2))
    return out


def focus_box(faces: Sequence[Box], sw: float, sh: float) -> Optional[Box]:
    """All faces plus room for hair and shoulders, clamped to the image."""
    if not faces:
        return None
    x0 = min(f[0] - 0.35 * (f[2] - f[0]) for f in faces)
    x1 = max(f[2] + 0.35 * (f[2] - f[0]) for f in faces)
    y0 = min(f[1] - 0.5 * (f[3] - f[1]) for f in faces)
    y1 = max(f[3] + 0.35 * (f[3] - f[1]) for f in faces)
    return (max(0.0, x0), max(0.0, y0), min(float(sw), x1), min(float(sh), y1))


def saliency_center(im: Image.Image) -> Tuple[float, float]:
    """Gradient-energy centroid in 0..1, pulled toward the middle."""
    small = im.convert("L")
    small.thumbnail((192, 192))
    edges = small.filter(ImageFilter.FIND_EDGES)
    grid = edges.resize((16, 16), Image.BOX)
    px = list(grid.getdata())
    peak = max(px) or 1
    wx = wy = tot = 0.0
    for i, v in enumerate(px):
        w = max(0.0, v - 0.25 * peak)
        wx += w * ((i % 16) + 0.5) / 16
        wy += w * ((i // 16) + 0.5) / 16
        tot += w
    if tot <= 0:
        return 0.5, 0.5
    return 0.7 * wx / tot + 0.3 * 0.5, 0.7 * wy / tot + 0.3 * 0.5


def base_window(sw: float, sh: float, aspect: float) -> Tuple[float, float]:
    """Largest window of the target aspect that fits in the space."""
    if sw / sh > aspect:
        return sh * aspect, float(sh)
    return float(sw), sw / aspect


def plan_window(
    sw: float,
    sh: float,
    aspect: float,
    focus: Optional[Box],
    anchor: Tuple[float, float],
    idx: int,
    zoom_target: float = ZOOM,
) -> Tuple[Rect, Rect, bool]:
    """Camera start/end windows. Both contain `focus` and sit inside the space.
    Containment is linear in the window, so it holds for every frame between."""
    bw, bh = base_window(sw, sh, aspect)
    z = zoom_target
    if focus:
        fw, fh = focus[2] - focus[0], focus[3] - focus[1]
        if fw > 0:
            z = min(z, bw / fw)
        if fh > 0:
            z = min(z, bh / fh)
    z = max(z, 1.0)
    if focus:
        fx0, fy0, fx1, fy1 = focus
        cx, cy, vbias = (fx0 + fx1) / 2, (fy0 + fy1) / 2, 0.42
    else:
        cx, cy, vbias = anchor[0] * sw, anchor[1] * sh, 0.5
        fx0 = fx1 = cx
        fy0 = fy1 = cy

    def place(w: float, h: float, ox: float, oy: float) -> Rect:
        lo_x, hi_x = max(0.0, fx1 - w), min(sw - w, fx0)
        lo_y, hi_y = max(0.0, fy1 - h), min(sh - h, fy0)
        if lo_x > hi_x:
            lo_x = hi_x = min(max(cx - w / 2, 0.0), sw - w)
        if lo_y > hi_y:
            lo_y = hi_y = min(max(cy - h * vbias, 0.0), sh - h)
        x = min(max(cx - w / 2 + ox, lo_x), hi_x)
        y = min(max(cy - h * vbias + oy, lo_y), hi_y)
        return (x, y, w, h)

    slack_x, slack_y = sw - bw, sh - bh
    pan_x = slack_x / bw >= slack_y / bh
    slack = slack_x if pan_x else slack_y
    travel = min(PAN_FRAC * (bw if pan_x else bh), max(slack, 0.0))
    if slack / (bw if pan_x else bh) < 0.02:
        travel = 0.0
    zoom_in = idx % 2 == 0
    d = 1.0 if zoom_in else -1.0
    big, small = (bw, bh), (bw / z, bh / z)
    (w0, h0), (w1, h1) = (big, small) if zoom_in else (small, big)
    o0, o1 = -d * travel / 2, d * travel / 2
    r0 = place(w0, h0, o0 if pan_x else 0.0, 0.0 if pan_x else o0)
    r1 = place(w1, h1, o1 if pan_x else 0.0, 0.0 if pan_x else o1)
    return r0, r1, zoom_in


def choose_layout(item: ReelItem, aspect: float) -> str:
    bw, bh = base_window(item.width, item.height, aspect)
    faces = _usable_faces(item)
    if faces:
        fb = focus_box(faces, item.width, item.height)
        assert fb is not None
        fits = (fb[2] - fb[0]) <= bw * 0.98 and (fb[3] - fb[1]) <= bh * 0.98
        return "crop" if fits else "blur"
    return "crop" if min(bw / item.width, bh / item.height) >= 0.5 else "blur"


# ---------- pacing ----------


def allocate_durations(
    requested: Sequence[Optional[float]], target: float
) -> List[float]:
    n = len(requested)
    if n == 1:
        r = requested[0]
        return [min(max(r if r else target, MIN_SHOT), MAX_SHOT * 2)]
    fixed = [min(max(r, MIN_SHOT), 6.0) if r else None for r in requested]
    free = [i for i, r in enumerate(fixed) if r is None]
    budget = target + (n - 1) * XFADE - sum(r for r in fixed if r)
    if free:
        per = min(max(budget / len(free), MIN_SHOT), MAX_SHOT)
        return [per if r is None else r for r in fixed]
    return [r for r in fixed if r is not None]


def total_length(durs: Sequence[float]) -> float:
    return sum(durs) - XFADE * (len(durs) - 1)


# ---------- plates ----------


def _open_oriented(path: str, want: Optional[Tuple[float, float]] = None) -> Image.Image:
    im = Image.open(path)
    if want and im.format == "JPEG":
        swap = im.getexif().get(0x0112, 1) in (5, 6, 7, 8)
        w, h = (want[1], want[0]) if swap else want
        im.draft("RGB", (max(1, int(w)), max(1, int(h))))
    return ImageOps.exif_transpose(im).convert("RGB")


def oriented_size(path: str) -> Tuple[int, int]:
    with Image.open(path) as im:
        w, h = im.size
        if im.getexif().get(0x0112, 1) in (5, 6, 7, 8):
            w, h = h, w
    return w, h


def _blur_canvas(
    im: Image.Image, cw: int, ch: int
) -> Tuple[Image.Image, Tuple[int, int, int, int]]:
    scale = min(cw / im.width, ch / im.height)
    fw, fh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    thumb = im.copy()
    thumb.thumbnail((640, 640))
    bg = ImageOps.fit(thumb, (max(8, cw // 10), max(8, ch // 10)), Image.BILINEAR)
    bg = bg.filter(ImageFilter.GaussianBlur(5))
    bg = ImageEnhance.Brightness(bg).enhance(0.55)
    canvas = bg.resize((cw, ch), Image.BICUBIC)
    ox, oy = (cw - fw) // 2, (ch - fh) // 2
    canvas.paste(im.resize((fw, fh), Image.LANCZOS), (ox, oy))
    return canvas, (ox, oy, fw, fh)


@dataclass
class _Plate:
    path: str
    # photo/canvas space -> plate pixels: (p - origin) * scale
    ox: float
    oy: float
    scale: float
    size: Tuple[int, int]
    shot: ReelShot


def _even(v: float) -> int:
    return max(2, int(round(v / 2.0)) * 2)


def _build_plate(
    item: ReelItem, idx: int, start: float, dur: float, aspect_key: str, tmpdir: str
) -> _Plate:
    """The image the camera moves over. It has the output aspect so one zoompan
    pass renders it undistorted (padding sits outside every window), and its
    smallest window is 2x output width so zoompan's whole-pixel positions stay
    under a quarter output pixel."""
    ow, oh = ASPECTS[aspect_key]
    aspect = ow / oh
    faces = _usable_faces(item)
    layout = choose_layout(item, aspect)
    path = os.path.join(tmpdir, f"plate{idx}.jpg")
    ss_w, ss_h = ow * SUPERSAMPLE, oh * SUPERSAMPLE

    if layout == "blur":
        fit = min(ss_w / item.width, ss_h / item.height)
        im = _open_oriented(item.path, (item.width * fit, item.height * fit))
        canvas, (fx, fy, fw, fh) = _blur_canvas(im, ss_w, ss_h)
        kx, ky = fw / item.width, fh / item.height
        cfaces = [
            (fx + a * kx, fy + b * ky, fx + c * kx, fy + d * ky) for a, b, c, d in faces
        ]
        focus = focus_box(cfaces, ss_w, ss_h)
        r0, r1, zin = plan_window(
            ss_w, ss_h, aspect, focus, (0.5, 0.5), idx,
            ZOOM if faces else BLUR_ZOOM,
        )
        canvas.save(path, "JPEG", quality=93)
        shot = ReelShot(idx, start, dur, "blur", (ss_w, ss_h), r0, r1, cfaces, focus, zin)
        return _Plate(path, 0.0, 0.0, 1.0, (ss_w, ss_h), shot)

    focus = focus_box(faces, item.width, item.height)
    bw, _ = base_window(item.width, item.height, aspect)
    # load just enough pixels to supersample the smallest window
    guess = min(1.0, ss_w / (bw / ZOOM))
    im = _open_oriented(item.path, (item.width * guess, item.height * guess))
    anchor = (0.5, 0.5) if faces else saliency_center(im)
    r0, r1, zin = plan_window(item.width, item.height, aspect, focus, anchor, idx)
    shot = ReelShot(
        idx, start, dur, "crop", (item.width, item.height), r0, r1, faces, focus, zin
    )
    bx0 = max(0.0, min(r0[0], r1[0]) - 2)
    by0 = max(0.0, min(r0[1], r1[1]) - 2)
    bx1 = min(float(item.width), max(r0[0] + r0[2], r1[0] + r1[2]) + 2)
    by1 = min(float(item.height), max(r0[1] + r0[3], r1[1] + r1[3]) + 2)
    w_min = min(r0[2], r1[2])
    rx, ry = im.width / item.width, im.height / item.height
    ps = ss_w / w_min

    # smallest output-aspect rectangle around the swept area
    sw_, sh_ = bx1 - bx0, by1 - by0
    pw_photo = sw_ if sw_ / sh_ > aspect else sh_ * aspect
    pw = _even(pw_photo * ps)
    ph = _even(pw / aspect)
    ox = (bx0 + bx1) / 2 - pw / ps / 2
    oy = (by0 + by1) / 2 - ph / ps / 2
    ix0, iy0 = max(ox, 0.0), max(oy, 0.0)
    ix1, iy1 = min(ox + pw / ps, float(item.width)), min(oy + ph / ps, float(item.height))
    plate = Image.new("RGB", (pw, ph), (0, 0, 0))
    part = im.resize(
        (max(2, round((ix1 - ix0) * ps)), max(2, round((iy1 - iy0) * ps))),
        Image.LANCZOS,
        box=(ix0 * rx, iy0 * ry, ix1 * rx, iy1 * ry),
    )
    plate.paste(part, (round((ix0 - ox) * ps), round((iy0 - oy) * ps)))
    plate.save(path, "JPEG", quality=93)
    return _Plate(path, ox, oy, ps, (pw, ph), shot)


# ---------- ffmpeg ----------


def probe(path: str) -> dict:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_streams",
         "-show_format", path],
        capture_output=True, timeout=60,
    )
    if r.returncode != 0:
        raise ReelError(f"unreadable media: {r.stderr.decode(errors='replace')[-200:]}")
    return json.loads(r.stdout or b"{}")


def audio_duration(path: str) -> float:
    info = probe(path)
    if not any(s.get("codec_type") == "audio" for s in info.get("streams", [])):
        raise ReelError("music file has no audio stream")
    return float(info.get("format", {}).get("duration") or 0)


def _fmt(v: float) -> str:
    return f"{v:.5f}".rstrip("0").rstrip(".") or "0"


def _frames(seconds: float) -> int:
    return max(1, int(round(seconds * FPS)))


def _prep(k: int) -> str:
    return (
        f"[{k}:v]scale=in_range=full:out_range=limited:"
        f"in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p"
    )


def _zoompan(p: _Plate, ow: int, oh: int, first: int, count: int) -> str:
    """Frames [first, first + count) of the plate's camera move."""
    s = p.shot
    nf = _frames(s.duration)
    wp0, wp1 = s.rect0[2] * p.scale, s.rect1[2] * p.scale
    x0, x1 = (s.rect0[0] - p.ox) * p.scale, (s.rect1[0] - p.ox) * p.scale
    y0, y1 = (s.rect0[1] - p.oy) * p.scale, (s.rect1[1] - p.oy) * p.scale
    u = f"min((on+{first})/{nf},1)"
    z = f"{p.size[0]}/({_fmt(wp0)}+({_fmt(wp1 - wp0)})*{u})"
    x = f"{_fmt(x0)}+({_fmt(x1 - x0)})*{u}"
    y = f"{_fmt(y0)}+({_fmt(y1 - y0)})*{u}"
    return f"zoompan=z='{z}':x='{x}':y='{y}':d={count}:s={ow}x{oh}:fps={FPS},setsar=1"


def piece_graph(
    plates: Sequence[_Plate], k: int, ow: int, oh: int
) -> Tuple[str, List[str], int]:
    """Shot k minus the frames shared with its neighbors, then the crossfade
    into shot k + 1. Returns the graph, the plates it reads and its frame count.
    Played back to back, the pieces make the whole reel."""
    xf = _frames(XFADE)
    n = len(plates)
    nf = _frames(plates[k].shot.duration)
    first = xf if k > 0 else 0
    last = nf - xf if k < n - 1 else nf
    if last - first < 1:
        raise ReelError(f"shot {k + 1} is shorter than its crossfades")
    if k == n - 1:
        graph = f"{_prep(0)},{_zoompan(plates[k], ow, oh, first, last - first)}[v]"
        return graph, [plates[k].path], last - first
    lines = [
        f"{_prep(0)},split[pa][pb]",
        f"[pa]{_zoompan(plates[k], ow, oh, first, last - first)}[body]",
        f"[pb]{_zoompan(plates[k], ow, oh, nf - xf, xf)}[tail]",
        f"{_prep(1)},{_zoompan(plates[k + 1], ow, oh, 0, xf)}[head]",
        f"[tail][head]xfade=transition=fade:duration={_fmt(xf / FPS)}:offset=0[cross]",
        "[body][cross]concat=n=2:v=1:a=0[v]",
    ]
    return ";".join(lines), [plates[k].path, plates[k + 1].path], last - first + xf


def _audio_graph(
    music_idx: int, music_len: float, total: float
) -> Tuple[List[str], int]:
    """Filter lines for the audio bed, and how many copies of the file it reads."""
    fmt = "aformat=sample_rates=44100:channel_layouts=stereo"
    copies = 1
    lines: List[str] = []
    if music_len >= total + 0.05:
        lines.append(f"[{music_idx}:a]{fmt}[abed]")
    else:
        cf = min(2.0, music_len / 3.0)
        step = music_len - cf
        copies = int(math.ceil((total - music_len) / step)) + 1
        for i in range(copies):
            lines.append(f"[{music_idx + i}:a]{fmt}[am{i}]")
        prev = "am0"
        for i in range(1, copies):
            out = "abed" if i == copies - 1 else f"ax{i}"
            lines.append(f"[{prev}][am{i}]acrossfade=d={_fmt(cf)}:c1=tri:c2=tri[{out}]")
            prev = out
    lines.append(
        f"[abed]atrim=0:{_fmt(total)},asetpts=PTS-STARTPTS,"
        f"afade=t=in:st=0:d={MUSIC_FADE_IN},"
        f"afade=t=out:st={_fmt(total - MUSIC_FADE_OUT)}:d={MUSIC_FADE_OUT}[aout]"
    )
    return lines, copies


def encoder_graph(total: float, music: Optional[float]) -> Tuple[str, int]:
    """Fades on the streamed frames (input 0) plus the music bed (inputs 1..)."""
    lines = [
        f"[0:v]fade=t=in:st=0:d={FADE_IO},"
        f"fade=t=out:st={_fmt(total - FADE_IO)}:d={FADE_IO},format=yuv420p[vout]"
    ]
    copies = 0
    if music is not None:
        a_lines, copies = _audio_graph(1, music, total)
        lines.extend(a_lines)
    return ";\n".join(lines), copies


def _niced(cmd: List[str]) -> List[str]:
    # keep the API responsive while the pod's cores are busy encoding
    return ["nice", "-n", "10"] + cmd if shutil.which("nice") else cmd


def _tail(path: str) -> str:
    try:
        with open(path, "rb") as fh:
            return fh.read()[-800:].decode(errors="replace")
    except OSError:
        return ""


def _stream_pieces(
    pieces: Sequence[Tuple[str, List[str], int]],
    encoder: List[str],
    ow: int,
    oh: int,
    threads: int,
    tmpdir: str,
    progress: Callable[[float], None],
    timeout: int,
) -> None:
    """Render the pieces one at a time and pipe their raw frames into the encoder."""
    frame_bytes = ow * oh * 3 // 2
    total_frames = sum(p[2] for p in pieces)
    live: List[subprocess.Popen] = []
    timed_out = threading.Event()

    def kill_all() -> None:
        timed_out.set()
        for proc in list(live):
            proc.kill()

    timer = threading.Timer(timeout, kill_all)
    enc_err = os.path.join(tmpdir, "encoder.err")
    piece_err = os.path.join(tmpdir, "piece.err")
    with open(enc_err, "wb") as eerr:
        enc = subprocess.Popen(
            _niced(encoder), stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=eerr
        )
        live.append(enc)
        timer.start()
        written = 0
        try:
            for i, (graph, inputs, count) in enumerate(pieces):
                cmd = ["ffmpeg", "-nostdin", "-v", "error",
                       "-filter_threads", str(threads)]
                for path in inputs:
                    cmd += ["-framerate", str(FPS), "-i", path]
                cmd += ["-filter_complex", graph, "-map", "[v]", "-frames:v", str(count),
                        "-f", "rawvideo", "-pix_fmt", "yuv420p", "pipe:1"]
                with open(piece_err, "wb") as perr:
                    proc = subprocess.Popen(
                        _niced(cmd), stdout=subprocess.PIPE, stderr=perr,
                        stdin=subprocess.DEVNULL,
                    )
                    live.append(proc)
                    got = 0
                    try:
                        assert proc.stdout is not None and enc.stdin is not None
                        while True:
                            chunk = proc.stdout.read(frame_bytes)
                            if not chunk:
                                break
                            enc.stdin.write(chunk)
                            got += len(chunk)
                            progress((written + got / frame_bytes) / total_frames)
                        proc.wait()
                    finally:
                        live.remove(proc)
                if timed_out.is_set():
                    raise ReelError("render took too long")
                if proc.returncode != 0:
                    raise ReelError(f"shot {i + 1} failed: {_tail(piece_err)}")
                if got != count * frame_bytes:
                    raise ReelError(f"shot {i + 1} gave {got / frame_bytes:.1f} of {count} frames")
                written += count
            enc.stdin.close()
            enc.wait()
        except BrokenPipeError:
            enc.wait()
            raise ReelError(f"encoder failed ({enc.returncode}): {_tail(enc_err)}")
        except BaseException:
            enc.kill()
            enc.wait()
            raise
        finally:
            timer.cancel()
    if timed_out.is_set():
        raise ReelError("render took too long")
    if enc.returncode != 0:
        raise ReelError(f"encoder failed ({enc.returncode}): {_tail(enc_err)}")


def extract_poster(video_path: str, out_path: str, at: float = 1.0) -> None:
    r = subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-ss", _fmt(at), "-i", video_path,
         "-frames:v", "1", "-q:v", "3", out_path],
        capture_output=True, timeout=120,
    )
    if r.returncode != 0 or not os.path.exists(out_path):
        raise ReelError("poster extract failed")


# ---------- public API ----------


def render_reel(
    items: Sequence[ReelItem],
    aspect: str,
    out_path: str,
    music_path: Optional[str] = None,
    target_length: float = DEFAULT_TARGET,
    progress: Optional[Callable[[str, float], None]] = None,
    threads: int = 2,
    preset: str = "veryfast",
    crf: int = 21,
) -> ReelResult:
    """Render `items` into a 1080x1920 (9:16) or 1920x1080 (16:9) H.264 MP4.

    Each item is a local image, its size in pixels (after EXIF rotation), optional
    face boxes in that pixel space and an optional shot length. The reel is as long
    as `target_length` allows given 1.2-3 s per shot; extra photos past 30 s are
    dropped and counted in `ReelResult.dropped`.
    """
    if aspect not in ASPECTS:
        raise ReelError(f"aspect must be one of {sorted(ASPECTS)}")
    if not items:
        raise ReelError("no photos to render")
    if not (MIN_TARGET <= target_length <= MAX_TARGET):
        raise ReelError(f"target length must be {MIN_TARGET:.0f}-{MAX_TARGET:.0f} seconds")
    ow, oh = ASPECTS[aspect]
    note = progress or (lambda phase, frac: None)

    items = list(items)
    dropped = 0
    durs = allocate_durations([i.duration for i in items], target_length)
    while len(items) > 1 and total_length(durs) > MAX_TARGET + 0.01:
        items.pop()
        durs.pop()
        dropped += 1

    # whole frames per shot, rounded on the running total so the reel lands on target
    quantized, done, elapsed = [], 0, 0.0
    for d in durs:
        elapsed += d
        f = int(round(elapsed * FPS))
        quantized.append((f - done) / FPS)
        done = f
    durs = quantized

    music_len = audio_duration(music_path) if music_path else 0.0
    if music_path and music_len < 3.0:
        raise ReelError("music must be at least 3 seconds long")

    tmpdir = tempfile.mkdtemp(prefix="reel-")
    try:
        starts = [0.0]
        for d in durs[:-1]:
            starts.append(starts[-1] + d - XFADE)
        finished = itertools.count(1)

        def prep(i: int) -> _Plate:
            try:
                plate = _build_plate(items[i], i, starts[i], durs[i], aspect, tmpdir)
            except Exception as e:
                raise ReelError(f"photo {i + 1} could not be read") from e
            note("preparing", next(finished) / len(items))
            return plate

        with ThreadPoolExecutor(max_workers=min(PLATE_WORKERS, len(items))) as pool:
            plates = list(pool.map(prep, range(len(items))))

        pieces = [piece_graph(plates, k, ow, oh) for k in range(len(plates))]
        total = sum(p[2] for p in pieces) / FPS
        graph, copies = encoder_graph(total, music_len if music_path else None)

        cmd = ["ffmpeg", "-y", "-nostdin", "-v", "error",
               "-f", "rawvideo", "-pix_fmt", "yuv420p", "-s", f"{ow}x{oh}",
               "-framerate", str(FPS), "-i", "pipe:0"]
        for _ in range(copies):
            cmd += ["-i", str(music_path)]
        cmd += ["-filter_complex", graph, "-map", "[vout]"]
        if music_path:
            cmd += ["-map", "[aout]", "-c:a", "aac", "-b:a", "160k"]
        cmd += [
            "-c:v", "libx264", "-threads", str(threads), "-preset", preset,
            "-crf", str(crf),
            "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p",
            "-r", str(FPS), "-g", str(FPS * 2),
            "-colorspace", "bt709", "-color_primaries", "bt709",
            "-color_trc", "bt709", "-color_range", "tv",
            "-t", _fmt(total), "-movflags", "+faststart", out_path,
        ]
        note("encoding", 0.0)
        _stream_pieces(
            pieces, cmd, ow, oh, threads, tmpdir,
            lambda f: note("encoding", min(1.0, f)), RENDER_TIMEOUT,
        )
        d0 = durs[0]
        return ReelResult(
            path=out_path, width=ow, height=oh, duration=total, fps=FPS,
            aspect=aspect, shots=[p.shot for p in plates], dropped=dropped,
            poster_time=max(FADE_IO, min(1.0, d0 - XFADE - 0.1)),
        )
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


__all__ = [
    "ASPECTS", "ReelError", "ReelItem", "ReelResult", "ReelShot", "audio_duration",
    "extract_poster", "oriented_size", "probe", "render_reel",
]
