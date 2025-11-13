from flask import Blueprint, request, jsonify, send_file
from models.project import Project
from services.export_service import ExportService
import os

exports_bp = Blueprint('exports', __name__)
export_service = ExportService()

@exports_bp.route('/<project_id>', methods=['POST'])
def export_project(project_id):
    """Export project in specified format"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        data = request.get_json()
        export_format = data.get('format', 'csv')  # csv, yolo, json, coco
        export_settings = data.get('settings', {})
        
        # Default settings
        default_settings = {
            'include_images': True,
            'split_ratio': {'train': 0.7, 'val': 0.2, 'test': 0.1}
        }
        default_settings.update(export_settings)
        
        # Export based on format
        if export_format == 'yolo':
            zip_path = export_service.export_yolo(project, default_settings)
        elif export_format == 'csv':
            zip_path = export_service.export_csv(project, default_settings)
        elif export_format == 'json':
            zip_path = export_service.export_json(project, default_settings)
        elif export_format == 'coco':
            zip_path = export_service.export_coco(project, default_settings)
        else:
            return jsonify({'error': 'Unsupported export format'}), 400
        
        # Return download information
        filename = os.path.basename(zip_path)
        return jsonify({
            'message': 'Export completed successfully',
            'download_url': f'/api/exports/download/{filename}',
            'filename': filename,
            'format': export_format
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@exports_bp.route('/download/<filename>', methods=['GET'])
def download_export(filename):
    """Download exported file"""
    try:
        file_path = os.path.join(export_service.export_folder, filename)
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'Export file not found'}), 404
        
        return send_file(file_path, as_attachment=True, download_name=filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@exports_bp.route('/<project_id>/formats', methods=['GET'])
def get_export_formats(project_id):
    """Get available export formats and their descriptions"""
    try:
        formats = {
            'csv': {
                'name': 'CSV',
                'description': 'تصدير التوسيمات في صيغة CSV مع إمكانية تضمين الصور',
                'supports_images': True,
                'supports_splits': False
            },
            'yolo': {
                'name': 'YOLO',
                'description': 'تصدير بصيغة YOLO للتدريب مع تقسيم البيانات',
                'supports_images': True,
                'supports_splits': True
            },
            'json': {
                'name': 'JSON',
                'description': 'تصدير شامل لبيانات المشروع بصيغة JSON',
                'supports_images': True,
                'supports_splits': False
            },
            'coco': {
                'name': 'COCO',
                'description': 'تصدير بصيغة COCO للتدريب مع معايير Microsoft COCO',
                'supports_images': True,
                'supports_splits': False
            }
        }
        
        return jsonify({'formats': formats})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@exports_bp.route('/<project_id>/preview', methods=['GET'])
def get_export_preview(project_id):
    """Get preview of what will be exported"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        from models.image import Image
        images = Image.load_all_for_project(project_id)
        
        # Filter annotated images
        annotated_images = [img for img in images if img.annotations and img.status in ['annotated', 'completed']]
        
        # Calculate statistics
        total_annotations = sum(len(img.annotations) for img in annotated_images)
        label_counts = {}
        level_counts = {}
        
        for image in annotated_images:
            for annotation in image.annotations:
                label = annotation.get('label', 'unlabeled')
                level = annotation.get('level', 'unknown')
                
                label_counts[label] = label_counts.get(label, 0) + 1
                level_counts[level] = level_counts.get(level, 0) + 1
        
        return jsonify({
            'project_name': project.name,
            'total_images': len(images),
            'annotated_images': len(annotated_images),
            'unannotated_images': len(images) - len(annotated_images),
            'total_annotations': total_annotations,
            'label_counts': label_counts,
            'level_counts': level_counts,
            'export_ready': len(annotated_images) > 0,
            'statistics': project.statistics
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@exports_bp.route('/cleanup', methods=['POST'])
def cleanup_old_exports():
    """Clean up old export files"""
    try:
        # Clean up exports older than 7 days
        import os
        import time
        from datetime import datetime, timedelta
        
        export_folder = export_service.export_folder
        cutoff_time = time.time() - (7 * 24 * 60 * 60)  # 7 days ago
        
        cleaned_count = 0
        if os.path.exists(export_folder):
            for filename in os.listdir(export_folder):
                file_path = os.path.join(export_folder, filename)
                if os.path.isfile(file_path):
                    file_time = os.path.getmtime(file_path)
                    if file_time < cutoff_time:
                        os.remove(file_path)
                        cleaned_count += 1
        
        return jsonify({
            'message': f'{cleaned_count} old export files cleaned up',
            'cleaned_count': cleaned_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
