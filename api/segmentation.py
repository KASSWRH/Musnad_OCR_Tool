from flask import Blueprint, request, jsonify
import os

from models.project import Project
from models.image import Image
from services.segment import Segmenter

segmentation_bp = Blueprint('segmentation', __name__)
segmenter = Segmenter()


@segmentation_bp.route('/<project_id>/<image_id>/segment', methods=['POST'])
def segment_image(project_id, image_id):
    try:
        image = Image.load(project_id, image_id)
        if not image:
            return jsonify({'error': 'Image not found'}), 404

        level = (request.get_json() or {}).get('level', 'lines')
        save = (request.get_json() or {}).get('save', False)

        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404

        save_dir = None
        if save:
            save_dir = os.path.join(project.project_folder, 'segments', level)

        res = segmenter.segment(image.original_image_path, level=level, save_dir=save_dir)
        return jsonify({'level': level, **res})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
