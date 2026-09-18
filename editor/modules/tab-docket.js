/**
 * LOGOS-3 CASE AUTHORING TERMINAL - TAB 6: DOCKET & SOLUTION MATRIX
 * Visual WYSIWYG Slot Tokenizer, Caret-Aware Slot Wizard & Solution Matrix.
 */
(function (global) {
    'use strict';

    const CaseEditorDocket = {
        _lastDocketSelection: null,
        _draggedSlotToken: null,
        _rawMode: false,
        _selectionListenerBound: false,

        renderDocketTab(container) {
            this.ensureGlobalSelectionTracking();

            const docket = this.caseData.docket || { template: "" };
            const solution = this.caseData.solution || {};

            // Extract all slots from template for the matrix table
            const slotsFound = this.extractSlotsFromTemplate(docket.template || '');

            const matrixRows = this.generateMatrixTableHtml(slotsFound, solution);

            container.innerHTML = `
                <div class="form-section">
                    <div class="form-section-title">
                        <span>📋 Investigation Docket Template</span>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            <button class="btn btn-sm btn-primary" 
                                    onmousedown="window.caseEditor.captureDocketCaretBeforeClick()"
                                    onclick="window.caseEditor.openInsertSlotModal('word')">
                                + Insert Word Slot
                            </button>
                            <button class="btn btn-sm" 
                                    onmousedown="window.caseEditor.captureDocketCaretBeforeClick()"
                                    onclick="window.caseEditor.openInsertSlotModal('num')">
                                + Insert Number Slot
                            </button>
                            <button class="btn btn-sm" id="btn-toggle-docket-raw" onclick="window.caseEditor.toggleDocketRawView()">
                                ${this._rawMode ? '👁️ Switch to Visual Pills' : '⚙️ Raw Brackets View'}
                            </button>
                        </div>
                    </div>
                    <div class="form-help">
                        Type case deduction sentences below. Click <strong>+ Insert Word Slot</strong> to insert clickable slot tokens at your cursor. Click any token to configure or drag it to reposition.
                    </div>

                    <!-- WYSIWYG Visual Slot Editor -->
                    <div id="docket-visual-container" style="${this._rawMode ? 'display: none;' : 'display: block;'}">
                        <div id="docket-visual-editor" 
                             class="docket-visual-editor" 
                             contenteditable="true" 
                             spellcheck="false" 
                             data-placeholder="Type deduction template here... e.g. 'The corpse was not [slot:name] but [slot:victim]...'"></div>
                    </div>

                    <!-- Raw Bracket Fallback Editor -->
                    <div id="docket-raw-container" style="${this._rawMode ? 'display: block;' : 'display: none;'}">
                        <textarea id="docket-raw-editor" rows="6" style="font-family: var(--font-mono); font-size: 13px; line-height: 1.8; width: 100%; padding: 12px; background: rgba(0,0,0,0.45); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">${docket.template || ''}</textarea>
                    </div>
                </div>

                <div class="form-section" style="margin-top: 20px;">
                    <div class="form-section-title">
                        <span>🎯 Solution Assignment Matrix (${slotsFound.length} Detected Slots)</span>
                    </div>
                    <div class="form-help">
                        Assign the exact correct keyword or numerical digits required for the player to solve each docket slot.
                    </div>
                    <table class="docket-matrix-table" style="margin-top: 10px;">
                        <thead>
                            <tr>
                                <th style="width: 25%;">Slot ID</th>
                                <th style="width: 35%;">Category / Type</th>
                                <th style="width: 40%;">Target Correct Answer</th>
                            </tr>
                        </thead>
                        <tbody id="docket-matrix-body">
                            ${matrixRows || '<tr><td colspan="3" class="form-help" style="text-align: center; padding: 20px;">No deduction slots inserted yet. Use the buttons above to insert word or number slots.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            `;

            // Populate visual editor from current template
            const visualEditor = document.getElementById("docket-visual-editor");
            if (visualEditor) {
                this.populateVisualEditor(visualEditor, docket.template || '');
                this.bindVisualEditorEvents(visualEditor);
            }

            const rawEditor = document.getElementById("docket-raw-editor");
            if (rawEditor) {
                rawEditor.oninput = (e) => {
                    this.caseData.docket.template = e.target.value;
                    if (visualEditor) this.populateVisualEditor(visualEditor, e.target.value);
                    this.refreshMatrixTable();
                    this.renderPreview();
                    this.updateDiagnostics();
                };
            }
        },

        ensureGlobalSelectionTracking() {
            if (this._selectionListenerBound) return;
            this._selectionListenerBound = true;

            document.addEventListener("selectionchange", () => {
                const editor = document.getElementById("docket-visual-editor");
                if (!editor) return;

                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    if (editor.contains(range.commonAncestorContainer)) {
                        this._lastDocketSelection = range.cloneRange();
                    }
                }
            });
        },

        captureDocketCaretBeforeClick() {
            const editor = document.getElementById("docket-visual-editor");
            if (!editor) return;

            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);
                if (editor.contains(range.commonAncestorContainer)) {
                    this._lastDocketSelection = range.cloneRange();
                }
            }
        },

        getConjugatedKeyword(wordOrId, variation = "base", capitalize = "") {
            if (!wordOrId) return "";
            const kw = (this.caseData.keywords || {})[wordOrId];
            let text = "";
            if (kw && kw.variations) {
                text = kw.variations[variation] || kw.variations.base || wordOrId;
            } else {
                text = String(wordOrId);
            }

            const capStr = String(capitalize || "").toLowerCase().trim();
            if (capStr === "upper" || capStr === "all_upper" || capStr === "all" || capStr === "caps" || capStr === "uppercase") {
                text = text.toUpperCase();
            } else if (capStr === "lower" || capStr === "all_lower" || capStr === "lowercase") {
                text = text.toLowerCase();
            } else if (capStr === "title" || capStr === "cap" || capStr === "capitalize" || capitalize === true || capStr === "true") {
                // Title case: uppercase first character, lowercase subsequent characters per word
                text = text.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            }
            return text;
        },

        parseWordSlotTag(rest) {
            let cat = "name";
            let variation = "base";
            let cap = "";

            if (!rest) return { cat, variation, cap };

            const parts = rest.split(":").map(p => p.trim());
            cat = parts[0] || "name";

            if (parts.length === 2) {
                const p1 = parts[1].toLowerCase();
                if (["upper", "lower", "all_upper", "cap", "capitalize", "title", "caps"].includes(p1)) {
                    cap = p1;
                } else {
                    variation = parts[1];
                }
            } else if (parts.length >= 3) {
                variation = parts[1] || "base";
                cap = parts[2] || "";
            }

            return { cat, variation, cap };
        },

        extractSlotsFromTemplate(templateStr) {
            const wordSlotRegex = /\[slot:([a-zA-Z0-9_-]+)(?::([^\]]+))?\]/g;
            const numSlotRegex = /\[num:([a-zA-Z0-9_-]+):([0-9]+):([^\]]+)\]/g;

            const slotsFound = [];
            let wMatch;
            while ((wMatch = wordSlotRegex.exec(templateStr || '')) !== null) {
                const id = wMatch[1];
                const { cat, variation, cap } = this.parseWordSlotTag(wMatch[2]);
                slotsFound.push({
                    id: id,
                    type: "word",
                    tag: cat,
                    variation: variation,
                    cap: cap
                });
            }

            let nMatch;
            while ((nMatch = numSlotRegex.exec(templateStr || '')) !== null) {
                slotsFound.push({
                    id: nMatch[1],
                    type: "num",
                    length: nMatch[2] || "2",
                    placeholder: nMatch[3] || "HH"
                });
            }
            return slotsFound;
        },

        populateVisualEditor(container, templateStr) {
            container.innerHTML = "";
            if (!templateStr) return;

            // Tokenize template string into tokens and text chunks
            const tokenRegex = /\[slot:([a-zA-Z0-9_-]+)(?::([^\]]+))?\]|\[num:([a-zA-Z0-9_-]+):([0-9]+):([^\]]+)\]|\n/g;
            let lastIndex = 0;
            let match;

            while ((match = tokenRegex.exec(templateStr)) !== null) {
                // Text before match
                if (match.index > lastIndex) {
                    const textChunk = templateStr.substring(lastIndex, match.index);
                    container.appendChild(document.createTextNode(textChunk));
                }

                if (match[0] === '\n') {
                    container.appendChild(document.createElement('br'));
                } else if (match[1]) {
                    // Word Slot
                    const id = match[1];
                    const { cat, variation, cap } = this.parseWordSlotTag(match[2]);
                    const slotData = {
                        id: id,
                        cat: cat,
                        variation: variation,
                        cap: cap
                    };
                    const token = this.createSlotTokenElement("word", slotData);
                    container.appendChild(token);
                } else if (match[3]) {
                    // Number Slot
                    const slotData = {
                        id: match[3],
                        len: match[4] || "2",
                        ph: match[5] || "HH"
                    };
                    const token = this.createSlotTokenElement("num", slotData);
                    container.appendChild(token);
                }

                lastIndex = tokenRegex.lastIndex;
            }

            if (lastIndex < templateStr.length) {
                container.appendChild(document.createTextNode(templateStr.substring(lastIndex)));
            }
        },

        createSlotTokenElement(type, data) {
            const span = document.createElement("span");
            span.className = `docket-slot-token ${type === 'num' ? 'token-num' : ''}`;
            span.contentEditable = "false";
            span.draggable = true;
            span.dataset.slotType = type;
            span.dataset.slotId = data.id;

            const solution = this.caseData.solution || {};
            const assignedSolution = solution[data.id];
            const answers = Array.isArray(assignedSolution) ? assignedSolution : (assignedSolution ? [assignedSolution] : []);

            if (type === "word") {
                span.dataset.slotCat = data.cat || "name";
                span.dataset.slotVar = data.variation || "base";
                span.dataset.slotCap = data.cap || "";

                const catObj = (this.caseData.categories || {})[data.cat] || {};
                const hex = catObj.hex || "var(--accent)";
                const icon = catObj.icon || "🏷️";

                span.style.borderColor = hex;
                span.style.color = hex;
                span.style.background = `${hex}22`;

                // If solution keyword(s) are assigned, display conjugated and capitalized form(s)
                let displayText = "";
                if (answers.length > 0) {
                    displayText = answers.map(ans => this.getConjugatedKeyword(ans, data.variation || "base", data.cap || "")).join(" / ");
                } else {
                    displayText = `[ ${data.id} ]`;
                }

                span.innerHTML = `
                    <span class="token-icon">${icon}</span>
                    <span class="token-text">${displayText}</span>
                `;
                span.title = `Slot: ${data.id} | Cat: ${data.cat} | Answers: ${answers.join(', ') || 'None'} (Click to configure)`;
            } else {
                span.dataset.slotLen = data.len || "2";
                span.dataset.slotPh = data.ph || "HH";

                const displayText = answers.length > 0 ? answers.join(" / ") : `[ ${data.ph || data.id} ]`;

                span.innerHTML = `
                    <span class="token-icon">🔢</span>
                    <span class="token-text">${displayText}</span>
                `;
                span.title = `Number Slot: ${data.id} (${data.len} digits) | Answers: ${answers.join(', ') || 'None'} (Click to configure)`;
            }

            // Click to edit
            span.addEventListener("click", (e) => {
                e.stopPropagation();
                this.openEditSlotModal(span);
            });

            // Drag & Drop
            span.addEventListener("dragstart", (e) => {
                this._draggedSlotToken = span;
                span.classList.add("dragging");
                e.dataTransfer.setData("text/plain", data.id);
                e.dataTransfer.effectAllowed = "move";
            });

            span.addEventListener("dragend", () => {
                span.classList.remove("dragging");
                this._draggedSlotToken = null;
                this.serializeVisualEditorToTemplate();
            });

            return span;
        },

        bindVisualEditorEvents(editor) {
            const saveSelection = () => {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0) {
                    const range = sel.getRangeAt(0);
                    if (editor.contains(range.commonAncestorContainer)) {
                        this._lastDocketSelection = range.cloneRange();
                    }
                }
            };

            editor.addEventListener("keyup", () => {
                saveSelection();
                this.serializeVisualEditorToTemplate();
            });

            editor.addEventListener("mouseup", saveSelection);
            editor.addEventListener("touchend", saveSelection);
            editor.addEventListener("focus", saveSelection);

            editor.addEventListener("input", () => {
                this.serializeVisualEditorToTemplate();
            });

            // Drag & drop inside visual editor
            editor.addEventListener("dragover", (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
            });

            editor.addEventListener("drop", (e) => {
                e.preventDefault();
                if (!this._draggedSlotToken) return;

                let range = null;
                if (document.caretRangeFromPoint) {
                    range = document.caretRangeFromPoint(e.clientX, e.clientY);
                } else if (document.caretPositionFromPoint) {
                    const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
                    range = document.createRange();
                    range.setStart(pos.offsetNode, pos.offset);
                    range.collapse(true);
                }

                if (range && editor.contains(range.commonAncestorContainer)) {
                    range.insertNode(this._draggedSlotToken);
                } else {
                    editor.appendChild(this._draggedSlotToken);
                }

                this.serializeVisualEditorToTemplate();
            });
        },

        serializeVisualEditorToTemplate() {
            const editor = document.getElementById("docket-visual-editor");
            if (!editor) return "";

            let result = "";
            const walk = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    result += node.nodeValue;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.tagName === "BR") {
                        result += "\n";
                    } else if (node.classList && node.classList.contains("docket-slot-token")) {
                        const type = node.dataset.slotType;
                        const id = node.dataset.slotId;
                        if (type === "word") {
                            const cat = node.dataset.slotCat || "name";
                            const variation = node.dataset.slotVar || "base";
                            const cap = node.dataset.slotCap || "";

                            if (cap) {
                                result += `[slot:${id}:${cat}:${variation}:${cap}]`;
                            } else if (variation && variation !== "base") {
                                result += `[slot:${id}:${cat}:${variation}]`;
                            } else {
                                result += `[slot:${id}:${cat}]`;
                            }
                        } else {
                            const len = node.dataset.slotLen || "2";
                            const ph = node.dataset.slotPh || "HH";
                            result += `[num:${id}:${len}:${ph}]`;
                        }
                    } else if (node.tagName === "DIV" || node.tagName === "P") {
                        if (result.length > 0 && !result.endsWith("\n")) result += "\n";
                        node.childNodes.forEach(walk);
                    } else {
                        node.childNodes.forEach(walk);
                    }
                }
            };

            editor.childNodes.forEach(walk);

            this.caseData.docket.template = result;

            const rawEditor = document.getElementById("docket-raw-editor");
            if (rawEditor && rawEditor.value !== result) {
                rawEditor.value = result;
            }

            this.refreshMatrixTable();
            this.renderPreview();
            this.updateDiagnostics();
            return result;
        },

        generateMatrixTableHtml(slotsFound, solution) {
            if (!slotsFound || slotsFound.length === 0) {
                return '<tr><td colspan="3" class="form-help" style="text-align: center; padding: 20px;">No deduction slots inserted yet. Use the buttons above to insert word or number slots.</td></tr>';
            }

            let rows = "";
            slotsFound.forEach(slot => {
                const currentVal = solution[slot.id];
                if (slot.type === "word") {
                    const catObj = (this.caseData.categories || {})[slot.tag] || {};
                    const hex = catObj.hex || "var(--accent)";
                    const icon = catObj.icon || "🏷️";
                    const answers = Array.isArray(currentVal) ? currentVal : (currentVal ? [currentVal] : []);

                    const chipsHtml = answers.map(ans => {
                        const kw = (this.caseData.keywords || {})[ans];
                        const base = kw?.variations?.base || ans;
                        return `<span class="slot-ans-chip" style="border-color: ${hex}; color: ${hex}; background: ${hex}18;">
                            <span>${icon} ${ans}</span>
                            <span class="chip-del-btn" onclick="window.caseEditor.removeMatrixSolutionKeyword('${slot.id}', '${ans}')" title="Remove answer">✕</span>
                        </span>`;
                    }).join('');

                    const selectOptions = Object.keys(this.caseData.keywords || {})
                        .filter(k => !answers.includes(k))
                        .map(k => {
                            const kw = (this.caseData.keywords || {})[k];
                            const base = kw?.variations?.base || k;
                            return `<option value="${k}">${k} ("${base}")</option>`;
                        }).join('');

                    const selectHtml = `
                        <select onchange="window.caseEditor.addMatrixSolutionKeyword('${slot.id}', this.value)" style="font-family: var(--font-mono); font-size: 11px; padding: 2px 6px; max-width: 170px;">
                            <option value="">${answers.length === 0 ? '-- Select Answer Keyword --' : '+ Add Keyword...'}</option>
                            ${selectOptions}
                        </select>
                    `;

                    rows += `
                        <tr>
                            <td>
                                <strong style="color: var(--accent); cursor: pointer;" onclick="window.caseEditor.openEditSlotModalById('${slot.id}')" title="Click to edit slot configuration">
                                    ${slot.id} ✏️
                                </strong>
                            </td>
                            <td>
                                <span class="docket-slot-token" style="border-color: ${hex}; color: ${hex}; background: ${hex}20;">
                                    <span class="token-icon">${icon}</span>
                                    <span>${slot.tag}</span>
                                    <span class="token-badge">${slot.variation}${slot.cap ? ` : ${slot.cap}` : ''}</span>
                                </span>
                            </td>
                            <td>
                                <div class="slot-ans-container">
                                    ${chipsHtml}
                                    ${selectHtml}
                                </div>
                            </td>
                        </tr>
                    `;
                } else {
                    const valStr = Array.isArray(currentVal) ? currentVal.join(', ') : (currentVal || '');
                    rows += `
                        <tr>
                            <td>
                                <strong style="color: var(--accent); cursor: pointer;" onclick="window.caseEditor.openEditSlotModalById('${slot.id}')" title="Click to edit slot configuration">
                                    ${slot.id} ✏️
                                </strong>
                            </td>
                            <td>
                                <span class="docket-slot-token token-num">
                                    <span class="token-icon">🔢</span>
                                    <span>${slot.length} digits</span>
                                    <span class="token-badge">${slot.placeholder}</span>
                                </span>
                            </td>
                            <td>
                                <input type="text" value="${valStr}" 
                                       placeholder="e.g. ${slot.placeholder} or ${slot.placeholder}, ..." 
                                       onchange="window.caseEditor.updateSolutionSlot('${slot.id}', this.value)" 
                                       style="width: 160px; font-family: var(--font-mono); font-size: 12px; padding: 4px 8px; text-align: center; font-weight: 700;">
                            </td>
                        </tr>
                    `;
                }
            });

            return rows;
        },

        refreshMatrixTable() {
            const tbody = document.getElementById("docket-matrix-body");
            if (!tbody) return;

            const slotsFound = this.extractSlotsFromTemplate(this.caseData.docket?.template || '');
            const solution = this.caseData.solution || {};
            tbody.innerHTML = this.generateMatrixTableHtml(slotsFound, solution);
        },

        toggleDocketRawView() {
            this._rawMode = !this._rawMode;
            const visualCont = document.getElementById("docket-visual-container");
            const rawCont = document.getElementById("docket-raw-container");
            const toggleBtn = document.getElementById("btn-toggle-docket-raw");

            if (visualCont) visualCont.style.display = this._rawMode ? 'none' : 'block';
            if (rawCont) rawCont.style.display = this._rawMode ? 'block' : 'none';
            if (toggleBtn) toggleBtn.innerText = this._rawMode ? '👁️ Switch to Visual Pills' : '⚙️ Raw Brackets View';

            if (!this._rawMode) {
                const visualEditor = document.getElementById("docket-visual-editor");
                if (visualEditor) this.populateVisualEditor(visualEditor, this.caseData.docket?.template || '');
            }
        },

        updateSolutionSlot(slotId, val) {
            if (!this.caseData.solution) this.caseData.solution = {};

            if (typeof val === 'string') {
                const parts = val.split(/[,/]/).map(s => s.trim()).filter(Boolean);
                if (parts.length === 1) {
                    this.caseData.solution[slotId] = parts[0];
                } else if (parts.length > 1) {
                    this.caseData.solution[slotId] = parts;
                } else {
                    delete this.caseData.solution[slotId];
                }
            } else if (Array.isArray(val)) {
                if (val.length === 1) {
                    this.caseData.solution[slotId] = val[0];
                } else if (val.length > 1) {
                    this.caseData.solution[slotId] = val;
                } else {
                    delete this.caseData.solution[slotId];
                }
            } else if (val) {
                this.caseData.solution[slotId] = val;
            } else {
                delete this.caseData.solution[slotId];
            }

            // Sync visual editor pills display text
            const visualEditor = document.getElementById("docket-visual-editor");
            if (visualEditor) {
                this.populateVisualEditor(visualEditor, this.caseData.docket?.template || '');
            }

            this.refreshMatrixTable();
            this.renderPreview();
            this.updateDiagnostics();
        },

        addMatrixSolutionKeyword(slotId, kwId) {
            if (!kwId) return;
            const currentVal = (this.caseData.solution || {})[slotId];
            const answers = Array.isArray(currentVal) ? [...currentVal] : (currentVal ? [currentVal] : []);
            if (!answers.includes(kwId)) {
                answers.push(kwId);
                this.updateSolutionSlot(slotId, answers);
            }
        },

        removeMatrixSolutionKeyword(slotId, kwId) {
            const currentVal = (this.caseData.solution || {})[slotId];
            let answers = Array.isArray(currentVal) ? [...currentVal] : (currentVal ? [currentVal] : []);
            answers = answers.filter(a => a !== kwId);
            this.updateSolutionSlot(slotId, answers);
        },

        openInsertSlotModal(type) {
            this.openSlotWizardModal({
                type: type,
                isEdit: false,
                slotData: {
                    id: type === "word" ? `slot_${Date.now().toString().slice(-4)}` : `num_${Date.now().toString().slice(-4)}`,
                    cat: Object.keys(this.caseData.categories || {})[0] || "name",
                    variation: "base",
                    cap: "",
                    len: "2",
                    ph: "HH",
                    targetAnswer: ""
                }
            });
        },

        openEditSlotModal(tokenEl) {
            const type = tokenEl.dataset.slotType;
            const slotId = tokenEl.dataset.slotId;
            const solution = this.caseData.solution || {};

            const slotData = {
                id: slotId,
                cat: tokenEl.dataset.slotCat || "name",
                variation: tokenEl.dataset.slotVar || "base",
                cap: tokenEl.dataset.slotCap || "",
                len: tokenEl.dataset.slotLen || "2",
                ph: tokenEl.dataset.slotPh || "HH",
                targetAnswer: solution[slotId] || ""
            };

            this.openSlotWizardModal({
                type: type,
                isEdit: true,
                editElement: tokenEl,
                slotData: slotData
            });
        },

        openEditSlotModalById(slotId) {
            const visualEditor = document.getElementById("docket-visual-editor");
            if (visualEditor) {
                const token = visualEditor.querySelector(`.docket-slot-token[data-slot-id="${slotId}"]`);
                if (token) {
                    this.openEditSlotModal(token);
                    return;
                }
            }
            // Fallback: lookup from template
            const slots = this.extractSlotsFromTemplate(this.caseData.docket?.template || '');
            const found = slots.find(s => s.id === slotId);
            if (found) {
                this.openSlotWizardModal({
                    type: found.type,
                    isEdit: true,
                    slotData: {
                        id: found.id,
                        cat: found.tag || "name",
                        variation: found.variation || "base",
                        cap: found.cap || "",
                        len: found.length || "2",
                        ph: found.placeholder || "HH",
                        targetAnswer: (this.caseData.solution || {})[slotId] || ""
                    }
                });
            }
        },

        openSlotWizardModal({ type, isEdit, editElement, slotData }) {
            const existingModal = document.getElementById("slot-wizard-modal");
            if (existingModal) existingModal.remove();

            const categories = this.caseData.categories || window.CaseEditorConstants?.DEFAULT_CATEGORIES || {};
            const keywords = this.caseData.keywords || {};

            let selectedAnswers = Array.isArray(slotData.targetAnswer)
                ? [...slotData.targetAnswer]
                : (slotData.targetAnswer ? [slotData.targetAnswer] : []);

            const modalOverlay = document.createElement("div");
            modalOverlay.id = "slot-wizard-modal";
            modalOverlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); z-index: 99999; display: flex; align-items: center; justify-content: center;";

            let wizardFormHtml = "";
            if (type === "word") {
                wizardFormHtml = `
                    <div class="form-row">
                        <label class="form-label">Slot Identifier (Unique ID)</label>
                        <input type="text" id="wiz-slot-id" value="${slotData.id}" placeholder="e.g. suspect_name, weapon, escape_route" style="font-family: var(--font-mono); font-size: 13px;">
                        <span class="form-help">Internal slot ID for solution assignment and docket verification.</span>
                    </div>

                    <div class="form-row">
                        <label class="form-label">Required Category Restriction</label>
                        <select id="wiz-slot-cat" style="font-family: var(--font-mono); font-size: 13px;">
                            ${Object.keys(categories).map(k => `
                                <option value="${k}" ${slotData.cat === k ? 'selected' : ''}>
                                    ${categories[k].icon || '🏷️'} ${categories[k].label || k} (${k})
                                </option>
                            `).join('')}
                        </select>
                        <span class="form-help">Only player keywords matching this category can be dropped into the slot.</span>
                    </div>

                    <div class="form-row-horizontal">
                        <div class="form-row">
                            <label class="form-label">Grammar Variation Display</label>
                            <select id="wiz-slot-var" style="font-family: var(--font-mono); font-size: 12px;">
                                <option value="base" ${slotData.variation === 'base' ? 'selected' : ''}>Base Word Form</option>
                                <option value="past" ${slotData.variation === 'past' ? 'selected' : ''}>Past Tense (e.g. ran, fled)</option>
                                <option value="plural" ${slotData.variation === 'plural' ? 'selected' : ''}>Plural (e.g. suspects, cars)</option>
                                <option value="continuous" ${slotData.variation === 'continuous' ? 'selected' : ''}>Continuous -ing (e.g. running)</option>
                                <option value="present_singular" ${slotData.variation === 'present_singular' ? 'selected' : ''}>Present Singular (e.g. runs)</option>
                            </select>
                        </div>
                        <div class="form-row">
                            <label class="form-label">Capitalization</label>
                            <select id="wiz-slot-cap" style="font-family: var(--font-mono); font-size: 12px;">
                                <option value="" ${!slotData.cap ? 'selected' : ''}>Normal / Case Defined</option>
                                <option value="title" ${slotData.cap === 'title' ? 'selected' : ''}>Title Case (e.g. Word)</option>
                                <option value="upper" ${slotData.cap === 'upper' ? 'selected' : ''}>UPPERCASE (ALL CAPS)</option>
                                <option value="lower" ${slotData.cap === 'lower' ? 'selected' : ''}>lowercase (all small)</option>
                            </select>
                        </div>
                    </div>

                    <div class="form-row" style="background: rgba(229,169,60,0.08); border: 1px solid rgba(229,169,60,0.3); padding: 12px; border-radius: 4px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                            <label class="form-label" style="color: var(--accent); font-weight: 700; margin: 0;">🎯 Accepted Target Solution(s)</label>
                            <span style="font-size: 11px; color: var(--text-tertiary);" id="wiz-ans-count">${selectedAnswers.length} accepted</span>
                        </div>
                        <div id="wiz-ans-chip-container" class="slot-ans-container" style="min-height: 28px; margin-bottom: 8px;"></div>
                        <select id="wiz-slot-answer-select" style="font-family: var(--font-mono); font-size: 12px; width: 100%;">
                            <option value="">+ Add Accepted Keyword Solution...</option>
                            ${Object.keys(keywords).map(k => {
                                const kw = keywords[k];
                                const base = kw?.variations?.base || k;
                                return `<option value="${k}">${k} ("${base}")</option>`;
                            }).join('')}
                        </select>
                        <span class="form-help" style="margin-top: 6px;">Select one or multiple keywords. Any selected keyword will satisfy this slot during verification.</span>
                    </div>
                `;
            } else {
                const numValStr = Array.isArray(slotData.targetAnswer) ? slotData.targetAnswer.join(', ') : (slotData.targetAnswer || '');
                wizardFormHtml = `
                    <div class="form-row">
                        <label class="form-label">Number Slot Identifier (Unique ID)</label>
                        <input type="text" id="wiz-slot-id" value="${slotData.id}" placeholder="e.g. time_hour, time_min, year" style="font-family: var(--font-mono); font-size: 13px;">
                        <span class="form-help">Internal numeric ID for time, year, or digit code validation.</span>
                    </div>

                    <div class="form-row-horizontal">
                        <div class="form-row">
                            <label class="form-label">Digit Length</label>
                            <input type="number" id="wiz-slot-len" min="1" max="16" value="${slotData.len || '2'}" style="font-family: var(--font-mono); font-size: 13px;">
                        </div>
                        <div class="form-row">
                            <label class="form-label">Placeholder Display Text</label>
                            <input type="text" id="wiz-slot-ph" value="${slotData.ph}" placeholder="e.g. HH, MM, YYYY" style="font-family: var(--font-mono); font-size: 13px;">
                        </div>
                    </div>

                    <div class="form-row" style="background: rgba(229,169,60,0.08); border: 1px solid rgba(229,169,60,0.3); padding: 12px; border-radius: 4px;">
                        <label class="form-label" style="color: var(--accent); font-weight: 700;">🎯 Target Numeric Solution(s)</label>
                        <input type="text" id="wiz-slot-answer" value="${numValStr}" placeholder="e.g. 08 or 08, 09 (separate multiples with commas)" style="font-family: var(--font-mono); font-size: 13px; text-align: center; font-weight: 700;">
                        <span class="form-help">Set target number(s). For multiple accepted answers, separate with commas (e.g. <code>08, 09, 10</code>).</span>
                    </div>
                `;
            }

            modalOverlay.innerHTML = `
                <div style="background: #151921; border: 1px solid var(--accent); border-radius: 8px; width: 480px; max-width: 90vw; padding: 22px; box-shadow: 0 16px 40px rgba(0,0,0,0.85); display: flex; flex-direction: column; gap: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                        <h3 style="margin: 0; font-size: 15px; color: var(--accent); font-weight: 700; display: flex; align-items: center; gap: 8px;">
                            <span>${type === 'word' ? '🏷️' : '🔢'}</span>
                            <span>${isEdit ? 'Configure Deduction Slot' : 'Insert Deduction Slot'}</span>
                        </h3>
                        <button class="btn btn-sm" onclick="document.getElementById('slot-wizard-modal').remove()">✕</button>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        ${wizardFormHtml}
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; border-top: 1px solid var(--border-color); padding-top: 14px;">
                        <div>
                            ${isEdit ? `
                                <button class="btn btn-sm btn-danger" id="wiz-btn-delete">🗑️ Delete Slot</button>
                            ` : ''}
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button class="btn btn-sm" onclick="document.getElementById('slot-wizard-modal').remove()">Cancel</button>
                            <button class="btn btn-sm btn-primary" id="wiz-btn-save">${isEdit ? 'Save Changes' : 'Insert Slot'}</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modalOverlay);

            // Bind interactive multi-chip selector for word slots
            if (type === "word") {
                const chipContainer = document.getElementById("wiz-ans-chip-container");
                const countEl = document.getElementById("wiz-ans-count");
                const selectEl = document.getElementById("wiz-slot-answer-select");

                const renderWizChips = () => {
                    if (!chipContainer) return;
                    chipContainer.innerHTML = "";
                    if (selectedAnswers.length === 0) {
                        chipContainer.innerHTML = '<span style="font-size: 11px; color: var(--text-tertiary); font-style: italic;">No target keyword assigned (Optional: assign later in matrix)</span>';
                    } else {
                        selectedAnswers.forEach(ans => {
                            const kw = keywords[ans];
                            const base = kw?.variations?.base || ans;
                            const chip = document.createElement("span");
                            chip.className = "slot-ans-chip";
                            chip.innerHTML = `
                                <span>🏷️ ${ans}</span>
                                <span class="chip-del-btn" title="Remove answer">✕</span>
                            `;
                            chip.querySelector(".chip-del-btn").addEventListener("click", () => {
                                selectedAnswers = selectedAnswers.filter(a => a !== ans);
                                renderWizChips();
                            });
                            chipContainer.appendChild(chip);
                        });
                    }
                    if (countEl) {
                        countEl.textContent = `${selectedAnswers.length} accepted`;
                    }
                };

                renderWizChips();

                if (selectEl) {
                    selectEl.addEventListener("change", (e) => {
                        const val = e.target.value;
                        if (val && !selectedAnswers.includes(val)) {
                            selectedAnswers.push(val);
                            renderWizChips();
                        }
                        e.target.value = "";
                    });
                }
            }

            const saveBtn = document.getElementById("wiz-btn-save");
            if (saveBtn) {
                saveBtn.addEventListener("click", () => {
                    const rawId = document.getElementById("wiz-slot-id")?.value || "";
                    const cleanId = rawId.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
                    if (!cleanId) {
                        alert("Please provide a valid Slot ID!");
                        return;
                    }

                    const updatedData = { id: cleanId };
                    let finalAnswer = null;

                    if (type === "word") {
                        updatedData.cat = document.getElementById("wiz-slot-cat")?.value || "name";
                        updatedData.variation = document.getElementById("wiz-slot-var")?.value || "base";
                        updatedData.cap = document.getElementById("wiz-slot-cap")?.value || "";

                        if (selectedAnswers.length === 1) {
                            finalAnswer = selectedAnswers[0];
                        } else if (selectedAnswers.length > 1) {
                            finalAnswer = selectedAnswers;
                        }
                    } else {
                        updatedData.len = document.getElementById("wiz-slot-len")?.value || "2";
                        updatedData.ph = document.getElementById("wiz-slot-ph")?.value || "HH";

                        const rawAns = document.getElementById("wiz-slot-answer")?.value || "";
                        const parts = rawAns.split(/[,/]/).map(s => s.trim()).filter(Boolean);
                        if (parts.length === 1) {
                            finalAnswer = parts[0];
                        } else if (parts.length > 1) {
                            finalAnswer = parts;
                        }
                    }

                    // Update solution assignment
                    if (!this.caseData.solution) this.caseData.solution = {};
                    if (isEdit && slotData.id !== cleanId) {
                        delete this.caseData.solution[slotData.id];
                    }
                    if (finalAnswer) {
                        this.caseData.solution[cleanId] = finalAnswer;
                    } else {
                        delete this.caseData.solution[cleanId];
                    }

                    if (isEdit && editElement) {
                        // Replace existing element
                        const newElement = this.createSlotTokenElement(type, updatedData);
                        editElement.replaceWith(newElement);
                    } else {
                        // Insert new element
                        const newElement = this.createSlotTokenElement(type, updatedData);
                        this.insertTokenAtCaret(newElement);
                    }

                    modalOverlay.remove();
                    this.serializeVisualEditorToTemplate();
                    this.showToast(isEdit ? `Updated slot: ${cleanId}` : `Inserted slot: ${cleanId}`);
                });
            }

            const deleteBtn = document.getElementById("wiz-btn-delete");
            if (deleteBtn && isEdit && editElement) {
                deleteBtn.addEventListener("click", () => {
                    if (confirm(`Remove slot "${slotData.id}" from template?`)) {
                        if (this.caseData.solution) delete this.caseData.solution[slotData.id];
                        editElement.remove();
                        modalOverlay.remove();
                        this.serializeVisualEditorToTemplate();
                        this.showToast(`Removed slot: ${slotData.id}`);
                    }
                });
            }
        },

        insertTokenAtCaret(tokenElement) {
            const visualEditor = document.getElementById("docket-visual-editor");
            if (!visualEditor) return;

            let targetRange = this._lastDocketSelection;
            const sel = window.getSelection();

            // If no range or not inside editor, default to the END of the visual editor
            if (!targetRange || !visualEditor.contains(targetRange.commonAncestorContainer)) {
                targetRange = document.createRange();
                targetRange.selectNodeContents(visualEditor);
                targetRange.collapse(false); // Move to the end
            }

            targetRange.deleteContents();

            // Insert spacing before & after
            const spaceBefore = document.createTextNode(" ");
            const spaceAfter = document.createTextNode(" ");

            // Insert nodes at caret position
            targetRange.insertNode(spaceAfter);
            targetRange.insertNode(tokenElement);
            targetRange.insertNode(spaceBefore);

            // Move caret immediately after the inserted token and space
            const newRange = document.createRange();
            newRange.setStartAfter(spaceAfter);
            newRange.collapse(true);

            if (sel) {
                sel.removeAllRanges();
                sel.addRange(newRange);
            }
            this._lastDocketSelection = newRange;

            visualEditor.focus();
        }
    };

    global.CaseEditorDocket = CaseEditorDocket;
})(typeof window !== 'undefined' ? window : globalThis);
