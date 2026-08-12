"""Step 2 (refine): per-piece rembg matting, hook/wire trimming, edge feathering."""

import numpy as np
import cv2
from rembg import remove, new_session

_SESSION = None


def _session():
    global _SESSION
    if _SESSION is None:
        _SESSION = new_session("u2net")
    return _SESSION


def rembg_refine_mask(image_bgr, piece, margin_frac=0.35):
    """Run rembg on a tight crop around the piece to get a precise per-piece
    alpha matte (far more reliable at this scale/isolation than a whole-image
    pass), then paste the result back into a full-image-sized mask."""
    x, y, w, h = piece["bbox"]
    H, W = image_bgr.shape[:2]
    m = int(max(w, h) * margin_frac)
    x0, y0 = max(0, x - m), max(0, y - m)
    x1, y1 = min(W, x + w + m), min(H, y + h + m)
    crop = image_bgr[y0:y1, x0:x1]

    rgba = remove(crop, session=_session())
    if rgba.shape[2] == 4:
        crop_alpha = rgba[:, :, 3]
    else:
        gray = cv2.cvtColor(rgba, cv2.COLOR_BGR2GRAY)
        _, crop_alpha = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY)

    # Keep only the component nearest the crop center (the target piece),
    # in case rembg picks up a neighboring earring inside the margin.
    _, bin_mask = cv2.threshold(crop_alpha, 40, 255, cv2.THRESH_BINARY)
    n, labels, stats, centroids = cv2.connectedComponentsWithStats(bin_mask, connectivity=8)
    if n > 2:
        ch, cw = crop.shape[:2]
        center = np.array([cw / 2, ch / 2])
        best_i, best_d = None, None
        for i in range(1, n):
            if stats[i, cv2.CC_STAT_AREA] < 20:
                continue
            d = np.linalg.norm(centroids[i] - center)
            if best_d is None or d < best_d:
                best_d, best_i = d, i
        if best_i is not None:
            crop_alpha = np.where(labels == best_i, crop_alpha, 0).astype(np.uint8)

    crop_alpha = _punch_background_holes(crop_alpha, piece["mask"][y0:y1, x0:x1])

    full_mask = np.zeros((H, W), dtype=np.uint8)
    full_mask[y0:y1, x0:x1] = crop_alpha
    return full_mask


def _punch_background_holes(alpha, coarse_mask, min_hole_frac=0.01, max_hole_frac=0.6):
    """rembg's saliency model often fails to recognize an earring's interior
    cutout (e.g. a swirl/hoop shape) as background at all -- its raw alpha
    comes back fully solid over the whole silhouette, mesh backdrop and all,
    rather than punched through.

    detect.py's own coarse saturation-based mask (computed at its working
    resolution, before this per-piece rembg pass) already gets this right:
    it correctly reads the mesh visible through a hole as background, so
    that mask's silhouette is a ring/donut shape, not a solid disc. Trying
    to *recompute* that same signal here on the noisier full-resolution
    crop breaks it (fine texture noise fragments the hole's boundary so it
    never closes into a proper enclosed contour), and a plain color-
    similarity heuristic is worse still -- it also matches a piece's own
    ordinary light/dark patina patches and eats into the piece itself
    (tried both; both regressed real pieces). So just reuse the existing
    coarse mask's holes directly via contour hierarchy instead."""
    fg = alpha > 128
    if not fg.any():
        return alpha

    contours, hierarchy = cv2.findContours(coarse_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None:
        return alpha
    hierarchy = hierarchy[0]

    piece_area = int(fg.sum())
    result = alpha.copy()
    for i, c in enumerate(contours):
        if hierarchy[i][3] == -1:
            continue  # outer contour, not a hole
        area = cv2.contourArea(c)
        if area < piece_area * min_hole_frac or area > piece_area * max_hole_frac:
            continue
        hole_mask = np.zeros(alpha.shape, dtype=np.uint8)
        cv2.drawContours(hole_mask, [c], -1, 255, thickness=cv2.FILLED)
        result[hole_mask > 0] = 0
    return result


def trim_hook(mask, thin_frac=0.22, max_trim_frac=0.35):
    """Remove a thin hanging hook/wire protruding from the top of the mask.

    Walk down from the top row; while a row's foreground width is much
    narrower than the piece's max width, treat it as wire and clear it.
    Stops once genuine piece width appears, or after max_trim_frac of height.
    """
    ys, xs = np.where(mask > 0)
    if len(ys) == 0:
        return mask
    y0, y1 = ys.min(), ys.max()
    height = y1 - y0 + 1
    max_width = 0
    row_widths = {}
    for y in range(y0, y1 + 1):
        row = np.where(mask[y] > 0)[0]
        w = (row.max() - row.min() + 1) if len(row) else 0
        row_widths[y] = w
        max_width = max(max_width, w)
    if max_width == 0:
        return mask

    trimmed = mask.copy()
    limit = y0 + int(height * max_trim_frac)
    for y in range(y0, min(limit, y1)):
        if row_widths[y] < max_width * thin_frac:
            trimmed[y, :] = 0
        else:
            break
    return trimmed


def feather_alpha(mask, erode_px=2, feather_px=3):
    """Slightly erode to strip halo pixels, then Gaussian-blur the edge for
    a soft alpha matte instead of a hard cutout line."""
    m = mask.copy()
    if erode_px > 0:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (erode_px * 2 + 1,) * 2)
        m = cv2.erode(m, kernel, iterations=1)
    alpha = m.astype(np.float32)
    if feather_px > 0:
        k = feather_px * 2 + 1
        alpha = cv2.GaussianBlur(alpha, (k, k), 0)
    return np.clip(alpha, 0, 255).astype(np.uint8)


def refine_piece(image_bgr, piece, cfg):
    mask = rembg_refine_mask(image_bgr, piece)
    if mask.max() == 0:
        # rembg found nothing in the crop; fall back to the coarse detector mask
        mask = piece["mask"]
    if not cfg.keep_hook:
        mask = trim_hook(mask)
    alpha = feather_alpha(mask, cfg.alpha_matte_erode_px, cfg.alpha_matte_feather_px)

    ys, xs = np.where(alpha > 10)
    if len(ys) == 0:
        return None
    x, y, w, h = xs.min(), ys.min(), xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
    piece = dict(piece)
    piece["mask"] = mask
    piece["alpha"] = alpha
    piece["bbox"] = (int(x), int(y), int(w), int(h))
    return piece
