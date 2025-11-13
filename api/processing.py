from flask import Blueprint, request, jsonify
from models.project import Project
from models.image import Image
from services.image_processor import ImageProcessor
from services.file_manager import FileManager
from datetime import datetime
import os
processing_bp = Blueprint('processing', __name__)
image_processor = ImageProcessor()
file_manager = FileManager()
@processing_bp.route('/<project_id>/<image_id>', methods=['POST'])
def process_image(project_id, image_id):
    """Process specific image"""
    try:
        image = Image.load(project_id, image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404
        
        data = request.get_json()
        processing_settings = data.get('settings', {})
        
        # Process the image
        print(f"Processing image {image.id} with settings: {processing_settings}")
        success = image_processor.process_image(image, processing_settings)
        
        if not success:
            print(f"Failed to process image {image.id}")
            return jsonify({'error': 'Failed to process image'}), 500
        
        print(f"Successfully processed image {image.id}, new status: {image.status}")
        
        # Update project statistics
        project = Project.load(project_id)
        if project:
            project.update_statistics()
        
        # Auto-flow: decide next action based on project settings
        next_payload = {}
        if project:
            auto_flow_mode = project.settings.get('auto_flow_mode', 'manual')
            if auto_flow_mode in ['process_then_annotate', 'process_then_next']:
                try:
                    if auto_flow_mode == 'process_then_annotate':
                        # Next image ready for annotation (status processed)
                        # أولاً تحقق من الصورة المعالجة حديثاً
                        if image.is_ready_for_annotation():
                            next_payload['next_action'] = 'switch_to_annotation'
                            next_payload['next_image'] = image.to_dict()
                        else:
                            # ثم ابحث عن صورة أخرى جاهزة للترسيم
                            next_image = file_manager.get_next_unannotated_image(project_id)
                            if next_image:
                                next_payload['next_action'] = 'switch_to_annotation'
                                next_payload['next_image'] = next_image.to_dict()
                            else:
                                # If none, check if there are unprocessed images to continue processing
                                next_unprocessed = file_manager.get_next_unprocessed_image(project_id)
                                if next_unprocessed:
                                    next_payload['next_action'] = 'continue_processing'
                                    next_payload['next_image'] = next_unprocessed.to_dict()
                                else:
                                    next_payload['next_action'] = 'all_complete'
                    elif auto_flow_mode == 'process_then_next':
                        # Continue processing next unprocessed image
                        next_unprocessed = file_manager.get_next_unprocessed_image(project_id)
                        if next_unprocessed:
                            next_payload['next_action'] = 'continue_processing'
                            next_payload['next_image'] = next_unprocessed.to_dict()
                        else:
                            # If none, but there are processed images, suggest switching to annotation
                            next_image = file_manager.get_next_unannotated_image(project_id)
                            if next_image:
                                next_payload['next_action'] = 'switch_to_annotation'
                                next_payload['next_image'] = next_image.to_dict()
                            else:
                                next_payload['next_action'] = 'all_complete'
                except Exception as e:
                    print(f"Auto-flow decision error: {e}")
        
        return jsonify({
            'message': 'Image processed successfully',
            'image': image.to_dict(),
            **next_payload
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@processing_bp.route('/<project_id>/<image_id>/preview', methods=['POST'])
def generate_preview(project_id, image_id):
    """Generate processing preview without saving"""
    try:
        print(f"Received preview request for project: {project_id}, image: {image_id}")
        
        image = Image.load(project_id, image_id)
        if not image:
            error_msg = f"Image not found: {image_id}"
            print(error_msg)
            return jsonify({'error': error_msg}), 404
        
        data = request.get_json()
        processing_settings = data.get('settings', {})
        preview_size = data.get('preview_size', (640, 640))
        
        print(f"Processing settings: {processing_settings}")
        print(f"Preview size: {preview_size}")
        
        # Generate preview
        print("Calling image_processor.get_processing_preview...")
        preview_path = image_processor.get_processing_preview(image, processing_settings, preview_size)
        print(f"Preview generated at: {preview_path}")
        
        # الحصول على اسم الملف فقط
        preview_filename = os.path.basename(preview_path)
        
        # إنشاء URL للمعاينة باستخدام الـ endpoint الجديد
        preview_url = f"/api/images/{project_id}/preview/{preview_filename}"
        
        print(f"Preview URL: {preview_url}")
        
        return jsonify({
            'message': 'Preview generated successfully',
            'preview_url': preview_url,
            'preview_filename': preview_filename
        })
        
    except Exception as e:
        error_msg = f"Preview generation error: {str(e)}"
        print(error_msg)
        import traceback
        traceback.print_exc()  # طباعة الـ stack trace الكامل
        return jsonify({'error': f'Failed to generate preview: {str(e)}'}), 500
    
@processing_bp.route('/<project_id>/batch', methods=['POST'])
def batch_process(project_id):
    """Process multiple images with same settings"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        data = request.get_json()
        processing_settings = data.get('settings', {})
        image_ids = data.get('image_ids', [])
        
        if not image_ids:
            # Process all unprocessed images
            images = file_manager.get_images_by_status(project_id, 'unprocessed')
        else:
            # Process specific images
            images = []
            for image_id in image_ids:
                image = Image.load(project_id, image_id)
                if image:
                    images.append(image)
        
        if not images:
            return jsonify({'error': 'No images to process'}), 400
        
        # Process images with progress tracking
        def progress_callback(progress, filename):
            # In a real implementation, you might use websockets or server-sent events
            # to send progress updates to the client
            pass
        
        results = image_processor.batch_process_images(images, processing_settings, progress_callback)
        
        # Update project statistics
        project.update_statistics()
        
        return jsonify({
            'message': f'Batch processing completed. {results["processed"]} succeeded, {results["failed"]} failed',
            'processed_count': results['processed'],
            'failed_count': results['failed'],
            'errors': results['errors']
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@processing_bp.route('/<project_id>/auto-flow', methods=['POST'])
def auto_flow_processing(project_id):
    """Handle auto-flow processing logic"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        data = request.get_json()
        current_image_id = data.get('current_image_id')
        processing_settings = data.get('settings', {})
        
        # Process current image if provided
        processed_current = False
        if current_image_id:
            current_image = Image.load(project_id, current_image_id)
            if current_image and current_image.status == 'unprocessed':
                success = image_processor.process_image(current_image, processing_settings)
                processed_current = success
        
        # Get next action based on auto-flow settings
        auto_flow_mode = project.settings.get('auto_flow_mode', 'manual')
        
        response = {'processed_current': processed_current}
        
        if auto_flow_mode == 'process_then_next':
            # Get next unprocessed image
            next_image = file_manager.get_next_unprocessed_image(project_id)
            if next_image:
                response['next_image'] = next_image.to_dict()
                response['next_action'] = 'continue_processing'
            else:
                response['next_action'] = 'processing_complete'
        
        elif auto_flow_mode == 'process_then_annotate':
            # Get next image for annotation (processed but not annotated)
            next_image = file_manager.get_next_unannotated_image(project_id)
            if next_image:
                response['next_image'] = next_image.to_dict()
                response['next_action'] = 'switch_to_annotation'
            else:
                # Check if there are more unprocessed images
                next_unprocessed = file_manager.get_next_unprocessed_image(project_id)
                if next_unprocessed:
                    response['next_image'] = next_unprocessed.to_dict()
                    response['next_action'] = 'continue_processing'
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
@processing_bp.route('/<project_id>/settings', methods=['GET'])
def get_processing_settings(project_id):
    """Get processing settings for project"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        # Get default settings from project
        default_settings = project.settings.get('processing_settings', {
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
            'quality': 85
        })
        
        return jsonify({
            'default_settings': default_settings,
            'saved_settings': default_settings
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@processing_bp.route('/<project_id>/settings', methods=['POST'])
def save_processing_settings(project_id):
    """Save default processing settings for project"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        data = request.get_json()
        processing_settings = data.get('settings', {})
        
        # Validate settings structure
        required_keys = ['grayscale', 'illumination', 'shadow_remove', 'clahe', 'local_contrast', 'gamma', 'threshold', 'deskew', 'bilateral', 'median', 'morphology', 'denoise', 'sharpen', 'edge_enhance', 'speck_remove', 'quality']
        for key in required_keys:
            if key not in processing_settings:
                return jsonify({'error': f'Missing setting: {key}'}), 400
        
        # Save settings to project
        project.settings['processing_settings'] = processing_settings
        project.save()
        
        return jsonify({
            'message': 'Processing settings saved successfully',
            'settings': project.settings['processing_settings']
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@processing_bp.route('/<project_id>/<image_id>/suggest-settings', methods=['GET'])
def suggest_processing_settings(project_id, image_id):
    """Suggest optimal processing settings for an image"""
    try:
        image = Image.load(project_id, image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404
        
        if not os.path.exists(image.original_image_path):
            return jsonify({'error': 'Original image file not found'}), 404
        
        # Get image statistics
        stats = image_processor.get_image_statistics(image.original_image_path)
        
        # Suggest settings based on analysis
        suggested_settings = image_processor.suggest_processing_settings(image.original_image_path)
        
        return jsonify({
            'image_statistics': stats,
            'suggested_settings': suggested_settings,
            'recommendations': {
                'brightness_note': 'Low brightness detected - CLAHE enhancement recommended' if stats['brightness'] < 100 else None,
                'contrast_note': 'Low contrast detected - Enhancement recommended' if stats['contrast'] < 30 else None,
                'sharpness_note': 'Low sharpness detected - Sharpening recommended' if stats['sharpness'] < 100 else None
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@processing_bp.route('/<project_id>/analyze-batch', methods=['POST'])
def analyze_batch_processing(project_id):
    """Analyze multiple images and suggest batch processing settings"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        data = request.get_json()
        image_ids = data.get('image_ids', [])
        
        if not image_ids:
            # Analyze all unprocessed images
            images = file_manager.get_images_by_status(project_id, 'unprocessed')
        else:
            # Analyze specific images
            images = []
            for image_id in image_ids:
                image = Image.load(project_id, image_id)
                if image:
                    images.append(image)
        
        if not images:
            return jsonify({'error': 'No images to analyze'}), 400
        
        # Analyze each image
        analysis_results = []
        for image in images[:10]:  # Limit to first 10 for performance
            if os.path.exists(image.original_image_path):
                stats = image_processor.get_image_statistics(image.original_image_path)
                analysis_results.append({
                    'image_id': image.id,
                    'filename': image.filename,
                    'statistics': stats
                })
        
        # Calculate aggregate statistics
        if analysis_results:
            avg_brightness = sum(r['statistics']['brightness'] for r in analysis_results) / len(analysis_results)
            avg_contrast = sum(r['statistics']['contrast'] for r in analysis_results) / len(analysis_results)
            avg_sharpness = sum(r['statistics']['sharpness'] for r in analysis_results) / len(analysis_results)
            
            # Suggest batch settings based on aggregates
            batch_settings = {
                'grayscale': True,  # Always good for OCR
                'clahe': {
                    'enabled': avg_brightness < 100 or avg_contrast < 30,
                    'clip_limit': 3.0 if avg_brightness < 80 else 2.0,
                    'tile_grid_size': 8
                },
                'threshold': {
                    'enabled': True,
                    'type': 'adaptive',
                    'value': 127,
                    'max_value': 255
                },
                'deskew': {'enabled': True},
                'morphology': {
                    'enabled': True,
                    'operation': 'opening',
                    'kernel_size': 3,
                    'iterations': 1
                },
                'denoise': {
                    'enabled': True,
                    'strength': 8 if avg_sharpness > 100 else 5
                },
                'sharpen': {
                    'enabled': avg_sharpness < 100,
                    'strength': 2.0 if avg_sharpness < 50 else 1.5
                },
                'quality': 90
            }
        else:
            # Default settings if no analysis possible
            batch_settings = project.settings.get('processing_settings', {})
        
        return jsonify({
            'analyzed_images': len(analysis_results),
            'total_images': len(images),
            'analysis_results': analysis_results,
            'suggested_batch_settings': batch_settings,
            'aggregate_statistics': {
                'average_brightness': round(avg_brightness, 2) if analysis_results else 0,
                'average_contrast': round(avg_contrast, 2) if analysis_results else 0,
                'average_sharpness': round(avg_sharpness, 2) if analysis_results else 0
            } if analysis_results else {}
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@processing_bp.route('/<project_id>/reset-processed', methods=['POST'])
def reset_processed_images(project_id):
    """Reset processed images back to unprocessed state"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        data = request.get_json()
        image_ids = data.get('image_ids', [])
        
        if not image_ids:
            # Reset all processed images
            images = file_manager.get_images_by_status(project_id, 'processed')
        else:
            # Reset specific images
            images = []
            for image_id in image_ids:
                image = Image.load(project_id, image_id)
                if image and image.status in ['processed', 'annotated']:
                    images.append(image)
        
        reset_count = 0
        for image in images:
            try:
                # Remove processed image file
                if os.path.exists(image.processed_image_path):
                    os.remove(image.processed_image_path)
                
                # Clear processing settings
                image.processing_settings = {}
                
                # Reset status
                image.update_status('unprocessed')
                reset_count += 1
                
            except Exception as e:
                print(f"Error resetting image {image.id}: {e}")
        
        # Update project statistics
        project.update_statistics()
        
        return jsonify({
            'message': f'{reset_count} images reset successfully',
            'reset_count': reset_count,
            'statistics': project.statistics
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
# Processing presets constant
PROCESSING_PRESETS = {
    'basic': {
        'name': 'الإعدادات الأساسية',
        'settings': {
            'grayscale': True,
            'clahe': {'enabled': False},
            'threshold': {'enabled': True, 'type': 'adaptive'},
            'deskew': {'enabled': True},
            'morphology': {'enabled': False},
            'denoise': {'enabled': False},
            'sharpen': {'enabled': False},
            'quality': 85
        }
    },
    'enhanced': {
        'name': 'الإعدادات المحسنة',
        'settings': {
            'grayscale': True,
            'clahe': {'enabled': True, 'clip_limit': 2.0, 'tile_grid_size': 8},
            'threshold': {'enabled': True, 'type': 'adaptive'},
            'deskew': {'enabled': True},
            'morphology': {'enabled': True, 'operation': 'opening', 'kernel_size': 3, 'iterations': 1},
            'denoise': {'enabled': True, 'strength': 8},
            'sharpen': {'enabled': False},
            'quality': 90
        }
    },
    'aggressive': {
        'name': 'الإعدادات المتقدمة',
        'settings': {
            'grayscale': True,
            'clahe': {'enabled': True, 'clip_limit': 3.0, 'tile_grid_size': 8},
            'threshold': {'enabled': True, 'type': 'adaptive'},
            'deskew': {'enabled': True},
            'morphology': {'enabled': True, 'operation': 'opening', 'kernel_size': 5, 'iterations': 2},
            'denoise': {'enabled': True, 'strength': 12},
            'sharpen': {'enabled': True, 'strength': 1.5},
            'quality': 95
        }
    },
    'musnad_optimized': {
        'name': 'مخصص لخط المسند',
        'settings': {
            'grayscale': True,
            'illumination': {'enabled': True, 'blur_kernel': 41},
            'shadow_remove': {'enabled': True, 'blur_kernel': 31},
            'clahe': {'enabled': True, 'clip_limit': 2.5, 'tile_grid_size': 8},
            'local_contrast': {'enabled': True, 'method': 'clahe', 'clip_limit': 2.5, 'tile_grid_size': 8},
            'gamma': {'enabled': False, 'value': 1.0},
            'threshold': {'enabled': True, 'type': 'adaptive', 'value': 127, 'max_value': 255},
            'deskew': {'enabled': True},
            'bilateral': {'enabled': False, 'diameter': 7, 'sigma_color': 50, 'sigma_space': 50},
            'median': {'enabled': False, 'kernel': 3},
            'morphology': {'enabled': True, 'operation': 'closing', 'kernel_size': 2, 'iterations': 1},
            'denoise': {'enabled': True, 'strength': 10},
            'sharpen': {'enabled': True, 'strength': 1.2},
            'edge_enhance': {'enabled': True, 'alpha': 0.35},
            'speck_remove': {'enabled': True, 'max_area': 20},
            'quality': 90
        }
    }
}

@processing_bp.route('/presets', methods=['GET'])
def get_processing_presets():
    """Get available processing presets"""
    return jsonify({'presets': PROCESSING_PRESETS})
@processing_bp.route('/<project_id>/apply-preset', methods=['POST'])
def apply_preset(project_id):
    """Apply processing preset to project"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        data = request.get_json()
        preset_name = data.get('preset_name')
        
        if preset_name not in PROCESSING_PRESETS:
            return jsonify({'error': 'Invalid preset name'}), 400
        
        # Apply preset settings
        preset_settings = PROCESSING_PRESETS[preset_name]['settings']
        project.settings['processing_settings'] = preset_settings
        project.save()
        
        return jsonify({
            'message': f"تم تطبيق الإعدادات المسبقة: {PROCESSING_PRESETS[preset_name]['name']}",
            'settings': preset_settings
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@processing_bp.route('/clear-cache', methods=['POST'])
def clear_processing_cache():
    """Clear processing cache"""
    try:
        image_processor.clear_processing_cache()
        image_processor.clear_preview_cache()
        
        return jsonify({
            'message': 'تم مسح الذاكرة المؤقتة بنجاح',
            'cache_cleared': True
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@processing_bp.route('/<project_id>/auto-flow-mode', methods=['PUT'])
def set_auto_flow_mode(project_id):
    """Set the project's auto flow mode: manual | process_then_annotate | process_then_next"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404

        data = request.get_json() or {}
        mode = data.get('mode', 'manual')
        allowed = ['manual', 'process_then_annotate', 'process_then_next']
        if mode not in allowed:
            return jsonify({'error': f'Invalid mode. Allowed: {allowed}'}), 400

        project.settings['auto_flow_mode'] = mode
        project.save()

        return jsonify({'message': 'Auto-flow mode updated', 'auto_flow_mode': mode})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@processing_bp.route('/<project_id>/<image_id>/apply', methods=['POST'])
def apply_processing(project_id, image_id):
    """Apply processing settings to an image"""
    try:
        image = Image.load(project_id, image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404
        
        data = request.get_json()
        processing_settings = data.get('settings')
        
        if not processing_settings:
            return jsonify({'error': 'Processing settings required'}), 400
        
        # Apply processing using ImageProcessor
        print(f"Applying processing to image {image.id} with settings: {processing_settings}")
        success = image_processor.process_image(image, processing_settings)
        
        if success:
            print(f"Successfully applied processing to image {image.id}, new status: {image.status}")
            return jsonify({
                'message': 'Processing applied successfully',
                'image': image.to_dict(),
                'processed_path': image.processed_image_path
            })
        else:
            print(f"Failed to apply processing to image {image.id}")
            return jsonify({'error': 'Failed to apply processing'}), 500
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@processing_bp.route('/<project_id>/apply-all', methods=['POST'])
def apply_processing_to_all(project_id):
    """Apply processing settings to all images in project"""
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        
        data = request.get_json()
        processing_settings = data.get('settings')
        
        if not processing_settings:
            # Use project's default processing settings
            processing_settings = project.settings.get('processing_settings', {})
        
        # Get all images in project
        from models.image import Image
        images = Image.load_all_for_project(project_id)
        
        processed_count = 0
        failed_count = 0
        
        for image in images:
            if image.status in ['unprocessed', 'processed']:  # Allow reprocessing
                success = image_processor.process_image(image, processing_settings)
                if success:
                    processed_count += 1
                else:
                    failed_count += 1
        
        # Update project statistics
        project.update_statistics()
        
        return jsonify({
            'message': f'Processing completed: {processed_count} successful, {failed_count} failed',
            'processed_count': processed_count,
            'failed_count': failed_count,
            'statistics': project.statistics
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500