/**
 * LOGOS-3 CASE AUTHORING TERMINAL - TAB 3: TIMELINE & CLUES
 */
(function (global) {
    'use strict';

    const CaseEditorTimeline = {
        renderTimelineTab(container) {
            const timeline = this.caseData.timeline || {};
            const keys = Object.keys(timeline);

            let momentsHtml = "";
            keys.forEach(k => {
                const m = timeline[k];
                const isSelected = k === this.activeTimelineKey;
                const label = m.time || m.title || k;
                momentsHtml += `
                    <button class="btn btn-sm ${isSelected ? 'btn-primary' : ''}" onclick="window.caseEditor.selectTimelineMoment('${k}')">
                        ${m.isVision ? '🌀 ' : '🕒 '}${label} (${(m.clues || []).length})
                    </button>
                `;
            });

            container.innerHTML = `
                <datalist id="evidence-type-suggestions">
                    <option value="Physical Evidence">
                    <option value="Observation">
                    <option value="Subject">
                    <option value="Forensic">
                    <option value="Prescription">
                    <option value="Public Notice">
                    <option value="Document">
                    <option value="E-Paper Display">
                    <option value="Signpost">
                    <option value="Item">
                    <option value="Memory Fragment">
                    <option value="Broadcast Excerpt">
                    <option value="Economic Column">
                    <option value="Radio Commentary">
                    <option value="State Address">
                    <option value="Public Feed">
                    <option value="Biographical Archive">
                    <option value="Police Bulletin">
                </datalist>

                <div class="form-section">
                    <div class="form-section-title">
                        <span>🕒 Timeline Periods / Moments</span>
                        <button class="btn btn-sm btn-primary" onclick="window.caseEditor.addTimelineMoment()">+ Add Timeline Moment</button>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                        ${momentsHtml || '<span class="form-help">No timeline periods yet. Click above to add one.</span>'}
                    </div>
                </div>

                <div id="moment-detail-area"></div>
            `;

            this.renderActiveMomentDetail();
        },

        selectTimelineMoment(key) {
            this.activeTimelineKey = key;
            this.renderActiveTab();
            this.renderPreview();
        },

        addTimelineMoment() {
            const timeKey = prompt("Enter moment timestamp / key (e.g. 08:15, 14:00, Vision, Memory):", "12:00");
            if (!timeKey) return;
            const cleanKey = timeKey.trim();
            if (this.caseData.timeline[cleanKey]) {
                alert("A timeline period with this key already exists.");
                return;
            }
            this.caseData.timeline[cleanKey] = {
                time: cleanKey,
                title: cleanKey,
                location: "Location",
                isVision: false,
                clues: []
            };
            this.activeTimelineKey = cleanKey;
            this.renderActiveTab();
            this.renderPreview();
            this.showToast(`Added timeline period: ${cleanKey}`);
        },

        renameTimelineKey(oldKey, newKey) {
            if (!oldKey || !newKey || oldKey === newKey) return;
            const timeline = this.caseData.timeline || {};
            if (!timeline[oldKey]) return;

            if (timeline[newKey] && newKey !== oldKey) {
                alert(`A timeline period with key "${newKey}" already exists.`);
                return;
            }

            const newTimeline = {};
            for (const k of Object.keys(timeline)) {
                if (k === oldKey) {
                    newTimeline[newKey] = timeline[oldKey];
                    newTimeline[newKey].time = newKey;
                } else {
                    newTimeline[k] = timeline[k];
                }
            }
            this.caseData.timeline = newTimeline;
            this.activeTimelineKey = newKey;
            this.renderActiveTab();
            this.renderPreview();
            this.showToast(`Renamed period key to: ${newKey}`);
        },

        deleteActiveMoment() {
            if (!this.activeTimelineKey || !this.caseData.timeline[this.activeTimelineKey]) return;
            if (confirm(`Delete timeline period "${this.activeTimelineKey}" and all its clues?`)) {
                delete this.caseData.timeline[this.activeTimelineKey];
                const remaining = Object.keys(this.caseData.timeline);
                this.activeTimelineKey = remaining.length > 0 ? remaining[0] : null;
                this.renderActiveTab();
                this.renderPreview();
                this.showToast("Deleted timeline period.");
            }
        },

        renderActiveMomentDetail() {
            const container = document.getElementById("moment-detail-area");
            if (!container) return;
            if (!this.activeTimelineKey || !this.caseData.timeline[this.activeTimelineKey]) {
                container.innerHTML = `<div class="form-section"><div class="form-help">Select a timeline period above to edit its clues.</div></div>`;
                return;
            }

            const m = this.caseData.timeline[this.activeTimelineKey];
            const clues = m.clues || [];

            let cluesHtml = "";
            clues.forEach((clue, idx) => {
                cluesHtml += this.renderClueCard(clue, idx);
            });

            container.innerHTML = `
                <div class="form-section">
                    <div class="form-section-title">
                        <span>Editing Moment: ${m.time || m.title || this.activeTimelineKey}</span>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-sm btn-danger" onclick="window.caseEditor.deleteActiveMoment()">🗑️ Delete Period</button>
                            <button class="btn btn-sm btn-primary" onclick="window.caseEditor.addClueToActiveMoment()">+ Add Clue</button>
                        </div>
                    </div>
                    <div class="form-row-horizontal">
                        <div class="form-row" style="flex: 1;">
                            <label class="form-label">Timestamp / Key (Timeline Button Label)</label>
                            <input type="text" id="moment-time-key" value="${m.time || this.activeTimelineKey || ''}" placeholder="e.g. 07:02, Vision, Memory">
                        </div>
                        <div class="form-row" style="flex: 1.5;">
                            <label class="form-label">Scene Header Title</label>
                            <input type="text" id="moment-title" value="${m.title || ''}" placeholder="e.g. 07:02 (Bedroom), Vision Boundary">
                        </div>
                        <div class="form-row" style="flex: 1.2;">
                            <label class="form-label">Location Tag</label>
                            <input type="text" id="moment-loc" value="${m.location || ''}" placeholder="e.g. Bedroom, Outside, Vision Boundary">
                        </div>
                    </div>
                    <div class="form-row">
                        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                            <input type="checkbox" id="moment-vision" ${m.isVision ? 'checked' : ''}>
                            <span>🌀 Is Vision / Premonition Recollection (Applies ripple visual styling)</span>
                        </label>
                    </div>
                </div>

                <div class="form-section">
                    <div class="form-section-title">
                        <span>Clues & Evidence (${clues.length})</span>
                    </div>
                    <div class="clue-list">
                        ${cluesHtml || '<div class="form-help">No clues in this period. Click "+ Add Clue" above.</div>'}
                    </div>
                </div>
            `;

            const timeKeyInput = document.getElementById("moment-time-key");
            if (timeKeyInput) {
                timeKeyInput.onchange = (e) => {
                    const val = e.target.value.trim();
                    if (!val) return;
                    m.time = val;
                    if (val !== this.activeTimelineKey) {
                        this.renameTimelineKey(this.activeTimelineKey, val);
                    } else {
                        this.renderPreview();
                    }
                };
            }

            const titleInput = document.getElementById("moment-title");
            if (titleInput) titleInput.oninput = (e) => { m.title = e.target.value; this.renderPreview(); };
            const locInput = document.getElementById("moment-loc");
            if (locInput) locInput.oninput = (e) => { m.location = e.target.value; this.renderPreview(); };
            const visInput = document.getElementById("moment-vision");
            if (visInput) visInput.onchange = (e) => { m.isVision = e.target.checked; this.renderPreview(); };
        },

        getClueWidgetType(clue) {
            if (!clue) return "text";
            const registry = window.CaseEditorConstants?.WIDGET_REGISTRY || [];
            const reg = registry.find(w => w.match(clue));
            return reg ? reg.id : "text";
        },

        renderClueCard(clue, idx) {
            const currentWidgetType = this.getClueWidgetType(clue);
            const registry = window.CaseEditorConstants?.WIDGET_REGISTRY || [];
            const reg = registry.find(w => w.id === currentWidgetType) || registry[0] || { badge: "Evidence" };
            const badgeLabel = reg.badge || "Evidence";

            const optionsHtml = registry.map(w => 
                `<option value="${w.id}" ${currentWidgetType === w.id ? 'selected' : ''}>${w.label}</option>`
            ).join("");

            return `
                <div class="clue-item-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="clue-type-badge">${badgeLabel}</span>
                            <strong>#${idx + 1}: ${clue.title || "Untitled Clue"}</strong>
                        </div>
                        <div style="display: flex; gap: 4px;">
                            <button class="btn btn-sm btn-danger" onclick="window.caseEditor.deleteClue(${idx})">🗑️ Delete</button>
                        </div>
                    </div>
                    
                    <div class="form-row-horizontal">
                        <div class="form-row" style="flex: 1;">
                            <label class="form-label">Widget Type</label>
                            <select onchange="window.caseEditor.changeClueType(${idx}, this.value)">
                                ${optionsHtml}
                            </select>
                        </div>
                        <div class="form-row" style="flex: 1;">
                            <label class="form-label">Badge / Evidence Category</label>
                            <input type="text" list="evidence-type-suggestions" value="${clue.type || 'Physical Evidence'}" oninput="window.caseEditor.updateClueField(${idx}, 'type', this.value)" placeholder="e.g. Physical Evidence, Observation, Subject...">
                        </div>
                        <div class="form-row" style="flex: 1.5;">
                            <label class="form-label">Title / Header</label>
                            <input type="text" value="${clue.title || ''}" oninput="window.caseEditor.updateClueField(${idx}, 'title', this.value)" placeholder="e.g. Headstone, Framed Photo...">
                        </div>
                    </div>

                    ${this.renderClueTypeSpecificEditor(clue, idx)}
                </div>
            `;
        },

        renderClueTypeSpecificEditor(clue, idx) {
            // 1. Mobile Phone / Lockscreen
            if (clue.phone) {
                const p = clue.phone;
                if (!p.messages) p.messages = [];

                let messagesHtml = "";
                p.messages.forEach((msg, mIdx) => {
                    messagesHtml += `
                        <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; padding: 10px; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <strong style="color: var(--accent); font-size: 11px;">💬 Message #${mIdx + 1}</strong>
                                <button class="btn btn-sm btn-danger" onclick="window.caseEditor.deletePhoneMessage(${idx}, ${mIdx})">🗑️ Remove</button>
                            </div>
                            <div class="form-row-horizontal" style="margin-bottom: 6px;">
                                <div class="form-row">
                                    <label class="form-label">Sender Name</label>
                                    <input type="text" value="${msg.sender || ''}" oninput="window.caseEditor.updatePhoneMessageField(${idx}, ${mIdx}, 'sender', this.value)" placeholder="e.g. Alex, [mom:upper]">
                                </div>
                                <div class="form-row">
                                    <label class="form-label">App / Notification Header</label>
                                    <input type="text" value="${msg.app || 'MESSAGING APP'}" oninput="window.caseEditor.updatePhoneMessageField(${idx}, ${mIdx}, 'app', this.value)" placeholder="e.g. MESSAGING APP">
                                </div>
                                <div class="form-row">
                                    <label class="form-label">Message Time</label>
                                    <input type="text" value="${msg.time || ''}" oninput="window.caseEditor.updatePhoneMessageField(${idx}, ${mIdx}, 'time', this.value)" placeholder="e.g. 07:22">
                                </div>
                            </div>
                            <div class="form-row">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <label class="form-label" style="margin: 0;">Message Body (Use [Keyword] tags)</label>
                                    <button type="button" class="btn btn-sm btn-primary" style="padding: 1px 6px; font-size: 10px;" onclick="window.caseEditor.openInsertKeywordModal('phone-msg-${idx}-${mIdx}')">+ Insert Keyword</button>
                                </div>
                                <textarea id="phone-msg-${idx}-${mIdx}" rows="2" oninput="window.caseEditor.updatePhoneMessageField(${idx}, ${mIdx}, 'text', this.value)" placeholder="e.g. Hey bro, wanna go out for a [drink] tonight?">${msg.text || ''}</textarea>
                            </div>
                        </div>
                    `;
                });

                const hasNav = !!p.nav;
                const n = p.nav || {};

                return `
                    <!-- Lockscreen & Status Bar -->
                    <div style="background: rgba(255, 176, 0, 0.04); border: 1px solid var(--border-color); border-radius: 4px; padding: 10px; margin-bottom: 12px;">
                        <div style="font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 8px;">
                            📱 Lockscreen & Status Bar Settings
                        </div>
                        <div class="form-row-horizontal">
                            <div class="form-row">
                                <label class="form-label">Carrier / Network</label>
                                <input type="text" value="${p.network || '☭ SOV-NET // ROAMING'}" oninput="window.caseEditor.updatePhoneField(${idx}, 'network', this.value)" placeholder="e.g. ☭ SOV-NET // ROAMING">
                            </div>
                            <div class="form-row">
                                <label class="form-label">Battery Level</label>
                                <input type="text" value="${p.battery || '100%'}" oninput="window.caseEditor.updatePhoneField(${idx}, 'battery', this.value)" placeholder="e.g. 88%">
                            </div>
                            <div class="form-row">
                                <label class="form-label">Lockscreen Clock</label>
                                <input type="text" value="${p.time || '07:25'}" oninput="window.caseEditor.updatePhoneField(${idx}, 'time', this.value)" placeholder="e.g. 07:25">
                            </div>
                            <div class="form-row">
                                <label class="form-label">Lockscreen Date</label>
                                <input type="text" value="${p.date || ''}" oninput="window.caseEditor.updatePhoneField(${idx}, 'date', this.value)" placeholder="e.g. 14th [april]">
                            </div>
                        </div>
                    </div>

                    <!-- Turn-by-Turn Navigation Banner -->
                    <div style="background: rgba(56, 189, 248, 0.04); border: 1px solid var(--border-color); border-radius: 4px; padding: 10px; margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 11px; font-weight: 700; color: var(--info); text-transform: uppercase;">
                                <input type="checkbox" ${hasNav ? 'checked' : ''} onchange="window.caseEditor.togglePhoneNav(${idx}, this.checked)">
                                <span>🗺️ Include Turn-by-Turn Navigation HUD</span>
                            </label>
                        </div>
                        ${hasNav ? `
                            <div class="form-row-horizontal" style="margin-bottom: 6px;">
                                <div class="form-row" style="flex: 0.8;">
                                    <label class="form-label">Direction Arrow</label>
                                    <select onchange="window.caseEditor.updatePhoneNavField(${idx}, 'arrow', this.value)">
                                        <option value="↱" ${n.arrow === '↱' ? 'selected' : ''}>↱ Turn Right</option>
                                        <option value="↰" ${n.arrow === '↰' ? 'selected' : ''}>↰ Turn Left</option>
                                        <option value="↑" ${n.arrow === '↑' ? 'selected' : ''}>↑ Straight Ahead</option>
                                        <option value="↶" ${n.arrow === '↶' ? 'selected' : ''}>↶ U-Turn</option>
                                        <option value="→" ${n.arrow === '→' ? 'selected' : ''}>→ Sharp Right</option>
                                        <option value="←" ${n.arrow === '←' ? 'selected' : ''}>← Sharp Left</option>
                                    </select>
                                </div>
                                <div class="form-row" style="flex: 1.5;">
                                    <label class="form-label">HUD Subtitle</label>
                                    <input type="text" value="${n.subtitle || ''}" oninput="window.caseEditor.updatePhoneNavField(${idx}, 'subtitle', this.value)" placeholder="e.g. GLONASS ACTIVE GUIDANCE (350m)">
                                </div>
                            </div>
                            <div class="form-row-horizontal">
                                <div class="form-row">
                                    <label class="form-label">Instruction / Next Turn</label>
                                    <input type="text" value="${n.instruction || n.nextTurn || ''}" oninput="window.caseEditor.updatePhoneNavField(${idx}, 'instruction', this.value)" placeholder="e.g. Turn right at the next crossroad">
                                </div>
                                <div class="form-row">
                                    <label class="form-label">Destination Tag</label>
                                    <input type="text" value="${n.destination || ''}" oninput="window.caseEditor.updatePhoneNavField(${idx}, 'destination', this.value)" placeholder="e.g. Destination: 1.6 km from [rovd]">
                                </div>
                            </div>
                        ` : `<div class="form-help">No navigation HUD banner attached. Check the box above to enable route guidance.</div>`}
                    </div>

                    <!-- Notification & Chat Messages Stack -->
                    <div style="border: 1px solid var(--border-color); border-radius: 4px; padding: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div style="font-size: 11px; font-weight: 700; color: var(--text-primary); text-transform: uppercase;">
                                💬 Messages & Notifications (${p.messages.length})
                            </div>
                            <button class="btn btn-sm btn-primary" onclick="window.caseEditor.addPhoneMessage(${idx})">+ Add Message</button>
                        </div>
                        ${messagesHtml || '<div class="form-help">No messages on this device. Click "+ Add Message" to add one.</div>'}
                    </div>
                `;
            }

            // 2. Telemetry Clock
            if (clue.clock) {
                const c = clue.clock;
                return `
                    <div style="background: rgba(255, 176, 0, 0.04); border: 1px solid var(--border-color); border-radius: 4px; padding: 10px;">
                        <div style="font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 8px;">
                            ⏰ Clock & Telemetry Settings
                        </div>
                        <div class="form-row-horizontal" style="margin-bottom: 6px;">
                            <div class="form-row" style="flex: 1.5;">
                                <label class="form-label">Device / Clock Title</label>
                                <input type="text" value="${c.title || 'BEDSIDE TELEMETRY'}" oninput="window.caseEditor.updateClockField(${idx}, 'title', this.value)" placeholder="e.g. BEDSIDE TELEMETRY">
                            </div>
                            <div class="form-row" style="flex: 1;">
                                <label class="form-label">Display Time</label>
                                <input type="text" value="${c.time || '07:02'}" oninput="window.caseEditor.updateClockField(${idx}, 'time', this.value)" placeholder="e.g. 07:02">
                            </div>
                        </div>
                        <div class="form-row-horizontal">
                            <div class="form-row">
                                <label class="form-label">Temperature Tag</label>
                                <input type="text" value="${c.temperature || '24°C'}" oninput="window.caseEditor.updateClockField(${idx}, 'temperature', this.value)" placeholder="e.g. 24°C">
                            </div>
                            <div class="form-row">
                                <label class="form-label">Calendar / Date Tag</label>
                                <input type="text" value="${c.date || ''}" oninput="window.caseEditor.updateClockField(${idx}, 'date', this.value)" placeholder="e.g. [thursday] or 14 [april]">
                            </div>
                        </div>
                    </div>
                `;
            }

            // 3. Audio Log / Wiretap
            if (clue.audio) {
                const a = clue.audio;
                if (!a.lines) a.lines = [];

                let linesHtml = "";
                a.lines.forEach((line, lIdx) => {
                    linesHtml += `
                        <div style="background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 4px; padding: 10px; margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <strong style="color: var(--accent); font-size: 11px;">🎙️ Line #${lIdx + 1}</strong>
                                <button class="btn btn-sm btn-danger" onclick="window.caseEditor.deleteAudioLine(${idx}, ${lIdx})">🗑️ Remove</button>
                            </div>
                            <div class="form-row-horizontal" style="margin-bottom: 6px;">
                                <div class="form-row" style="flex: 1.5;">
                                    <label class="form-label">Speaker Name / Role</label>
                                    <input type="text" value="${line.speaker || ''}" oninput="window.caseEditor.updateAudioLineField(${idx}, ${lIdx}, 'speaker', this.value)" placeholder="e.g. Voicemail Greeting, Young Man, [professor:upper] [stanislav_krotov]">
                                </div>
                                <div class="form-row" style="flex: 1;">
                                    <label class="form-label">Speaker Style</label>
                                    <select onchange="window.caseEditor.updateAudioLineField(${idx}, ${lIdx}, 'type', this.value)">
                                        <option value="user" ${line.type === 'user' || !line.type ? 'selected' : ''}>👤 User / Character (Active)</option>
                                        <option value="system" ${line.type === 'system' ? 'selected' : ''}>🤖 Automated / System Announcement</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-row">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <label class="form-label" style="margin: 0;">Transcript Statement (Use [Keyword] tags)</label>
                                    <button type="button" class="btn btn-sm btn-primary" style="padding: 1px 6px; font-size: 10px;" onclick="window.caseEditor.openInsertKeywordModal('audio-line-${idx}-${lIdx}')">+ Insert Keyword</button>
                                </div>
                                <textarea id="audio-line-${idx}-${lIdx}" rows="2" oninput="window.caseEditor.updateAudioLineField(${idx}, ${lIdx}, 'text', this.value)" placeholder="e.g. I need to [call] in sick today...">${line.text || ''}</textarea>
                            </div>
                        </div>
                    `;
                });

                return `
                    <!-- Tape / Player Telemetry -->
                    <div style="background: rgba(255, 176, 0, 0.04); border: 1px solid var(--border-color); border-radius: 4px; padding: 10px; margin-bottom: 12px;">
                        <div style="font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 8px;">
                            📼 Audio Wiretap & Player Settings
                        </div>
                        <div class="form-row-horizontal">
                            <div class="form-row" style="flex: 2;">
                                <label class="form-label">Recording / Wiretap Header Label</label>
                                <input type="text" value="${a.label || '⏺ COMM-REC // OUTGOING VOICEMAIL'}" oninput="window.caseEditor.updateAudioField(${idx}, 'label', this.value)" placeholder="e.g. ⏺ COMM-REC // OUTGOING VOICEMAIL">
                            </div>
                            <div class="form-row" style="flex: 1;">
                                <label class="form-label">Duration / Timestamp</label>
                                <input type="text" value="${a.time || '00:00 / 00:45'}" oninput="window.caseEditor.updateAudioField(${idx}, 'time', this.value)" placeholder="e.g. 00:00 / 00:45">
                            </div>
                        </div>
                    </div>

                    <!-- Audio Transcript Dialogue Lines -->
                    <div style="border: 1px solid var(--border-color); border-radius: 4px; padding: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div style="font-size: 11px; font-weight: 700; color: var(--text-primary); text-transform: uppercase;">
                                🎙️ Audio Transcript Lines (${a.lines.length})
                            </div>
                            <button class="btn btn-sm btn-primary" onclick="window.caseEditor.addAudioLine(${idx})">+ Add Audio Line</button>
                        </div>
                        ${linesHtml || '<div class="form-help">No audio transcript lines yet. Click "+ Add Audio Line" to record dialogue.</div>'}
                    </div>
                `;
            }

            // 4. ID Badge Card / Nameplate
            if (clue.badge || clue.idBadge) {
                const b = clue.badge || clue.idBadge;
                return `
                    <div style="background: rgba(202, 138, 4, 0.04); border: 1px solid var(--border-color); border-radius: 4px; padding: 10px;">
                        <div style="font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 8px;">
                            🪪 ID Badge / Nameplate Fields
                        </div>
                        <div class="form-row-horizontal" style="margin-bottom: 6px;">
                            <div class="form-row" style="flex: 0.6;">
                                <label class="form-label">Avatar / Icon</label>
                                <input type="text" value="${b.avatar || '👤'}" oninput="window.caseEditor.updateBadgeField(${idx}, 'avatar', this.value)" placeholder="👤">
                            </div>
                            <div class="form-row" style="flex: 2;">
                                <label class="form-label">Department / Organization</label>
                                <input type="text" value="${b.dept || ''}" oninput="window.caseEditor.updateBadgeField(${idx}, 'dept', this.value)" placeholder="e.g. FEBRAS [pirm] Institute">
                            </div>
                        </div>
                        <div class="form-row-horizontal">
                            <div class="form-row" style="flex: 1.5;">
                                <label class="form-label">Full Name / Subject</label>
                                <input type="text" value="${b.name || ''}" oninput="window.caseEditor.updateBadgeField(${idx}, 'name', this.value)" placeholder="e.g. [luka_huo]">
                            </div>
                            <div class="form-row" style="flex: 1.5;">
                                <label class="form-label">Role / Division Subtitle</label>
                                <input type="text" value="${b.role || ''}" oninput="window.caseEditor.updateBadgeField(${idx}, 'role', this.value)" placeholder="e.g. Theoretical Physics Department">
                            </div>
                        </div>
                    </div>
                `;
            }

            // 5. Polyclinic Prescription Bottle
            if (clue.rx || clue.prescription) {
                const r = clue.rx || clue.prescription;
                return `
                    <div style="background: rgba(192, 132, 252, 0.04); border: 1px solid var(--border-color); border-radius: 4px; padding: 10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div style="font-size: 11px; font-weight: 700; color: #c084fc; text-transform: uppercase;">
                                💊 Prescription Bottle Fields
                            </div>
                            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 11px; color: var(--text-secondary);">
                                <input type="checkbox" ${r.active ? 'checked' : ''} onchange="window.caseEditor.updateRxField(${idx}, 'active', this.checked)">
                                <span>Highlight as Active Prescription</span>
                            </label>
                        </div>
                        <div class="form-row-horizontal" style="margin-bottom: 6px;">
                            <div class="form-row" style="flex: 2;">
                                <label class="form-label">Dispensary / Clinic Header</label>
                                <input type="text" value="${r.dispensary || r.header || ''}" oninput="window.caseEditor.updateRxField(${idx}, 'dispensary', this.value)" placeholder="e.g. Polyclinic Dispensary #4">
                            </div>
                            <div class="form-row" style="flex: 1;">
                                <label class="form-label">Status Tag</label>
                                <input type="text" value="${r.status || 'DEPLETED'}" oninput="window.caseEditor.updateRxField(${idx}, 'status', this.value)" placeholder="e.g. DEPLETED or ACTIVE">
                            </div>
                        </div>
                        <div class="form-row" style="margin-bottom: 6px;">
                            <label class="form-label">Medication / Drug Description</label>
                            <input type="text" value="${r.drug || r.text || ''}" oninput="window.caseEditor.updateRxField(${idx}, 'drug', this.value)" placeholder="e.g. anti-hallucination sedatives">
                        </div>
                        <div class="form-row-horizontal">
                            <div class="form-row" style="flex: 1;">
                                <label class="form-label">Prescription Date</label>
                                <input type="text" value="${r.date || ''}" oninput="window.caseEditor.updateRxField(${idx}, 'date', this.value)" placeholder="e.g. 12 [january]">
                            </div>
                            <div class="form-row" style="flex: 1.5;">
                                <label class="form-label">Prescribing Doctor (Optional)</label>
                                <input type="text" value="${r.doctor || ''}" oninput="window.caseEditor.updateRxField(${idx}, 'doctor', this.value)" placeholder="e.g. Dr. [stanislav_krotov]">
                            </div>
                        </div>
                    </div>
                `;
            }

            // 6. Public Notice / Poster
            if (clue.poster) {
                const p = clue.poster;
                if (!p.agenda) p.agenda = [];

                let agendaHtml = "";
                p.agenda.forEach((item, aIdx) => {
                    agendaHtml += `
                        <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 6px;">
                            <span style="color: var(--accent); font-weight: 700; font-size: 11px;">#${aIdx + 1}</span>
                            <input type="text" style="flex: 1;" value="${item}" oninput="window.caseEditor.updatePosterAgendaItem(${idx}, ${aIdx}, this.value)" placeholder="e.g. Spacetime Paradigm — Jr. [researcher:upper] [luka_huo]">
                            <button class="btn btn-sm btn-danger" onclick="window.caseEditor.deletePosterAgendaItem(${idx}, ${aIdx})">🗑️</button>
                        </div>
                    `;
                });

                return `
                    <div style="background: rgba(255, 176, 0, 0.04); border: 1px solid var(--border-color); border-radius: 4px; padding: 10px;">
                        <div style="font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 8px;">
                            📢 Poster & Public Notice Settings
                        </div>
                        <div class="form-row-horizontal" style="margin-bottom: 6px;">
                            <div class="form-row" style="flex: 1;">
                                <label class="form-label">Logo / Tag</label>
                                <input type="text" value="${p.logo || ''}" oninput="window.caseEditor.updatePosterField(${idx}, 'logo', this.value)" placeholder="e.g. [wss]">
                            </div>
                            <div class="form-row" style="flex: 1;">
                                <label class="form-label">Established Tag</label>
                                <input type="text" value="${p.established || ''}" oninput="window.caseEditor.updatePosterField(${idx}, 'established', this.value)" placeholder="e.g. EST. 2050">
                            </div>
                            <div class="form-row" style="flex: 1;">
                                <label class="form-label">Ribbon / Badge</label>
                                <input type="text" value="${p.badge || '68th JUBILEE'}" oninput="window.caseEditor.updatePosterField(${idx}, 'badge', this.value)" placeholder="e.g. 68th JUBILEE">
                            </div>
                        </div>
                        <div class="form-row" style="margin-bottom: 6px;">
                            <label class="form-label">Main Headline</label>
                            <input type="text" value="${p.headline || ''}" oninput="window.caseEditor.updatePosterField(${idx}, 'headline', this.value)" placeholder="e.g. Commemorate Anniversary Together!">
                        </div>
                        <div class="form-row-horizontal" style="margin-bottom: 10px;">
                            <div class="form-row" style="flex: 1;">
                                <label class="form-label">Event Date</label>
                                <input type="text" value="${p.date || ''}" oninput="window.caseEditor.updatePosterField(${idx}, 'date', this.value)" placeholder="e.g. [sunday] 10 [april]">
                            </div>
                            <div class="form-row" style="flex: 1.5;">
                                <label class="form-label">Venue / Location</label>
                                <input type="text" value="${p.venue || ''}" oninput="window.caseEditor.updatePosterField(${idx}, 'venue', this.value)" placeholder="e.g. [vladivostok] Central Plenary Hall">
                            </div>
                        </div>

                        <!-- Agenda Bullet Items -->
                        <div style="border-top: 1px dashed var(--border-color); padding-top: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="font-size: 11px; font-weight: 700; color: var(--text-primary); text-transform: uppercase;">
                                    📝 Agenda / Schedule Bullets (${p.agenda.length})
                                </span>
                                <button class="btn btn-sm btn-primary" onclick="window.caseEditor.addPosterAgendaItem(${idx})">+ Add Agenda Item</button>
                            </div>
                            ${agendaHtml || '<div class="form-help">No agenda items. Click "+ Add Agenda Item" to add schedule points.</div>'}
                        </div>
                    </div>
                `;
            }

            // 7. Data Table / Roster
            if (clue.table || clue.roster) {
                const t = clue.table || clue.roster;
                if (!t.headers) t.headers = ["Column 1", "Column 2"];
                if (!t.rows) t.rows = [];

                let headerColsHtml = "";
                t.headers.forEach((h, hIdx) => {
                    headerColsHtml += `
                        <div style="display: flex; gap: 4px; align-items: center; min-width: 140px; flex: 1;">
                            <input type="text" value="${h}" oninput="window.caseEditor.updateTableHeader(${idx}, ${hIdx}, this.value)" placeholder="Header ${hIdx + 1}">
                            ${t.headers.length > 1 ? `<button class="btn btn-sm btn-danger" style="padding: 2px 6px;" onclick="window.caseEditor.deleteTableColumn(${idx}, ${hIdx})" title="Delete Column">✕</button>` : ''}
                        </div>
                    `;
                });

                let rowsHtml = "";
                t.rows.forEach((row, rIdx) => {
                    let cellsHtml = "";
                    t.headers.forEach((_, cIdx) => {
                        const cellVal = (row && row[cIdx] !== undefined) ? row[cIdx] : "";
                        cellsHtml += `
                            <div style="flex: 1; min-width: 140px;">
                                <input type="text" value="${cellVal}" oninput="window.caseEditor.updateTableCell(${idx}, ${rIdx}, ${cIdx}, this.value)" placeholder="Cell (${rIdx + 1}, ${cIdx + 1})">
                            </div>
                        `;
                    });

                    rowsHtml += `
                        <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 6px; background: var(--bg-primary); padding: 6px; border-radius: 4px; border: 1px solid var(--border-color);">
                            <span style="font-size: 10px; font-weight: 700; color: var(--accent); min-width: 20px;">#${rIdx + 1}</span>
                            <div style="display: flex; gap: 6px; flex: 1; overflow-x: auto;">
                                ${cellsHtml}
                            </div>
                            <button class="btn btn-sm btn-danger" onclick="window.caseEditor.deleteTableRow(${idx}, ${rIdx})" title="Delete Row">🗑️</button>
                        </div>
                    `;
                });

                return `
                    <div style="background: rgba(255, 176, 0, 0.04); border: 1px solid var(--border-color); border-radius: 4px; padding: 10px;">
                        <div style="font-size: 11px; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 8px;">
                            📊 Data Table & Document Settings
                        </div>
                        <div class="form-row-horizontal" style="margin-bottom: 8px;">
                            <div class="form-row" style="flex: 2;">
                                <label class="form-label">Modal Caption / Summary</label>
                                <input type="text" value="${t.caption || ''}" oninput="window.caseEditor.updateTableField(${idx}, 'caption', this.value)" placeholder="e.g. OFFICIAL REGISTRY ROSTER">
                            </div>
                            <div class="form-row" style="flex: 1.5;">
                                <label class="form-label">Footer Note</label>
                                <input type="text" value="${t.footer || ''}" oninput="window.caseEditor.updateTableField(${idx}, 'footer', this.value)" placeholder="e.g. Authorized by Ministry">
                            </div>
                        </div>

                        <!-- Table Headers & Columns Bar -->
                        <div style="margin-bottom: 8px; border: 1px solid var(--border-color); border-radius: 4px; padding: 8px; background: var(--bg-secondary);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <strong style="font-size: 11px; color: var(--text-primary); text-transform: uppercase;">Columns (${t.headers.length})</strong>
                                <button class="btn btn-sm btn-primary" onclick="window.caseEditor.addTableColumn(${idx})">+ Add Column</button>
                            </div>
                            <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;">
                                ${headerColsHtml}
                            </div>
                        </div>

                        <!-- Table Rows -->
                        <div style="border: 1px solid var(--border-color); border-radius: 4px; padding: 8px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <strong style="font-size: 11px; color: var(--text-primary); text-transform: uppercase;">Table Rows (${t.rows.length})</strong>
                                <button class="btn btn-sm btn-primary" onclick="window.caseEditor.addTableRow(${idx})">+ Add Row</button>
                            </div>
                            ${rowsHtml || '<div class="form-help">No rows in table. Click "+ Add Row" to add entries.</div>'}
                        </div>
                    </div>
                `;
            }

            // 8. Default Text Evidence
            return `
                <div class="form-row">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <label class="form-label" style="margin: 0;">Evidence Description / Text (Use [Keyword] for collectible clues)</label>
                        <button type="button" class="btn btn-sm btn-primary" style="padding: 2px 8px; font-size: 11px;" onclick="window.caseEditor.openInsertKeywordModal('clue-text-${idx}')">+ Insert Keyword</button>
                    </div>
                    <textarea id="clue-text-${idx}" rows="3" oninput="window.caseEditor.updateClueField(${idx}, 'text', this.value)" placeholder="Describe the physical scene, note, or object with [Keyword] brackets...">${clue.text || ''}</textarea>
                </div>
                <div class="form-row-horizontal">
                    <div class="form-row" style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <label class="form-label" style="margin: 0;">💬 Spoken Dialogue (Optional)</label>
                            <button type="button" class="btn btn-sm" style="padding: 1px 6px; font-size: 10px;" onclick="window.caseEditor.openInsertKeywordModal('clue-quote-${idx}')">+ Keyword</button>
                        </div>
                        <input type="text" id="clue-quote-${idx}" value="${clue.quote || clue.spoken || ''}" oninput="window.caseEditor.updateClueField(${idx}, 'quote', this.value)" placeholder="“Spoken dialogue...”">
                        <span class="form-help">Renders as formatted dialogue: “...”</span>
                    </div>
                    <div class="form-row" style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <label class="form-label" style="margin: 0;">💭 Inner Thought (Optional)</label>
                            <button type="button" class="btn btn-sm" style="padding: 1px 6px; font-size: 10px;" onclick="window.caseEditor.openInsertKeywordModal('clue-thought-${idx}')">+ Keyword</button>
                        </div>
                        <input type="text" id="clue-thought-${idx}" value="${clue.thought || clue.innerVoice || ''}" oninput="window.caseEditor.updateClueField(${idx}, 'thought', this.value)" placeholder="«Inner thoughts...»">
                        <span class="form-help">Renders as formatted inner monologue: 💭 «...»</span>
                    </div>
                </div>
            `;
        },

        addClueToActiveMoment() {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (!m) return;
            if (!m.clues) m.clues = [];
            m.clues.push({
                type: "Physical Evidence",
                title: "New Evidence Item",
                text: "Describe the evidence or clue details here with [Keyword] tags."
            });
            this.renderActiveMomentDetail();
            this.renderPreview();
            this.showToast("Added new clue.");
        },

        deleteClue(idx) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (!m || !m.clues) return;
            m.clues.splice(idx, 1);
            this.renderActiveMomentDetail();
            this.renderPreview();
            this.showToast("Deleted clue.");
        },

        updateClueField(idx, field, val) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx]) {
                m.clues[idx][field] = val;
                this.renderPreview();
            }
        },

        updatePhoneField(idx, field, val) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx] && m.clues[idx].phone) {
                m.clues[idx].phone[field] = val;
                this.renderPreview();
            }
        },

        togglePhoneNav(idx, enabled) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx] && m.clues[idx].phone) {
                if (enabled) {
                    m.clues[idx].phone.nav = {
                        arrow: "↱",
                        subtitle: "GLONASS ACTIVE GUIDANCE (350m)",
                        instruction: "Turn right at the next crossroad",
                        destination: "Destination: 1.6 km from [rovd]"
                    };
                } else {
                    delete m.clues[idx].phone.nav;
                }
                this.renderActiveMomentDetail();
                this.renderPreview();
            }
        },

        updatePhoneNavField(idx, field, val) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx] && m.clues[idx].phone && m.clues[idx].phone.nav) {
                m.clues[idx].phone.nav[field] = val;
                this.renderPreview();
            }
        },

        addPhoneMessage(idx) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx] && m.clues[idx].phone) {
                if (!m.clues[idx].phone.messages) m.clues[idx].phone.messages = [];
                m.clues[idx].phone.messages.push({
                    app: "MESSAGING APP",
                    sender: "Contact",
                    time: "08:00",
                    text: "Message text with [Keyword] tags..."
                });
                this.renderActiveMomentDetail();
                this.renderPreview();
                this.showToast("Added message to phone.");
            }
        },

        deletePhoneMessage(idx, msgIdx) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx] && m.clues[idx].phone && m.clues[idx].phone.messages) {
                m.clues[idx].phone.messages.splice(msgIdx, 1);
                this.renderActiveMomentDetail();
                this.renderPreview();
                this.showToast("Deleted message.");
            }
        },

        updatePhoneMessageField(idx, msgIdx, field, val) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx] && m.clues[idx].phone && m.clues[idx].phone.messages && m.clues[idx].phone.messages[msgIdx]) {
                m.clues[idx].phone.messages[msgIdx][field] = val;
                this.renderPreview();
            }
        },

        updateClockField(idx, field, val) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx] && m.clues[idx].clock) {
                m.clues[idx].clock[field] = val;
                this.renderPreview();
            }
        },

        updateAudioField(idx, field, val) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx] && m.clues[idx].audio) {
                m.clues[idx].audio[field] = val;
                this.renderPreview();
            }
        },

        addAudioLine(idx) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx] && m.clues[idx].audio) {
                if (!m.clues[idx].audio.lines) m.clues[idx].audio.lines = [];
                m.clues[idx].audio.lines.push({
                    speaker: "Speaker",
                    type: "user",
                    text: "Recorded statement with [Keyword] tags..."
                });
                this.renderActiveMomentDetail();
                this.renderPreview();
                this.showToast("Added audio transcript line.");
            }
        },

        deleteAudioLine(idx, lineIdx) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx] && m.clues[idx].audio && m.clues[idx].audio.lines) {
                m.clues[idx].audio.lines.splice(lineIdx, 1);
                this.renderActiveMomentDetail();
                this.renderPreview();
                this.showToast("Deleted audio line.");
            }
        },

        updateAudioLineField(idx, lineIdx, field, val) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx] && m.clues[idx].audio && m.clues[idx].audio.lines && m.clues[idx].audio.lines[lineIdx]) {
                m.clues[idx].audio.lines[lineIdx][field] = val;
                this.renderPreview();
            }
        },

        updateBadgeField(idx, field, val) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx]) {
                const b = m.clues[idx].badge || m.clues[idx].idBadge;
                if (b) {
                    b[field] = val;
                    this.renderPreview();
                }
            }
        },

        updateRxField(idx, field, val) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx]) {
                const r = m.clues[idx].rx || m.clues[idx].prescription;
                if (r) {
                    r[field] = val;
                    this.renderPreview();
                }
            }
        },

        updatePosterField(idx, field, val) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx] && m.clues[idx].poster) {
                m.clues[idx].poster[field] = val;
                this.renderPreview();
            }
        },

        addPosterAgendaItem(idx) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx] && m.clues[idx].poster) {
                if (!m.clues[idx].poster.agenda) m.clues[idx].poster.agenda = [];
                m.clues[idx].poster.agenda.push("Topic — Speaker Name");
                this.renderActiveMomentDetail();
                this.renderPreview();
                this.showToast("Added agenda bullet.");
            }
        },

        deletePosterAgendaItem(idx, aIdx) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx] && m.clues[idx].poster && m.clues[idx].poster.agenda) {
                m.clues[idx].poster.agenda.splice(aIdx, 1);
                this.renderActiveMomentDetail();
                this.renderPreview();
                this.showToast("Deleted agenda bullet.");
            }
        },

        updatePosterAgendaItem(idx, aIdx, val) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx] && m.clues[idx].poster && m.clues[idx].poster.agenda) {
                m.clues[idx].poster.agenda[aIdx] = val;
                this.renderPreview();
            }
        },

        updateTableField(idx, field, val) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx]) {
                const t = m.clues[idx].table || m.clues[idx].roster;
                if (t) {
                    t[field] = val;
                    this.renderPreview();
                }
            }
        },

        addTableColumn(idx) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx]) {
                const t = m.clues[idx].table || m.clues[idx].roster;
                if (t) {
                    if (!t.headers) t.headers = ["Column 1"];
                    t.headers.push(`Column ${t.headers.length + 1}`);
                    if (t.rows) {
                        t.rows.forEach(r => {
                            if (Array.isArray(r)) r.push("");
                        });
                    }
                    this.renderActiveMomentDetail();
                    this.renderPreview();
                    this.showToast("Added table column.");
                }
            }
        },

        deleteTableColumn(idx, colIdx) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx]) {
                const t = m.clues[idx].table || m.clues[idx].roster;
                if (t && t.headers && t.headers.length > 1) {
                    t.headers.splice(colIdx, 1);
                    if (t.rows) {
                        t.rows.forEach(r => {
                            if (Array.isArray(r)) r.splice(colIdx, 1);
                        });
                    }
                    this.renderActiveMomentDetail();
                    this.renderPreview();
                    this.showToast("Deleted table column.");
                }
            }
        },

        updateTableHeader(idx, colIdx, val) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx]) {
                const t = m.clues[idx].table || m.clues[idx].roster;
                if (t && t.headers) {
                    t.headers[colIdx] = val;
                    this.renderPreview();
                }
            }
        },

        addTableRow(idx) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx]) {
                const t = m.clues[idx].table || m.clues[idx].roster;
                if (t) {
                    if (!t.rows) t.rows = [];
                    const numCols = (t.headers || []).length || 2;
                    const newRow = new Array(numCols).fill("");
                    t.rows.push(newRow);
                    this.renderActiveMomentDetail();
                    this.renderPreview();
                    this.showToast("Added table row.");
                }
            }
        },

        deleteTableRow(idx, rowIdx) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx]) {
                const t = m.clues[idx].table || m.clues[idx].roster;
                if (t && t.rows) {
                    t.rows.splice(rowIdx, 1);
                    this.renderActiveMomentDetail();
                    this.renderPreview();
                    this.showToast("Deleted table row.");
                }
            }
        },

        updateTableCell(idx, rowIdx, colIdx, val) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (m && m.clues && m.clues[idx]) {
                const t = m.clues[idx].table || m.clues[idx].roster;
                if (t && t.rows && t.rows[rowIdx]) {
                    t.rows[rowIdx][colIdx] = val;
                    this.renderPreview();
                }
            }
        },

        changeClueType(idx, typeId) {
            const m = this.caseData.timeline[this.activeTimelineKey];
            if (!m || !m.clues || !m.clues[idx]) return;
            const currentTitle = m.clues[idx].title || "Clue";
            const currentBadgeType = m.clues[idx].type || "Physical Evidence";

            const registry = window.CaseEditorConstants?.WIDGET_REGISTRY || [];
            const reg = registry.find(w => w.id === typeId) || registry[0];
            m.clues[idx] = reg.defaultProps(currentTitle, currentBadgeType);

            this.renderActiveMomentDetail();
            this.renderPreview();
            this.showToast(`Switched widget to: ${reg.badge || typeId}`);
        }
    };

    global.CaseEditorTimeline = CaseEditorTimeline;
})(typeof window !== 'undefined' ? window : globalThis);
