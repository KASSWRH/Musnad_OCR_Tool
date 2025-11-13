// Review Handler for viewing annotated images
class ReviewHandler {
    constructor(app) {
        this.app = app;
        this.stage = null;
        this.layer = null;
        this.currentImage = null;
        this.currentImageObj = null;
        this.currentKonvaImage = null;
        this.filteredImages = [];
        this.currentIndex = -1;
        this.annotations = [];
        
        // Zoom and pan state
        this.zoomLevel = 1.0;
        this.minZoom = 0.1;
        this.maxZoom = 10.0;
        
        this.init();
    }
    
    init() {
        this.initCanvas();
        this.bindEvents();
    }
    
    initCanvas() {
        const container = document.getElementById('reviewCanvas');
        if (!container) {
            console.error('Review canvas container not found');
            return;
        }
        
        this.stage = new Konva.Stage({
            container: 'reviewCanvas',
            width: container.offsetWidth,
            height: container.offsetHeight
        });
        
        this.layer = new Konva.Layer();
        this.stage.add(this.layer);
        
        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
        
        // Mouse wheel zoom
        this.stage.on('wheel', (e) => this.handleWheel(e));
    }
    
    bindEvents() {
        // Filter controls
        const applyFilterBtn = document.getElementById('applyReviewFilter');
        if (applyFilterBtn) {
            applyFilterBtn.addEventListener('click', () => this.applyFilters());
        }
        
        // Navigation controls
        const prevBtn = document.getElementById('prevReviewImage');
        const nextBtn = document.getElementById('nextReviewImage');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.navigatePrevious());
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.navigateNext());
        }
        
        // Zoom controls
        const zoomInBtn = document.getElementById('reviewZoomIn');
        const zoomOutBtn = document.getElementById('reviewZoomOut');
        const fitScreenBtn = document.getElementById('reviewFitScreen');
        
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoomIn());
        }
        
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoomOut());
        }
        
        if (fitScreenBtn) {
            fitScreenBtn.addEventListener('click', () => this.fitToScreen());
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }
    
    async loadAnnotatedImages() {
        if (!this.app.currentProject) {
            console.error('No project selected');
            return;
        }
        
        try {
            // Get both annotated and completed images
            const [annotatedResponse, completedResponse] = await Promise.all([
                fetch(`${this.app.apiBase}/images/${this.app.currentProject.id}?status=annotated`),
                fetch(`${this.app.apiBase}/images/${this.app.currentProject.id}?status=completed`)
            ]);
            
            const annotatedData = annotatedResponse.ok ? await annotatedResponse.json() : { images: [] };
            const completedData = completedResponse.ok ? await completedResponse.json() : { images: [] };
            
            this.allImages = [...(annotatedData.images || []), ...(completedData.images || [])];
            
            if (this.allImages.length === 0) {
                this.showEmptyState();
                return;
            }
            
            this.applyFilters();
            
        } catch (error) {
            console.error('Error loading annotated images:', error);
            this.app.showNotification('خطأ في تحميل الصور المرسّمة', 'error');
            this.showEmptyState();
        }
    }
    
    applyFilters() {
        const levelFilter = document.getElementById('reviewLevelFilter').value;
        const statusFilter = document.getElementById('reviewStatusFilter').value;
        
        this.filteredImages = this.allImages.filter(image => {
            // Status filter
            if (statusFilter !== 'all') {
                if (statusFilter === 'annotated' && image.status !== 'annotated') return false;
                if (statusFilter === 'completed' && image.status !== 'completed') return false;
            }
            
            // Level filter - check if image has annotations of the specified level
            if (levelFilter !== 'all' && image.annotations_count > 0) {
                // We need to load annotations to check levels
                return true; // Will be filtered when loading individual annotations
            }
            
            return image.annotations_count > 0; // Only show images with annotations
        });
        
        this.currentIndex = -1;
        this.updateNavigationState();
        
        if (this.filteredImages.length > 0) {
            this.navigateNext();
        } else {
            this.clearCanvas();
            this.updateImageInfo(null);
            this.app.showNotification(window.i18n.t('review.no_match'), 'info');
        }
    }
    
    async loadImageAnnotations(image) {
        try {
            const response = await fetch(`${this.app.apiBase}/annotations/${image.project_id}/${image.id}`);
            const data = await response.json();
            
            if (response.ok) {
                return data.annotations || [];
            } else {
                console.warn('Failed to load annotations:', data.error);
                return [];
            }
        } catch (error) {
            console.error('Error loading annotations:', error);
            return [];
        }
    }
    
    async loadImage(image) {
        if (!image || !image.display_path) {
            console.error('Invalid image data');
            return;
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
            
            this.currentImageObj = imageObj;
            this.setImage(imageObj);
            
            // Load annotations
            this.annotations = await this.loadImageAnnotations(image);
            
            // Apply level filter to annotations
            const levelFilter = document.getElementById('reviewLevelFilter').value;
            if (levelFilter !== 'all') {
                if (levelFilter === 'missing_region') {
                    this.annotations = this.annotations.filter(ann => 
                        ann.missing_region || ann.annotation_type === 'missing_region'
                    );
                } else {
                    this.annotations = this.annotations.filter(ann => ann.level === levelFilter);
                }
            }
            
            this.renderAnnotations();
            this.updateImageInfo(image);
            this.updateCanvasInfo();
            
        } catch (error) {
            console.error('Error loading image:', error);
            this.app.showNotification(window.i18n.t('status.error_load'), 'error');
        }
    }
    
    setImage(imageObj) {
        // Remove existing image
        if (this.currentKonvaImage) {
            this.currentKonvaImage.destroy();
        }
        
        // Clear annotations
        this.clearAnnotations();
        
        // Create Konva image
        this.currentKonvaImage = new Konva.Image({
            image: imageObj,
            x: 0,
            y: 0
        });
        
        this.layer.add(this.currentKonvaImage);
        this.currentKonvaImage.moveToBottom();
        
        // Fit image to stage
        this.fitToScreen();
        
        this.layer.batchDraw();
    }
    
    renderAnnotations() {
        // Clear existing annotation shapes
        this.layer.find('.review-annotation').forEach(shape => shape.destroy());
        
        // Render each annotation
        this.annotations.forEach(annotation => {
            this.addAnnotationToCanvas(annotation);
        });
        
        this.layer.batchDraw();
    }
    
    addAnnotationToCanvas(annotation) {
        if (!annotation.bbox) return;
        
        const group = new Konva.Group({
            name: 'review-annotation'
        });
        
        // Different colors for different levels and missing regions
        let strokeColor = '#007bff';
        let fillColor = 'rgba(0, 123, 255, 0.1)';
        
        if (annotation.missing_region || annotation.annotation_type === 'missing_region') {
            strokeColor = '#dc3545';
            fillColor = 'rgba(220, 53, 69, 0.2)';
        } else {
            switch (annotation.level) {
                case 'character':
                    strokeColor = '#28a745';
                    fillColor = 'rgba(40, 167, 69, 0.1)';
                    break;
                case 'word':
                    strokeColor = '#007bff';
                    fillColor = 'rgba(0, 123, 255, 0.1)';
                    break;
                case 'line':
                    strokeColor = '#ffc107';
                    fillColor = 'rgba(255, 193, 7, 0.1)';
                    break;
                case 'paragraph':
                    strokeColor = '#6f42c1';
                    fillColor = 'rgba(111, 66, 193, 0.1)';
                    break;
            }
        }
        
        // Main rectangle
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
        if (annotation.missing_region || annotation.annotation_type === 'missing_region') {
            rect.dash([10, 5]);
        }
        
        group.add(rect);
        
        // Label text
        if (annotation.label) {
            // const label = new Konva.Text({
            //     x: annotation.bbox.x,
            //     y: annotation.bbox.y - 10 / this.stage.scaleY(),
            //     text: annotation.label,
            //     fontSize: 50 / this.stage.scaleY(),
            //     fontFamily: 'Arial',
            //     fill: strokeColor,
            //     background: '#ffffff',
            //     padding: 2,
            //     name: 'label-text'
            // });
            const label = new Konva.Text({
                x: annotation.bbox.x + 4, // مسافة بسيطة من اليسار
                y: annotation.bbox.y - 22, // فوق البوكس مباشرة
                text: annotation.label || '',
                fontSize: 16, // حجم ثابت (لن يتأثر بالتكبير)
                fontFamily: 'Amiri, "Cairo", Arial, sans-serif', // خط عربي جميل
                fill: strokeColor,
                padding: 3,
                align: 'center',
                name: 'label-text',
                listening: false // لا يتفاعل مع الماوس
            });
            group.add(label);
        }
        
        // Level indicator
        // const levelIndicator = new Konva.Text({
        //     x: annotation.bbox.x + annotation.bbox.width - 30,
        //     y: annotation.bbox.y - 25 / this.stage.scaleY(),
        //     text: this.getLevelShortName(annotation),
        //     fontSize: 20 / this.stage.scaleY(),
        //     fontFamily: 'Arial',
        //     fill: strokeColor,
        //     fontStyle: 'bold',
        //     name: 'level-indicator'
        // });
        // group.add(levelIndicator);
        
        this.layer.add(group);
    }
    
    getLevelShortName(annotation) {
        if (annotation.missing_region || annotation.annotation_type === 'missing_region') {
            return 'مفقود';
        }
        
        switch (annotation.level) {
            case 'character': return 'ح';
            case 'word': return 'ك';
            case 'line': return 'س';
            case 'paragraph': return 'ف';
            default: return '؟';
        }
    }
    
    clearAnnotations() {
        this.layer.find('.review-annotation').forEach(shape => shape.destroy());
    }
    
    clearCanvas() {
        if (this.currentKonvaImage) {
            this.currentKonvaImage.destroy();
            this.currentKonvaImage = null;
        }
        this.clearAnnotations();
        this.layer.batchDraw();
    }
    
    navigatePrevious() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.loadImage(this.filteredImages[this.currentIndex]);
            this.updateNavigationState();
        }
    }
    
    navigateNext() {
        if (this.currentIndex < this.filteredImages.length - 1) {
            this.currentIndex++;
            this.loadImage(this.filteredImages[this.currentIndex]);
            this.updateNavigationState();
        }
    }
    
    updateNavigationState() {
        const prevBtn = document.getElementById('prevReviewImage');
        const nextBtn = document.getElementById('nextReviewImage');
        const counter = document.getElementById('reviewImageCounter');
        
        if (prevBtn) {
            prevBtn.disabled = this.currentIndex <= 0;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentIndex >= this.filteredImages.length - 1;
        }
        
        if (counter) {
            const current = this.currentIndex >= 0 ? this.currentIndex + 1 : 0;
            counter.textContent = `${current} / ${this.filteredImages.length}`;
        }
    }
    
    updateImageInfo(image) {
        const infoContainer = document.getElementById('reviewImageInfo');
        if (!infoContainer) return;
        
        if (!image) {
            infoContainer.innerHTML = '<p class="text-muted text-center">اختر صورة للاستعراض</p>';
            return;
        }
        
        const annotationCount = this.annotations.length;
        const levelCounts = {};
        
        this.annotations.forEach(ann => {
            const level = ann.missing_region || ann.annotation_type === 'missing_region' ? 'missing_region' : ann.level;
            levelCounts[level] = (levelCounts[level] || 0) + 1;
        });
        
        infoContainer.innerHTML = `
            <div class="mb-2">
                <strong>${image.filename}</strong>
            </div>
            <div class="mb-2">
                <small class="text-muted">الأبعاد: ${image.width} × ${image.height}</small>
            </div>
            <div class="mb-2">
                <small class="text-muted">الحالة: ${this.getStatusText(image.status)}</small>
            </div>
            <div class="mb-2">
                <small class="text-muted">إجمالي التوسيمات: ${annotationCount}</small>
            </div>
            ${Object.keys(levelCounts).length > 0 ? `
                <div class="mt-2">
                    <small class="text-muted d-block mb-1">توزيع التوسيمات:</small>
                    ${Object.entries(levelCounts).map(([level, count]) => 
                        `<small class="badge bg-secondary me-1">${this.getLevelText(level)}: ${count}</small>`
                    ).join('')}
                </div>
            ` : ''}
        `;
    }
    
    getStatusText(status) {
        switch (status) {
            case 'annotated': return 'مرسّمة';
            case 'completed': return 'مكتملة';
            default: return status;
        }
    }
    
    getLevelText(level) {
        switch (level) {
            case 'character': return 'حرف';
            case 'word': return 'كلمة';
            case 'line': return 'سطر';
            case 'paragraph': return 'فقرة';
            case 'missing_region': return 'مفقود';
            default: return level;
        }
    }
    
    updateCanvasInfo() {
        const infoElement = document.getElementById('reviewCanvasInfo');
        if (infoElement && this.currentImage) {
            const zoomPercent = Math.round(this.zoomLevel * 100);
            const annotationsText = window.i18n.t('review.total_annotations');
            const zoomText = window.i18n.getCurrentLanguage() === 'ar' ? 'تكبير' : 'Zoom';
            infoElement.textContent = `${this.currentImage.filename} | ${this.annotations.length} ${annotationsText} | ${zoomText}: ${zoomPercent}%`;
        }
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
    
    fitToScreen() {
        if (!this.currentKonvaImage) return;
        
        const stageWidth = this.stage.width();
        const stageHeight = this.stage.height();
        const imageWidth = this.currentImageObj.width;
        const imageHeight = this.currentImageObj.height;
        
        const scaleX = (stageWidth - 40) / imageWidth;
        const scaleY = (stageHeight - 40) / imageHeight;
        const scale = Math.min(scaleX, scaleY);
        
        this.stage.scale({ x: scale, y: scale });
        
        const x = (stageWidth - imageWidth * scale) / 2;
        const y = (stageHeight - imageHeight * scale) / 2;
        
        this.stage.position({ x, y });
        this.stage.batchDraw();
        
        this.updateZoomLevel();
    }
    
    updateZoomLevel() {
        this.zoomLevel = this.stage.scaleX();
        this.updateCanvasInfo();
    }
    
    // updateAnnotationStrokeWidths() {
    //     const currentScale = this.stage.scaleX();
    //     this.layer.find('.review-annotation').forEach(group => {
    //         const rect = group.findOne('.main-rect');
    //         if (rect) {
    //             rect.strokeWidth(2 / currentScale);
    //         }
            
    //         const label = group.findOne('.label-text');
    //         if (label) {
    //             label.fontSize(16 / currentScale);
    //         }
            
    //         const levelIndicator = group.findOne('.level-indicator');
    //         if (levelIndicator) {
    //             levelIndicator.fontSize(16 / currentScale);
    //         }
    //     });
    // }
    updateAnnotationStrokeWidths() {
        const currentScale = this.stage.scaleX();
        this.layer.find('.review-annotation').forEach(group => {
            const rect = group.findOne('.main-rect');
            if (rect) {
                rect.strokeWidth(2 / currentScale);
            }

            const label = group.findOne('.label-text');
            if (label) {
                // اجعل الليبل يكبر قليلاً مع التكبير، لا يصغر
                label.fontSize(14 + currentScale * 2);
            }
        });
    }

    handleResize() {
        const container = document.getElementById('reviewCanvas');
        if (container && this.stage) {
            this.stage.width(container.offsetWidth);
            this.stage.height(container.offsetHeight);
            this.stage.batchDraw();
        }
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
        this.updateAnnotationStrokeWidths();
        this.stage.batchDraw();
        this.updateZoomLevel();
    }
    
    handleKeyDown(e) {
        // Only handle keys when review tab is active
        const reviewTab = document.getElementById('reviewTab');
        if (!reviewTab || !reviewTab.classList.contains('active')) {
            return;
        }
        
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }
        
        switch (e.key) {
            case 'ArrowRight':
                e.preventDefault();
                this.navigatePrevious();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.navigateNext();
                break;
            case '+':
            case '=':
                e.preventDefault();
                this.zoomIn();
                break;
            case '-':
                e.preventDefault();
                this.zoomOut();
                break;
            case 'f':
            case 'F':
                e.preventDefault();
                this.fitToScreen();
                break;
        }
    }
    
    showEmptyState() {
        this.clearCanvas();
        this.updateImageInfo(null);
        this.updateNavigationState();
        
        const canvasContainer = document.getElementById('reviewCanvasContainer');
        if (canvasContainer) {
            canvasContainer.innerHTML = `
                <div class="review-empty">
                    <i class="fas fa-eye-slash"></i>
                    <h5>${window.i18n.t('review.no_images')}</h5>
                    <p class="text-muted">${window.i18n.t('review.annotate_first')}</p>
                    <button class="btn btn-primary" onclick="app.switchTab('annotation')">
                        <i class="fas fa-tags me-2"></i>
                        ${window.i18n.t('review.go_to_annotation')}
                    </button>
                </div>
            `;
        }
    }
    
    // Public method to initialize when tab is shown
    onTabShown() {
        // Restore canvas if it was replaced by empty state
        const canvasContainer = document.getElementById('reviewCanvasContainer');
        if (canvasContainer && !document.getElementById('reviewCanvas')) {
            canvasContainer.innerHTML = '<div id="reviewCanvas" style="width: 100%; height: 100%;"></div>';
            this.initCanvas();
        }
        
        if (this.app.currentProject) {
            this.loadAnnotatedImages();
        }
        
        // Resize canvas to fit container
        setTimeout(() => {
            this.handleResize();
        }, 100);
    }
}
