import os
import json
from typing import Dict, Any, List

from PIL import Image as PILImage


class DatasetValidator:
    def __init__(self):
        pass

    def validate_project(self, project_folder: str) -> Dict[str, Any]:
        report: Dict[str, Any] = {
            'original_images_exist': True,
            'processed_images_exist': True,
            'annotations_valid': True,
            'missing_original': [],
            'missing_processed': [],
            'bad_annotations': [],
            'summary': {}
        }

        orig = os.path.join(project_folder, 'original_images')
        proc = os.path.join(project_folder, 'processed_images')
        ann = os.path.join(project_folder, 'annotations')

        os.makedirs(orig, exist_ok=True)
        os.makedirs(proc, exist_ok=True)
        os.makedirs(ann, exist_ok=True)

        originals = {f for f in os.listdir(orig) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp', '.webp')) and not f.endswith('_thumb.jpg')}
        processed = {f for f in os.listdir(proc) if f.lower().endswith(('.jpg', '.jpeg', '.png'))}
        annotations = {f for f in os.listdir(ann) if f.lower().endswith('.json')}

        # Existence
        report['original_images_exist'] = len(originals) > 0
        report['processed_images_exist'] = len(processed) > 0

        # Basic image readability
        for f in list(originals)[:50]:
            path = os.path.join(orig, f)
            try:
                with PILImage.open(path) as im:
                    im.verify()
            except Exception:
                report['missing_original'].append(f)

        # Annotations structure
        for a in annotations:
            path = os.path.join(ann, a)
            try:
                with open(path, 'r', encoding='utf-8') as fp:
                    data = json.load(fp)
                # required keys
                for k in ['id', 'project_id', 'filename', 'status']:
                    if k not in data:
                        raise ValueError(f'missing key {k}')
            except Exception as e:
                report['bad_annotations'].append({'file': a, 'error': str(e)})

        report['summary'] = {
            'original_count': len(originals),
            'processed_count': len(processed),
            'annotations_count': len(annotations)
        }
        return report
