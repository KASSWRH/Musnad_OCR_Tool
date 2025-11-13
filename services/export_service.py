import os
import json
import csv
import zipfile
import shutil
import random
from datetime import datetime
from typing import Dict, List
from models.project import Project
from models.image import Image
import cv2
import numpy as np

class ExportService:
    def __init__(self):
        self.export_folder = 'exports'
        os.makedirs(self.export_folder, exist_ok=True)
    
    def _letterbox_resize(self, src_path: str, dst_path: str, size: int = 640):
        img = cv2.imread(src_path)
        if img is None:
            raise ValueError(f"Failed to load image: {src_path}")
        h, w = img.shape[:2]
        scale = min(size / w, size / h)
        new_w = int(round(w * scale))
        new_h = int(round(h * scale))
        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
        top = (size - new_h) // 2
        bottom = size - new_h - top
        left = (size - new_w) // 2
        right = size - new_w - left
        color = (114, 114, 114)
        canvas = cv2.copyMakeBorder(resized, top, bottom, left, right, borderType=cv2.BORDER_CONSTANT, value=color)
        cv2.imwrite(dst_path, canvas)
        return scale, left, top, size, size
    
    def export_yolo(self, project: Project, export_settings: Dict) -> str:
        """Export project in YOLO format"""
        export_id = f"yolo_{project.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        export_dir = os.path.join(self.export_folder, export_id)
        os.makedirs(export_dir, exist_ok=True)
        
        # Create YOLO directory structure
        for split in ['train', 'val', 'test']:
            os.makedirs(os.path.join(export_dir, 'images', split), exist_ok=True)
            os.makedirs(os.path.join(export_dir, 'labels', split), exist_ok=True)
        
        # Get all annotated images
        images = Image.load_all_for_project(project.id)
        annotated_images = [img for img in images if img.annotations and img.status in ['annotated', 'completed']]
        
        if not annotated_images:
            raise ValueError("No annotated images found for export")
        
        # Split images according to settings
        split_ratio = export_settings.get('split_ratio', {'train': 0.7, 'val': 0.2, 'test': 0.1})
        random.shuffle(annotated_images)
        
        total = len(annotated_images)
        train_count = int(total * split_ratio['train'])
        val_count = int(total * split_ratio['val'])
        
        splits = {
            'train': annotated_images[:train_count],
            'val': annotated_images[train_count:train_count + val_count],
            'test': annotated_images[train_count + val_count:]
        }
        
        # Create class names from annotations
        class_names = set()
        for image in annotated_images:
            for annotation in image.annotations:
                if annotation.get('label') and annotation['label'].strip():
                    class_names.add(annotation['label'].strip())
        
        class_names = sorted(list(class_names))
        if not class_names:
            raise ValueError("No labeled annotations found for export")
        
        class_to_id = {name: idx for idx, name in enumerate(class_names)}
        
        # Write classes.txt
        with open(os.path.join(export_dir, 'classes.txt'), 'w', encoding='utf-8') as f:
            for class_name in class_names:
                f.write(f"{class_name}\n")
        
        # Process each split
        for split_name, split_images in splits.items():
            for image in split_images:
                target_size = int(export_settings.get('resize_to', 640))
                scale = None
                pad_x = 0
                pad_y = 0
                if export_settings.get('include_images', True):
                    source_path = image.processed_image_path if os.path.exists(image.processed_image_path) else image.original_image_path
                    if source_path and os.path.exists(source_path):
                        filename = f"{os.path.splitext(image.filename)[0]}.jpg"
                        dst_path = os.path.join(export_dir, 'images', split_name, filename)
                        try:
                            scale, pad_x, pad_y, _, _ = self._letterbox_resize(source_path, dst_path, target_size)
                        except Exception:
                            shutil.copy2(source_path, dst_path)
                            iw = max(image.width, 1)
                            ih = max(image.height, 1)
                            scale = min(target_size / iw, target_size / ih)
                            new_w = int(round(iw * scale))
                            new_h = int(round(ih * scale))
                            pad_x = (target_size - new_w) // 2
                            pad_y = (target_size - new_h) // 2
                    else:
                        print(f"Warning: Image file not found for {image.filename} (ID: {image.id})")
                        iw = max(image.width, 1)
                        ih = max(image.height, 1)
                        scale = min(target_size / iw, target_size / ih)
                        new_w = int(round(iw * scale))
                        new_h = int(round(ih * scale))
                        pad_x = (target_size - new_w) // 2
                        pad_y = (target_size - new_h) // 2
                else:
                    iw = max(image.width, 1)
                    ih = max(image.height, 1)
                    scale = min(target_size / iw, target_size / ih)
                    new_w = int(round(iw * scale))
                    new_h = int(round(ih * scale))
                    pad_x = (target_size - new_w) // 2
                    pad_y = (target_size - new_h) // 2
                label_filename = f"{os.path.splitext(image.filename)[0]}.txt"
                label_file = os.path.join(export_dir, 'labels', split_name, label_filename)
                with open(label_file, 'w', encoding='utf-8') as f:
                    for annotation in image.annotations:
                        if annotation.get('type') == 'missing_region':
                            continue
                        if (annotation.get('type') == 'bbox' and 
                            annotation.get('label') and 
                            annotation['label'].strip() and
                            'bbox' in annotation):
                            class_id = class_to_id.get(annotation['label'].strip(), 0)
                            b = annotation['bbox']
                            x = b['x'] * scale + pad_x
                            y = b['y'] * scale + pad_y
                            w = b['width'] * scale
                            h = b['height'] * scale
                            x_center = (x + w / 2) / target_size
                            y_center = (y + h / 2) / target_size
                            nw = w / target_size
                            nh = h / target_size
                            x_center = max(0, min(1, x_center))
                            y_center = max(0, min(1, y_center))
                            nw = max(0, min(1, nw))
                            nh = max(0, min(1, nh))
                            f.write(f"{class_id} {x_center:.6f} {y_center:.6f} {nw:.6f} {nh:.6f}\n")
        
        # Create data.yaml
        yaml_content = f"""path: {export_dir}
        train: images/train
        val: images/val
        test: images/test

        nc: {len(class_names)}
        names: {class_names}

        # Musnad OCR Dataset
        # Generated by Musnad OCR Data Preparation Tool
        # Export Date: {datetime.now().isoformat()}
        # Project: {project.name}
        # Total Images: {len(annotated_images)}
        # Train: {len(splits['train'])} | Val: {len(splits['val'])} | Test: {len(splits['test'])}
        """
        with open(os.path.join(export_dir, 'data.yaml'), 'w', encoding='utf-8') as f:
            f.write(yaml_content)
        
        # Create README
        readme_content = self._create_readme(export_dir, 'YOLO', project, len(annotated_images), splits)
        with open(os.path.join(export_dir, 'README.md'), 'w', encoding='utf-8') as f:
            f.write(readme_content)
        
        # Create ZIP file
        zip_path = os.path.join(self.export_folder, f"{export_id}.zip")
        self._create_zip(export_dir, zip_path)
        
        # Clean up temporary directory
        shutil.rmtree(export_dir)
        
        return zip_path
    
    def export_csv(self, project: Project, export_settings: Dict) -> str:
        """Export project in CSV format"""
        export_id = f"csv_{project.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        export_dir = os.path.join(self.export_folder, export_id)
        os.makedirs(export_dir, exist_ok=True)
        
        images_dir = os.path.join(export_dir, 'images')
        if export_settings.get('include_images', True):
            os.makedirs(images_dir, exist_ok=True)
        
        # Get all images
        images = Image.load_all_for_project(project.id)
        
        # Create CSV file
        csv_path = os.path.join(export_dir, 'annotations.csv')
        
        with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = [
                'image_id', 'image_filename', 'image_path', 'image_width', 'image_height', 'image_status',
                'annotation_id', 'annotation_type', 'label', 'level', 'confidence', 'direction',
                'bbox_x', 'bbox_y', 'bbox_width', 'bbox_height',
                'polygon_points', 'missing_region', 'max_chars', 'reason', 'notes',
                'created_at', 'updated_at'
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            writer.writeheader()
            
            for image in images:
                # Copy image if requested
                if export_settings.get('include_images', True):
                    source_path = image.processed_image_path if os.path.exists(image.processed_image_path) else image.original_image_path
                    if source_path and os.path.exists(source_path):
                        filename = f"{os.path.splitext(image.filename)[0]}.jpg"
                        dst_path = os.path.join(images_dir, filename)
                        shutil.copy2(source_path, dst_path)
                    else:
                        print(f"Warning: Image file not found for {image.filename} (ID: {image.id})")
                
                # Write annotations
                if not image.annotations:
                    # Write row for image without annotations
                    writer.writerow({
                        'image_id': image.id,
                        'image_filename': image.filename,
                        'image_path': f"images/{os.path.splitext(image.filename)[0]}.jpg" if export_settings.get('include_images', True) else "",
                        'image_width': image.width,
                        'image_height': image.height,
                        'image_status': image.status,
                        'annotation_id': '',
                        'annotation_type': '',
                        'label': '',
                        'level': '',
                        'confidence': '',
                        'direction': '',
                        'bbox_x': '',
                        'bbox_y': '',
                        'bbox_width': '',
                        'bbox_height': '',
                        'polygon_points': '',
                        'missing_region': False,
                        'max_chars': '',
                        'reason': '',
                        'notes': '',
                        'created_at': '',
                        'updated_at': ''
                    })
                else:
                    for annotation in image.annotations:
                        row = {
                            'image_id': image.id,
                            'image_filename': image.filename,
                            'image_path': f"images/{os.path.splitext(image.filename)[0]}.jpg" if export_settings.get('include_images', True) else "",
                            'image_width': image.width,
                            'image_height': image.height,
                            'image_status': image.status,
                            'annotation_id': annotation.get('id', ''),
                            'annotation_type': annotation.get('type', ''),
                            'label': annotation.get('label', ''),
                            'level': annotation.get('level', ''),
                            'confidence': annotation.get('confidence', ''),
                            'direction': annotation.get('direction', ''),
                            'bbox_x': '',
                            'bbox_y': '',
                            'bbox_width': '',
                            'bbox_height': '',
                            'polygon_points': '',
                            'missing_region': annotation.get('type') == 'missing_region',
                            'max_chars': annotation.get('max_chars', ''),
                            'reason': annotation.get('reason', ''),
                            'notes': annotation.get('notes', ''),
                            'created_at': annotation.get('created_at', ''),
                            'updated_at': annotation.get('updated_at', '')
                        }
                        
                        if annotation.get('type') == 'bbox' and 'bbox' in annotation:
                            bbox = annotation['bbox']
                            row.update({
                                'bbox_x': bbox.get('x', ''),
                                'bbox_y': bbox.get('y', ''),
                                'bbox_width': bbox.get('width', ''),
                                'bbox_height': bbox.get('height', '')
                            })
                        elif annotation.get('type') == 'polygon' and 'points' in annotation:
                            row['polygon_points'] = json.dumps(annotation['points'])
                        
                        writer.writerow(row)
        
        # Create README
        readme_content = self._create_readme(export_dir, 'CSV', project, len(images))
        with open(os.path.join(export_dir, 'README.md'), 'w', encoding='utf-8') as f:
            f.write(readme_content)
        
        # Create ZIP file
        zip_path = os.path.join(self.export_folder, f"{export_id}.zip")
        self._create_zip(export_dir, zip_path)
        
        # Clean up temporary directory
        shutil.rmtree(export_dir)
        
        return zip_path
    
    def export_json(self, project: Project, export_settings: Dict) -> str:
        """Export project in JSON format"""
        export_id = f"json_{project.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        export_dir = os.path.join(self.export_folder, export_id)
        os.makedirs(export_dir, exist_ok=True)
        
        images_dir = os.path.join(export_dir, 'images')
        if export_settings.get('include_images', True):
            os.makedirs(images_dir, exist_ok=True)
        
        # Get all images
        images = Image.load_all_for_project(project.id)
        
        # Prepare export data
        export_data = {
            'project': project.to_dict(),
            'export_info': {
                'export_id': export_id,
                'export_date': datetime.now().isoformat(),
                'format': 'JSON',
                'version': '1.0',
                'include_images': export_settings.get('include_images', True)
            },
            'images': [],
            'statistics': {
                'total_images': len(images),
                'annotated_images': len([img for img in images if img.annotations]),
                'total_annotations': sum(len(img.annotations) for img in images)
            }
        }
        
        # Process images
        for image in images:
            # Copy image if requested
            if export_settings.get('include_images', True):
                source_path = image.processed_image_path if os.path.exists(image.processed_image_path) else image.original_image_path
                if source_path and os.path.exists(source_path):
                    filename = f"{os.path.splitext(image.filename)[0]}.jpg"
                    dst_path = os.path.join(images_dir, filename)
                    shutil.copy2(source_path, dst_path)
                else:
                    print(f"Warning: Image file not found for {image.filename} (ID: {image.id})")
            
            # Add image data
            image_data = image.to_dict(include_annotations=True)
            if export_settings.get('include_images', True):
                image_data['exported_image_path'] = f"images/{os.path.splitext(image.filename)[0]}.jpg"
            
            export_data['images'].append(image_data)
        
        # Save JSON file
        json_path = os.path.join(export_dir, 'dataset.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)
        
        # Create README
        readme_content = self._create_readme(export_dir, 'JSON', project, len(images))
        with open(os.path.join(export_dir, 'README.md'), 'w', encoding='utf-8') as f:
            f.write(readme_content)
        
        # Create ZIP file
        zip_path = os.path.join(self.export_folder, f"{export_id}.zip")
        self._create_zip(export_dir, zip_path)
        
        # Clean up temporary directory
        shutil.rmtree(export_dir)
        
        return zip_path
    
    def export_coco(self, project: Project, export_settings: Dict) -> str:
        """Export project in COCO format"""
        export_id = f"coco_{project.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        export_dir = os.path.join(self.export_folder, export_id)
        os.makedirs(export_dir, exist_ok=True)
        
        images_dir = os.path.join(export_dir, 'images')
        if export_settings.get('include_images', True):
            os.makedirs(images_dir, exist_ok=True)
        
        # Get all annotated images
        images = Image.load_all_for_project(project.id)
        annotated_images = [img for img in images if img.annotations and img.status in ['annotated', 'completed']]
        
        if not annotated_images:
            raise ValueError("No annotated images found for export")
        
        # Create categories from annotations
        categories = set()
        for image in annotated_images:
            for annotation in image.annotations:
                if annotation.get('label') and annotation['label'].strip():
                    categories.add(annotation['label'].strip())
        
        categories = sorted(list(categories))
        if not categories:
            raise ValueError("No labeled annotations found for export")
        
        # Create COCO format data structure
        coco_data = {
            "info": {
                "description": f"Musnad OCR Dataset - {project.name}",
                "version": "1.0",
                "year": datetime.now().year,
                "contributor": "Musnad OCR Data Preparation Tool",
                "date_created": datetime.now().isoformat()
            },
            "licenses": [
                {
                    "id": 1,
                    "name": "Custom License",
                    "url": ""
                }
            ],
            "categories": [],
            "images": [],
            "annotations": []
        }
        
        # Add categories
        for idx, category_name in enumerate(categories):
            coco_data["categories"].append({
                "id": idx + 1,
                "name": category_name,
                "supercategory": "text"
            })
        
        category_to_id = {name: idx + 1 for idx, name in enumerate(categories)}
        annotation_id = 1
        
        # Process images and annotations
        for img_idx, image in enumerate(annotated_images):
            # Copy image if requested
            if export_settings.get('include_images', True):
                source_path = image.processed_image_path if os.path.exists(image.processed_image_path) else image.original_image_path
                if source_path and os.path.exists(source_path):
                    filename = f"{os.path.splitext(image.filename)[0]}.jpg"
                    dst_path = os.path.join(images_dir, filename)
                    shutil.copy2(source_path, dst_path)
                else:
                    print(f"Warning: Image file not found for {image.filename} (ID: {image.id})")
            
            # Add image info
            image_info = {
                "id": img_idx + 1,
                "width": image.width,
                "height": image.height,
                "file_name": f"{os.path.splitext(image.filename)[0]}.jpg",
                "license": 1,
                "date_captured": image.created_at or datetime.now().isoformat()
            }
            coco_data["images"].append(image_info)
            
            # Add annotations
            for annotation in image.annotations:
                # Skip missing_region annotations for COCO training
                if annotation.get('type') == 'missing_region':
                    continue
                    
                if (annotation.get('type') == 'bbox' and 
                    annotation.get('label') and 
                    annotation['label'].strip() and
                    'bbox' in annotation):
                    
                    bbox = annotation['bbox']
                    category_id = category_to_id.get(annotation['label'].strip(), 1)
                    
                    # COCO bbox format: [x, y, width, height]
                    coco_bbox = [bbox['x'], bbox['y'], bbox['width'], bbox['height']]
                    area = bbox['width'] * bbox['height']
                    
                    coco_annotation = {
                        "id": annotation_id,
                        "image_id": img_idx + 1,
                        "category_id": category_id,
                        "bbox": coco_bbox,
                        "area": area,
                        "iscrowd": 0,
                        "segmentation": []
                    }
                    
                    # Add additional fields if available
                    if annotation.get('level'):
                        coco_annotation["level"] = annotation['level']
                    if annotation.get('confidence'):
                        coco_annotation["confidence"] = annotation['confidence']
                    if annotation.get('direction'):
                        coco_annotation["direction"] = annotation['direction']
                    
                    coco_data["annotations"].append(coco_annotation)
                    annotation_id += 1
        
        # Save COCO annotations file
        annotations_path = os.path.join(export_dir, 'annotations.json')
        with open(annotations_path, 'w', encoding='utf-8') as f:
            json.dump(coco_data, f, indent=2, ensure_ascii=False)
        
        # Save categories file
        categories_path = os.path.join(export_dir, 'categories.json')
        with open(categories_path, 'w', encoding='utf-8') as f:
            json.dump(coco_data["categories"], f, indent=2, ensure_ascii=False)
        
        # Create README
        readme_content = self._create_readme(export_dir, 'COCO', project, len(annotated_images))
        with open(os.path.join(export_dir, 'README.md'), 'w', encoding='utf-8') as f:
            f.write(readme_content)
        
        # Create ZIP file
        zip_path = os.path.join(self.export_folder, f"{export_id}.zip")
        self._create_zip(export_dir, zip_path)
        
        # Clean up temporary directory
        shutil.rmtree(export_dir)
        
        return zip_path
    
    def _create_readme(self, export_dir: str, format_type: str, project: Project, image_count: int, splits: Dict = None):
        """Create README file for export"""
        readme_content = f"""# {project.name} - {format_type} Export

        ## Project Information
        - **Name**: {project.name}
        - **Description**: {project.description or 'No description'}
        - **Export Format**: {format_type}
        - **Export Date**: {datetime.now().isoformat()}
        - **Total Images**: {image_count}

        ## Dataset Statistics
        """
        
        if splits:
            readme_content += f"""
            ### Data Split
            - **Training**: {len(splits['train'])} images
            - **Validation**: {len(splits['val'])} images
            - **Test**: {len(splits['test'])} images
            """
        
        # Add project statistics
        stats = project.statistics
        readme_content += f"""
        ### Image Status Distribution
        - **Unprocessed**: {stats.get('unprocessed_images', 0)} images
        - **Processed**: {stats.get('processed_images', 0)} images
        - **Annotated**: {stats.get('annotated_images', 0)} images
        - **Completed**: {stats.get('completed_images', 0)} images
        """
        
        if format_type == 'YOLO':
            readme_content += """
            ## YOLO Format Description
            - `images/`: Contains image files organized by split (train/val/test)
            - `labels/`: Contains annotation files (.txt) with same structure
            - `classes.txt`: List of class names
            - `data.yaml`: YOLO configuration file

            ### Label Format
            Each line in label files represents one object:
            `class_id x_center y_center width height`

            All coordinates are normalized (0-1).

            ### Usage
            ```python
            # Load dataset with YOLOv8
            from ultralytics import YOLO

            # Train model
            model = YOLO('yolov8n.pt')
            results = model.train(data='data.yaml', epochs=100)
            ```
            
            ### Note on Missing Regions
            Missing region annotations are excluded from YOLO training data as they 
            represent damaged or illegible areas rather than text to be detected.
"""

        elif format_type == 'COCO':
            readme_content += """
            ## COCO Format Description
            - `images/`: Contains image files
            - `annotations.json`: COCO format annotations
            - `categories.json`: Category definitions

            ### Usage
            ```python
            # Load with pycocotools
            from pycocotools.coco import COCO

            coco = COCO('annotations.json')
            ```
            
            ### Note on Missing Regions
            Missing region annotations are excluded from COCO training data as they 
            represent damaged or illegible areas rather than text to be detected.
            """

        elif format_type == 'CSV':
            readme_content += """
            ## CSV Format Description
            - `annotations.csv`: All annotations in CSV format
            - Columns include: filename, bbox coordinates, label, level, missing_region info
            - Special fields for missing regions: missing_region, max_chars, reason, notes

            ### Missing Region Annotations
            - `missing_region`: Boolean indicating if this is a missing/damaged region
            - `max_chars`: Expected number of characters in the missing region
            - `reason`: Reason for missing content (damaged, eroded, illegible, etc.)
            - `notes`: Additional notes about the missing region

            ### Usage
            ```python
            import pandas as pd

            # Load annotations
            df = pd.read_csv('annotations.csv')
            
            # Filter missing regions
            missing_regions = df[df['missing_region'] == True]
            ```
            """

        # Add generation info
        readme_content += f"""

        ## Generation Information
        - **Export Tool**: Musnad OCR Data Preparation Tool
        - **Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        - **Format Version**: 1.0
        """

        return readme_content
    
    def _create_zip(self, source_dir: str, zip_path: str):
        """Create ZIP file from directory"""
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(source_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, source_dir)
                    zipf.write(file_path, arcname)
