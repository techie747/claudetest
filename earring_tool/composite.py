"""Step 4: crop, white-background composite, drop shadow, square canvas."""

import numpy as np
import cv2
from PIL import Image, ImageFilter


def _bgra_crop(image_bgr, piece, padding_px):
    x, y, w, h = piece["bbox"]
    H, W = image_bgr.shape[:2]
    x0, y0 = max(0, x - padding_px), max(0, y - padding_px)
    x1, y1 = min(W, x + w + padding_px), min(H, y + h + padding_px)
    img = image_bgr[y0:y1, x0:x1]
    alpha = piece["alpha"][y0:y1, x0:x1]
    bgra = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = alpha
    return bgra


def _union_crop(image_bgr, pieces, padding_px):
    xs0, ys0, xs1, ys1 = [], [], [], []
    for p in pieces:
        x, y, w, h = p["bbox"]
        xs0.append(x); ys0.append(y); xs1.append(x + w); ys1.append(y + h)
    H, W = image_bgr.shape[:2]
    x0 = max(0, min(xs0) - padding_px)
    y0 = max(0, min(ys0) - padding_px)
    x1 = min(W, max(xs1) + padding_px)
    y1 = min(H, max(ys1) + padding_px)
    img = image_bgr[y0:y1, x0:x1]
    alpha = np.zeros(img.shape[:2], dtype=np.uint8)
    for p in pieces:
        alpha = np.maximum(alpha, p["alpha"][y0:y1, x0:x1])
    bgra = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = alpha
    return bgra


def _add_shadow_and_pad(bgra, cfg):
    canvas = cfg.canvas_size
    scale = canvas / max(bgra.shape[0], bgra.shape[1], 1)
    # Leave headroom so the subject + shadow fit inside the canvas with margin.
    fit_scale = min(scale, (canvas * 0.86) / max(bgra.shape[0], bgra.shape[1], 1))
    new_w = max(1, int(bgra.shape[1] * fit_scale))
    new_h = max(1, int(bgra.shape[0] * fit_scale))
    resized = cv2.resize(bgra, (new_w, new_h), interpolation=cv2.INTER_AREA)

    rgba = cv2.cvtColor(resized, cv2.COLOR_BGRA2RGBA)
    subject = Image.fromarray(rgba, mode="RGBA")

    bg = Image.new("RGB", (canvas, canvas), cfg.background_rgb)

    shadow_scale = canvas / 2000.0
    off_x, off_y = int(cfg.shadow_offset[0] * shadow_scale), int(cfg.shadow_offset[1] * shadow_scale)
    blur = max(1, int(cfg.shadow_blur * shadow_scale))

    alpha_channel = subject.split()[3]
    shadow = Image.new("L", subject.size, 0)
    shadow.paste(alpha_channel, (0, 0))
    shadow = shadow.point(lambda a: int(a * cfg.shadow_opacity))
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))

    paste_x = (canvas - new_w) // 2
    paste_y = (canvas - new_h) // 2

    shadow_layer = Image.new("L", (canvas, canvas), 0)
    shadow_layer.paste(shadow, (paste_x + off_x, paste_y + off_y))
    black = Image.new("RGB", (canvas, canvas), (0, 0, 0))
    bg = Image.composite(black, bg, shadow_layer)

    bg = bg.convert("RGBA")
    bg.paste(subject, (paste_x, paste_y), subject)
    return bg.convert("RGB")


def composite_piece(image_bgr, piece, cfg):
    x, y, w, h = piece["bbox"]
    padding_px = int(max(w, h) * cfg.padding_frac)
    bgra = _bgra_crop(image_bgr, piece, padding_px)
    return _add_shadow_and_pad(bgra, cfg)


def composite_pair(image_bgr, piece_a, piece_b, cfg):
    padding_px = int(max(piece_a["bbox"][2], piece_a["bbox"][3],
                          piece_b["bbox"][2], piece_b["bbox"][3]) * cfg.padding_frac)
    bgra = _union_crop(image_bgr, [piece_a, piece_b], padding_px)
    return _add_shadow_and_pad(bgra, cfg)
