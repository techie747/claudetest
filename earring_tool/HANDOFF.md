# Earring Pair Extraction Tool — Handoff

## What this is

A Python CLI pipeline that takes one photo of multiple earring pairs (on a
display board/mesh/hooks, or laid flat) and outputs individual product-ready
images: pairs cropped together, background replaced with white, subtle drop
shadow, square e-commerce canvas. **Every output pixel comes from the source
photo** — nothing is AI-generated or redrawn. It's crop + background-removal
+ compositing only.

Branch: `claude/earring-pair-extraction-tool-80q1ei`
All code lives in `earring_tool/` (repo also contains an unrelated
`blog-topic-webhook-app` Node project at the root — ignore it).

## Quick start

```bash
cd earring_tool
pip install -r requirements.txt   # first run downloads u2net.onnx (~176MB)
python3 pipeline.py input/board1.jpg --out output --yes
```

`input/board1.jpg` is the real reference test photo (an 8-pair copper/mixed-
metal earring board, gitignored — re-upload if missing). `--yes` skips the
interactive "confirm detected count" prompt.

Useful flags: `--single` (export each earring separately instead of
pair-together), `--canvas N` (square size, default 2000), `--keep-hook`,
`--padding F`. Full flag list in `pipeline.py`'s `argparse` block or
`README.md`.

## Pipeline architecture

```
pipeline.py          CLI orchestrator: wires the stages together per photo,
                      handles batch mode, prints progress, writes manifest.

detect.py             Step 1: find candidate earring pieces in the full photo.
segment.py             Step 2: precise per-piece background removal.
pair.py                 Step 3: match pieces into left/right pairs.
composite.py             Step 4: white bg + shadow + square canvas.
export.py                 Step 5: file naming + manifest.json.
config.py         Config dataclass — all the tunable thresholds/sizes live here.
```

### detect.py — the hard part, read this first

Real board photos (wood frame + patterned white mesh insert) broke the
naive approach badly. Key discoveries, in order:

1. **A whole-image rembg pass segments the entire wood frame** as "the
   subject" (it's more visually salient than each small earring). Replaced
   with: HSV **saturation thresholding** (`_saturation_mask`) — earrings are
   saturated copper/bronze, the mesh/wall background is near-neutral
   (low saturation) regardless of brightness. This is the core detection
   signal used everywhere in this file.

2. **The wood frame's grain texture still produces piece-sized false
   positives** even after that fix, because when a big saturated blob (the
   frame) gets watershed-split, wood grain naturally splits into
   earring-sized chunks. Fixed with `find_display_interior()`: detects the
   frame as a warm-hue wood-toned ring via contour hierarchy, takes its
   inner hole (the mesh panel) as a bounding box, and restricts all
   detection to inside it. **This is what guarantees the frame is never
   counted as a piece** — don't remove it if you touch this file.

3. **Two touching/overlapping earrings form one connected component.**
   Fixed with adaptive watershed splitting (`_split_blob`): a "typical
   single-piece area" is estimated from the photo's own moderately-sized
   components, used to space out distance-transform peaks so touching pairs
   split apart without over-fragmenting a normal piece's own surface
   texture. Complex holed shapes (e.g. swirl/hoop earrings) can still throw
   a spurious extra peak — there's an imbalanced-split fallback that reverts
   to the whole blob rather than exporting a fragment as a fake "piece".

4. **Full-resolution (24MP) watershed is unusably slow.** Detection now runs
   on a downscaled working copy (`_DETECT_MAX_DIM = 1400`px) and scales
   boxes back up. Morphology kernel sizes are computed relative to image
   diagonal (`_odd_kernel_size`), not fixed pixel counts — this matters if
   you ever change `_DETECT_MAX_DIM`, since a kernel tuned at one resolution
   silently over/under-merges at another.

5. Sliver/wire-hardware false positives and noisy fragments are filtered by
   aspect ratio and bbox-fill-fraction (`_valid_piece_geometry`).

### segment.py — per-piece matting + the hole-punch fix

`refine_piece()` runs rembg on a tight crop around each detected bbox
(`rembg_refine_mask`) for a cleaner alpha than the coarse detect mask, then
trims the hanging hook/wire (`trim_hook`) and feathers the edge
(`feather_alpha`).

**Known hard problem, now fixed, worth understanding if it regresses:**
rembg's per-crop matting frequently returns a **solid** alpha over a piece's
interior cutout (e.g. a swirl/hoop earring's donut hole) — it doesn't
recognize the hole as background at all, so the mesh backdrop shows through
as if it were part of the piece.

Two earlier fix attempts both regressed real pieces and were reverted:
- Pure color-similarity to sampled background stats: also matched the
  piece's own dark oxidized/patina patches, eating holes into solid pieces.
- Region-growing from eroded interior seeds: same failure mode, just harder
  to trigger.

**The fix that works** (`_punch_background_holes`): reuse `piece["mask"]`
— the coarse detect.py saturation mask, computed at the *downscaled working
resolution* — because it already has correct topological holes (it's a
proper enclosed ring for a hoop earring, not a bare threshold on noisy
full-res pixels that never fully closes). A **topological** hole (fully
enclosed by contour hierarchy) can't be confused with an ordinary open
light/dark patch on a solid piece, which is what makes this safe. If you
touch this again: test against both a solid disc (must NOT gain a fake
hole) and a hoop/swirl shape (must gain a real one) before trusting it.

### pair.py — matching, not exact

Hand-hammered artisan pieces vary piece-to-piece, so pairing scores on Hu
moments (shape), hue histogram (color), size ratio, and aspect ratio — not
pixel similarity. Greedy max-weight matching. Pairs below
`cfg.low_confidence_threshold` (0.45) are written to `needs_review.json`
instead of silently trusted.

### composite.py — white bg, shadow, square canvas

Crops with configurable padding, replaces background with pure white
(#FFFFFF), adds a soft offset-blurred drop shadow, centers the subject on a
square canvas at `fit_scale ≈ 0.62` of the canvas size (generous white
margin, per explicit user request — don't shrink this back toward
edge-to-edge without checking).

## Current known limitations / next steps

1. **No web UI / drag-and-drop manual review screen.** `needs_review.json`
   lists flagged pairs' bounding boxes; a human has to re-pair by hand and
   call `composite.composite_pair` directly. This was descoped early
   (see conversation history) — building a small upload → confirm-count →
   review-pairing → download web front end is the natural next feature if
   requested.
2. **No live vision-API integration.** Detection is 100% classical CV
   (`rembg` + OpenCV), not a Claude/GPT vision call — this was a deliberate
   choice (no API key available in the dev environment), but the original
   spec suggested combining a VLM call with segmentation for the initial
   count-and-locate pass. Worth reconsidering if accuracy on new photo
   styles proves inconsistent.
3. **Detection accuracy on the reference photo is good but not perfect**:
   16 candidate pieces detected vs. 14 true pieces on the last full run (one
   low-confidence pair flagged, one bottom-left cluster occasionally
   produces an extra small fragment). Classical CV has a real ceiling here;
   SAM (Segment Anything) was in the original spec as an alternative to
   rembg and might do meaningfully better on touching/overlapping pieces,
   at the cost of a multi-GB model download and slower inference.
4. **`--single` mode's left/right labeling** is by x-position only, not by
   any semantic "which is the left ear" reasoning.
5. **`auto_straighten` config flag is a no-op** — reserved for a future
   orientation-normalization pass; pieces currently export in their
   original photographed rotation.

## Testing

`make_test_image.py` generates a synthetic 14-piece test board (no real
photo needed) for a fast sanity check that the pipeline runs end-to-end.
It's useful for catching import/crash errors quickly, but it will NOT catch
the real-photo issues described above (mesh detection, hole-punching,
touching-piece splitting) — those only show up on an actual framed board
photo. Always validate against a real photo before considering a detection/
segmentation change done.

No automated test suite exists beyond that script — testing so far has been
manual, screenshot-driven iteration against `input/board1.jpg`. Adding
pytest coverage around `detect.py`'s geometry filters and `segment.py`'s
hole-punch topology check (using saved masks as fixtures) would be a
reasonable investment before further changes.

## Debug workflow

Most of the detection/segmentation debugging in this project followed the
same pattern — reproduce in a throwaway script, `cv2.imwrite` the
intermediate mask/alpha to `output/debug_*.png`, and view it. E.g.:

```python
import cv2, detect, segment
from config import Config
img = cv2.imread('input/board1.jpg')
pieces = detect.detect_pieces(img, Config())
mask = segment.rembg_refine_mask(img, pieces[N])   # N = index from a debug bbox overlay
cv2.imwrite('output/debug.png', mask[y0:y1, x0:x1])
```

A quick way to get a numbered bbox overlay for picking `N`:

```python
vis = img.copy()
for i, p in enumerate(pieces):
    x, y, w, h = p['bbox']
    cv2.rectangle(vis, (x, y), (x+w, y+h), (0, 255, 0), 8)
    cv2.putText(vis, str(i), (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 3, (0,0,255), 6)
cv2.imwrite('output/debug_boxes.jpg', vis)
```
