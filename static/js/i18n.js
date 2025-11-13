// Internationalization (i18n) System for Musnad OCR Tool
class I18n {
    constructor() {
        this.currentLanguage = localStorage.getItem('musnad_language') || 'ar';
        this.translations = {
            ar: {
                // Header
                'app.title': 'أداة إعداد بيانات المسند',
                'app.welcome': 'مرحباً بك في أداة إعداد بيانات المسند',
                'app.description': 'أداة شاملة لمعالجة وتوسيم صور النصوص المسندية القديمة',
                
                // Navigation Tabs
                'tab.processing': 'معالجة الصور',
                'tab.annotation': 'التوسيم والتحرير',
                'tab.review': 'استعراض التوسيمات',
                'tab.export': 'التصدير',
                'tab.settings': 'الإعدادات',
                
                // Project Management
                'project.new': 'مشروع جديد',
                'project.create': 'إنشاء المشروع',
                'project.cancel': 'إلغاء',
                'project.name': 'اسم المشروع',
                'project.description': 'وصف المشروع',
                'project.type': 'نوع المشروع',
                'project.type.manuscript': 'مخطوطة',
                'project.type.document': 'وثيقة',
                'project.type.book': 'كتاب',
                'project.available': 'المشاريع المتاحة',
                'project.no_projects': 'لا توجد مشاريع',
                'project.create_first': 'قم بإنشاء مشروعك الأول',
                
                // Processing Tab
                'processing.title': 'تحكم في المعالجة',
                'processing.available_images': 'الصور المتاحة للمعالجة',
                'processing.upload_images': 'رفع الصور',
                'processing.select_images': 'اختر الصور',
                'processing.upload': 'رفع',
                'processing.process_selected': 'معالجة المحددة',
                'processing.process_all': 'معالجة الكل',
                'processing.auto_flow': 'التدفق التلقائي',
                'processing.no_images': 'لا توجد صور',
                'processing.upload_first': 'قم برفع بعض الصور للبدء',
                'processing.all_completed': 'تمت معالجة جميع الصور',
                'processing.switch_to_annotation': 'يمكنك الانتقال لتبويب التوسيم لبدء عملية التوسيم',
                
                // Processing Settings
                'processing.settings': 'إعدادات المعالجة',
                'processing.grayscale': 'تحويل للرمادي',
                'processing.clahe': 'تحسين التباين (CLAHE)',
                'processing.threshold': 'العتبة',
                'processing.deskew': 'تصحيح الميل',
                'processing.morphology': 'العمليات المورفولوجية',
                'processing.denoise': 'إزالة الضوضاء',
                'processing.sharpen': 'زيادة الحدة',
                'processing.quality': 'جودة الحفظ',
                
                // Annotation Tab
                'annotation.canvas_mode': 'وضع الكانفس',
                'annotation.select_mode': 'وضع التحديد',
                'annotation.draw_mode': 'وضع الرسم',
                'annotation.delete_annotation': 'حذف التوسيم',
                'annotation.save_annotations': 'حفظ التوسيمات',
                'annotation.auto_save': 'حفظ تلقائي',
                'annotation.zoom_controls': 'التحكم في التكبير',
                'annotation.zoom_in': 'تكبير',
                'annotation.zoom_out': 'تصغير',
                'annotation.fit_screen': 'ملائمة الشاشة',
                'annotation.reset_zoom': 'إعادة تعيين',
                'annotation.rotation_controls': 'التحكم في التدوير',
                'annotation.rotate_left': 'دوران عكس عقارب الساعة',
                'annotation.rotate_right': 'دوران مع عقارب الساعة',
                'annotation.reset_rotation': 'إعادة تعيين الدوران',
                'annotation.reset_all': 'إعادة تعيين الكل',
                'annotation.type': 'نوع التوسيم',
                'annotation.type.text': 'نص',
                'annotation.type.missing_region': 'منطقة مفقودة',
                'annotation.level': 'مستوى التوسيم',
                'annotation.level.character': 'حرف',
                'annotation.level.word': 'كلمة',
                'annotation.level.line': 'سطر',
                'annotation.level.paragraph': 'فقرة',
                'annotation.text_direction': 'اتجاه النص',
                'annotation.text_direction.rtl': 'من اليمين لليسار',
                'annotation.text_direction.ltr': 'من اليسار لليمين',
                'annotation.label': 'التسمية',
                'annotation.confidence': 'مستوى الثقة',
                'annotation.no_images': 'لا توجد صور للتوسيم',
                'annotation.process_first': 'قم بمعالجة بعض الصور أولاً',
                
                // Missing Region Properties
                'missing.properties': 'خصائص المنطقة المفقودة',
                'missing.expected_chars': 'عدد الأحرف المتوقعة',
                'missing.chars_help': 'تقدير تقريبي لعدد الأحرف التي كانت في هذه المنطقة',
                'missing.damage_reason': 'سبب الفقدان',
                'missing.reason.damaged': 'تلف',
                'missing.reason.eroded': 'تآكل',
                'missing.reason.illegible': 'غير مقروء',
                'missing.reason.faded': 'باهت',
                'missing.reason.torn': 'ممزق',
                'missing.reason.stained': 'ملطخ',
                'missing.reason.other': 'أخرى',
                'missing.notes': 'ملاحظات إضافية',
                'missing.notes_help': 'أي معلومات إضافية حول هذه المنطقة',
                
                // Review Tab
                'review.filters': 'فلاتر الاستعراض',
                'review.level_filter': 'مستوى التوسيم',
                'review.all_levels': 'جميع المستويات',
                'review.missing': 'مفقود',
                'review.status_filter': 'حالة الصورة',
                'review.status.annotated': 'مرسّمة',
                'review.status.completed': 'مكتملة',
                'review.status.all': 'جميع الحالات',
                'review.apply_filter': 'تطبيق الفلتر',
                'review.navigation': 'التنقل',
                'review.previous': 'السابق',
                'review.next': 'التالي',
                'review.image_info': 'معلومات الصورة',
                'review.select_image': 'اختر صورة للاستعراض',
                'review.title': 'استعراض التوسيمات',
                'review.dimensions': 'الأبعاد',
                'review.status': 'الحالة',
                'review.total_annotations': 'إجمالي التوسيمات',
                'review.distribution': 'توزيع التوسيمات',
                'review.ready': 'جاهز للاستعراض',
                'review.no_images': 'لا توجد صور مرسّمة',
                'review.annotate_first': 'قم بترسيم بعض الصور أولاً لعرضها هنا',
                'review.go_to_annotation': 'الانتقال للترسيم',
                'review.no_match': 'لا توجد صور تطابق الفلاتر المحددة',
                
                // Export Tab
                'export.title': 'تصدير المشروع',
                'export.format': 'تنسيق التصدير',
                'export.format.yolo': 'YOLO',
                'export.format.coco': 'COCO',
                'export.format.csv': 'CSV',
                'export.format.json': 'JSON',
                'export.include_images': 'تضمين الصور',
                'export.train_split': 'نسبة التدريب',
                'export.val_split': 'نسبة التحقق',
                'export.test_split': 'نسبة الاختبار',
                'export.start': 'بدء التصدير',
                'export.not_available': 'التصدير غير متاح',
                'export.annotate_required': 'يجب توسيم صورة واحدة على الأقل قبل التصدير',
                
                // Settings Tab
                'settings.title': 'إعدادات التطبيق',
                'settings.auto_flow': 'إعدادات التدفق التلقائي',
                'settings.auto_flow_mode': 'نمط التدفق التلقائي',
                'settings.auto_flow_help': 'اختر كيفية انتقال التطبيق بين المعالجة والتوسيم تلقائياً',
                'settings.mode.manual': 'يدوي',
                'settings.mode.process_then_next': 'معالجة ثم الصورة التالية',
                'settings.mode.process_then_annotate': 'معالجة ثم التوسيم',
                'settings.mode.process_all_then_annotate': 'معالجة الكل ثم التوسيم',
                'settings.language_settings': 'إعدادات اللغة',
                'settings.interface_language': 'لغة الواجهة',
                'settings.auto_save_settings': 'إعدادات الحفظ التلقائي',
                'settings.enable_auto_save': 'تفعيل الحفظ التلقائي',
                'settings.auto_save_interval': 'فترة الحفظ التلقائي (ثانية)',
                'settings.language': 'اللغة',
                'settings.theme': 'المظهر',
                'settings.theme.light': 'فاتح',
                'settings.theme.dark': 'داكن',
                'settings.auto_save': 'الحفظ التلقائي',
                'settings.auto_save.enabled': 'مفعل',
                'settings.auto_save.disabled': 'معطل',
                'settings.keyboard_shortcuts': 'اختصارات لوحة المفاتيح',
                'settings.save': 'حفظ الإعدادات',
                
                // Common UI Elements
                'ui.loading': 'جاري التحميل...',
                'ui.processing': 'جاري المعالجة...',
                'ui.saving': 'جاري الحفظ...',
                'ui.success': 'تم بنجاح',
                'ui.error': 'خطأ',
                'ui.warning': 'تحذير',
                'ui.info': 'معلومات',
                'ui.confirm': 'تأكيد',
                'ui.cancel': 'إلغاء',
                'ui.save': 'حفظ',
                'ui.delete': 'حذف',
                'ui.edit': 'تحرير',
                'ui.close': 'إغلاق',
                'ui.back': 'رجوع',
                'ui.next': 'التالي',
                'ui.previous': 'السابق',
                'ui.select_all': 'تحديد الكل',
                'ui.clear_all': 'مسح الكل',
                
                // Status Messages
                'status.uploaded': 'تم رفع الصور بنجاح',
                'status.processed': 'تم معالجة الصور بنجاح',
                'status.saved': 'تم حفظ التوسيمات بنجاح',
                'status.exported': 'تم تصدير المشروع بنجاح',
                'status.error_upload': 'خطأ في رفع الصور',
                'status.error_process': 'خطأ في معالجة الصور',
                'status.error_save': 'خطأ في حفظ التوسيمات',
                'status.error_export': 'خطأ في تصدير المشروع',
                'status.error_load': 'خطأ في تحميل البيانات',
                
                // Keyboard Shortcuts
                'shortcuts.zoom_in': 'تكبير (+)',
                'shortcuts.zoom_out': 'تصغير (-)',
                'shortcuts.fit_screen': 'ملائمة الشاشة (F)',
                'shortcuts.rotate_right': 'دوران يمين (R)',
                'shortcuts.rotate_left': 'دوران يسار (Shift+R)',
                'shortcuts.select_mode': 'وضع التحديد (S)',
                'shortcuts.draw_mode': 'وضع الرسم (D)',
                'shortcuts.delete': 'حذف (Delete)',
                'shortcuts.save': 'حفظ (Ctrl+S)',
            },
            en: {
                // Header
                'app.title': 'Musnad OCR Data Preparation Tool',
                'app.welcome': 'Welcome to Musnad OCR Data Preparation Tool',
                'app.description': 'Comprehensive tool for processing and annotating ancient Musnad text images',
                
                // Navigation Tabs
                'tab.processing': 'Image Processing',
                'tab.annotation': 'Annotation & Editing',
                'tab.review': 'Review Annotations',
                'tab.export': 'Export',
                'tab.settings': 'Settings',
                
                // Project Management
                'project.new': 'New Project',
                'project.create': 'Create Project',
                'project.cancel': 'Cancel',
                'project.name': 'Project Name',
                'project.description': 'Project Description',
                'project.type': 'Project Type',
                'project.type.manuscript': 'Manuscript',
                'project.type.document': 'Document',
                'project.type.book': 'Book',
                'project.available': 'Available Projects',
                'project.no_projects': 'No Projects',
                'project.create_first': 'Create your first project',
                
                // Processing Tab
                'processing.title': 'Processing Controls',
                'processing.available_images': 'Available Images for Processing',
                'processing.upload_images': 'Upload Images',
                'processing.select_images': 'Select Images',
                'processing.upload': 'Upload',
                'processing.process_selected': 'Process Selected',
                'processing.process_all': 'Process All',
                'processing.auto_flow': 'Auto Flow',
                'processing.no_images': 'No Images to Process',
                'processing.all_completed': 'All Images Processed',
                'processing.switch_to_annotation': 'You can switch to the annotation tab to start annotation',
                'processing.upload_first': 'Upload some images to get started',
                
                // Processing Settings
                'processing.settings': 'Processing Settings',
                'processing.grayscale': 'Convert to Grayscale',
                'processing.clahe': 'Contrast Enhancement (CLAHE)',
                'processing.threshold': 'Threshold',
                'processing.deskew': 'Deskew',
                'processing.morphology': 'Morphological Operations',
                'processing.denoise': 'Denoise',
                'processing.sharpen': 'Sharpen',
                'processing.quality': 'Save Quality',
                
                // Annotation Tab
                'annotation.canvas_mode': 'Canvas Mode',
                'annotation.select_mode': 'Select Mode',
                'annotation.draw_mode': 'Draw Mode',
                'annotation.delete_annotation': 'Delete Annotation',
                'annotation.save_annotations': 'Save Annotations',
                'annotation.auto_save': 'Auto Save',
                'annotation.zoom_controls': 'Zoom Controls',
                'annotation.zoom_in': 'Zoom In',
                'annotation.zoom_out': 'Zoom Out',
                'annotation.fit_screen': 'Fit to Screen',
                'annotation.reset_zoom': 'Reset Zoom',
                'annotation.rotation_controls': 'Rotation Controls',
                'annotation.rotate_left': 'Rotate Counter-clockwise',
                'annotation.rotate_right': 'Rotate Clockwise',
                'annotation.reset_rotation': 'Reset Rotation',
                'annotation.reset_all': 'Reset All',
                'annotation.type': 'Annotation Type',
                'annotation.type.text': 'Text',
                'annotation.type.missing_region': 'Missing Region',
                'annotation.level': 'Annotation Level',
                'annotation.level.character': 'Character',
                'annotation.level.word': 'Word',
                'annotation.level.line': 'Line',
                'annotation.level.paragraph': 'Paragraph',
                'annotation.text_direction': 'Text Direction',
                'annotation.text_direction.rtl': 'Right to Left',
                'annotation.text_direction.ltr': 'Left to Right',
                'annotation.label': 'Label',
                'annotation.confidence': 'Confidence Level',
                'annotation.no_images': 'No Images for Annotation',
                'annotation.process_first': 'Process some images first',
                
                // Missing Region Properties
                'missing.properties': 'Missing Region Properties',
                'missing.expected_chars': 'Expected Character Count',
                'missing.chars_help': 'Approximate estimate of characters that were in this region',
                'missing.damage_reason': 'Damage Reason',
                'missing.reason.damaged': 'Damaged',
                'missing.reason.eroded': 'Eroded',
                'missing.reason.illegible': 'Illegible',
                'missing.reason.faded': 'Faded',
                'missing.reason.torn': 'Torn',
                'missing.reason.stained': 'Stained',
                'missing.reason.other': 'Other',
                'missing.notes': 'Additional Notes',
                'missing.notes_help': 'Any additional information about this region',
                
                // Review Tab
                'review.filters': 'Review Filters',
                'review.level_filter': 'Annotation Level',
                'review.all_levels': 'All Levels',
                'review.missing': 'Missing',
                'review.status_filter': 'Image Status',
                'review.status.annotated': 'Annotated',
                'review.status.completed': 'Completed',
                'review.status.all': 'All Statuses',
                'review.apply_filter': 'Apply Filter',
                'review.navigation': 'Navigation',
                'review.previous': 'Previous',
                'review.next': 'Next',
                'review.image_info': 'Image Information',
                'review.select_image': 'Select an image to review',
                'review.title': 'Review Annotations',
                'review.dimensions': 'Dimensions',
                'review.status': 'Status',
                'review.total_annotations': 'Total Annotations',
                'review.distribution': 'Annotation Distribution',
                'review.ready': 'Ready for Review',
                'review.no_images': 'No Annotated Images',
                'review.annotate_first': 'Annotate some images first to display them here',
                'review.go_to_annotation': 'Go to Annotation',
                'review.no_match': 'No images match the selected filters',
                
                // Export Tab
                'export.title': 'Export Project',
                'export.format': 'Export Format',
                'export.format.yolo': 'YOLO',
                'export.format.coco': 'COCO',
                'export.format.csv': 'CSV',
                'export.format.json': 'JSON',
                'export.include_images': 'Include Images',
                'export.train_split': 'Training Split',
                'export.val_split': 'Validation Split',
                'export.test_split': 'Test Split',
                'export.start': 'Start Export',
                'export.not_available': 'Export Not Available',
                'export.annotate_required': 'At least one image must be annotated before export',
                
                // Settings Tab
                'settings.title': 'Application Settings',
                'settings.auto_flow': 'Auto-Flow Settings',
                'settings.auto_flow_mode': 'Auto-Flow Mode',
                'settings.auto_flow_help': 'Choose how the application automatically transitions between processing and annotation',
                'settings.mode.manual': 'Manual',
                'settings.mode.process_then_next': 'Process Then Next Image',
                'settings.mode.process_then_annotate': 'Process Then Annotate',
                'settings.mode.process_all_then_annotate': 'Process All Then Annotate',
                'settings.language_settings': 'Language Settings',
                'settings.interface_language': 'Interface Language',
                'settings.auto_save_settings': 'Auto-Save Settings',
                'settings.enable_auto_save': 'Enable Auto Save',
                'settings.auto_save_interval': 'Auto Save Interval (seconds)',
                'settings.language': 'Language',
                'settings.theme': 'Theme',
                'settings.theme.light': 'Light',
                'settings.theme.dark': 'Dark',
                'settings.auto_save': 'Auto Save',
                'settings.auto_save.enabled': 'Enabled',
                'settings.auto_save.disabled': 'Disabled',
                'settings.keyboard_shortcuts': 'Keyboard Shortcuts',
                'settings.save': 'Save Settings',
                
                // Common UI Elements
                'ui.loading': 'Loading...',
                'ui.processing': 'Processing...',
                'ui.saving': 'Saving...',
                'ui.success': 'Success',
                'ui.error': 'Error',
                'ui.warning': 'Warning',
                'ui.info': 'Information',
                'ui.confirm': 'Confirm',
                'ui.cancel': 'Cancel',
                'ui.save': 'Save',
                'ui.delete': 'Delete',
                'ui.edit': 'Edit',
                'ui.close': 'Close',
                'ui.back': 'Back',
                'ui.next': 'Next',
                'ui.previous': 'Previous',
                'ui.select_all': 'Select All',
                'ui.clear_all': 'Clear All',
                
                // Status Messages
                'status.uploaded': 'Images uploaded successfully',
                'status.processed': 'Images processed successfully',
                'status.saved': 'Annotations saved successfully',
                'status.exported': 'Project exported successfully',
                'status.error_upload': 'Error uploading images',
                'status.error_process': 'Error processing images',
                'status.error_save': 'Error saving annotations',
                'status.error_export': 'Error exporting project',
                'status.error_load': 'Error loading data',
                
                // Keyboard Shortcuts
                'shortcuts.zoom_in': 'Zoom In (+)',
                'shortcuts.zoom_out': 'Zoom Out (-)',
                'shortcuts.fit_screen': 'Fit to Screen (F)',
                'shortcuts.rotate_right': 'Rotate Right (R)',
                'shortcuts.rotate_left': 'Rotate Left (Shift+R)',
                'shortcuts.select_mode': 'Select Mode (S)',
                'shortcuts.draw_mode': 'Draw Mode (D)',
                'shortcuts.delete': 'Delete (Delete)',
                'shortcuts.save': 'Save (Ctrl+S)',
            }
        };
        
        this.init();
    }
    
    init() {
        this.updateDirection();
        this.translatePage();
    }
    
    // Get translation for a key
    t(key, params = {}) {
        const translation = this.translations[this.currentLanguage][key] || key;
        
        // Replace parameters in translation
        let result = translation;
        Object.keys(params).forEach(param => {
            result = result.replace(`{${param}}`, params[param]);
        });
        
        return result;
    }
    
    // Set language
    setLanguage(language) {
        if (this.translations[language]) {
            this.currentLanguage = language;
            localStorage.setItem('musnad_language', language);
            this.updateDirection();
            this.translatePage();
            
            // Trigger language change event
            document.dispatchEvent(new CustomEvent('languageChanged', {
                detail: { language: language }
            }));
        }
    }
    
    // Get current language
    getCurrentLanguage() {
        return this.currentLanguage;
    }
    
    // Update page direction based on language
    updateDirection() {
        const html = document.documentElement;
        if (this.currentLanguage === 'ar') {
            html.setAttribute('dir', 'rtl');
            html.setAttribute('lang', 'ar');
        } else {
            html.setAttribute('dir', 'ltr');
            html.setAttribute('lang', 'en');
        }
    }
    
    // Translate all elements with data-i18n attribute
    translatePage() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            // Handle different element types
            if (element.tagName === 'INPUT' && (element.type === 'button' || element.type === 'submit')) {
                element.value = translation;
            } else if (element.tagName === 'INPUT' && element.type === 'text') {
                element.placeholder = translation;
            } else if (element.hasAttribute('title')) {
                element.title = translation;
            } else {
                element.textContent = translation;
            }
        });
        
        // Update page title
        const titleElement = document.querySelector('title');
        if (titleElement) {
            titleElement.textContent = this.t('app.title');
        }
    }
    
    // Add translation to an element
    addTranslation(element, key) {
        element.setAttribute('data-i18n', key);
        const translation = this.t(key);
        
        if (element.tagName === 'INPUT' && (element.type === 'button' || element.type === 'submit')) {
            element.value = translation;
        } else if (element.tagName === 'INPUT' && element.type === 'text') {
            element.placeholder = translation;
        } else {
            element.textContent = translation;
        }
    }
    
    // Get available languages
    getAvailableLanguages() {
        return [
            { code: 'ar', name: 'العربية', nativeName: 'العربية' },
            { code: 'en', name: 'English', nativeName: 'English' }
        ];
    }
    
    // Check if current language is RTL
    isRTL() {
        return this.currentLanguage === 'ar';
    }
}

// Create global i18n instance
window.i18n = new I18n();
