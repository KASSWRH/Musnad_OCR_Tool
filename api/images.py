from datetime import datetime
from flask import Blueprint, request, jsonify, send_file
from models.project import Project
from models.image import Image
from services.file_manager import FileManager
import os
import mimetypes

images_bp = Blueprint('images', __name__)
file_manager = FileManager()

def get_image_mimetype(file_path):
    """Get MIME type for image file"""
    if not os.path.exists(file_path):
        return 'image/jpeg'  # default fallback
    
    # Try to guess from file extension
    mime_type, _ = mimetypes.guess_type(file_path)
    if mime_type and mime_type.startswith('image/'):
        return mime_type
    
    # Fallback to common image types based on extension
    ext = os.path.splitext(file_path)[1].lower()
    mime_map = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.webp': 'image/webp',
        '.tiff': 'image/tiff',
        '.tif': 'image/tiff'
    }
    return mime_map.get(ext, 'image/jpeg')

@images_bp.route('/<project_id>', methods=['GET'])
def get_project_images(project_id):
    """Get all images for a project with optional filtering"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        # Get filter parameters
        status_filter = request.args.get('status')
        workflow = request.args.get('workflow')  # processing, annotation, review
        
        images = Image.load_all_for_project(project_id)
        
        # Apply filters
        if workflow:
            # Filter by workflow type
            if workflow == 'processing':
                images = [img for img in images if img.status == 'unprocessed']
            elif workflow == 'annotation':
                images = [img for img in images if img.status == 'processed']
            elif workflow == 'review':
                images = [img for img in images if img.status in ['annotated', 'completed']]
        elif status_filter:
            # Filter by specific status
            images = [img for img in images if img.status == status_filter]
        
        return jsonify({
            'images': [image.to_dict() for image in images],
            'total_count': len(Image.load_all_for_project(project_id)),
            'filtered_count': len(images)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@images_bp.route('/<project_id>/<image_id>', methods=['GET'])
def get_image(project_id, image_id):
    """Get specific image details"""
    try:
        image = Image.load(project_id, image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404
        
        include_annotations = request.args.get('include_annotations', 'false').lower() == 'true'
        
        return jsonify(image.to_dict(include_annotations=include_annotations))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@images_bp.route('/<project_id>/<image_id>/original', methods=['GET'])
def serve_original_image(project_id, image_id):
    """Serve original image file"""
    try:
        image = Image.load(project_id, image_id)
        if not image or not os.path.exists(image.original_image_path):
            return jsonify({'error': 'Original image not found'}), 404
        
        mimetype = get_image_mimetype(image.original_image_path)
        return send_file(image.original_image_path, mimetype=mimetype)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@images_bp.route('/<project_id>/<image_id>/processed', methods=['GET'])
def serve_processed_image(project_id, image_id):
    """Serve processed image file"""
    try:
        image = Image.load(project_id, image_id)
        if not image or not os.path.exists(image.processed_image_path):
            return jsonify({'error': 'Processed image not found'}), 404
        
        mimetype = get_image_mimetype(image.processed_image_path)
        return send_file(image.processed_image_path, mimetype=mimetype)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@images_bp.route('/<project_id>/<image_id>/thumbnail', methods=['GET'])
def serve_thumbnail(project_id, image_id):
    """Serve image thumbnail"""
    try:
        image = Image.load(project_id, image_id)
        if not image or not os.path.exists(image.thumbnail_path):
            return jsonify({'error': 'Thumbnail not found'}), 404
        
        return send_file(image.thumbnail_path, mimetype='image/jpeg')  # thumbnails are always JPEG
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@images_bp.route('/<project_id>/<image_id>/preview', methods=['GET'])
def serve_preview_image(project_id, image_id):
    """Serve processing preview image"""
    try:
        image = Image.load(project_id, image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404
        
        # البحث عن المعاينات المولدة في مجلد المعاينات المخصص
        from models.project import Project
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        previews_dir = project.previews_folder
        if not os.path.exists(previews_dir):
            return jsonify({'error': 'Preview not found'}), 404
        
        # البحث عن أحدث معاينة لهذه الصورة
        candidates = [
            f for f in os.listdir(previews_dir)
            if f.startswith(f"{image.id}_preview_") and f.lower().endswith('.jpg')
        ]
        if not candidates:
            return jsonify({'error': 'Preview not found'}), 404
        
        # اختيار الأحدث حسب وقت التعديل
        candidates_paths = [os.path.join(previews_dir, f) for f in candidates]
        latest_path = max(candidates_paths, key=os.path.getmtime)
        
        return send_file(latest_path, mimetype='image/jpeg')  # previews are always JPEG
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@images_bp.route('/<project_id>/<image_id>/status', methods=['PUT'])
def update_image_status(project_id, image_id):
    """Update image status"""
    try:
        image = Image.load(project_id, image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404
        
        data = request.get_json()
        new_status = data.get('status')
        
        if new_status not in ['unprocessed', 'processed', 'annotated', 'completed']:
            return jsonify({'error': 'Invalid status'}), 400
        
        image.update_status(new_status)
        
        return jsonify({
            'message': 'Status updated successfully',
            'image': image.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@images_bp.route('/<project_id>/next', methods=['GET'])
def get_next_image(project_id):
    """Get next image based on workflow status"""
    try:
        workflow = request.args.get('workflow', 'processing')  # processing or annotation
        
        if workflow == 'processing':
            image = file_manager.get_next_unprocessed_image(project_id)
            message = 'No more unprocessed images'
        elif workflow == 'annotation':
            image = file_manager.get_next_unannotated_image(project_id)
            message = 'No more images for annotation'
        else:
            return jsonify({'error': 'Invalid workflow'}), 400
        
        if not image:
            return jsonify({'message': message, 'next_image': None})
        
        return jsonify({
            'message': 'Next image found',
            'next_image': image.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@images_bp.route('/<project_id>/upload', methods=['POST'])
def upload_images(project_id):
    """Upload images to project"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        # Support both 'files' and 'image' field names
        files = []
        if 'files' in request.files:
            files = request.files.getlist('files')
        elif 'image' in request.files:
            files = request.files.getlist('image')
        
        if not files:
            return jsonify({'error': 'No files provided'}), 400
        uploaded_images = []
        errors = []
        
        for file in files:
            if file and file.filename:
                try:
                    # Save uploaded file temporarily
                    import tempfile
                    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
                        file.save(temp_file.name)
                        
                        # Create image record
                        image = Image(project_id, file.filename, temp_file.name)
                        
                        # Copy to project folder
                        if image.copy_from_external_path(temp_file.name):
                            uploaded_images.append(image)
                        else:
                            errors.append(f"Failed to copy {file.filename}")
                        
                        # Clean up temp file
                        os.unlink(temp_file.name)
                        
                except Exception as e:
                    errors.append(f"Error processing {file.filename}: {str(e)}")
        
        # Update project statistics
        project.update_statistics()
        
        result = {
            'message': f'{len(uploaded_images)} images uploaded successfully',
            'uploaded_count': len(uploaded_images),
            'error_count': len(errors),
            'images': [img.to_dict() for img in uploaded_images]
        }
        
        if errors:
            result['errors'] = errors
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@images_bp.route('/<project_id>/<image_id>/duplicate', methods=['POST'])
def duplicate_image(project_id, image_id):
    """Create duplicate of image with annotations"""
    try:
        original_image = Image.load(project_id, image_id)
        if not original_image:
            return jsonify({'error': 'Image not found'}), 404
        
        # Create new image instance
        duplicate = Image(project_id, f"copy_of_{original_image.filename}", original_image.original_path)
        
        # Copy image files
        import shutil
        if os.path.exists(original_image.original_image_path):
            shutil.copy2(original_image.original_image_path, duplicate.original_image_path)
        if os.path.exists(original_image.processed_image_path):
            shutil.copy2(original_image.processed_image_path, duplicate.processed_image_path)
        if os.path.exists(original_image.thumbnail_path):
            shutil.copy2(original_image.thumbnail_path, duplicate.thumbnail_path)
        
        # Copy metadata
        duplicate.width = original_image.width
        duplicate.height = original_image.height
        duplicate.file_size = original_image.file_size
        duplicate.status = original_image.status
        duplicate.processing_settings = original_image.processing_settings.copy()
        duplicate.annotations = [ann.copy() for ann in original_image.annotations]
        
        # Generate new IDs for annotations
        import uuid
        for annotation in duplicate.annotations:
            annotation['id'] = str(uuid.uuid4())
            annotation['created_at'] = datetime.now().isoformat()
        
        duplicate.save()
        
        # Update project statistics
        project = Project.load(project_id)
        if project:
            project.update_statistics()
        
        return jsonify({
            'message': 'Image duplicated successfully',
            'original_image': original_image.to_dict(),
            'duplicate_image': duplicate.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@images_bp.route('/<project_id>/<image_id>', methods=['DELETE'])
def delete_image(project_id, image_id):
    """Delete image and all associated files"""
    try:
        image = Image.load(project_id, image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404
        
        # Delete image files
        files_to_delete = [
            image.original_image_path,
            image.processed_image_path,
            image.thumbnail_path,
            image.annotations_file
        ]
        
        for file_path in files_to_delete:
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                except Exception as e:
                    print(f"Warning: Failed to delete {file_path}: {e}")
        
        # Update project statistics
        project = Project.load(project_id)
        if project:
            project.update_statistics()
        
        return jsonify({'message': 'Image deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@images_bp.route('/<project_id>/batch-status', methods=['PUT'])
def batch_update_status(project_id):
    """Update status for multiple images"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        data = request.get_json()
        image_ids = data.get('image_ids', [])
        new_status = data.get('status')
        
        if new_status not in ['unprocessed', 'processed', 'annotated', 'completed']:
            return jsonify({'error': 'Invalid status'}), 400
        
        updated_count = 0
        errors = []
        
        for image_id in image_ids:
            try:
                image = Image.load(project_id, image_id)
                if image:
                    image.update_status(new_status)
                    updated_count += 1
                else:
                    errors.append(f"Image {image_id} not found")
            except Exception as e:
                errors.append(f"Error updating {image_id}: {str(e)}")
        
        # Update project statistics
        project.update_statistics()
        
        result = {
            'message': f'{updated_count} images updated successfully',
            'updated_count': updated_count,
            'error_count': len(errors)
        }
        
        if errors:
            result['errors'] = errors
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@images_bp.route('/<project_id>/statistics', methods=['GET'])
def get_images_statistics(project_id):
    """Get detailed statistics about project images"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        images = Image.load_all_for_project(project_id)
        
        # Calculate various statistics
        total_size = sum(img.file_size for img in images)
        avg_size = total_size / len(images) if images else 0
        
        # Resolution statistics
        resolutions = [(img.width, img.height) for img in images if img.width > 0 and img.height > 0]
        unique_resolutions = list(set(resolutions))
        
        # File format statistics
        formats = {}
        for image in images:
            ext = os.path.splitext(image.filename)[1].lower()
            formats[ext] = formats.get(ext, 0) + 1
        
        return jsonify({
            'total_images': len(images),
            'total_size_mb': round(total_size / (1024 * 1024), 2),
            'average_size_mb': round(avg_size / (1024 * 1024), 2),
            'unique_resolutions': len(unique_resolutions),
            'most_common_resolution': max(set(resolutions), key=resolutions.count) if resolutions else None,
            'file_formats': formats,
            'status_distribution': {
                'unprocessed': len([img for img in images if img.status == 'unprocessed']),
                'processed': len([img for img in images if img.status == 'processed']),
                'annotated': len([img for img in images if img.status == 'annotated']),
                'completed': len([img for img in images if img.status == 'completed'])
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@images_bp.route('/<project_id>/preview/<preview_filename>', methods=['GET'])
def serve_generated_preview(project_id, preview_filename):
    """Serve generated preview image file"""
    try:
        print(f"Serving preview: {preview_filename} for project: {project_id}")
        
        from models.project import Project
        project = Project.load(project_id)
        if not project:
            error_msg = f"Project not found: {project_id}"
            print(error_msg)
            return jsonify({'error': error_msg}), 404
        
        # المسار الصحيح للمعاينات
        previews_dir = os.path.join(project.project_folder, 'original_images', 'previews')
        preview_path = os.path.join(previews_dir, preview_filename)
        
        print(f"Looking for preview at: {preview_path}")
        
        if not os.path.exists(preview_path):
            error_msg = f"Preview not found: {preview_path}"
            print(error_msg)
            return jsonify({'error': error_msg}), 404
        
        print("Preview found, sending file...")
        return send_file(preview_path, mimetype='image/jpeg')
        
    except Exception as e:
        error_msg = f"Error serving preview: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500