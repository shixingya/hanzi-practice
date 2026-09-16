"""Merge PNG frames in assets/_frames into a single animated GIF at assets/demo.gif."""
from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
FRAMES_DIR = HERE / "assets" / "_frames"
OUT_GIF = HERE / "assets" / "demo.gif"
FRAME_MS = 180
TARGET_WIDTH = 360


def main() -> int:
    if not FRAMES_DIR.exists():
        print(f"Frame dir not found: {FRAMES_DIR}", file=sys.stderr)
        return 1
    files = sorted(FRAMES_DIR.glob("*.png"))
    if not files:
        print("No frames to merge", file=sys.stderr)
        return 1
    print(f"Merging {len(files)} frames -> {OUT_GIF}")

    imgs: list[Image.Image] = []
    for f in files:
        with open(f, "rb") as fh:
            im = Image.open(io.BytesIO(fh.read())).convert("RGB")
        w, h = im.size
        if w > TARGET_WIDTH:
            new_h = int(h * TARGET_WIDTH / w)
            im = im.resize((TARGET_WIDTH, new_h), Image.LANCZOS)
        imgs.append(im.convert("P", palette=Image.ADAPTIVE, colors=128))

    imgs[0].save(
        OUT_GIF,
        save_all=True,
        append_images=imgs[1:],
        duration=FRAME_MS,
        loop=0,
        optimize=True,
        disposal=2,
    )
    size_kb = OUT_GIF.stat().st_size / 1024
    print(f"Saved {OUT_GIF} ({size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
