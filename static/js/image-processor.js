// Image Processor for handling image processing workflow and controls
class ImageProcessor {
    constructor(app) {
        this.app = app;
        this.currentSettings = this.getDefaultSettings();
        this.previewGenerated = false;
        this.processingInProgress = false;
        this.previewTimeout = null;
        this.saveTimeout = null;
        this.presets = this.getDefaultPresets();
        this.currentPreset = null;
        this.compareMode = localStorage.getItem('compareMode') || 'side-by-side'; // 'side-by-side' | 'slider'
    }
    
    getDefaultSettings() {
        return {
            grayscale: false,
            illumination: { enabled: false, blur_kernel: 41 },
            shadow_remove: { enabled: false, blur_kernel: 31 },
            clahe: { enabled: false, clip_limit: 2.0, tile_grid_size: 8 },
            local_contrast: { enabled: false, method: 'clahe', clip_limit: 2.5, tile_grid_size: 8 },
            gamma: { enabled: false, value: 1.0 },
            threshold: { enabled: false, type: 'adaptive', value: 127, max_value: 255 },
            deskew: { enabled: true },
            bilateral: { enabled: false, diameter: 7, sigma_color: 50, sigma_space: 50 },
            median: { enabled: false, kernel: 3 },
            morphology: { enabled: true, operation: 'opening', kernel_size: 3, iterations: 1 },
            denoise: { enabled: true, strength: 8 },
            sharpen: { enabled: false, strength: 1.0 },
            edge_enhance: { enabled: false, alpha: 0.3 },
            speck_remove: { enabled: false, max_area: 20 },
            quality: 85
        };
    }
    
    getDefaultPresets() {
        return {
            'basic': {
                'name': 'الإعدادات الأساسية',
                'settings': {
                    'grayscale': true,
                    'clahe': { 'enabled': false },
                    'threshold': { 'enabled': true, 'type': 'adaptive' },
                    'deskew': { 'enabled': true },
                    'morphology': { 'enabled': false },
                    'denoise': { 'enabled': false },
                    'sharpen': { 'enabled': false },
                    'quality': 85
                }
            },
            'enhanced': {
                'name': 'الإعدادات المحسنة',
                'settings': {
                    'grayscale': true,
                    'clahe': { 'enabled': true, 'clip_limit': 2.0, 'tile_grid_size': 8 },
                    'threshold': { 'enabled': true, 'type': 'adaptive' },
                    'deskew': { 'enabled': true },
                    'morphology': { 'enabled': true, 'operation': 'opening', 'kernel_size': 3, 'iterations': 1 },
                    'denoise': { 'enabled': true, 'strength': 8 },
                    'sharpen': { 'enabled': false },
                    'quality': 90
                }
            },
            'aggressive': {
                'name': 'الإعدادات المتقدمة',
                'settings': {
                    'grayscale': true,
                    'clahe': { 'enabled': true, 'clip_limit': 3.0, 'tile_grid_size': 8 },
                    'threshold': { 'enabled': true, 'type': 'adaptive' },
                    'deskew': { 'enabled': true },
                    'morphology': { 'enabled': true, 'operation': 'opening', 'kernel_size': 5, 'iterations': 2 },
                    'denoise': { 'enabled': true, 'strength': 12 },
                    'sharpen': { 'enabled': true, 'strength': 1.5 },
                    'quality': 95
                }
            },
            'musnad_optimized': {
                'name': 'مخصص لخط المسند',
                'settings': {
                    'grayscale': true,
                    'illumination': { 'enabled': true, 'blur_kernel': 41 },
                    'shadow_remove': { 'enabled': true, 'blur_kernel': 31 },
                    'clahe': { 'enabled': true, 'clip_limit': 2.5, 'tile_grid_size': 8 },
                    'local_contrast': { 'enabled': true, 'method': 'clahe', 'clip_limit': 2.5, 'tile_grid_size': 8 },
                    'gamma': { 'enabled': false, 'value': 1.0 },
                    'threshold': { 'enabled': true, 'type': 'adaptive', 'value': 127, 'max_value': 255 },
                    'deskew': { 'enabled': true },
                    'bilateral': { 'enabled': false, 'diameter': 7, 'sigma_color': 50, 'sigma_space': 50 },
                    'median': { 'enabled': false, 'kernel': 3 },
                    'morphology': { 'enabled': true, 'operation': 'closing', 'kernel_size': 2, 'iterations': 1 },
                    'denoise': { 'enabled': true, 'strength': 10 },
                    'sharpen': { 'enabled': true, 'strength': 1.2 },
                    'edge_enhance': { 'enabled': true, 'alpha': 0.35 },
                    'speck_remove': { 'enabled': true, 'max_area': 20 },
                    'quality': 90
                }
            }
        };
    }
    
    initializeControls() {
        this.createControlsInterface();
        this.bindControlEvents();
        this.loadSavedSettings();
        this.bindProcessingButtons();
        this.bindKeyboardShortcuts();
        // Default to Musnad preset will be decided in loadSavedSettings if no saved settings
    }
    
    createControlsInterface() {
        const container = document.getElementById('processingControls');
        if (!container) return;
        
        container.innerHTML = `
            <!-- Processing Settings -->
            <div class="processing-control">
                <h6><i class="fas fa-sliders-h me-2"></i>إعدادات المعالجة</h6>
                
                <!-- Quality Control -->
                <div class="mb-3">
                    <label class="form-label">جودة الصورة</label>
                    <input type="range" class="form-range" id="qualitySlider" 
                           min="30" max="100" value="85">
                    <small class="form-text text-muted">85%</small>
                </div>
                
                <!-- Basic Settings -->
                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="grayscaleToggle">
                        <label class="form-check-label" for="grayscaleToggle">
                            تحويل للرمادي
                        </label>
                    </div>
                    <small class="form-text text-muted">مفيد لنصوص OCR</small>
                </div>
                
                <!-- CLAHE Enhancement -->
                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="claheToggle">
                        <label class="form-check-label" for="claheToggle">
                            تحسين التباين (CLAHE)
                        </label>
                    </div>
                    <div class="clahe-settings mt-2" style="display: none;">
                        <div class="row g-2">
                            <div class="col">
                                <label class="form-label">قوة القطع</label>
                                <input type="range" class="form-range" id="claheClipLimit" 
                                       min="1" max="10" step="0.5" value="2">
                                <small class="form-text text-muted">2.0</small>
                            </div>
                            <div class="col">
                                <label class="form-label">حجم الشبكة</label>
                                <select class="form-select form-select-sm" id="claheTileSize">
                                    <option value="4">4×4</option>
                                    <option value="8" selected>8×8</option>
                                    <option value="16">16×16</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Thresholding -->
                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="thresholdToggle" checked>
                        <label class="form-check-label" for="thresholdToggle">
                            عتبة التحويل الثنائي
                        </label>
                    </div>
                    <div class="threshold-settings mt-2">
                        <div class="row g-2">
                            <div class="col">
                                <label class="form-label">نوع العتبة</label>
                                <select class="form-select form-select-sm" id="thresholdType">
                                    <option value="binary">ثنائي</option>
                                    <option value="adaptive" selected>تكيفي</option>
                                    <option value="otsu">Otsu</option>
                                    <option value="inverse">عكسي</option>
                                </select>
                            </div>
                            <div class="col">
                                <label class="form-label">قيمة العتبة</label>
                                <input type="range" class="form-range" id="thresholdValue" 
                                       min="0" max="255" value="127">
                                <small class="form-text text-muted">127</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Deskewing -->
                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="deskewToggle" checked>
                        <label class="form-check-label" for="deskewToggle">
                            تصحيح الدوران التلقائي
                        </label>
                    </div>
                    <small class="form-text text-muted">يصحح انحراف النص تلقائياً</small>
                </div>
                
                <!-- Morphological Operations -->
                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="morphologyToggle" checked>
                        <label class="form-check-label" for="morphologyToggle">
                            العمليات المورفولوجية
                        </label>
                    </div>
                    <div class="morphology-settings mt-2">
                        <div class="row g-2">
                            <div class="col">
                                <label class="form-label">العملية</label>
                                <select class="form-select form-select-sm" id="morphologyOperation">
                                    <option value="opening" selected>فتح</option>
                                    <option value="closing">إغلاق</option>
                                    <option value="erosion">تآكل</option>
                                    <option value="dilation">تمدد</option>
                                </select>
                            </div>
                            <div class="col">
                                <label class="form-label">حجم النواة</label>
                                <input type="range" class="form-range" id="morphologyKernel" 
                                       min="1" max="7" step="2" value="3">
                                <small class="form-text text-muted">3</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Noise Reduction -->
                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="denoiseToggle" checked>
                        <label class="form-check-label" for="denoiseToggle">
                            تقليل الضوضاء
                        </label>
                    </div>
                    <div class="denoise-settings mt-2" style="display: block;">
                        <label class="form-label">قوة التقليل</label>
                        <input type="range" class="form-range" id="denoiseStrength" 
                               min="1" max="20" value="8">
                        <small class="form-text text-muted">8</small>
                    </div>
                </div>
                
                <!-- Sharpening -->
                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="sharpenToggle">
                        <label class="form-check-label" for="sharpenToggle">
                            زيادة الحدة
                        </label>
                    </div>
                    <div class="sharpen-settings mt-2" style="display: none;">
                        <label class="form-label">قوة الحدة</label>
                        <input type="range" class="form-range" id="sharpenStrength" 
                               min="0.5" max="3" step="0.1" value="1">
                        <small class="form-text text-muted">1.0</small>
                    </div>
                </div>
            </div>

            <!-- Musnad Enhancements -->
            <div class="processing-control" id="musnadEnhancements" ">
                <h6><i class="fas fa-gem me-2"></i>تحسين النقوش المسندية</h6>

                <!-- Shadow removal -->
                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="shadowRemoveToggle">
                        <label class="form-check-label" for="shadowRemoveToggle">إزالة الظلال</label>
                    </div>
                    <div class="shadow-remove-settings mt-2" style="display:none;">
                        <label class="form-label">حجم التمويه</label>
                        <input type="range" class="form-range" id="shadowBlurKernel" min="3" max="61" step="2" value="31">
                        <small class="form-text text-muted">31</small>
                    </div>
                </div>

                <!-- Illumination leveling -->
                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="illuminationToggle">
                        <label class="form-check-label" for="illuminationToggle">تسوية الإضاءة</label>
                    </div>
                    <div class="illumination-settings mt-2" style="display:none;">
                        <label class="form-label">حجم التمويه</label>
                        <input type="range" class="form-range" id="illuminationBlurKernel" min="3" max="81" step="2" value="41">
                        <small class="form-text text-muted">41</small>
                    </div>
                </div>

                <!-- Local contrast -->
                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="localContrastToggle">
                        <label class="form-check-label" for="localContrastToggle">موازنة التباين المحلي المتقدم</label>
                    </div>
                    <div class="local-contrast-settings mt-2" style="display:none;">
                        <div class="row g-2">
                            <div class="col">
                                <label class="form-label">الطريقة</label>
                                <select class="form-select form-select-sm" id="localContrastMethod">
                                    <option value="clahe" selected>CLAHE</option>
                                    <option value="equalize">EqualizeHist</option>
                                </select>
                            </div>
                            <div class="col">
                                <label class="form-label">Clip</label>
                                <input type="range" class="form-range" id="localContrastClip" min="0.5" max="5" step="0.1" value="2.5">
                                <small class="form-text text-muted">2.5</small>
                            </div>
                            <div class="col">
                                <label class="form-label">Tile</label>
                                <select class="form-select form-select-sm" id="localContrastTile">
                                    <option value="4">4×4</option>
                                    <option value="8" selected>8×8</option>
                                    <option value="16">16×16</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Edge enhance -->
                <div class="mb-3">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="edgeEnhanceToggle">
                        <label class="form-check-label" for="edgeEnhanceToggle">تحسين الحواف</label>
                    </div>
                    <div class="edge-enhance-settings mt-2" style="display:none;">
                        <label class="form-label">قوة التأثير</label>
                        <input type="range" class="form-range" id="edgeEnhanceAlpha" min="0" max="2" step="0.05" value="0.35">
                        <small class="form-text text-muted">0.35</small>
                    </div>
                </div>
            </div>
            
            <!-- Preview and Process Controls -->
            <div class="processing-control">
                <h6><i class="fas fa-eye me-2"></i>معاينة ومعالجة</h6>
                
                <div class="d-grid gap-2">
                    <button id="generatePreviewBtn" class="btn btn-outline-info btn-sm">
                        <i class="fas fa-eye me-2"></i>معاينة
                    </button>
                    
                    <button id="processImageBtn" class="btn btn-success btn-sm">
                        <i class="fas fa-cog me-2"></i>معالجة الصورة
                    </button>
                    
                    <button id="batchProcessBtn" class="btn btn-outline-primary btn-sm">
                        <i class="fas fa-layer-group me-2"></i>معالجة دفعية
                    </button>
                </div>
                
                <div class="mt-3">
                    <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox" id="autoProcessNext" checked>
                        <label class="form-check-label" for="autoProcessNext">
                            معالجة تلقائية للتالي
                        </label>
                    </div>
                    <div class="form-check form-switch mt-2">
                        <input class="form-check-input" type="checkbox" id="compareSliderToggle">
                        <label class="form-check-label" for="compareSliderToggle">
                            مقارنة انزلاقية (قبل/بعد)
                        </label>
                    </div>
                </div>
            </div>
            
            <!-- Quick Presets -->
            <div class="processing-control">
                <h6><i class="fas fa-magic me-2"></i>الإعدادات المسبقة</h6>
                
                <div class="d-grid gap-2">
                    <button class="btn btn-outline-secondary btn-sm preset-btn" data-preset="basic">
                        أساسي
                    </button>
                    <button class="btn btn-outline-secondary btn-sm preset-btn" data-preset="enhanced">
                        محسن
                    </button>
                    <button class="btn btn-outline-secondary btn-sm preset-btn" data-preset="aggressive">
                        متقدم
                    </button>
                    <button class="btn btn-outline-warning btn-sm preset-btn" data-preset="musnad_optimized">
                        مسند
                    </button>
                </div>
                
                <div class="mt-2">
                    <button id="saveSettingsBtn" class="btn btn-outline-warning btn-sm w-100">
                        <i class="fas fa-save me-2"></i>حفظ الإعدادات
                    </button>
                </div>
                
                <div class="mt-2">
                    <div class="btn-group w-100" role="group">
                        <button id="exportSettingsBtn" class="btn btn-outline-info btn-sm">
                            <i class="fas fa-upload me-1"></i>تصدير
                        </button>
                        <button id="importSettingsBtn" class="btn btn-outline-info btn-sm">
                            <i class="fas fa-download me-1"></i>استيراد
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Image Statistics -->
            <div class="processing-control">
                <h6><i class="fas fa-chart-bar me-2"></i>إحصائيات الصورة</h6>
                <div id="imageStats" class="text-muted">
                    <small>اختر صورة لعرض الإحصائيات</small>
                </div>
            </div>
            
            <!-- Hidden file input for import -->
            <input type="file" id="settingsFileInput" accept=".json" style="display: none;">
        `;
    }
    
    bindControlEvents() {
        // Toggle switches for main settings
        this.bindToggleSetting('grayscaleToggle', 'grayscale');
        this.bindToggleSetting('claheToggle', 'clahe.enabled', '.clahe-settings');
        this.bindToggleSetting('thresholdToggle', 'threshold.enabled', '.threshold-settings');
        this.bindToggleSetting('deskewToggle', 'deskew.enabled');
        this.bindToggleSetting('morphologyToggle', 'morphology.enabled', '.morphology-settings');
        this.bindToggleSetting('denoiseToggle', 'denoise.enabled', '.denoise-settings');
        this.bindToggleSetting('sharpenToggle', 'sharpen.enabled', '.sharpen-settings');

        // Musnad enhancements toggles
        this.bindToggleSetting('shadowRemoveToggle', 'shadow_remove.enabled', '.shadow-remove-settings');
        this.bindRangeSetting('shadowBlurKernel', 'shadow_remove.blur_kernel', parseInt);
        this.bindToggleSetting('illuminationToggle', 'illumination.enabled', '.illumination-settings');
        this.bindRangeSetting('illuminationBlurKernel', 'illumination.blur_kernel', parseInt);
        this.bindToggleSetting('localContrastToggle', 'local_contrast.enabled', '.local-contrast-settings');
        this.bindSelectSetting('localContrastMethod', 'local_contrast.method', String);
        this.bindRangeSetting('localContrastClip', 'local_contrast.clip_limit');
        this.bindSelectSetting('localContrastTile', 'local_contrast.tile_grid_size', parseInt);
        this.bindToggleSetting('edgeEnhanceToggle', 'edge_enhance.enabled', '.edge-enhance-settings');
        this.bindRangeSetting('edgeEnhanceAlpha', 'edge_enhance.alpha');
        
        // Range sliders and selects
        this.bindRangeSetting('qualitySlider', 'quality', parseInt);
        this.bindRangeSetting('claheClipLimit', 'clahe.clip_limit');
        this.bindSelectSetting('claheTileSize', 'clahe.tile_grid_size', parseInt);
        this.bindSelectSetting('thresholdType', 'threshold.type');
        this.bindRangeSetting('thresholdValue', 'threshold.value', parseInt);
        this.bindSelectSetting('morphologyOperation', 'morphology.operation');
        this.bindRangeSetting('morphologyKernel', 'morphology.kernel_size', parseInt);
        this.bindRangeSetting('denoiseStrength', 'denoise.strength', parseInt);
        this.bindRangeSetting('sharpenStrength', 'sharpen.strength', parseFloat);
        
        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preset = e.target.dataset.preset;
                this.applyPreset(preset);
            });
        });
        
        // Control buttons
        const generatePreviewBtn = document.getElementById('generatePreviewBtn');
        const processImageBtn = document.getElementById('processImageBtn');
        const batchProcessBtn = document.getElementById('batchProcessBtn');
        const saveSettingsBtn = document.getElementById('saveSettingsBtn');
        const exportSettingsBtn = document.getElementById('exportSettingsBtn');
        const importSettingsBtn = document.getElementById('importSettingsBtn');
        const settingsFileInput = document.getElementById('settingsFileInput');
        const compareSliderToggle = document.getElementById('compareSliderToggle');
        
        if (generatePreviewBtn) {
            generatePreviewBtn.addEventListener('click', () => this.generatePreview());
        }
        
        if (processImageBtn) {
            processImageBtn.addEventListener('click', () => this.processCurrentImage());
        }
        
        if (batchProcessBtn) {
            batchProcessBtn.addEventListener('click', () => this.showBatchProcessDialog());
        }
        
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.saveSettings());
        }
        
        if (exportSettingsBtn) {
            exportSettingsBtn.addEventListener('click', () => this.exportSettings());
        }
        
        if (importSettingsBtn) {
            importSettingsBtn.addEventListener('click', () => settingsFileInput.click());
        }
        
        if (settingsFileInput) {
            settingsFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.importSettings(e.target.files[0]);
                    e.target.value = ''; // Reset file input
                }
            });
        }

        if (compareSliderToggle) {
            compareSliderToggle.checked = (this.compareMode === 'slider');
            compareSliderToggle.addEventListener('change', (e) => {
                this.compareMode = e.target.checked ? 'slider' : 'side-by-side';
                localStorage.setItem('compareMode', this.compareMode);
                this.updatePreview();
            });
        }
    }
    
    bindProcessingButtons() {
        // Main processing buttons in the preview area
        const processCurrentBtn = document.getElementById('processCurrentBtn');
        const nextUnprocessedBtn = document.getElementById('nextUnprocessedBtn');
        
        if (processCurrentBtn) {
            processCurrentBtn.addEventListener('click', () => this.processCurrentImage());
        }
        
        if (nextUnprocessedBtn) {
            nextUnprocessedBtn.addEventListener('click', () => this.selectNextUnprocessedImage());
        }
    }
    
    bindToggleSetting(elementId, settingPath, toggleElement = null) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.addEventListener('change', (e) => {
            this.setNestedProperty(this.currentSettings, settingPath, element.checked);
            
            // Toggle associated settings panel
            if (toggleElement) {
                const panel = element.closest('.processing-control').querySelector(toggleElement);
                if (panel) {
                    panel.style.display = element.checked ? 'block' : 'none';
                }
            }
            
            this.updatePreview();
            this.autoSaveSettings();
        });
    }
    
    bindRangeSetting(elementId, settingPath, converter = parseFloat) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.addEventListener('input', (e) => {
            const value = converter(e.target.value);
            this.setNestedProperty(this.currentSettings, settingPath, value);
            
            // Update display
            const display = element.nextElementSibling;
            if (display && display.classList.contains('text-muted')) {
                display.textContent = value.toString();
            }
            
            this.updatePreview();
            this.autoSaveSettings();
        });
    }
    
    bindSelectSetting(elementId, settingPath, converter = String) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.addEventListener('change', (e) => {
            const value = converter(e.target.value);
            this.setNestedProperty(this.currentSettings, settingPath, value);
            this.updatePreview();
            this.autoSaveSettings();
        });
    }
    
    setNestedProperty(obj, path, value) {
        const keys = path.split('.');
        let current = obj;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in current)) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
    }
    
    getNestedProperty(obj, path) {
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return undefined;
            }
        }
        
        return current;
    }
    
    updateControlsFromSettings() {
        // Update all controls to match current settings
        this.updateToggleControl('grayscaleToggle', 'grayscale');
        this.updateToggleControl('claheToggle', 'clahe.enabled');
        this.updateToggleControl('thresholdToggle', 'threshold.enabled');
        this.updateToggleControl('deskewToggle', 'deskew.enabled');
        this.updateToggleControl('morphologyToggle', 'morphology.enabled');
        this.updateToggleControl('denoiseToggle', 'denoise.enabled');
        this.updateToggleControl('sharpenToggle', 'sharpen.enabled');

        // Musnad enhancements
        this.updateToggleControl('shadowRemoveToggle', 'shadow_remove.enabled');
        this.updateRangeControl('shadowBlurKernel', 'shadow_remove.blur_kernel');
        this.updateToggleControl('illuminationToggle', 'illumination.enabled');
        this.updateRangeControl('illuminationBlurKernel', 'illumination.blur_kernel');
        this.updateToggleControl('localContrastToggle', 'local_contrast.enabled');
        this.updateSelectControl('localContrastMethod', 'local_contrast.method');
        this.updateRangeControl('localContrastClip', 'local_contrast.clip_limit');
        this.updateSelectControl('localContrastTile', 'local_contrast.tile_grid_size');
        this.updateToggleControl('edgeEnhanceToggle', 'edge_enhance.enabled');
        this.updateRangeControl('edgeEnhanceAlpha', 'edge_enhance.alpha');
        
        // Update range controls
        this.updateRangeControl('qualitySlider', 'quality');
        this.updateRangeControl('claheClipLimit', 'clahe.clip_limit');
        this.updateSelectControl('claheTileSize', 'clahe.tile_grid_size');
        this.updateSelectControl('thresholdType', 'threshold.type');
        this.updateRangeControl('thresholdValue', 'threshold.value');
        this.updateSelectControl('morphologyOperation', 'morphology.operation');
        this.updateRangeControl('morphologyKernel', 'morphology.kernel_size');
        this.updateRangeControl('denoiseStrength', 'denoise.strength');
        this.updateRangeControl('sharpenStrength', 'sharpen.strength');
        
        // Update visibility of sub-controls
        this.updateSubControlVisibility();

        // Ensure Musnad panel is shown when relevant settings are active
        const panel = document.getElementById('musnadEnhancements');
        if (panel) {
            const s = this.currentSettings || {};
            const musnadActive = this.currentPreset === 'musnad_optimized'
                || (s.illumination && s.illumination.enabled)
                || (s.shadow_remove && s.shadow_remove.enabled)
                || (s.local_contrast && s.local_contrast.enabled)
                || (s.edge_enhance && s.edge_enhance.enabled);
            panel.style.display = musnadActive ? 'block' : 'none';
        }
    }
    
    updateToggleControl(elementId, settingPath) {
        const element = document.getElementById(elementId);
        if (element) {
            element.checked = this.getNestedProperty(this.currentSettings, settingPath) || false;
        }
    }
    
    updateRangeControl(elementId, settingPath) {
        const element = document.getElementById(elementId);
        if (element) {
            const value = this.getNestedProperty(this.currentSettings, settingPath);
            if (value !== undefined) {
                element.value = value;
                const display = element.nextElementSibling;
                if (display && display.classList.contains('text-muted')) {
                    display.textContent = value.toString();
                }
            }
        }
    }
    
    updateSelectControl(elementId, settingPath) {
        const element = document.getElementById(elementId);
        if (element) {
            const value = this.getNestedProperty(this.currentSettings, settingPath);
            if (value !== undefined) {
                element.value = value;
            }
        }
    }
    
    updateSubControlVisibility() {
        const visibilityMap = {
            '.clahe-settings': 'clahe.enabled',
            '.threshold-settings': 'threshold.enabled',
            '.morphology-settings': 'morphology.enabled',
            '.denoise-settings': 'denoise.enabled',
            '.sharpen-settings': 'sharpen.enabled',
            '.shadow-remove-settings': 'shadow_remove.enabled',
            '.illumination-settings': 'illumination.enabled',
            '.local-contrast-settings': 'local_contrast.enabled',
            '.edge-enhance-settings': 'edge_enhance.enabled'
        };
        
        Object.entries(visibilityMap).forEach(([selector, settingPath]) => {
            const element = document.querySelector(selector);
            if (element) {
                const isEnabled = this.getNestedProperty(this.currentSettings, settingPath);
                element.style.display = isEnabled ? 'block' : 'none';
            }
        });
    }
    
    applyPreset(presetName) {
        if (this.presets[presetName]) {
            // Merge preset with current settings
            this.currentSettings = { ...this.currentSettings, ...this.presets[presetName].settings };
            this.currentPreset = presetName;
            
            // Update UI controls
            this.updateControlsFromSettings();

            // Show Musnad enhancements panel only for Musnad preset
            // const panel = document.getElementById('musnadEnhancements');
            // if (panel) panel.style.display = (presetName === 'musnad_optimized') ? 'block' : 'none';
            
            // Generate preview
            this.updatePreview();
            
            this.app.showNotification(`تم تطبيق الإعداد المسبق: ${this.presets[presetName].name}`, 'info');
            this.autoSaveSettings();
        }
    }

    // Debounced preview updater used across controls
    updatePreview() {
        if (this.previewTimeout) {
            clearTimeout(this.previewTimeout);
        }
        this.previewTimeout = setTimeout(() => {
            this.generatePreview();
        }, 400);
    }

    buildOrderedSettings() {
        const s = this.currentSettings || {};
        // Return in the exact order of backend pipeline
        return {
            grayscale: !!s.grayscale,
            illumination: s.illumination || { enabled: false, blur_kernel: 41 },
            shadow_remove: s.shadow_remove || { enabled: false, blur_kernel: 31 },
            clahe: s.clahe || { enabled: false, clip_limit: 2.0, tile_grid_size: 8 },
            local_contrast: s.local_contrast || { enabled: false, method: 'clahe', clip_limit: 2.5, tile_grid_size: 8 },
            gamma: s.gamma || { enabled: false, value: 1.0 },
            threshold: s.threshold || { enabled: false, type: 'adaptive', value: 127, max_value: 255 },
            deskew: s.deskew || { enabled: false },
            bilateral: s.bilateral || { enabled: false, diameter: 7, sigma_color: 50, sigma_space: 50 },
            median: s.median || { enabled: false, kernel: 3 },
            morphology: s.morphology || { enabled: false, operation: 'opening', kernel_size: 3, iterations: 1 },
            denoise: s.denoise || { enabled: false, strength: 8 },
            sharpen: s.sharpen || { enabled: false, strength: 1.0 },
            edge_enhance: s.edge_enhance || { enabled: false, alpha: 0.3 },
            speck_remove: s.speck_remove || { enabled: false, max_area: 20 },
            quality: s.quality ?? 85
        };
    }
    
    async generatePreview() {
        if (!this.app.currentImage || this.processingInProgress) return;
        
        const btn = document.getElementById('generatePreviewBtn');
        const originalBtnHTML = btn?.innerHTML;
        
        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>جاري إنشاء المعاينة...';
            }
            
            const previewSize = { width: 800, height: 600 };
            
            const response = await fetch(`${this.app.apiBase}/processing/${this.app.currentProject.id}/${this.app.currentImage.id}/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    settings: this.buildOrderedSettings(),
                    preview_size: previewSize
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.updatePreviewDisplay(data);  // تمرير data كاملة وليس فقط preview_url
                this.previewGenerated = true;
                this.app.showNotification('تم إنشاء المعاينة بنجاح', 'success');
            } else {
                throw new Error(data.error || 'Failed to generate preview');
            }
        } catch (error) {
            console.error('Error generating preview:', error);
            this.app.showNotification('خطأ في إنشاء المعاينة', 'error');
            this.updatePreviewDisplay({});  // عرض حالة الخطأ
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalBtnHTML || '<i class="fas fa-eye me-2"></i>معاينة';
            }
        }
    }
    updatePreviewDisplay(previewData) {
        const container = document.getElementById('imagePreviewContainer');
        if (!container || !this.app.currentImage) return;
        
        const timestamp = new Date().getTime();
        const originalUrl = `${this.app.currentImage.display_path}?t=${timestamp}`;
        
        const previewUrl = previewData.preview_url ? `${previewData.preview_url}?t=${timestamp}` : '';
        
        container.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6 class="text-center mb-3">الصورة الأصلية</h6>
                    <img src="${originalUrl}" class="img-fluid rounded" alt="Original" 
                        onerror="this.src='${this.app.currentImage.display_path}'">
                </div>
                <div class="col-md-6">
                    <h6 class="text-center mb-3">معاينة المعالجة</h6>
                    ${previewUrl ? `
                    <img src="${previewUrl}" class="img-fluid rounded" alt="Preview"
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
                    ` : ''}
                    <div class="preview-error text-center text-danger mt-2" style="display: ${previewUrl ? 'none' : 'block'};">
                        <i class="fas fa-exclamation-triangle"></i>
                        ${previewUrl ? 'فشل تحميل المعاينة' : 'لم يتم إنشاء معاينة بعد'}
                    </div>
                </div>
            </div>
            <div class="mt-3 text-center">
                <h6>${this.app.currentImage.filename}</h6>
                <small class="text-muted">${this.app.currentImage.width} × ${this.app.currentImage.height} - ${this.app.getStatusText(this.app.currentImage.status)}</small>
            </div>
        `;
    }
    
    async processCurrentImage() {
        if (!this.app.currentImage || this.processingInProgress) return;
        
        this.processingInProgress = true;
        
        // Update button states
        const processBtn = document.getElementById('processImageBtn') || document.getElementById('processCurrentBtn');
        const originalBtnHTML = processBtn?.innerHTML;
        
        try {
            if (processBtn) {
                processBtn.disabled = true;
                processBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>جاري المعالجة...';
            }
            
            const response = await fetch(`${this.app.apiBase}/processing/${this.app.currentProject.id}/${this.app.currentImage.id}/apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: this.buildOrderedSettings() })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Update current image data
                this.app.currentImage = data.image;
                
                // Update image list
                await this.app.loadProjectImages();
                
                // Update project statistics
                await this.app.updateProjectStatistics();
                
                this.app.showNotification('تمت معالجة الصورة بنجاح', 'success');
                
                // Handle auto-flow or move to next image
                if (this.app.autoFlow && this.app.autoFlow.enabled) {
                    await this.app.autoFlow.handleProcessingFlow();
                } else {
                    // Always move to next unprocessed image after processing
                    // Add small delay to ensure data is fully updated
                    setTimeout(() => {
                        this.selectNextUnprocessedImage();
                    }, 100);
                }
                
            } else {
                throw new Error(data.error || 'Processing failed');
            }
        } catch (error) {
            console.error('Error processing image:', error);
            this.app.showNotification('خطأ في معالجة الصورة', 'error');
        } finally {
            this.processingInProgress = false;
            
            if (processBtn) {
                processBtn.disabled = false;
                processBtn.innerHTML = originalBtnHTML || '<i class="fas fa-cog me-2"></i>معالجة الصورة';
            }
        }
    }
    
    selectNextUnprocessedImage() {
        const unprocessedImages = this.app.currentProject.images.filter(img => img.status === 'unprocessed');
        
        if (unprocessedImages.length > 0) {
            // Simply select the first unprocessed image
            // Since the current image is now processed, it's no longer in the unprocessed list
            this.app.selectImageForProcessing(unprocessedImages[0].id);
        } else {
            // Clear current image display since no more images to process
            this.clearImagePreview();
            this.app.showNotification('تمت معالجة جميع الصور', 'info');
            
            // Check if should switch to annotation
            const processedImages = this.app.currentProject.images.filter(img => img.status === 'processed');
            if (processedImages.length > 0) {
                setTimeout(() => {
                    this.app.switchTab('annotation');
                }, 1000);
            }
        }
    }
    
    clearImagePreview() {
        const container = document.getElementById('imagePreviewContainer');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
                    <h5>${window.i18n ? window.i18n.t('processing.all_completed') : 'تمت معالجة جميع الصور'}</h5>
                    <p class="text-muted">${window.i18n ? window.i18n.t('processing.switch_to_annotation') : 'يمكنك الانتقال لتبويب التوسيم لبدء عملية التوسيم'}</p>
                </div>
            `;
        }
        
        // Clear current image
        this.app.currentImage = null;
    }
    
    async showBatchProcessDialog() {
        const unprocessedImages = this.app.currentProject.images.filter(img => img.status === 'unprocessed');
        
        if (unprocessedImages.length === 0) {
            this.app.showNotification('لا توجد صور غير معالجة', 'warning');
            return;
        }
        
        const confirmed = confirm(`هل تريد معالجة جميع الصور غير المعالجة (${unprocessedImages.length} صورة) بالإعدادات الحالية؟`);
        
        if (confirmed) {
            await this.processBatch(unprocessedImages);
        }
    }
    
    async processBatch(images) {
        this.app.showProgressModal('معالجة دفعية');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        let processed = 0;
        let failed = 0;
        const errors = [];
        
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            
            try {
                if (progressText) {
                    progressText.textContent = `جاري معالجة: ${image.filename} (${i + 1}/${images.length})`;
                }
                
                if (progressBar) {
                    const progress = ((i + 1) / images.length) * 100;
                    progressBar.style.width = `${progress}%`;
                }
                
                const response = await fetch(`${this.app.apiBase}/processing/${this.app.currentProject.id}/${image.id}/apply`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ settings: this.currentSettings })
                });
                
                if (response.ok) {
                    processed++;
                } else {
                    const data = await response.json();
                    failed++;
                    errors.push(`فشل معالجة ${image.filename}: ${data.error || 'Unknown error'}`);
                }
                
            } catch (error) {
                console.error(`Error processing image ${image.filename}:`, error);
                failed++;
                errors.push(`فشل معالجة ${image.filename}: ${error.message}`);
            }
            
            // Small delay to prevent overwhelming the server
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.app.hideProgressModal();
        
        // Update project data
        await this.app.loadProjectImages();
        await this.app.updateProjectStatistics();
        
        let message = `المعالجة الدفعية مكتملة. نجح: ${processed}, فشل: ${failed}`;
        let type = failed > 0 ? 'warning' : 'success';
        
        if (failed > 0 && errors.length > 0) {
            message += `. الأخطاء: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`;
        }
        
        this.app.showNotification(message, type);
        
        // Auto-switch to annotation if processing complete
        const remainingUnprocessed = this.app.currentProject.images.filter(img => img.status === 'unprocessed');
        if (remainingUnprocessed.length === 0) {
            setTimeout(() => {
                this.app.switchTab('annotation');
            }, 2000);
        }
    }
    
    async loadImageStatistics(image) {
        if (!image) return;
        
        try {
            const response = await fetch(`${this.app.apiBase}/processing/${image.project_id}/${image.id}/suggest-settings`);
            const data = await response.json();
            
            if (response.ok) {
                this.displayImageStatistics(data.image_statistics);
                
                // Optionally apply suggested settings
                if (data.suggested_settings) {
                    this.showSuggestedSettings(data.suggested_settings, data.recommendations);
                }
            }
        } catch (error) {
            console.error('Error loading image statistics:', error);
        }
    }
    
    displayImageStatistics(stats) {
        const container = document.getElementById('imageStats');
        if (!container) return;
        
        container.innerHTML = `
            <div class="small">
                <div class="mb-1">
                    <strong>الأبعاد:</strong> ${stats.width} × ${stats.height}
                </div>
                <div class="mb-1">
                    <strong>الحجم:</strong> ${(stats.file_size / 1024).toFixed(1)} KB
                </div>
                <div class="mb-1">
                    <strong>السطوع:</strong> ${stats.brightness.toFixed(1)}
                </div>
                <div class="mb-1">
                    <strong>التباين:</strong> ${stats.contrast.toFixed(1)}
                </div>
                <div class="mb-1">
                    <strong>الحدة:</strong> ${stats.sharpness.toFixed(1)}
                </div>
            </div>
        `;
    }
    
    showSuggestedSettings(suggestedSettings, recommendations) {
        // Create a small notification with suggested settings
        const hasRecommendations = Object.values(recommendations || {}).some(r => r !== null);
        
        if (hasRecommendations) {
            const suggestionDiv = document.createElement('div');
            suggestionDiv.className = 'alert alert-info alert-dismissible fade show mt-2';
            suggestionDiv.innerHTML = `
                <small>
                    <strong><i class="fas fa-lightbulb me-1"></i>اقتراحات:</strong><br>
                    ${Object.values(recommendations).filter(r => r).map(r => `• ${r}`).join('<br>')}
                </small>
                <button type="button" class="btn-close btn-sm" data-bs-dismiss="alert"></button>
            `;
            
            const container = document.getElementById('imageStats');
            if (container) {
                container.appendChild(suggestionDiv);
                
                // Auto-dismiss after 10 seconds
                setTimeout(() => {
                    const alert = bootstrap.Alert.getInstance(suggestionDiv);
                    if (alert) alert.close();
                }, 10000);
            }
        }
    }
    
    async saveSettings() {
        try {
            const response = await fetch(`${this.app.apiBase}/processing/${this.app.currentProject.id}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: this.buildOrderedSettings() })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.app.showNotification('تم حفظ الإعدادات كإعدادات افتراضية', 'success');
            } else {
                throw new Error(data.error || 'Failed to save settings');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.app.showNotification('خطأ في حفظ الإعدادات', 'error');
        }
    }
    
    autoSaveSettings() {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = setTimeout(() => {
            this.saveSettings();
        }, 2000);
    }
    
    async loadSavedSettings() {
        try {
            const response = await fetch(`${this.app.apiBase}/processing/${this.app.currentProject.id}/settings`);
            const data = await response.json();
            
            if (response.ok && data.default_settings) {
                this.currentSettings = { ...this.currentSettings, ...data.default_settings };
                this.updateControlsFromSettings();
                // Mark as custom so default Musnad preset isn't applied automatically
                this.currentPreset = 'custom';
            } else {
                // No saved settings; apply Musnad preset as default
                this.applyPreset('musnad_optimized');
            }
        } catch (error) {
            console.error('Error loading saved settings:', error);
            // Fallback to Musnad preset on error
            this.applyPreset('musnad_optimized');
        }
    }
    
    getCurrentSettings() {
        return this.currentSettings;
    }
    
    // Method called when a new image is selected
    async onImageSelected(image) {
        this.app.currentImage = image;
        await this.loadImageStatistics(image);
        
        // Reset preview state
        this.previewGenerated = false;
        
        // Generate initial preview if auto-preview is enabled
        const autoPreview = localStorage.getItem('autoPreview') !== 'false';
        if (autoPreview) {
            setTimeout(() => this.generatePreview(), 500);
        }
    }
    
    // Export/Import settings
    exportSettings() {
        const settings = {
            exported_at: new Date().toISOString(),
            settings: this.currentSettings,
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `musnad-processing-settings-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        
        this.app.showNotification('تم تصدير الإعدادات بنجاح', 'success');
    }
    
    importSettings(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.settings) {
                    this.currentSettings = { ...this.currentSettings, ...data.settings };
                    this.updateControlsFromSettings();
                    this.app.showNotification('تم استيراد الإعدادات بنجاح', 'success');
                    this.autoSaveSettings();
                } else {
                    throw new Error('Invalid settings file');
                }
            } catch (error) {
                console.error('Error importing settings:', error);
                this.app.showNotification('خطأ في استيراد الإعدادات: ملف غير صحيح', 'error');
            }
        };
        reader.onerror = () => {
            this.app.showNotification('خطأ في قراءة الملف', 'error');
        };
        reader.readAsText(file);
    }
    
    // Keyboard shortcuts
    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only process shortcuts in processing tab
            if (this.app.currentTab !== 'processing') return;
            
            // Ignore if focused on input elements
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                return;
            }
            
            switch (e.key) {
                case 'p':
                case 'P':
                    e.preventDefault();
                    this.generatePreview();
                    break;
                    
                case 'Enter':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.processCurrentImage();
                    }
                    break;
                    
                case 'ArrowRight':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.selectNextUnprocessedImage();
                    }
                    break;
                    
                case '1':
                    e.preventDefault();
                    this.applyPreset('basic');
                    break;
                    
                case '2':
                    e.preventDefault();
                    this.applyPreset('enhanced');
                    break;
                    
                case '3':
                    e.preventDefault();
                    this.applyPreset('aggressive');
                    break;
                    
                case '4':
                    e.preventDefault();
                    this.applyPreset('musnad_optimized');
                    break;
            }
        });
    }
}