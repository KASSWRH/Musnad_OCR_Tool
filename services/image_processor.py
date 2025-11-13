import cv2
import numpy as np
from PIL import Image as PILImage
import os
from typing import Dict, Any, Tuple
import json
import hashlib
from datetime import datetime

class ImageProcessor:
    def __init__(self):
        self.preview_cache = {}  # ذاكرة تخزين مؤقت للمعاينات

    def _letterbox_resize_array(self, img, size: int = 640):
        h, w = img.shape[:2]
        scale = min(size / w, size / h)
        new_w = int(round(w * scale))
        new_h = int(round(h * scale))
        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        top = (size - new_h) // 2
        bottom = size - new_h - top
        left = (size - new_w) // 2
        right = size - new_w - left
        color = (114, 114, 114)
        canvas = cv2.copyMakeBorder(resized, top, bottom, left, right, borderType=cv2.BORDER_CONSTANT, value=color)
        return canvas, scale, left, top

    # ---------- Helpers ----------
    def _settings_fingerprint(self, settings: Dict[str, Any]) -> str:
        """Create a deterministic short fingerprint for settings for cache keys and filenames."""
        try:
            dumped = json.dumps(settings or {}, sort_keys=True, separators=(",", ":"))
        except Exception:
            dumped = str(settings)
        return hashlib.md5(dumped.encode("utf-8")).hexdigest()[:12]

    def _normalize_preview_size(self, preview_size) -> Tuple[int, int]:
        """Normalize preview_size to (width, height), supporting dict or tuple."""
        try:
            if isinstance(preview_size, dict):
                w = int(preview_size.get('width', 640))
                h = int(preview_size.get('height', 640))
                return max(w, 1), max(h, 1)
            if isinstance(preview_size, (list, tuple)) and len(preview_size) >= 2:
                w = int(preview_size[0])
                h = int(preview_size[1])
                return max(w, 1), max(h, 1)
        except Exception:
            pass
        return 800, 600
        
    def process_image(self, image, processing_settings: Dict[str, Any]) -> bool:
        """Process image with given settings"""
        try:
            # تحميل الصورة الأصلية
            if not os.path.exists(image.original_image_path):
                print(f"Original image not found: {image.original_image_path}")
                return False
            
            img = cv2.imread(image.original_image_path)
            if img is None:
                print(f"Failed to load image: {image.original_image_path}")
                return False
            
            # تطبيق pipeline المعالجة
            
            # التأكد من وجود مجلد الصور المعالجة
            os.makedirs(os.path.dirname(image.processed_image_path), exist_ok=True)
            
            # حفظ الصورة المعالجة مع التحكم في الجودة
            # quality = min(max(processing_settings.get('quality', 85), 1), 100)
            # success = cv2.imwrite(image.processed_image_path, processed_img,
            #                     [cv2.IMWRITE_JPEG_QUALITY, quality])
            # تطبيق المعالجة
            processed_img = self.apply_processing_pipeline(img, processing_settings)
            processed_img, _, _, _ = self._letterbox_resize_array(processed_img, 640)

            # حفظ الصورة المعالجة مع التحكم في الجودة
            quality = min(max(processing_settings.get('quality', 85), 1), 100)
            success = cv2.imwrite(image.processed_image_path, processed_img,
                                [cv2.IMWRITE_JPEG_QUALITY, quality])
            if not success:
                print(f"Failed to save processed image: {image.processed_image_path}")
                return False
            
            # تحديث بيانات الصورة
            image.width = 640
            image.height = 640
            try:
                image.file_size = os.path.getsize(image.processed_image_path)
            except Exception:
                pass
            image.processing_settings = processing_settings
            image.status = 'processed'
            image.save()
            
            # مسح الذاكرة المؤقتة للمعاينات
            self.clear_preview_cache(image.id)
            
            return True
            
        except Exception as e:
            print(f"Error processing image {image.id}: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def get_processing_preview(self, image, settings: Dict[str, Any], 
                             preview_size: Tuple[int, int] = (640, 640)) -> str:
        """Generate processing preview and return preview path"""
        try:
            # Normalize size and create deterministic cache key
            width, height = self._normalize_preview_size(preview_size)
            fp = self._settings_fingerprint(settings)
            cache_key = f"{image.id}_{fp}_{width}x{height}"

            # التحقق من الذاكرة المؤقتة أولاً
            if cache_key in self.preview_cache:
                preview_path = self.preview_cache[cache_key]
                if os.path.exists(preview_path):
                    return preview_path

            if not os.path.exists(image.original_image_path):
                raise Exception("Original image not found")

            img = cv2.imread(image.original_image_path)
            if img is None:
                raise Exception("Failed to load image")

            # حفظ الأبعاد الأصلية
            original_height, original_width = img.shape[:2]

            # تغيير الحجم للمعاينة لتحسين الأداء
            if original_width > width or original_height > height:
                scale = min(width / original_width, height / original_height)
                new_width = int(original_width * scale)
                new_height = int(original_height * scale)
                img = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_AREA)

            # تطبيق المعالجة
            processed_img = self.apply_processing_pipeline(img, settings)

            # حفظ المعاينة في المجلد المخصص
            from models.project import Project
            project = Project.load(image.project_id)
            if project:
                preview_dir = project.previews_folder
            else:
                # fallback للطريقة القديمة
                preview_dir = os.path.join(os.path.dirname(image.original_image_path), 'previews')
            os.makedirs(preview_dir, exist_ok=True)

            preview_filename = f"{image.id}_preview_{fp}.jpg"
            preview_path = os.path.join(preview_dir, preview_filename)

            quality = min(max(settings.get('quality', 85), 1), 100)
            cv2.imwrite(preview_path, processed_img, [cv2.IMWRITE_JPEG_QUALITY, quality])

            # تخزين في الذاكرة المؤقتة
            self.preview_cache[cache_key] = preview_path

            return preview_path

        except Exception as e:
            print(f"Error generating preview: {e}")
            import traceback
            traceback.print_exc()
            raise Exception(f"Failed to generate preview: {str(e)}")
    
    def apply_processing_pipeline(self, img, settings: Dict[str, Any]):
        """Apply processing pipeline to image"""
        try:
            processed_img = img.copy()

            # 1. Grayscale conversion
            if settings.get('grayscale', False):
                if len(processed_img.shape) == 3:
                    processed_img = cv2.cvtColor(processed_img, cv2.COLOR_BGR2GRAY)
                    processed_img = cv2.cvtColor(processed_img, cv2.COLOR_GRAY2BGR)

            # 1.5 Illumination/background correction
            illum_settings = settings.get('illumination', {})
            if illum_settings.get('enabled', False):
                # Estimate background using a large blur then normalize
                gray = cv2.cvtColor(processed_img, cv2.COLOR_BGR2GRAY)
                k = int(illum_settings.get('blur_kernel', 41))
                k = max(3, k if k % 2 == 1 else k + 1)
                background = cv2.GaussianBlur(gray, (k, k), 0)
                # Avoid division by zero
                background = np.maximum(background, 1)
                norm = (gray.astype(np.float32) / background.astype(np.float32))
                norm = np.clip(norm * 255.0, 0, 255).astype(np.uint8)
                processed_img = cv2.cvtColor(norm, cv2.COLOR_GRAY2BGR)

            # 1.7 Shadow removal (Gaussian blur background subtraction)
            shadow_settings = settings.get('shadow_remove', {})
            if shadow_settings.get('enabled', False):
                gray = cv2.cvtColor(processed_img, cv2.COLOR_BGR2GRAY)
                k = int(shadow_settings.get('blur_kernel', 31))
                k = max(3, k if k % 2 == 1 else k + 1)
                background = cv2.GaussianBlur(gray, (k, k), 0)
                sub = cv2.subtract(gray, background)
                sub = cv2.normalize(sub, None, 0, 255, cv2.NORM_MINMAX)
                processed_img = cv2.cvtColor(sub, cv2.COLOR_GRAY2BGR)

            # 2. CLAHE (Contrast Limited Adaptive Histogram Equalization)
            clahe_settings = settings.get('clahe', {})
            if clahe_settings.get('enabled', False):
                clip_limit = max(float(clahe_settings.get('clip_limit', 2.0)), 0.01)
                tile_grid_size = int(clahe_settings.get('tile_grid_size', 8))
                tile_grid_size = max(tile_grid_size, 1)

                # Convert to LAB color space
                lab = cv2.cvtColor(processed_img, cv2.COLOR_BGR2LAB)
                l, a, b = cv2.split(lab)

                # Apply CLAHE to L channel
                clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_grid_size, tile_grid_size))
                l = clahe.apply(l)

                # Merge channels and convert back
                lab = cv2.merge([l, a, b])
                processed_img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)

            # 2.2 Local contrast (advanced) using CLAHE or equalizeHist
            lc_settings = settings.get('local_contrast', {})
            if lc_settings.get('enabled', False):
                method = (lc_settings.get('method') or 'clahe').lower()
                gray = cv2.cvtColor(processed_img, cv2.COLOR_BGR2GRAY)
                if method == 'equalize':
                    eq = cv2.equalizeHist(gray)
                    processed_img = cv2.cvtColor(eq, cv2.COLOR_GRAY2BGR)
                else:
                    clip = max(float(lc_settings.get('clip_limit', 2.5)), 0.01)
                    tile = int(lc_settings.get('tile_grid_size', 8))
                    tile = max(tile, 1)
                    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(tile, tile))
                    eq = clahe.apply(gray)
                    processed_img = cv2.cvtColor(eq, cv2.COLOR_GRAY2BGR)

            # 2.5 Gamma correction
            gamma_settings = settings.get('gamma', {})
            if gamma_settings.get('enabled', False):
                g = float(gamma_settings.get('value', 1.0))
                g = max(0.1, min(5.0, g))
                inv = 1.0 / g
                table = (np.linspace(0, 1, 256) ** inv * 255).astype('uint8')
                processed_img = cv2.LUT(processed_img, table)

            # 3. Thresholding
            threshold_settings = settings.get('threshold', {})
            if threshold_settings.get('enabled', False):
                gray = cv2.cvtColor(processed_img, cv2.COLOR_BGR2GRAY)
                thresh_type = threshold_settings.get('type', 'binary')
                thresh_value = int(threshold_settings.get('value', 127))
                max_value = int(threshold_settings.get('max_value', 255))
                thresh_value = min(max(thresh_value, 0), 255)
                max_value = min(max(max_value, 1), 255)

                if thresh_type == 'binary':
                    _, thresh = cv2.threshold(gray, thresh_value, max_value, cv2.THRESH_BINARY)
                elif thresh_type == 'binary_inv':
                    _, thresh = cv2.threshold(gray, thresh_value, max_value, cv2.THRESH_BINARY_INV)
                elif thresh_type == 'adaptive_mean':
                    block_size = int(threshold_settings.get('block_size', 11))
                    c_val = int(threshold_settings.get('c', 2))
                    block_size = block_size if block_size % 2 == 1 else block_size + 1
                    block_size = max(block_size, 3)
                    thresh = cv2.adaptiveThreshold(gray, max_value, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, block_size, c_val)
                elif thresh_type == 'adaptive_gaussian':
                    block_size = int(threshold_settings.get('block_size', 11))
                    c_val = int(threshold_settings.get('c', 2))
                    block_size = block_size if block_size % 2 == 1 else block_size + 1
                    block_size = max(block_size, 3)
                    thresh = cv2.adaptiveThreshold(gray, max_value, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, block_size, c_val)
                else:
                    _, thresh = cv2.threshold(gray, thresh_value, max_value, cv2.THRESH_BINARY)

                processed_img = cv2.cvtColor(thresh, cv2.COLOR_GRAY2BGR)

            # 4. Deskewing
            if settings.get('deskew', {}).get('enabled', False):
                # Simple deskewing using Hough lines
                gray = cv2.cvtColor(processed_img, cv2.COLOR_BGR2GRAY)
                edges = cv2.Canny(gray, 50, 150, apertureSize=3)
                lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=100)

                if lines is not None:
                    angles = []
                    for line in lines[:10]:  # Use first 10 lines
                        rho, theta = line[0]
                        angle = (theta * 180.0 / np.pi)
                        if angle > 90:
                            angle = angle - 180
                        angles.append(angle)

                    if angles:
                        median_angle = np.median(angles)
                        if abs(median_angle) > 0.5:  # Only rotate if angle is significant
                            h, w = processed_img.shape[:2]
                            center = (w // 2, h // 2)
                            rotation_matrix = cv2.getRotationMatrix2D(center, median_angle, 1.0)
                            processed_img = cv2.warpAffine(processed_img, rotation_matrix, (w, h),
                                                         flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

            # 4.5 Smoothing: bilateral and median (before morphology)
            bilateral_settings = settings.get('bilateral', {})
            if bilateral_settings.get('enabled', False):
                d = int(bilateral_settings.get('diameter', 7))
                sigma_color = float(bilateral_settings.get('sigma_color', 50))
                sigma_space = float(bilateral_settings.get('sigma_space', 50))
                d = max(1, d)
                processed_img = cv2.bilateralFilter(processed_img, d, sigma_color, sigma_space)

            median_settings = settings.get('median', {})
            if median_settings.get('enabled', False):
                k = int(median_settings.get('kernel', 3))
                k = max(3, k if k % 2 == 1 else k + 1)
                processed_img = cv2.medianBlur(processed_img, k)

            # 5. Morphological operations
            morph_settings = settings.get('morphology', {})
            if morph_settings.get('enabled', False):
                operation = (morph_settings.get('operation', 'opening') or 'opening')
                kernel_size = int(morph_settings.get('kernel_size', 3))
                iterations = int(morph_settings.get('iterations', 1))
                kernel_size = max(kernel_size, 1)
                iterations = max(iterations, 1)

                kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))

                if operation == 'opening':
                    processed_img = cv2.morphologyEx(processed_img, cv2.MORPH_OPEN, kernel, iterations=iterations)
                elif operation == 'closing':
                    processed_img = cv2.morphologyEx(processed_img, cv2.MORPH_CLOSE, kernel, iterations=iterations)
                elif operation == 'erosion':
                    processed_img = cv2.erode(processed_img, kernel, iterations=iterations)
                elif operation == 'dilation':
                    processed_img = cv2.dilate(processed_img, kernel, iterations=iterations)

            # 6. Denoising
            denoise_settings = settings.get('denoise', {})
            if denoise_settings.get('enabled', False):
                strength = int(denoise_settings.get('strength', 10))
                strength = min(max(strength, 1), 30)
                processed_img = cv2.fastNlMeansDenoisingColored(processed_img, None, strength, strength, 7, 21)

            # 7. Sharpening
            sharpen_settings = settings.get('sharpen', {})
            if sharpen_settings.get('enabled', False):
                strength = float(sharpen_settings.get('strength', 1.0))
                strength = max(strength, 0.0)
                kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]], dtype=np.float32) * strength
                processed_img = cv2.filter2D(processed_img, -1, kernel)

            # 7.5 Edge enhancement (Laplacian)
            edge_settings = settings.get('edge_enhance', {})
            if edge_settings.get('enabled', False):
                alpha = float(edge_settings.get('alpha', 0.3))
                alpha = max(0.0, min(2.0, alpha))
                gray = cv2.cvtColor(processed_img, cv2.COLOR_BGR2GRAY)
                lap = cv2.Laplacian(gray, cv2.CV_16S, ksize=3)
                lap = cv2.convertScaleAbs(lap)
                lap = cv2.cvtColor(lap, cv2.COLOR_GRAY2BGR)
                processed_img = cv2.addWeighted(processed_img, 1.0, lap, alpha, 0)

            # 7.8 Speck removal/inpainting (simple mask-based smoothing)
            speck_settings = settings.get('speck_remove', {})
            if speck_settings.get('enabled', False):
                area_thr = int(speck_settings.get('max_area', 20))
                gray = cv2.cvtColor(processed_img, cv2.COLOR_BGR2GRAY)
                _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                inv = 255 - bw
                cnts, _ = cv2.findContours(inv, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                mask = np.zeros_like(gray)
                for c in cnts:
                    if cv2.contourArea(c) <= area_thr:
                        cv2.drawContours(mask, [c], -1, 255, thickness=cv2.FILLED)
                if np.count_nonzero(mask) > 0:
                    processed_img = cv2.inpaint(processed_img, mask, 3, cv2.INPAINT_TELEA)

            return processed_img

        except Exception as e:
            print(f"Error in processing pipeline: {e}")
            import traceback
            traceback.print_exc()
            return img  # Return original image if processing fails
    
    def clear_preview_cache(self, image_id: str = None):
        """Clear preview cache for specific image or all images"""
        if image_id:
            keys_to_remove = [k for k in self.preview_cache.keys() if k.startswith(image_id)]
            for key in keys_to_remove:
                # حذف ملف المعاينة من القرص
                try:
                    if os.path.exists(self.preview_cache[key]):
                        os.remove(self.preview_cache[key])
                except:
                    pass
                del self.preview_cache[key]
        else:
            # حذف جميع ملفات المعاينة
            for preview_path in self.preview_cache.values():
                try:
                    if os.path.exists(preview_path):
                        os.remove(preview_path)
                except:
                    pass
            self.preview_cache.clear()
    
    def clear_processing_cache(self):
        """Clear processing cache"""
        self.clear_preview_cache()
