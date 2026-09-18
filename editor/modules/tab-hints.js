/**
 * LOGOS-3 CASE AUTHORING TERMINAL - TAB 8: HINT ADVISORY
 */
(function (global) {
    'use strict';

    const CaseEditorHints = {
        renderHintsTab(container) {
            const hints = this.caseData.hints || [];

            let stagesHtml = "";
            for (let i = 1; i <= 3; i++) {
                const hint = hints.find(h => h.stage === i) || { stage: i, title: `Stage ${i} Guidance`, text: "" };
                stagesHtml += `
                    <div class="form-section">
                        <div class="form-section-title">
                            <span>💡 Stage ${i}: ${i === 1 ? 'Warm Lead' : (i === 2 ? 'Directional Question' : 'Direct Target Clue')}</span>
                        </div>
                        <div class="form-row">
                            <label class="form-label">Hint Header / Title</label>
                            <input type="text" value="${hint.title || ''}" oninput="window.caseEditor.updateHintField(${i}, 'title', this.value)">
                        </div>
                        <div class="form-row">
                            <label class="form-label">Hint Advisory Text</label>
                            <textarea rows="3" oninput="window.caseEditor.updateHintField(${i}, 'text', this.value)">${hint.text || ''}</textarea>
                        </div>
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="form-section">
                    <div class="form-section-title">
                        <span>💡 3-Stage Progressive Hint Advisory</span>
                    </div>
                    <div class="form-help">
                        Progressive hints unlock in 3 tiers when the player asks the advisor for guidance.
                    </div>
                </div>
                ${stagesHtml}
            `;
        },

        updateHintField(stage, field, val) {
            if (!Array.isArray(this.caseData.hints)) this.caseData.hints = [];
            let entry = this.caseData.hints.find(h => h.stage === stage);
            if (!entry) {
                entry = { stage: stage, title: `Stage ${stage}`, text: "" };
                this.caseData.hints.push(entry);
            }
            entry[field] = val;
            this.updateBadgeCounts();
            this.updateDiagnostics();
        }
    };

    global.CaseEditorHints = CaseEditorHints;
})(typeof window !== 'undefined' ? window : globalThis);
