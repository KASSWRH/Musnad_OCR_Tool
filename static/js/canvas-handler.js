// Canvas Handler for annotation management using Konva.js
class CanvasHandler {
    constructor(containerId, app) {
        this.app = app;
        this.containerId = containerId;
        this.stage = null;
        this.layer = null;
        this.imageObj = null;
        this.currentKonvaImage = null;
        this.currentImage = null;
        this.annotations = [];
        this.selectedAnnotation = null;
        this.mode = 'select'; // 'select' or 'draw'
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.tempRect = null;
        
        // Pan/drag state
        this.isPanning = false;
        this.lastPointerPosition = null;
        
        this.init();
    }
    
    init() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('Canvas container not found');
            return;
        }
        
        this.stage = new Konva.Stage({
            container: this.containerId,
            width: container.offsetWidth,
            height: container.offsetHeight
        });
        
        this.layer = new Konva.Layer();
        this.stage.add(this.layer);
        
        this.bindEvents();
        this.bindMissingRegionEvents();
        
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
        
        // Initialize zoom and rotation properties
        this.zoomLevel = 1.0;
        this.minZoom = 0.1;
        this.maxZoom = 10.0;
        this.rotationAngle = 0; // Current rotation angle in degrees
    }
    
    bindEvents() {
        // Stage mouse events
        this.stage.on('mousedown', (e) => this.handleMouseDown(e));
        this.stage.on('mousemove', (e) => this.handleMouseMove(e));
        this.stage.on('mouseup', (e) => this.handleMouseUp(e));
        
        // Keyboard events
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // Mouse wheel zoom
        this.stage.on('wheel', (e) => this.handleWheel(e));
        
        // Annotation type change event
        const annotationType = document.getElementById('annotationType');
        if (annotationType) {
            annotationType.addEventListener('change', (e) => this.handleAnnotationTypeChange(e.target.value));
        }
    }
    
    handleAnnotationTypeChange(type) {
        const missingRegionProperties = document.getElementById('missingRegionProperties');
        const textDirectionGroup = document.getElementById('textDirectionGroup');
        const annotationLevel = document.getElementById('annotationLevel');
        const konvaContainer = document.getElementById('konvaContainer');
        
        if (type === 'missing_region') {
            // Show missing region properties with animation
            if (missingRegionProperties) {
                missingRegionProperties.style.display = 'block';
                missingRegionProperties.classList.add('show');
                missingRegionProperties.classList.remove('hide');
            }
            // Hide text-specific properties
            if (textDirectionGroup) textDirectionGroup.style.display = 'none';
            if (annotationLevel) annotationLevel.parentElement.style.display = 'none';
            // Add visual feedback to canvas
            if (konvaContainer) konvaContainer.classList.add('missing-region-mode');
        } else {
            // Hide missing region properties with animation
            if (missingRegionProperties) {
                missingRegionProperties.classList.add('hide');
                missingRegionProperties.classList.remove('show');
                setTimeout(() => {
                    missingRegionProperties.style.display = 'none';
                }, 300);
            }
            // Show text-specific properties
            if (textDirectionGroup) textDirectionGroup.style.display = 'block';
            if (annotationLevel) annotationLevel.parentElement.style.display = 'block';
            // Remove visual feedback from canvas
            if (konvaContainer) konvaContainer.classList.remove('missing-region-mode');
        }
    }
    
    handleResize() {
        const container = document.getElementById(this.containerId);
        this.stage.width(container.offsetWidth);
        this.stage.height(container.offsetHeight);
        this.stage.batchDraw();
    }
    
    async loadImage(image) {
        if (!image || !image.display_path) {
            console.error('Invalid image data');
            return;
        }

        // Clear annotations and reset state completely
        this.clearAnnotations();
        this.selectedAnnotation = null;
        this.annotations = []; // Ensure empty array
        
        // Clear any temporary drawing state
        if (this.tempRect) {
            this.tempRect.destroy();
            this.tempRect = null;
        }
        
        this.currentImage = image;
        
        try {
            // Load image object
            const imageObj = new Image();
            imageObj.crossOrigin = 'anonymous';
            
            await new Promise((resolve, reject) => {
                imageObj.onload = resolve;
                imageObj.onerror = reject;
                imageObj.src = image.display_path;
            });
            
            this.setImage(imageObj);
            this.loadImageAnnotations();
            this.updateCanvasInfo();
            
        } catch (error) {
            console.error('Error loading image:', error);
            this.app.showNotification('خطأ في تحميل الصورة', 'error');
        }
    }
    
    setImage(imageObj) {
        // Remove existing image
        if (this.currentKonvaImage) {
            this.currentKonvaImage.destroy();
        }
        
        // Clear annotations again to be extra sure
        this.clearAnnotations();
        this.annotations = []; // Force empty array
        
        // Reset rotation for new image
        this.rotationAngle = 0;
        
        this.imageObj = imageObj;
        
        // Create Konva image
        this.currentKonvaImage = new Konva.Image({
            image: imageObj,
            x: 0,
            y: 0,
            rotation: 0
        });
        
        this.layer.add(this.currentKonvaImage);
        this.currentKonvaImage.moveToBottom();
        
        // Fit image to stage
        this.fitToScreen();
        
        this.layer.batchDraw();
    }
    // async loadImageAnnotations() {
    //     if (!this.currentImage) return;
        
    //     try {
    //         const response = await fetch(`${this.app.apiBase}/annotations/${this.currentImage.project_id}/${this.currentImage.id}`);
    //         const data = await response.json();
            
    //         if (response.ok) {
    //             this.annotations = data.annotations || [];
    //             // Only render annotations if they exist and belong to current image
    //             if (this.annotations.length > 0) {
    //                 this.renderAnnotations();
    //             }
    //         } else {
    //             console.warn('Failed to load annotations:', data.error);
    //             this.annotations = [];
    //         }
    //     } catch (error) {
    //         console.error('Error loading annotations:', error);
    //         this.annotations = [];
    //     }
    // }
    async loadImageAnnotations() {
        if (!this.currentImage) return;

        try {
            const response = await fetch(`${this.app.apiBase}/annotations/${this.currentImage.project_id}/${this.currentImage.id}`);
            const data = await response.json();

            // Clear old annotations from layer (visually)
            this.layer.find('.annotation').forEach(shape => shape.destroy());

            if (response.ok) {
                this.annotations = data.annotations || [];

                if (this.annotations.length > 0) {
                    this.renderAnnotations();
                } else {
                    this.layer.batchDraw(); // Redraw the layer with no annotations
                }
            } else {
                console.warn('Failed to load annotations:', data.error);
                this.annotations = [];
                this.layer.batchDraw();
            }
        } catch (error) {
            console.error('Error loading annotations:', error);
            this.annotations = [];
            this.layer.find('.annotation').forEach(shape => shape.destroy());
            this.layer.batchDraw();
        }
    }

    renderAnnotations() {
        // Clear existing annotation shapes
        this.layer.find('.annotation').forEach(shape => shape.destroy());
        
        // Only render if we have annotations
        if (this.annotations && this.annotations.length > 0) {
            // Render each annotation
            this.annotations.forEach(annotation => {
                this.addAnnotationToCanvas(annotation);
            });
        }
        
        this.layer.batchDraw();
    }
    
    // Zoom and Pan Controls
    zoomIn() {
        const newScale = Math.min(this.stage.scaleX() * 1.2, this.maxZoom);
        this.setZoomToCenter(newScale);
    }
    
    zoomOut() {
        const newScale = Math.max(this.stage.scaleX() / 1.2, this.minZoom);
        this.setZoomToCenter(newScale);
    }
    
    setZoomToCenter(scale) {
        const stageWidth = this.stage.width();
        const stageHeight = this.stage.height();
        
        const centerX = stageWidth / 2;
        const centerY = stageHeight / 2;
        
        const oldScale = this.stage.scaleX();
        
        const mousePointTo = {
            x: (centerX - this.stage.x()) / oldScale,
            y: (centerY - this.stage.y()) / oldScale
        };
        
        this.stage.scale({ x: scale, y: scale });
        
        const newPos = {
            x: centerX - mousePointTo.x * scale,
            y: centerY - mousePointTo.y * scale
        };
        
        this.stage.position(newPos);
        
        // Update annotation stroke widths for new scale
        this.updateAnnotationStrokeWidths();
        
        this.stage.batchDraw();
        this.updateZoomLevel();
    }
    
    resetZoom() {
        this.stage.scale({ x: 1, y: 1 });
        this.stage.position({ x: 0, y: 0 });
        this.stage.batchDraw();
        this.updateZoomLevel();
    }
    
    resetAll() {
        // Reset both zoom and rotation
        this.resetZoom();
        this.resetRotation();
        this.fitToScreen();
    }
    
    fitToScreen() {
        if (!this.currentKonvaImage) return;
        
        const stageWidth = this.stage.width();
        const stageHeight = this.stage.height();
        
        // Calculate effective dimensions considering rotation
        let effectiveWidth, effectiveHeight;
        const imageWidth = this.imageObj.width;
        const imageHeight = this.imageObj.height;
        const radians = (this.rotationAngle * Math.PI) / 180;
        
        if (this.rotationAngle % 180 === 0) {
            effectiveWidth = imageWidth;
            effectiveHeight = imageHeight;
        } else {
            effectiveWidth = Math.abs(imageWidth * Math.cos(radians)) + Math.abs(imageHeight * Math.sin(radians));
            effectiveHeight = Math.abs(imageWidth * Math.sin(radians)) + Math.abs(imageHeight * Math.cos(radians));
        }
        
        const scaleX = (stageWidth - 40) / effectiveWidth;
        const scaleY = (stageHeight - 40) / effectiveHeight;
        const scale = Math.min(scaleX, scaleY);
        
        this.stage.scale({ x: scale, y: scale });
        
        // Center the stage considering rotation
        const x = (stageWidth - effectiveWidth * scale) / 2;
        const y = (stageHeight - effectiveHeight * scale) / 2;
        
        this.stage.position({ x, y });
        this.stage.batchDraw();
        
        this.updateZoomLevel();
    }
    
    updateZoomLevel() {
        this.zoomLevel = this.stage.scaleX();
        const zoomPercent = Math.round(this.zoomLevel * 100);
        
        // Update zoom display if exists
        const zoomDisplay = document.getElementById('zoomLevel');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${zoomPercent}%`;
        }
        
        // Update rotation display and controls
        const rotationDisplay = document.getElementById('rotationAngle');
        if (rotationDisplay) {
            rotationDisplay.textContent = `${this.rotationAngle}°`;
        }
        
        const rotationSlider = document.getElementById('rotationSlider');
        if (rotationSlider) {
            rotationSlider.value = this.rotationAngle;
        }
        
        const rotationInput = document.getElementById('rotationInput');
        if (rotationInput) {
            rotationInput.value = this.rotationAngle;
        }
        
        // Update canvas info
        this.updateCanvasInfo();
    }
    
    // Rotation Controls
    rotateClockwise() {
        this.rotationAngle = (this.rotationAngle + 90) % 360;
        this.applyRotation();
    }
    
    rotateCounterClockwise() {
        this.rotationAngle = (this.rotationAngle - 90 + 360) % 360;
        this.applyRotation();
    }
    
    rotateToAngle(angle) {
        this.rotationAngle = angle % 360;
        if (this.rotationAngle < 0) this.rotationAngle += 360;
        this.applyRotation();
    }
    
    applyRotation() {
        if (!this.currentKonvaImage) return;
        
        // Get image center
        const imageWidth = this.imageObj.width;
        const imageHeight = this.imageObj.height;
        const centerX = imageWidth / 2;
        const centerY = imageHeight / 2;
        
        // Apply rotation around image center
        this.currentKonvaImage.rotation(this.rotationAngle);
        this.currentKonvaImage.offsetX(centerX);
        this.currentKonvaImage.offsetY(centerY);
        this.currentKonvaImage.x(centerX);
        this.currentKonvaImage.y(centerY);
        
        // Update annotation stroke width for current scale
        this.updateAnnotationStrokeWidths();
        
        this.layer.batchDraw();
        this.updateZoomLevel();
    }
    
    updateAnnotationStrokeWidths() {
        // Update stroke widths for all annotations based on current scale
        const currentScale = this.stage.scaleX();
        this.layer.find('.annotation').forEach(group => {
            const rect = group.findOne('.main-rect');
            if (rect) {
                rect.strokeWidth(2 / currentScale);
            }
            
            // Update handle sizes
            group.find('[name^="handle-"]').forEach(handle => {
                handle.radius(4 / currentScale);
                handle.strokeWidth(1 / currentScale);
            });
            
            // Update label font size
            const label = group.findOne('.label-text');
            if (label) {
                label.fontSize(14 / currentScale);
            }
        });
    }
    
    resetRotation() {
        this.rotationAngle = 0;
        if (this.currentKonvaImage) {
            this.currentKonvaImage.rotation(0);
            this.currentKonvaImage.offsetX(0);
            this.currentKonvaImage.offsetY(0);
            this.currentKonvaImage.x(0);
            this.currentKonvaImage.y(0);
        }
        this.layer.batchDraw();
        this.updateZoomLevel();
    }
    
    // Mouse Event Handlers
    handleMouseDown(e) {
        // Check if clicking on empty space (stage or image background)
        const clickedOnEmpty = e.target === this.stage || e.target === this.currentKonvaImage;
        
        if (this.mode === 'draw' && clickedOnEmpty) {
            this.startDrawing(e);
        } else if (this.mode === 'select' && clickedOnEmpty && e.evt.button === 0) {
            // Left click on empty space - start panning
            this.isPanning = true;
            this.lastPointerPosition = this.stage.getPointerPosition();
            this.stage.container().style.cursor = 'grabbing';
        }
    }
    
    handleMouseMove(e) {
        if (this.mode === 'draw' && this.isDrawing) {
            this.updateDrawing(e);
        } else if (this.isPanning && this.lastPointerPosition) {
            // Handle panning
            const currentPos = this.stage.getPointerPosition();
            const dx = currentPos.x - this.lastPointerPosition.x;
            const dy = currentPos.y - this.lastPointerPosition.y;
            
            const currentStagePos = this.stage.position();
            this.stage.position({
                x: currentStagePos.x + dx,
                y: currentStagePos.y + dy
            });
            
            this.lastPointerPosition = currentPos;
            this.stage.batchDraw();
        }
    }
    
    handleMouseUp(e) {
        if (this.mode === 'draw' && this.isDrawing) {
            this.finishDrawing(e);
        }
        
        // Stop panning
        if (this.isPanning) {
            this.isPanning = false;
            this.lastPointerPosition = null;
            this.stage.container().style.cursor = this.mode === 'draw' ? 'crosshair' : 'default';
        }
        
        this.isDrawing = false;
    }
    
    handleWheel(e) {
        e.evt.preventDefault();
        
        const oldScale = this.stage.scaleX();
        const pointer = this.stage.getPointerPosition();
        
        const mousePointTo = {
            x: (pointer.x - this.stage.x()) / oldScale,
            y: (pointer.y - this.stage.y()) / oldScale,
        };
        
        const direction = e.evt.deltaY > 0 ? -1 : 1;
        const factor = 1.1;
        const newScale = direction > 0 ? oldScale * factor : oldScale / factor;
        
        const clampedScale = Math.max(this.minZoom, Math.min(this.maxZoom, newScale));
        
        this.stage.scale({ x: clampedScale, y: clampedScale });
        
        const newPos = {
            x: pointer.x - mousePointTo.x * clampedScale,
            y: pointer.y - mousePointTo.y * clampedScale,
        };
        
        this.stage.position(newPos);
        this.stage.batchDraw();
        this.updateZoomLevel();
    }
    
    handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        switch (e.key) {
            case 'Delete':
            case 'Backspace':
                if (this.selectedAnnotation) {
                    e.preventDefault();
                    this.deleteSelectedAnnotation();
                }
                break;
            case 'Escape':
                this.deselectAll();
                break;
            // Zoom shortcuts
            case '+':
            case '=':
                e.preventDefault();
                this.zoomIn();
                break;
            case '-':
                e.preventDefault();
                this.zoomOut();
                break;
            case '0':
                e.preventDefault();
                this.resetZoom();
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                this.fitToScreen();
                break;
            // Rotation shortcuts
            case 'r':
            case 'R':
                e.preventDefault();
                if (e.shiftKey) {
                    this.rotateCounterClockwise();
                } else {
                    this.rotateClockwise();
                }
                break;
            case 'ArrowLeft':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.rotateCounterClockwise();
                }
                break;
            case 'ArrowRight':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.rotateClockwise();
                }
                break;
        }
    }
    
    // Drawing Functions
    startDrawing(e) {
        this.isDrawing = true;
        const pos = this.stage.getPointerPosition();
        
        // Convert to image coordinates
        const transform = this.stage.getAbsoluteTransform().copy();
        transform.invert();
        const localPos = transform.point(pos);
        
        this.startX = localPos.x;
        this.startY = localPos.y;
        
        // Create temporary rectangle
        this.tempRect = new Konva.Rect({
            x: localPos.x,
            y: localPos.y,
            width: 0,
            height: 0,
            stroke: '#007bff',
            strokeWidth: 2 / this.stage.scaleX(),
            fill: 'rgba(0, 123, 255, 0.1)',
            dash: [5, 5],
            name: 'temp-rect'
        });
        
        this.layer.add(this.tempRect);
        this.layer.batchDraw();
    }
    
    updateDrawing(e) {
        if (!this.tempRect) return;
        
        const pos = this.stage.getPointerPosition();
        const transform = this.stage.getAbsoluteTransform().copy();
        transform.invert();
        const localPos = transform.point(pos);
        
        const width = localPos.x - this.startX;
        const height = localPos.y - this.startY;
        
        this.tempRect.width(Math.abs(width));
        this.tempRect.height(Math.abs(height));
        this.tempRect.x(width < 0 ? localPos.x : this.startX);
        this.tempRect.y(height < 0 ? localPos.y : this.startY);
        
        this.layer.batchDraw();
    }
    
    finishDrawing(e) {
        if (!this.tempRect) return;
        
        const width = this.tempRect.width();
        const height = this.tempRect.height();
        
        // Only create annotation if rectangle is large enough
        if (width > 10 && height > 10) {
            const bbox = {
                x: this.tempRect.x(),
                y: this.tempRect.y(),
                width: width,
                height: height
            };
            
            this.createAnnotation(bbox);
        }
        
        // Remove temporary rectangle
        this.tempRect.destroy();
        this.tempRect = null;
        this.layer.batchDraw();
    }
    
    // Annotation Management
    createAnnotation(bbox) {
        const annotationType = document.getElementById('annotationType')?.value || 'text';
        
        const annotation = {
            id: this.generateId(),
            type: 'bbox',
            annotation_type: annotationType,
            level: document.getElementById('annotationLevel')?.value || 'word',
            label: '',
            bbox: bbox,
            direction: document.getElementById('textDirection')?.value || 'rtl',
            confidence: parseInt(document.getElementById('confidenceSlider')?.value || '90'),
            created_at: new Date().toISOString()
        };
        
        // Add missing region specific properties
        if (annotationType === 'missing_region') {
            annotation.missing_region = true;
            annotation.max_chars = parseInt(document.getElementById('maxChars')?.value || '5');
            annotation.reason = document.getElementById('damageReason')?.value || 'damaged';
            annotation.notes = document.getElementById('missingRegionNotes')?.value || '';
            annotation.label = `[مفقود: ${annotation.max_chars} أحرف]`;
        } else {
            annotation.missing_region = false;
        }
        
        this.addAnnotationToCanvas(annotation);
        this.annotations.push(annotation);
        
        // Select the new annotation
        this.selectAnnotation(annotation.id);
        
        // Auto-save
        this.autoSave();
    }
    
    addAnnotationToCanvas(annotation) {
        const group = new Konva.Group({
            id: annotation.id,
            draggable: true,
            name: 'annotation'
        });
        
        // Main rectangle - different colors for missing regions
        const isMissingRegion = annotation.missing_region || annotation.annotation_type === 'missing_region';
        const strokeColor = isMissingRegion ? '#dc3545' : '#007bff';
        const fillColor = isMissingRegion ? 'rgba(220, 53, 69, 0.2)' : 'rgba(0, 123, 255, 0.1)';
        
        const rect = new Konva.Rect({
            x: annotation.bbox.x,
            y: annotation.bbox.y,
            width: annotation.bbox.width,
            height: annotation.bbox.height,
            stroke: strokeColor,
            strokeWidth: 2 / this.stage.scaleX(),
            fill: fillColor,
            name: 'main-rect'
        });
        
        // Add dashed stroke for missing regions
        if (isMissingRegion) {
            rect.dash([10, 5]);
        }
        
        group.add(rect);
        
        // Label text
        if (annotation.label) {
            const label = new Konva.Text({
                x: annotation.bbox.x,
                y: annotation.bbox.y - 25 / this.stage.scaleY(),
                text: annotation.label,
                fontSize: 14 / this.stage.scaleY(),
                fontFamily: 'Arial',
                fill: '#007bff',
                background: '#ffffff',
                padding: 2,
                name: 'label-text'
            });
            group.add(label);
        }
        
        // Add resize handles
        this.addResizeHandles(group, annotation);
        
        // Event handlers
        group.on('click', (e) => {
            e.cancelBubble = true;
            this.selectAnnotation(annotation.id);
        });
        
        group.on('dragmove', () => {
            this.updateAnnotationPosition(annotation.id, group.position());
        });
        
        this.layer.add(group);
    }
    
    addResizeHandles(group, annotation) {
        const bbox = annotation.bbox;
        const handleSize = 8 / this.stage.scaleX();
        
        const positions = [
            { x: bbox.x, y: bbox.y, cursor: 'nw-resize' },
            { x: bbox.x + bbox.width, y: bbox.y, cursor: 'ne-resize' },
            { x: bbox.x + bbox.width, y: bbox.y + bbox.height, cursor: 'se-resize' },
            { x: bbox.x, y: bbox.y + bbox.height, cursor: 'sw-resize' }
        ];
        
        positions.forEach((pos, index) => {
            const handle = new Konva.Circle({
                x: pos.x,
                y: pos.y,
                radius: handleSize / 2,
                fill: '#007bff',
                stroke: '#ffffff',
                strokeWidth: 1 / this.stage.scaleX(),
                name: `handle-${index}`,
                visible: false,
                draggable: true
            });
            
            handle.on('dragmove', () => {
                this.handleResize(annotation.id, index, handle.position());
            });
            
            group.add(handle);
        });
    }
    
    selectAnnotation(annotationId) {
        this.deselectAll();
        
        const group = this.stage.findOne(`#${annotationId}`);
        if (!group) return;
        
        // Highlight selection
        const rect = group.findOne('.main-rect');
        if (rect) {
            rect.stroke('#dc3545');
            rect.strokeWidth(3 / this.stage.scaleX());
        }
        
        // Show resize handles
        group.find('[name^="handle-"]').forEach(handle => {
            handle.visible(true);
        });
        
        this.selectedAnnotation = group;
        
        // Update UI controls
        const annotation = this.annotations.find(ann => ann.id === annotationId);
        if (annotation) {
            this.updateAnnotationControls(annotation);
        }
        
        // Enable delete button
        const deleteBtn = document.getElementById('deleteAnnotationBtn');
        if (deleteBtn) {
            deleteBtn.disabled = false;
        }
        
        this.layer.batchDraw();
    }
    
    updateAnnotationControls(annotation) {
        const labelInput = document.getElementById('labelInput');
        const annotationType = document.getElementById('annotationType');
        const annotationLevel = document.getElementById('annotationLevel');
        const textDirection = document.getElementById('textDirection');
        const confidenceSlider = document.getElementById('confidenceSlider');
        
        // Update annotation type
        const isMissingRegion = annotation.missing_region || annotation.annotation_type === 'missing_region';
        if (annotationType) {
            annotationType.value = isMissingRegion ? 'missing_region' : 'text';
            this.handleAnnotationTypeChange(annotationType.value);
        }
        
        if (labelInput) labelInput.value = annotation.label || '';
        if (annotationLevel) annotationLevel.value = annotation.level || 'word';
        if (textDirection) textDirection.value = annotation.direction || 'rtl';
        if (confidenceSlider) {
            confidenceSlider.value = annotation.confidence || 90;
            const display = confidenceSlider.nextElementSibling;
            if (display) display.textContent = `${annotation.confidence || 90}%`;
        }
        
        // Update missing region specific controls
        if (isMissingRegion) {
            const maxChars = document.getElementById('maxChars');
            const damageReason = document.getElementById('damageReason');
            const missingRegionNotes = document.getElementById('missingRegionNotes');
            
            if (maxChars) maxChars.value = annotation.max_chars || 5;
            if (damageReason) damageReason.value = annotation.reason || 'damaged';
            if (missingRegionNotes) missingRegionNotes.value = annotation.notes || '';
        }
    }
    
    deselectAll() {
        if (this.selectedAnnotation) {
            // Reset stroke
            const rect = this.selectedAnnotation.findOne('.main-rect');
            if (rect) {
                rect.stroke('#007bff');
                rect.strokeWidth(2 / this.stage.scaleX());
            }
            
            // Hide resize handles
            this.selectedAnnotation.find('[name^="handle-"]').forEach(handle => {
                handle.visible(false);
            });
            
            this.selectedAnnotation = null;
            
            // Disable delete button
            const deleteBtn = document.getElementById('deleteAnnotationBtn');
            if (deleteBtn) {
                deleteBtn.disabled = true;
            }
            
            this.layer.batchDraw();
        }
    }
    
    deleteSelectedAnnotation() {
        if (!this.selectedAnnotation) return;
        
        const annotationId = this.selectedAnnotation.id();
        
        // Remove from canvas
        this.selectedAnnotation.destroy();
        this.selectedAnnotation = null;
        
        // Remove from annotations array
        this.annotations = this.annotations.filter(ann => ann.id !== annotationId);
        
        // Disable delete button
        const deleteBtn = document.getElementById('deleteAnnotationBtn');
        if (deleteBtn) {
            deleteBtn.disabled = true;
        }
        
        this.layer.batchDraw();
        
        // Auto-save
        this.autoSave();
    }
    
    // Mode Management
    setMode(mode) {
        this.mode = mode;
        this.stage.container().style.cursor = mode === 'draw' ? 'crosshair' : 'default';
        
        if (mode === 'select') {
            this.deselectAll();
        }
    }
    
    // Annotation Property Updates
    updateSelectedAnnotationLabel(label) {
        if (!this.selectedAnnotation) return;
        
        const annotationId = this.selectedAnnotation.id();
        const annotation = this.annotations.find(ann => ann.id === annotationId);
        
        if (annotation) {
            annotation.label = label;
            
            // Update visual label
            this.updateAnnotationLabel(this.selectedAnnotation, label);
            this.layer.batchDraw();
            
            this.autoSave();
        }
    }
    
    updateAnnotationLabel(group, label) {
        // Remove existing label
        const existingLabel = group.findOne('.label-text');
        if (existingLabel) {
            existingLabel.destroy();
        }
        
        // Add new label if not empty
        if (label && label.trim()) {
            const rect = group.findOne('.main-rect');
            const labelText = new Konva.Text({
                x: rect.x(),
                y: rect.y() - 25 / this.stage.scaleY(),
                text: label.trim(),
                fontSize: 14 / this.stage.scaleY(),
                fontFamily: 'Arial',
                fill: '#007bff',
                background: '#ffffff',
                padding: 2,
                name: 'label-text'
            });
            group.add(labelText);
        }
    }
    
    updateSelectedAnnotationLevel(level) {
        if (!this.selectedAnnotation) return;
        
        const annotationId = this.selectedAnnotation.id();
        const annotation = this.annotations.find(ann => ann.id === annotationId);
        
        if (annotation) {
            annotation.level = level;
            this.autoSave();
        }
    }
    
    updateSelectedAnnotationDirection(direction) {
        if (!this.selectedAnnotation) return;
        
        const annotationId = this.selectedAnnotation.id();
        const annotation = this.annotations.find(ann => ann.id === annotationId);
        
        if (annotation) {
            annotation.direction = direction;
            this.autoSave();
        }
    }
    
    updateSelectedAnnotationConfidence(confidence) {
        if (!this.selectedAnnotation) return;
        
        const annotationId = this.selectedAnnotation.id();
        const annotation = this.annotations.find(ann => ann.id === annotationId);
        
        if (annotation) {
            annotation.confidence = confidence;
            this.autoSave();
        }
    }
    
    // Utility Methods
    updateAnnotationPosition(annotationId, position) {
        const annotation = this.annotations.find(ann => ann.id === annotationId);
        const group = this.stage.findOne(`#${annotationId}`);
        if (annotation && group) {
            const rect = group.findOne('.main-rect');
            const offsetX = rect ? rect.x() : 0;
            const offsetY = rect ? rect.y() : 0;
            annotation.bbox.x = position.x + offsetX;
            annotation.bbox.y = position.y + offsetY;
            this.autoSave();
        }
    }
    
    handleResize(annotationId, handleIndex, position) {
        const annotation = this.annotations.find(ann => ann.id === annotationId);
        const group = this.stage.findOne(`#${annotationId}`);
        
        if (!annotation || !group) return;
        
        const rect = group.findOne('.main-rect');
        const bbox = annotation.bbox;
        
        // Convert handle local position (relative to group) to absolute canvas coordinates
        const absX = position.x + group.x();
        const absY = position.y + group.y();
        
        // Update bbox based on handle absolute position
        switch (handleIndex) {
            case 0: // Top-left
                bbox.width += bbox.x - absX;
                bbox.height += bbox.y - absY;
                bbox.x = absX;
                bbox.y = absY;
                break;
            case 2: // Bottom-right
                bbox.width = absX - bbox.x;
                bbox.height = absY - bbox.y;
                break;
        }
        
        // Update rectangle
        rect.x(bbox.x);
        rect.y(bbox.y);
        rect.width(bbox.width);
        rect.height(bbox.height);
        
        // Update other handles
        this.updateResizeHandles(group, bbox);
        
        this.layer.batchDraw();
        this.autoSave();
    }
    
    updateResizeHandles(group, bbox) {
        const handles = group.find('[name^="handle-"]');
        const positions = [
            { x: bbox.x, y: bbox.y },
            { x: bbox.x + bbox.width, y: bbox.y },
            { x: bbox.x + bbox.width, y: bbox.y + bbox.height },
            { x: bbox.x, y: bbox.y + bbox.height }
        ];
        
        handles.forEach((handle, index) => {
            handle.position(positions[index]);
        });
    }
    
    clearAnnotations() {
        // Clear all annotation shapes from layer
        this.layer.find('.annotation').forEach(shape => shape.destroy());
        
        // Also clear any shapes that might have different class names
        this.layer.find('Group').forEach(group => {
            if (group.name() && group.name().includes('annotation')) {
                group.destroy();
            }
        });
        
        // Reset annotations array
        this.annotations = [];
        this.selectedAnnotation = null;
        
        // Disable delete button since no annotation is selected
        const deleteBtn = document.getElementById('deleteAnnotationBtn');
        if (deleteBtn) {
            deleteBtn.disabled = true;
        }
        
        // Clear annotation controls
        const labelInput = document.getElementById('labelInput');
        if (labelInput) labelInput.value = '';
        
        // Force redraw
        this.layer.batchDraw();
    }
    
    getAnnotations() {
        return this.annotations;
    }
    
    updateCanvasInfo() {
        const infoElement = document.getElementById('canvasInfo');
        if (infoElement && this.currentImage) {
            infoElement.textContent = `${this.currentImage.filename} | ${this.currentImage.width}×${this.currentImage.height} | ${this.annotations.length} توسيم | تكبير: ${Math.round(this.zoomLevel * 100)}% | دوران: ${this.rotationAngle}°`;
        }
    }
    
    generateId() {
        return 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    autoSave() {
        // Debounced auto-save
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            if (this.app && this.app.saveCurrentAnnotations) {
                this.app.saveCurrentAnnotations();
            }
        }, 2000);
    }
    
    // Missing Region specific methods
    updateSelectedMissingRegion() {
        if (!this.selectedAnnotation) return;
        
        const annotationId = this.selectedAnnotation.id();
        const annotation = this.annotations.find(ann => ann.id === annotationId);
        
        if (annotation && (annotation.missing_region || annotation.annotation_type === 'missing_region')) {
            const maxChars = document.getElementById('maxChars')?.value || 5;
            const reason = document.getElementById('damageReason')?.value || 'damaged';
            const notes = document.getElementById('missingRegionNotes')?.value || '';
            
            annotation.max_chars = parseInt(maxChars);
            annotation.reason = reason;
            annotation.notes = notes;
            annotation.label = `[مفقود: ${maxChars} أحرف]`;
            
            // Update visual label
            this.updateAnnotationLabel(this.selectedAnnotation, annotation.label);
            this.autoSave();
        }
    }
    
    // Add event listeners for missing region controls
    bindMissingRegionEvents() {
        const maxChars = document.getElementById('maxChars');
        const damageReason = document.getElementById('damageReason');
        const missingRegionNotes = document.getElementById('missingRegionNotes');
        
        if (maxChars) {
            maxChars.addEventListener('input', () => this.updateSelectedMissingRegion());
        }
        
        if (damageReason) {
            damageReason.addEventListener('change', () => this.updateSelectedMissingRegion());
        }
        
        if (missingRegionNotes) {
            missingRegionNotes.addEventListener('input', () => this.updateSelectedMissingRegion());
        }
    }
    
    generateId() {
        return 'ann_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}
