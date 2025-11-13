from flask import Blueprint, request, jsonify

from models.project import Project
from services.validate import DatasetValidator

validate_bp = Blueprint('validate', __name__)
validator = DatasetValidator()


@validate_bp.route('/<project_id>/dataset', methods=['POST'])
def validate_dataset(project_id):
    try:
        project = Project.load(project_id)
        if not project:
            return jsonify({'error': 'Project not found'}), 404
        report = validator.validate_project(project.project_folder)
        return jsonify({'report': report})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
