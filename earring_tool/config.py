"""Configuration defaults for the earring extraction pipeline."""

from dataclasses import dataclass


@dataclass
class Config:
    # Detection
    min_piece_area_frac: float = 0.0006   # min blob area as fraction of image area
    max_piece_area_frac: float = 0.35     # max blob area as fraction of image area

    # Segmentation / matting
    alpha_matte_erode_px: int = 2
    alpha_matte_feather_px: int = 3
    keep_hook: bool = False               # crop out hanging hook/wire by default

    # Pairing
    pair_together: bool = True            # composite both earrings of a pair into one image
    low_confidence_threshold: float = 0.45  # below this, flag pair for manual review

    # Compositing
    canvas_size: int = 2000
    padding_frac: float = 0.10            # 10% padding around cropped content
    background_rgb: tuple = (255, 255, 255)
    shadow_offset: tuple = (14, 22)       # px offset at canvas_size=2000, scales with canvas
    shadow_blur: int = 40                 # gaussian blur radius, scales with canvas
    shadow_opacity: float = 0.28          # 0-1
    auto_straighten: bool = False         # preserve original orientation by default

    # Export
    output_dir: str = "output"
    manifest_name: str = "manifest.json"
