/**
 * LOGOS-3 CASE AUTHORING TERMINAL - TAB 5: KEYWORDS & GRAMMAR VOCABULARY
 */
(function (global) {
    'use strict';

    const CaseEditorKeywords = {
        renderKeywordsTab(container) {
            if (typeof this.sanitizeKeywordCategories === 'function') {
                this.sanitizeKeywordCategories();
            }
            const keywords = this.caseData.keywords || {};
            const initialList = this.caseData.initialKeywords || [];
            const defaultCats = window.CaseEditorConstants?.DEFAULT_CATEGORIES || {};
            const availableCategories = this.caseData.categories || defaultCats;
            const keys = Object.keys(keywords);

            let cardsHtml = "";
            keys.forEach(k => {
                const kw = keywords[k];
                const isStarter = initialList.includes(k);
                const categories = Array.isArray(kw.category) ? kw.category : (kw.category ? [kw.category] : []);
                const variations = kw.variations || {};

                cardsHtml += `
                    <div class="keyword-card" data-kw-key="${k}">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <strong style="color: var(--accent);">${k}</strong>
                            <button class="btn btn-sm btn-danger" onclick="window.caseEditor.deleteKeyword('${k}')">🗑️</button>
                        </div>
                        <div class="form-row">
                            <label class="form-label">Base Display Word</label>
                            <input type="text" value="${variations.base || k}" oninput="window.caseEditor.updateKwBase('${k}', this.value)">
                        </div>
                        <div class="form-row">
                            <label class="form-label">Categories</label>
                            <div class="category-chips-group">
                                ${Object.keys(availableCategories).map(catKey => `
                                    <span class="cat-chip ${categories.includes(catKey) ? 'active' : ''}" 
                                          onclick="window.caseEditor.toggleKwCategory('${k}', '${catKey}')"
                                          style="${categories.includes(catKey) ? `border-color: ${availableCategories[catKey].hex}; color: ${availableCategories[catKey].hex}; background: ${availableCategories[catKey].hex}25;` : ''}">
                                        ${availableCategories[catKey].icon || '🏷️'} ${availableCategories[catKey].label || catKey}
                                    </span>
                                `).join('')}
                            </div>
                        </div>
                        <div class="form-row">
                            <label class="form-label">Grammar Variations</label>
                            <div style="grid-template-columns: 1fr 1fr; display: grid; gap: 4px; font-size: 11px;">
                                <input type="text" placeholder="past (e.g. fled)" value="${variations.past || ''}" oninput="window.caseEditor.updateKwVar('${k}', 'past', this.value)">
                                <input type="text" placeholder="plural (e.g. cars)" value="${variations.plural || ''}" oninput="window.caseEditor.updateKwVar('${k}', 'plural', this.value)">
                                <input type="text" placeholder="continuous (e.g. running)" value="${variations.continuous || ''}" oninput="window.caseEditor.updateKwVar('${k}', 'continuous', this.value)">
                                <input type="text" placeholder="present_sg (e.g. runs)" value="${variations.present_singular || ''}" oninput="window.caseEditor.updateKwVar('${k}', 'present_singular', this.value)">
                            </div>
                        </div>
                        <div class="form-row">
                            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 11px;">
                                <input type="checkbox" ${isStarter ? 'checked' : ''} onchange="window.caseEditor.toggleStarterKeyword('${k}', this.checked)">
                                <span>⭐ Preset / Starter Keyword (Pre-unlocked in tray)</span>
                            </label>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = `
                <div class="form-section">
                    <div class="form-section-title">
                        <span>🔤 Keyword Dictionary & Variations (${keys.length})</span>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-sm btn-primary" onclick="window.caseEditor.addNewKeyword()">+ Add Keyword</button>
                            <button class="btn btn-sm" onclick="window.caseEditor.autoExtractKeywordsFromClues()">🔍 Auto-Extract from Clues</button>
                        </div>
                    </div>
                    <div class="form-help">
                        Keywords defined here can be dragged by the player into the docket slots. Use the Auto-Extract tool to instantly find any <code>[Bracketed]</code> keywords written in clues and dossiers.
                    </div>
                    ${keys.length > 5 ? `
                    <div style="margin-bottom: 12px; display: flex; gap: 8px;">
                        <input type="text" id="kw-search-filter" placeholder="🔍 Search keywords..." style="flex: 1; padding: 6px 10px; font-size: 12px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-main);" oninput="
                            const query = this.value.toLowerCase().trim();
                            document.querySelectorAll('.keyword-card').forEach(card => {
                                const kwKey = (card.getAttribute('data-kw-key') || '').toLowerCase();
                                const baseText = (card.querySelector('input') ? card.querySelector('input').value : '').toLowerCase();
                                card.style.display = (!query || kwKey.includes(query) || baseText.includes(query)) ? '' : 'none';
                            });
                        ">
                    </div>
                    ` : ''}
                    <div class="keywords-grid">
                        ${cardsHtml || '<div class="form-help">No keywords defined yet. Click above to add or auto-extract.</div>'}
                    </div>
                </div>
            `;
        },

        addNewKeyword() {
            const raw = prompt("Enter new keyword (e.g. 'volkov', 'pirm', 'flee'):");
            if (!raw) return;
            const key = raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
            if (this.caseData.keywords[key]) {
                alert("Keyword already exists!");
                return;
            }
            const validCats = Object.keys(this.caseData.categories || {});
            const defaultCat = validCats[0] || "noun";
            this.caseData.keywords[key] = {
                category: [defaultCat],
                variations: {
                    base: raw.trim()
                }
            };
            this.renderKeywordsTab(document.getElementById("tab-workspace"));
            this.updateBadgeCounts();
            this.renderPreview();
            this.showToast(`Added keyword: "${raw.trim()}"`);
        },

        deleteKeyword(key) {
            if (confirm(`Delete keyword "${key}"?`)) {
                delete this.caseData.keywords[key];
                this.caseData.initialKeywords = (this.caseData.initialKeywords || []).filter(k => k !== key);
                this.renderKeywordsTab(document.getElementById("tab-workspace"));
                this.updateBadgeCounts();
                this.renderPreview();
                this.showToast("Deleted keyword.");
            }
        },

        updateKwBase(key, val) {
            if (this.caseData.keywords[key]) {
                if (!this.caseData.keywords[key].variations) this.caseData.keywords[key].variations = {};
                this.caseData.keywords[key].variations.base = val;
                this.renderPreview();
            }
        },

        updateKwVar(key, varKey, val) {
            if (this.caseData.keywords[key]) {
                if (!this.caseData.keywords[key].variations) this.caseData.keywords[key].variations = {};
                if (val.trim()) {
                    this.caseData.keywords[key].variations[varKey] = val.trim();
                } else {
                    delete this.caseData.keywords[key].variations[varKey];
                }
                this.renderPreview();
            }
        },

        toggleKwCategory(key, catKey) {
            if (!this.caseData.keywords[key]) return;
            const validCats = Object.keys(this.caseData.categories || {});
            let cats = this.caseData.keywords[key].category;
            if (!Array.isArray(cats)) cats = cats ? [cats] : [];
            // Clean up any orphaned categories not in validCats
            cats = cats.filter(c => validCats.includes(c));

            if (cats.includes(catKey)) {
                cats = cats.filter(c => c !== catKey);
            } else {
                cats.push(catKey);
            }
            this.caseData.keywords[key].category = cats;
            this.renderKeywordsTab(document.getElementById("tab-workspace"));
            this.renderPreview();
        },

        toggleStarterKeyword(key, isStarter) {
            if (!Array.isArray(this.caseData.initialKeywords)) this.caseData.initialKeywords = [];
            if (isStarter) {
                if (!this.caseData.initialKeywords.includes(key)) this.caseData.initialKeywords.push(key);
            } else {
                this.caseData.initialKeywords = this.caseData.initialKeywords.filter(k => k !== key);
            }
        },

        autoExtractKeywords() {
            return this.autoExtractKeywordsFromClues();
        },

        autoExtractKeywordsFromClues() {
            const found = new Set();
            const regex = /\[(?!br\b|vspace\b|field:|footnote:|img:|b\b|\/b\b|i\b|\/i\b|IPA[_-][a-zA-Z0-9\-_]+:|slot:|num:)([^\:\]]+)(?:\:[^\]]+)?\]/g;

            // 1. Scan all timeline clues
            for (let moment of Object.values(this.caseData.timeline || {})) {
                for (let clue of moment.clues || []) {
                    const text = (clue.text || '') + ' ' + (clue.quote || '') + ' ' + (clue.spoken || '') + ' ' + (clue.thought || '') + ' ' + (clue.innerVoice || '');
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const raw = match[1].trim();
                        if (raw) found.add(raw);
                    }
                    if (clue.phone) {
                        if (clue.phone.date) {
                            let dMatch;
                            while ((dMatch = regex.exec(clue.phone.date)) !== null) {
                                if (dMatch[1].trim()) found.add(dMatch[1].trim());
                            }
                        }
                        if (clue.phone.nav) {
                            const nText = (clue.phone.nav.instruction || clue.phone.nav.nextTurn || '') + ' ' + (clue.phone.nav.destination || '') + ' ' + (clue.phone.nav.subtitle || '');
                            let nMatch;
                            while ((nMatch = regex.exec(nText)) !== null) {
                                if (nMatch[1].trim()) found.add(nMatch[1].trim());
                            }
                        }
                        if (clue.phone.messages) {
                            clue.phone.messages.forEach(m => {
                                const mText = (m.sender || '') + ' ' + (m.text || '');
                                let mMatch;
                                while ((mMatch = regex.exec(mText)) !== null) {
                                    if (mMatch[1].trim()) found.add(mMatch[1].trim());
                                }
                            });
                        }
                    }
                    if (clue.clock) {
                        const cText = (clue.clock.title || '') + ' ' + (clue.clock.time || '') + ' ' + (clue.clock.temperature || '') + ' ' + (clue.clock.date || '');
                        let cMatch;
                        while ((cMatch = regex.exec(cText)) !== null) {
                            if (cMatch[1].trim()) found.add(cMatch[1].trim());
                        }
                    }
                    if (clue.audio?.lines) {
                        clue.audio.lines.forEach(l => {
                            const lText = (l.speaker || '') + ' ' + (l.text || '');
                            let lMatch;
                            while ((lMatch = regex.exec(lText)) !== null) {
                                if (lMatch[1].trim()) found.add(lMatch[1].trim());
                            }
                        });
                    }
                    if (clue.badge || clue.idBadge) {
                        const b = clue.badge || clue.idBadge;
                        const bText = (b.dept || '') + ' ' + (b.name || '') + ' ' + (b.role || '');
                        let bMatch;
                        while ((bMatch = regex.exec(bText)) !== null) {
                            if (bMatch[1].trim()) found.add(bMatch[1].trim());
                        }
                    }
                    if (clue.rx || clue.prescription) {
                        const r = clue.rx || clue.prescription;
                        const rText = (r.dispensary || r.header || '') + ' ' + (r.drug || r.text || '') + ' ' + (r.date || '') + ' ' + (r.doctor || '') + ' ' + (r.status || '');
                        let rMatch;
                        while ((rMatch = regex.exec(rText)) !== null) {
                            if (rMatch[1].trim()) found.add(rMatch[1].trim());
                        }
                    }
                    if (clue.poster) {
                        const p = clue.poster;
                        const pText = (p.logo || '') + ' ' + (p.headline || '') + ' ' + (p.date || '') + ' ' + (p.venue || '') + ' ' + (p.badge || '') + ' ' + (p.established || '');
                        let pMatch;
                        while ((pMatch = regex.exec(pText)) !== null) {
                            if (pMatch[1].trim()) found.add(pMatch[1].trim());
                        }
                        (p.agenda || []).forEach(item => {
                            let aMatch;
                            while ((aMatch = regex.exec(item || '')) !== null) {
                                if (aMatch[1].trim()) found.add(aMatch[1].trim());
                            }
                        });
                    }
                    if (clue.table || clue.roster) {
                        const t = clue.table || clue.roster;
                        const tText = (t.caption || '') + ' ' + (t.footer || '') + ' ' + (t.title || '');
                        let tMatch;
                        while ((tMatch = regex.exec(tText)) !== null) {
                            if (tMatch[1].trim()) found.add(tMatch[1].trim());
                        }
                        (t.headers || []).forEach(h => {
                            let hMatch;
                            while ((hMatch = regex.exec(h || '')) !== null) {
                                if (hMatch[1].trim()) found.add(hMatch[1].trim());
                            }
                        });
                        (t.rows || []).forEach(row => {
                            (row || []).forEach(cell => {
                                let cellMatch;
                                while ((cellMatch = regex.exec(cell || '')) !== null) {
                                    if (cellMatch[1].trim()) found.add(cellMatch[1].trim());
                                }
                            });
                        });
                    }
                }
            }

            // 2. Scan encrypted lore dossiers
            for (let dossier of Object.values(this.caseData.lore || {})) {
                const text = (dossier.body || '') + ' ' + (dossier.title || '') + ' ' + (dossier.name || '') + ' ' + (dossier.department || '');
                let dMatch;
                while ((dMatch = regex.exec(text)) !== null) {
                    const raw = dMatch[1].trim();
                    if (raw) found.add(raw);
                }
            }

            const validCats = Object.keys(this.caseData.categories || {});
            const defaultCat = validCats[0] || "noun";

            let addedCount = 0;
            found.forEach(rawToken => {
                const parts = rawToken.split(":").map(p => p.trim());
                const rawWord = parts[0];
                const key = rawWord.toLowerCase().replace(/[^a-z0-9_]/g, "_");
                if (key && !this.caseData.keywords[key]) {
                    this.caseData.keywords[key] = {
                        category: [defaultCat],
                        variations: {
                            base: rawWord
                        }
                    };
                    addedCount++;
                }
            });

            this.renderKeywordsTab(document.getElementById("tab-workspace"));
            this.updateBadgeCounts();
            this.renderPreview();
            this.showToast(`Auto-extracted ${addedCount} new keywords!`);
        },

        openInsertKeywordModal(targetInputId) {
            const existingModal = document.getElementById("kw-wizard-modal");
            if (existingModal) existingModal.remove();

            const keywords = this.caseData.keywords || {};
            const categories = this.caseData.categories || window.CaseEditorConstants?.DEFAULT_CATEGORIES || {};
            const keys = Object.keys(keywords);

            if (keys.length === 0) {
                alert("No keywords defined yet! Please add keywords in the Keywords tab first.");
                return;
            }

            const modalOverlay = document.createElement("div");
            modalOverlay.id = "kw-wizard-modal";
            modalOverlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); z-index: 99999; display: flex; align-items: center; justify-content: center;";

            modalOverlay.innerHTML = `
                <div style="background: #151921; border: 1px solid var(--accent); border-radius: 8px; width: 440px; max-width: 90vw; padding: 22px; box-shadow: 0 16px 40px rgba(0,0,0,0.85); display: flex; flex-direction: column; gap: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                        <h3 style="margin: 0; font-size: 15px; color: var(--accent); font-weight: 700; display: flex; align-items: center; gap: 8px;">
                            <span>🏷️</span>
                            <span>Insert Keyword Bracket</span>
                        </h3>
                        <button class="btn btn-sm" onclick="document.getElementById('kw-wizard-modal').remove()">✕</button>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div class="form-row">
                            <label class="form-label">Select Keyword</label>
                            <select id="kw-wiz-select" style="font-family: var(--font-mono); font-size: 13px;">
                                ${keys.map(k => {
                                    const kw = keywords[k];
                                    const base = kw?.variations?.base || k;
                                    const catKey = Array.isArray(kw?.category) ? kw.category[0] : (kw?.category || "name");
                                    const catObj = categories[catKey] || {};
                                    const icon = catObj.icon || "🏷️";
                                    return `<option value="${k}">${icon} ${k} ("${base}")</option>`;
                                }).join('')}
                            </select>
                        </div>

                        <div class="form-row-horizontal">
                            <div class="form-row">
                                <label class="form-label">Grammar Variation</label>
                                <select id="kw-wiz-var" style="font-family: var(--font-mono); font-size: 12px;">
                                    <option value="base">Base Word Form</option>
                                    <option value="past">Past Tense (e.g. ran)</option>
                                    <option value="plural">Plural (e.g. cars)</option>
                                    <option value="continuous">Continuous -ing</option>
                                    <option value="present_singular">Present Singular (e.g. runs)</option>
                                </select>
                            </div>
                            <div class="form-row">
                                <label class="form-label">Capitalization</label>
                                <select id="kw-wiz-cap" style="font-family: var(--font-mono); font-size: 12px;">
                                    <option value="">Normal / As Defined</option>
                                    <option value="title">Title Case (e.g. Word)</option>
                                    <option value="upper">UPPERCASE (ALL CAPS)</option>
                                    <option value="lower">lowercase (all small)</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-row" style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 4px; border: 1px solid var(--border-color);">
                            <label class="form-label" style="font-size: 11px; color: var(--text-tertiary);">Generated Bracket Tag Preview</label>
                            <code id="kw-wiz-preview" style="color: var(--accent); font-weight: 700; font-size: 13px;">[keyword]</code>
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border-color); padding-top: 14px;">
                        <button class="btn btn-sm" onclick="document.getElementById('kw-wizard-modal').remove()">Cancel</button>
                        <button class="btn btn-sm btn-primary" id="kw-wiz-insert-btn">Insert Tag</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modalOverlay);

            const kwSelect = document.getElementById("kw-wiz-select");
            const varSelect = document.getElementById("kw-wiz-var");
            const capSelect = document.getElementById("kw-wiz-cap");
            const previewEl = document.getElementById("kw-wiz-preview");

            const updatePreview = () => {
                const k = kwSelect?.value || "";
                const v = varSelect?.value || "base";
                const c = capSelect?.value || "";

                let tag = `[${k}`;
                if (c && v && v !== "base") {
                    tag += `:${v}:${c}`;
                } else if (c) {
                    tag += `:${c}`;
                } else if (v && v !== "base") {
                    tag += `:${v}`;
                }
                tag += `]`;

                if (previewEl) previewEl.innerText = tag;
                return tag;
            };

            if (kwSelect) kwSelect.onchange = updatePreview;
            if (varSelect) varSelect.onchange = updatePreview;
            if (capSelect) capSelect.onchange = updatePreview;
            updatePreview();

            const insertBtn = document.getElementById("kw-wiz-insert-btn");
            if (insertBtn) {
                insertBtn.addEventListener("click", () => {
                    const tag = updatePreview();
                    modalOverlay.remove();
                    this.insertTextIntoTarget(targetInputId, tag);
                });
            }
        },

        insertTextIntoTarget(targetInputId, textToInsert) {
            const input = document.getElementById(targetInputId);
            if (!input) return;

            const startPos = input.selectionStart !== undefined ? input.selectionStart : input.value.length;
            const endPos = input.selectionEnd !== undefined ? input.selectionEnd : input.value.length;
            const val = input.value;

            input.value = val.substring(0, startPos) + textToInsert + val.substring(endPos);
            input.focus();
            input.selectionStart = input.selectionEnd = startPos + textToInsert.length;

            // Trigger input event to sync state
            input.dispatchEvent(new Event('input', { bubbles: true }));
            this.showToast(`Inserted ${textToInsert}`);
        }
    };

    global.CaseEditorKeywords = CaseEditorKeywords;
})(typeof window !== 'undefined' ? window : globalThis);
