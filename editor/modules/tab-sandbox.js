/**
 * LOGOS-3 CASE AUTHORING TERMINAL - TAB 10: PLAYTEST SANDBOX
 */
(function (global) {
    'use strict';

    const CaseEditorSandbox = {
        renderSandboxTab(container) {
            container.innerHTML = `
                <div class="form-section" style="flex: 1; min-height: 500px;">
                    <div class="form-section-title">
                        <span>🎮 Live Playtest Sandbox</span>
                        <button class="btn btn-sm btn-primary" onclick="window.caseEditor.reloadSandbox()">🔄 Reset Sandbox</button>
                    </div>
                    <div style="flex: 1; border: 1px solid var(--border-color); background: var(--bg-primary); border-radius: 2px; overflow: hidden; height: 500px;">
                        <iframe id="sandbox-iframe" src="../game/index.html?sandbox=1" style="width: 100%; height: 100%; border: none;"></iframe>
                    </div>
                </div>
            `;
            setTimeout(() => this.reloadSandbox(), 500);
        },

        reloadSandbox() {
            const iframe = document.getElementById("sandbox-iframe");
            if (!iframe || !iframe.contentWindow) return;
            try {
                if (iframe.contentWindow.gameEngine) {
                    iframe.contentWindow.gameEngine.loadCase(this.caseData, false);
                    this.showToast("Loaded current case into sandbox!");
                }
            } catch (e) {}
        }
    };

    global.CaseEditorSandbox = CaseEditorSandbox;
})(typeof window !== 'undefined' ? window : globalThis);
