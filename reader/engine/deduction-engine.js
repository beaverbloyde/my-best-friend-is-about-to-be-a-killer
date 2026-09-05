/**
 * DEDUCTION ENGINE
 * Interactive Detective Investigation & Deduction System
 * (Golden Idol / Obra Dinn style case engine)
 */

class DeductionEngine {
    constructor(options = {}) {
        this.options = Object.assign({
            container: document.body,
            defaultCase: null,
            registryUrl: "cases/cases_registry.json"
        }, options);

        this.currentCase = null;
        this.collectedWords = new Set();
        this.unlockedLore = new Set();
        this.selectedWord = null;
        this.docketSlots = {};
        this.draggedSourceSlotId = null;
        this.currentTimelineKey = null;
        this.currentFilter = "all";
        this.currentSort = "alpha-asc";
        this.highestZIndex = 1000;
        this.openLoreCount = 0;
        this.totalUniqueKeywords = 0;
        this.activeSlot = null;
        this.pickerHighlightedIndex = -1;
        this.justTouchDragged = false;

        this.initDOM();
        this.initEventListeners();
        this.initDisplaySettings();
    }

    initDOM() {
        this.docketModal = document.getElementById("docket-modal");
        if (this.docketModal) {
            const header = this.docketModal.querySelector(".docket-header");
            this.makeWindowDraggable(this.docketModal, header);
            const resizeHandle = this.docketModal.querySelector(".docket-resize-handle");
            if (resizeHandle) {
                this.makeWindowResizable(this.docketModal, resizeHandle, "docket");
            }
            this.restoreDocketSize();
        }
    }

    initEventListeners() {
        window.addEventListener("keydown", (e) => {
            if (e.code === "Space" && !e.target.matches("input, textarea, select")) {
                e.preventDefault();
                if (this.docketModal) {
                    if (this.docketModal.classList.contains("hidden")) {
                        this.openDocket();
                    } else {
                        this.closeDocket();
                    }
                }
            }
            if (e.code === "Escape") {
                this.closeVictoryModal();
                this.closeSlotPicker();
                this.closeTutorial();
                this.closeDocket();
                this.closeLoreModal();
                this.closeSettings();
            }
        });

        this.initSlotPicker();

        const tutModal = document.getElementById("tutorial-modal");
        if (tutModal) {
            tutModal.addEventListener("click", (e) => {
                if (e.target === tutModal) {
                    this.closeTutorial();
                }
            });
        }

        const settingsModal = document.getElementById("game-settings-modal");
        if (settingsModal) {
            settingsModal.addEventListener("click", (e) => {
                if (e.target === settingsModal) {
                    this.closeSettings();
                }
            });
        }

        const fileInput = document.getElementById("case-file-input");
        if (fileInput) {
            fileInput.addEventListener("change", (e) => {
                const file = e.target.files[0];
                if (file) this.loadCaseFromFile(file);
            });
        }

        const caseSelector = document.getElementById("case-selector");
        if (caseSelector) {
            caseSelector.addEventListener("change", (e) => {
                const val = e.target.value;
                if (val) {
                    const newUrl = new URL(window.location);
                    newUrl.searchParams.set("case", val);
                    window.history.replaceState({}, "", newUrl);
                    this.loadCaseFromUrl(val);
                }
            });
        }

        this.initSlotDragAndDrop();
        this.initTouchDragAndDrop();
    }

    initDisplaySettings() {
        // Retrieve stored settings or share with novel reader
        const savedTheme = localStorage.getItem('game-theme') || localStorage.getItem('reader-theme') || 'soviet-amber';
        const savedFontSize = parseInt(localStorage.getItem('game-font-size') || '13', 10);
        const savedLineHeight = parseFloat(localStorage.getItem('game-line-height') || '1.5');
        const savedFontFamily = localStorage.getItem('game-font-family') || "'IBM Plex Mono', monospace";
        const savedScanlines = localStorage.getItem('game-scanlines') === 'true';

        this.currentDisplaySettings = {
            theme: savedTheme,
            fontSize: isNaN(savedFontSize) ? 13 : savedFontSize,
            lineHeight: isNaN(savedLineHeight) ? 1.5 : savedLineHeight,
            fontFamily: savedFontFamily,
            scanlines: savedScanlines
        };

        this.applyDisplaySettings(this.currentDisplaySettings);

        // Bind Theme Cards click
        document.querySelectorAll('.game-theme-card').forEach(btn => {
            btn.addEventListener('click', () => {
                const theme = btn.dataset.theme;
                if (theme) {
                    this.currentDisplaySettings.theme = theme;
                    this.applyDisplaySettings(this.currentDisplaySettings);
                }
            });
        });

        // Bind Font Size Slider
        const sizeSlider = document.getElementById('game-font-size-slider');
        if (sizeSlider) {
            sizeSlider.addEventListener('input', (e) => {
                this.currentDisplaySettings.fontSize = parseInt(e.target.value, 10);
                this.applyDisplaySettings(this.currentDisplaySettings);
            });
        }

        // Bind Line Height Slider
        const lhSlider = document.getElementById('game-line-height-slider');
        if (lhSlider) {
            lhSlider.addEventListener('input', (e) => {
                this.currentDisplaySettings.lineHeight = parseFloat(e.target.value);
                this.applyDisplaySettings(this.currentDisplaySettings);
            });
        }

        // Bind Font Family Dropdown
        const fontSelect = document.getElementById('game-font-family-select');
        if (fontSelect) {
            fontSelect.addEventListener('change', (e) => {
                this.currentDisplaySettings.fontFamily = e.target.value;
                this.applyDisplaySettings(this.currentDisplaySettings);
            });
        }

        // Bind CRT Scanlines Toggle
        const scanlinesToggle = document.getElementById('game-scanlines-toggle');
        if (scanlinesToggle) {
            scanlinesToggle.addEventListener('change', (e) => {
                this.currentDisplaySettings.scanlines = e.target.checked;
                this.applyDisplaySettings(this.currentDisplaySettings);
            });
        }

        // Bind SFX Controls
        const sfxToggle = document.getElementById('game-sfx-toggle');
        const sfxSlider = document.getElementById('game-sfx-vol-slider');
        const sfxVal = document.getElementById('game-sfx-vol-val');

        if (sfxToggle && window.sfx) {
            sfxToggle.checked = window.sfx.enabled;
            sfxToggle.addEventListener('change', (e) => {
                window.sfx.setEnabled(e.target.checked);
            });
        }

        if (sfxSlider && window.sfx) {
            sfxSlider.value = Math.round(window.sfx.volume * 100);
            if (sfxVal) sfxVal.innerText = `${sfxSlider.value}%`;
            sfxSlider.addEventListener('input', (e) => {
                const vol = parseInt(e.target.value, 10) / 100;
                window.sfx.setVolume(vol);
                if (sfxVal) sfxVal.innerText = `${e.target.value}%`;
            });
        }
    }

    applyDisplaySettings(settings) {
        if (!settings) return;

        // 1. Theme class on body
        document.body.classList.remove('theme-soviet-amber', 'theme-soviet-emerald', 'theme-arctic', 'theme-gosplan', 'theme-monochrome');
        document.body.classList.add(`theme-${settings.theme}`);

        document.querySelectorAll('.game-theme-card').forEach(card => {
            card.classList.toggle('active', card.dataset.theme === settings.theme);
        });

        // 2. Font Size
        document.documentElement.style.setProperty('--game-font-size', `${settings.fontSize}px`);
        document.body.style.setProperty('--game-font-size', `${settings.fontSize}px`);
        const sizeValEl = document.getElementById('game-font-size-val');
        if (sizeValEl) sizeValEl.innerText = `${settings.fontSize}px`;
        const sizeSlider = document.getElementById('game-font-size-slider');
        if (sizeSlider && parseInt(sizeSlider.value, 10) !== settings.fontSize) sizeSlider.value = settings.fontSize;

        // 3. Line Height
        document.documentElement.style.setProperty('--game-line-height', settings.lineHeight);
        document.body.style.setProperty('--game-line-height', settings.lineHeight);
        const lhValEl = document.getElementById('game-line-height-val');
        if (lhValEl) lhValEl.innerText = settings.lineHeight;
        const lhSlider = document.getElementById('game-line-height-slider');
        if (lhSlider && parseFloat(lhSlider.value) !== settings.lineHeight) lhSlider.value = settings.lineHeight;

        // 4. Font Family
        document.documentElement.style.setProperty('--game-font-family', settings.fontFamily);
        document.body.style.setProperty('--game-font-family', settings.fontFamily);
        const fontSelect = document.getElementById('game-font-family-select');
        if (fontSelect && fontSelect.value !== settings.fontFamily) fontSelect.value = settings.fontFamily;

        // 5. CRT Scanlines
        document.body.classList.toggle('crt-scanlines', !!settings.scanlines);
        const scanlinesToggle = document.getElementById('game-scanlines-toggle');
        if (scanlinesToggle) scanlinesToggle.checked = !!settings.scanlines;

        // Persist
        localStorage.setItem('reader-theme', settings.theme);
        localStorage.setItem('game-theme', settings.theme);
        localStorage.setItem('game-font-size', settings.fontSize);
        localStorage.setItem('game-line-height', settings.lineHeight);
        localStorage.setItem('game-font-family', settings.fontFamily);
        localStorage.setItem('game-scanlines', !!settings.scanlines);
    }

    openSettings() {
        const modal = document.getElementById('game-settings-modal');
        if (modal) modal.classList.remove('hidden');
    }

    closeSettings() {
        const modal = document.getElementById('game-settings-modal');
        if (modal) modal.classList.add('hidden');
    }

    resetDisplaySettings() {
        this.currentDisplaySettings = {
            theme: 'soviet-amber',
            fontSize: 13,
            lineHeight: 1.5,
            fontFamily: "'IBM Plex Mono', monospace",
            scanlines: false
        };
        this.applyDisplaySettings(this.currentDisplaySettings);
    }

    async init() {
        await this.loadProgressionRules();

        if (this.options.registryUrl) {
            await this.loadRegistry(this.options.registryUrl);
        }

        const params = new URLSearchParams(window.location.search);
        const caseParam = params.get("case");

        if (caseParam) {
            await this.loadCaseFromUrl(caseParam);
        } else if (this.registry && this.registry.length > 0 && this.registry[0].file) {
            await this.loadCaseFromUrl(this.registry[0].file);
        } else {
            await this.loadCaseFromUrl("cases/chapter_01_morning_routine.json");
        }

        // Auto-show tutorial on first visit if not suppressed
        if (localStorage.getItem("deduction_engine_tutorial_suppressed") !== "true") {
            this.openTutorial();
        }
    }

    async loadProgressionRules() {
        this.progressionRules = {};
        try {
            const res = await fetch("cases/progression.json?t=" + Date.now());
            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.rules)) {
                    data.rules.forEach(rule => {
                        const target = rule.target || rule.case || rule.chapter;
                        if (!target) return;

                        let req = rule.requires;
                        if (!req) {
                            if (rule.requiresCase) {
                                req = {
                                    type: 'case',
                                    id: rule.requiresCase,
                                    title: rule.caseTitle || `Case ${rule.requiresCase}`,
                                    url: rule.caseUrl || `game.html?case=cases/${rule.requiresCase}.json`,
                                    teaser: rule.teaser || 'Solve the case investigation to unlock.'
                                };
                            } else if (rule.requiresChapter) {
                                req = {
                                    type: 'chapter',
                                    id: rule.requiresChapter,
                                    title: rule.chapterTitle || 'Required Chapter',
                                    url: rule.chapterUrl || `index.html?file=${encodeURIComponent(rule.requiresChapter)}`,
                                    teaser: rule.teaser || 'Read the required chapter in Novel Reader to unlock.'
                                };
                            }
                        }

                        if (req) {
                            this.progressionRules[target] = {
                                targetType: rule.targetType || (target.endsWith('.nwd') ? 'chapter' : 'case'),
                                targetTitle: rule.targetTitle || '',
                                requires: req
                            };
                        }
                    });
                }
            }
        } catch (e) {
            console.warn("Could not load dynamic cases/progression.json in DeductionEngine:", e);
        }
    }

    isCaseUnlocked(caseId, caseFile) {
        let req = null;
        if (this.currentCase?.meta?.requires) {
            req = this.currentCase.meta.requires;
        } else if (this.progressionRules) {
            const rule = (caseId ? this.progressionRules[caseId] : null) || (caseFile ? this.progressionRules[caseFile] : null);
            if (rule && rule.requires) req = rule.requires;
        }

        if (!req || !req.id) return { unlocked: true };

        let isUnlocked = false;
        if (req.type === 'chapter' || (req.id && req.id.endsWith('.nwd'))) {
            isUnlocked = localStorage.getItem(`chapter_read_${req.id}`) === 'true';
        } else {
            isUnlocked = localStorage.getItem(`case_solved_${req.id}`) === 'true';
        }

        return {
            unlocked: isUnlocked,
            requirement: req
        };
    }

    syncCaseSelector(targetUrl = null, caseData = null) {
        const selector = document.getElementById("case-selector");
        if (!selector || !selector.options.length) return;

        const currentTarget = targetUrl || this.currentCaseUrl || (caseData ? (caseData._sourceUrl || caseData.file) : null);
        const currentCaseId = caseData ? caseData.id : (this.currentCase ? this.currentCase.id : null);

        const normalize = (s) => (s || "").replace(/^[./]+/, "").trim();
        const normTarget = normalize(currentTarget);

        for (let i = 0; i < selector.options.length; i++) {
            const optVal = selector.options[i].value;
            const normOpt = normalize(optVal);

            if (
                (normTarget && (normOpt === normTarget || normOpt.endsWith(normTarget) || normTarget.endsWith(normOpt))) ||
                (currentCaseId && (normOpt.includes(currentCaseId) || optVal.includes(currentCaseId)))
            ) {
                selector.selectedIndex = i;
                return;
            }
        }
    }

    async loadRegistry(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch registry");
            const registry = await res.json();
            this.registry = registry;
            const selector = document.getElementById("case-selector");
            if (selector && Array.isArray(registry)) {
                selector.innerHTML = "";
                registry.forEach(c => {
                    const opt = document.createElement("option");
                    opt.value = c.file;
                    const check = this.isCaseUnlocked(c.id, c.file);
                    opt.innerText = check.unlocked ? (c.title || c.id) : `🔒 ${c.title || c.id} (Locked)`;
                    selector.appendChild(opt);
                });
                this.syncCaseSelector();
            }
        } catch (err) {
            console.warn("Could not load case registry via fetch:", err);
        }
    }

    async loadCaseFromUrl(url) {
        try {
            this.currentCaseUrl = url;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`);
            const caseData = await res.json();
            caseData._sourceUrl = url;
            this.loadCase(caseData);
            this.syncCaseSelector(url, caseData);
            this.showToast(`Loaded case: ${caseData.meta?.title || caseData.id}`);
        } catch (err) {
            console.error("Failed to load case from URL:", err);
            this.showToast("Error loading case file: " + (err.message || url));
        }
    }

    loadCaseFromFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const caseData = JSON.parse(e.target.result);
                this.loadCase(caseData);
                this.showToast(`Loaded custom case: ${caseData.meta?.title || file.name}`);
            } catch (err) {
                alert("Invalid case JSON file format: " + err.message);
            }
        };
        reader.readAsText(file);
    }

    // --- Content & Markdown / Syntax Parsers ---

    parseText(str) {
        if (!str) return "";
        let text = String(str);

        // Convert [Keyword] into .kw element (ignore slot: and num:)
        text = text.replace(/\[\[([^\]]+)\]\]/g, `<span class="kw" data-word="$1">$1</span>`);
        text = text.replace(/\[(?!slot:|num:)([^\]]+)\]/g, `<span class="kw" data-word="$1">$1</span>`);

        // Markdown bold & italics & newlines
        text = text.replace(/\*\*([^\*]+)\*\*/g, `<strong>$1</strong>`);
        text = text.replace(/\*([^\*]+)\*/g, `<em>$1</em>`);
        text = text.replace(/\n\n+/g, `<br><br>`);
        text = text.replace(/\n/g, `<br>`);

        return text;
    }

    parseDocketTemplate(templateStr) {
        if (!templateStr) return "";
        let text = String(templateStr);

        // Parse number input slots: [num:slot_id:maxlength:placeholder]
        text = text.replace(/\[num:([a-zA-Z0-9_-]+):(\d+)(?::([^\]]+))?\]/g, (match, id, len, placeholder) => {
            const ph = placeholder || (len === "2" ? "DD" : (len === "4" ? "YYYY" : "#"));
            const width = len === "1" ? "28px" : (len === "2" ? "38px" : "58px");
            return `<input type="text" class="num-slot" data-id="${id}" maxlength="${len}" placeholder="${ph}" style="width: ${width};">`;
        });

        // Parse word slots: [slot:slot_id] or [slot:slot_id:constraint_tag]
        text = text.replace(/\[slot:([a-zA-Z0-9_-]+)(?::([a-zA-Z0-9_-]+))?\]/g, (match, id, tag) => {
            const tagAttr = tag ? ` data-tag="${tag}"` : "";
            return `<span class="slot" data-id="${id}"${tagAttr}>[ ? ]</span>`;
        });

        // Parse paragraphs
        if (!text.includes("<p>")) {
            text = text.split(/\n\n+/).map(para => {
                let p = para.trim().replace(/\n/g, "<br>");
                p = p.replace(/\*\*([^\*]+)\*\*/g, `<strong>$1</strong>`);
                return `<p>${p}</p>`;
            }).join("<br>");
        } else {
            text = text.replace(/\*\*([^\*]+)\*\*/g, `<strong>$1</strong>`);
        }

        return text;
    }

    renderClueContent(clue, timeKey = null, clueIdx = 0) {
        if (!clue) return "";

        // 1. Bedside Clock / Telemetry Widget
        if (clue.clock) {
            const c = clue.clock;
            return `
                <div class="phone-device" style="max-width: 260px; padding: 8px 12px;">
                    <div class="phone-status-bar">
                        <span>${c.title || "BEDSIDE TELEMETRY"}</span>
                        <span>🌡️ ${c.temperature || "24°C"}</span>
                    </div>
                    <div class="phone-clock-display" style="border: none; padding: 4px 0;">
                        <div class="phone-clock-time">${c.time || "00:00"}</div>
                        <div class="phone-clock-date">${this.parseText(c.date || "")}</div>
                    </div>
                </div>
            `;
        }

        // 2. Mobile Phone Lockscreen & Messaging (with optional embedded navigation banner)
        if (clue.phone) {
            const p = clue.phone;
            let navHtml = "";
            if (p.nav) {
                const n = p.nav;
                navHtml = `
                    <div class="phone-nav-banner" style="margin-bottom: 8px;">
                        <div class="phone-nav-arrow">${n.arrow || "↱"}</div>
                        <div style="flex: 1;">
                            <div style="font-size: 9px; color: var(--text-tertiary); text-transform: uppercase;">${this.parseText(n.subtitle || "Next Turn")}</div>
                            <div style="font-size: 12px; font-weight: 700; color: var(--text-primary);">${this.parseText(n.instruction || n.nextTurn || "")}</div>
                            ${n.destination ? `<div style="font-size: 10px; color: var(--success); margin-top: 2px;">${this.parseText(n.destination)}</div>` : ""}
                        </div>
                    </div>
                `;
            }

            let notifsHtml = "";
            (p.messages || []).forEach(m => {
                notifsHtml += `
                    <div class="phone-notif-card">
                        <div class="phone-notif-header">
                            <span>💬 ${m.app || "MESSAGING APP"}</span>
                            <span>${m.time || ""}</span>
                        </div>
                        <div class="phone-notif-sender">${this.parseText(m.sender || "")}</div>
                        <div class="phone-notif-body">“${this.parseText(m.text || "")}”</div>
                    </div>
                `;
            });

            return `
                <div class="phone-device">
                    <div class="phone-status-bar">
                        <span>${p.network || "SOV-NET 5G"}</span>
                        <span>🔋 ${p.battery || "100%"}</span>
                    </div>
                    <div class="phone-clock-display">
                        <div class="phone-clock-time">${p.time || "00:00"}</div>
                        <div class="phone-clock-date">${this.parseText(p.date || "")}</div>
                    </div>
                    ${navHtml}
                    ${notifsHtml ? `<div class="phone-notification-stack">${notifsHtml}</div>` : ""}
                </div>
            `;
        }

        // 3. Navigation HUD
        if (clue.nav) {
            const n = clue.nav;
            return `
                <div class="phone-device">
                    <div class="phone-status-bar">
                        <span>${n.network || "GLONASS ACTIVE GUIDANCE"}</span>
                        <span>${n.time || ""}</span>
                    </div>
                    <div class="phone-nav-banner">
                        <div class="phone-nav-arrow">${n.arrow || "↱"}</div>
                        <div style="flex: 1;">
                            <div style="font-size: 9px; color: var(--text-tertiary); text-transform: uppercase;">${n.subtitle || "Next Turn"}</div>
                            <div style="font-size: 12px; font-weight: 700; color: var(--text-primary);">${this.parseText(n.instruction || n.nextTurn || "")}</div>
                            <div style="font-size: 10px; color: var(--success); margin-top: 2px;">${this.parseText(n.destination || "")}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        // 4. Audio Tape & Voicemail Player
        if (clue.audio) {
            const a = clue.audio;
            let dialogueHtml = "";
            (a.lines || []).forEach(line => {
                const lineClass = line.type === "system" ? "audio-line-system" : "audio-line-user";
                dialogueHtml += `
                    <div class="${lineClass}">
                        <strong>${this.parseText(line.speaker || "")}:</strong> “${this.parseText(line.text || "")}”
                    </div>
                `;
            });

            return `
                <div class="audio-player-box">
                    <div class="audio-tape-status">
                        <span>${a.label || "COMM-REC // VOICEMAIL"}</span>
                        <span>${a.time || "00:00"}</span>
                    </div>
                    <div class="audio-dialogue">${dialogueHtml}</div>
                </div>
            `;
        }

        // 5. Polyclinic Rx Badges
        if (clue.rx || clue.prescription) {
            const r = clue.rx || clue.prescription;
            const borderStyle = r.active ? "border-left-color: var(--accent);" : "";
            const headerStyle = r.active ? "color: var(--accent);" : "";
            return `
                <div class="rx-badge" style="${borderStyle}">
                    <div class="rx-header">
                        <span style="${headerStyle}">${r.dispensary || r.header || "Polyclinic Dispensary"}</span>
                        <span>[${r.status || "ACTIVE"}]</span>
                    </div>
                    <div>${this.parseText(r.drug || r.text || "")}</div>
                    <div style="color: var(--text-secondary); font-size: 10px;">
                        ${r.date ? `Prescription Date: ${this.parseText(r.date)}` : ""}
                        ${r.doctor ? ` • Prescribed by ${this.parseText(r.doctor)}` : ""}
                    </div>
                </div>
            `;
        }

        // 6. ID Badge Card
        if (clue.badge || clue.idBadge) {
            const b = clue.badge || clue.idBadge;
            return `
                <div class="id-badge-card">
                    <div class="id-badge-avatar">${b.avatar || "👤"}</div>
                    <div class="id-badge-info">
                        <div class="id-badge-dept">${this.parseText(b.dept || "")}</div>
                        <div class="id-badge-name">${this.parseText(b.name || "")}</div>
                        <div style="font-size: 10px; color: var(--accent);">${this.parseText(b.role || "")}</div>
                    </div>
                </div>
            `;
        }

        // 7. Jubilee Poster
        if (clue.poster) {
            const p = clue.poster;
            let agendaHtml = "";
            (p.agenda || []).forEach(item => {
                agendaHtml += `<li>${this.parseText(item)}</li>`;
            });

            return `
                <div class="poster-card">
                    <div class="poster-header-row">
                        <div class="poster-logo-box">
                            <span class="poster-soviet-star">★</span>
                            <span style="font-size: 10px; color: var(--text-secondary);">LOGO:</span>
                            ${this.parseText(p.logo || "")}
                            <span class="poster-est">${p.established || ""}</span>
                        </div>
                        <div class="poster-badge">${p.badge || "NOTICE"}</div>
                    </div>
                    <div class="poster-headline">${this.parseText(p.headline || "")}</div>
                    <div class="poster-meta-bar">
                        ${p.date ? `<div><strong>📅 DATE:</strong> ${this.parseText(p.date)}</div>` : ""}
                        ${p.venue ? `<div><strong>📍 VENUE:</strong> ${this.parseText(p.venue)}</div>` : ""}
                    </div>
                    ${agendaHtml ? `<div style="font-size: 9px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; margin-top: 2px;">Agenda:</div><ul class="poster-panel-list">${agendaHtml}</ul>` : ""}
                </div>
            `;
        }

        // 8. Roster / Data Table
        if (clue.table || clue.roster) {
            const t = clue.table || clue.roster;
            const rowCount = (t.rows || []).length;
            const captionText = t.caption ? this.parseText(t.caption) : "Official Registry Document";
            const safeTimeKey = (timeKey || "scene").replace(/[^a-zA-Z0-9_-]/g, "_");

            return `
                <div class="clue-table-trigger-card" onclick="window.gameEngine.openTableModal('${safeTimeKey}', ${clueIdx ?? 0})">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-weight: 700; font-size: 11px; color: var(--accent); letter-spacing: 0.5px;">📋 ${this.parseText(clue.title || "OFFICIAL ROSTER")}</span>
                        <span style="font-size: 10px; color: var(--accent); font-weight: 700;">[CLICK TO EXPAND ↗]</span>
                    </div>
                    <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.4; margin-bottom: 8px;">${captionText}</div>
                    <div style="text-align: center; padding: 7px; background: var(--bg-secondary); border: 1px dashed var(--border-color); border-radius: 4px; font-size: 11px; color: var(--text-primary); display: flex; align-items: center; justify-content: center; gap: 6px;">
                        <span>🔍 Open Document Window</span>
                        <span style="color: var(--text-tertiary);">(${rowCount} entries)</span>
                    </div>
                </div>
            `;
        }

        // 9. Plain Text / Description fallback
        const descText = clue.text || clue.desc || "";
        return this.parseText(descText);
    }

    loadCase(caseData, autoRestore = true) {
        if (!caseData || !caseData.timeline) {
            console.error("Invalid case data structure:", caseData);
            return;
        }

        this.currentCase = caseData;
        this.syncCaseSelector(this.currentCaseUrl, caseData);
        this.collectedWords = new Set();
        this.unlockedLore = new Set();
        this.selectedWord = null;
        this.docketSlots = {};
        this.savedTimelineKey = null;
        this.closeSlotPicker();
        this.closeLoreModal();
        this.closeTableModal();

        // Ensure keywordTags map exists
        if (!this.currentCase.keywordTags || typeof this.currentCase.keywordTags !== "object") {
            this.currentCase.keywordTags = {};
        }

        // Auto-collect Initial / Starter Keywords if defined in case
        const starterList = caseData.initialKeywords || caseData.starterKeywords || caseData.presetKeywords;
        if (Array.isArray(starterList)) {
            starterList.forEach(item => {
                let word = "";
                let tags = null;
                if (typeof item === "object" && item !== null) {
                    word = (item.word || item.name || "").trim();
                    if (Array.isArray(item.tags)) tags = item.tags;
                    else if (item.tag || item.category) tags = [item.tag || item.category];
                } else {
                    word = String(item).trim();
                }

                if (word) {
                    this.collectedWords.add(word);
                    if (tags && !this.currentCase.keywordTags[word]) {
                        this.currentCase.keywordTags[word] = tags;
                    }
                }
            });
        }

        const headerTitleEl = document.getElementById("header-case-title");
        if (headerTitleEl) {
            headerTitleEl.innerText = caseData.meta?.title || "DEDUCTION INVESTIGATION";
        }

        // Check if case is locked behind a prerequisite chapter or case
        const check = this.isCaseUnlocked(caseData.id, caseData.file);
        if (!check.unlocked) {
            const container = document.getElementById("scene-container");
            if (container) {
                const req = check.requirement;
                const isChapterReq = req.type === 'chapter' || (req.id && req.id.endsWith('.nwd'));
                container.innerHTML = `
                    <div class="case-locked-screen">
                        <div class="case-locked-badge">
                            <span>☭</span>
                            <span>CLASSIFIED CASE FILE // PREREQUISITE REQUIRED</span>
                        </div>
                        <div class="case-locked-icon">🔒</div>
                        <h2 class="case-locked-title">${caseData.meta?.title || "Classified Case"}</h2>
                        <p class="case-locked-desc">
                            This investigation file is restricted. You must complete the required ${isChapterReq ? "novel chapter in the <strong>Novel Reader</strong>" : "preceding case"} before accessing this crime scene.
                        </p>
                        <div class="case-locked-req-box">
                            <span class="case-locked-req-label">REQUIRED PREREQUISITE</span>
                            <span class="case-locked-req-title">${req.title || (isChapterReq ? "Previous Chapter" : "Previous Case")}</span>
                            <p style="font-size: 12px; color: var(--text-secondary); margin: 4px 0 10px 0;">${req.teaser || "Complete the required content to unlock this investigation."}</p>
                            <a href="${req.url || (isChapterReq ? `index.html?file=${encodeURIComponent(req.id)}` : `game.html?case=cases/${req.id}.json`)}" class="case-locked-action-btn">
                                ${isChapterReq ? "📖 Open Chapter in Novel Reader ↵" : "🚀 Launch Prerequisite Case ↵"}
                            </a>
                        </div>
                    </div>
                `;
            }
            const timelineBar = document.getElementById("timeline-buttons");
            if (timelineBar) timelineBar.innerHTML = "";
            const trayGrid = document.getElementById("tray-grid");
            if (trayGrid) trayGrid.innerHTML = "";
            const loreList = document.getElementById("lore-list");
            if (loreList) loreList.innerHTML = `<div style="color: var(--text-tertiary); font-size: 11px; padding: 10px; line-height: 1.5;">Case is restricted. Complete prerequisites to access dossiers.</div>`;
            const kwCount = document.getElementById("kw-count");
            if (kwCount) kwCount.innerText = "LOCKED";
            const loreCount = document.getElementById("lore-count");
            if (loreCount) loreCount.innerText = "LOCKED";
            return;
        }
        const docketTitleEl = document.getElementById("docket-title-text");
        if (docketTitleEl) {
            docketTitleEl.innerText = caseData.meta?.docketTitle || "CASE DOCKET";
        }

        const docketBody = document.getElementById("docket-body-content");
        if (docketBody && caseData.docket?.template) {
            docketBody.innerHTML = this.parseDocketTemplate(caseData.docket.template);
            this.bindDocketSlotEvents();
            this.setupDocketScrollIndicators();
        }

        if (autoRestore) {
            this.loadProgress();
        }

        // 3. Load Chapter-Scoped Keywords if case is linked to specific novel chapter(s)
        const scope = caseData.chapterScope || caseData.chapters || caseData.sourceChapters;
        if (scope) {
            const scopeList = Array.isArray(scope) ? scope : [scope];
            this.loadChapterScopeKeywords(scopeList);
        }

        this.calculateTotalKeywords();
        this.renderTimeline();
        this.renderFilterChips();
        this.renderTray();
        this.renderLoreList();

        const initialTimeKey = (this.savedTimelineKey && caseData.timeline[this.savedTimelineKey]) ? this.savedTimelineKey : Object.keys(caseData.timeline)[0];
        if (initialTimeKey) {
            this.selectTime(initialTimeKey);
        }

        this.updateKeywordCounter();
        this.updateProgress();
        this.refreshKeywordHighlights();
    }

    async loadChapterScopeKeywords(scopeList) {
        if (!Array.isArray(scopeList) || scopeList.length === 0) return;

        for (const chPath of scopeList) {
            if (!chPath) continue;

            // 1. Load keywords saved by reading this chapter in localStorage
            try {
                const saved = localStorage.getItem(`chapter_keywords_${chPath}`);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    if (Array.isArray(parsed)) {
                        parsed.forEach(w => {
                            if (w && typeof w === "string") this.collectedWords.add(w.trim());
                        });
                    }
                }
            } catch (e) {}

            // 2. Fetch chapter file to extract bracketed keywords dynamically
            try {
                let fetchPath = chPath;
                if (!chPath.startsWith("http") && !chPath.startsWith("/") && !chPath.startsWith("../")) {
                    fetchPath = `../${chPath}`;
                }
                const res = await fetch(`${fetchPath}?t=${Date.now()}`);
                if (res.ok) {
                    const text = await res.text();
                    const matches = text.match(/\[(?!br\b|vspace\b|field:|footnote:|img:|b\b|\/b\b|i\b|\/i\b|slot:|num:)([^\]]+)\]/g) || [];
                    matches.forEach(m => {
                        const w = m.replace(/^\[+/, "").replace(/\]+$/, "").trim();
                        if (w && !w.startsWith("%%") && !w.startsWith("@")) {
                            this.collectedWords.add(w);
                        }
                    });
                }
            } catch (err) {
                console.warn(`Could not load chapter scope from ${chPath}:`, err);
            }
        }

        this.calculateTotalKeywords();
        this.renderTray();
        this.updateKeywordCounter();
        this.refreshKeywordHighlights();
    }

    calculateTotalKeywords() {
        const allKws = new Set();
        if (!this.currentCase) return;

        // 1. Initial / Starter Keywords & Collected Chapter Scoped Words
        this.collectedWords.forEach(w => {
            if (w) allKws.add(w);
        });

        const starterList = this.currentCase.initialKeywords || this.currentCase.starterKeywords || this.currentCase.presetKeywords;
        if (Array.isArray(starterList)) {
            starterList.forEach(item => {
                const word = typeof item === "object" && item !== null ? (item.word || item.name) : String(item);
                if (word && word.trim()) allKws.add(word.trim());
            });
        }

        // 2. Timeline and Lore keywords
        const extractFromText = (raw) => {
            if (!raw) return;
            const bracketMatches = String(raw).match(/\[(?!slot:|num:)([^\]]+)\]/g) || [];
            bracketMatches.forEach(m => {
                const w = m.replace(/^\[+/, "").replace(/\]+$/, "").trim();
                if (w) allKws.add(w);
            });

            const htmlMatches = String(raw).match(/<span[^>]*class=['"][^'"]*\bkw\b[^'"]*['"][^>]*>([\s\S]*?)<\/span>/gi) || [];
            htmlMatches.forEach(m => {
                const w = m.replace(/<[^>]+>/g, "").trim();
                if (w) allKws.add(w);
            });
        };

        const scanObj = (obj) => {
            if (!obj) return;
            if (typeof obj === "string") {
                extractFromText(obj);
            } else if (Array.isArray(obj)) {
                obj.forEach(scanObj);
            } else if (typeof obj === "object") {
                for (let k in obj) scanObj(obj[k]);
            }
        };

        for (let t in this.currentCase.timeline) {
            scanObj(this.currentCase.timeline[t]);
        }

        for (let l in (this.currentCase.lore || {})) {
            scanObj(this.currentCase.lore[l]);
        }

        this.totalUniqueKeywords = allKws.size;
    }

    renderTimeline() {
        const container = document.getElementById("timeline-buttons");
        if (!container || !this.currentCase) return;

        container.innerHTML = "";
        for (let key in this.currentCase.timeline) {
            const scene = this.currentCase.timeline[key];
            const btn = document.createElement("button");
            btn.className = "time-btn";
            if (scene.isVision) btn.classList.add("vision-btn");
            btn.innerText = scene.time || key;
            btn.onclick = () => this.selectTime(key);
            btn.id = `btn-time-${key.replace(/[^a-zA-Z0-9]/g, "_")}`;
            container.appendChild(btn);
        }

        this.setupTimelineScrollIndicators();
    }

    setupTimelineScrollIndicators() {
        const wrap = document.getElementById("timeline-scroll-wrap");
        const container = document.getElementById("timeline-buttons");
        if (!wrap || !container) return;

        const updateIndicators = () => {
            const scrollLeft = container.scrollLeft;
            const maxScrollLeft = container.scrollWidth - container.clientWidth;
            const hasLeft = scrollLeft > 8;
            const hasRight = maxScrollLeft > 8 && scrollLeft < maxScrollLeft - 8;

            wrap.classList.toggle("has-overflow-left", hasLeft);
            wrap.classList.toggle("has-overflow-right", hasRight);
        };

        if (!this._timelineScrollBound) {
            this._timelineScrollBound = true;
            container.addEventListener("scroll", updateIndicators, { passive: true });
            window.addEventListener("resize", updateIndicators);
        }

        setTimeout(updateIndicators, 50);
        setTimeout(updateIndicators, 300);
    }

    selectTime(timeKey) {
        this.currentTimelineKey = timeKey;
        if (!this.currentCase) return;

        document.querySelectorAll(".time-btn").forEach(btn => btn.classList.remove("active"));
        const activeBtn = document.getElementById(`btn-time-${timeKey.replace(/[^a-zA-Z0-9]/g, "_")}`);
        if (activeBtn) {
            activeBtn.classList.add("active");
            try {
                activeBtn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
            } catch(e) {}
        }

        const data = this.currentCase.timeline[timeKey];
        const container = document.getElementById("scene-container");
        if (!data || !container) return;

        let cluesHtml = "";
        (data.clues || []).forEach((clue, clueIdx) => {
            const contentHtml = this.renderClueContent(clue, timeKey, clueIdx);
            let dialogueHtml = "";
            if (clue.spoken || clue.quote) {
                const text = clue.spoken || clue.quote;
                dialogueHtml += `<div class="clue-quote">“${this.parseText(text.replace(/^[“"]|[”"]$/g, ""))}”</div>`;
            }
            if (clue.thought || clue.innerVoice || clue.inner) {
                const text = clue.thought || clue.innerVoice || clue.inner;
                dialogueHtml += `<div class="clue-thought">💭 «${this.parseText(text.replace(/^[«“"]|[»”"]$/g, ""))}»</div>`;
            }

            cluesHtml += `
                <div class="clue-card">
                    <div class="clue-badge">${clue.type || "Clue"}</div>
                    <div class="clue-title">${clue.title || ""}</div>
                    <div class="clue-desc">${contentHtml}</div>
                    ${dialogueHtml}
                </div>
            `;
        });

        container.innerHTML = `
            <div class="scene-header">
                <div class="scene-title">${data.title}</div>
                <div class="scene-location">${data.location}</div>
            </div>
            <div class="clue-grid">${cluesHtml}</div>
        `;

        this.setupDraggableKeywords(container);
        this.refreshKeywordHighlights();
    }

    setupDraggableKeywords(container) {
        if (!container) return;
        const kws = container.querySelectorAll(".kw");
        kws.forEach(el => {
            el.setAttribute("draggable", "true");
            const word = el.getAttribute("data-word") || el.innerText.trim();
            el.setAttribute("data-word", word);

            el.onclick = (e) => {
                e.stopPropagation();
                this.collectWord(el, word);
            };

            el.addEventListener("dragstart", (e) => {
                this.draggedSourceSlotId = null;
                e.dataTransfer.setData("text/plain", word);
                this.collectWord(el, word);
            });
        });
    }

    collectWord(el, word) {
        let isNew = !this.collectedWords.has(word);
        if (isNew) {
            this.collectedWords.add(word);
            this.showToast(`[+] Added Keyword: "${word}"`);
            this.checkLoreUnlocks(word);
            this.updateKeywordCounter();
            this.refreshKeywordHighlights();
            this.renderTray();
            this.saveProgress();
        }
    }

    refreshKeywordHighlights() {
        document.querySelectorAll(".kw").forEach(el => {
            const text = el.getAttribute("data-word") || el.innerText.trim();
            if (this.collectedWords.has(text)) {
                el.classList.add("collected");
            } else {
                el.classList.remove("collected");
            }
        });
    }

    updateKeywordCounter() {
        const countEl = document.getElementById("kw-count");
        if (countEl) {
            countEl.innerText = `${this.collectedWords.size}/${this.totalUniqueKeywords}`;
        }
    }

    renderFilterChips() {
        const filterContainer = document.getElementById("filter-chips-bar");
        if (!filterContainer) return;

        const defaultCategories = [
            { id: "all", label: "All" },
            { id: "name", label: "👤 Names" },
            { id: "location", label: "📍 Locations" },
            { id: "verb", label: "⚡ Actions" },
            { id: "medical", label: "💊 Medical" },
            { id: "temporal", label: "🌀 Temporal" },
            { id: "calendar", label: "📅 Dates" },
            { id: "noun", label: "📦 Nouns" }
        ];

        const customCategories = this.currentCase?.customCategories || defaultCategories;
        filterContainer.innerHTML = "";

        const allBtn = document.createElement("button");
        allBtn.className = "filter-chip active";
        allBtn.innerText = "All";
        allBtn.onclick = () => this.setKeywordFilter("all", allBtn);
        filterContainer.appendChild(allBtn);

        customCategories.forEach(cat => {
            if (cat.id === "all") return;
            const btn = document.createElement("button");
            btn.className = "filter-chip";
            btn.innerText = cat.label || cat.id;
            btn.onclick = () => this.setKeywordFilter(cat.tag || cat.id, btn);
            filterContainer.appendChild(btn);
        });
    }

    setKeywordFilter(filterKey, btnEl) {
        this.currentFilter = filterKey;
        document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
        if (btnEl) btnEl.classList.add("active");
        this.renderTray();
    }

    setKeywordSort(sortKey) {
        this.currentSort = sortKey;
        this.renderTray();
    }

    renderTray() {
        const grid = document.getElementById("tray-grid");
        if (!grid) return;
        grid.innerHTML = "";

        if (this.collectedWords.size === 0) {
            grid.innerHTML = `<div style="color: var(--text-tertiary); font-size: 11px; padding: 10px; line-height: 1.5;">Click highlighted keywords in scene clues to collect them into your case tray.</div>`;
            return;
        }

        const tagsDict = this.currentCase?.keywordTags || {};
        let wordsArray = Array.from(this.collectedWords);

        if (this.currentFilter !== "all") {
            wordsArray = wordsArray.filter(w => {
                const tags = tagsDict[w] || ["noun"];
                return tags.includes(this.currentFilter);
            });
        }

        if (this.currentSort === "alpha-asc") {
            wordsArray.sort((a, b) => a.localeCompare(b));
        } else if (this.currentSort === "alpha-desc") {
            wordsArray.sort((a, b) => b.localeCompare(a));
        }

        if (this.currentSort === "category") {
            const categoryDefs = this.currentCase?.customCategories || [
                { id: "names", label: "👤 Names & People", tag: "name" },
                { id: "locations", label: "📍 Locations & Facilities", tag: "location" },
                { id: "verbs", label: "⚡ Actions & Verbs", tag: "verb" },
                { id: "medical", label: "💊 Medical & Pathology", tag: "medical" },
                { id: "temporal", label: "🌀 Temporal & Anomalies", tag: "temporal" },
                { id: "calendar", label: "📅 Calendar & Dates", tag: "calendar" },
                { id: "nouns", label: "📦 General Items", tag: "noun" }
            ];

            let renderedAny = false;
            categoryDefs.forEach(cat => {
                const wordsInGroup = wordsArray.filter(w => {
                    const tags = tagsDict[w] || ["noun"];
                    return tags.includes(cat.tag || cat.id);
                });

                if (wordsInGroup.length > 0) {
                    renderedAny = true;
                    const catContainer = document.createElement("div");
                    catContainer.className = "tray-category-block";
                    catContainer.innerHTML = `
                        <div class="tray-category-header">${cat.label} (${wordsInGroup.length})</div>
                        <div class="tray-category-words" id="cat-grid-${cat.id}"></div>
                    `;
                    grid.appendChild(catContainer);
                    const catGrid = catContainer.querySelector(`#cat-grid-${cat.id}`);
                    wordsInGroup.forEach(w => catGrid.appendChild(this.createTrayWordElement(w)));
                }
            });

            if (!renderedAny && wordsArray.length > 0) {
                const flat = document.createElement("div");
                flat.className = "tray-category-words";
                wordsArray.forEach(w => flat.appendChild(this.createTrayWordElement(w)));
                grid.appendChild(flat);
            }
        } else {
            const flatContainer = document.createElement("div");
            flatContainer.className = "tray-category-words";
            wordsArray.forEach(w => flatContainer.appendChild(this.createTrayWordElement(w)));
            grid.appendChild(flatContainer);
        }
    }

    createTrayWordElement(word) {
        const btn = document.createElement("div");
        btn.className = "tray-word";
        btn.innerText = word;
        btn.setAttribute("draggable", "true");
        btn.setAttribute("data-word", word);

        btn.addEventListener("dragstart", (e) => {
            this.draggedSourceSlotId = null;
            e.dataTransfer.setData("text/plain", word);
        });

        return btn;
    }

    checkLoreUnlocks(newWord) {
        if (!this.currentCase?.lore) return;
        for (let [key, lore] of Object.entries(this.currentCase.lore)) {
            const reqWords = lore.requiredWords || [key];
            if (reqWords.includes(newWord) && !this.unlockedLore.has(lore.id || key)) {
                this.unlockedLore.add(lore.id || key);
                this.showToast(`[☭ LOGOS-3] New Archive Dossier Decrypted: ${lore.title}`);
                this.renderLoreList();
                this.saveProgress();
            }
        }
    }

    renderLoreList() {
        const container = document.getElementById("lore-list");
        const countEl = document.getElementById("lore-count");
        if (!container) return;

        const loreObj = this.currentCase?.lore || {};
        const loreKeys = Object.keys(loreObj);

        if (countEl) {
            countEl.innerText = loreKeys.length > 0 ? `${this.unlockedLore.size}/${loreKeys.length}` : "0/0";
        }
        container.innerHTML = "";

        if (loreKeys.length === 0) {
            container.innerHTML = `<div style="color: var(--text-tertiary); font-size: 11px; padding: 10px; line-height: 1.5;">No encrypted dossiers in this case file.</div>`;
            return;
        }

        for (let [key, lore] of Object.entries(loreObj)) {
            const loreId = lore.id || key;
            const isUnlocked = this.unlockedLore.has(loreId);
            if (isUnlocked) {
                container.innerHTML += `
                    <div class="lore-card" onclick="window.gameEngine.openLoreModal('${loreId}')">
                        <div class="lore-tag">${lore.tag || "ARCHIVE"}</div>
                        <div class="lore-title">📄 ${lore.title}</div>
                        <div class="lore-status">▶ Click to Open File</div>
                    </div>
                `;
            } else {
                container.innerHTML += `
                    <div class="lore-card locked">
                        <div class="lore-tag">RESTRICTED ARCHIVE</div>
                        <div class="lore-title">🔒 [Encrypted Document]</div>
                        <div class="lore-status" style="color: var(--text-tertiary);">Locked</div>
                    </div>
                `;
            }
        }
    }

    // --- Window Focus & Multi-Lore Windows ---

    bringToFront(el) {
        if (!el) return;
        this.highestZIndex += 2;
        el.style.zIndex = this.highestZIndex;
    }

    makeWindowDraggable(modal, header) {
        if (!modal || !header) return;

        modal.addEventListener("mousedown", () => this.bringToFront(modal));
        modal.addEventListener("touchstart", () => this.bringToFront(modal), { passive: true });

        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        const startDrag = (clientX, clientY, target) => {
            if (window.innerWidth <= 900) return;
            if (target.tagName === "BUTTON" || target.closest("button") || target.tagName === "INPUT") return;
            this.bringToFront(modal);
            isDragging = true;
            startX = clientX;
            startY = clientY;
            const rect = modal.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            document.body.style.userSelect = "none";
        };

        const moveDrag = (clientX, clientY) => {
            if (!isDragging) return;
            const dx = clientX - startX;
            const dy = clientY - startY;
            modal.style.left = `${initialLeft + dx}px`;
            modal.style.top = `${initialTop + dy}px`;
        };

        const endDrag = () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = "";
            }
        };

        header.addEventListener("mousedown", (e) => startDrag(e.clientX, e.clientY, e.target));
        document.addEventListener("mousemove", (e) => moveDrag(e.clientX, e.clientY));
        document.addEventListener("mouseup", endDrag);

        header.addEventListener("touchstart", (e) => {
            if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY, e.target);
        }, { passive: true });
        document.addEventListener("touchmove", (e) => {
            if (isDragging && e.touches.length === 1) moveDrag(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        document.addEventListener("touchend", endDrag);
    }

    makeWindowResizable(modal, handle, storageKeyPrefix = "docket") {
        if (!modal || !handle) return;

        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        const startResize = (clientX, clientY) => {
            if (window.innerWidth <= 900) return;
            this.bringToFront(modal);
            isResizing = true;
            startX = clientX;
            startY = clientY;
            const rect = modal.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;
            document.body.style.userSelect = "none";
            modal.classList.remove("expanded");
        };

        const moveResize = (clientX, clientY) => {
            if (!isResizing) return;
            const newWidth = Math.max(460, Math.min(window.innerWidth * 0.98, startWidth + (clientX - startX)));
            const newHeight = Math.max(380, Math.min(window.innerHeight * 0.96, startHeight + (clientY - startY)));
            modal.style.width = `${newWidth}px`;
            modal.style.height = `${newHeight}px`;
        };

        const endResize = () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.userSelect = "";
                const rect = modal.getBoundingClientRect();
                localStorage.setItem(`${storageKeyPrefix}_width`, Math.round(rect.width));
                localStorage.setItem(`${storageKeyPrefix}_height`, Math.round(rect.height));
            }
        };

        handle.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            startResize(e.clientX, e.clientY);
        });
        document.addEventListener("mousemove", (e) => moveResize(e.clientX, e.clientY));
        document.addEventListener("mouseup", endResize);

        handle.addEventListener("touchstart", (e) => {
            if (e.touches.length === 1) {
                e.stopPropagation();
                startResize(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });
        document.addEventListener("touchmove", (e) => {
            if (isResizing && e.touches.length === 1) {
                moveResize(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: true });
        document.addEventListener("touchend", endResize);
    }

    restoreDocketSize() {
        if (window.innerWidth <= 900) return;
        const savedW = localStorage.getItem("docket_width");
        const savedH = localStorage.getItem("docket_height");
        if (this.docketModal) {
            if (savedW && parseInt(savedW, 10) >= 460) {
                this.docketModal.style.width = `${Math.min(parseInt(savedW, 10), window.innerWidth * 0.98)}px`;
            } else {
                this.docketModal.style.width = "";
            }
            if (savedH && parseInt(savedH, 10) >= 380) {
                this.docketModal.style.height = `${Math.min(parseInt(savedH, 10), window.innerHeight * 0.96)}px`;
            } else {
                this.docketModal.style.height = "";
            }
        }
    }

    toggleDocketExpand() {
        if (!this.docketModal) this.docketModal = document.getElementById("docket-modal");
        if (!this.docketModal) return;

        const isExpanded = this.docketModal.classList.toggle("expanded");
        const btn = document.getElementById("docket-expand-btn");
        if (btn) {
            btn.innerText = isExpanded ? "⤦" : "⤢";
            btn.title = isExpanded ? "Restore Previous Size" : "Maximize Docket";
        }
        if (!isExpanded) {
            this.restoreDocketSize();
        }
        this.setupDocketScrollIndicators();
        window.sfx?.playClick();
    }

    openLoreModal(loreId) {
        if (!this.currentCase?.lore) return;
        let foundLore = null;
        for (let k in this.currentCase.lore) {
            const l = this.currentCase.lore[k];
            if ((l.id || k) === loreId) {
                foundLore = l;
                break;
            }
        }
        if (!foundLore) return;

        let modal = document.getElementById(`lore-modal-${loreId}`);
        if (!modal) {
            const container = document.getElementById("lore-windows-container") || document.body;
            const modalDiv = document.createElement("div");
            modalDiv.id = `lore-modal-${loreId}`;
            modalDiv.className = "lore-viewer-modal";

            const staggerIndex = this.openLoreCount % 5;
            const defaultTop = Math.min(window.innerHeight - 250, 60 + staggerIndex * 35);
            const defaultLeft = Math.max(20, Math.floor(window.innerWidth / 2 - 280) + (staggerIndex * 35 - 70));
            modalDiv.style.top = `${defaultTop}px`;
            modalDiv.style.left = `${defaultLeft}px`;

            let metaHtml = "";
            if (foundLore.registration || foundLore.jurisdiction || foundLore.diagnosticCode || foundLore.facility || foundLore.organization || foundLore.established || foundLore.location || foundLore.etiology) {
                let rows = [];
                if (foundLore.organization) rows.push(`<strong>ORGANIZATION:</strong> ${this.parseText(foundLore.organization)}`);
                if (foundLore.established) rows.push(`<strong>ESTABLISHED:</strong> ${this.parseText(foundLore.established)}`);
                if (foundLore.registration) rows.push(`<strong>REGISTRATION:</strong> ${this.parseText(foundLore.registration)}`);
                if (foundLore.jurisdiction) rows.push(`<strong>JURISDICTION:</strong> ${this.parseText(foundLore.jurisdiction)}`);
                if (foundLore.facility) rows.push(`<strong>FACILITY:</strong> ${this.parseText(foundLore.facility)}`);
                if (foundLore.location) rows.push(`<strong>LOCATION:</strong> ${this.parseText(foundLore.location)}`);
                if (foundLore.diagnosticCode) rows.push(`<strong>DIAGNOSTIC CODE:</strong> ${this.parseText(foundLore.diagnosticCode)}`);
                if (foundLore.etiology) rows.push(`<strong>ETIOLOGY:</strong> ${this.parseText(foundLore.etiology)}`);

                metaHtml = `
                    <div style="margin-bottom: 12px; padding: 6px 10px; background: var(--bg-tertiary); border-left: 2px solid var(--accent); font-size: 11px; line-height: 1.6;">
                        ${rows.join("<br>")}
                    </div>
                `;
            }

            const bodyHtml = this.parseText(foundLore.body || foundLore.text || "");

            modalDiv.innerHTML = `
                <div class="lore-viewer-paper">
                    <div class="lore-viewer-header">
                        <div style="font-size: 10px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 1.5px;">${foundLore.tag || "ARCHIVE"}</div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button onclick="window.gameEngine.closeLoreModal('${loreId}')" style="background: transparent; border: none; color: var(--text-primary); font-size: 16px; cursor: pointer; line-height: 1; padding: 2px 6px;">✕</button>
                        </div>
                    </div>
                    <div class="lore-viewer-body">
                        <h3 style="font-size: 15px; color: var(--text-primary); margin-bottom: 12px; border-bottom: 1px dashed var(--border-color); padding-bottom: 6px;">${foundLore.title}</h3>
                        ${metaHtml}
                        <div class="lore-modal-content" style="font-size: 12px; color: var(--text-secondary); line-height: 1.8;">
                            ${bodyHtml}
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(modalDiv);
            modal = modalDiv;
            this.openLoreCount++;

            const header = modal.querySelector(".lore-viewer-header");
            this.makeWindowDraggable(modal, header);

            const bodyEl = modal.querySelector(".lore-viewer-body");
            this.setupDraggableKeywords(bodyEl);
        } else {
            modal.classList.remove("hidden");
        }

        window.sfx?.playOpen();
        this.bringToFront(modal);
        this.refreshKeywordHighlights();
    }

    closeLoreModal(loreId) {
        window.sfx?.playClose();
        if (loreId) {
            const modal = document.getElementById(`lore-modal-${loreId}`);
            if (modal) modal.remove();
        } else {
            document.querySelectorAll(".lore-viewer-modal").forEach(m => m.remove());
        }
    }

    openTableModal(timeKey, clueIdx) {
        let clue = null;
        if (this.currentCase?.timeline) {
            for (let k in this.currentCase.timeline) {
                if (k === timeKey || k.replace(/[^a-zA-Z0-9_-]/g, "_") === timeKey) {
                    clue = this.currentCase.timeline[k]?.clues?.[clueIdx];
                    break;
                }
            }
        }
        if (!clue || (!clue.table && !clue.roster)) return;

        const t = clue.table || clue.roster;
        const modalId = `table-modal-${timeKey}-${clueIdx}`;

        let modal = document.getElementById(modalId);
        if (!modal) {
            const container = document.getElementById("lore-windows-container") || document.body;
            const modalDiv = document.createElement("div");
            modalDiv.id = modalId;
            modalDiv.className = "lore-viewer-modal table-viewer-modal";

            const defaultTop = Math.max(40, Math.floor(window.innerHeight / 2 - 240));
            const defaultLeft = Math.max(20, Math.floor(window.innerWidth / 2 - 390));
            modalDiv.style.top = `${defaultTop}px`;
            modalDiv.style.left = `${defaultLeft}px`;

            let headersHtml = "";
            (t.headers || []).forEach(h => {
                headersHtml += `<th style="padding: 10px 14px; border-bottom: 2px solid var(--accent); text-align: left; font-size: 11px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap;">${this.parseText(h)}</th>`;
            });

            let rowsHtml = "";
            (t.rows || []).forEach((row, rIdx) => {
                let cellsHtml = "";
                const rowBg = rIdx % 2 === 0 ? "var(--bg-secondary)" : "transparent";
                (row || []).forEach(cell => {
                    cellsHtml += `<td style="padding: 10px 14px; border-bottom: 1px dashed var(--border-color); font-size: 12px; vertical-align: middle; color: var(--text-primary);">${this.parseText(cell)}</td>`;
                });
                rowsHtml += `<tr style="background: ${rowBg};">${cellsHtml}</tr>`;
            });

            const captionHtml = t.caption ? `<div style="font-size: 11px; color: var(--text-tertiary); margin-bottom: 12px; font-style: italic; border-left: 2px solid var(--accent); padding-left: 8px;">${this.parseText(t.caption)}</div>` : "";
            const footerHtml = t.footer ? `<div style="font-size: 11px; color: var(--text-secondary); margin-top: 14px; border-top: 1px solid var(--border-color); padding-top: 10px; line-height: 1.5;">${this.parseText(t.footer)}</div>` : "";

            modalDiv.innerHTML = `
                <div class="lore-viewer-paper">
                    <div class="lore-viewer-header">
                        <div style="font-size: 10px; color: var(--accent); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">📋 ${t.badge || clue.title || "OFFICIAL DOCUMENT"}</div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button onclick="window.gameEngine.closeTableModal('${modalId}')" style="background: transparent; border: none; color: var(--text-primary); font-size: 16px; cursor: pointer; line-height: 1; padding: 2px 6px;">✕</button>
                        </div>
                    </div>
                    <div class="lore-viewer-body" style="padding: 16px; display: flex; flex-direction: column; overflow: hidden;">
                        <h3 style="font-size: 16px; color: var(--text-primary); margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 6px;">${clue.title || "Official Roster"}</h3>
                        ${captionHtml}
                        <div style="overflow-x: auto; overflow-y: auto; max-height: 55vh; background: var(--bg-tertiary); border: 1px solid var(--border-color); border-radius: 4px;">
                            <table style="width: 100%; border-collapse: collapse; min-width: 620px;">
                                ${headersHtml ? `<thead style="position: sticky; top: 0; background: var(--bg-secondary); z-index: 1;"><tr>${headersHtml}</tr></thead>` : ""}
                                <tbody>${rowsHtml}</tbody>
                            </table>
                        </div>
                        ${footerHtml}
                    </div>
                </div>
            `;
            container.appendChild(modalDiv);
            modal = modalDiv;
            this.openTableCount++;

            const header = modal.querySelector(".lore-viewer-header");
            this.makeWindowDraggable(modal, header);

            const bodyEl = modal.querySelector(".lore-viewer-body");
            this.setupDraggableKeywords(bodyEl);
        } else {
            modal.classList.remove("hidden");
        }

        window.sfx?.playOpen();
        this.bringToFront(modal);
        this.refreshKeywordHighlights();
    }

    closeTableModal(modalId) {
        window.sfx?.playClose();
        if (modalId) {
            const modal = document.getElementById(modalId);
            if (modal) modal.remove();
        } else {
            document.querySelectorAll(".table-viewer-modal").forEach(m => m.remove());
        }
    }

    // --- Onboarding Tutorial / Field Manual Modal ---

    openTutorial() {
        const modal = document.getElementById("tutorial-modal");
        if (modal) {
            modal.classList.remove("hidden");
            const dontShow = document.getElementById("tutorial-dont-show");
            if (dontShow) {
                dontShow.checked = (localStorage.getItem("deduction_engine_tutorial_suppressed") === "true");
            }
        }
    }

    closeTutorial() {
        const modal = document.getElementById("tutorial-modal");
        if (modal) {
            modal.classList.add("hidden");
        }
        const dontShow = document.getElementById("tutorial-dont-show");
        if (dontShow && dontShow.checked) {
            localStorage.setItem("deduction_engine_tutorial_suppressed", "true");
        } else {
            localStorage.removeItem("deduction_engine_tutorial_suppressed");
        }
    }

    escapeHtml(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // --- Slot Autocomplete & Dropdown Suggestion Picker ---

    initSlotPicker() {
        const popover = document.getElementById("slot-picker-popover");
        const input = document.getElementById("slot-picker-input");
        if (!popover || !input) return;

        input.addEventListener("input", (e) => {
            this.filterSlotPicker(e.target.value);
        });

        input.addEventListener("keydown", (e) => {
            const list = document.getElementById("slot-picker-list");
            const items = list ? Array.from(list.querySelectorAll(".slot-picker-item")) : [];

            if (e.key === "ArrowDown") {
                e.preventDefault();
                if (items.length === 0) return;
                this.pickerHighlightedIndex = (this.pickerHighlightedIndex + 1) % items.length;
                this.updatePickerHighlight(items);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (items.length === 0) return;
                this.pickerHighlightedIndex = (this.pickerHighlightedIndex - 1 + items.length) % items.length;
                this.updatePickerHighlight(items);
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (this.pickerHighlightedIndex >= 0 && items[this.pickerHighlightedIndex]) {
                    items[this.pickerHighlightedIndex].click();
                } else if (items.length === 1) {
                    items[0].click();
                } else {
                    const query = input.value.trim().toLowerCase();
                    if (!query) {
                        this.closeSlotPicker();
                        return;
                    }
                    // Try exact match in collected words
                    for (let word of this.collectedWords) {
                        if (word.toLowerCase() === query) {
                            this.selectKeywordForSlot(word);
                            return;
                        }
                    }
                }
            } else if (e.key === "Escape") {
                e.preventDefault();
                this.closeSlotPicker();
            }
        });

        // Close when clicking or touching outside
        document.addEventListener("mousedown", (e) => {
            if (!popover.classList.contains("hidden")) {
                if (!popover.contains(e.target) && !e.target.closest(".slot")) {
                    this.closeSlotPicker();
                }
            }
        });

        document.addEventListener("touchstart", (e) => {
            if (!popover.classList.contains("hidden")) {
                if (!popover.contains(e.target) && !e.target.closest(".slot")) {
                    this.closeSlotPicker();
                }
            }
        }, { passive: true });
    }

    updatePickerHighlight(items) {
        items.forEach((item, idx) => {
            if (idx === this.pickerHighlightedIndex) {
                item.classList.add("highlighted");
                item.scrollIntoView({ block: "nearest" });
            } else {
                item.classList.remove("highlighted");
            }
        });
    }

    matchesSlotTag(word, slotTag) {
        if (!slotTag || slotTag === "all") return true;
        const normTag = slotTag.toLowerCase().trim();
        const tagsDict = this.currentCase?.keywordTags || {};
        let wordTags = tagsDict[word];

        if (!wordTags) {
            wordTags = ["noun"];
        } else if (typeof wordTags === "string") {
            wordTags = [wordTags];
        }

        const normWordTags = wordTags.map(t => String(t).toLowerCase().trim());

        // Direct match
        if (normWordTags.includes(normTag)) return true;

        // Semantic / Category Alias groups
        const aliasGroups = [
            ["name", "names", "person", "people", "suspect", "victim", "witness", "officer"],
            ["location", "locations", "place", "places", "facility", "venue", "city", "region", "country", "destination"],
            ["verb", "verbs", "action", "actions"],
            ["medical", "medicine", "drug", "pathology", "symptom"],
            ["temporal", "time", "anomaly"],
            ["calendar", "date", "dates", "day", "month", "year"],
            ["noun", "nouns", "item", "items", "vehicle", "weapon", "object"]
        ];

        for (const group of aliasGroups) {
            if (group.includes(normTag)) {
                if (normWordTags.some(t => group.includes(t))) {
                    return true;
                }
            }
        }

        return false;
    }

    openSlotPicker(slot) {
        if (this.justTouchDragged) return;
        const popover = document.getElementById("slot-picker-popover");
        const input = document.getElementById("slot-picker-input");
        const clearBtn = document.getElementById("slot-picker-clear-btn");
        const badge = document.getElementById("slot-picker-constraint-badge");
        if (!popover || !input) return;

        this.activeSlot = slot;
        this.pickerHighlightedIndex = -1;

        const slotId = slot.getAttribute("data-id");
        const slotTag = slot.getAttribute("data-tag");
        const currentWord = this.docketSlots[slotId] || "";

        if (clearBtn) {
            clearBtn.style.display = currentWord ? "inline-block" : "none";
        }

        if (badge) {
            if (slotTag) {
                badge.style.display = "inline-flex";
                badge.innerText = slotTag.toUpperCase();
            } else {
                badge.style.display = "none";
            }
        }

        if (input) {
            input.placeholder = slotTag ? `Filter [${slotTag.toUpperCase()}] keywords...` : "Search keywords...";
        }

        // Positioning for Desktop / Tablet (Mobile is anchored as bottom sheet via CSS)
        if (window.innerWidth > 600) {
            const rect = slot.getBoundingClientRect();
            let top = rect.bottom + 6;
            let left = rect.left;

            if (left + 280 > window.innerWidth - 10) {
                left = Math.max(10, window.innerWidth - 290);
            }
            if (top + 240 > window.innerHeight - 10) {
                top = Math.max(10, rect.top - 240);
            }

            popover.style.top = `${top}px`;
            popover.style.left = `${left}px`;
        }

        popover.classList.remove("hidden");
        input.value = "";
        this.filterSlotPicker("");
        setTimeout(() => input.focus(), 60);
    }

    filterSlotPicker(query = "") {
        const list = document.getElementById("slot-picker-list");
        if (!list) return;
        list.innerHTML = "";

        const slotId = this.activeSlot?.getAttribute("data-id");
        const slotTag = this.activeSlot?.getAttribute("data-tag");
        const currentSlotWord = slotId ? this.docketSlots[slotId] : "";

        const q = (query || "").trim().toLowerCase();
        let words = Array.from(this.collectedWords);

        // Filter by slot tag constraint if defined on slot
        if (slotTag) {
            words = words.filter(w => this.matchesSlotTag(w, slotTag));
        }

        if (words.length === 0) {
            if (slotTag) {
                list.innerHTML = `<div class="slot-picker-empty">No [${this.escapeHtml(slotTag.toUpperCase())}] keywords collected yet.<br>Explore scene clues & timeline first!</div>`;
            } else {
                list.innerHTML = `<div class="slot-picker-empty">No keywords collected yet.<br>Explore scene clues & timeline first!</div>`;
            }
            return;
        }

        // Sort alphabetically
        words.sort((a, b) => a.localeCompare(b));

        if (q) {
            words = words.filter(w => w.toLowerCase().includes(q));
        }

        if (words.length === 0) {
            list.innerHTML = `<div class="slot-picker-empty">No matching keywords for "${this.escapeHtml(query)}"</div>`;
            return;
        }

        const tagsDict = this.currentCase?.keywordTags || {};

        words.forEach((word) => {
            const tags = tagsDict[word] || ["noun"];
            let icon = "📦";
            if (tags.includes("name")) icon = "👤";
            else if (tags.includes("location")) icon = "📍";
            else if (tags.includes("verb")) icon = "⚡";
            else if (tags.includes("medical")) icon = "💊";
            else if (tags.includes("temporal")) icon = "🌀";
            else if (tags.includes("calendar")) icon = "📅";

            const item = document.createElement("button");
            item.type = "button";
            item.className = "slot-picker-item";
            if (word === currentSlotWord) {
                item.classList.add("active-choice");
            }

            item.innerHTML = `
                <div class="slot-picker-item-left">
                    <span class="slot-picker-cat-badge">${icon}</span>
                    <span>${this.escapeHtml(word)}</span>
                </div>
                ${word === currentSlotWord ? '<span style="font-size: 11px;">✓</span>' : ""}
            `;

            item.addEventListener("click", () => {
                this.selectKeywordForSlot(word);
            });

            list.appendChild(item);
        });

        this.pickerHighlightedIndex = -1;
    }

    selectKeywordForSlot(word) {
        if (!this.activeSlot) return;
        const slotId = this.activeSlot.getAttribute("data-id");
        this.activeSlot.innerText = word;
        this.activeSlot.classList.add("filled");
        this.activeSlot.classList.remove("wrong", "correct");
        this.docketSlots[slotId] = word;
        window.sfx?.playSnap();
        this.updateProgress();
        this.saveProgress();
        this.closeSlotPicker();
    }

    clearActiveSlot() {
        if (!this.activeSlot) return;
        const slotId = this.activeSlot.getAttribute("data-id");
        this.activeSlot.innerText = "[ ? ]";
        this.activeSlot.classList.remove("filled", "wrong", "correct");
        delete this.docketSlots[slotId];
        window.sfx?.playPop();
        this.updateProgress();
        this.saveProgress();
        this.closeSlotPicker();
    }

    closeSlotPicker() {
        const popover = document.getElementById("slot-picker-popover");
        if (popover) popover.classList.add("hidden");
        this.activeSlot = null;
        this.pickerHighlightedIndex = -1;
    }

    // --- Docket Modal & Slots ---

    setupDocketScrollIndicators() {
        const container = document.getElementById("docket-body-container");
        const body = document.getElementById("docket-body-content");
        if (!container || !body) return;

        const updateIndicators = () => {
            const scrollTop = body.scrollTop;
            const maxScrollTop = body.scrollHeight - body.clientHeight;
            const hasTop = scrollTop > 8;
            const hasBottom = maxScrollTop > 8 && scrollTop < maxScrollTop - 8;

            container.classList.toggle("has-overflow-top", hasTop);
            container.classList.toggle("has-overflow-bottom", hasBottom);
        };

        if (!this._docketScrollBound) {
            this._docketScrollBound = true;
            body.addEventListener("scroll", updateIndicators, { passive: true });
            window.addEventListener("resize", updateIndicators);
        }

        setTimeout(updateIndicators, 50);
        setTimeout(updateIndicators, 250);
    }

    openDocket() {
        if (!this.docketModal) this.docketModal = document.getElementById("docket-modal");
        if (this.docketModal) {
            this.docketModal.classList.remove("hidden");
            if (!this.docketModal.classList.contains("expanded")) {
                this.restoreDocketSize();
            }
            this.bringToFront(this.docketModal);
            this.setupDocketScrollIndicators();
            window.sfx?.playOpen();
        }
    }

    closeDocket() {
        this.closeSlotPicker();
        if (!this.docketModal) this.docketModal = document.getElementById("docket-modal");
        if (this.docketModal) {
            this.docketModal.classList.add("hidden");
            window.sfx?.playClose();
        }
    }

    bindDocketSlotEvents() {
        const slots = document.querySelectorAll(".slot");
        slots.forEach(slot => {
            slot.onclick = () => this.handleSlotClick(slot);
        });

        const numSlots = document.querySelectorAll(".num-slot");
        numSlots.forEach(input => {
            input.oninput = () => this.handleNumInput(input);
        });

        this.initSlotDragAndDrop();
    }

    handleSlotClick(el) {
        if (this.justTouchDragged) return;
        this.openSlotPicker(el);
    }

    handleNumInput(el) {
        el.value = el.value.replace(/[^0-9]/g, "");
        const slotId = el.getAttribute("data-id");
        const val = el.value.trim();

        if (val.length > 0) {
            el.classList.add("filled");
            el.classList.remove("wrong", "correct");
            this.docketSlots[slotId] = val;
        } else {
            el.classList.remove("filled", "wrong", "correct");
            delete this.docketSlots[slotId];
        }
        this.updateProgress();
        this.saveProgress();
    }

    clearDocket() {
        this.closeSlotPicker();
        this.docketSlots = {};
        document.querySelectorAll(".slot").forEach(slot => {
            slot.innerText = "[ ? ]";
            slot.classList.remove("filled", "wrong", "correct");
        });
        document.querySelectorAll(".num-slot").forEach(input => {
            input.value = "";
            input.classList.remove("filled", "wrong", "correct");
        });
        window.sfx?.playPop();
        this.updateProgress();
        this.saveProgress();
    }

    verifyDocket() {
        if (!this.currentCase?.solution) {
            this.showToast("No solution defined for this case.");
            return;
        }

        const solution = this.currentCase.solution;
        let correctCount = 0;
        const total = Object.keys(solution).length;

        // Remove any previous highlight classes to avoid revealing specific slot correctness
        document.querySelectorAll(".slot, .num-slot").forEach(slot => {
            slot.classList.remove("wrong", "correct");
        });

        for (let [slotId, correctAns] of Object.entries(solution)) {
            const userVal = this.docketSlots[slotId];

            let isCorrect = false;
            if (userVal !== undefined && userVal !== null && userVal !== "") {
                if (Array.isArray(correctAns)) {
                    isCorrect = correctAns.includes(userVal);
                } else {
                    isCorrect = (userVal === correctAns);
                }
            }

            if (isCorrect) {
                correctCount++;
            }
        }

        const incorrectCount = total - correctCount;

        if (incorrectCount === 0) {
            // 1. Correct (All correct) - Mark case as solved in localStorage
            const caseId = this.currentCase?.id || "chapter_01_morning_routine";
            localStorage.setItem(`case_solved_${caseId}`, "true");

            window.sfx?.playSuccess();
            this.showToast("✓ Status: Correct");
            this.openVictoryModal();
        } else if (incorrectCount < 3) {
            // 2. Almost there (< 3 incorrect)
            window.sfx?.playError();
            this.showToast("⚠️ Status: Almost there");
        } else {
            // 3. Incorrect (>= 3 incorrect)
            window.sfx?.playError();
            this.showToast("❌ Status: Incorrect");
        }
    }

    openVictoryModal() {
        const modal = document.getElementById("victory-modal");
        if (!modal) return;
        modal.classList.remove("hidden");

        const msgEl = document.getElementById("victory-message-text");
        if (msgEl) {
            msgEl.innerText = this.currentCase?.meta?.successMessage || "All case parameters have been verified!";
        }

        const unlockInfo = this.currentCase?.meta?.unlocks || this.currentCase?.meta?.unlocksChapter;
        const unlockCard = modal.querySelector(".victory-unlocked-card");
        const readBtn = modal.querySelector("#victory-read-btn") || modal.querySelector(".victory-read-btn");

        if (unlockInfo && (unlockInfo.chapter || unlockInfo.file)) {
            const targetFile = unlockInfo.chapter || unlockInfo.file;
            if (unlockCard) {
                unlockCard.style.display = "flex";
                const titleEl = unlockCard.querySelector(".unlocked-card-title");
                const descEl = unlockCard.querySelector(".unlocked-card-desc");
                if (titleEl) titleEl.innerText = unlockInfo.title || "Novel Chapter Unlocked";
                if (descEl) descEl.innerText = unlockInfo.description || unlockInfo.desc || "Proceed to the Novel Reader to continue reading.";
            }
            if (readBtn) {
                readBtn.style.display = "inline-flex";
                readBtn.href = `index.html?file=${encodeURIComponent(targetFile)}`;
                readBtn.innerText = unlockInfo.buttonText || "📖 Read in Novel Reader ↵";
            }
        } else {
            if (unlockCard) unlockCard.style.display = "none";
            if (readBtn) readBtn.style.display = "none";
        }
    }

    closeVictoryModal() {
        const modal = document.getElementById("victory-modal");
        if (modal) {
            modal.classList.add("hidden");
        }
    }

    updateProgress() {
        if (!this.currentCase?.solution) return;
        const total = Object.keys(this.currentCase.solution).length;
        const filled = Object.keys(this.docketSlots).length;
        const progressEl = document.getElementById("progress-text");
        if (progressEl) {
            progressEl.innerText = `Deduction Progress: ${filled}/${total} slots filled`;
        }
    }

    // --- Drag & Drop Engines (HTML5 Desktop + Touch Mobile) ---

    initSlotDragAndDrop() {
        const slots = document.querySelectorAll(".slot, .num-slot");
        slots.forEach(slot => {
            slot.setAttribute("draggable", "true");

            slot.addEventListener("dragstart", (e) => {
                const slotId = slot.getAttribute("data-id");
                let currentWord = "";
                if (slot.classList.contains("num-slot")) {
                    currentWord = slot.value.trim();
                } else {
                    currentWord = slot.innerText.trim();
                    if (currentWord === "[ ? ]") currentWord = "";
                }

                if (currentWord) {
                    this.draggedSourceSlotId = slotId;
                    e.dataTransfer.setData("text/plain", currentWord);
                    e.dataTransfer.setData("application/x-docket-slot", slotId);
                } else {
                    e.preventDefault();
                }
            });

            slot.addEventListener("dragover", (e) => {
                e.preventDefault();
                slot.classList.add("drag-over");
            });

            slot.addEventListener("dragleave", () => {
                slot.classList.remove("drag-over");
            });

            slot.addEventListener("drop", (e) => {
                e.preventDefault();
                slot.classList.remove("drag-over");

                const incomingWord = e.dataTransfer.getData("text/plain");
                if (!incomingWord) return;

                const targetSlotId = slot.getAttribute("data-id");
                const sourceSlotId = this.draggedSourceSlotId || e.dataTransfer.getData("application/x-docket-slot");

                let existingTargetWord = "";
                if (slot.classList.contains("num-slot")) {
                    existingTargetWord = slot.value.trim();
                } else {
                    existingTargetWord = slot.innerText.trim();
                    if (existingTargetWord === "[ ? ]") existingTargetWord = "";
                }

                const sourceEl = sourceSlotId ? document.querySelector(`[data-id="${sourceSlotId}"]`) : null;

                if (slot.classList.contains("num-slot")) {
                    const digits = incomingWord.replace(/[^0-9]/g, "");
                    if (digits.length > 0) {
                        const maxLen = parseInt(slot.getAttribute("maxlength") || "4", 10);
                        slot.value = digits.slice(0, maxLen);
                        slot.classList.add("filled");
                        slot.classList.remove("wrong", "correct");
                        this.docketSlots[targetSlotId] = slot.value;
                    }
                } else {
                    slot.innerText = incomingWord;
                    slot.classList.add("filled");
                    slot.classList.remove("wrong", "correct");
                    this.docketSlots[targetSlotId] = incomingWord;
                }

                if (sourceEl && sourceSlotId !== targetSlotId) {
                    if (existingTargetWord) {
                        if (sourceEl.classList.contains("num-slot")) {
                            const digits = existingTargetWord.replace(/[^0-9]/g, "");
                            if (digits.length > 0) {
                                const maxLen = parseInt(sourceEl.getAttribute("maxlength") || "4", 10);
                                sourceEl.value = digits.slice(0, maxLen);
                                sourceEl.classList.add("filled");
                                sourceEl.classList.remove("wrong", "correct");
                                this.docketSlots[sourceSlotId] = sourceEl.value;
                            } else {
                                sourceEl.value = "";
                                sourceEl.classList.remove("filled", "wrong", "correct");
                                delete this.docketSlots[sourceSlotId];
                            }
                        } else {
                            sourceEl.innerText = existingTargetWord;
                            sourceEl.classList.add("filled");
                            sourceEl.classList.remove("wrong", "correct");
                            this.docketSlots[sourceSlotId] = existingTargetWord;
                        }
                    } else {
                        if (sourceEl.classList.contains("num-slot")) sourceEl.value = ""; else sourceEl.innerText = "[ ? ]";
                        sourceEl.classList.remove("filled", "wrong", "correct");
                        delete this.docketSlots[sourceSlotId];
                    }
                }

                this.draggedSourceSlotId = null;
                window.sfx?.playSnap();
                this.updateProgress();
                this.saveProgress();
            });
        });
    }

    initTouchDragAndDrop() {
        const ghost = document.getElementById("touch-drag-ghost");
        let touchDraggedWord = null;
        let touchSourceSlotId = null;
        let isTouchDragging = false;
        let currentHoveredSlot = null;
        let startX = 0, startY = 0;
        let touchThresholdPassed = false;

        document.addEventListener("touchstart", (e) => {
            const touch = e.touches[0];
            const target = e.target.closest(".kw, .tray-word, .slot, .num-slot");
            if (!target) return;

            let word = "";
            let sourceSlotId = null;

            if (target.classList.contains("slot")) {
                word = target.innerText.trim();
                sourceSlotId = target.getAttribute("data-id");
                if (word === "[ ? ]") word = "";
            } else if (target.classList.contains("num-slot")) {
                word = target.value.trim();
                sourceSlotId = target.getAttribute("data-id");
            } else {
                word = target.getAttribute("data-word") || target.innerText.trim();
            }

            if (!word) return;

            startX = touch.clientX;
            startY = touch.clientY;
            touchDraggedWord = word;
            touchSourceSlotId = sourceSlotId;
            isTouchDragging = true;
            touchThresholdPassed = false;
        }, { passive: true });

        document.addEventListener("touchmove", (e) => {
            if (!isTouchDragging || !touchDraggedWord) return;
            const touch = e.touches[0];

            const dx = touch.clientX - startX;
            const dy = touch.clientY - startY;
            if (!touchThresholdPassed && Math.sqrt(dx * dx + dy * dy) > 8) {
                touchThresholdPassed = true;
                if (ghost) {
                    ghost.innerText = touchDraggedWord;
                    ghost.style.display = "block";
                }
            }

            if (touchThresholdPassed && ghost) {
                ghost.style.left = `${touch.clientX}px`;
                ghost.style.top = `${touch.clientY}px`;

                const elBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                const slot = elBelow ? elBelow.closest(".slot, .num-slot") : null;

                if (currentHoveredSlot && currentHoveredSlot !== slot) {
                    currentHoveredSlot.classList.remove("drag-over");
                }

                if (slot) {
                    slot.classList.add("drag-over");
                    currentHoveredSlot = slot;
                } else {
                    currentHoveredSlot = null;
                }

                if (e.cancelable) e.preventDefault();
            }
        }, { passive: false });

        document.addEventListener("touchend", () => {
            if (!isTouchDragging) return;

            if (ghost) ghost.style.display = "none";
            if (currentHoveredSlot) currentHoveredSlot.classList.remove("drag-over");

            if (touchThresholdPassed) {
                this.justTouchDragged = true;
                setTimeout(() => { this.justTouchDragged = false; }, 100);

                if (currentHoveredSlot && touchDraggedWord) {
                    const targetSlotId = currentHoveredSlot.getAttribute("data-id");
                    const isTargetNum = currentHoveredSlot.classList.contains("num-slot");

                    let existingTargetWord = "";
                    if (isTargetNum) {
                        existingTargetWord = currentHoveredSlot.value.trim();
                    } else {
                        existingTargetWord = currentHoveredSlot.innerText.trim();
                        if (existingTargetWord === "[ ? ]") existingTargetWord = "";
                    }

                    if (isTargetNum) {
                        const digits = touchDraggedWord.replace(/[^0-9]/g, "");
                        if (digits.length > 0) {
                            const maxLen = parseInt(currentHoveredSlot.getAttribute("maxlength") || "4", 10);
                            currentHoveredSlot.value = digits.slice(0, maxLen);
                            currentHoveredSlot.classList.add("filled");
                            currentHoveredSlot.classList.remove("wrong", "correct");
                            this.docketSlots[targetSlotId] = currentHoveredSlot.value;
                        }
                    } else {
                        currentHoveredSlot.innerText = touchDraggedWord;
                        currentHoveredSlot.classList.add("filled");
                        currentHoveredSlot.classList.remove("wrong", "correct");
                        this.docketSlots[targetSlotId] = touchDraggedWord;
                    }

                    if (touchSourceSlotId && touchSourceSlotId !== targetSlotId) {
                        const sourceEl = document.querySelector(`[data-id="${touchSourceSlotId}"]`);
                        if (sourceEl) {
                            const isSourceNum = sourceEl.classList.contains("num-slot");
                            if (existingTargetWord) {
                                if (isSourceNum) {
                                    const digits = existingTargetWord.replace(/[^0-9]/g, "");
                                    if (digits.length > 0) {
                                        const maxLen = parseInt(sourceEl.getAttribute("maxlength") || "4", 10);
                                        sourceEl.value = digits.slice(0, maxLen);
                                        sourceEl.classList.add("filled");
                                        sourceEl.classList.remove("wrong", "correct");
                                        this.docketSlots[touchSourceSlotId] = sourceEl.value;
                                    } else {
                                        sourceEl.value = "";
                                        sourceEl.classList.remove("filled", "wrong", "correct");
                                        delete this.docketSlots[touchSourceSlotId];
                                    }
                                } else {
                                    sourceEl.innerText = existingTargetWord;
                                    sourceEl.classList.add("filled");
                                    sourceEl.classList.remove("wrong", "correct");
                                    this.docketSlots[touchSourceSlotId] = existingTargetWord;
                                }
                            } else {
                                if (isSourceNum) sourceEl.value = ""; else sourceEl.innerText = "[ ? ]";
                                sourceEl.classList.remove("filled", "wrong", "correct");
                                delete this.docketSlots[touchSourceSlotId];
                            }
                        }
                    }
                    window.sfx?.playSnap();
                    this.updateProgress();
                    this.saveProgress();
                }
            }

            isTouchDragging = false;
            touchDraggedWord = null;
            touchSourceSlotId = null;
            currentHoveredSlot = null;
            touchThresholdPassed = false;
        });
    }

    showToast(msg) {
        const t = document.getElementById("toast");
        if (!t) return;
        t.innerText = msg;
        t.classList.add("show");
        clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(() => t.classList.remove("show"), 3000);
    }

    // --- LocalStorage Persistence Engine ---

    saveProgress() {
        if (!this.currentCase || !this.currentCase.id) return;
        try {
            const data = {
                caseId: this.currentCase.id,
                collectedWords: Array.from(this.collectedWords),
                unlockedLore: Array.from(this.unlockedLore),
                docketSlots: this.docketSlots,
                currentTimelineKey: this.currentTimelineKey,
                currentFilter: this.currentFilter,
                currentSort: this.currentSort,
                savedAt: Date.now()
            };
            localStorage.setItem(`deduction_engine_save_${this.currentCase.id}`, JSON.stringify(data));
        } catch (e) {
            console.warn("Could not save game progress to localStorage:", e);
        }
    }

    loadProgress() {
        if (!this.currentCase || !this.currentCase.id) return false;
        try {
            const savedStr = localStorage.getItem(`deduction_engine_save_${this.currentCase.id}`);
            if (!savedStr) return false;
            const data = JSON.parse(savedStr);
            if (!data || data.caseId !== this.currentCase.id) return false;

            if (Array.isArray(data.collectedWords)) {
                data.collectedWords.forEach(w => this.collectedWords.add(w));
            }
            if (Array.isArray(data.unlockedLore) && this.currentCase?.lore) {
                data.unlockedLore.forEach(l => {
                    if (this.currentCase.lore[l] || Object.values(this.currentCase.lore).some(item => item.id === l)) {
                        this.unlockedLore.add(l);
                    }
                });
            }
            if (data.docketSlots && typeof data.docketSlots === "object") {
                this.docketSlots = data.docketSlots;
                for (let [slotId, val] of Object.entries(this.docketSlots)) {
                    const el = document.querySelector(`[data-id="${slotId}"]`);
                    if (el) {
                        if (el.classList.contains("num-slot")) {
                            el.value = val;
                        } else {
                            el.innerText = val;
                        }
                        el.classList.add("filled");
                    }
                }
            }
            if (data.currentFilter) {
                this.currentFilter = data.currentFilter;
            }
            if (data.currentSort) {
                this.currentSort = data.currentSort;
                const sortSelect = document.getElementById("sort-select");
                if (sortSelect) sortSelect.value = this.currentSort;
            }
            if (data.currentTimelineKey) {
                this.savedTimelineKey = data.currentTimelineKey;
            }

            return true;
        } catch (e) {
            console.warn("Could not load game progress from localStorage:", e);
            return false;
        }
    }

    resetCaseProgress() {
        if (!this.currentCase || !this.currentCase.id) return;
        if (confirm(`Reset all progress for "${this.currentCase.meta?.title || this.currentCase.id}"? This will also re-lock Chapter 1 in the Novel Reader.`)) {
            try {
                localStorage.removeItem(`deduction_engine_save_${this.currentCase.id}`);
                localStorage.removeItem(`case_solved_${this.currentCase.id}`);
            } catch (e) {}
            this.loadCase(this.currentCase, false);
            this.showToast("Case progress reset & Chapter 1 locked.");
        }
    }

}

window.DeductionEngine = DeductionEngine;
