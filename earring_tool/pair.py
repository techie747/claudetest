"""Step 3: match individual earring pieces into pairs.

Hand-hammered artisan pieces are rarely pixel-identical, so we score
similarity on shape (Hu moments), size, and color (hue histogram) rather
than exact matching, then run greedy min-cost pairing. Pairs below the
confidence threshold are flagged for manual review instead of silently
guessed.
"""

import itertools
import numpy as np
import cv2


def _hu_moments(mask):
    m = cv2.moments(mask, binaryImage=True)
    hu = cv2.HuMoments(m).flatten()
    # log-scale for comparable magnitudes
    return -np.sign(hu) * np.log10(np.abs(hu) + 1e-30)


def _hue_hist(image_bgr, mask):
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0], mask, [32], [0, 180])
    cv2.normalize(hist, hist, 0, 1, cv2.NORM_MINMAX)
    return hist.flatten()


def piece_descriptor(image_bgr, piece):
    x, y, w, h = piece["bbox"]
    crop_mask = piece["mask"][y:y + h, x:x + w]
    crop_img = image_bgr[y:y + h, x:x + w]
    return {
        "hu": _hu_moments(crop_mask),
        "hue_hist": _hue_hist(crop_img, crop_mask),
        "area": piece["area"],
        "aspect": w / h if h else 1.0,
        "bbox": piece["bbox"],
    }


def _similarity(a, b):
    hu_dist = np.linalg.norm(a["hu"] - b["hu"])
    hu_score = np.exp(-hu_dist / 3.0)

    hue_score = cv2.compareHist(
        a["hue_hist"].astype(np.float32), b["hue_hist"].astype(np.float32), cv2.HISTCMP_CORREL
    )
    hue_score = max(0.0, hue_score)

    size_ratio = min(a["area"], b["area"]) / max(a["area"], b["area"])

    aspect_ratio = min(a["aspect"], b["aspect"]) / max(a["aspect"], b["aspect"])

    score = 0.35 * hu_score + 0.30 * hue_score + 0.20 * size_ratio + 0.15 * aspect_ratio
    return float(score)


def match_pairs(descriptors, low_confidence_threshold=0.45):
    """Greedy max-weight matching over all pieces.

    Returns (pairs, flagged) where pairs is a list of dicts:
      {i, j, score, confident}
    and flagged mirrors the low-confidence subset for a review screen.
    If the piece count is odd, the leftover piece is returned unpaired.
    """
    n = len(descriptors)
    candidates = []
    for i, j in itertools.combinations(range(n), 2):
        candidates.append((i, j, _similarity(descriptors[i], descriptors[j])))
    candidates.sort(key=lambda c: c[2], reverse=True)

    used = set()
    pairs = []
    for i, j, score in candidates:
        if i in used or j in used:
            continue
        used.add(i)
        used.add(j)
        pairs.append({"i": i, "j": j, "score": score, "confident": score >= low_confidence_threshold})

    unpaired = [k for k in range(n) if k not in used]
    pairs.sort(key=lambda p: min(descriptors[p["i"]]["bbox"][0], descriptors[p["j"]]["bbox"][0]))
    flagged = [p for p in pairs if not p["confident"]]
    return pairs, flagged, unpaired
