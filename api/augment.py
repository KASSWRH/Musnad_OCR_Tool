from flask import Blueprint, request, jsonify
import os

from models.project import Project
from services.augment import Augmenter

augment_bp = Blueprint('augment', __name__)
augmenter = Augmenter()


@augment_bp.route('/<project_id>/batch', methods=['POST'])
def batch_augment(project_id):
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404

        data = request.get_json() or {}
        image_filenames = data.get('filenames', [])
        count = int(data.get('count', 3))
        ops = data.get('ops', {})

        out_dir = os.path.join(project.project_folder, 'augmented')
        os.makedirs(out_dir, exist_ok=True)

        saved = []
        if not image_filenames:
            # If none specified, augment all originals (first 20)
            originals_dir = project.original_images_folder
            for f in list(os.listdir(originals_dir))[:20]:
                if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.tif', '.tiff', '.webp')):
                    saved += augmenter.augment_and_save(os.path.join(originals_dir, f), out_dir, count, ops)
        else:
            for f in image_filenames:
                saved += augmenter.augment_and_save(os.path.join(project.original_images_folder, f), out_dir, count, ops)

        rel = [os.path.relpath(p, project.project_folder) for p in saved]
        return jsonify({'generated': rel, 'count': len(rel)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
