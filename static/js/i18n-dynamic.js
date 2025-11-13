// Dynamic content translation handler
class I18nDynamic {
    constructor() {
        this.init();
    }
    
    init() {
        // Listen for language change events
        document.addEventListener('languageChanged', (e) => {
            this.updateDynamicContent(e.detail.language);
        });
    }
    
    updateDynamicContent(language) {
        // Update notification messages
        this.updateNotificationMessages();
        
        // Update canvas info
        this.updateCanvasInfo();
        
        // Update project cards
        this.updateProjectCards();
        
        // Update image lists
        this.updateImageLists();
        
        // Update modal content
        this.updateModalContent();
        
        // Update tooltips and titles
        this.updateTooltips();
    }
    
    updateNotificationMessages() {
        // Update any visible notification messages
        const toastMessage = document.getElementById('toastMessage');
        if (toastMessage && toastMessage.textContent) {
            // This would need to be handled by the app when showing notifications
            // We can't retroactively translate already shown messages
        }
    }
    
    updateCanvasInfo() {
        // Update canvas information displays
        const canvasInfo = document.getElementById('canvasInfo');
        if (canvasInfo && window.app && window.app.canvasHandler && window.app.canvasHandler.currentImage) {
            window.app.canvasHandler.updateCanvasInfo();
        }
        
        const reviewCanvasInfo = document.getElementById('reviewCanvasInfo');
        if (reviewCanvasInfo && window.app && window.app.reviewHandler && window.app.reviewHandler.currentImage) {
            window.app.reviewHandler.updateCanvasInfo();
        }
    }
    
    updateProjectCards() {
        // Update project cards if they contain translatable content
        const projectCards = document.querySelectorAll('.project-card');
        projectCards.forEach(card => {
            // Update any status badges or action buttons
            const statusBadges = card.querySelectorAll('.badge');
            statusBadges.forEach(badge => {
                const status = badge.getAttribute('data-status');
                if (status) {
                    badge.textContent = this.getStatusText(status);
                }
            });
        });
    }
    
    updateImageLists() {
        // Update image list status indicators
        const imageItems = document.querySelectorAll('.image-item');
        imageItems.forEach(item => {
            const statusElement = item.querySelector('.image-status');
            if (statusElement) {
                const status = statusElement.getAttribute('data-status');
                if (status) {
                    statusElement.textContent = this.getStatusText(status);
                }
            }
        });
    }
    
    updateModalContent() {
        // Update modal titles and content
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            // Update modal titles
            const title = modal.querySelector('.modal-title');
            if (title && title.hasAttribute('data-i18n')) {
                const key = title.getAttribute('data-i18n');
                title.textContent = window.i18n.t(key);
            }
            
            // Update button texts
            const buttons = modal.querySelectorAll('button[data-i18n]');
            buttons.forEach(button => {
                const key = button.getAttribute('data-i18n');
                button.textContent = window.i18n.t(key);
            });
        });
    }
    
    updateTooltips() {
        // Update tooltip texts
        const elementsWithTooltips = document.querySelectorAll('[title][data-i18n-title]');
        elementsWithTooltips.forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            element.title = window.i18n.t(key);
        });
        
        // Update Bootstrap tooltips if they exist
        if (window.bootstrap && window.bootstrap.Tooltip) {
            const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
            tooltips.forEach(element => {
                const tooltip = window.bootstrap.Tooltip.getInstance(element);
                if (tooltip) {
                    tooltip.dispose();
                    new window.bootstrap.Tooltip(element);
                }
            });
        }
    }
    
    getStatusText(status) {
        const statusMap = {
            'uploaded': window.i18n.t('status.uploaded'),
            'processed': window.i18n.t('status.processed'),
            'annotated': window.i18n.t('status.annotated'),
            'completed': window.i18n.t('status.completed'),
            'error': window.i18n.t('ui.error')
        };
        
        return statusMap[status] || status;
    }
    
    // Helper method to translate dynamic text
    translateText(key, params = {}) {
        return window.i18n ? window.i18n.t(key, params) : key;
    }
    
    // Helper method to update element with translation
    updateElement(element, key, params = {}) {
        if (element && window.i18n) {
            element.textContent = window.i18n.t(key, params);
        }
    }
    
    // Helper method to update input placeholder
    updatePlaceholder(input, key, params = {}) {
        if (input && window.i18n) {
            input.placeholder = window.i18n.t(key, params);
        }
    }
    
    // Method to create translatable elements
    createElement(tag, i18nKey, className = '', attributes = {}) {
        const element = document.createElement(tag);
        if (className) {
            element.className = className;
        }
        
        Object.keys(attributes).forEach(attr => {
            element.setAttribute(attr, attributes[attr]);
        });
        
        if (i18nKey) {
            element.setAttribute('data-i18n', i18nKey);
            element.textContent = window.i18n ? window.i18n.t(i18nKey) : i18nKey;
        }
        
        return element;
    }
    
    // Method to create translatable buttons
    createButton(i18nKey, className = 'btn btn-primary', onclick = null) {
        const button = this.createElement('button', i18nKey, className, {
            type: 'button'
        });
        
        if (onclick) {
            button.addEventListener('click', onclick);
        }
        
        return button;
    }
    
    // Method to create translatable options for select elements
    createOption(value, i18nKey, selected = false) {
        const option = this.createElement('option', i18nKey, '', { value });
        if (selected) {
            option.selected = true;
        }
        return option;
    }
    
    // Method to populate select with translatable options
    populateSelect(selectElement, options) {
        selectElement.innerHTML = '';
        options.forEach(opt => {
            const option = this.createOption(opt.value, opt.i18nKey, opt.selected);
            selectElement.appendChild(option);
        });
    }
}

// Create global instance
window.i18nDynamic = new I18nDynamic();
