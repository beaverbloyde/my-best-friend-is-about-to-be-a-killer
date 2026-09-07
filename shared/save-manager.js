/**
 * LOGOS-3 UNIVERSAL SAVE MANAGER
 * Centralized save snapshot generation, schema v2 serialization, export, and restore.
 */
(function (global) {
    'use strict';

    const LogosSaveManager = {
        getSnapshot() {
            // 1. Cases Progression
            const cases = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('deduction_engine_save_')) {
                    const caseId = key.replace('deduction_engine_save_', '');
                    try {
                        const caseData = JSON.parse(localStorage.getItem(key));
                        if (caseData && typeof caseData === 'object') {
                            caseData.solved = localStorage.getItem(`case_solved_${caseId}`) === 'true' || Boolean(caseData.solved);
                            cases[caseId] = caseData;
                        }
                    } catch (e) {}
                } else if (key && key.startsWith('case_solved_')) {
                    const caseId = key.replace('case_solved_', '');
                    if (!cases[caseId]) {
                        cases[caseId] = {
                            caseId: caseId,
                            solved: localStorage.getItem(key) === 'true'
                        };
                    } else {
                        cases[caseId].solved = localStorage.getItem(key) === 'true';
                    }
                }
            }

            // 2. Chapters Progression
            const chapters = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('chapter_keywords_')) {
                    const path = key.replace('chapter_keywords_', '');
                    if (!chapters[path]) chapters[path] = {};
                    try {
                        chapters[path].collectedKeywords = JSON.parse(localStorage.getItem(key)) || [];
                    } catch (e) {
                        chapters[path].collectedKeywords = [];
                    }
                } else if (key && key.startsWith('chapter_read_')) {
                    const path = key.replace('chapter_read_', '');
                    if (!chapters[path]) chapters[path] = {};
                    chapters[path].read = localStorage.getItem(key) === 'true';
                }
            }

            // 3. Window Layouts
            const windowLayouts = {};
            const docketW = localStorage.getItem('docket_width');
            const docketH = localStorage.getItem('docket_height');
            if (docketW || docketH) {
                windowLayouts.docket = {
                    width: docketW ? parseInt(docketW, 10) : null,
                    height: docketH ? parseInt(docketH, 10) : null
                };
            }
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key) continue;
                const loreMatch = key.match(/^lore_(.+)_(width|height)$/);
                if (loreMatch) {
                    const id = `lore_${loreMatch[1]}`;
                    if (!windowLayouts[id]) windowLayouts[id] = {};
                    windowLayouts[id][loreMatch[2]] = parseInt(localStorage.getItem(key), 10);
                }
                const tableMatch = key.match(/^table_(.+)_(width|height)$/);
                if (tableMatch) {
                    const id = `table_${tableMatch[1]}`;
                    if (!windowLayouts[id]) windowLayouts[id] = {};
                    windowLayouts[id][tableMatch[2]] = parseInt(localStorage.getItem(key), 10);
                }
            }

            // 4. Reader Settings & Bookmark
            const reader = {
                bookmark: {
                    path: localStorage.getItem('chronos_bookmark_path') || null,
                    ratio: parseFloat(localStorage.getItem('chronos_bookmark_ratio') || '0')
                },
                settings: {
                    theme: localStorage.getItem('reader-theme') || 'soviet-amber',
                    fontFamily: localStorage.getItem('reader-font-family') || 'lora',
                    customFont: localStorage.getItem('reader-custom-font') || 'Lora',
                    fontSize: parseInt(localStorage.getItem('reader-font-size') || '18', 10),
                    lineHeight: parseFloat(localStorage.getItem('reader-line-height') || '1.6'),
                    maxWidth: parseInt(localStorage.getItem('reader-max-width') || '750', 10),
                    speechEnabled: localStorage.getItem('reader-speech-enabled') !== 'false',
                    highlightMode: localStorage.getItem('reader-highlight-mode') || 'text-only',
                    epaperTransition: localStorage.getItem('reader-epaper-transition') !== 'false',
                    epaperDuration: parseFloat(localStorage.getItem('reader-epaper-duration') || '0.50'),
                    displayProfile: localStorage.getItem('reader-display-profile') || 'clean',
                    displayIntensity: parseInt(localStorage.getItem('reader-display-intensity') || '65', 10),
                    displaySpeed: parseInt(localStorage.getItem('reader-display-speed') || '2', 10),
                    zenEnabled: localStorage.getItem('reader-zen-enabled') === 'true',
                    spotlightEnabled: localStorage.getItem('reader-spotlight-enabled') === 'true',
                    spotlightSize: parseInt(localStorage.getItem('reader-spotlight-size') || '3', 10)
                }
            };

            // 5. Game Settings
            const game = {
                selectedCase: localStorage.getItem('case_selected') || null,
                tutorialSuppressed: localStorage.getItem('deduction_engine_tutorial_suppressed') === 'true',
                windowLayouts: windowLayouts,
                settings: {
                    theme: localStorage.getItem('game-theme') || 'soviet-amber',
                    fontSize: parseInt(localStorage.getItem('game-font-size') || '13', 10),
                    lineHeight: parseFloat(localStorage.getItem('game-line-height') || '1.5'),
                    fontFamily: localStorage.getItem('game-font-family') || "'IBM Plex Mono', monospace",
                    displayProfile: localStorage.getItem('game-display-profile') || (localStorage.getItem('game-scanlines') === 'true' ? 'crt' : 'clean'),
                    displayIntensity: parseInt(localStorage.getItem('game-display-intensity') || '65', 10),
                    displaySpeed: parseInt(localStorage.getItem('game-display-speed') || '2', 10)
                }
            };

            // 6. Audio Settings
            const audioPositions = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('bgm_pos_')) {
                    const trackId = key.replace('bgm_pos_', '');
                    audioPositions[trackId] = parseFloat(localStorage.getItem(key) || '0');
                }
            }

            const audio = {
                sfxEnabled: localStorage.getItem('sfx_enabled') !== 'false',
                sfxVolume: parseFloat(localStorage.getItem('sfx_volume') || '0.45'),
                bgmVolume: parseFloat(localStorage.getItem('bgm_volume') || '0.35'),
                bgmTrackId: localStorage.getItem('bgm_track_id') || 'sb_the_long_dark',
                bgmIsPlaying: localStorage.getItem('bgm_is_playing') === 'true',
                bgmPositions: audioPositions
            };

            return {
                app: "LOGOS-3",
                version: "2.2",
                schemaVersion: 2,
                exportedAt: new Date().toISOString(),
                progression: {
                    cases,
                    chapters
                },
                reader,
                game,
                audio
            };
        },

        restore(parsed) {
            if (!parsed || typeof parsed !== 'object') {
                throw new Error("Invalid save file content.");
            }

            let count = 0;

            // Structured Schema (schemaVersion: 2)
            if (parsed.progression || parsed.reader || parsed.game || parsed.audio) {
                // Restore Cases
                if (parsed.progression?.cases) {
                    Object.entries(parsed.progression.cases).forEach(([caseId, cData]) => {
                        if (cData && typeof cData === 'object') {
                            if (cData.solved) {
                                localStorage.setItem(`case_solved_${caseId}`, 'true');
                            }
                            localStorage.setItem(`deduction_engine_save_${caseId}`, JSON.stringify(cData));
                            count++;
                        }
                    });
                }

                // Restore Chapters
                if (parsed.progression?.chapters) {
                    Object.entries(parsed.progression.chapters).forEach(([path, chData]) => {
                        if (chData && typeof chData === 'object') {
                            if (chData.read) {
                                localStorage.setItem(`chapter_read_${path}`, 'true');
                            }
                            if (Array.isArray(chData.collectedKeywords)) {
                                localStorage.setItem(`chapter_keywords_${path}`, JSON.stringify(chData.collectedKeywords));
                            }
                            count++;
                        }
                    });
                }

                // Restore Reader
                if (parsed.reader) {
                    if (parsed.reader.bookmark?.path) {
                        localStorage.setItem('chronos_bookmark_path', parsed.reader.bookmark.path);
                        localStorage.setItem('chronos_bookmark_ratio', String(parsed.reader.bookmark.ratio || 0));
                        count++;
                    }
                    if (parsed.reader.settings) {
                        const readerKeyMap = {
                            theme: 'reader-theme',
                            fontFamily: 'reader-font-family',
                            customFont: 'reader-custom-font',
                            fontSize: 'reader-font-size',
                            lineHeight: 'reader-line-height',
                            maxWidth: 'reader-max-width',
                            speechEnabled: 'reader-speech-enabled',
                            highlightMode: 'reader-highlight-mode',
                            epaperTransition: 'reader-epaper-transition',
                            epaperDuration: 'reader-epaper-duration',
                            displayProfile: 'reader-display-profile',
                            displayIntensity: 'reader-display-intensity',
                            displaySpeed: 'reader-display-speed',
                            zenEnabled: 'reader-zen-enabled',
                            spotlightEnabled: 'reader-spotlight-enabled',
                            spotlightSize: 'reader-spotlight-size'
                        };
                        Object.entries(parsed.reader.settings).forEach(([k, v]) => {
                            const sk = readerKeyMap[k] || `reader-${k}`;
                            localStorage.setItem(sk, String(v));
                            count++;
                        });
                    }
                }

                // Restore Game
                if (parsed.game) {
                    if (parsed.game.selectedCase) {
                        localStorage.setItem('case_selected', parsed.game.selectedCase);
                        count++;
                    }
                    if (parsed.game.tutorialSuppressed !== undefined) {
                        localStorage.setItem('deduction_engine_tutorial_suppressed', String(parsed.game.tutorialSuppressed));
                        count++;
                    }
                    if (parsed.game.windowLayouts) {
                        Object.entries(parsed.game.windowLayouts).forEach(([winId, dims]) => {
                            if (winId === 'docket') {
                                if (dims.width) localStorage.setItem('docket_width', String(dims.width));
                                if (dims.height) localStorage.setItem('docket_height', String(dims.height));
                            } else {
                                if (dims.width) localStorage.setItem(`${winId}_width`, String(dims.width));
                                if (dims.height) localStorage.setItem(`${winId}_height`, String(dims.height));
                            }
                            count++;
                        });
                    }
                    if (parsed.game.settings) {
                        const gameKeyMap = {
                            theme: 'game-theme',
                            fontSize: 'game-font-size',
                            lineHeight: 'game-line-height',
                            fontFamily: 'game-font-family',
                            displayProfile: 'game-display-profile',
                            displayIntensity: 'game-display-intensity',
                            displaySpeed: 'game-display-speed'
                        };
                        Object.entries(parsed.game.settings).forEach(([k, v]) => {
                            const sk = gameKeyMap[k] || `game-${k}`;
                            localStorage.setItem(sk, String(v));
                            count++;
                        });
                    }
                }

                // Restore Audio
                if (parsed.audio) {
                    if (parsed.audio.sfxEnabled !== undefined) localStorage.setItem('sfx_enabled', String(parsed.audio.sfxEnabled));
                    if (parsed.audio.sfxVolume !== undefined) localStorage.setItem('sfx_volume', String(parsed.audio.sfxVolume));
                    if (parsed.audio.bgmVolume !== undefined) localStorage.setItem('bgm_volume', String(parsed.audio.bgmVolume));
                    if (parsed.audio.bgmTrackId !== undefined) localStorage.setItem('bgm_track_id', String(parsed.audio.bgmTrackId));
                    if (parsed.audio.bgmIsPlaying !== undefined) localStorage.setItem('bgm_is_playing', String(parsed.audio.bgmIsPlaying));
                    if (parsed.audio.bgmPositions) {
                        Object.entries(parsed.audio.bgmPositions).forEach(([tId, pos]) => {
                            localStorage.setItem(`bgm_pos_${tId}`, String(pos));
                        });
                    }
                    count++;
                }
            } else {
                // Flat Data fallback
                const flatData = parsed.data || parsed.storageData || parsed;
                Object.entries(flatData).forEach(([k, v]) => {
                    if (typeof v === 'string') {
                        localStorage.setItem(k, v);
                        count++;
                    } else if (v !== null && v !== undefined) {
                        localStorage.setItem(k, JSON.stringify(v));
                        count++;
                    }
                });
            }

            if (count === 0) {
                throw new Error("No recognized LOGOS-3 save parameters found in this file.");
            }

            return count;
        },

        restoreSnapshot(parsed) {
            return this.restore(parsed);
        },

        export(filename = null) {
            try { window.sfx?.playClick(); } catch (e) {}
            const payload = this.getSnapshot();
            const jsonStr = JSON.stringify(payload, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const now = new Date();
            const dateStr = now.toISOString().slice(0, 10);
            const timeStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
            const fname = filename || `logos3_save_${dateStr}_${timeStr}.json`;

            const a = document.createElement('a');
            a.href = url;
            a.download = fname;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return fname;
        },

        exportToFile(filename = null) {
            return this.export(filename);
        },

        importFromFile(file, onComplete = null, onError = null) {
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const parsed = JSON.parse(e.target.result);
                    const count = this.restore(parsed);
                    try { window.sfx?.playSuccess(); } catch (e) {}
                    alert(`✓ Save data successfully restored (${count} parameters). Reloading...`);
                    if (onComplete) {
                        try { onComplete(count); } catch (e) {}
                    }
                    window.location.reload();
                } catch (err) {
                    const msg = err?.message || err;
                    alert(`⚠️ Error importing save file: ${msg}`);
                    if (onError) onError(err);
                }
            };
            reader.onerror = () => {
                alert("⚠️ Could not read the selected file.");
                if (onError) onError(new Error("Could not read file."));
            };
            reader.readAsText(file);
        },

        resetAllProgress() {
            if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
                history.scrollRestoration = 'manual';
            }
            try {
                sessionStorage.clear();
            } catch (e) {}

            Object.keys(localStorage).forEach(key => {
                if (
                    key.startsWith('case_solved_') ||
                    key.startsWith('case_unlocked_') ||
                    key.startsWith('chapter_read_') ||
                    key.startsWith('chapter_unlocked_') ||
                    key.startsWith('deduction_engine_save_') ||
                    key.startsWith('chapter_keywords_') ||
                    key.startsWith('chronos_bookmark_') ||
                    key === 'chronos_bookmark_path' ||
                    key === 'chronos_bookmark_ratio' ||
                    key === 'case_selected'
                ) {
                    localStorage.removeItem(key);
                }
            });

            if (typeof document !== 'undefined') {
                const wrapper = document.getElementById('document-wrapper');
                if (wrapper) wrapper.scrollTop = 0;
            }
        },

        resetGlobalProgress(onComplete = null) {
            if (confirm("Reset ALL investigation progress, discovered keywords, and unlock states across both Game and Novel Reader?")) {
                if (typeof window !== 'undefined') {
                    window.isProgressionResetting = true;
                }
                this.resetAllProgress();
                try { window.sfx?.playClick(); } catch (e) {}
                alert("🔒 All progress reset. Reloading...");
                if (onComplete) {
                    try { onComplete(); } catch (e) {}
                }
                if (typeof window !== 'undefined') {
                    if ('scrollRestoration' in history) {
                        history.scrollRestoration = 'manual';
                    }
                    window.location.href = window.location.pathname;
                }
            }
        }
    };

    global.LogosSaveManager = LogosSaveManager;
})(typeof window !== 'undefined' ? window : globalThis);
