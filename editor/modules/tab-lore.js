/**
 * LOGOS-3 CASE AUTHORING TERMINAL - TAB 7: LORE CODEX
 */
(function (global) {
    'use strict';

    const CaseEditorLore = {
        renderLoreTab(container) {
            const lore = this.caseData.lore || {};
            const keywords = this.caseData.keywords || {};
            const defaultCats = window.CaseEditorConstants?.DEFAULT_CATEGORIES || {};
            const availableCategories = this.caseData.categories || defaultCats;
            const availableKeywordList = Object.keys(keywords).sort();
            const keys = Object.keys(lore);

            let cardsHtml = "";
            keys.forEach(k => {
                const entry = lore[k];
                const reqWords = Array.isArray(entry.requiredWords) ? entry.requiredWords : (entry.requiredWords ? [entry.requiredWords] : []);

                cardsHtml += `
                    <div class="form-section">
                        <div class="form-section-title">
                            <span>📄 ${entry.title || k}</span>
                            <button class="btn btn-sm btn-danger" onclick="window.caseEditor.deleteLoreEntry('${k}')">🗑️ Delete</button>
                        </div>
                        <div class="form-row-horizontal">
                            <div class="form-row">
                                <label class="form-label">Codex Key</label>
                                <input type="text" value="${k}" readonly style="opacity: 0.7;">
                            </div>
                            <div class="form-row">
                                <label class="form-label">Archive Tag</label>
                                <input type="text" value="${entry.tag || ''}" oninput="window.caseEditor.updateLoreField('${k}', 'tag', this.value)">
                            </div>
                        </div>
                        <div class="form-row">
                            <label class="form-label">Full Title</label>
                            <input type="text" value="${entry.title || ''}" oninput="window.caseEditor.updateLoreField('${k}', 'title', this.value)">
                        </div>
                        <div class="form-row">
                            <label class="form-label">Full Name & Russian Cyrillic / IPA Pronunciation</label>
                            <input type="text" value="${entry.cyrillic || entry.fullName || ''}" oninput="window.caseEditor.updateLoreField('${k}', 'cyrillic', this.value)">
                            <span class="form-help">e.g. Пограничный институт [IPA_ru:pəgrɐˈnʲit͡ɕnɨj ɪnstʲɪˈtut]</span>
                        </div>
                        <div class="form-row">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <label class="form-label" style="margin: 0;">Required Trigger Keywords (${reqWords.length})</label>
                                <button type="button" class="btn btn-sm" style="padding: 2px 8px; font-size: 11px;" onclick="window.caseEditor.promptAddCustomLoreKeyword('${k}')">+ Custom Keyword</button>
                            </div>
                            <div class="lore-trigger-chips-container" style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; min-height: 32px; padding: 6px 8px; background: rgba(0,0,0,0.35); border: 1px solid var(--border-color); border-radius: 4px;">
                                ${reqWords.length > 0 ? reqWords.map(w => {
                                    const kwData = keywords[w];
                                    const catKey = Array.isArray(kwData?.category) ? kwData.category[0] : kwData?.category;
                                    const catObj = catKey && availableCategories[catKey] ? availableCategories[catKey] : null;
                                    const catHex = catObj?.hex || 'var(--accent)';
                                    const catIcon = catObj?.icon || '🏷️';
                                    return `
                                        <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 11px; padding: 3px 8px; border-radius: 3px; border: 1px solid ${catHex}60; background: ${catHex}20; color: ${catHex};">
                                            <span>${catIcon} <strong>${w}</strong></span>
                                            <span style="cursor: pointer; opacity: 0.75; font-weight: bold; margin-left: 2px; font-size: 13px; line-height: 1;" title="Remove trigger keyword" onclick="window.caseEditor.removeLoreReqWord('${k}', '${w}')">×</span>
                                        </span>
                                    `;
                                }).join('') : '<span style="color: var(--text-dim); font-size: 11px; font-style: italic; align-self: center;">No trigger keywords set. Add from dropdown below.</span>'}
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <select class="form-select" style="flex: 1; padding: 6px 8px; background: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 2px; font-size: 12px; font-family: var(--font-mono);" onchange="if(this.value){ window.caseEditor.addLoreReqWord('${k}', this.value); this.value=''; }">
                                    <option value="">➕ Select keyword to add as unlock trigger...</option>
                                    ${availableKeywordList.map(kw => {
                                        const isSelected = reqWords.includes(kw);
                                        const kwData = keywords[kw];
                                        const catKey = Array.isArray(kwData?.category) ? kwData.category[0] : kwData?.category;
                                        const catObj = catKey && availableCategories[catKey] ? availableCategories[catKey] : null;
                                        const catLabel = catObj ? `[${catObj.label || catKey}] ` : '';
                                        return `<option value="${kw}" ${isSelected ? 'disabled' : ''}>${catLabel}${kw} ${isSelected ? '(already added)' : ''}</option>`;
                                    }).join('')}
                                </select>
                                ${reqWords.length > 0 ? `<button type="button" class="btn btn-sm btn-danger" style="padding: 5px 8px; font-size: 11px;" title="Clear all trigger keywords" onclick="window.caseEditor.clearAllLoreReqWords('${k}')">Clear All</button>` : ''}
                            </div>
                            <span class="form-help">Collecting any of these keywords during gameplay unlocks and decrypts this archival dossier.</span>
                        </div>
                        <div class="form-row">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                <label class="form-label" style="margin: 0;">Dossier Body (Markdown)</label>
                                <button type="button" class="btn btn-sm btn-primary" style="padding: 2px 8px; font-size: 11px;" onclick="window.caseEditor.openInsertKeywordModal('lore-body-${k}')">+ Insert Keyword</button>
                            </div>
                            <textarea id="lore-body-${k}" rows="6" oninput="window.caseEditor.updateLoreField('${k}', 'body', this.value)">${entry.body || entry.text || ''}</textarea>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = `
                <div class="form-section">
                    <div class="form-section-title">
                        <span>📖 Lore Codex & Encrypted Dossiers (${keys.length})</span>
                        <button class="btn btn-sm btn-primary" onclick="window.caseEditor.addNewLoreEntry()">+ Add Lore Dossier</button>
                    </div>
                    <div class="form-help">
                        Lore dossiers are locked archival records that decrypt when players collect required trigger words.
                    </div>
                </div>
                ${cardsHtml || '<div class="form-section"><div class="form-help">No lore dossiers in this case. Click above to add one.</div></div>'}
            `;
        },

        addNewLoreEntry() {
            const raw = prompt("Enter Lore Key / ID (e.g. 'PIRM', 'ROVD', 'Khabarovsk'):");
            if (!raw) return;
            const key = raw.trim();
            if (!this.caseData.lore) this.caseData.lore = {};
            if (this.caseData.lore[key]) {
                alert("Lore entry already exists!");
                return;
            }
            this.caseData.lore[key] = {
                id: `lore-${key.toLowerCase().replace(/[^a-z0-9_]/g, '_')}`,
                tag: "USSR STATE DIRECTORY // ARCHIVE",
                title: key,
                cyrillic: `${key} [IPA_ru:...]`,
                requiredWords: [key.toLowerCase().replace(/[^a-z0-9_]/g, '_')],
                body: `**[${key.toLowerCase()}]** dossier description and historical background.`
            };
            this.renderLoreTab(document.getElementById("tab-workspace"));
            this.updateBadgeCounts();
            this.updateDiagnostics();
            this.renderPreview();
            this.showToast(`Added lore dossier: ${key}`);
        },

        deleteLoreEntry(key) {
            if (confirm(`Delete lore entry "${key}"?`)) {
                if (this.caseData.lore) delete this.caseData.lore[key];
                this.renderLoreTab(document.getElementById("tab-workspace"));
                this.updateBadgeCounts();
                this.updateDiagnostics();
                this.renderPreview();
                this.showToast("Deleted lore entry.");
            }
        },

        updateLoreField(key, field, val) {
            if (!this.caseData.lore) this.caseData.lore = {};
            if (this.caseData.lore[key]) {
                this.caseData.lore[key][field] = val;
                this.renderPreview();
                this.updateDiagnostics();
            }
        },

        addLoreReqWord(key, word) {
            if (!word || !key) return;
            const clean = word.trim().toLowerCase();
            if (!clean) return;
            if (!this.caseData.lore) this.caseData.lore = {};
            if (this.caseData.lore[key]) {
                if (!Array.isArray(this.caseData.lore[key].requiredWords)) {
                    this.caseData.lore[key].requiredWords = [];
                }
                if (!this.caseData.lore[key].requiredWords.includes(clean)) {
                    this.caseData.lore[key].requiredWords.push(clean);
                    this.renderLoreTab(document.getElementById("tab-workspace"));
                    this.updateBadgeCounts();
                    this.updateDiagnostics();
                    this.renderPreview();
                    this.showToast(`Added trigger keyword: ${clean}`);
                }
            }
        },

        removeLoreReqWord(key, word) {
            if (!key || !word) return;
            if (!this.caseData.lore || !this.caseData.lore[key]) return;
            if (Array.isArray(this.caseData.lore[key].requiredWords)) {
                this.caseData.lore[key].requiredWords = this.caseData.lore[key].requiredWords.filter(w => w !== word);
                this.renderLoreTab(document.getElementById("tab-workspace"));
                this.updateBadgeCounts();
                this.updateDiagnostics();
                this.renderPreview();
            }
        },

        clearAllLoreReqWords(key) {
            if (!key || !this.caseData.lore || !this.caseData.lore[key]) return;
            this.caseData.lore[key].requiredWords = [];
            this.renderLoreTab(document.getElementById("tab-workspace"));
            this.updateBadgeCounts();
            this.updateDiagnostics();
            this.renderPreview();
        },

        promptAddCustomLoreKeyword(key) {
            const raw = prompt("Enter trigger keyword (e.g. 'ruzhin', 'anatoley'):");
            if (!raw) return;
            this.addLoreReqWord(key, raw);
        },

        updateLoreReqWords(key, val) {
            if (!this.caseData.lore) this.caseData.lore = {};
            if (this.caseData.lore[key]) {
                this.caseData.lore[key].requiredWords = val.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
                this.renderPreview();
                this.updateDiagnostics();
            }
        }
    };

    global.CaseEditorLore = CaseEditorLore;
})(typeof window !== 'undefined' ? window : globalThis);
