/**
 * LOGOS-3 CASE AUTHORING TERMINAL - TAB 4: CATEGORIES & CUSTOM TAGS
 */
(function (global) {
    'use strict';

    const CaseEditorCategories = {
        renderCategoriesTab(container) {
            const defaultCats = window.CaseEditorConstants?.DEFAULT_CATEGORIES || {};
            const categories = this.caseData.categories || defaultCats;
            const keys = Object.keys(categories);

            let cardsHtml = "";
            keys.forEach(k => {
                const cat = categories[k];
                const hex = cat.hex || "#94a3b8";
                const icon = cat.icon || "🏷️";
                const label = cat.label || k;

                cardsHtml += `
                    <div class="category-card" data-cat-key="${k}" style="border-left-color: ${hex};">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span class="cat-card-icon" style="font-size: 16px;">${icon}</span>
                                <strong class="cat-card-key" style="color: var(--accent);">${k}</strong>
                            </div>
                            <button class="btn btn-sm btn-danger" onclick="window.caseEditor.deleteCategory('${k}')">🗑️</button>
                        </div>
                        <div class="form-row-horizontal">
                            <div class="form-row">
                                <label class="form-label">Display Label</label>
                                <input type="text" class="cat-label-input" value="${label}" oninput="window.caseEditor.updateCategoryField('${k}', 'label', this.value)">
                            </div>
                            <div class="form-row">
                                <label class="form-label">Icon (Emoji)</label>
                                <input type="text" class="cat-icon-input" value="${icon}" style="width: 60px;" oninput="window.caseEditor.updateCategoryField('${k}', 'icon', this.value)">
                            </div>
                        </div>
                        <div class="form-row">
                            <label class="form-label">Theme Color (Hex)</label>
                            <div class="color-input-wrapper">
                                <input type="color" class="color-picker-native" value="${hex}" oninput="window.caseEditor.updateCategoryField('${k}', 'hex', this.value)">
                                <input type="text" class="color-text-input" value="${hex}" style="flex: 1;" oninput="window.caseEditor.updateCategoryField('${k}', 'hex', this.value)">
                            </div>
                        </div>
                        <div class="form-row" style="margin-top: 4px;">
                            <label class="form-label">Live Preview Badge</label>
                            <span class="category-preview-badge" style="background: ${hex}25; border: 1px solid ${hex}; color: ${hex};">
                                <span class="badge-icon">${icon}</span>
                                <span class="badge-label">${label}</span>
                            </span>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = `
                <div class="form-section">
                    <div class="form-section-title">
                        <span>🏷️ Case Categories & Semantic Tags (${keys.length})</span>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-sm btn-primary" onclick="window.caseEditor.addNewCategory()">+ Add Custom Category</button>
                            <button class="btn btn-sm" onclick="window.caseEditor.resetDefaultCategories()">🔄 Reset Defaults</button>
                        </div>
                    </div>
                    <div class="form-help">
                        Categories define the semantic classification and color highlights for keywords, slot restrictions, and player tray filters.
                    </div>
                    <div class="category-grid">
                        ${cardsHtml}
                    </div>
                </div>
            `;
        },

        addNewCategory() {
            const rawId = prompt("Enter new category ID / tag (e.g. 'weapon', 'vehicle', 'organization', 'motive'):");
            if (!rawId) return;
            const key = rawId.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
            if (this.caseData.categories && this.caseData.categories[key]) {
                alert("Category already exists!");
                return;
            }
            const label = prompt("Enter display label:", rawId.charAt(0).toUpperCase() + rawId.slice(1)) || key;
            const icon = prompt("Enter emoji icon (e.g. 🗡️, 🚗, 🏢, 🧪):", "🏷️") || "🏷️";
            const hex = prompt("Enter hex color code (e.g. #ef4444, #06b6d4, #ec4899):", "#38bdf8") || "#38bdf8";

            if (!this.caseData.categories) this.caseData.categories = {};
            this.caseData.categories[key] = {
                hex: hex,
                icon: icon,
                label: label
            };
            this.renderCategoriesTab(document.getElementById("tab-workspace"));
            this.updateBadgeCounts();
            this.renderPreview();
            this.showToast(`Added custom category: ${icon} ${label}`);
        },

        deleteCategory(key) {
            const usingKws = Object.entries(this.caseData.keywords || {}).filter(([k, kw]) => {
                const cats = Array.isArray(kw.category) ? kw.category : (kw.category ? [kw.category] : []);
                return cats.includes(key);
            }).map(([k]) => k);

            let msg = `Delete category "${key}"?`;
            if (usingKws.length > 0) {
                msg += `\nWarning: ${usingKws.length} keyword(s) currently use this category (${usingKws.slice(0, 5).join(', ')}...).`;
            }

            if (confirm(msg)) {
                delete this.caseData.categories[key];
                const remainingCatKeys = Object.keys(this.caseData.categories || {});
                const fallbackCat = remainingCatKeys[0] || "";

                // Strip deleted category from all keyword category lists
                Object.values(this.caseData.keywords || {}).forEach(kw => {
                    let cats = Array.isArray(kw.category) ? kw.category : (kw.category ? [kw.category] : []);
                    cats = cats.filter(c => c !== key);
                    if (cats.length === 0 && fallbackCat) {
                        cats = [fallbackCat];
                    }
                    kw.category = cats;
                });

                this.renderCategoriesTab(document.getElementById("tab-workspace"));
                this.updateBadgeCounts();
                this.renderPreview();
                this.showToast(`Deleted category: ${key}`);
            }
        },

        sanitizeKeywordCategories() {
            const validCats = Object.keys(this.caseData.categories || {});
            if (validCats.length === 0) return;
            const fallbackCat = validCats[0];
            Object.values(this.caseData.keywords || {}).forEach(kw => {
                let cats = Array.isArray(kw.category) ? kw.category : (kw.category ? [kw.category] : []);
                cats = cats.filter(c => validCats.includes(c));
                if (cats.length === 0) {
                    cats = [fallbackCat];
                }
                kw.category = cats;
            });
        },

        updateCategoryField(key, field, val) {
            if (this.caseData.categories && this.caseData.categories[key]) {
                this.caseData.categories[key][field] = val;
                const card = document.querySelector(`.category-card[data-cat-key="${key}"]`);
                if (card) {
                    const cat = this.caseData.categories[key];
                    const hex = cat.hex || "#94a3b8";
                    const icon = cat.icon || "🏷️";
                    const label = cat.label || key;

                    card.style.borderLeftColor = hex;
                    const titleIcon = card.querySelector(".cat-card-icon");
                    if (titleIcon) titleIcon.innerText = icon;
                    const badge = card.querySelector(".category-preview-badge");
                    if (badge) {
                        badge.style.background = `${hex}25`;
                        badge.style.borderColor = hex;
                        badge.style.color = hex;
                        const badgeIcon = badge.querySelector(".badge-icon");
                        if (badgeIcon) badgeIcon.innerText = icon;
                        const badgeLabel = badge.querySelector(".badge-label");
                        if (badgeLabel) badgeLabel.innerText = label;
                    }
                    if (field === 'hex') {
                        const colorPicker = card.querySelector(".color-picker-native");
                        if (colorPicker && colorPicker.value !== val && val.startsWith("#") && (val.length === 4 || val.length === 7)) {
                            colorPicker.value = val;
                        }
                        const hexText = card.querySelector(".color-text-input");
                        if (hexText && hexText.value !== val) {
                            hexText.value = val;
                        }
                    }
                }
                this.renderPreview();
            }
        },

        resetDefaultCategories() {
            if (confirm("Reset categories back to standard Soviet deduction categories? Custom categories will be overwritten.")) {
                const defaultCats = window.CaseEditorConstants?.DEFAULT_CATEGORIES || {};
                this.caseData.categories = JSON.parse(JSON.stringify(defaultCats));
                this.renderCategoriesTab(document.getElementById("tab-workspace"));
                this.renderPreview();
                this.showToast("Reset categories to default.");
            }
        }
    };

    global.CaseEditorCategories = CaseEditorCategories;
})(typeof window !== 'undefined' ? window : globalThis);
