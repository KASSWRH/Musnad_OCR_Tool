import cv2
import numpy as np
from PIL import Image as PILImage
import os
from typing import Dict, Any, Tuple
import json
from datetime import datetime

class ImageProcessor:
    def __init__(self):
        self.preview_cache = {}  # ذاكرة تخزين مؤقت للمعاينات
        
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
            processed_img = self.apply_processing_pipeline(img, processing_settings)
            
            # التأكد من وجود مجلد الصور المعالجة
            os.makedirs(os.path.dirname(image.processed_image_path), exist_ok=True)
            
            # حفظ الصورة المعالجة مع التحكم في الجودة
            quality = processing_settings.get('quality', 85)
            success = cv2.imwrite(image.processed_image_path, processed_img, 
                                [cv2.IMWRITE_JPEG_QUALITY, quality])
            if not success:
                print(f"Failed to save processed image: {image.processed_image_path}")
                return False
            
            # تحديث بيانات الصورة
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
                             preview_size: Tuple[int, int] = (800, 600)) -> str:
        """Generate processing preview and return preview path"""
        try:
            # إنشاء مفتاح ذاكرة التخزين المؤقت
            cache_key = f"{image.id}_{hash(str(settings))}_{preview_size}"
            
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
            # if original_width > preview_size[0] or original_height > preview_size[1]:
            if original_width > preview_size['width'] or original_height > preview_size['height']:
                scale = min(preview_size['width'] / original_width, preview_size['height'] / original_height)
                # scale = min(preview_size[0] / original_width, preview_size[1] / original_height)
                new_width = int(original_width * scale)
                new_height = int(original_height * scale)
                img = cv2.resize(img, (new_width, new_height), interpolation=cv2.INTER_AREA)
            
            # تطبيق المعالجة
            processed_img = self.apply_processing_pipeline(img, settings)
            
            # حفظ المعاينة
            preview_dir = os.path.join(os.path.dirname(image.original_image_path), 'previews')
            os.makedirs(preview_dir, exist_ok=True)
            
            preview_filename = f"{image.id}_preview_{hash(str(settings))}.jpg"
            preview_path = os.path.join(preview_dir, preview_filename)
            
            quality = settings.get('quality', 85)
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
            
            # 2. CLAHE (Contrast Limited Adaptive Histogram Equalization)
            clahe_settings = settings.get('clahe', {})
            if clahe_settings.get('enabled', False):
                clip_limit = clahe_settings.get('clip_limit', 2.0)
                tile_grid_size = clahe_settings.get('tile_grid_size', 8)
                
                # Convert to LAB color space
                lab = cv2.cvtColor(processed_img, cv2.COLOR_BGR2LAB)
                l, a, b = cv2.split(lab)
                
                # Apply CLAHE to L channel
                clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_grid_size, tile_grid_size))
                l = clahe.apply(l)
                
                # Merge channels and convert back
                lab = cv2.merge([l, a, b])
                processed_img = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
            
            # 3. Thresholding
            threshold_settings = settings.get('threshold', {})
            if threshold_settings.get('enabled', False):
                gray = cv2.cvtColor(processed_img, cv2.COLOR_BGR2GRAY)
                thresh_type = threshold_settings.get('type', 'binary')
                thresh_value = threshold_settings.get('value', 127)
                max_value = threshold_settings.get('max_value', 255)
                
                if thresh_type == 'binary':
                    _, thresh = cv2.threshold(gray, thresh_value, max_value, cv2.THRESH_BINARY)
                elif thresh_type == 'binary_inv':
                    _, thresh = cv2.threshold(gray, thresh_value, max_value, cv2.THRESH_BINARY_INV)
                elif thresh_type == 'adaptive_mean':
                    thresh = cv2.adaptiveThreshold(gray, max_value, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 11, 2)
                elif thresh_type == 'adaptive_gaussian':
                    thresh = cv2.adaptiveThreshold(gray, max_value, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2)
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
                    for rho, theta in lines[:10]:  # Use first 10 lines
                        angle = theta * 180 / np.pi
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
            
            # 5. Morphological operations
            morph_settings = settings.get('morphology', {})
            if morph_settings.get('enabled', False):
                operation = morph_settings.get('operation', 'opening')
                kernel_size = morph_settings.get('kernel_size', 3)
                iterations = morph_settings.get('iterations', 1)
                
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
                strength = denoise_settings.get('strength', 10)
                processed_img = cv2.fastNlMeansDenoisingColored(processed_img, None, strength, strength, 7, 21)
            
            # 7. Sharpening
            sharpen_settings = settings.get('sharpen', {})
            if sharpen_settings.get('enabled', False):
                strength = sharpen_settings.get('strength', 1.0)
                kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]]) * strength
                processed_img = cv2.filter2D(processed_img, -1, kernel)
            
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
        operation = morph_params.get('operation', 'opening')
        kernel_size = morph_params.get('kernel_size', 3)
        iterations = morph_params.get('iterations', 1)
        
        try:
            kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_size, kernel_size))
            
            if operation == 'opening':
                result = cv2.morphologyEx(img, cv2.MORPH_OPEN, kernel, iterations=iterations)
            elif operation == 'closing':
                result = cv2.morphologyEx(img, cv2.MORPH_CLOSE, kernel, iterations=iterations)
            elif operation == 'erosion':
                result = cv2.erode(img, kernel, iterations=iterations)
            elif operation == 'dilation':
                result = cv2.dilate(img, kernel, iterations=iterations)
            elif operation == 'gradient':
                result = cv2.morphologyEx(img, cv2.MORPH_GRADIENT, kernel, iterations=iterations)
            elif operation == 'tophat':
                result = cv2.morphologyEx(img, cv2.MORPH_TOPHAT, kernel, iterations=iterations)
            elif operation == 'blackhat':
                result = cv2.morphologyEx(img, cv2.MORPH_BLACKHAT, kernel, iterations=iterations)
            else:
                result = img
                
            return result
        except Exception as e:
            print(f"Morphology error: {e}")
            return img
    
    def _apply_denoise(self, img: np.ndarray, denoise_params: Dict[str, Any]) -> np.ndarray:
        """Apply noise reduction"""
        strength = denoise_params.get('strength', 10)
        
        try:
            if len(img.shape) == 3:  # Color image
                return cv2.fastNlMeansDenoisingColored(img, None, strength, strength, 7, 21)
            else:  # Grayscale image
                return cv2.fastNlMeansDenoising(img, None, strength, 7, 21)
        except Exception as e:
            print(f"Denoise error: {e}")
            return img
    
    def _apply_sharpen(self, img: np.ndarray, sharpen_params: Dict[str, Any]) -> np.ndarray:
        """Apply sharpening filter"""
        strength = sharpen_params.get('strength', 1.0)
        
        try:
            kernel = np.array([[-1, -1, -1],
                              [-1,  9, -1],
                              [-1, -1, -1]]) * strength
            kernel[1, 1] = kernel[1, 1] - strength + 1
            
            return cv2.filter2D(img, -1, kernel)
        except Exception as e:
            print(f"Sharpen error: {e}")
            return img
    
    def get_image_statistics(self, image_path: str) -> Dict[str, Any]:
        """Get statistics about an image"""
        stats = {
            'width': 0,
            'height': 0,
            'file_size': 0,
            'brightness': 0,
            'contrast': 0,
            'sharpness': 0
        }
        
        try:
            if os.path.exists(image_path):
                stats['file_size'] = os.path.getsize(image_path)
            
            img = cv2.imread(image_path)
            if img is None:
                return stats
            
            height, width = img.shape[:2]
            stats['width'] = width
            stats['height'] = height
            
            if len(img.shape) == 3:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            else:
                gray = img
            
            stats['brightness'] = float(np.mean(gray))
            stats['contrast'] = float(np.std(gray))
            
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            stats['sharpness'] = float(laplacian.var())
            
        except Exception as e:
            print(f"Error calculating image statistics: {e}")
        
        return stats