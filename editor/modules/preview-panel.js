/**
 * LOGOS-3 CASE AUTHORING TERMINAL - RIGHT SIDE LIVE PREVIEW PANEL
 */
(function (global) {
    'use strict';

    const CaseEditorPreview = {
        renderPreview() {
            const container = document.getElementById("preview-content");
            if (!container) return;

            const m = this.caseData.meta || {};
            const d = this.caseData.docket || { template: "" };

            let parsedTemplate = d.template || "<em>No docket template defined.</em>";
            parsedTemplate = parsedTemplate.replace(/\[slot:([a-zA-Z0-9_-]+)(?::([^\:\]]+))?(?::([^\:\]]+))?(?::([^\:\]]+))?\]/g, `<span class="slot-pill">[ ? : $2 ]</span>`);
            parsedTemplate = parsedTemplate.replace(/\[num:([a-zA-Z0-9_-]+):([0-9]+):([^\]]+)\]/g, `<span class="slot-pill">[ $3 ]</span>`);
            parsedTemplate = parsedTemplate.replace(/\*\*([^\*]+)\*\*/g, `<strong>$1</strong>`);
            parsedTemplate = parsedTemplate.replace(/\n/g, "<br>");

            container.innerHTML = `
                <div style="font-size: 11px; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 1px;">CASE DOCKET PREVIEW</div>
                <div style="font-size: 14px; font-weight: 700; color: var(--accent); margin-bottom: 4px;">${m.title || "UNTITLED CASE"}</div>
                <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 12px;">${m.subtitle || ""}</div>

                <div style="background: var(--bg-tertiary); border: 1px solid var(--border-color); padding: 12px; border-radius: 2px; font-size: 12px; line-height: 1.6;">
                    ${parsedTemplate}
                </div>

                <div style="margin-top: 14px; font-size: 11px; text-transform: uppercase; color: var(--text-tertiary); letter-spacing: 1px;">CASE VOCABULARY (${Object.keys(this.caseData.keywords || {}).length})</div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                    ${Object.keys(this.caseData.keywords || {}).map(k => {
                        const kw = this.caseData.keywords[k];
                        const cats = Array.isArray(kw?.category) ? kw.category : (kw?.category ? [kw.category] : []);
                        const firstCat = cats[0] || "";
                        const catConfig = (this.caseData.categories || {})[firstCat] || {};
                        const hex = catConfig.hex || "var(--accent)";
                        return `<span class="kw-pill" style="border-color: ${hex}66; color: ${hex}; background: ${hex}18;">${kw?.variations?.base || k}</span>`;
                    }).join('') || '<span class="form-help">No keywords defined.</span>'}
                </div>
            `;
        }
    };

    global.CaseEditorPreview = CaseEditorPreview;
})(typeof window !== 'undefined' ? window : globalThis);
