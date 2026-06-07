#!/usr/bin/env python3
"""Convert README demo MP4s to compact GIFs for GitHub inline display."""

import sys
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
VIDEO_DIR = ROOT / "docs" / "assets" / "readme" / "videos"
OUT_DIR = ROOT / "docs" / "assets" / "readme" / "gifs"

CONFIG = {
    "style-library.mp4": {"max_seconds": 12, "width": 280, "fps": 6},
    "tryon-flow.mp4": {"max_seconds": 14, "width": 280, "fps": 6},
    "hot-rank.mp4": {"max_seconds": 12, "width": 280, "fps": 6},
    "merchant-style-library.mp4": {"max_seconds": 14, "width": 280, "fps": 6},
    "merchant-dashboard.mp4": {"start_seconds": 8, "max_seconds": 14, "width": 280, "fps": 6},
}


def write_gif(frames, out_path: Path, fps: int) -> None:
    try:
        import imageio.v3 as iio

        iio.imwrite(out_path, frames, duration=1 / fps, loop=0)
        return
    except Exception:
        pass

    try:
        from PIL import Image

        pil_frames = [Image.fromarray(f) for f in frames]
        pil_frames[0].save(
            out_path,
            save_all=True,
            append_images=pil_frames[1:],
            duration=int(1000 / fps),
            loop=0,
            optimize=True,
        )
        return
    except Exception as exc:
        raise RuntimeError(f"Need imageio or Pillow to write GIF: {exc}") from exc


def convert(name: str, cfg: dict) -> None:
    src = VIDEO_DIR / name
    if not src.exists():
        print(f"skip missing {src}")
        return

    cap = cv2.VideoCapture(str(src))
    if not cap.isOpened():
        print(f"failed to open {src}")
        return

    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    width = cfg["width"]
    start_seconds = cfg.get("start_seconds", 0)
    max_frames = int(cfg["max_seconds"] * cfg["fps"])
    step = max(1, int(round(src_fps / cfg["fps"])))

    if start_seconds > 0:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(start_seconds * src_fps))

    frames = []
    idx = 0
    while len(frames) < max_frames:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % step == 0:
            h, w = frame.shape[:2]
            nh = int(h * (width / w))
            resized = cv2.resize(frame, (width, nh), interpolation=cv2.INTER_AREA)
            frames.append(cv2.cvtColor(resized, cv2.COLOR_BGR2RGB))
        idx += 1
    cap.release()

    if not frames:
        print(f"no frames for {name}")
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / (Path(name).stem + ".gif")
    write_gif(frames, out_path, cfg["fps"])
    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"wrote {out_path.name}: {len(frames)} frames, {size_mb:.2f} MB")


def main() -> int:
    for name, cfg in CONFIG.items():
        convert(name, cfg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
