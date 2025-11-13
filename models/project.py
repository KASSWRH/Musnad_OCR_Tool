import os
import json
import uuid
import shutil
from datetime import datetime
from typing import Dict, List, Optional

class Project:
    def __init__(self, name: str, description: str = "", images_path: str = "", 
                 save_path: str = "", output_type: str = "json"):
        self.id = str(uuid.uuid4())
        self.name = self._sanitize_name(name)
        self.description = description
        self.images_path = images_path
        self.save_path = save_path
        self.output_type = output_type
        self.created_at = datetime.now().isoformat()
        self.updated_at = datetime.now().isoformat()
        self.settings = {
            'auto_flow_enabled': True,
            'auto_flow_mode': 'process_then_annotate',  # manual, process_then_next, process_then_annotate
            'text_direction': 'rtl',
            'annotation_levels': ['character', 'word', 'line', 'paragraph'],
            'default_confidence': 90,
            'processing_settings': {
                'grayscale': False,
                'illumination': {'enabled': False, 'blur_kernel': 41},
                'shadow_remove': {'enabled': False, 'blur_kernel': 31},
                'clahe': {'enabled': False, 'clip_limit': 2.0, 'tile_grid_size': 8},
                'local_contrast': {'enabled': False, 'method': 'clahe', 'clip_limit': 2.5, 'tile_grid_size': 8},
                'gamma': {'enabled': False, 'value': 1.0},
                'threshold': {'enabled': False, 'type': 'binary', 'value': 127, 'max_value': 255},
                'deskew': {'enabled': False},
                'bilateral': {'enabled': False, 'diameter': 7, 'sigma_color': 50, 'sigma_space': 50},
                'median': {'enabled': False, 'kernel': 3},
                'morphology': {'enabled': False, 'operation': 'opening', 'kernel_size': 3, 'iterations': 1},
                'denoise': {'enabled': False, 'strength': 10},
                'sharpen': {'enabled': False, 'strength': 1.0},
                'edge_enhance': {'enabled': False, 'alpha': 0.3},
                'speck_remove': {'enabled': False, 'max_area': 20},
                'quality': 85  # جودة حفظ الصورة المعالجة
            }
        }
        self.statistics = {
            'total_images': 0,
            'unprocessed_images': 0,
            'processed_images': 0,
            'annotated_images': 0,
            'completed_images': 0
        }
    
    def _sanitize_name(self, name: str) -> str:
        """Sanitize project name for filesystem compatibility"""
        import re
        # Remove or replace problematic characters
        sanitized = re.sub(r'[<>:"/\\|?*]', '_', name)
        sanitized = sanitized.strip()
        return sanitized if sanitized else 'untitled_project'
    
    @property
    def project_folder(self):
        """Get project folder path"""
        return os.path.join('data', f'project_{self.name}_{self.id}')
    
    @property
    def original_images_folder(self):
        """Get original images folder path"""
        return os.path.join(self.project_folder, 'original_images')
    
    @property
    def processed_images_folder(self):
        """Get processed images folder path"""
        return os.path.join(self.project_folder, 'processed_images')
    
    @property
    def annotations_folder(self):
        """Get annotations folder path"""
        return os.path.join(self.project_folder, 'annotations')
    
    @property
    def previews_folder(self):
        """Get previews folder path"""
        return os.path.join(self.original_images_folder, 'previews')
    
    @property
    def metadata_file(self):
        """Get metadata file path"""
        return os.path.join(self.project_folder, 'metadata.json')
    
    def create_folders(self):
        """Create project folder structure"""
        folders = [
            self.project_folder,
            self.original_images_folder,
            self.processed_images_folder,
            self.annotations_folder,
            self.previews_folder  # مجلد المعاينات
        ]
        
        for folder in folders:
            os.makedirs(folder, exist_ok=True)
    
    def save(self):
        """Save project metadata"""
        self.updated_at = datetime.now().isoformat()
        
        # التحقق من صحة وضع التدفق التلقائي
        valid_modes = ['manual', 'process_then_annotate', 'process_then_next']
        if self.settings.get('auto_flow_mode') not in valid_modes:
            self.settings['auto_flow_mode'] = 'manual'
        
        # Create folders if they don't exist
        self.create_folders()
        
        # Save metadata
        metadata = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'images_path': self.images_path,
            'save_path': self.save_path,
            'output_type': self.output_type,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'settings': self.settings,
            'statistics': self.statistics
        }
        
        with open(self.metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
    
    @classmethod
    def load(cls, project_id: str) -> Optional['Project']:
        """Load project from metadata"""
        # Find project folder
        data_dir = 'data'
        if not os.path.exists(data_dir):
            return None
        
        for folder_name in os.listdir(data_dir):
            if folder_name.startswith('project_') and folder_name.endswith(f'_{project_id}'):
                metadata_file = os.path.join(data_dir, folder_name, 'metadata.json')
                if os.path.exists(metadata_file):
                    try:
                        with open(metadata_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        
                        project = cls(
                            name=data['name'],
                            description=data.get('description', ''),
                            images_path=data.get('images_path', ''),
                            save_path=data.get('save_path', ''),
                            output_type=data.get('output_type', 'json')
                        )
                        
                        project.id = data['id']
                        project.created_at = data['created_at']
                        project.updated_at = data['updated_at']
                        project.settings = data.get('settings', project.settings)
                        project.statistics = data.get('statistics', project.statistics)
                        
                        return project
                    except Exception as e:
                        print(f"Error loading project from {folder_name}: {e}")
        
        return None
    
    @classmethod
    def load_all(cls) -> List['Project']:
        """Load all projects"""
        projects = []
        data_dir = 'data'
        
        if not os.path.exists(data_dir):
            return projects
        
        for folder_name in os.listdir(data_dir):
            if folder_name.startswith('project_'):
                metadata_file = os.path.join(data_dir, folder_name, 'metadata.json')
                if os.path.exists(metadata_file):
                    try:
                        with open(metadata_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                        
                        project = cls(
                            name=data['name'],
                            description=data.get('description', ''),
                            images_path=data.get('images_path', ''),
                            save_path=data.get('save_path', ''),
                            output_type=data.get('output_type', 'json')
                        )
                        
                        project.id = data['id']
                        project.created_at = data['created_at']
                        project.updated_at = data['updated_at']
                        project.settings = data.get('settings', project.settings)
                        project.statistics = data.get('statistics', project.statistics)
                        
                        projects.append(project)
                    except Exception as e:
                        print(f"Error loading project from {folder_name}: {e}")
        
        # Sort by creation date (newest first)
        projects.sort(key=lambda x: x.created_at, reverse=True)
        return projects
    
    def delete(self):
        """Delete project and all associated files"""
        if os.path.exists(self.project_folder):
            shutil.rmtree(self.project_folder)
    
    def update_statistics(self):
        """Update project statistics based on current images"""
        from models.image import Image
        images = Image.load_all_for_project(self.id)
        
        # إحصائيات محسنة تتحقق من وجود الملفات الفعلية
        processed_with_files = 0
        for img in images:
            if img.status in ['processed', 'annotated', 'completed'] and os.path.exists(img.processed_image_path):
                processed_with_files += 1
        
        self.statistics = {
            'total_images': len(images),
            'unprocessed_images': len([img for img in images if img.status == 'unprocessed']),
            'processed_images': len([img for img in images if img.status == 'processed']),
            'annotated_images': len([img for img in images if img.status == 'annotated']),
            'completed_images': len([img for img in images if img.status == 'completed']),
            'processed_files_count': processed_with_files  # عدد الملفات المعالجة الموجودة فعلياً
        }
        
        self.save()
    
    def get_progress_percentage(self):
        """Calculate overall progress percentage"""
        if self.statistics['total_images'] == 0:
            return 0
        return round((self.statistics['completed_images'] / self.statistics['total_images']) * 100)
    
    def get_workflow_state(self):
        """Determine current workflow state"""
        if self.statistics['unprocessed_images'] > 0:
            return 'processing'
        elif self.statistics['processed_images'] > 0:
            return 'annotation'
        elif self.statistics['annotated_images'] > 0 or self.statistics['completed_images'] > 0:
            return 'complete'
        else:
            return 'empty'
    
    def copy_images_from_path(self, images_path: str) -> int:
        """Copy images from external path to project folder"""
        if not os.path.exists(images_path):
            return 0
        
        from services.file_manager import FileManager
        file_manager = FileManager()
        images = file_manager.copy_images_from_path(self, images_path)
        
        # Update statistics
        self.update_statistics()
        
        return len(images)
    
    def to_dict(self):
        """Convert project to dictionary"""
        return {
            'id': self.id,
            'project_id': self.id,  # Include project_id for compatibility
            'name': self.name,
            'description': self.description,
            'images_path': self.images_path,
            'save_path': self.save_path,
            'output_type': self.output_type,
            'created_at': self.created_at,
            'updated_at': self.updated_at,
            'settings': self.settings,
            'statistics': self.statistics,
            'progress_percentage': self.get_progress_percentage(),
            'workflow_state': self.get_workflow_state()
        }
