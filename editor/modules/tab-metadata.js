/**
 * LOGOS-3 CASE AUTHORING TERMINAL - TAB 1: METADATA & CASE IDENTITY
 */
(function (global) {
    'use strict';

    const CaseEditorMetadata = {
        renderMetadataTab(container) {
            const m = this.caseData.meta || {};
            const caseId = this.caseData.id || "";

            // Find all incoming and outgoing progression rules for this case
            const cleanCaseId = (caseId || "").replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
            const allRules = this.progressionData?.rules || [];

            const incomingPrereqs = [];
            allRules.forEach(r => {
                const rTarget = (r.target || "").replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                if (rTarget === cleanCaseId) {
                    const reqList = Array.isArray(r.requires) ? r.requires : (r.requires ? [r.requires] : []);
                    reqList.forEach(req => {
                        if (req && req.id && !incomingPrereqs.some(existing => existing.id === req.id)) {
                            incomingPrereqs.push(req);
                        }
                    });
                }
            });

            const outgoingUnlocks = [];
            allRules.forEach(r => {
                const reqList = Array.isArray(r.requires) ? r.requires : (r.requires ? [r.requires] : []);
                const isMatch = reqList.some(req => {
                    if (!req || !req.id) return false;
                    const reqClean = req.id.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                    return reqClean === cleanCaseId;
                });
                if (isMatch && r.target) {
                    const normTarget = r.target.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                    if (!outgoingUnlocks.some(existing => existing.normTarget === normTarget)) {
                        outgoingUnlocks.push({
                            target: r.target,
                            normTarget: normTarget,
                            targetType: r.targetType || (r.target.endsWith('.nwd') ? 'chapter' : 'case'),
                            targetTitle: r.targetTitle || r.target
                        });
                    }
                }
            });

            let incomingHtml = "";
            if (incomingPrereqs.length === 0) {
                incomingHtml = `
                    <div style="font-size: 13px; font-weight: 700; color: var(--accent);">
                        🔓 Always Unlocked (Starter / Prologue)
                    </div>
                    <div style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">
                        No prerequisite cases or novel chapters required to access.
                    </div>
                `;
            } else {
                incomingHtml = `
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                        <span style="font-size: 10px; font-weight: 800; color: var(--accent); background: rgba(229,169,60,0.18); border: 1px solid rgba(229,169,60,0.4); padding: 2px 6px; border-radius: 3px;">
                            ${incomingPrereqs.length > 1 ? `AND LOGIC (${incomingPrereqs.length} PREREQUISITES REQUIRED)` : '1 PREREQUISITE REQUIRED'}
                        </span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${incomingPrereqs.map(req => `
                            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; padding: 8px 10px;">
                                <div style="font-size: 12px; font-weight: 700; color: ${req.type === 'chapter' ? 'var(--success)' : 'var(--accent)'};">
                                    ${req.type === 'chapter' ? '📖' : '🎮'} ${req.title || req.id}
                                </div>
                                <div style="font-size: 11px; color: var(--text-dim); margin-top: 3px;">
                                    ${req.teaser || (req.type === 'chapter' ? 'Read required chapter in Novel Reader.' : 'Solve preceding case in deduction terminal.')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            let outgoingHtml = "";
            if (outgoingUnlocks.length === 0) {
                outgoingHtml = `
                    <div style="font-size: 13px; font-weight: 700; color: var(--text-dim);">
                        🏁 No Downstream Leads Configured
                    </div>
                    <div style="font-size: 11px; color: var(--text-dim); margin-top: 4px;">
                        Solving this case currently does not trigger downstream chapter or case unlocks.
                    </div>
                `;
            } else {
                outgoingHtml = `
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                        <span style="font-size: 10px; font-weight: 800; color: var(--success); background: rgba(34,197,94,0.18); border: 1px solid rgba(34,197,94,0.4); padding: 2px 6px; border-radius: 3px;">
                            ${outgoingUnlocks.length > 1 ? `MULTI-UNLOCK (${outgoingUnlocks.length} LEADS)` : '1 LEAD UNLOCKED'}
                        </span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${outgoingUnlocks.map(out => `
                            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; padding: 8px 10px;">
                                <div style="font-size: 12px; font-weight: 700; color: ${out.targetType === 'chapter' ? 'var(--success)' : 'var(--accent)'};">
                                    ${out.targetType === 'chapter' ? '📖' : '🎮'} ${out.targetTitle || out.target}
                                </div>
                                <div style="font-size: 11px; color: var(--text-dim); margin-top: 3px;">
                                    ${out.targetType === 'chapter' ? 'Unlocks Novel Chapter in Reader upon victory.' : 'Unlocks Investigation Case in Terminal upon victory.'}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            }

            container.innerHTML = `
                <div class="form-section">
                    <div class="form-section-title">
                        <span>⚙️ Case Identification & Docket Header</span>
                    </div>
                    <div class="form-row-horizontal">
                        <div class="form-row">
                            <label class="form-label">Case ID (Slug)</label>
                            <input type="text" id="meta-id" value="${this.caseData.id || ''}" placeholder="e.g. chapter_01_morning_routine">
                            <span class="form-help">Unique filename identifier for saving & progress storage.</span>
                        </div>
                        <div class="form-row">
                            <label class="form-label">Version</label>
                            <input type="text" id="meta-version" value="${m.version || '1.0'}" placeholder="1.0">
                        </div>
                    </div>
                    <div class="form-row">
                        <label class="form-label">Case Title</label>
                        <input type="text" id="meta-title" value="${m.title || ''}" placeholder="CASE 1: MORNING ROUTINE">
                    </div>
                    <div class="form-row">
                        <label class="form-label">Case Subtitle / Location</label>
                        <input type="text" id="meta-subtitle" value="${m.subtitle || ''}" placeholder="Pogranichny District // 14 June 2026">
                    </div>
                    <div class="form-row">
                        <label class="form-label">Docket Window Title</label>
                        <input type="text" id="meta-docket-title" value="${m.docketTitle || ''}" placeholder="📋 OFFICIAL INVESTIGATION DOCKET">
                    </div>
                    <div class="form-row">
                        <label class="form-label">Author / Creator</label>
                        <input type="text" id="meta-author" value="${m.author || ''}" placeholder="Your Name / Department">
                    </div>
                    <div class="form-row">
                        <label class="form-label">Deduction Success Message</label>
                        <input type="text" id="meta-success" value="${m.successMessage || ''}" placeholder="☭ DEDUCTION VERIFIED! Case Solved!">
                        <span class="form-help">Celebratory Soviet victory message displayed upon full docket completion.</span>
                    </div>
                </div>

                <!-- Story Progression Summary Card -->
                <div class="form-section">
                    <div class="form-section-title">
                        <span>🗺️ Campaign Progression & Prerequisites</span>
                        <button class="btn btn-sm btn-primary" onclick="window.caseEditor.switchTab('progression')">🗺️ Open Progression Graph ➔</button>
                    </div>
                    <div class="form-help" style="margin-bottom: 12px;">
                        Prerequisites, multiple unlock leads, and chapter gates are centrally managed in the visual <strong>Progression Graph</strong> tab.
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 8px;">
                        <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); border-radius: 4px; padding: 14px;">
                            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-dim); font-weight: 700; margin-bottom: 6px;">🔒 Access Prerequisites (Incoming)</div>
                            ${incomingHtml}
                        </div>

                        <div style="background: rgba(0,0,0,0.25); border: 1px solid var(--border-color); border-radius: 4px; padding: 14px;">
                            <div style="font-size: 11px; text-transform: uppercase; color: var(--text-dim); font-weight: 700; margin-bottom: 6px;">🔓 Unlocks on Case Solved (Outgoing)</div>
                            ${outgoingHtml}
                        </div>
                    </div>
                </div>
            `;

            // Bind input handlers
            const idInput = document.getElementById("meta-id");
            if (idInput) idInput.oninput = (e) => { this.caseData.id = e.target.value.trim(); this.renderPreview(); };
            const verInput = document.getElementById("meta-version");
            if (verInput) verInput.oninput = (e) => { this.caseData.meta.version = e.target.value.trim(); };
            const titleInput = document.getElementById("meta-title");
            if (titleInput) titleInput.oninput = (e) => { this.caseData.meta.title = e.target.value; this.renderPreview(); };
            const subInput = document.getElementById("meta-subtitle");
            if (subInput) subInput.oninput = (e) => { this.caseData.meta.subtitle = e.target.value; this.renderPreview(); };
            const docketInput = document.getElementById("meta-docket-title");
            if (docketInput) docketInput.oninput = (e) => { this.caseData.meta.docketTitle = e.target.value; };
            const authorInput = document.getElementById("meta-author");
            if (authorInput) authorInput.oninput = (e) => { this.caseData.meta.author = e.target.value; };
            const succInput = document.getElementById("meta-success");
            if (succInput) succInput.oninput = (e) => { this.caseData.meta.successMessage = e.target.value; };
        }
    };

    global.CaseEditorMetadata = CaseEditorMetadata;
})(typeof window !== 'undefined' ? window : globalThis);
