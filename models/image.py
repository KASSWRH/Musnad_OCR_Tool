import os
import json
import uuid
import shutil
from datetime import datetime
from typing import List, Optional, Dict, Any
from PIL import Image as PILImage

class Image:
    def __init__(self, project_id: str, filename: str, original_path: str = ""):
        self.id = str(uuid.uuid4())
        self.project_id = project_id
        self.filename = filename
        self.original_path = original_path
        self.status = 'unprocessed'  # unprocessed, processed, annotated, completed
        self.width = 0
        self.height = 0
        self.file_size = 0
        self.created_at = datetime.now().isoformat()
        self.updated_at = datetime.now().isoformat()
        self.processing_settings = {}
        self.annotations = []
    
    @property
    def project_folder(self):
        """Get project folder from project_id"""
        from models.project import Project
        project = Project.load(self.project_id)
        return project.project_folder if project else None
    
    @property
    def original_image_path(self):
        """Get original image file path"""
        project_folder = self.project_folder
        if not project_folder:
            return None
        
        # ابحث عن أي ملف صورة يحمل نفس ID
        original_images_dir = os.path.join(project_folder, 'original_images')
        if os.path.exists(original_images_dir):
            for file in os.listdir(original_images_dir):
                if file.startswith(self.id) and file.lower().endswith(('.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp', '.bmp')):
                    return os.path.join(original_images_dir, file)
        
        # إذا لم يتم العثور على ملف، أنشئ مساراً افتراضياً
        return os.path.join(project_folder, 'original_images', f"{self.id}.jpg")
    @property
    def processed_image_path(self):
        """Get processed image file path"""
        project_folder = self.project_folder
        if project_folder:
            return os.path.join(project_folder, 'processed_images', f"{self.id}.jpg")
        return None
    
    @property
    def thumbnail_path(self):
        """Get thumbnail file path"""
        project_folder = self.project_folder
        if project_folder:
            return os.path.join(project_folder, 'original_images', f"{self.id}_thumb.jpg")
        return None
    
    @property
    def annotations_file(self):
        """Get annotations file path"""
        project_folder = self.project_folder
        if project_folder:
            return os.path.join(project_folder, 'annotations', f"{self.id}.json")
        return None
    
    def save(self):
        """Save image metadata"""
        self.updated_at = datetime.now().isoformat()
        
        if not self.annotations_file:
            return False
        
        # Ensure annotations directory exists
        os.makedirs(os.path.dirname(self.annotations_file), exist_ok=True)
        
        # Save image metadata and annotations
        data = {
            'id': self.id,
            'project_id': self.project_id,
            'filename': self.filename,
            'original_path': self.original_path,
            'status': self.status,
            'width': self.width,
            'height': self.height,
            'file_size': self.file_size,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'processing_settings': self.processing_settings,
            'annotations': self.annotations
        }
        
        with open(self.annotations_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return True
    
    @classmethod
    def load(cls, project_id: str, image_id: str) -> Optional['Image']:
        """Load specific image"""
        from models.project import Project
        project = Project.load(project_id)
        if not project:
            return None
        
        annotations_file = os.path.join(project.annotations_folder, f"{image_id}.json")
        
        if not os.path.exists(annotations_file):
            return None
        
        try:
            with open(annotations_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            image = cls(
                project_id=data['project_id'],
                filename=data['filename'],
                original_path=data.get('original_path', '')
            )
            
            image.id = data['id']
            image.status = data.get('status', 'unprocessed')
            image.width = data.get('width', 0)
            image.height = data.get('height', 0)
            image.file_size = data.get('file_size', 0)
            image.created_at = data['created_at']
            image.updated_at = data['updated_at']
            image.processing_settings = data.get('processing_settings', {})
            image.annotations = data.get('annotations', [])
            
            return image
        except Exception as e:
            print(f"Error loading image {image_id}: {e}")
            return None
    
    @classmethod
    def load_all_for_project(cls, project_id: str) -> List['Image']:
        """Load all images for a project"""
        from models.project import Project
        project = Project.load(project_id)
        if not project:
            return []
        
        images = []
        annotations_folder = project.annotations_folder
        
        if not os.path.exists(annotations_folder):
            return images
        
        for filename in os.listdir(annotations_folder):
            if filename.endswith('.json'):
                image_id = filename[:-5]  # Remove .json extension
                image = cls.load(project_id, image_id)
                if image:
                    images.append(image)
        
        # Sort by created_at
        images.sort(key=lambda x: x.created_at)
        return images
    
    def update_status(self, new_status: str):
        """Update image status and save"""
        valid_statuses = ['unprocessed', 'processed', 'annotated', 'completed']
        if new_status not in valid_statuses:
            raise ValueError(f"Invalid status: {new_status}")
        
        self.status = new_status
        self.save()
        
        # Update project statistics
        from models.project import Project
        project = Project.load(self.project_id)
        if project:
            project.update_statistics()
    
    def add_annotation(self, annotation: Dict[str, Any]):
        """Add annotation to image"""
        annotation['id'] = str(uuid.uuid4())
        annotation['created_at'] = datetime.now().isoformat()
        self.annotations.append(annotation)
        
        # Update status to annotated if not already completed
        if self.status == 'processed':
            self.status = 'annotated'
        
        self.save()
    
    def update_annotation(self, annotation_id: str, annotation_data: Dict[str, Any]):
        """Update specific annotation"""
        for i, annotation in enumerate(self.annotations):
            if annotation.get('id') == annotation_id:
                annotation.update(annotation_data)
                annotation['updated_at'] = datetime.now().isoformat()
                self.annotations[i] = annotation
                self.save()
                return True
        return False
    
    def delete_annotation(self, annotation_id: str):
        """Delete specific annotation"""
        original_count = len(self.annotations)
        self.annotations = [ann for ann in self.annotations if ann.get('id') != annotation_id]
        
        # Update status if no annotations left
        if len(self.annotations) == 0 and original_count > 0:
            if self.status in ['annotated', 'completed']:
                self.status = 'processed'
        
        self.save()
        return len(self.annotations) != original_count
    
    def get_display_image_path(self):
        """Get the image path for display (processed if available, otherwise original)"""
        # عرض الصورة المعالجة متى ما كانت موجودة لتجنب العودة للأصلية بسبب تأخير تحديث الحالة
        if os.path.exists(self.processed_image_path):
            return f"/api/images/{self.project_id}/{self.id}/processed"
        elif os.path.exists(self.original_image_path):
            return f"/api/images/{self.project_id}/{self.id}/original"
        return None
    
    def get_thumbnail_path(self):
        """Get thumbnail path for display"""
        if os.path.exists(self.thumbnail_path):
            return f"/api/images/{self.project_id}/{self.id}/thumbnail"
        return self.get_display_image_path()
    
    def copy_from_external_path(self, external_path: str):
        """Copy image from external path to project folder and convert to JPEG"""
        if not os.path.exists(external_path):
            return False
        
        try:
            # Ensure destination directory exists
            dest_path = self.original_image_path
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            
            # Open and convert image to JPEG format
            with PILImage.open(external_path) as pil_img:
                # Convert to RGB if necessary (for PNG with transparency, etc.)
                if pil_img.mode in ('RGBA', 'P', 'LA'):
                    # Create white background for transparency
                    rgb_img = PILImage.new('RGB', pil_img.size, (255, 255, 255))
                    if pil_img.mode == 'P':
                        pil_img = pil_img.convert('RGBA')
                    rgb_img.paste(pil_img, mask=pil_img.split()[-1] if pil_img.mode in ('RGBA', 'LA') else None)
                    pil_img = rgb_img
                elif pil_img.mode != 'RGB':
                    pil_img = pil_img.convert('RGB')
                
                # Store image dimensions
                self.width = pil_img.width
                self.height = pil_img.height
                
                # Save as JPEG with high quality
                pil_img.save(dest_path, 'JPEG', quality=95, optimize=True)
            
            # Get file size after conversion
            self.file_size = os.path.getsize(dest_path)
            
            # Generate thumbnail
            self._generate_thumbnail()
            
            # Save metadata
            self.save()
            
            return True
        except Exception as e:
            print(f"Error copying and converting image from {external_path}: {e}")
            return False
    
    def _generate_thumbnail(self, max_size: tuple = (300, 300)):
        """Generate thumbnail for image"""
        try:
            if not os.path.exists(self.original_image_path):
                return False
            
            with PILImage.open(self.original_image_path) as img:
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                
                # Calculate new size maintaining aspect ratio
                img.thumbnail(max_size, PILImage.Resampling.LANCZOS)
                img.save(self.thumbnail_path, 'JPEG', quality=85)
                return True
        except Exception as e:
            print(f"Error generating thumbnail: {e}")
            return False
    
    def get_annotation_count_by_level(self):
        """Get count of annotations by level"""
        counts = {}
        for annotation in self.annotations:
            level = annotation.get('level', 'unknown')
            counts[level] = counts.get(level, 0) + 1
        return counts
    
    def get_file_size_mb(self):
        """Get file size in MB"""
        if self.file_size > 0:
            return round(self.file_size / (1024 * 1024), 2)
        return 0
    
    def is_ready_for_annotation(self):
        """Check if image is ready for annotation (processed but not completed)"""
        # جاهز للترسيم إذا كان الملف المعالج موجود والحالة مناسبة
        return os.path.exists(self.processed_image_path) and self.status in ['processed', 'annotated']
    
    def is_annotation_complete(self):
        """Check if image annotation is complete"""
        return self.status in ['annotated', 'completed'] and len(self.annotations) > 0
    
    def to_dict(self, include_annotations: bool = False):
        """Convert image to dictionary"""
        data = {
            'id': self.id,
            'project_id': self.project_id,
            'filename': self.filename,
            'original_path': self.original_path,
            'status': self.status,
            'width': self.width,
            'height': self.height,
            'file_size': self.file_size,
            'file_size_mb': self.get_file_size_mb(),
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'processing_settings': self.processing_settings,
            'annotations_count': len(self.annotations),
            'annotation_levels': self.get_annotation_count_by_level(),
            'display_path': self.get_display_image_path(),
            'thumbnail_path': self.get_thumbnail_path(),
            'ready_for_annotation': self.is_ready_for_annotation(),
            'annotation_complete': self.is_annotation_complete()
        }
        
        if include_annotations:
            data['annotations'] = self.annotations
        
        return data
