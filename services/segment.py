import os
from typing import Dict, Any, List, Tuple

import cv2
import numpy as np


class Segmenter:
    def __init__(self):
        pass

    def _ensure_dir(self, path: str):
        os.makedirs(path, exist_ok=True)

    def _binarize(self, img: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
        return cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 25, 15)

    def segment(self, img_path: str, level: str = 'lines', save_dir: str = None) -> Dict[str, Any]:
        if not os.path.exists(img_path):
            return {'boxes': [], 'saved': []}
        img = cv2.imread(img_path)
        if img is None:
            return {'boxes': [], 'saved': []}

        bin_img = self._binarize(img)

        if level == 'lines':
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 15))
        elif level == 'words':
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (9, 3))
        else:  # characters
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))

        dil = cv2.dilate(bin_img, kernel, iterations=1)
        cnts, _ = cv2.findContours(dil, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        boxes: List[Tuple[int, int, int, int]] = []
        h, w = bin_img.shape[:2]
        for c in cnts:
            x, y, bw, bh = cv2.boundingRect(c)
            if bw * bh < 50:
                continue
            # clamp
            x = max(0, x)
            y = max(0, y)
            bw = min(bw, w - x)
            bh = min(bh, h - y)
            boxes.append((x, y, bw, bh))

        saved_files: List[str] = []
        if save_dir:
            self._ensure_dir(save_dir)
            base = os.path.splitext(os.path.basename(img_path))[0]
            for i, (x, y, bw, bh) in enumerate(sorted(boxes, key=lambda b: (b[1], b[0]))):
                crop = img[y:y+bh, x:x+bw]
                out = os.path.join(save_dir, f"{base}_{level}_{i+1:04d}.jpg")
                cv2.imwrite(out, crop, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
                saved_files.append(out)

        return {'boxes': [{'x': x, 'y': y, 'w': bw, 'h': bh} for (x, y, bw, bh) in boxes], 'saved': saved_files}
