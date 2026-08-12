"""Step 1-2: whole-image background removal + connected-component detection.

Uses rembg (u2net) on the full photo to get a foreground alpha mask, cleans it
up morphologically, then finds connected components as individual earring
pieces. This generalizes better than raw contour/threshold detection on busy
mesh/wood backgrounds because rembg's saliency model already separates the
metal pieces from the backdrop before we look for blobs.
"""

import numpy as np
import cv2
from rembg import remove, new_session

_SESSION = None


def _session():
    global _SESSION
    if _SESSION is None:
        _SESSION = new_session("u2net")
    return _SESSION


def full_image_alpha(image_bgr):
    """Run rembg on the whole image, return the alpha channel (0-255, uint8)."""
    rgba = remove(image_bgr, session=_session())
    if rgba.shape[2] == 4:
        alpha = rgba[:, :, 3]
    else:
        gray = cv2.cvtColor(rgba, cv2.COLOR_BGR2GRAY)
        _, alpha = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY)
    return alpha


def clean_mask(alpha, min_area):
    """Threshold + morphological cleanup to remove speckle noise from mesh texture."""
    _, mask = cv2.threshold(alpha, 40, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Drop components smaller than min_area (mesh specks, hook glare, etc.)
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    cleaned = np.zeros_like(mask)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= min_area:
            cleaned[labels == i] = 255
    return cleaned


def detect_pieces(image_bgr, cfg):
    """Return list of dicts: {bbox:(x,y,w,h), mask (full-image uint8), area}."""
    h, w = image_bgr.shape[:2]
    img_area = h * w
    min_area = cfg.min_piece_area_frac * img_area
    max_area = cfg.max_piece_area_frac * img_area

    alpha = full_image_alpha(image_bgr)
    mask = clean_mask(alpha, min_area)

    n, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
    pieces = []
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < min_area or area > max_area:
            continue
        x, y, bw, bh = (
            stats[i, cv2.CC_STAT_LEFT],
            stats[i, cv2.CC_STAT_TOP],
            stats[i, cv2.CC_STAT_WIDTH],
            stats[i, cv2.CC_STAT_HEIGHT],
        )
        piece_mask = np.where(labels == i, 255, 0).astype(np.uint8)
        pieces.append({
            "bbox": (x, y, bw, bh),
            "mask": piece_mask,
            "area": int(area),
            "centroid": tuple(centroids[i]),
        })

    pieces.sort(key=lambda p: p["bbox"][0])
    return pieces
