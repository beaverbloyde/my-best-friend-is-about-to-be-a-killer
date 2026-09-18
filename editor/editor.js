/**
 * LOGOS-3 CASE AUTHORING TERMINAL & MAKER - CORE CONTROLLER
 * Full visual management, auto-extraction, diagnostic validation & export suite.
 * Modular architecture uniting all editor tab controllers & visual editors.
 */
(function (global) {
    'use strict';

    class CaseEditor {
        constructor() {
            this.currentTab = 'metadata';
            const template = window.CaseEditorConstants?.BLANK_CASE_TEMPLATE || {};
            this.caseData = JSON.parse(JSON.stringify(template));
            this.activeTimelineKey = "08:00";
            this.activeClueIndex = 0;
            this.availableChapters = [];
            this.availableCases = [];
            this.progressionData = { version: "2.0", rules: [] };
            this.init();
        }

        init() {
            const host = window.location.hostname;
            const isLocal = !host || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.startsWith('192.168.') || host.startsWith('10.') || host.endsWith('.local') || window.location.protocol === 'file:';
            if (!isLocal) {
                window.location.replace('../index.html');
                return;
            }
            if (document.body) document.body.className = "theme-soviet-amber";
            this.bindNavigation();
            this.bindHeaderActions();
            this.discoverProjectFiles();
            this.renderActiveTab();
            this.updateDiagnostics();
            this.renderPreview();
        }

        async discoverProjectFiles() {
            this.availableChapters = [];
            this.availableCases = [];

            // 1. Discover novel chapters from nwProject.nwx
            try {
                const res = await fetch(`../nwProject.nwx?t=${Date.now()}`);
                if (res.ok) {
                    const text = await res.text();
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(text, 'text/xml');
                    const items = xmlDoc.getElementsByTagName('item');
                    for (let i = 0; i < items.length; i++) {
                        const item = items[i];
                        const handle = item.getAttribute('handle');
                        const className = item.getAttribute('class');
                        const type = item.getAttribute('type');
                        const nameNode = item.getElementsByTagName('name')[0];
                        const name = nameNode ? nameNode.textContent.trim() : handle;

                        // Only include actual novel chapter files
                        if (type === 'FILE' && className === 'NOVEL') {
                            this.availableChapters.push({
                                handle: handle,
                                path: `content/${handle}.nwd`,
                                title: name
                            });
                        }
                    }
                }
            } catch (err) {
                console.warn("Could not scan nwProject.nwx:", err);
            }

            // 2. Discover cases from /api/list-cases endpoint first
            const caseMap = new Map();
            let apiDiscovered = false;
            try {
                const apiRes = await fetch(`/api/list-cases?t=${Date.now()}`);
                if (apiRes.ok) {
                    const apiCases = await apiRes.json();
                    if (Array.isArray(apiCases) && apiCases.length > 0) {
                        apiCases.forEach(c => {
                            if (c && c.path) {
                                const cleanId = (c.id || c.path).replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                                caseMap.set(cleanId, {
                                    id: cleanId,
                                    title: c.title || cleanId,
                                    path: c.path.startsWith('cases/') ? c.path : `cases/${c.path}`,
                                    subtitle: c.subtitle || ""
                                });
                            }
                        });
                        apiDiscovered = true;
                    }
                }
            } catch (e) {
                // Ignore API error when running on static server
            }

            // 3. Fallback discovery if backend API is not present (static hosting or file protocol)
            if (!apiDiscovered) {
                const candidates = new Set();

                // 3a. Check localStorage registry for cases created/saved in this browser
                try {
                    const localReg = JSON.parse(localStorage.getItem('logos_case_registry') || '[]');
                    if (Array.isArray(localReg)) {
                        localReg.forEach(item => {
                            if (item && item.path) candidates.add(item.path);
                            else if (item && item.id) candidates.add(`cases/${item.id}.json`);
                        });
                    }
                } catch (e) {}

                // 3b. Scan progression.json for any referenced cases
                try {
                    const res = await fetch(`../game/cases/progression.json?t=${Date.now()}`);
                    if (res.ok) {
                        const data = await res.json();
                        const rules = data?.rules || [];
                        rules.forEach(r => {
                            if (r.targetType === 'case' || (r.target && !r.target.endsWith('.nwd') && !r.target.includes('/'))) {
                                const clean = r.target.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                                candidates.add(`cases/${clean}.json`);
                            }
                            const reqList = Array.isArray(r.requires) ? r.requires : (r.requires ? [r.requires] : []);
                            reqList.forEach(req => {
                                if (req && req.type === 'case' && req.id) {
                                    const clean = req.id.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                                    candidates.add(`cases/${clean}.json`);
                                }
                            });
                        });
                    }
                } catch (e) {}

                // 3c. Known standard candidate files
                const fallbackNames = [
                    "cases/chapter_01_morning_routine.json",
                    "cases/chapter_01_award_ceremony.json",
                    "cases/chapter_01_the_man_on_the_news.json",
                    "cases/chapter_01_the_headstone.json",
                    "cases/case_template.json"
                ];
                fallbackNames.forEach(fn => candidates.add(fn));

                // Verify each candidate with an actual fetch so nonexistent/deleted files are NEVER displayed
                await Promise.all(Array.from(candidates).map(async (candPath) => {
                    const verified = await this.verifyAndFetchCaseMeta(candPath);
                    if (verified && !caseMap.has(verified.id)) {
                        caseMap.set(verified.id, verified);
                    }
                }));
            }

            // 4. Scan progression.json for progression graph rules & custom nodes
            try {
                const res = await fetch(`../game/cases/progression.json?t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    const rawRules = data?.rules || [];
                    const flattenedRules = [];
                    rawRules.forEach(r => {
                        const reqList = Array.isArray(r.requires) ? r.requires : (r.requires ? [r.requires] : []);
                        if (reqList.length === 0 && (r.requiresCase || r.requiresChapter)) {
                            flattenedRules.push(r);
                        } else {
                            reqList.forEach(reqItem => {
                                flattenedRules.push({
                                    target: r.target,
                                    targetType: r.targetType,
                                    targetTitle: r.targetTitle,
                                    requires: reqItem
                                });
                            });
                        }
                    });

                    this.progressionData = {
                        version: data?.version || "2.0",
                        rules: flattenedRules,
                        customNodes: data?.customNodes || []
                    };
                }
            } catch (err) {
                console.warn("Could not scan progression.json:", err);
            }

            this.availableCases = Array.from(caseMap.values());
            this.populatePresetCaseSelector();

            // If metadata tab is currently visible, refresh the chapter & case dropdowns
            if (this.currentTab === 'metadata') {
                const container = document.getElementById("tab-workspace");
                if (container) this.renderMetadataTab(container);
            }
        }

        async verifyAndFetchCaseMeta(relativePath) {
            try {
                const prefix = window.location.pathname.includes('/editor') ? '../game/' : 'game/';
                const cleanRel = relativePath.replace(/^[./]+/, '').replace(/^game\//, '');
                const fullUrl = prefix + (cleanRel.startsWith('cases/') ? cleanRel : `cases/${cleanRel}`);
                const res = await fetch(`${fullUrl}?t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    const cleanId = (data.id || cleanRel).replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                    return {
                        id: cleanId,
                        path: cleanRel.startsWith('cases/') ? cleanRel : `cases/${cleanRel}`,
                        title: data.meta?.title || data.title || cleanId,
                        subtitle: data.meta?.subtitle || ""
                    };
                }
            } catch (e) {}
            return null;
        }

        populatePresetCaseSelector() {
            const select = document.getElementById("preset-case-select");
            if (!select) return;

            const currentValue = select.value;
            select.innerHTML = `
                <option value="">-- Load Case Preset --</option>
                <option value="new">✨ Create New Blank Case</option>
            `;

            // Sort cases alphabetically with natural numeric ordering
            const sortedCases = [...(this.availableCases || [])].sort((a, b) => {
                const titleA = (a.title || a.id || "").toLowerCase();
                const titleB = (b.title || b.id || "").toLowerCase();
                return titleA.localeCompare(titleB, undefined, { numeric: true, sensitivity: 'base' });
            });

            sortedCases.forEach(c => {
                const opt = document.createElement("option");
                const pathVal = c.path.startsWith("cases/") ? c.path : `cases/${c.path}`;
                opt.value = pathVal;
                opt.textContent = c.title || c.id;
                select.appendChild(opt);
            });

            if (currentValue) {
                select.value = currentValue;
            }
        }

        async extractChapterTitleFromNwd(path) {
            if (!path) return "";
            const found = (this.availableChapters || []).find(c => c.path === path || c.handle === path);
            if (found && found.title) return found.title;

            try {
                const cleanPath = path.startsWith("../") ? path : `../${path.replace(/^\//, '')}`;
                const res = await fetch(`${cleanPath}?t=${Date.now()}`);
                if (res.ok) {
                    const text = await res.text();
                    const nameMatch = text.match(/%%~name:\s*([^\r\n]+)/);
                    if (nameMatch && nameMatch[1]) return nameMatch[1].trim();
                    const h2Match = text.match(/##\s*([^\r\n]+)/);
                    if (h2Match && h2Match[1]) return h2Match[1].trim();
                }
            } catch (e) {
                console.warn("Could not extract title from .nwd:", e);
            }
            return "";
        }

        async extractCaseTitle(caseId) {
            if (!caseId) return "";
            const found = (this.availableCases || []).find(c => c.id === caseId || c.path === caseId);
            if (found && found.title) return found.title;

            try {
                const cleanPath = caseId.endsWith(".json") ? caseId : `cases/${caseId}.json`;
                const url = `../game/${cleanPath}`;
                const res = await fetch(`${url}?t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data?.meta?.title) return data.meta.title;
                }
            } catch (e) {
                console.warn("Could not fetch case JSON:", e);
            }
            return caseId;
        }

        showToast(msg, type = "") {
            const toast = document.getElementById("toast");
            if (!toast) return;
            toast.innerText = msg;
            toast.className = "show";
            if (type) toast.classList.add(`toast-${type}`);
            clearTimeout(this._toastTimeout);
            this._toastTimeout = setTimeout(() => { toast.className = ""; }, 3000);
        }

        bindNavigation() {
            document.querySelectorAll(".nav-tab-item").forEach(item => {
                item.addEventListener("click", () => {
                    const tab = item.getAttribute("data-tab");
                    if (tab) {
                        this.switchTab(tab);
                    }
                });
            });
        }

        switchTab(tab) {
            this.currentTab = tab;
            document.querySelectorAll(".nav-tab-item").forEach(el => {
                el.classList.toggle("active", el.getAttribute("data-tab") === tab);
            });
            this.renderActiveTab();
            this.renderPreview();
        }

        bindHeaderActions() {
            const presetSelect = document.getElementById("preset-case-select");
            if (presetSelect) {
                presetSelect.addEventListener("change", (e) => {
                    const val = e.target.value;
                    if (!val) return;
                    if (val === "new") {
                        if (confirm("Create a new blank case? Unsaved changes will be discarded.")) {
                            const template = window.CaseEditorConstants?.BLANK_CASE_TEMPLATE || {};
                            this.caseData = JSON.parse(JSON.stringify(template));
                            this.renderActiveTab();
                            this.renderPreview();
                            this.showToast("Created new blank case.");
                        }
                    } else {
                        this.loadPresetCase(val);
                    }
                });
            }

            const fileInput = document.getElementById("file-input");
            if (fileInput) {
                fileInput.addEventListener("change", (e) => {
                    const file = e.target.files && e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        try {
                            const parsed = JSON.parse(evt.target.result);
                            this.caseData = parsed;
                            this.normalizeCaseData();
                            this.renderActiveTab();
                            this.renderPreview();
                            this.showToast(`Loaded case file: ${file.name}`);
                        } catch (err) {
                            alert("Failed to parse JSON file: " + err.message);
                        }
                    };
                    reader.readAsText(file);
                });
            }

            const exportBtn = document.getElementById("btn-export-json");
            if (exportBtn) {
                exportBtn.addEventListener("click", () => this.exportJSON());
            }

            const copyBtn = document.getElementById("btn-copy-json");
            if (copyBtn) {
                copyBtn.addEventListener("click", () => {
                    const formatted = JSON.stringify(this.caseData, null, 2);
                    navigator.clipboard.writeText(formatted).then(() => {
                        this.showToast("Case JSON copied to clipboard!");
                    }).catch(() => {
                        this.showToast("Could not access clipboard.");
                    });
                });
            }
        }

        normalizeCaseData() {
            const defaultCats = window.CaseEditorConstants?.DEFAULT_CATEGORIES || {};
            if (!this.caseData.meta) this.caseData.meta = {};
            delete this.caseData.meta.unlocks;
            delete this.caseData.meta.unlocksChapter;
            delete this.caseData.meta.prerequisites;
            if (!this.caseData.timeline) this.caseData.timeline = {};
            if (!this.caseData.keywords) this.caseData.keywords = {};
            if (!this.caseData.categories) this.caseData.categories = JSON.parse(JSON.stringify(defaultCats));
            if (!this.caseData.docket) this.caseData.docket = { template: "" };
            if (!this.caseData.solution) this.caseData.solution = {};

            // Scrub orphan solution keys that don't exist in the docket template
            if (this.caseData.docket?.template && typeof this.caseData.solution === 'object') {
                const template = this.caseData.docket.template;
                const activeSlotIds = new Set();
                const wordSlotRegex = /\[slot:([a-zA-Z0-9_-]+)(?::([^\]]+))?\]/g;
                const numSlotRegex = /\[num:([a-zA-Z0-9_-]+):([0-9]+):([^\]]+)\]/g;
                let m;
                while ((m = wordSlotRegex.exec(template)) !== null) activeSlotIds.add(m[1]);
                while ((m = numSlotRegex.exec(template)) !== null) activeSlotIds.add(m[1]);

                for (const key of Object.keys(this.caseData.solution)) {
                    if (!activeSlotIds.has(key)) {
                        delete this.caseData.solution[key];
                    }
                }
            }

            if (!this.caseData.lore) this.caseData.lore = {};
            if (!Array.isArray(this.caseData.initialKeywords)) this.caseData.initialKeywords = [];
            if (!Array.isArray(this.caseData.hints)) this.caseData.hints = [];
        }

        async loadPresetCase(path) {
            try {
                const prefix = window.location.pathname.includes('/editor') ? '../game/' : 'game/';
                const cleanPath = path.replace(/^[./]+/, '').replace(/^game\//, '');
                const url = prefix + cleanPath;
                const resp = await fetch(`${url}?t=${Date.now()}`);
                if (!resp.ok) throw new Error(`HTTP ${resp.status} - File not found at ${url}`);
                const data = await resp.json();
                this.caseData = data;
                this.normalizeCaseData();
                this.renderActiveTab();
                this.renderPreview();
                const select = document.getElementById("preset-case-select");
                if (select) select.value = cleanPath.startsWith('cases/') ? cleanPath : `cases/${cleanPath}`;
                this.showToast(`Loaded case: ${this.caseData.meta?.title || path}`);
            } catch (err) {
                console.error("Could not load preset:", err);
                this.showToast(`Error loading preset: ${err.message}`, "danger");
            }
        }

        exportJSON() {
            this.normalizeCaseData();
            const cleanData = JSON.parse(JSON.stringify(this.caseData));
            delete cleanData.meta.unlocks;
            delete cleanData.meta.unlocksChapter;
            delete cleanData.meta.prerequisites;
            const formatted = JSON.stringify(cleanData, null, 2);
            const blob = new Blob([formatted], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const filename = (this.caseData.id || "case_export") + ".json";
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast(`Exported ${filename}`);
        }

        async saveCurrentCaseToFile() {
            const caseId = (this.caseData?.id || "custom_case").replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
            const filePath = `game/cases/${caseId}.json`;
            const formatted = JSON.stringify(this.caseData, null, 2);

            // Register in localStorage so it persists even in static environments
            try {
                const reg = JSON.parse(localStorage.getItem('logos_case_registry') || '[]');
                const item = {
                    id: caseId,
                    path: `cases/${caseId}.json`,
                    title: this.caseData.meta?.title || caseId
                };
                const idx = reg.findIndex(r => r.id === caseId);
                if (idx >= 0) reg[idx] = item;
                else reg.push(item);
                localStorage.setItem('logos_case_registry', JSON.stringify(reg));
            } catch (e) {}

            // 1. Try local dev server API endpoint
            try {
                const res = await fetch("/api/save-file", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        file: filePath,
                        content: formatted
                    })
                });
                if (res.ok) {
                    this.showToast(`✓ Saved directly to ${filePath}!`);
                    await this.discoverProjectFiles();
                    const select = document.getElementById("preset-case-select");
                    if (select) select.value = `cases/${caseId}.json`;
                    return;
                }
            } catch (err) {}

            // 2. Try File System Access API
            if (window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: `${caseId}.json`,
                        types: [{ description: "JSON Deduction Case", accept: { "application/json": [".json"] } }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(formatted);
                    await writable.close();
                    this.showToast(`✓ Saved ${caseId}.json directly to disk!`);
                    await this.discoverProjectFiles();
                    const select = document.getElementById("preset-case-select");
                    if (select) select.value = `cases/${caseId}.json`;
                    return;
                } catch (err) {
                    if (err.name === "AbortError") return;
                }
            }

            // 3. Fallback: Download file
            this.exportJSON();
        }

        renderActiveTab() {
            const container = document.getElementById("tab-workspace");
            if (!container) return;
            container.innerHTML = "";

            this.updateBadgeCounts();

            switch (this.currentTab) {
                case "metadata":
                    if (typeof this.renderMetadataTab === 'function') this.renderMetadataTab(container);
                    break;
                case "progression":
                    if (typeof this.renderProgressionTab === 'function') this.renderProgressionTab(container);
                    break;
                case "timeline":
                    if (typeof this.renderTimelineTab === 'function') this.renderTimelineTab(container);
                    break;
                case "categories":
                    if (typeof this.renderCategoriesTab === 'function') this.renderCategoriesTab(container);
                    break;
                case "keywords":
                    if (typeof this.renderKeywordsTab === 'function') this.renderKeywordsTab(container);
                    break;
                case "docket":
                    if (typeof this.renderDocketTab === 'function') this.renderDocketTab(container);
                    break;
                case "lore":
                    if (typeof this.renderLoreTab === 'function') this.renderLoreTab(container);
                    break;
                case "hints":
                    if (typeof this.renderHintsTab === 'function') this.renderHintsTab(container);
                    break;
                case "diagnostics":
                    if (typeof this.renderDiagnosticsTab === 'function') this.renderDiagnosticsTab(container);
                    break;
                case "sandbox":
                    if (typeof this.renderSandboxTab === 'function') this.renderSandboxTab(container);
                    break;
            }
        }

        updateBadgeCounts() {
            const progCount = (this.progressionData.rules || []).length;
            const catCount = Object.keys(this.caseData.categories || {}).length;
            const kwCount = Object.keys(this.caseData.keywords || {}).length;
            const loreCount = Object.keys(this.caseData.lore || {}).length;
            const timelineCount = Object.keys(this.caseData.timeline || {}).length;
            const hintCount = (this.caseData.hints || []).length;

            const progBadge = document.getElementById("badge-progression");
            if (progBadge) progBadge.innerText = progCount;

            const catBadge = document.getElementById("badge-categories");
            if (catBadge) catBadge.innerText = catCount;

            const kwBadge = document.getElementById("badge-keywords");
            if (kwBadge) kwBadge.innerText = kwCount;

            const loreBadge = document.getElementById("badge-lore");
            if (loreBadge) loreBadge.innerText = loreCount;

            const tlBadge = document.getElementById("badge-timeline");
            if (tlBadge) tlBadge.innerText = timelineCount;

            const hintBadge = document.getElementById("badge-hints");
            if (hintBadge) hintBadge.innerText = hintCount;
        }
    }

    // Mix in all modular controller extensions into CaseEditor prototype
    Object.assign(
        CaseEditor.prototype,
        global.CaseEditorMetadata || {},
        global.CaseEditorProgression || {},
        global.CaseEditorTimeline || {},
        global.CaseEditorCategories || {},
        global.CaseEditorKeywords || {},
        global.CaseEditorDocket || {},
        global.CaseEditorLore || {},
        global.CaseEditorHints || {},
        global.CaseEditorDiagnostics || {},
        global.CaseEditorSandbox || {},
        global.CaseEditorPreview || {}
    );

    global.CaseEditor = CaseEditor;
    document.addEventListener("DOMContentLoaded", () => {
        window.caseEditor = new CaseEditor();
    });
})(typeof window !== 'undefined' ? window : globalThis);
