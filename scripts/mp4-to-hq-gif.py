#!/usr/bin/env python3
"""High-quality MP4 → GIF for README (adaptive palette + Lanczos resize)."""

import sys
from pathlib import Path

import cv2
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def extract_frames(
    src: Path, width: int, fps: int, max_seconds: float | None = None
) -> list[Image.Image]:
    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        raise RuntimeError(f"cannot open {src}")

    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    step = max(1, int(round(src_fps / fps)))
    max_frames = int(max_seconds * fps) if max_seconds and max_seconds > 0 else None
    frames: list[Image.Image] = []
    idx = 0

    while max_frames is None or len(frames) < max_frames:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % step == 0:
            h, w = frame.shape[:2]
            nh = max(1, int(h * (width / w)))
            resized = cv2.resize(frame, (width, nh), interpolation=cv2.INTER_LANCZOS4)
            rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
            frames.append(Image.fromarray(rgb))
        idx += 1

    cap.release()
    if not frames:
        raise RuntimeError(f"no frames extracted from {src}")
    return frames


def build_palette_source(frames: list[Image.Image], sample_count: int = 12) -> Image.Image:
    w, h = frames[0].size
    picks = frames[:: max(1, len(frames) // sample_count)][:sample_count]
    sheet = Image.new("RGB", (w, h * len(picks)))
    for i, frame in enumerate(picks):
        sheet.paste(frame, (0, i * h))
    return sheet


def save_hq_gif(frames: list[Image.Image], out_path: Path, fps: int) -> None:
    palette_ref = build_palette_source(frames).quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    quantized = [
        frame.quantize(palette=palette_ref, dither=Image.Dither.FLOYDSTEINBERG)
        for frame in frames
    ]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    quantized[0].save(
        out_path,
        save_all=True,
        append_images=quantized[1:],
        duration=int(1000 / fps),
        loop=0,
        optimize=True,
        disposal=2,
    )


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: mp4-to-hq-gif.py <video.mp4> [output.gif] [width] [fps] [max_seconds]")
        return 1

    src = Path(sys.argv[1])
    if not src.is_absolute():
        src = ROOT / src

    out = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(".gif")
    if not out.is_absolute():
        out = ROOT / out

    width = int(sys.argv[3]) if len(sys.argv) > 3 else 480
    fps = int(sys.argv[4]) if len(sys.argv) > 4 else 10
    max_seconds = float(sys.argv[5]) if len(sys.argv) > 5 else 21
    if max_seconds <= 0:
        max_seconds = None

    frames = extract_frames(src, width=width, fps=fps, max_seconds=max_seconds)
    save_hq_gif(frames, out, fps=fps)
    size_mb = out.stat().st_size / (1024 * 1024)
    print(f"wrote {out}: {len(frames)} frames @ {width}px {fps}fps, {size_mb:.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
