# Earring Pair Extraction & E-Commerce Photo Tool

Turns one photo of multiple earring pairs (on a display board, hooks, or laid
flat) into clean, individually cropped, white-background product photos with
a subtle drop shadow, ready to upload to Shopify/Etsy.

## Install

```bash
cd earring_tool
pip install -r requirements.txt
```

First run downloads the `u2net` background-removal model (~176MB) via `rembg`.

## Usage

```bash
python3 pipeline.py photo1.jpg [photo2.jpg ...] --out output
```

Options:

- `--out DIR` output directory (default `output`)
- `--keep-hook` keep the hanging hook/wire in the crop (default: cropped out)
- `--single` export each earring as its own image instead of pairing them
  together in one shot (default: pair-together)
- `--canvas N` square canvas size in px (default 2000)
- `--padding F` padding fraction around the cropped subject (default 0.10)
- `--yes` skip the interactive "confirm detected count" prompt (batch mode)

Run on multiple photos in one call for batch processing:

```bash
python3 pipeline.py board1.jpg board2.jpg board3.jpg --out output --yes
```

## Pipeline

1. **Detect** (`detect.py`) — runs `rembg`/u2net on the full photo to get a
   foreground mask, cleans it up (morphology + area filtering), and finds
   connected components as individual earring pieces.
2. **Confirm** — prints the detected piece/pair count for the user to confirm
   before processing (skip with `--yes`).
3. **Segment/refine** (`segment.py`) — trims thin hook/wire protrusions from
   each piece's mask (unless `--keep-hook`), then feathers the alpha edge to
   avoid hard-cutout halos on reflective metal.
4. **Pair** (`pair.py`) — scores every piece pair on shape (Hu moments), hue
   histogram, size ratio, and aspect ratio, then greedily matches pairs by
   highest combined score. Pairs below `low_confidence_threshold` (default
   0.45) are written to `output/needs_review.json` instead of being silently
   trusted.
5. **Composite** (`composite.py`) — crops with configurable padding, places
   on a pure white canvas, adds a soft blurred offset drop shadow, and pads
   to a square e-commerce canvas (default 2000x2000).
6. **Export** (`export.py`) — writes `product-NN-pair.png` (or
   `product-NN-left/right.png` in `--single` mode) plus `manifest.json`
   mapping every output file back to its source photo and bounding boxes.

## Output

```
output/
  product-01-pair.png
  product-02-pair.png
  ...
  manifest.json        # file -> source photo + bbox mapping
  needs_review.json     # low-confidence pairings needing manual fix (if any)
```

## Config

Tunable defaults live in `config.py` (`Config` dataclass): detection area
thresholds, alpha matte erosion/feather, pairing confidence threshold,
canvas size, padding, shadow offset/blur/opacity, hook handling, and
auto-straighten toggle (currently a no-op flag reserved for a future
orientation-normalization pass — pieces are exported in their original
rotation by default).

## Notes / known limitations

- No live vision-API call is wired in for the initial count-and-locate
  pass — detection is done entirely with classical CV (`rembg` + connected
  components), which keeps the tool fully offline/API-key-free but may need
  `min_piece_area_frac` / `max_piece_area_frac` tuning per photo.
- There is no drag-and-drop manual review UI yet — `needs_review.json` lists
  flagged pairs' bounding boxes so a human can re-pair by hand and rerun a
  manual composite (`composite.composite_pair` can be called directly for
  this).
- `--single` mode does not currently draw left/right assignment from
  hanging-hook geometry; pieces are matched into a pair and then labeled by
  x-position only.
