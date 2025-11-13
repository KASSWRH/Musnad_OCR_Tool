import os
import random
from typing import List, Dict, Any, Tuple

import cv2
import numpy as np
from PIL import Image as PILImage


class Augmenter:
    def __init__(self):
        pass

    def _ensure_dir(self, path: str):
        os.makedirs(path, exist_ok=True)

    def _rand_float(self, a: float, b: float) -> float:
        return float(a + (b - a) * random.random())

    def apply_ops(self, img: np.ndarray, ops: Dict[str, Any]) -> np.ndarray:
        out = img.copy()

        # Geometric
        geo = ops.get('geo', {})
        if geo.get('rotate', False):
            angle = float(geo.get('max_angle', 5)) * (2 * random.random() - 1)
            h, w = out.shape[:2]
            M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
            out = cv2.warpAffine(out, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT101)

        if geo.get('shift', False):
            sx = int(self._rand_float(-3, 3))
            sy = int(self._rand_float(-3, 3))
            M = np.float32([[1, 0, sx], [0, 1, sy]])
            out = cv2.warpAffine(out, M, (out.shape[1], out.shape[0]), borderMode=cv2.BORDER_REFLECT101)

        if geo.get('perspective', False):
            h, w = out.shape[:2]
            margin = int(min(h, w) * 0.03)
            src = np.float32([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]])
            jitter = lambda v: v + random.randint(-margin, margin)
            dst = np.float32([[jitter(0), jitter(0)], [jitter(w - 1), jitter(0)], [jitter(w - 1), jitter(h - 1)], [jitter(0), jitter(h - 1)]])
            M = cv2.getPerspectiveTransform(src, dst)
            out = cv2.warpPerspective(out, M, (w, h), borderMode=cv2.BORDER_REFLECT101)

        # Photometric
        photo = ops.get('photo', {})
        if photo.get('brightness', False) or photo.get('contrast', False):
            alpha = self._rand_float(0.8, 1.2) if photo.get('contrast', False) else 1.0
            beta = int(self._rand_float(-25, 25)) if photo.get('brightness', False) else 0
            out = cv2.convertScaleAbs(out, alpha=alpha, beta=beta)

        if photo.get('gamma', False):
            g = max(0.25, min(4.0, self._rand_float(0.8, 1.2)))
            inv = 1.0 / g
            table = np.array([(i / 255.0) ** inv * 255 for i in range(256)]).astype('uint8')
            out = cv2.LUT(out, table)

        if photo.get('noise', False):
            sigma = float(photo.get('noise_sigma', 8))
            noise = np.random.normal(0, sigma, out.shape).astype(np.float32)
            out = np.clip(out.astype(np.float32) + noise, 0, 255).astype(np.uint8)

        if photo.get('motion_blur', False):
            k = int(photo.get('kernel', 5))
            k = max(3, k if k % 2 == 1 else k + 1)
            kernel = np.zeros((k, k), dtype=np.float32)
            kernel[k // 2, :] = 1.0 / k
            out = cv2.filter2D(out, -1, kernel)

        return out

    def augment_and_save(self, img_path: str, out_dir: str, count: int, ops: Dict[str, Any]) -> List[str]:
        if not os.path.exists(img_path):
            return []
        self._ensure_dir(out_dir)

        img = cv2.imread(img_path)
        if img is None:
            return []

        saved: List[str] = []
        base = os.path.splitext(os.path.basename(img_path))[0]
        for i in range(max(1, int(count))):
            aug = self.apply_ops(img, ops)
            name = f"{base}_aug_{i+1:03d}.jpg"
            out_path = os.path.join(out_dir, name)
            cv2.imwrite(out_path, aug, [int(cv2.IMWRITE_JPEG_QUALITY), int(ops.get('quality', 90))])
            saved.append(out_path)
        return saved
