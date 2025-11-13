import os
from flask import Blueprint, request, jsonify
from models.project import Project
from models.image import Image
from services.file_manager import FileManager

projects_bp = Blueprint('projects', __name__)
file_manager = FileManager()

@projects_bp.route('', methods=['GET'])
def get_projects():
    """Get all projects"""
    try:
        projects = Project.load_all()
        
        # Update statistics for each project
        for project in projects:
            project.update_statistics()
        
        return jsonify({
            'projects': [project.to_dict() for project in projects]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@projects_bp.route('/<project_id>', methods=['GET'])
def get_project(project_id):
    """Get specific project"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        # Update statistics
        project.update_statistics()
        
        # Get project images
        images = Image.load_all_for_project(project_id)
        
        result = project.to_dict()
        result['images'] = [image.to_dict() for image in images]
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@projects_bp.route('', methods=['POST'])
def create_project():
    """Create new project"""
    try:
        data = request.get_json()
        
        name = data.get('name', '').strip()
        if not name:
            return jsonify({'error': 'Project name is required'}), 400
        
        description = data.get('description', '').strip()
        save_path = data.get('save_path', '').strip()
        output_type = data.get('output_type', 'json')
        
        # Create project (no longer using images_path)
        project = Project(name, description, '', save_path, output_type)
        project.save()
        
        result = project.to_dict()
        result['project_id'] = project.id  # Make sure project_id is included
        
        return jsonify(result), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@projects_bp.route('/<project_id>', methods=['PUT'])
def update_project(project_id):
    """Update project"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        data = request.get_json()
        
        # Update project fields
        if 'name' in data:
            project.name = project._sanitize_name(data['name'])
        if 'description' in data:
            project.description = data['description']
        if 'settings' in data:
            project.settings.update(data['settings'])
        
        project.save()
        
        return jsonify(project.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@projects_bp.route('/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete project"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        project.delete()
        
        return jsonify({'message': 'Project deleted successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@projects_bp.route('/<project_id>/load-images', methods=['POST'])
def load_images_from_path(project_id):
    """Load images from specified path"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        data = request.get_json()
        images_path = data.get('images_path', '').strip()
        
        if not images_path:
            return jsonify({'error': 'Images path is required'}), 400
        
        # Validate path first
        validation = file_manager.validate_images_path(images_path)
        if not validation['valid']:
            return jsonify({
                'error': f"Invalid images path: {validation.get('error', 'Unknown error')}"
            }), 400
        
        # Load images
        images = file_manager.copy_images_from_path(project, images_path)
        
        # Update project statistics
        project.update_statistics()
        
        return jsonify({
            'message': f'{len(images)} images loaded successfully',
            'loaded_count': len(images),
            'images': [image.to_dict() for image in images],
            'validation': validation
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@projects_bp.route('/<project_id>/statistics', methods=['GET'])
def get_project_statistics(project_id):
    """Get project statistics"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        project.update_statistics()
        
        # Add additional statistics
        images = Image.load_all_for_project(project_id)
        
        # Calculate storage usage
        storage_info = file_manager.calculate_project_storage_size(project)
        
        # Calculate annotation statistics
        annotation_stats = {
            'total_annotations': sum(len(img.annotations) for img in images),
            'levels': {},
            'labels': {}
        }
        
        for image in images:
            for annotation in image.annotations:
                level = annotation.get('level', 'unknown')
                label = annotation.get('label', 'unlabeled')
                
                annotation_stats['levels'][level] = annotation_stats['levels'].get(level, 0) + 1
                annotation_stats['labels'][label] = annotation_stats['labels'].get(label, 0) + 1
        
        return jsonify({
            **project.statistics,
            'storage': storage_info,
            'annotations': annotation_stats,
            'workflow_state': project.get_workflow_state(),
            'progress_percentage': project.get_progress_percentage()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@projects_bp.route('/<project_id>/validate-path', methods=['POST'])
def validate_images_path(project_id):
    """Validate images path without loading"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        data = request.get_json()
        images_path = data.get('images_path', '').strip()
        
        if not images_path:
            return jsonify({'error': 'Images path is required'}), 400
        
        validation = file_manager.validate_images_path(images_path)
        
        return jsonify(validation)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@projects_bp.route('/<project_id>/backup', methods=['POST'])
def create_project_backup(project_id):
    """Create backup of project"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        backup_path = file_manager.create_backup(project)
        
        return jsonify({
            'message': 'Backup created successfully',
            'backup_path': backup_path,
            'backup_filename': os.path.basename(backup_path)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@projects_bp.route('/restore-backup', methods=['POST'])
def restore_project_backup():
    """Restore project from backup"""
    try:
        if 'backup_file' not in request.files:
            return jsonify({'error': 'No backup file provided'}), 400
        
        backup_file = request.files['backup_file']
        if backup_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Save uploaded file temporarily
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.zip') as temp_file:
            backup_file.save(temp_file.name)
            
            try:
                # Restore project
                project = file_manager.restore_from_backup(temp_file.name)
                
                return jsonify({
                    'message': 'Project restored successfully',
                    'project': project.to_dict()
                })
            finally:
                # Clean up temp file
                os.unlink(temp_file.name)
                
    except Exception as e:
        return jsonify({'error': str(e)}), 500
