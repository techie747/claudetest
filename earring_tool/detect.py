"""Step 1: candidate earring detection via color-saliency, refined per-piece
via rembg (step 2, see segment.py).

A whole-image rembg/u2net pass tends to segment the *entire framed board* as
"the subject" against the house siding, not the individual earrings sitting
on a plain mesh backdrop inside it. Instead we find pieces by color contrast
against their local (mesh/wood) background: earrings are saturated metal
tones sitting on a low-saturation white/gray mesh panel, so an HSV
saturation threshold (with a frame-blob filter) isolates them reliably. Each
candidate box is then refined with a per-crop rembg pass in segment.py for a
precise alpha matte.
"""

import numpy as np
import cv2
from scipy import ndimage as ndi
from skimage.feature import peak_local_max
from skimage.segmentation import watershed


def _saturation_mask(image_bgr, sat_thresh=55):
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    s = hsv[:, :, 1]
    _, mask = cv2.threshold(s, sat_thresh, 255, cv2.THRESH_BINARY)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
    return mask


def _is_frame_blob(stats_row, img_w, img_h, frac_thresh=0.5):
    """A region spanning most of the image width or height is almost
    certainly the wood frame border, not an earring."""
    w, h = stats_row[cv2.CC_STAT_WIDTH], stats_row[cv2.CC_STAT_HEIGHT]
    return w > img_w * frac_thresh or h > img_h * frac_thresh


def find_display_interior(image_bgr):
    """If the photo shows earrings mounted inside a wooden frame around a
    mesh/lattice insert, find the mesh's inner bounding box so detection can
    ignore the frame's wood-grain texture entirely (it otherwise gets
    watershed-split into many piece-sized false positives). Detects the
    frame as a warm-hue wood-toned ring and takes its innermost hole via
    contour hierarchy. Returns (x, y, w, h) or None if no such frame/mesh
    structure is found (e.g. flat-lay or non-framed photos).
    """
    h, w = image_bgr.shape[:2]
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    H, S, V = cv2.split(hsv)
    wood = ((H > 5) & (H < 30) & (S > 25) & (S < 160) & (V > 60) & (V < 230)).astype(np.uint8) * 255
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))
    wood = cv2.morphologyEx(wood, cv2.MORPH_CLOSE, kernel, iterations=3)
    wood = cv2.morphologyEx(wood, cv2.MORPH_OPEN, kernel, iterations=1)

    contours, hierarchy = cv2.findContours(wood, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None:
        return None
    hierarchy = hierarchy[0]

    img_area = w * h
    outer_idx = None
    outer_area = 0
    for i, c in enumerate(contours):
        area = cv2.contourArea(c)
        # Frame ring should be a large fraction of the photo but not the
        # whole frame; require it to look roughly rectangular via extent.
        if area > img_area * 0.15 and area > outer_area:
            outer_area = area
            outer_idx = i
    if outer_idx is None:
        return None

    # Find the direct child hole of the outer ring (the mesh interior).
    best_child, best_area = None, 0
    for i in range(len(contours)):
        if hierarchy[i][3] == outer_idx:
            area = cv2.contourArea(contours[i])
            if area > best_area:
                best_area, best_child = area, i
    if best_child is None or best_area < img_area * 0.05:
        return None

    x, y, bw, bh = cv2.boundingRect(contours[best_child])
    return (x, y, bw, bh)


def _split_blob(submask, typical_area):
    """Watershed-split one connected-component submask on its distance
    transform, using `typical_area` (a single-piece area estimate) to space
    out peaks so we get roughly one per earring rather than noisy
    multi-peaks from surface texture."""
    dist = ndi.distance_transform_edt(submask > 0)
    dist = cv2.GaussianBlur(dist, (0, 0), sigmaX=max(3, int(np.sqrt(typical_area) * 0.08)))
    min_distance = max(15, int(np.sqrt(typical_area) * 0.5))
    threshold_abs = max(4.0, np.sqrt(typical_area) * 0.15)
    coords = peak_local_max(
        dist, min_distance=min_distance, threshold_abs=threshold_abs, labels=submask > 0
    )
    if len(coords) < 2:
        return None  # nothing to split
    markers = np.zeros(dist.shape, dtype=np.int32)
    for idx, (y, x) in enumerate(coords, start=1):
        markers[y, x] = idx
    markers = ndi.grey_dilation(markers, size=(5, 5))
    return watershed(-dist, markers, mask=submask > 0)


def _add_piece(pieces, region, w, h, min_area, max_area):
    area = int((region > 0).sum())
    if area < min_area * 0.5 or area > max_area:
        return
    ys, xs = np.where(region > 0)
    x, y = int(xs.min()), int(ys.min())
    bw, bh = int(xs.max() - x + 1), int(ys.max() - y + 1)
    if _is_frame_blob({cv2.CC_STAT_WIDTH: bw, cv2.CC_STAT_HEIGHT: bh}, w, h):
        return
    pieces.append({
        "bbox": (x, y, bw, bh),
        "mask": region,
        "area": area,
        "centroid": (float(xs.mean()), float(ys.mean())),
    })


def detect_pieces(image_bgr, cfg):
    """Return list of dicts: {bbox:(x,y,w,h), mask (full-image uint8), area}."""
    h, w = image_bgr.shape[:2]
    img_area = h * w
    min_area = cfg.min_piece_area_frac * img_area
    max_area = cfg.max_piece_area_frac * img_area

    mask = _saturation_mask(image_bgr)

    interior = find_display_interior(image_bgr)
    if interior is not None:
        ix, iy, iw, ih = interior
        roi = np.zeros_like(mask)
        roi[iy:iy + ih, ix:ix + iw] = 255
        mask = cv2.bitwise_and(mask, roi)

    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)

    # Estimate a single-earring area scale from moderately-sized components
    # (excludes both noise specks and big merged/frame blobs), used to space
    # watershed peaks so touching/overlapping pieces split apart without
    # fragmenting a normal single piece on its own surface texture.
    normal_areas = [
        stats[i, cv2.CC_STAT_AREA] for i in range(1, n)
        if min_area <= stats[i, cv2.CC_STAT_AREA] <= max_area * 0.5
        and not _is_frame_blob(stats[i], w, h)
    ]
    typical_area = float(np.median(normal_areas)) if normal_areas else min_area * 6

    pieces = []
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < min_area:
            continue

        region = np.where(labels == i, 255, 0).astype(np.uint8)
        split = _split_blob(region, typical_area)
        if split is None:
            if area <= max_area and not _is_frame_blob(stats[i], w, h):
                _add_piece(pieces, region, w, h, min_area, max_area)
            continue

        for j in range(1, split.max() + 1):
            sub_region = np.where(split == j, 255, 0).astype(np.uint8)
            _add_piece(pieces, sub_region, w, h, min_area, max_area)

    pieces.sort(key=lambda p: p["bbox"][0])
    return pieces
