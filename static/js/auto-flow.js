// Auto-Flow Manager for seamless processing and annotation workflow
class AutoFlowManager {
    constructor(app) {
        this.app = app;
        this.enabled = true;
        this.mode = 'process_then_annotate'; // manual, process_then_next, process_then_annotate
        
        this.initializeIndicators();
    }
    
    initializeIndicators() {
        // Create auto-flow indicator element
        this.createAutoFlowIndicator();
    }
    
    createAutoFlowIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'autoFlowIndicator';
        indicator.className = 'auto-flow-indicator d-none';
        indicator.innerHTML = `
            <div class="d-flex align-items-center">
                <div class="flex-shrink-0 me-3">
                    <div class="spinner-border spinner-border-sm text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
                <div class="flex-grow-1">
                    <div class="fw-bold" id="autoFlowTitle">التدفق التلقائي</div>
                    <small class="text-muted" id="autoFlowStatus">جاري المعالجة...</small>
                </div>
                <div class="flex-shrink-0">
                    <button class="btn btn-sm btn-outline-secondary" onclick="this.closest('#autoFlowIndicator').classList.add('d-none')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(indicator);
        this.indicator = indicator;
    }
    
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.hideIndicator();
        }
    }
    
    setMode(mode) {
        this.mode = mode;
    }
    
    updateSettings(settings) {
        this.enabled = settings.auto_flow_enabled;
        this.mode = settings.auto_flow_mode;
    }
    
    // Processing Flow Methods
    async handleProcessingFlow() {
        if (!this.enabled || this.mode === 'manual') {
            return;
        }
        
        this.showIndicator('معالجة تلقائية', 'جاري معالجة الصورة التالية...');
        
        try {
            const response = await fetch(`${this.app.apiBase}/processing/${this.app.currentProject.id}/auto-flow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_image_id: this.app.currentImage?.id,
                    settings: this.app.imageProcessor?.getCurrentSettings() || {}
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                await this.handleFlowResponse(data, 'processing');
            } else {
                throw new Error(data.error || 'Auto-flow processing failed');
            }
        } catch (error) {
            console.error('Auto-flow processing error:', error);
            this.app.showNotification('خطأ في التدفق التلقائي للمعالجة', 'error');
        } finally {
            setTimeout(() => this.hideIndicator(), 2000);
        }
    }
    
    async handleAnnotationFlow() {
        if (!this.enabled || this.mode === 'manual') {
            return;
        }
        
        this.showIndicator('توسيم تلقائي', 'جاري الانتقال للصورة التالية...');
        
        try {
            const response = await fetch(`${this.app.apiBase}/annotations/${this.app.currentProject.id}/auto-flow`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_image_id: this.app.currentImage?.id,
                    mark_completed: true
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                await this.handleFlowResponse(data, 'annotation');
            } else {
                throw new Error(data.error || 'Auto-flow annotation failed');
            }
        } catch (error) {
            console.error('Auto-flow annotation error:', error);
            this.app.showNotification('خطأ في التدفق التلقائي للتوسيم', 'error');
        } finally {
            setTimeout(() => this.hideIndicator(), 2000);
        }
    }
    
    async handleFlowResponse(data, currentWorkflow) {
        // Update project statistics
        if (data.statistics) {
            this.app.currentProject.statistics = data.statistics;
        }
        
        // Handle next action
        switch (data.next_action) {
            case 'continue_processing':
                await this.continueProcessing(data.next_image);
                break;
                
            case 'switch_to_annotation':
                await this.switchToAnnotation(data.next_image);
                break;
                
            case 'continue_annotation':
                await this.continueAnnotation(data.next_image);
                break;
                
            case 'switch_to_processing':
                await this.switchToProcessing(data.next_image);
                break;
                
            case 'processing_complete':
                this.handleProcessingComplete();
                break;
                
            case 'all_complete':
                this.handleAllComplete();
                break;
                
            case 'manual':
            default:
                // No automatic action
                break;
        }
    }
    
    async continueProcessing(nextImage) {
        if (!nextImage) return;
        
        this.updateIndicator('معالجة مستمرة', `جاري تحميل الصورة: ${nextImage.filename}`);
        
        // Update images list
        await this.app.loadProjectImages();
        
        // Select next image
        await this.app.selectImageForProcessing(nextImage.id);
        
        // Auto-process if enabled
        if (this.mode === 'process_then_next' || this.mode === 'process_then_annotate') {
            setTimeout(() => {
                this.app.imageProcessor?.processCurrentImage();
            }, 1000);
        }
    }
    
    async switchToAnnotation(nextImage) {
        if (!nextImage) return;
        
        this.updateIndicator('انتقال للتوسيم', `جاري تحميل الصورة: ${nextImage.filename}`);
        
        // Switch to annotation tab with preselected image
        this.app.switchTab('annotation', { preselectImageId: nextImage.id });
        
        // Load project images to ensure lists are updated
        await this.app.loadProjectImages();
        
        this.app.showNotification('تم الانتقال لتبويب التوسيم', 'info');
    }
    
    async continueAnnotation(nextImage) {
        if (!nextImage) return;
        
        this.updateIndicator('توسيم مستمر', `جاري تحميل الصورة: ${nextImage.filename}`);
        
        // Stay in annotation tab
        await this.app.loadProjectImages();
        await this.app.selectImageForAnnotation(nextImage.id);
    }
    
    async switchToProcessing(nextImage) {
        if (!nextImage) return;
        
        this.updateIndicator('انتقال للمعالجة', `جاري تحميل الصورة: ${nextImage.filename}`);
        
        // Switch to processing tab
        this.app.switchTab('processing');
        
        // Load project images and select image
        await this.app.loadProjectImages();
        await this.app.selectImageForProcessing(nextImage.id);
        
        this.app.showNotification('تم الانتقال لتبويب المعالجة', 'info');
    }
    
    handleProcessingComplete() {
        this.updateIndicator('معالجة مكتملة', 'تمت معالجة جميع الصور');
        
        this.app.showNotification('تمت معالجة جميع الصور بنجاح! يمكنك الانتقال للتوسيم', 'success');
        
        // Auto-switch to annotation tab if there are processed images
        if (this.app.currentProject.statistics.processed_images > 0) {
            setTimeout(async () => {
                // Find first processed image
                const processedImages = this.app.currentProject.images.filter(img => img.status === 'processed');
                if (processedImages.length > 0) {
                    this.app.switchTab('annotation', { preselectImageId: processedImages[0].id });
                    await this.app.loadProjectImages();
                } else {
                    this.app.switchTab('annotation');
                }
            }, 2000);
        }
    }
    
    handleAllComplete() {
        this.updateIndicator('مشروع مكتمل', 'تم إنجاز جميع المهام');
        
        this.app.showNotification('تم إنجاز جميع مهام المشروع! يمكنك الآن التصدير', 'success');
        
        // Auto-switch to export tab
        setTimeout(() => {
            this.app.switchTab('export');
        }, 2000);
        
        // Show celebration effect
        this.showCelebration();
    }
    
    showCelebration() {
        // Simple celebration effect
        const celebration = document.createElement('div');
        celebration.innerHTML = `
            <div class="position-fixed top-50 start-50 translate-middle text-center" style="z-index: 9999;">
                <div class="bg-success text-white rounded-circle p-4 mb-3" style="width: 100px; height: 100px; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-trophy fa-3x"></i>
                </div>
                <h4 class="text-success">مبروك! تم إنجاز المشروع</h4>
            </div>
        `;
        
        document.body.appendChild(celebration);
        
        setTimeout(() => {
            celebration.remove();
        }, 3000);
    }
    
    // Indicator Management
    showIndicator(title, status) {
        this.indicator.classList.remove('d-none');
        document.getElementById('autoFlowTitle').textContent = title;
        document.getElementById('autoFlowStatus').textContent = status;
        
        // Add appropriate class based on current workflow
        this.indicator.className = 'auto-flow-indicator processing';
    }
    
    updateIndicator(title, status) {
        document.getElementById('autoFlowTitle').textContent = title;
        document.getElementById('autoFlowStatus').textContent = status;
    }
    
    hideIndicator() {
        this.indicator.classList.add('d-none');
    }
    
    // Progress Tracking
    calculateOverallProgress() {
        if (!this.app.currentProject) return 0;
        
        const stats = this.app.currentProject.statistics;
        if (stats.total_images === 0) return 0;
        
        return Math.round((stats.completed_images / stats.total_images) * 100);
    }
    
    updateProgressDisplay() {
        const progress = this.calculateOverallProgress();
        const progressElements = document.querySelectorAll('.overall-progress');
        
        progressElements.forEach(element => {
            if (element.classList.contains('progress-bar')) {
                element.style.width = `${progress}%`;
                element.textContent = `${progress}%`;
            } else {
                element.textContent = `${progress}%`;
            }
        });
    }
    
    // Workflow State Management
    getWorkflowState() {
        if (!this.app.currentProject) return 'idle';
        
        const stats = this.app.currentProject.statistics;
        
        if (stats.unprocessed_images > 0) {
            return 'processing';
        } else if (stats.processed_images > 0) {
            return 'annotation';
        } else if (stats.annotated_images > 0 || stats.completed_images > 0) {
            return 'complete';
        } else {
            return 'empty';
        }
    }
    
    getRecommendedTab() {
        const state = this.getWorkflowState();
        
        switch (state) {
            case 'processing':
                return 'processing';
            case 'annotation':
                return 'annotation';
            case 'complete':
                return 'export';
            default:
                return 'processing';
        }
    }
    
    // Smart Navigation
    async smartNavigate(direction = 'forward') {
        const currentTab = this.app.currentTab;
        const currentWorkflow = this.getWorkflowState();
        
        if (direction === 'forward') {
            if (currentTab === 'processing' && currentWorkflow === 'annotation') {
                this.app.switchTab('annotation');
            } else if (currentTab === 'annotation' && currentWorkflow === 'complete') {
                this.app.switchTab('export');
            }
        } else if (direction === 'backward') {
            if (currentTab === 'annotation' && this.app.currentProject.statistics.unprocessed_images > 0) {
                this.app.switchTab('processing');
            } else if (currentTab === 'export') {
                if (this.app.currentProject.statistics.processed_images > 0) {
                    this.app.switchTab('annotation');
                } else if (this.app.currentProject.statistics.unprocessed_images > 0) {
                    this.app.switchTab('processing');
                }
            }
        }
    }
    
    // Hotkey Support
    initializeHotkeys() {
        document.addEventListener('keydown', (e) => {
            // Only handle hotkeys if not in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            switch (e.key) {
                case 'ArrowRight':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.smartNavigate('forward');
                    }
                    break;
                    
                case 'ArrowLeft':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.smartNavigate('backward');
                    }
                    break;
                    
                case 's':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        if (this.app.currentTab === 'annotation') {
                            this.app.saveCurrentAnnotations();
                        }
                    }
                    break;
                    
                case 'Enter':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        if (this.app.currentTab === 'processing') {
                            this.app.imageProcessor?.processCurrentImage();
                        } else if (this.app.currentTab === 'annotation') {
                            this.app.markCurrentImageComplete();
                        }
                    }
                    break;
            }
        });
    }
}
