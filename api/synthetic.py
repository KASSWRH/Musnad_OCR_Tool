from flask import Blueprint, request, jsonify
import os

from models.project import Project
from services.synthetic import SyntheticGenerator

synthetic_bp = Blueprint('synthetic', __name__)
generator = SyntheticGenerator()


@synthetic_bp.route('/<project_id>/generate', methods=['POST'])
def generate_synthetic(project_id):
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404

        data = request.get_json() or {}
        texts = data.get('texts', [])
        if not texts:
            return jsonify({'error': 'No texts provided'}), 400

        out_dir = os.path.join(project.project_folder, 'synthetic')
        options = data.get('options', {})
        files = generator.generate(texts, out_dir, options)
        rel = [os.path.relpath(p, project.project_folder) for p in files]
        return jsonify({'generated': rel, 'count': len(rel)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
