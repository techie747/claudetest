"""Step 5: file naming, manifest generation, batch support."""

import os
import json


def piece_bbox_dict(piece):
    x, y, w, h = piece["bbox"]
    return {"x": x, "y": y, "w": w, "h": h}


def export_pair(out_dir, source_name, index, image_pair, piece_a, piece_b, mode, manifest_rows):
    entries = []
    if mode == "pair_together":
        fname = f"product-{index:02d}-pair.png"
        image_pair.save(os.path.join(out_dir, fname))
        entries.append({
            "file": fname,
            "type": "pair",
            "source_image": source_name,
            "pieces": [piece_bbox_dict(piece_a), piece_bbox_dict(piece_b)],
        })
    manifest_rows.extend(entries)
    return entries


def export_single(out_dir, source_name, index, side, image, piece, manifest_rows):
    fname = f"product-{index:02d}-{side}.png"
    image.save(os.path.join(out_dir, fname))
    manifest_rows.append({
        "file": fname,
        "type": "single",
        "side": side,
        "source_image": source_name,
        "bbox": piece_bbox_dict(piece),
    })
    return fname


def export_flagged(out_dir, source_name, index, flagged_entry):
    """Record a low-confidence pairing needing manual review (no file produced yet)."""
    return {
        "review_index": index,
        "source_image": source_name,
        "candidate_i_bbox": flagged_entry["bbox_i"],
        "candidate_j_bbox": flagged_entry["bbox_j"],
        "score": flagged_entry["score"],
        "status": "needs_review",
    }


def write_manifest(out_dir, manifest_name, rows):
    path = os.path.join(out_dir, manifest_name)
    existing = []
    if os.path.exists(path):
        with open(path) as f:
            try:
                existing = json.load(f)
            except json.JSONDecodeError:
                existing = []
    existing.extend(rows)
    with open(path, "w") as f:
        json.dump(existing, f, indent=2)
    return path
