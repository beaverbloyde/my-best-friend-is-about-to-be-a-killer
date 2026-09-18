/**
 * LOGOS-3 CASE AUTHORING TERMINAL - TAB 9: DIAGNOSTICS & INTEGRITY AUDIT
 */
(function (global) {
    'use strict';

    const CaseEditorDiagnostics = {
        renderDiagnosticsTab(container) {
            const issues = this.runDiagnostics();

            let itemsHtml = "";
            issues.forEach(iss => {
                itemsHtml += `
                    <div class="diagnostic-item ${iss.pass ? 'pass' : 'fail'}">
                        <span class="diagnostic-status-icon">${iss.pass ? '✅' : '❌'}</span>
                        <div style="flex: 1;">
                            <strong>${iss.title}</strong>
                            <div class="form-help">${iss.message}</div>
                        </div>
                    </div>
                `;
            });

            container.innerHTML = `
                <div class="form-section">
                    <div class="form-section-title">
                        <span>🩺 Case Integrity Diagnostics</span>
                        <button class="btn btn-sm btn-primary" onclick="window.caseEditor.renderDiagnosticsTab(document.getElementById('tab-workspace'))">🔄 Re-Run Scan</button>
                    </div>
                    <div class="form-help">
                        Real-time audit checking for missing solutions, category mismatches, or malformed tags.
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        ${itemsHtml}
                    </div>
                </div>
            `;
        },

        runDiagnostics() {
            const results = [];
            const docket = this.caseData.docket || { template: "" };
            const solution = this.caseData.solution || {};
            const keywords = this.caseData.keywords || {};
            const categories = this.caseData.categories || window.CaseEditorConstants?.DEFAULT_CATEGORIES || {};

            // 1. Check template slots vs solutions
            const wordSlotRegex = /\[slot:([a-zA-Z0-9_-]+)/g;
            const numSlotRegex = /\[num:([a-zA-Z0-9_-]+)/g;

            const allSlotIds = [];
            let m;
            while ((m = wordSlotRegex.exec(docket.template || '')) !== null) allSlotIds.push(m[1]);
            while ((m = numSlotRegex.exec(docket.template || '')) !== null) allSlotIds.push(m[1]);

            const missingSolutions = allSlotIds.filter(id => !solution[id] || (Array.isArray(solution[id]) && solution[id].length === 0));
            results.push({
                title: "Docket Slot Solutions",
                pass: missingSolutions.length === 0,
                message: missingSolutions.length === 0 
                    ? `All ${allSlotIds.length} slots have defined target solutions.`
                    : `Missing solution for slots: ${missingSolutions.join(', ')}`
            });

            // 2. Check solution keywords exist in vocabulary
            const missingKw = [];
            for (let [slotId, ans] of Object.entries(solution)) {
                const ansList = Array.isArray(ans) ? ans : (ans ? [ans] : []);
                for (const a of ansList) {
                    if (typeof a === "string" && isNaN(a) && !keywords[a]) {
                        missingKw.push(`${slotId} -> "${a}"`);
                    }
                }
            }
            results.push({
                title: "Solution Keywords Registry",
                pass: missingKw.length === 0,
                message: missingKw.length === 0
                    ? "All assigned solution words exist in the keyword registry."
                    : `Solution keywords missing from dictionary: ${missingKw.join(', ')}`
            });

            // 3. Timeline Clues & Evidence Tags
            const timeline = this.caseData.timeline || {};
            const momentKeys = Object.keys(timeline);
            const missingClueTags = [];
            let totalCluesCount = 0;

            const extractTags = (text) => {
                if (!text) return [];
                const bracketMatches = String(text).match(/\[(?!br\b|vspace\b|field:|footnote:|img:|b\b|\/b\b|i\b|\/i\b|slot:|num:)([^\]]+)\]/g) || [];
                return bracketMatches.map(matchStr => matchStr.replace(/^\[+/, '').replace(/\]+$/, '').trim().split(':')[0].trim().toLowerCase());
            };

            const scanForTags = (obj) => {
                if (!obj) return [];
                let tags = [];
                if (typeof obj === 'string') {
                    tags.push(...extractTags(obj));
                } else if (Array.isArray(obj)) {
                    obj.forEach(item => tags.push(...scanForTags(item)));
                } else if (typeof obj === 'object') {
                    for (const k in obj) {
                        tags.push(...scanForTags(obj[k]));
                    }
                }
                return tags;
            };

            momentKeys.forEach(mk => {
                const moment = timeline[mk];
                const clues = moment.clues || [];
                totalCluesCount += clues.length;
                clues.forEach(c => {
                    const foundTags = scanForTags(c);
                    foundTags.forEach(tag => {
                        if (tag && !keywords[tag] && !missingClueTags.includes(tag)) {
                            missingClueTags.push(tag);
                        }
                    });
                });
            });

            results.push({
                title: "Timeline Clues & Keyword Tags",
                pass: momentKeys.length > 0 && missingClueTags.length === 0,
                message: momentKeys.length === 0
                    ? "No timeline periods defined."
                    : (missingClueTags.length === 0
                        ? `Contains ${momentKeys.length} periods with ${totalCluesCount} clues. All bracket keywords exist in dictionary.`
                        : `Clues contain bracket tags missing from dictionary: [${missingClueTags.join('], [')}]`)
            });

            // 4. Lore Codex Archives & Triggers
            const lore = this.caseData.lore || {};
            const loreKeys = Object.keys(lore);
            const missingLoreTriggers = [];
            loreKeys.forEach(lk => {
                const entry = lore[lk];
                const reqWords = entry.requiredWords || [lk];
                reqWords.forEach(rw => {
                    const cleanRw = rw.toLowerCase().trim();
                    if (cleanRw && !keywords[cleanRw] && !missingLoreTriggers.includes(`${entry.title || lk} -> "${cleanRw}"`)) {
                        missingLoreTriggers.push(`${entry.title || lk} -> "${cleanRw}"`);
                    }
                });
            });

            results.push({
                title: "Lore Codex Archives & Triggers",
                pass: missingLoreTriggers.length === 0,
                message: missingLoreTriggers.length === 0
                    ? `${loreKeys.length} encrypted dossiers registered. All trigger keywords exist in dictionary.`
                    : `Dossiers require trigger keywords missing from dictionary: ${missingLoreTriggers.join(', ')}`
            });

            // 5. Hint Advisory 3-Stage Progressions
            const hints = Array.isArray(this.caseData.hints) ? this.caseData.hints : [];
            const incompleteHints = [];
            for (let i = 1; i <= 3; i++) {
                const h = hints.find(entry => entry.stage === i);
                if (!h || !h.text || !h.text.trim()) {
                    incompleteHints.push(`Stage ${i}`);
                }
            }
            results.push({
                title: "Progressive Hint Advisory",
                pass: incompleteHints.length === 0,
                message: incompleteHints.length === 0
                    ? "All 3 advisory hint stages (Warm Lead, Directional, Target Clue) are configured."
                    : `Incomplete advisory guidance for: ${incompleteHints.join(', ')}`
            });

            // 6. Category Assignment Palette Audit
            const invalidCategories = [];
            for (const [kwId, kwObj] of Object.entries(keywords)) {
                const catList = Array.isArray(kwObj.category) ? kwObj.category : (kwObj.category ? [kwObj.category] : []);
                if (catList.length === 0) {
                    invalidCategories.push(`${kwId} (No category assigned)`);
                } else {
                    catList.forEach(cat => {
                        if (!categories[cat] && !invalidCategories.includes(`${kwId} -> "${cat}"`)) {
                            invalidCategories.push(`${kwId} -> "${cat}"`);
                        }
                    });
                }
            }
            results.push({
                title: "Keyword Category Palette Audit",
                pass: invalidCategories.length === 0,
                message: invalidCategories.length === 0
                    ? `All ${Object.keys(keywords).length} vocabulary keywords have valid assigned categories.`
                    : `Keywords with unmapped categories: ${invalidCategories.slice(0, 5).join(', ')}${invalidCategories.length > 5 ? ` (+${invalidCategories.length - 5} more)` : ''}`
            });

            // 7. Progression Graph Circular Dependency & Deadlock Audit
            const progCycles = (typeof this.detectProgressionCycles === 'function') ? this.detectProgressionCycles() : [];
            results.push({
                title: "Progression Graph Cycle / Deadlock Audit",
                pass: progCycles.length === 0,
                message: progCycles.length === 0
                    ? "Progression graph is a valid Directed Acyclic Graph (DAG). No circular deadlocks found."
                    : `Circular dependency loop detected: ${progCycles.map(c => c.join(" ➔ ")).join("; ")}`
            });

            return results;
        },

        updateDiagnostics() {
            this.updateBadgeCounts();
        }
    };

    global.CaseEditorDiagnostics = CaseEditorDiagnostics;
})(typeof window !== 'undefined' ? window : globalThis);
