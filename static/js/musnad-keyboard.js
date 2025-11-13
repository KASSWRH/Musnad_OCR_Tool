// Musnad Virtual Keyboard Component
class MusnadKeyboard {
    constructor(containerId, app) {
        this.app = app;
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.characters = [];
        this.favorites = JSON.parse(localStorage.getItem('musnad_favorites') || '[]');
        this.currentCategory = 'all';
        this.searchTerm = '';
        
        if (!this.container) {
            console.error('Musnad keyboard container not found');
            return;
        }
        
        this.init();
    }
    
    async init() {
        await this.loadMusnadCharacters();
        this.createKeyboard();
        this.bindEvents();
    }
    
    async loadMusnadCharacters() {
        try {
            const response = await fetch('/api/musnad/characters');
            if (response.ok) {
                const data = await response.json();
                this.characters = data.characters;
            } else {
                console.warn('Failed to load Musnad characters from API, using fallback');
                this.generateFallbackCharacters();
            }
        } catch (error) {
            console.error('Error loading Musnad characters:', error);
            this.generateFallbackCharacters();
        }
        
        this.renderCharacters();
    }
    
    generateFallbackCharacters() {
        // Fallback: Generate basic Musnad characters
        this.characters = [];
        for (let codePoint = 0x10A60; codePoint <= 0x10A7F; codePoint++) {
            const char = String.fromCodePoint(codePoint);
            this.characters.push({
                character: char,
                unicode: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`,
                code_point: codePoint,
                category: codePoint <= 0x10A7D ? 'letter' : 'symbol'
            });
        }
        
        // Add some common Arabic characters that might be found in Musnad texts
        const arabicChars = [
            { code: 0x0627, name: 'alif' },
            { code: 0x0628, name: 'beh' },
            { code: 0x062A, name: 'teh' },
            { code: 0x062B, name: 'theh' },
            { code: 0x062C, name: 'jeem' },
            { code: 0x062D, name: 'hah' },
            { code: 0x062E, name: 'khah' },
            { code: 0x062F, name: 'dal' },
            { code: 0x0630, name: 'thal' },
            { code: 0x0631, name: 'reh' },
            { code: 0x0632, name: 'zain' },
            { code: 0x0633, name: 'seen' },
            { code: 0x0634, name: 'sheen' },
            { code: 0x0635, name: 'sad' },
            { code: 0x0636, name: 'dad' },
            { code: 0x0637, name: 'tah' },
            { code: 0x0638, name: 'zah' },
            { code: 0x0639, name: 'ain' },
            { code: 0x063A, name: 'ghain' },
            { code: 0x0641, name: 'feh' },
            { code: 0x0642, name: 'qaf' },
            { code: 0x0643, name: 'kaf' },
            { code: 0x0644, name: 'lam' },
            { code: 0x0645, name: 'meem' },
            { code: 0x0646, name: 'noon' },
            { code: 0x0647, name: 'heh' },
            { code: 0x0648, name: 'waw' },
            { code: 0x064A, name: 'yeh' }
        ];
        
        arabicChars.forEach(({ code, name }) => {
            this.characters.push({
                character: String.fromCodePoint(code),
                unicode: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
                code_point: code,
                category: 'arabic',
                name: name
            });
        });
    }
    
    createKeyboard() {
        this.container.innerHTML = `
            <div class="musnad-keyboard-header mb-3">
                <div class="row g-2 mb-2">
                    <div class="col">
                        <div class="btn-group btn-group-sm w-100" role="group">
                            <button class="btn btn-outline-primary category-btn active" data-category="all">
                                الكل
                            </button>
                            <button class="btn btn-outline-primary category-btn" data-category="letter">
                                مسند    
                            </button>
                            <button class="btn btn-outline-primary category-btn" data-category="arabic">
                                عربي
                            </button>
                            <button class="btn btn-outline-primary category-btn" data-category="symbol">
                                رموز
                            </button>
                            <button class="btn btn-outline-warning category-btn" data-category="favorites">
                                <i class="fas fa-star"></i>
                            </button>
                        </div>
                    </div>
                    <div class="col-auto">
                        <button id="clearInputBtn" class="btn btn-sm btn-outline-danger" title="مسح النص">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
                
                <div class="input-group input-group-sm">
                    <input type="text" id="characterSearch" class="form-control" 
                           placeholder="بحث في الحروف..." dir="rtl">
                    <span class="input-group-text">
                        <i class="fas fa-search"></i>
                    </span>
                </div>
            </div>
            
            <div id="charactersGrid" class="characters-grid">
                <!-- Characters will be rendered here -->
            </div>
            
            <div class="keyboard-help mt-2">
                <small class="text-muted">
                    <i class="fas fa-info-circle me-1"></i>
                    انقر على الحرف لإدراجه، أو اضغط Ctrl+U لإدخال كود Unicode
                </small>
            </div>
        `;
    }
    
    bindEvents() {
        // Category buttons
        this.container.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const category = e.target.dataset.category;
                this.setCategory(category);
            });
        });
        
        // Search input
        const searchInput = document.getElementById('characterSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.renderCharacters();
            });
            
            // Clear search on Escape
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    searchInput.value = '';
                    this.searchTerm = '';
                    this.renderCharacters();
                }
            });
        }
        
        // Clear input button
        const clearBtn = document.getElementById('clearInputBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearLabelInput();
            });
        }
        
        // Unicode input hotkey
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'u' && e.target.id === 'labelInput') {
                e.preventDefault();
                this.showUnicodeInput();
            }
        });
    }
    
    setCategory(category) {
        this.currentCategory = category;
        
        // Update category button states
        this.container.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === category);
        });
        
        this.renderCharacters();
    }
    
    renderCharacters() {
        const grid = document.getElementById('charactersGrid');
        if (!grid) return;
        
        let filteredCharacters = this.characters;
        
        // Filter by category
        if (this.currentCategory !== 'all') {
            if (this.currentCategory === 'favorites') {
                filteredCharacters = this.characters.filter(char => 
                    this.favorites.includes(char.unicode)
                );
            } else {
                filteredCharacters = this.characters.filter(char => 
                    char.category === this.currentCategory
                );
            }
        }
        
        // Filter by search term
        if (this.searchTerm) {
            filteredCharacters = filteredCharacters.filter(char => 
                char.unicode.toLowerCase().includes(this.searchTerm) ||
                char.category.toLowerCase().includes(this.searchTerm) ||
                (char.name && char.name.toLowerCase().includes(this.searchTerm))
            );
        }
        
        // Render character grid
        if (filteredCharacters.length === 0) {
            grid.innerHTML = `
                <div class="text-center py-4 text-muted">
                    <i class="fas fa-search fa-2x mb-2"></i>
                    <p>${this.searchTerm ? 'لا توجد نتائج للبحث' : 'لا توجد حروف في هذه الفئة'}</p>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = `
            <div class="row g-1">
                ${filteredCharacters.map(char => this.renderCharacterButton(char)).join('')}
            </div>
        `;
        
        // Bind character click events
        grid.querySelectorAll('.musnad-char').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const char = btn.dataset.char;
                const unicode = btn.dataset.unicode;
                
                if (e.target.classList.contains('favorite-btn') || e.target.closest('.favorite-btn')) {
                    this.toggleFavorite(unicode);
                } else {
                    this.insertCharacter(char);
                }
            });
        });
    }
    
    renderCharacterButton(char) {
        const isFavorite = this.favorites.includes(char.unicode);
        
        return `
            <div class="col-auto">
                <div class="musnad-char position-relative" 
                     data-char="${char.character}" 
                     data-unicode="${char.unicode}"
                     title="${char.unicode}${char.name ? ` - ${char.name}` : ''}">
                    
                    <div class="char-display">
                        <span style="font-family: 'Noto Sans Old South Arabian', 'Arial Unicode MS', monospace; font-size: 1.2rem;">
                            ${char.character}
                        </span>
                    </div>
                    
                    <button class="favorite-btn position-absolute top-0 end-0 btn btn-sm ${isFavorite ? 'text-warning' : 'text-muted'}" 
                            data-unicode="${char.unicode}"
                            title="${isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}">
                        <i class="fas fa-star" style="font-size: 0.7rem;"></i>
                    </button>
                    

                </div>
            </div>
        `;
    }
    
    insertCharacter(character) {
        const labelInput = document.getElementById('labelInput');
        if (!labelInput) return;
        
        // Get current cursor position
        const startPos = labelInput.selectionStart;
        const endPos = labelInput.selectionEnd;
        const currentValue = labelInput.value;
        
        // Insert character at cursor position
        const newValue = currentValue.substring(0, startPos) + 
                        character + 
                        currentValue.substring(endPos);
        
        labelInput.value = newValue;
        
        // Set cursor position after inserted character
        const newCursorPos = startPos + character.length;
        labelInput.setSelectionRange(newCursorPos, newCursorPos);
        
        labelInput.focus();
        
        // Trigger input event for auto-save
        labelInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Update selected annotation if any
        if (this.app.canvasHandler) {
            this.app.canvasHandler.updateSelectedAnnotationLabel(newValue);
        }
    }
    
    clearLabelInput() {
        const labelInput = document.getElementById('labelInput');
        if (labelInput) {
            labelInput.value = '';
            labelInput.focus();
            
            // Trigger input event
            labelInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Clear selected annotation label
            if (this.app.canvasHandler) {
                this.app.canvasHandler.updateSelectedAnnotationLabel('');
            }
        }
    }
    
    toggleFavorite(unicode) {
        const index = this.favorites.indexOf(unicode);
        if (index > -1) {
            this.favorites.splice(index, 1);
        } else {
            this.favorites.push(unicode);
        }
        
        // Save to localStorage
        localStorage.setItem('musnad_favorites', JSON.stringify(this.favorites));
        
        // Re-render if viewing favorites or update star icon
        if (this.currentCategory === 'favorites') {
            this.renderCharacters();
        } else {
            // Update star icon
            const starBtn = document.querySelector(`[data-unicode="${unicode}"] .favorite-btn`);
            if (starBtn) {
                const isFavorite = this.favorites.includes(unicode);
                starBtn.className = `favorite-btn position-absolute top-0 end-0 btn btn-sm ${isFavorite ? 'text-warning' : 'text-muted'}`;
                starBtn.title = isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة';
            }
        }
        
        // Show feedback
        const char = this.characters.find(c => c.unicode === unicode);
        const action = this.favorites.includes(unicode) ? 'أضيف إلى' : 'أزيل من';
        this.app.showNotification(`${char?.character || unicode} ${action} المفضلة`, 'info');
    }
    
    showUnicodeInput() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = 'unicodeModal';
        modal.innerHTML = `
            <div class="modal-dialog modal-sm">
                <div class="modal-content">
                    <div class="modal-header">
                        <h6 class="modal-title">إدخال رمز Unicode</h6>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">كود Unicode (مثال: 10A60)</label>
                            <div class="input-group">
                                <span class="input-group-text">U+</span>
                                <input type="text" id="unicodeInput" class="form-control" 
                                       placeholder="10A60" maxlength="6">
                            </div>
                        </div>
                        <div class="text-center">
                            <div id="unicodePreview" class="border rounded p-3 mb-3" 
                                 style="font-size: 2rem; min-height: 60px; display: flex; align-items: center; justify-content: center;">
                                <span class="text-muted">معاينة الحرف</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                        <button type="button" id="insertUnicodeBtn" class="btn btn-primary">إدراج</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
        
        const unicodeInput = document.getElementById('unicodeInput');
        const unicodePreview = document.getElementById('unicodePreview');
        const insertBtn = document.getElementById('insertUnicodeBtn');
        
        // Update preview on input
        unicodeInput.addEventListener('input', (e) => {
            const code = e.target.value.trim();
            if (code && /^[0-9A-Fa-f]{1,6}$/.test(code)) {
                try {
                    const codePoint = parseInt(code, 16);
                    const character = String.fromCodePoint(codePoint);
                    unicodePreview.innerHTML = `<span style="font-family: 'Noto Sans Old South Arabian', 'Arial Unicode MS', monospace;">${character}</span>`;
                    insertBtn.disabled = false;
                } catch (error) {
                    unicodePreview.innerHTML = '<span class="text-danger">رمز غير صحيح</span>';
                    insertBtn.disabled = true;
                }
            } else {
                unicodePreview.innerHTML = '<span class="text-muted">معاينة الحرف</span>';
                insertBtn.disabled = true;
            }
        });
        
        // Insert character
        insertBtn.addEventListener('click', () => {
            const code = unicodeInput.value.trim();
            if (code) {
                try {
                    const codePoint = parseInt(code, 16);
                    const character = String.fromCodePoint(codePoint);
                    this.insertCharacter(character);
                    bootstrapModal.hide();
                } catch (error) {
                    console.error('Error inserting Unicode character:', error);
                }
            }
        });
        
        // Handle Enter key
        unicodeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !insertBtn.disabled) {
                insertBtn.click();
            }
        });
        
        // Clean up modal on hide
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
        
        // Focus input
        setTimeout(() => unicodeInput.focus(), 500);
    }
    
    // Keyboard shortcuts
    bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when label input is focused
            if (document.activeElement?.id !== 'labelInput') return;
            
            switch (e.key) {
                case 'F1':
                    e.preventDefault();
                    this.setCategory('all');
                    break;
                case 'F2':
                    e.preventDefault();
                    this.setCategory('letter');
                    break;
                case 'F3':
                    e.preventDefault();
                    this.setCategory('arabic');
                    break;
                case 'F4':
                    e.preventDefault();
                    this.setCategory('favorites');
                    break;
            }
        });
    }
    
    // Export favorites
    exportFavorites() {
        const favoriteChars = this.characters.filter(char => 
            this.favorites.includes(char.unicode)
        );
        
        const data = {
            exported_at: new Date().toISOString(),
            favorites: favoriteChars
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'musnad-favorites.json';
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    // Import favorites
    importFavorites(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.favorites && Array.isArray(data.favorites)) {
                    this.favorites = data.favorites.map(char => char.unicode);
                    localStorage.setItem('musnad_favorites', JSON.stringify(this.favorites));
                    this.renderCharacters();
                    this.app.showNotification('تم استيراد المفضلة بنجاح', 'success');
                } else {
                    throw new Error('Invalid file format');
                }
            } catch (error) {
                this.app.showNotification('خطأ في استيراد المفضلة', 'error');
            }
        };
        reader.readAsText(file);
    }
}
