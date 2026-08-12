#!/usr/bin/env python3
"""Earring pair extraction & e-commerce photo tool.

Usage:
    python3 pipeline.py photo1.jpg [photo2.jpg ...] [--out output] [--keep-hook]
                         [--single] [--canvas 2000] [--yes]

Pipeline: detect pieces -> confirm count -> segment/refine masks -> pair
matching (flag low-confidence) -> composite on white with shadow -> export
with manifest.
"""

import argparse
import os
import sys
import json
import cv2

from config import Config
import detect
import segment
import pair as pairing
import composite
import export as exp


def process_image(path, cfg, args, manifest_rows, review_rows):
    name = os.path.basename(path)
    print(f"\n=== {name} ===")
    image_bgr = cv2.imread(path)
    if image_bgr is None:
        print(f"  ! could not read image, skipping")
        return

    print("  Detecting pieces...")
    raw_pieces = detect.detect_pieces(image_bgr, cfg)
    print(f"  Found {len(raw_pieces)} candidate piece(s)"
          f" -> {len(raw_pieces)//2} pair(s)"
          + (" + 1 unpaired" if len(raw_pieces) % 2 else ""))

    if not args.yes:
        resp = input("  Confirm this count? [Y/n/skip] ").strip().lower()
        if resp == "skip":
            print("  Skipped by user.")
            return
        if resp == "n":
            print("  Adjust cfg.min_piece_area_frac / max_piece_area_frac in config.py and re-run.")
            return

    print("  Refining masks (hook trim + edge feather)...")
    pieces = []
    for p in raw_pieces:
        r = segment.refine_piece(image_bgr, p, cfg)
        if r is not None:
            pieces.append(r)

    print("  Computing descriptors and matching pairs...")
    descriptors = [pairing.piece_descriptor(image_bgr, p) for p in pieces]
    pairs, flagged, unpaired = pairing.match_pairs(descriptors, cfg.low_confidence_threshold)

    out_dir = args.out
    os.makedirs(out_dir, exist_ok=True)

    idx = 1
    for pr in pairs:
        a, b = pieces[pr["i"]], pieces[pr["j"]]
        status = "OK" if pr["confident"] else "LOW CONFIDENCE - flagged for review"
        print(f"  Pair {idx}: score={pr['score']:.2f} [{status}]")

        if not pr["confident"]:
            review_rows.append(exp.export_flagged(out_dir, name, idx, {
                "bbox_i": descriptors[pr["i"]]["bbox"],
                "bbox_j": descriptors[pr["j"]]["bbox"],
                "score": pr["score"],
            }))

        if args.single:
            img_a = composite.composite_piece(image_bgr, a, cfg)
            img_b = composite.composite_piece(image_bgr, b, cfg)
            exp.export_single(out_dir, name, idx, "left", img_a, a, manifest_rows)
            exp.export_single(out_dir, name, idx, "right", img_b, b, manifest_rows)
        else:
            img_pair = composite.composite_pair(image_bgr, a, b, cfg)
            exp.export_pair(out_dir, name, idx, img_pair, a, b, "pair_together", manifest_rows)
        idx += 1

    for k in unpaired:
        piece = pieces[k]
        print(f"  Unpaired piece at index {k} (odd count) -> exporting as single")
        img = composite.composite_piece(image_bgr, piece, cfg)
        exp.export_single(out_dir, name, idx, "single", img, piece, manifest_rows)
        idx += 1


def main():
    ap = argparse.ArgumentParser(description="Earring pair extraction & e-commerce photo tool")
    ap.add_argument("images", nargs="+", help="Source photo(s), supports batch mode")
    ap.add_argument("--out", default="output", help="Output directory")
    ap.add_argument("--keep-hook", action="store_true", help="Keep hanging hook/wire in crop")
    ap.add_argument("--single", action="store_true", help="Export each earring separately instead of pair-together")
    ap.add_argument("--canvas", type=int, default=2000, help="Square canvas size in px")
    ap.add_argument("--padding", type=float, default=0.10, help="Padding fraction around crop")
    ap.add_argument("--auto-straighten", action="store_true", help="Auto-rotate pieces upright")
    ap.add_argument("--yes", action="store_true", help="Skip interactive count confirmation")
    args = ap.parse_args()

    cfg = Config()
    cfg.keep_hook = args.keep_hook
    cfg.canvas_size = args.canvas
    cfg.padding_frac = args.padding
    cfg.auto_straighten = args.auto_straighten
    cfg.pair_together = not args.single

    os.makedirs(args.out, exist_ok=True)

    manifest_rows = []
    review_rows = []
    for path in args.images:
        process_image(path, cfg, args, manifest_rows, review_rows)

    manifest_path = exp.write_manifest(args.out, cfg.manifest_name, manifest_rows)
    print(f"\nManifest written: {manifest_path} ({len(manifest_rows)} entries)")

    if review_rows:
        review_path = os.path.join(args.out, "needs_review.json")
        with open(review_path, "w") as f:
            json.dump(review_rows, f, indent=2)
        print(f"! {len(review_rows)} pairing(s) flagged for manual review -> {review_path}")
        print("  Fix pairings by re-running with adjusted crops, or manually pair the")
        print("  candidate bboxes listed there and re-composite.")


if __name__ == "__main__":
    sys.exit(main())
