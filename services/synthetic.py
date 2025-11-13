import os
from typing import List, Dict, Any

import numpy as np
from PIL import Image as PILImage, ImageDraw, ImageFont, ImageFilter


class SyntheticGenerator:
    def __init__(self, default_font_path: str = 'sf_old_south_arabian_serif.ttf'):
        self.default_font_path = default_font_path

    def _ensure_dir(self, path: str):
        os.makedirs(path, exist_ok=True)

    def _load_font(self, font_path: str, size: int):
        try:
            return ImageFont.truetype(font_path, size)
        except Exception:
            return ImageFont.load_default()

    def render_text(self, text: str, font_path: str, font_size: int, padding: int = 16) -> PILImage.Image:
        font = self._load_font(font_path or self.default_font_path, font_size)
        dummy = PILImage.new('L', (1, 1), 255)
        draw = ImageDraw.Draw(dummy)
        # getbbox preferred in newer Pillow
        bbox = draw.textbbox((0, 0), text, font=font)
        w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        img = PILImage.new('L', (w + padding * 2, h + padding * 2), 255)
        d = ImageDraw.Draw(img)
        d.text((padding, padding), text, font=font, fill=0)
        return img.convert('RGB')

    def apply_effects(self, img: PILImage.Image, effects: Dict[str, Any]) -> PILImage.Image:
        out = img
        if effects.get('gaussian_blur', False):
            radius = float(effects.get('blur_radius', 0.8))
            out = out.filter(ImageFilter.GaussianBlur(radius))
        if effects.get('sharpen', False):
            out = out.filter(ImageFilter.UnsharpMask(radius=1.5, percent=150, threshold=3))
        if effects.get('paper_texture', False):
            arr = np.array(out).astype(np.float32)
            noise = np.random.normal(0, float(effects.get('texture_sigma', 6)), arr.shape)
            arr = np.clip(arr + noise, 0, 255).astype(np.uint8)
            out = PILImage.fromarray(arr)
        return out

    def generate(self, texts: List[str], out_dir: str, options: Dict[str, Any]) -> List[str]:
        self._ensure_dir(out_dir)
        font_path = options.get('font_path') or self.default_font_path
        font_size = int(options.get('font_size', 64))
        quality = int(options.get('quality', 95))
        effects = options.get('effects', {})
        files: List[str] = []
        for idx, t in enumerate(texts):
            img = self.render_text(t, font_path, font_size)
            img = self.apply_effects(img, effects)
            name = f"synthetic_{idx+1:04d}.jpg"
            path = os.path.join(out_dir, name)
            img.save(path, format='JPEG', quality=quality)
            files.append(path)
        return files
