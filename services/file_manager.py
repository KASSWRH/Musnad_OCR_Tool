import datetime
import json
import os
import shutil
from PIL import Image as PILImage
from typing import List
from models.project import Project
from models.image import Image

class FileManager:
    def __init__(self):
        self.supported_formats = ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp', '.bmp']
    
    def copy_images_from_path(self, project: Project, images_path: str) -> List[Image]:
        """Copy images from specified path to project folder"""
        if not os.path.exists(images_path):
            raise FileNotFoundError(f"Images path does not exist: {images_path}")
        
        images = []
        
        # Ensure project folders exist
        project.create_folders()
        
        # Get list of supported image files
        image_files = []
        for filename in os.listdir(images_path):
            file_ext = os.path.splitext(filename)[1].lower()
            if file_ext in self.supported_formats:
                image_files.append(filename)
        
        # Sort files for consistent ordering
        image_files.sort()
        
        for filename in image_files:
            source_path = os.path.join(images_path, filename)
            
            try:
                # Create new image record with sanitized filename
                safe_filename = self._sanitize_filename(filename)
                image = Image(project.id, safe_filename, source_path)
                
                # Copy image to project folder
                if image.copy_from_external_path(source_path):
                    images.append(image)
                else:
                    print(f"Failed to copy image: {filename}")
                    
            except Exception as e:
                print(f"Error processing image {filename}: {e}")
                continue
        
        return images

    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename to be filesystem safe"""
        import re
        # Remove problematic characters
        sanitized = re.sub(r'[<>:"/\\|?*]', '_', filename)
        # Remove non-ASCII characters
        sanitized = re.sub(r'[^\x00-\x7F]+', '_', sanitized)
        return sanitized
    def generate_thumbnail(self, source_path: str, thumbnail_path: str, max_size: tuple = (300, 300)) -> bool:
        """Generate thumbnail for image"""
        try:
            with PILImage.open(source_path) as img:
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'P'):
                    img = img.convert('RGB')
                
                # Calculate new size maintaining aspect ratio
                img.thumbnail(max_size, PILImage.Resampling.LANCZOS)
                img.save(thumbnail_path, 'JPEG', quality=85)
                return True
        except Exception as e:
            print(f"Error generating thumbnail: {e}")
            return False
    
    def save_processed_image(self, image: Image, processed_image_data) -> bool:
        """Save processed image data"""
        try:
            import cv2
            cv2.imwrite(image.processed_image_path, processed_image_data)
            
            # Update image status to processed
            image.update_status('processed')
            
            return True
        except Exception as e:
            print(f"Error saving processed image: {e}")
            return False
    
    def get_image_data(self, image_path: str):
        """Get image data for serving"""
        if os.path.exists(image_path):
            with open(image_path, 'rb') as f:
                return f.read()
        return None
    
    def cleanup_project(self, project: Project):
        """Clean up all project files"""
        if os.path.exists(project.project_folder):
            shutil.rmtree(project.project_folder)
    
    def get_next_unprocessed_image(self, project_id: str) -> Image:
        """Get next unprocessed image for auto-flow"""
        images = Image.load_all_for_project(project_id)
        for image in images:
            if image.status == 'unprocessed':
                return image
        return None
    
    def get_next_unannotated_image(self, project_id: str) -> Image:
        """Get next processed but unannotated image for auto-flow"""
        images = Image.load_all_for_project(project_id)
        for image in images:
            if image.status == 'processed':
                return image
        return None
    
    def get_images_by_status(self, project_id: str, status: str) -> List[Image]:
        """Get all images with specific status"""
        images = Image.load_all_for_project(project_id)
        return [img for img in images if img.status == status]
    
    def get_images_for_workflow(self, project_id: str, workflow: str) -> List[Image]:
        """Get images appropriate for specific workflow"""
        if workflow == 'processing':
            return self.get_images_by_status(project_id, 'unprocessed')
        elif workflow == 'annotation':
            return self.get_images_by_status(project_id, 'processed')
        elif workflow == 'review':
            annotated = self.get_images_by_status(project_id, 'annotated')
            completed = self.get_images_by_status(project_id, 'completed')
            return annotated + completed
        else:
            return []
    
    def calculate_project_storage_size(self, project: Project) -> dict:
        """Calculate storage usage for project"""
        sizes = {
            'original_images': 0,
            'processed_images': 0,
            'thumbnails': 0,
            'annotations': 0,
            'total': 0
        }
        
        if not os.path.exists(project.project_folder):
            return sizes
        
        # Calculate sizes for each folder
        folders = {
            'original_images': project.original_images_folder,
            'processed_images': project.processed_images_folder,
            'annotations': project.annotations_folder
        }
        
        for folder_name, folder_path in folders.items():
            if os.path.exists(folder_path):
                for filename in os.listdir(folder_path):
                    file_path = os.path.join(folder_path, filename)
                    if os.path.isfile(file_path):
                        file_size = os.path.getsize(file_path)
                        
                        if folder_name == 'original_images' and filename.endswith('_thumb.jpg'):
                            sizes['thumbnails'] += file_size
                        else:
                            sizes[folder_name] += file_size
        
        sizes['total'] = sum(sizes.values())
        
        # Convert to MB
        for key in sizes:
            sizes[key] = round(sizes[key] / (1024 * 1024), 2)
        
        return sizes
    
    def validate_images_path(self, images_path: str) -> dict:
        """Validate images path and return information"""
        result = {
            'valid': False,
            'exists': False,
            'readable': False,
            'image_count': 0,
            'supported_formats': self.supported_formats,
            'found_formats': [],
            'sample_files': []
        }
        
        if not images_path:
            result['error'] = 'Path is empty'
            return result
        
        if not os.path.exists(images_path):
            result['error'] = 'Path does not exist'
            return result
        
        result['exists'] = True
        
        if not os.access(images_path, os.R_OK):
            result['error'] = 'Path is not readable'
            return result
        
        result['readable'] = True
        
        try:
            files = os.listdir(images_path)
            image_files = []
            found_formats = set()
            
            for filename in files:
                file_ext = os.path.splitext(filename)[1].lower()
                if file_ext in self.supported_formats:
                    image_files.append(filename)
                    found_formats.add(file_ext)
            
            result['image_count'] = len(image_files)
            result['found_formats'] = list(found_formats)
            result['sample_files'] = image_files[:5]  # First 5 files as samples
            result['valid'] = len(image_files) > 0
            
            if len(image_files) == 0:
                result['error'] = 'No supported image files found'
            
        except Exception as e:
            result['error'] = f'Error reading directory: {str(e)}'
        
        return result
    
    def create_backup(self, project: Project, backup_path: str = None) -> str:
        """Create backup of project"""
        if backup_path is None:
            backup_path = os.path.join('exports', f'backup_{project.name}_{project.id}_{int(datetime.now().timestamp())}.zip')
        
        import zipfile
        
        os.makedirs(os.path.dirname(backup_path), exist_ok=True)
        
        with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(project.project_folder):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, project.project_folder)
                    zipf.write(file_path, arcname)
        
        return backup_path
    
    def restore_from_backup(self, backup_path: str, project_id: str = None) -> Project:
        """Restore project from backup"""
        import zipfile
        import tempfile
        
        if not os.path.exists(backup_path):
            raise FileNotFoundError(f"Backup file not found: {backup_path}")
        
        # Create temporary directory
        with tempfile.TemporaryDirectory() as temp_dir:
            # Extract backup
            with zipfile.ZipFile(backup_path, 'r') as zipf:
                zipf.extractall(temp_dir)
            
            # Load project metadata
            metadata_file = os.path.join(temp_dir, 'metadata.json')
            if not os.path.exists(metadata_file):
                raise ValueError("Invalid backup: metadata.json not found")
            
            with open(metadata_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Create new project instance
            project = Project(
                name=data['name'],
                description=data.get('description', ''),
                images_path=data.get('images_path', ''),
                save_path=data.get('save_path', ''),
                output_type=data.get('output_type', 'json')
            )
            
            # Restore original ID if not specified
            if project_id is None:
                project.id = data['id']
            else:
                project.id = project_id
            
            project.created_at = data['created_at']
            project.updated_at = data['updated_at']
            project.settings = data.get('settings', project.settings)
            project.statistics = data.get('statistics', project.statistics)
            
            # Create project folders
            project.create_folders()
            
            # Copy files from backup
            for root, dirs, files in os.walk(temp_dir):
                for file in files:
                    src_path = os.path.join(root, file)
                    rel_path = os.path.relpath(src_path, temp_dir)
                    dst_path = os.path.join(project.project_folder, rel_path)
                    
                    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
                    shutil.copy2(src_path, dst_path)
            
            return project
