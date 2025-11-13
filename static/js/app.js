// Main Application JavaScript with Auto-Flow System
class MusnadOCRApp {
    constructor() {
        this.currentProject = null;
        this.currentImage = null;
        this.apiBase = '/api';
        this.autoFlow = null;
        this.canvasHandler = null;
        this.reviewHandler = null;
        this.musnadKeyboard = null;
        this.imageProcessor = null;
        this.pendingPreselectImageId = null;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadProjects();
        this.initializeComponents();
        this.setupNotifications();
        this.setupLanguageSwitcher();
    }
    
    initializeComponents() {
        // Initialize auto-flow manager
        this.autoFlow = new AutoFlowManager(this);
        
        // Other components will be initialized when needed
    }
    
    bindEvents() {
        // Project management events
        this.bindProjectEvents();
        
        // Workspace tab events
        this.bindTabEvents();
        
        // Auto-save setup
        this.setupAutoSave();
    }
    
    bindProjectEvents() {
        const newProjectBtn = document.getElementById('newProjectBtn');
        const createProjectBtn = document.getElementById('createProjectBtn');
        const cancelProjectBtn = document.getElementById('cancelProjectBtn');
        
        if (newProjectBtn) {
            newProjectBtn.addEventListener('click', () => this.showProjectModal());
        }
        
        if (createProjectBtn) {
            createProjectBtn.addEventListener('click', () => this.createProject());
        }
        
        if (cancelProjectBtn) {
            cancelProjectBtn.addEventListener('click', () => this.hideProjectModal());
        }
        
        // Handle Enter key in project form
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && document.getElementById('projectModal').style.display !== 'none') {
                e.preventDefault();
                this.createProject();
            }
        });
    }
    
    bindTabEvents() {
        document.querySelectorAll('.workspace-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }
    
    setupAutoSave() {
        // Auto-save annotations every 30 seconds
        setInterval(() => {
            if (this.currentProject && this.currentImage && this.canvasHandler) {
                this.saveCurrentAnnotations();
            }
        }, 30000);
    }
    
    setupNotifications() {
        this.toastElement = document.getElementById('notificationToast');
        this.toast = new bootstrap.Toast(this.toastElement);
    }
    
    setupLanguageSwitcher() {
        // Update current language display
        this.updateLanguageDisplay();
        
        // Bind language switcher events
        document.querySelectorAll('[data-lang]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const language = e.currentTarget.getAttribute('data-lang');
                this.changeLanguage(language);
            });
        });
        
        // Listen for language change events
        document.addEventListener('languageChanged', (e) => {
            this.onLanguageChanged(e.detail.language);
        });
    }
    
    changeLanguage(language) {
        if (window.i18n) {
            window.i18n.setLanguage(language);
            this.updateLanguageDisplay();
            
            // Update any dynamic content
            this.updateDynamicTranslations();
            
            // Show notification
            const message = language === 'ar' ? 'تم تغيير اللغة إلى العربية' : 'Language changed to English';
            this.showNotification(message, 'success');
        }
    }
    
    updateLanguageDisplay() {
        const currentLangElement = document.getElementById('currentLanguage');
        if (currentLangElement && window.i18n) {
            const currentLang = window.i18n.getCurrentLanguage();
            currentLangElement.textContent = currentLang === 'ar' ? 'العربية' : 'English';
        }
    }
    
    updateDynamicTranslations() {
        // Update any dynamically generated content that needs translation
        if (this.currentProject) {
            this.updateProjectTitle();
        }
        
        // Update canvas info if available
        if (this.canvasHandler) {
            this.canvasHandler.updateCanvasInfo();
        }
        
        // Update review handler if available
        if (this.reviewHandler) {
            this.reviewHandler.updateCanvasInfo();
        }
    }
    
    onLanguageChanged(language) {
        // Handle any additional logic when language changes
        console.log(`Language changed to: ${language}`);
        
        // Update document title
        document.title = window.i18n.t('app.title');
    }
    
    updateProjectTitle() {
        const projectTitleElement = document.getElementById('projectTitle');
        if (projectTitleElement && this.currentProject) {
            projectTitleElement.textContent = this.currentProject.name;
        } else if (projectTitleElement) {
            projectTitleElement.textContent = window.i18n.t('app.welcome');
        }
    }
    
    async updateServerAutoFlowMode() {
        if (!this.currentProject || !this.autoFlow) return;
        
        try {
            const response = await fetch(`${this.apiBase}/processing/${this.currentProject.id}/auto-flow-mode`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: this.autoFlow.mode })
            });
            
            if (response.ok) {
                console.log(`Auto-flow mode synced to server: ${this.autoFlow.mode}`);
            } else {
                const data = await response.json();
                console.error('Failed to sync auto-flow mode:', data.error);
            }
        } catch (error) {
            console.error('Error syncing auto-flow mode:', error);
        }
    }
    
    // Project Management
    async loadProjects() {
        try {
            const response = await fetch(`${this.apiBase}/projects`);
            const data = await response.json();
            
            if (response.ok) {
                this.renderProjects(data.projects);
            } else {
                throw new Error(data.error || 'Failed to load projects');
            }
        } catch (error) {
            console.error('Error loading projects:', error);
            this.showNotification('خطأ في تحميل المشاريع', 'error');
        }
    }
    
    renderProjects(projects) {
        const container = document.getElementById('projectsList');
        
        if (projects.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-5">
                    <i class="fas fa-folder-open fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">لا توجد مشاريع</h5>
                    <p class="text-muted">ابدأ بإنشاء مشروع جديد</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = projects.map(project => `
            <div class="col-lg-4 col-md-6">
                <div class="card project-card h-100" data-project-id="${project.id}">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <h5 class="card-title mb-0">${project.name}</h5>
                            <small class="text-muted">${new Date(project.created_at).toLocaleDateString('ar')}</small>
                        </div>
                        
                        <p class="card-text text-muted mb-3">
                            ${project.description || 'لا يوجد وصف'}
                        </p>
                        
                        <!-- Statistics -->
                        <div class="row g-2 mb-3">
                            <div class="col-6">
                                <div class="bg-light rounded p-2 text-center">
                                    <div class="fw-bold">${project.statistics.total_images}</div>
                                    <small class="text-muted">إجمالي الصور</small>
                                </div>
                            </div>
                            <div class="col-6">
                                <div class="bg-light rounded p-2 text-center">
                                    <div class="fw-bold">${project.statistics.completed_images}</div>
                                    <small class="text-muted">مكتملة</small>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Progress Bar -->
                        <div class="progress mb-3" style="height: 6px;">
                            <div class="progress-bar" role="progressbar" 
                                 style="width: ${this.calculateProgress(project.statistics)}%">
                            </div>
                        </div>
                        
                        <!-- Status indicators -->
                        <div class="d-flex justify-content-between text-center">
                            <div>
                                <span class="badge status-unprocessed">${project.statistics.unprocessed_images}</span>
                                <small class="d-block text-muted">غير معالجة</small>
                            </div>
                            <div>
                                <span class="badge status-processed">${project.statistics.processed_images}</span>
                                <small class="d-block text-muted">معالجة</small>
                            </div>
                            <div>
                                <span class="badge status-annotated">${project.statistics.annotated_images}</span>
                                <small class="d-block text-muted">موسومة</small>
                            </div>
                            <div>
                                <span class="badge status-completed">${project.statistics.completed_images}</span>
                                <small class="d-block text-muted">مكتملة</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.project-card').forEach(card => {
            card.addEventListener('click', () => {
                const projectId = card.dataset.projectId;
                this.openProject(projectId);
            });
        });
    }
    
    calculateProgress(statistics) {
        if (statistics.total_images === 0) return 0;
        return Math.round((statistics.completed_images / statistics.total_images) * 100);
    }
    
    showProjectModal() {
        const modal = new bootstrap.Modal(document.getElementById('projectModal'));
        modal.show();
        
        // Focus on first input
        setTimeout(() => {
            document.getElementById('projectName').focus();
        }, 500);
    }
    
    hideProjectModal() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('projectModal'));
        if (modal) {
            modal.hide();
        }
        
        // Clear form
        document.getElementById('projectName').value = '';
        document.getElementById('projectDescription').value = '';
        document.getElementById('projectImages').value = '';
        document.getElementById('projectOutputType').value = 'json';
        
        // Hide image preview
        const imagePreview = document.getElementById('imagePreview');
        if (imagePreview) {
            imagePreview.style.display = 'none';
        }
    }
    
    async createProject() {
        const name = document.getElementById('projectName').value.trim();
        const description = document.getElementById('projectDescription').value.trim();
        const imageFiles = document.getElementById('projectImages').files;
        const outputType = document.getElementById('projectOutputType').value;
        
        if (!name) {
            this.showNotification('يرجى إدخال اسم المشروع', 'error');
            return;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description,
                    output_type: outputType
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                let message = 'تم إنشاء المشروع بنجاح';
                
                // Upload images if selected
                let uploadedCount = 0;
                if (imageFiles && imageFiles.length > 0) {
                    uploadedCount = await this.uploadProjectImages(data.project_id, imageFiles);
                    if (uploadedCount > 0) {
                        message += ` وتم رفع ${uploadedCount} صورة`;
                    }
                }
                
                this.showNotification(message, 'success');
                this.hideProjectModal();
                
                // Open the new project
                this.currentProject = data;
                this.showWorkspace();
                
                // Load project data
                await this.loadProjectData();
                
                // Switch to appropriate tab based on project state
                if (uploadedCount > 0) {
                    this.switchTab('processing');
                    this.showNotification('يمكنك الآن بدء معالجة الصور', 'info');
                } else {
                    this.switchTab('processing');
                }
                
            } else {
                throw new Error(data.error || 'Failed to create project');
            }
        } catch (error) {
            console.error('Error creating project:', error);
            this.showNotification('خطأ في إنشاء المشروع', 'error');
        }
    }
    
    async uploadProjectImages(projectId, files) {
        let uploadedCount = 0;
        const totalFiles = files.length;
        
        this.showNotification(`بدء رفع ${totalFiles} صورة...`, 'info');
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append('image', file);
            
            try {
                const response = await fetch(`${this.apiBase}/images/${projectId}/upload`, {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    uploadedCount++;
                    console.log(`تم رفع الصورة ${uploadedCount}/${totalFiles}: ${file.name}`);
                } else {
                    const error = await response.json();
                    console.error(`فشل رفع الصورة ${file.name}:`, error.error || 'خطأ غير معروف');
                }
            } catch (error) {
                console.error(`خطأ في رفع الصورة ${file.name}:`, error);
            }
        }
        
        return uploadedCount;
    }
    
    previewSelectedImages(input) {
        const imagePreview = document.getElementById('imagePreview');
        const imageList = document.getElementById('imageList');
        
        // Clear previous previews
        imageList.innerHTML = '';
        
        if (input.files && input.files.length > 0) {
            imagePreview.style.display = 'block';
            
            // Show file count and total size
            const totalSize = Array.from(input.files).reduce((sum, file) => sum + file.size, 0);
            const sizeText = this.formatFileSize(totalSize);
            
            const countInfo = document.createElement('div');
            countInfo.className = 'small text-info mb-2';
            countInfo.textContent = `${input.files.length} ملف - الحجم الإجمالي: ${sizeText}`;
            imageList.appendChild(countInfo);
            
            // Show first few file names
            const maxShow = 5;
            for (let i = 0; i < Math.min(input.files.length, maxShow); i++) {
                const file = input.files[i];
                const fileItem = document.createElement('span');
                fileItem.className = 'badge bg-secondary me-1 mb-1';
                fileItem.textContent = file.name;
                imageList.appendChild(fileItem);
            }
            
            // Show "and X more" if there are more files
            if (input.files.length > maxShow) {
                const moreItem = document.createElement('span');
                moreItem.className = 'badge bg-info me-1 mb-1';
                moreItem.textContent = `و ${input.files.length - maxShow} ملف آخر`;
                imageList.appendChild(moreItem);
            }
        } else {
            imagePreview.style.display = 'none';
        }
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    initializeExportUI() {
        /* Initialize export UI event handlers */
        const exportFormat = document.getElementById('exportFormat');
        const yoloSplitOptions = document.getElementById('yoloSplitOptions');
        const splitModeRadios = document.querySelectorAll('input[name="splitMode"]');
        const splitRatios = document.getElementById('splitRatios');
        const startExportBtn = document.getElementById('startExportBtn');
        
        if (!exportFormat) return; // Export tab not loaded yet
        
        // Show/hide YOLO split options
        exportFormat.addEventListener('change', () => {
            const isYolo = exportFormat.value === 'yolo';
            yoloSplitOptions.style.display = isYolo ? 'block' : 'none';
            this.updateExportPreview();
        });
        
        // Show/hide split ratio inputs
        splitModeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const showRatios = radio.value === 'split';
                splitRatios.style.display = showRatios ? 'block' : 'none';
                this.updateSplitRatios();
            });
        });
        
        // Update ratio totals
        const ratioInputs = ['trainRatio', 'valRatio', 'testRatio'];
        ratioInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => this.updateSplitRatios());
            }
        });
        
        // Export button
        if (startExportBtn) {
            startExportBtn.addEventListener('click', () => this.startExport());
        }
        
        // Initial preview update
        this.updateExportPreview();
    }
    
    updateSplitRatios() {
        /* Update split ratio totals and validation */
        const trainRatio = parseInt(document.getElementById('trainRatio')?.value || 0);
        const valRatio = parseInt(document.getElementById('valRatio')?.value || 0);
        const testRatio = parseInt(document.getElementById('testRatio')?.value || 0);
        const total = trainRatio + valRatio + testRatio;
        
        const totalSpan = document.getElementById('totalRatio');
        if (totalSpan) {
            totalSpan.textContent = total;
            totalSpan.className = total === 100 ? 'text-success' : 'text-danger';
        }
        
        // Enable/disable export button based on validation
        const startExportBtn = document.getElementById('startExportBtn');
        if (startExportBtn) {
            const isValid = total === 100 || document.getElementById('fullExport')?.checked;
            startExportBtn.disabled = !isValid || !this.currentProject;
        }
    }
    
    async updateExportPreview() {
        /* Update export preview based on current settings */
        if (!this.currentProject) return;
        
        const exportPreview = document.getElementById('exportPreview');
        if (!exportPreview) return;
        
        try {
            const response = await fetch(`${this.apiBase}/exports/${this.currentProject.id}/preview`);
            const data = await response.json();
            
            if (response.ok) {
                const format = document.getElementById('exportFormat')?.value || 'json';
                
                exportPreview.innerHTML = `
                    <div class="row text-center">
                        <div class="col-md-3">
                            <div class="border rounded p-2">
                                <h6 class="text-primary">${data.total_images}</h6>
                                <small>إجمالي الصور</small>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="border rounded p-2">
                                <h6 class="text-success">${data.annotated_images}</h6>
                                <small>صور معنونة</small>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="border rounded p-2">
                                <h6 class="text-info">${data.total_annotations}</h6>
                                <small>إجمالي التوسيمات</small>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="border rounded p-2">
                                <h6 class="text-warning">${Object.keys(data.label_counts || {}).length}</h6>
                                <small>أنواع التسميات</small>
                            </div>
                        </div>
                    </div>
                    <div class="mt-3">
                        <h6>التسميات المتاحة:</h6>
                        <div class="d-flex flex-wrap gap-1">
                            ${Object.entries(data.label_counts || {}).map(([label, count]) => 
                                `<span class="badge bg-secondary">${label} (${count})</span>`
                            ).join('')}
                        </div>
                    </div>
                    ${!data.export_ready ? '<div class="alert alert-warning mt-3">لا توجد صور معنونة للتصدير</div>' : ''}
                `;
                
                // Enable/disable export button
                const startExportBtn = document.getElementById('startExportBtn');
                if (startExportBtn) {
                    startExportBtn.disabled = !data.export_ready;
                }
            }
        } catch (error) {
            console.error('Error updating export preview:', error);
            exportPreview.innerHTML = '<div class="alert alert-danger">خطأ في تحميل معاينة التصدير</div>';
        }
    }
    
    async startExport() {
        /* Start the export process */
        if (!this.currentProject) return;
        
        const format = document.getElementById('exportFormat')?.value;
        const includeImages = document.getElementById('includeImages')?.checked;
        const splitMode = document.querySelector('input[name="splitMode"]:checked')?.value;
        
        // Build export settings
        const settings = {
            include_images: includeImages
        };
        
        // Add split ratio for YOLO
        if (format === 'yolo') {
            if (splitMode === 'full') {
                settings.split_ratio = { train: 1.0, val: 0.0, test: 0.0 };
            } else {
                const trainRatio = parseInt(document.getElementById('trainRatio')?.value || 70);
                const valRatio = parseInt(document.getElementById('valRatio')?.value || 20);
                const testRatio = parseInt(document.getElementById('testRatio')?.value || 10);
                
                // Validate ratios
                if (trainRatio + valRatio + testRatio !== 100) {
                    this.showNotification('مجموع نسب التقسيم يجب أن يكون 100%', 'error');
                    return;
                }
                
                settings.split_ratio = {
                    train: trainRatio / 100,
                    val: valRatio / 100,
                    test: testRatio / 100
                };
            }
        }
        
        // Show progress
        const exportProgress = document.getElementById('exportProgress');
        const startExportBtn = document.getElementById('startExportBtn');
        
        if (exportProgress && startExportBtn) {
            exportProgress.style.display = 'block';
            startExportBtn.disabled = true;
        }
        
        try {
            const response = await fetch(`${this.apiBase}/exports/${this.currentProject.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    format: format,
                    settings: settings
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Start download
                const downloadUrl = data.download_url;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = data.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.showNotification(`تم التصدير بنجاح: ${data.filename}`, 'success');
            } else {
                throw new Error(data.error || 'فشل في التصدير');
            }
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('خطأ في التصدير: ' + error.message, 'error');
        } finally {
            // Hide progress
            if (exportProgress && startExportBtn) {
                exportProgress.style.display = 'none';
                startExportBtn.disabled = false;
            }
        }
    }
    
    async openProject(projectId) {
        try {
            const response = await fetch(`${this.apiBase}/projects/${projectId}`);
            const data = await response.json();
            
            if (response.ok) {
                this.currentProject = data;
                this.showWorkspace();
                await this.loadProjectData();
                
                // Initialize export UI when project is loaded
                this.initializeExportUI();
                
                // Switch to appropriate tab based on project state
                this.switchToAppropriateTab();
                
            } else {
                throw new Error(data.error || 'Failed to load project');
            }
        } catch (error) {
            console.error('Error opening project:', error);
            this.showNotification('خطأ في فتح المشروع', 'error');
        }
    }
    
    switchToAppropriateTab() {
        const stats = this.currentProject.statistics;
        
        if (stats.unprocessed_images > 0) {
            this.switchTab('processing');
        } else if (stats.processed_images > 0) {
            this.switchTab('annotation');
        } else if (stats.annotated_images > 0 || stats.completed_images > 0) {
            this.switchTab('review');
        } else {
            this.switchTab('processing');
        }
    }
    
    showWorkspace() {
        document.getElementById('projectSelection').style.display = 'none';
        document.getElementById('workspace').classList.remove('d-none');
        
        // Update project title
        document.getElementById('projectTitle').textContent = this.currentProject.name;
        
        // Sync auto-flow mode to server
        setTimeout(() => {
            this.updateServerAutoFlowMode();
        }, 500);
    }
    
    async loadProjectData() {
        // Load images for current project
        await this.loadProjectImages();
        
        // Update statistics
        await this.updateProjectStatistics();
        
        // Initialize components
        this.initializeWorkspaceComponents();
    }
    
    async loadProjectImages() {
        try {
            const response = await fetch(`${this.apiBase}/images/${this.currentProject.id}`);
            const data = await response.json();
            
            if (response.ok) {
                this.currentProject.images = data.images;
                this.updateImageLists();
                
                // Wait for DOM to be updated
                await new Promise(resolve => requestAnimationFrame(resolve));
            } else {
                throw new Error(data.error || 'Failed to load images');
            }
        } catch (error) {
            console.error('Error loading images:', error);
            this.showNotification('خطأ في تحميل الصور', 'error');
        }
    }
    
    updateImageLists() {
        // Update processing images list
        this.updateProcessingImagesList();
        
        // Update annotation images list (if in annotation tab)
        if (this.currentTab === 'annotation') {
            this.updateAnnotationImagesList();
        }
    }
    
    updateProcessingImagesList() {
        const container = document.getElementById('processingImagesList');
        if (!container) return;
        
        const unprocessedImages = this.currentProject.images.filter(img => img.status === 'unprocessed');
        
        if (unprocessedImages.length === 0) {
            container.innerHTML = `
                <div class="list-group-item text-center py-4">
                    <i class="fas fa-check-circle fa-2x text-success mb-2"></i>
                    <p class="mb-0">جميع الصور تم معالجتها</p>
                    <small class="text-muted">يمكنك الانتقال لتبويب التوسيم</small>
                </div>
            `;
            return;
        }
        
        container.innerHTML = unprocessedImages.map(image => `
            <div class="list-group-item image-list-item" data-image-id="${image.id}">
                <div class="d-flex align-items-center">
                    <div class="flex-shrink-0">
                        <i class="fas fa-image fa-2x text-muted"></i>
                    </div>
                    <div class="flex-grow-1 ms-3">
                        <h6 class="mb-1">${image.filename}</h6>
                        <small class="text-muted">${image.width} × ${image.height}</small>
                    </div>
                    <div class="flex-shrink-0">
                        <span class="badge status-${image.status}">${this.getStatusText(image.status)}</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.image-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const imageId = item.dataset.imageId;
                this.selectImageForProcessing(imageId);
            });
        });
    }
    
    updateAnnotationImagesList() {
        const container = document.getElementById('annotationImagesList');
        if (!container) return;
        
        const processedImages = this.currentProject.images.filter(img => img.status === 'processed');
        
        if (processedImages.length === 0) {
            container.innerHTML = `
                <div class="list-group-item text-center py-4">
                    <i class="fas fa-check-circle fa-2x text-success mb-2"></i>
                    <p class="mb-0">جميع الصور المعالجة تم توسيمها</p>
                    <small class="text-muted">يمكنك الانتقال لتبويب التصدير</small>
                </div>
            `;
            return;
        }
        
        container.innerHTML = processedImages.map(image => `
            <div class="list-group-item image-list-item" data-image-id="${image.id}">
                <div class="d-flex align-items-center">
                    <div class="flex-shrink-0">
                        <i class="fas fa-image fa-2x text-muted"></i>
                    </div>
                    <div class="flex-grow-1 ms-3">
                        <h6 class="mb-1">${image.filename}</h6>
                        <small class="text-muted">${image.annotations_count} توسيم</small>
                    </div>
                    <div class="flex-shrink-0">
                        <span class="badge status-${image.status}">${this.getStatusText(image.status)}</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        container.querySelectorAll('.image-list-item').forEach(item => {
            item.addEventListener('click', () => {
                const imageId = item.dataset.imageId;
                this.selectImageForAnnotation(imageId);
            });
        });
    }
    
    getStatusText(status) {
        const statusTexts = {
            'unprocessed': 'غير معالجة',
            'processed': 'معالجة',
            'annotated': 'موسومة',
            'completed': 'مكتملة'
        };
        return statusTexts[status] || status;
    }
    
    // Tab Management
    // switchTab(tabName) {
    //     // Update tab buttons
    //     document.querySelectorAll('.workspace-tab').forEach(tab => {
    //         tab.classList.remove('active');
    //     });
        
    //     document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
    //     // Update tab content
    //     document.querySelectorAll('.tab-content').forEach(content => {
    //         content.classList.remove('active');
    //     });
        
    //     const targetTab = document.getElementById(`${tabName}Tab`);
    //     if (targetTab) {
    //         targetTab.classList.add('active');
    //     }
        
    //     this.currentTab = tabName;
        
    //     // Initialize tab-specific components
    //     this.initializeTabComponents(tabName);
    // }
    switchTab(tabName, options = {}) {
        // Store preselect image ID if provided
        if (options.preselectImageId) {
            this.pendingPreselectImageId = options.preselectImageId;
        }
        
        // Update tab buttons
        const tabButtons = document.querySelectorAll('.workspace-tab');
        const targetTabButton = document.querySelector(`[data-tab="${tabName}"]`);
        
        if (!targetTabButton) {
            console.error(`Tab button not found for: ${tabName}`);
            return;
        }
        
        tabButtons.forEach(tab => {
            if (tab) tab.classList.remove('active');
        });
        
        targetTabButton.classList.add('active');
        
        // Update tab content
        const tabContents = document.querySelectorAll('.tab-content');
        const targetTab = document.getElementById(`${tabName}Tab`);
        
        if (!targetTab) {
            console.error(`Tab content not found for: ${tabName}`);
            return;
        }
        
        tabContents.forEach(content => {
            if (content) content.classList.remove('active');
        });
        
        targetTab.classList.add('active');
        
        this.currentTab = tabName;
        
        // Initialize tab-specific components
        this.initializeTabComponents(tabName);
    }
    initializeTabComponents(tabName) {
        switch (tabName) {
            case 'processing':
                this.initializeProcessingTab();
                break;
            case 'annotation':
                this.initializeAnnotationTab();
                break;
            case 'review':
                this.initializeReviewTab();
                break;
            case 'export':
                this.initializeExportTab();
                break;
            case 'settings':
                this.initializeSettingsTab();
                break;
        }
    }
    
    initializeProcessingTab() {
        if (!this.imageProcessor) {
            this.imageProcessor = new ImageProcessor(this);
        }
        
        this.imageProcessor.initializeControls();
        this.updateProcessingImagesList();
        
        // Auto-select first unprocessed image
        this.autoSelectNextImage('processing');
    }
    
    initializeAnnotationTab() {
        if (!this.canvasHandler) {
            this.canvasHandler = new CanvasHandler('konvaContainer', this);
        }
        
        if (!this.musnadKeyboard) {
            this.musnadKeyboard = new MusnadKeyboard('musnadKeyboardContainer', this);
        }
        
        this.updateAnnotationImagesList();
        this.bindAnnotationControls();
        
        // Check if there's a pending preselect image ID
        if (this.pendingPreselectImageId) {
            const imageId = this.pendingPreselectImageId;
            this.pendingPreselectImageId = null; // Clear the pending ID
            
            // Wait for list to be rendered then select the image
            setTimeout(() => {
                this.selectImageForAnnotation(imageId);
            }, 100);
        } else {
            // Auto-select first processed image
            this.autoSelectNextImage('annotation');
        }
    }
    
    initializeReviewTab() {
        if (!this.reviewHandler) {
            this.reviewHandler = new ReviewHandler(this);
        }
        
        // Load annotated images when tab is shown
        this.reviewHandler.onTabShown();
    }
    
    bindAnnotationControls() {
        // Canvas mode controls
        const selectModeBtn = document.getElementById('selectModeBtn');
        const drawModeBtn = document.getElementById('drawModeBtn');
        const deleteAnnotationBtn = document.getElementById('deleteAnnotationBtn');
        
        if (selectModeBtn) {
            selectModeBtn.addEventListener('click', () => {
                this.canvasHandler.setMode('select');
                this.updateModeButtons('select');
            });
        }
        
        if (drawModeBtn) {
            drawModeBtn.addEventListener('click', () => {
                this.canvasHandler.setMode('draw');
                this.updateModeButtons('draw');
            });
        }
        
        if (deleteAnnotationBtn) {
            deleteAnnotationBtn.addEventListener('click', () => {
                this.canvasHandler.deleteSelectedAnnotation();
            });
        }
        
        // Zoom controls
        this.bindZoomControls();
        
        // Annotation property controls
        this.bindAnnotationPropertyControls();
        
        // Action buttons
        this.bindAnnotationActionButtons();
    }
    
    bindZoomControls() {
        // Zoom controls
        const zoomInBtn = document.getElementById('zoomInBtn');
        const zoomOutBtn = document.getElementById('zoomOutBtn');
        const fitToScreenBtn = document.getElementById('fitToScreenBtn');
        const resetZoomBtn = document.getElementById('resetZoomBtn');
        
        if (zoomInBtn) zoomInBtn.addEventListener('click', () => this.canvasHandler.zoomIn());
        if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => this.canvasHandler.zoomOut());
        if (fitToScreenBtn) fitToScreenBtn.addEventListener('click', () => this.canvasHandler.fitToScreen());
        if (resetZoomBtn) resetZoomBtn.addEventListener('click', () => this.canvasHandler.resetZoom());
        
        // Rotation controls
        const rotateLeftBtn = document.getElementById('rotateLeftBtn');
        const rotateRightBtn = document.getElementById('rotateRightBtn');
        const resetRotationBtn = document.getElementById('resetRotationBtn');
        const rotationSlider = document.getElementById('rotationSlider');
        const rotationInput = document.getElementById('rotationInput');
        
        if (rotateLeftBtn) {
            rotateLeftBtn.addEventListener('click', () => this.canvasHandler.rotateCounterClockwise());
        }
        if (rotateRightBtn) {
            rotateRightBtn.addEventListener('click', () => this.canvasHandler.rotateClockwise());
        }
        if (resetRotationBtn) {
            resetRotationBtn.addEventListener('click', () => this.canvasHandler.resetRotation());
        }
        
        // Reset all button
        const resetAllBtn = document.getElementById('resetAllBtn');
        if (resetAllBtn) {
            resetAllBtn.addEventListener('click', () => this.canvasHandler.resetAll());
        }
        
        // Rotation slider and input
        if (rotationSlider) {
            rotationSlider.addEventListener('input', (e) => {
                const angle = parseInt(e.target.value);
                this.canvasHandler.rotateToAngle(angle);
                if (rotationInput) rotationInput.value = angle;
            });
        }
        
        if (rotationInput) {
            rotationInput.addEventListener('change', (e) => {
                let angle = parseInt(e.target.value) || 0;
                angle = Math.max(0, Math.min(360, angle)); // Clamp between 0-360
                this.canvasHandler.rotateToAngle(angle);
                if (rotationSlider) rotationSlider.value = angle;
                e.target.value = angle;
            });
        }
    }
    
    bindAnnotationPropertyControls() {
        const labelInput = document.getElementById('labelInput');
        const annotationLevel = document.getElementById('annotationLevel');
        const textDirection = document.getElementById('textDirection');
        const confidenceSlider = document.getElementById('confidenceSlider');
        
        if (labelInput) {
            labelInput.addEventListener('input', (e) => {
                this.canvasHandler.updateSelectedAnnotationLabel(e.target.value);
            });
        }
        
        if (annotationLevel) {
            annotationLevel.addEventListener('change', (e) => {
                this.canvasHandler.updateSelectedAnnotationLevel(e.target.value);
            });
        }
        
        if (textDirection) {
            textDirection.addEventListener('change', (e) => {
                this.canvasHandler.updateSelectedAnnotationDirection(e.target.value);
            });
        }
        
        if (confidenceSlider) {
            confidenceSlider.addEventListener('input', (e) => {
                this.canvasHandler.updateSelectedAnnotationConfidence(parseInt(e.target.value));
                // Update display
                const display = confidenceSlider.nextElementSibling;
                if (display) display.textContent = `${e.target.value}%`;
            });
        }
    }
    
    bindAnnotationActionButtons() {
        const saveAnnotationsBtn = document.getElementById('saveAnnotationsBtn');
        const markCompleteBtn = document.getElementById('markCompleteBtn');
        const nextForAnnotationBtn = document.getElementById('nextForAnnotationBtn');
        
        if (saveAnnotationsBtn) {
            saveAnnotationsBtn.addEventListener('click', () => this.saveCurrentAnnotations());
        }
        
        if (markCompleteBtn) {
            markCompleteBtn.addEventListener('click', () => this.markCurrentImageComplete());
        }
        
        if (nextForAnnotationBtn) {
            nextForAnnotationBtn.addEventListener('click', () => this.autoFlow.handleAnnotationFlow());
        }
    }
    
    updateModeButtons(activeMode) {
        const selectBtn = document.getElementById('selectModeBtn');
        const drawBtn = document.getElementById('drawModeBtn');
        
        selectBtn.classList.toggle('active', activeMode === 'select');
        drawBtn.classList.toggle('active', activeMode === 'draw');
    }
    
    initializeExportTab() {
        this.loadExportOptions();
    }
    
    initializeSettingsTab() {
        this.loadProjectSettings();
        this.bindSettingsControls();
    }
    
    bindSettingsControls() {
        // Auto-flow mode selector
        const autoFlowMode = document.getElementById('autoFlowMode');
        if (autoFlowMode) {
            autoFlowMode.addEventListener('change', (e) => {
                this.updateAutoFlowDescription(e.target.value);
            });
        }
        
        // Interface language selector
        const interfaceLanguage = document.getElementById('interfaceLanguage');
        if (interfaceLanguage) {
            interfaceLanguage.addEventListener('change', (e) => {
                this.changeLanguage(e.target.value);
            });
        }
        
        // Save settings button
        const saveSettingsBtn = document.getElementById('saveSettingsBtn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.saveProjectSettings());
        }
    }
    
    updateAutoFlowDescription(mode) {
        const descriptions = {
            'manual': 'لا يتم الانتقال تلقائياً بين التبويبات. يجب التنقل يدوياً.',
            'process_then_next': 'بعد معالجة الصورة، ينتقل تلقائياً للصورة التالية غير المعالجة.',
            'process_then_annotate': 'بعد معالجة الصورة، ينتقل تلقائياً لتبويب التوسيم لنفس الصورة.',
            'process_all_then_annotate': 'يعالج جميع الصور ثم ينتقل تلقائياً لتبويب التوسيم لبدء دورة التوسيم.'
        };
        
        const descElement = document.getElementById('autoFlowDescText');
        if (descElement) {
            descElement.textContent = descriptions[mode] || 'وصف غير متاح';
        }
    }
    
    async saveProjectSettings() {
        if (!this.currentProject) return;
        
        try {
            const autoFlowMode = document.getElementById('autoFlowMode')?.value || 'manual';
            const enableAutoSave = document.getElementById('enableAutoSave')?.checked || false;
            const autoSaveInterval = parseInt(document.getElementById('autoSaveInterval')?.value) || 30;
            
            // Update auto-flow mode
            if (this.autoFlow) {
                this.autoFlow.setMode(autoFlowMode);
            }
            
            // Sync to server
            await this.updateServerAutoFlowMode();
            
            // Save other settings to project
            const settings = {
                auto_flow_mode: autoFlowMode,
                auto_save_enabled: enableAutoSave,
                auto_save_interval: autoSaveInterval
            };
            
            const response = await fetch(`${this.apiBase}/projects/${this.currentProject.id}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            
            if (response.ok) {
                this.showNotification('تم حفظ الإعدادات بنجاح', 'success');
            } else {
                throw new Error('Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('خطأ في حفظ الإعدادات', 'error');
        }
    }
    
    loadProjectSettings() {
        if (!this.currentProject) return;
        
        // Load auto-flow mode
        const autoFlowMode = document.getElementById('autoFlowMode');
        if (autoFlowMode && this.autoFlow) {
            autoFlowMode.value = this.autoFlow.mode;
            this.updateAutoFlowDescription(this.autoFlow.mode);
        }
        
        // Load interface language
        const interfaceLanguage = document.getElementById('interfaceLanguage');
        if (interfaceLanguage && window.i18n) {
            interfaceLanguage.value = window.i18n.getCurrentLanguage();
        }
        
        // Load project-specific settings
        const settings = this.currentProject.settings || {};
        
        const enableAutoSave = document.getElementById('enableAutoSave');
        if (enableAutoSave) {
            enableAutoSave.checked = settings.auto_save_enabled !== false;
        }
        
        const autoSaveInterval = document.getElementById('autoSaveInterval');
        if (autoSaveInterval) {
            autoSaveInterval.value = settings.auto_save_interval || 30;
        }
    }
    
    initializeWorkspaceComponents() {
        // This will be called when workspace is first shown
        // Components will be initialized when their respective tabs are accessed
    }
    
    // Image Selection
    async selectImageForProcessing(imageId) {
        const image = this.currentProject.images.find(img => img.id === imageId);
        if (!image) return;
        
        this.currentImage = image;
        
        // Update UI
        document.querySelectorAll('.image-list-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // محاولة العثور على العنصر مع إعادة المحاولة
        const selectElement = async (imageId, maxRetries = 5) => {
            for (let i = 0; i < maxRetries; i++) {
                const selectedItem = document.querySelector(`[data-image-id="${imageId}"]`);
                if (selectedItem) {
                    selectedItem.classList.add('active');
                    return true;
                }
                // انتظار قصير قبل إعادة المحاولة
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            console.warn(`⚠️ عنصر الصورة غير موجود في DOM بعد ${maxRetries} محاولات: data-image-id="${imageId}"`);
            return false;
        };

        await selectElement(imageId);
        
        // Load image preview
        await this.loadImagePreview(image);
    }
    
    async selectImageForAnnotation(imageId) {
        const image = this.currentProject.images.find(img => img.id === imageId);
        if (!image) return;

        this.currentImage = image;

        // إزالة التفعيل من كل العناصر
        document.querySelectorAll('.image-list-item').forEach(item => {
            item.classList.remove('active');
        });

        // محاولة العثور على العنصر مع إعادة المحاولة
        const selectElement = async (imageId, maxRetries = 5) => {
            for (let i = 0; i < maxRetries; i++) {
                const selectedItem = document.querySelector(`[data-image-id="${imageId}"]`);
                if (selectedItem) {
                    selectedItem.classList.add('active');
                    return true;
                }
                // انتظار قصير قبل إعادة المحاولة
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            console.warn(`⚠️ عنصر الصورة غير موجود في DOM بعد ${maxRetries} محاولات: data-image-id="${imageId}"`);
            return false;
        };

        await selectElement(imageId);

        // تحميل الصورة في الـ canvas
        if (this.canvasHandler) {
            await this.canvasHandler.loadImage(image);
        }
    }

    async loadImagePreview(image) {
        const container = document.getElementById('imagePreviewContainer');
        if (!container) return;
        
        container.innerHTML = `
            <div class="text-center">
                <img src="${image.display_path}" class="img-fluid image-preview" alt="${image.filename}">
                <div class="mt-3">
                    <h6>${image.filename}</h6>
                    <small class="text-muted">${image.width} × ${image.height} - ${this.getStatusText(image.status)}</small>
                </div>
            </div>
        `;
    }
    
    autoSelectNextImage(workflow) {
        let targetImages = [];
        
        if (workflow === 'processing') {
            targetImages = this.currentProject.images.filter(img => img.status === 'unprocessed');
            if (targetImages.length > 0) {
                this.selectImageForProcessing(targetImages[0].id);
            }
        } else if (workflow === 'annotation') {
            targetImages = this.currentProject.images.filter(img => img.status === 'processed');
            if (targetImages.length > 0) {
                this.selectImageForAnnotation(targetImages[0].id);
            }
        }
    }
    
    // Auto-save and actions
    async saveCurrentAnnotations() {
        if (!this.currentImage || !this.canvasHandler) return;
        
        try {
            const annotations = this.canvasHandler.getAnnotations();
            
            const response = await fetch(`${this.apiBase}/annotations/${this.currentProject.id}/${this.currentImage.id}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ annotations })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showNotification('تم حفظ التوسيمات', 'success');
                // Update local data
                this.currentImage = data.image;
                await this.updateProjectStatistics();
            } else {
                throw new Error(data.error || 'Failed to save annotations');
            }
        } catch (error) {
            console.error('Error saving annotations:', error);
            this.showNotification('خطأ في حفظ التوسيمات', 'error');
        }
    }
    
    async markCurrentImageComplete() {
        if (!this.currentImage) return;
        
        try {
            // Save annotations first
            await this.saveCurrentAnnotations();
            
            // Mark as complete
            const response = await fetch(`${this.apiBase}/annotations/${this.currentProject.id}/${this.currentImage.id}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.showNotification('تم وسم الصورة كمكتملة', 'success');
                
                // Update local data
                this.currentImage = data.image;
                await this.updateProjectStatistics();
                await this.loadProjectImages();
                
                // Trigger auto-flow
                this.autoFlow.handleAnnotationFlow();
                
            } else {
                throw new Error(data.error || 'Failed to mark image complete');
            }
        } catch (error) {
            console.error('Error marking image complete:', error);
            this.showNotification('خطأ في تحديد الصورة كمكتملة', 'error');
        }
    }
    
    async updateProjectStatistics() {
        try {
            const response = await fetch(`${this.apiBase}/projects/${this.currentProject.id}/statistics`);
            const data = await response.json();
            
            if (response.ok) {
                this.currentProject.statistics = data;
            }
        } catch (error) {
            console.error('Error updating statistics:', error);
        }
    }
    
    // Export functionality
    async loadExportOptions() {
        const container = document.getElementById('exportContent');
        if (!container) return;
        
        try {
            // Load export preview
            const response = await fetch(`${this.apiBase}/exports/${this.currentProject.id}/preview`);
            const data = await response.json();
            
            if (response.ok) {
                this.renderExportOptions(data);
            } else {
                throw new Error(data.error || 'Failed to load export options');
            }
        } catch (error) {
            console.error('Error loading export options:', error);
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    خطأ في تحميل خيارات التصدير
                </div>
            `;
        }
    }
    
    renderExportOptions(exportData) {
        const container = document.getElementById('exportContent');
        
        container.innerHTML = `
            <div class="export-preview">
                <div class="row text-center mb-4">
                    <div class="col-md-3">
                        <div class="export-stat">
                            <i class="fas fa-images"></i>
                            <div class="fw-bold">${exportData.total_images}</div>
                            <small>إجمالي الصور</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="export-stat">
                            <i class="fas fa-tags"></i>
                            <div class="fw-bold">${exportData.annotated_images}</div>
                            <small>صور موسومة</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="export-stat">
                            <i class="fas fa-bookmark"></i>
                            <div class="fw-bold">${exportData.total_annotations}</div>
                            <small>إجمالي التوسيمات</small>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="export-stat">
                            <i class="fas fa-check-circle"></i>
                            <div class="fw-bold">${exportData.export_ready ? 'جاهز' : 'غير جاهز'}</div>
                            <small>حالة التصدير</small>
                        </div>
                    </div>
                </div>
                
                ${exportData.export_ready ? this.renderExportFormats() : this.renderNotReadyMessage()}
            </div>
        `;
    }
    
    renderExportFormats() {
        return `
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">
                                <i class="fas fa-file-csv me-2"></i>
                                تصدير CSV
                            </h5>
                            <p class="card-text">تصدير التوسيمات في صيغة CSV مع إمكانية تضمين الصور</p>
                            <button class="btn btn-primary" onclick="app.exportProject('csv')">
                                <i class="fas fa-download me-2"></i>
                                تصدير CSV
                            </button>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">
                                <i class="fas fa-robot me-2"></i>
                                تصدير YOLO
                            </h5>
                            <p class="card-text">تصدير بصيغة YOLO للتدريب مع تقسيم البيانات</p>
                            <button class="btn btn-success" onclick="app.exportProject('yolo')">
                                <i class="fas fa-download me-2"></i>
                                تصدير YOLO
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderNotReadyMessage() {
        return `
            <div class="alert alert-warning text-center">
                <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                <h5>التصدير غير متاح</h5>
                <p>يجب توسيم صورة واحدة على الأقل قبل التصدير</p>
                <button class="btn btn-primary" onclick="app.switchTab('annotation')">
                    <i class="fas fa-tags me-2"></i>
                    الانتقال للتوسيم
                </button>
            </div>
        `;
    }
    
    async exportProject(format) {
        try {
            this.showProgressModal('جاري التصدير...');
            
            const response = await fetch(`${this.apiBase}/exports/${this.currentProject.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    format: format,
                    settings: {
                        include_images: true,
                        split_ratio: { train: 0.7, val: 0.2, test: 0.1 }
                    }
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.hideProgressModal();
                this.showNotification('تم التصدير بنجاح', 'success');
                
                // Trigger download
                window.open(data.download_url, '_blank');
                
            } else {
                throw new Error(data.error || 'Export failed');
            }
        } catch (error) {
            this.hideProgressModal();
            console.error('Error exporting project:', error);
            this.showNotification('خطأ في التصدير', 'error');
        }
    }
    
    // Settings functionality
    async loadProjectSettings() {
        const container = document.getElementById('settingsContent');
        if (!container) return;
        
        container.innerHTML = `
            <div class="settings-section">
                <h6><i class="fas fa-cog me-2"></i>إعدادات التدفق التلقائي</h6>
                
                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="autoFlowEnabled" 
                               ${this.currentProject.settings.auto_flow_enabled ? 'checked' : ''}>
                        <label class="form-check-label" for="autoFlowEnabled">
                            تفعيل التدفق التلقائي
                        </label>
                    </div>
                </div>
                
                <div class="mb-3">
                    <label class="form-label">نمط التدفق التلقائي</label>
                    <select class="form-select" id="autoFlowMode">
                        <option value="manual" ${this.currentProject.settings.auto_flow_mode === 'manual' ? 'selected' : ''}>
                            يدوي
                        </option>
                        <option value="process_then_next" ${this.currentProject.settings.auto_flow_mode === 'process_then_next' ? 'selected' : ''}>
                            معالجة ثم الانتقال للتالي
                        </option>
                        <option value="process_then_annotate" ${this.currentProject.settings.auto_flow_mode === 'process_then_annotate' ? 'selected' : ''}>
                            معالجة ثم الانتقال للتوسيم
                        </option>
                    </select>
                </div>
                
                <div class="mb-3">
                    <label class="form-label">اتجاه النص الافتراضي</label>
                    <select class="form-select" id="defaultTextDirection">
                        <option value="rtl" ${this.currentProject.settings.text_direction === 'rtl' ? 'selected' : ''}>
                            من اليمين لليسار
                        </option>
                        <option value="ltr" ${this.currentProject.settings.text_direction === 'ltr' ? 'selected' : ''}>
                            من اليسار لليمين
                        </option>
                    </select>
                </div>
                
                <button class="btn btn-primary" onclick="app.saveProjectSettings()">
                    <i class="fas fa-save me-2"></i>
                    حفظ الإعدادات
                </button>
            </div>
            
            <div class="settings-section">
                <h6><i class="fas fa-chart-bar me-2"></i>إحصائيات المشروع</h6>
                <div class="row">
                    <div class="col-md-6">
                        <ul class="list-group">
                            <li class="list-group-item d-flex justify-content-between">
                                <span>إجمالي الصور</span>
                                <span class="badge bg-secondary">${this.currentProject.statistics.total_images}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between">
                                <span>صور غير معالجة</span>
                                <span class="badge bg-warning">${this.currentProject.statistics.unprocessed_images}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between">
                                <span>صور معالجة</span>
                                <span class="badge bg-info">${this.currentProject.statistics.processed_images}</span>
                            </li>
                        </ul>
                    </div>
                    <div class="col-md-6">
                        <ul class="list-group">
                            <li class="list-group-item d-flex justify-content-between">
                                <span>صور موسومة</span>
                                <span class="badge bg-primary">${this.currentProject.statistics.annotated_images}</span>
                            </li>
                            <li class="list-group-item d-flex justify-content-between">
                                <span>صور مكتملة</span>
                                <span class="badge bg-success">${this.currentProject.statistics.completed_images}</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
        
        // Bind settings change handlers
        this.bindSettingsHandlers();
    }
    
    bindSettingsHandlers() {
        const autoFlowEnabled = document.getElementById('autoFlowEnabled');
        const autoFlowMode = document.getElementById('autoFlowMode');
        
        if (autoFlowEnabled) {
            autoFlowEnabled.addEventListener('change', (e) => {
                this.autoFlow.setEnabled(e.target.checked);
            });
        }
        
        if (autoFlowMode) {
            autoFlowMode.addEventListener('change', (e) => {
                this.autoFlow.setMode(e.target.value);
            });
        }
    }
    
    async saveProjectSettings() {
        try {
            const settings = {
                auto_flow_enabled: document.getElementById('autoFlowEnabled').checked,
                auto_flow_mode: document.getElementById('autoFlowMode').value,
                text_direction: document.getElementById('defaultTextDirection').value
            };
            
            const response = await fetch(`${this.apiBase}/projects/${this.currentProject.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.currentProject.settings = { ...this.currentProject.settings, ...settings };
                this.showNotification('تم حفظ الإعدادات', 'success');
                
                // Update auto-flow manager
                this.autoFlow.updateSettings(settings);
            } else {
                throw new Error(data.error || 'Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification('خطأ في حفظ الإعدادات', 'error');
        }
    }
    
    // UI helpers
    showProgressModal(text) {
        const modal = new bootstrap.Modal(document.getElementById('progressModal'));
        document.getElementById('progressText').textContent = text;
        modal.show();
    }
    
    hideProgressModal() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('progressModal'));
        if (modal) {
            modal.hide();
        }
    }
    
    showNotification(message, type = 'info') {
        const toastMessage = document.getElementById('toastMessage');
        toastMessage.textContent = message;
        
        // Set toast color based on type
        this.toastElement.className = `toast ${type === 'error' ? 'bg-danger text-white' : type === 'success' ? 'bg-success text-white' : 'bg-info text-white'}`;
        
        this.toast.show();
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.app = new MusnadOCRApp();
});
