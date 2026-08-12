"""Step 2 (refine): per-piece mask cleanup, hook/wire trimming, edge feathering."""

import numpy as np
import cv2


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


def refine_piece(piece, cfg):
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
