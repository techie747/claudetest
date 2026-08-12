"""Generate a synthetic test photo: mesh-ish background + earring-like shapes
on hooks, to sanity-check the pipeline without the real reference photo."""

import numpy as np
import cv2

W, H = 1600, 1000
img = np.full((H, W, 3), (235, 235, 235), dtype=np.uint8)

# subtle mesh pattern
for x in range(0, W, 14):
    cv2.line(img, (x, 0), (x, H), (215, 215, 215), 1)
for y in range(0, H, 14):
    cv2.line(img, (0, y), (W, y), (215, 215, 215), 1)

rng = np.random.default_rng(7)

shapes = [
    ("circle", 60), ("circle", 60),
    ("disc", 90), ("disc", 90),
    ("fan", 70), ("fan", 70),
    ("wavy", 80), ("wavy", 80),
    ("circle_small", 35), ("circle_small", 35),
    ("hoop", 75), ("hoop", 75),
    ("disc", 55), ("disc", 55),
]

positions = []
cols = 7
for i in range(14):
    col = i % cols
    row = i // cols
    x = 150 + col * 210 + int(rng.integers(-15, 15))
    y = 220 + row * 420 + int(rng.integers(-15, 15))
    positions.append((x, y))

copper = (60, 110, 180)  # BGR-ish copper tone

for (shape, size), (cx, cy) in zip(shapes, positions):
    color = tuple(int(c + rng.integers(-15, 15)) for c in copper)
    # hook wire
    cv2.line(img, (cx, cy - size - 40), (cx, cy - size + 5), (120, 120, 120), 2)
    if shape.startswith("circle") or shape == "disc":
        cv2.circle(img, (cx, cy), size // 2, color, -1, lineType=cv2.LINE_AA)
        cv2.circle(img, (cx, cy), size // 2, (30, 60, 100), 2, lineType=cv2.LINE_AA)
    elif shape == "fan":
        pts = np.array([
            [cx, cy - size // 2],
            [cx - size // 2, cy + size // 2],
            [cx, cy + size // 3],
            [cx + size // 2, cy + size // 2],
        ])
        cv2.fillPoly(img, [pts], color, lineType=cv2.LINE_AA)
    elif shape == "wavy":
        cv2.ellipse(img, (cx, cy), (size // 2, size), int(rng.integers(0, 40)), 0, 360, color, -1, lineType=cv2.LINE_AA)
    elif shape == "hoop":
        cv2.circle(img, (cx, cy), size // 2, color, 10, lineType=cv2.LINE_AA)

cv2.imwrite("input/test_board.jpg", img)
print("wrote input/test_board.jpg")
