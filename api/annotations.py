from flask import Blueprint, request, jsonify
from models.project import Project
from models.image import Image
from services.file_manager import FileManager

annotations_bp = Blueprint('annotations', __name__)
file_manager = FileManager()

@annotations_bp.route('/<project_id>/<image_id>', methods=['GET'])
def get_image_annotations(project_id, image_id):
    """Get annotations for specific image"""
    try:
        image = Image.load(project_id, image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404
        
        return jsonify({
            'annotations': image.annotations,
            'image': image.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@annotations_bp.route('/<project_id>/<image_id>', methods=['POST'])
def add_annotation(project_id, image_id):
    """Add new annotation to image"""
    try:
        image = Image.load(project_id, image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404
        
        data = request.get_json()
        annotation_data = data.get('annotation', {})
        
        # Add annotation
        image.add_annotation(annotation_data)
        
        # Update project statistics
        project = Project.load(project_id)
        if project:
            project.update_statistics()
        
        return jsonify({
            'message': 'Annotation added successfully',
            'annotation_id': image.annotations[-1]['id'],
            'image': image.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@annotations_bp.route('/<project_id>/<image_id>/<annotation_id>', methods=['PUT'])
def update_annotation(project_id, image_id, annotation_id):
    """Update specific annotation"""
    try:
        image = Image.load(project_id, image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404
        
        data = request.get_json()
        annotation_data = data.get('annotation', {})
        
        # Update annotation
        success = image.update_annotation(annotation_id, annotation_data)
        
        if not success:
            return jsonify({'error': 'Annotation not found'}), 404
        
        return jsonify({
            'message': 'Annotation updated successfully',
            'image': image.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@annotations_bp.route('/<project_id>/<image_id>/<annotation_id>', methods=['DELETE'])
def delete_annotation(project_id, image_id, annotation_id):
    """Delete specific annotation"""
    try:
        image = Image.load(project_id, image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404
        
        # Delete annotation
        image.delete_annotation(annotation_id)
        
        # Update project statistics
        project = Project.load(project_id)
        if project:
            project.update_statistics()
        
        return jsonify({
            'message': 'Annotation deleted successfully',
            'image': image.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@annotations_bp.route('/<project_id>/<image_id>/save', methods=['POST'])
def save_annotations(project_id, image_id):
    """Save all annotations for image"""
    try:
        image = Image.load(project_id, image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404
        
        data = request.get_json()
        annotations = data.get('annotations', [])
        
        # Replace all annotations
        image.annotations = annotations
        
        # Update status based on annotations
        if annotations:
            if image.status == 'processed':
                image.status = 'annotated'
        else:
            if image.status == 'annotated':
                image.status = 'processed'
        
        image.save()
        
        # Update project statistics
        project = Project.load(project_id)
        if project:
            project.update_statistics()
        
        return jsonify({
            'message': 'Annotations saved successfully',
            'image': image.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@annotations_bp.route('/<project_id>/<image_id>/complete', methods=['POST'])
def mark_image_complete(project_id, image_id):
    """Mark image as completed"""
    try:
        image = Image.load(project_id, image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404
        
        # Mark as completed
        image.update_status('completed')
        
        return jsonify({
            'message': 'Image marked as completed',
            'image': image.to_dict()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@annotations_bp.route('/<project_id>/auto-flow', methods=['POST'])
def auto_flow_annotation(project_id):
    """Handle auto-flow annotation logic"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        data = request.get_json()
        current_image_id = data.get('current_image_id')
        mark_completed = data.get('mark_completed', False)
        
        # Mark current image as completed if requested
        if current_image_id and mark_completed:
            current_image = Image.load(project_id, current_image_id)
            if current_image:
                current_image.update_status('completed')
        
        # Get next action based on auto-flow settings
        auto_flow_mode = project.settings.get('auto_flow_mode', 'manual')
        
        response = {'marked_completed': mark_completed and bool(current_image_id)}
        
        if auto_flow_mode in ['process_then_annotate', 'process_then_next']:
            # Get next image for annotation
            next_image = file_manager.get_next_unannotated_image(project_id)
            if next_image:
                response['next_image'] = next_image.to_dict()
                response['next_action'] = 'continue_annotation'
            else:
                # Check if there are more unprocessed images
                next_unprocessed = file_manager.get_next_unprocessed_image(project_id)
                if next_unprocessed:
                    response['next_action'] = 'switch_to_processing'
                    response['next_image'] = next_unprocessed.to_dict()
                else:
                    response['next_action'] = 'all_complete'
        else:  # manual mode
            response['next_action'] = 'manual'
        
        # Update project statistics
        project.update_statistics()
        response['statistics'] = project.statistics
        
        return jsonify(response)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@annotations_bp.route('/<project_id>/export-preview', methods=['GET'])
def get_annotation_export_preview(project_id):
    """Get preview of annotations for export"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        images = Image.load_all_for_project(project_id)
        annotated_images = [img for img in images if img.annotations]
        
        # Calculate statistics
        total_annotations = sum(len(img.annotations) for img in annotated_images)
        label_counts = {}
        
        for image in annotated_images:
            for annotation in image.annotations:
                label = annotation.get('label', 'unlabeled')
                label_counts[label] = label_counts.get(label, 0) + 1
        
        return jsonify({
            'total_images': len(images),
            'annotated_images': len(annotated_images),
            'total_annotations': total_annotations,
            'label_counts': label_counts,
            'export_ready': len(annotated_images) > 0
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
