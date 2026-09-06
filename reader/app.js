/* ==========================================================================
   36th SOT Reader - Application Logic
   ========================================================================== */

(function () {
    // 1. Path Resolver: Adapt depending on whether we run from /reader/ or the root
    const pathname = window.location.pathname;
    const isSubFolder = pathname.includes('/reader/') || pathname.endsWith('/reader') || pathname.includes('/reader');
    const basePath = isSubFolder ? '../' : './';

    // 2. State Management
    let docList = [];
    let totalNovelWords = '0';
    let activeDocPath = '';
    let focusedParagraphIndex = -1;
    let focusedResultIndex = -1;
    let chapterMetadata = {
        povs: new Set(),
        focuses: new Set(),
        characters: new Set(),
        mentions: new Set(),
        tags: new Set()
    };
    let footnoteMap = {};
    let encounteredFootnotes = [];

    // Dynamic alias map: handle -> Set of lowercase alias strings
    let dynamicAliases = {};

    // Dynamically loaded tags index from novelWriter metadata
    let tagsIndex = {};

    // Dynamic Chapter & Case Gating & Progression System
    const DEFAULT_PROGRESSION_RULES = {
        'content/27601e10419ce.nwd': {
            targetType: 'chapter',
            targetTitle: 'Chapter 1: The ROVD',
            requires: {
                type: 'case',
                id: 'chapter_01_morning_routine',
                title: 'Case 1: Morning Routine',
                url: 'game.html?case=cases/chapter_01_morning_routine.json',
                teaser: 'Reconstruct the morning timeline to verify the case docket and unlock this chapter.'
            }
        }
    };

    let progressionRules = Object.assign({}, DEFAULT_PROGRESSION_RULES);

    async function loadProgressionRules() {
        const casesBasePath = isSubFolder ? 'cases/' : 'reader/cases/';
        try {
            const res = await fetch(`${casesBasePath}progression.json?t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                if (data && Array.isArray(data.rules)) {
                    progressionRules = {};
                    data.rules.forEach(rule => {
                        const target = rule.target || rule.chapter || rule.case;
                        if (!target) return;

                        let req = rule.requires;
                        if (!req) {
                            if (rule.requiresCase) {
                                req = {
                                    type: 'case',
                                    id: rule.requiresCase,
                                    title: rule.caseTitle || `Case ${rule.requiresCase}`,
                                    url: `game.html?case=cases/${rule.requiresCase}.json`,
                                    teaser: rule.teaser || 'Solve the case investigation to unlock.'
                                };
                            } else if (rule.requiresChapter) {
                                req = {
                                    type: 'chapter',
                                    id: rule.requiresChapter,
                                    title: rule.chapterTitle || 'Previous Chapter',
                                    url: `index.html?file=${encodeURIComponent(rule.requiresChapter)}`,
                                    teaser: rule.teaser || 'Read the required chapter to unlock.'
                                };
                            }
                        }

                        if (req) {
                            progressionRules[target] = {
                                targetType: rule.targetType || (target.endsWith('.nwd') ? 'chapter' : 'case'),
                                targetTitle: rule.targetTitle || '',
                                requires: req
                            };
                        }
                    });
                }
            }
        } catch (e) {
            console.warn("Could not load dynamic cases/progression.json:", e);
        }
    }

    function isChapterUnlocked(path) {
        const rule = progressionRules[path];
        if (!rule || !rule.requires) return true;
        
        const req = rule.requires;
        if (req.type === 'chapter' || (req.id && req.id.endsWith('.nwd'))) {
            return localStorage.getItem(`chapter_read_${req.id}`) === 'true';
        }
        // Default to checking case completion
        return localStorage.getItem(`case_solved_${req.id}`) === 'true';
    }

    let unlockToastTimeout;

    function showUnlockToast(title, url, type = 'chapter') {
        const toast = document.getElementById('unlock-toast');
        if (!toast) return;

        const titleEl = document.getElementById('unlock-toast-title');
        const btnEl = document.getElementById('unlock-toast-btn');

        if (titleEl) {
            titleEl.innerText = title;
        }
        if (btnEl) {
            btnEl.href = url || '#';
            btnEl.innerText = type === 'case' ? 'Launch Case ↵' : 'Read Chapter ↵';
            if (type === 'case') {
                btnEl.onclick = null;
            } else {
                btnEl.onclick = (e) => {
                    if (url && url.includes('file=')) {
                        e.preventDefault();
                        const targetPath = new URLSearchParams(url.split('?')[1]).get('file');
                        if (targetPath) {
                            hideUnlockToast();
                            navigateToDocument(targetPath);
                        }
                    }
                };
            }
        }

        toast.classList.remove('hidden');
        clearTimeout(unlockToastTimeout);
        unlockToastTimeout = setTimeout(() => {
            hideUnlockToast();
        }, 8000);
    }

    function hideUnlockToast() {
        const toast = document.getElementById('unlock-toast');
        if (toast) toast.classList.add('hidden');
    }

    function markChapterAsRead(path) {
        if (!path || !path.endsWith('.nwd')) return;
        if (!isChapterUnlocked(path)) return;
        autoCollectAllChapterKeywords(path);
        const alreadyRead = localStorage.getItem(`chapter_read_${path}`) === 'true';
        if (!alreadyRead) {
            localStorage.setItem(`chapter_read_${path}`, 'true');

            // Find what was unlocked by completing this chapter
            const newlyUnlocked = [];
            Object.entries(progressionRules).forEach(([target, rule]) => {
                if (rule.requires && rule.requires.id === path) {
                    newlyUnlocked.push({
                        target: target,
                        targetType: rule.targetType,
                        targetTitle: rule.targetTitle || target,
                        url: rule.targetType === 'case' ? `game.html?case=cases/${target}.json` : `index.html?file=${encodeURIComponent(target)}`
                    });
                }
            });

            // Re-render sidebar navigation with highlight pulse
            renderNavigation(newlyUnlocked.map(u => u.target));
            setupPrevNextButtons();

            // Display toast notification if items were unlocked
            if (newlyUnlocked.length > 0) {
                const first = newlyUnlocked[0];
                const typeLabel = first.targetType === 'case' ? 'New Case Unlocked' : 'New Chapter Unlocked';
                showUnlockToast(`${typeLabel}: ${first.targetTitle || 'Next Segment'}`, first.url, first.targetType);
            } else {
                // If it's a regular chapter without custom rules, check if next chapter became available
                const novels = docList.filter(item => item.class === 'NOVEL');
                const novelHashes = new Set(novels.map(item => item.hash));
                const rootChapters = novels.filter(item => !novelHashes.has(item.parentHash));
                const currentIndex = rootChapters.findIndex(n => n.path === path);
                if (currentIndex !== -1 && currentIndex < rootChapters.length - 1) {
                    const nextDoc = rootChapters[currentIndex + 1];
                    if (isChapterUnlocked(nextDoc.path)) {
                        showUnlockToast(`Chapter Unlocked: ${nextDoc.title}`, `index.html?file=${encodeURIComponent(nextDoc.path)}`, 'chapter');
                    }
                }
            }
        }
    }

    // Autocomplete Font Search lists
    const SYSTEM_FONTS = [
        "Arial", "Arial Black", "Bookman Old Style", "Comic Sans MS", 
        "Courier New", "Georgia", "Garamond", "Helvetica", "Impact", 
        "Lucida Console", "Lucida Sans Unicode", "Palatino Linotype", 
        "Segoe UI", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana"
    ];

    const POPULAR_GOOGLE_FONTS = [
        "Roboto", "Open Sans", "Lato", "Montserrat", "Playfair Display", 
        "Merriweather", "Oswald", "Source Sans Pro", "PT Sans", "PT Serif", 
        "EB Garamond", "Lora", "Noto Sans", "Noto Serif", "Nunito", "Poppins", 
        "Crimson Text", "Alegreya", "Cardo", "Cormorant Garamond", "Neuton", 
        "Domine", "Cinzel", "Inconsolata", "Courier Prime", "Bitter", "Cabin", 
        "Fira Sans", "Josefin Sans", "Libre Baskerville", "Libre Franklin", 
        "Mulish", "Quicksand", "Rubik", "Spectral", "Titillium Web", "Work Sans"
    ];

    let availableFonts = {
        "Preset Fonts": ["Lora", "Inter", "JetBrains Mono", "System Default"],
        "Web Safe Fonts": SYSTEM_FONTS,
        "Google Fonts": POPULAR_GOOGLE_FONTS
    };

    let localFontsList = [];

    function getStoredFontFamily() {
        const stored = localStorage.getItem('reader-font-family');
        if (!stored) return 'Lora';
        if (stored === 'var(--font-lora)') return 'Lora';
        if (stored === 'var(--font-inter)') return 'Inter';
        if (stored === 'var(--font-mono)') return 'JetBrains Mono';
        if (stored === 'system-ui') return 'System Default';
        if (stored === 'custom') {
            return localStorage.getItem('reader-custom-font') || 'Lora';
        }
        return stored;
    }

    // 3. Initialize Settings
    const settings = {
        theme: localStorage.getItem('reader-theme') || 'soviet-amber',
        fontFamily: getStoredFontFamily(),
        fontSize: parseInt(localStorage.getItem('reader-font-size')) || 18,
        lineHeight: parseFloat(localStorage.getItem('reader-line-height')) || 1.6,
        maxWidth: parseInt(localStorage.getItem('reader-max-width')) || 750,
        speechEnabled: localStorage.getItem('reader-speech-enabled') !== 'false',
        highlightMode: localStorage.getItem('reader-highlight-mode') || 'text-only',
        epaperTransition: localStorage.getItem('reader-epaper-transition') !== 'false',
        epaperDuration: parseFloat(localStorage.getItem('reader-epaper-duration')) || 0.50,
        zenEnabled: localStorage.getItem('reader-zen-enabled') === 'true',
        spotlightEnabled: localStorage.getItem('reader-spotlight-enabled') === 'true',
        spotlightSize: parseInt(localStorage.getItem('reader-spotlight-size')) || 3
    };



    // Helper to dynamically load a Google Font
    function loadGoogleFont(fontName) {
        if (!fontName || fontName === 'System Default') return;
        const apiFontName = fontName.trim().replace(/\s+/g, '+');
        const linkId = `gfont-${apiFontName.toLowerCase()}`;
        if (document.getElementById(linkId)) return;
        
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${apiFontName}:ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,700&display=swap`;
        document.head.appendChild(link);
    }

    // Apply active settings values to the DOM and CSS variables
    function applySettings() {
        // Apply Theme Class to Body
        document.body.className = '';
        document.body.classList.add(`theme-${settings.theme}`);
        
        // Apply CSS custom variables
        const root = document.documentElement;
        root.style.setProperty('--reader-font-size', `${settings.fontSize}px`);
        root.style.setProperty('--reader-line-height', settings.lineHeight);
        root.style.setProperty('--reader-max-width', `${settings.maxWidth}px`);
        
        // Dynamic custom font resolution
        let activeFont = settings.fontFamily;
        if (activeFont === 'Lora') {
            activeFont = 'var(--font-lora)';
        } else if (activeFont === 'Inter') {
            activeFont = 'var(--font-inter)';
        } else if (activeFont === 'JetBrains Mono') {
            activeFont = 'var(--font-mono)';
        } else if (activeFont === 'System Default' || activeFont === 'system-ui') {
            activeFont = 'system-ui';
        } else {
            // It's a custom font, load it dynamically from Google Fonts if needed
            loadGoogleFont(settings.fontFamily);
        }
        root.style.setProperty('--reader-font-family', activeFont);

        // Apply Highlight Mode to reader container
        const reader = document.getElementById('document-body');
        reader.className = '';
        if (settings.speechEnabled) {
            reader.classList.add(`speech-mode-${settings.highlightMode}`);
        } else {
            reader.classList.add('speech-disabled');
        }

        // Update settings controls values
        const fontSearchInput = document.getElementById('font-search-input');
        if (fontSearchInput) {
            fontSearchInput.value = settings.fontFamily;
        }
        document.getElementById('font-size-slider').value = settings.fontSize;
        document.getElementById('font-size-value').innerText = `${settings.fontSize}px`;
        document.getElementById('line-height-slider').value = settings.lineHeight;
        document.getElementById('line-height-value').innerText = settings.lineHeight;
        document.getElementById('container-width-slider').value = settings.maxWidth;
        document.getElementById('container-width-value').innerText = `${settings.maxWidth}px`;
        document.getElementById('speech-styling-toggle').checked = settings.speechEnabled;
        document.getElementById('highlight-mode-select').value = settings.highlightMode;

        // Highlight Mode select container visibility
        const highlightModeContainer = document.getElementById('highlight-mode-container');
        if (settings.speechEnabled) {
            highlightModeContainer.style.display = 'flex';
        } else {
            highlightModeContainer.style.display = 'none';
        }

        // Zen Mode and Spotlight settings checked state
        const zenToggle = document.getElementById('zen-mode-toggle');
        if (zenToggle) zenToggle.checked = settings.zenEnabled;
        const spotlightToggle = document.getElementById('spotlight-toggle');
        if (spotlightToggle) spotlightToggle.checked = settings.spotlightEnabled;

        // Apply Zen Mode class to body and display exit button
        if (settings.zenEnabled) {
            document.body.classList.add('zen-mode');
            document.getElementById('zen-exit-btn')?.classList.remove('hidden');
            document.getElementById('zen-shortcuts-btn')?.classList.remove('hidden');
            document.getElementById('zen-search-btn')?.classList.remove('hidden');
            const spotlightRow = document.getElementById('spotlight-row');
            if (spotlightRow) spotlightRow.style.display = 'flex';
        } else {
            document.body.classList.remove('zen-mode');
            document.getElementById('zen-exit-btn')?.classList.add('hidden');
            document.getElementById('zen-shortcuts-btn')?.classList.add('hidden');
            document.getElementById('zen-search-btn')?.classList.add('hidden');
            const spotlightRow = document.getElementById('spotlight-row');
            if (spotlightRow) spotlightRow.style.display = 'none';
        }

        // Apply Spotlight class to body and spotlight size dropdown visibility
        const spotlightSizeContainer = document.getElementById('spotlight-size-container');
        const spotlightSizeSelect = document.getElementById('spotlight-size-select');
        
        if (spotlightSizeSelect) spotlightSizeSelect.value = settings.spotlightSize;

        if (settings.zenEnabled && settings.spotlightEnabled) {
            document.body.classList.add('spotlight-enabled');
            if (spotlightSizeContainer) spotlightSizeContainer.style.display = 'block';
            triggerSpotlightUpdate();
        } else {
            document.body.classList.remove('spotlight-enabled');
            if (spotlightSizeContainer) spotlightSizeContainer.style.display = 'none';
            document.querySelectorAll('.scroll-active, .scroll-neighbor-1, .scroll-neighbor-2').forEach(p => {
                p.classList.remove('scroll-active');
                p.classList.remove('scroll-neighbor-1');
                p.classList.remove('scroll-neighbor-2');
            });
        }

        // E-Paper Transition checkbox state and duration
        const epaperToggle = document.getElementById('epaper-transition-toggle');
        if (epaperToggle) epaperToggle.checked = settings.epaperTransition;

        const epaperDurationSlider = document.getElementById('epaper-duration-slider');
        const epaperDurationVal = document.getElementById('epaper-duration-val');
        const epaperDurationContainer = document.getElementById('epaper-duration-container');
        if (epaperDurationSlider) epaperDurationSlider.value = settings.epaperDuration;
        if (epaperDurationVal) epaperDurationVal.innerText = `${Number(settings.epaperDuration).toFixed(2)}s`;
        if (epaperDurationContainer) epaperDurationContainer.style.display = settings.epaperTransition ? 'block' : 'none';
        document.documentElement.style.setProperty('--epaper-bloom-duration', `${settings.epaperDuration}s`);

        // Update Theme selector buttons active state
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.theme === settings.theme) {
                btn.classList.add('active');
            }
        });
    }

    function saveSettings() {
        localStorage.setItem('reader-theme', settings.theme);
        localStorage.setItem('reader-font-family', settings.fontFamily);
        localStorage.setItem('reader-font-size', settings.fontSize);
        localStorage.setItem('reader-line-height', settings.lineHeight);
        localStorage.setItem('reader-max-width', settings.maxWidth);
        localStorage.setItem('reader-speech-enabled', settings.speechEnabled);
        localStorage.setItem('reader-highlight-mode', settings.highlightMode);
        localStorage.setItem('reader-epaper-transition', settings.epaperTransition);
        localStorage.setItem('reader-epaper-duration', settings.epaperDuration);
        localStorage.setItem('reader-zen-enabled', settings.zenEnabled);
        localStorage.setItem('reader-spotlight-enabled', settings.spotlightEnabled);
        localStorage.setItem('reader-spotlight-size', settings.spotlightSize);
    }

    function switchSidebarTab(tabName) {
        const tabManuscript = document.getElementById('tab-manuscript');
        const tabLore = document.getElementById('tab-lore');
        const manuscriptPanel = document.getElementById('manuscript-panel');
        const lorePanel = document.getElementById('lore-panel');
        if (!tabManuscript || !tabLore) return;
        
        if (tabName === 'manuscript') {
            tabManuscript.classList.add('active');
            tabLore.classList.remove('active');
            manuscriptPanel.classList.add('active');
            lorePanel.classList.remove('active');
        } else if (tabName === 'lore') {
            tabLore.classList.add('active');
            tabManuscript.classList.remove('active');
            lorePanel.classList.add('active');
            manuscriptPanel.classList.remove('active');
        }
    }

    // 5. Sidebar & Navigation Tabs
    function initTabs() {
        const tabManuscript = document.getElementById('tab-manuscript');
        const tabLore = document.getElementById('tab-lore');
        const manuscriptPanel = document.getElementById('manuscript-panel');
        const lorePanel = document.getElementById('lore-panel');

        tabManuscript.addEventListener('click', () => {
            tabManuscript.classList.add('active');
            tabLore.classList.remove('active');
            manuscriptPanel.classList.add('active');
            lorePanel.classList.remove('active');
        });

        tabLore.addEventListener('click', () => {
            tabLore.classList.add('active');
            tabManuscript.classList.remove('active');
            lorePanel.classList.add('active');
            manuscriptPanel.classList.remove('active');
        });

        // Sidebar collapsible controls (Desktop + Mobile)
        const sidebarToggle = document.getElementById('sidebar-toggle-btn');
        const sidebarClose = document.getElementById('sidebar-close-btn');
        const sidebar = document.getElementById('sidebar');

        // Set initial state based on window size
        if (window.innerWidth < 900) {
            sidebar.classList.add('collapsed');
        } else {
            sidebar.classList.remove('collapsed');
        }

        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });

        sidebarClose.addEventListener('click', () => {
            sidebar.classList.add('collapsed');
        });
    }

    // 6. Settings Drawer Controls
    function initDrawer() {
        const toggleBtn = document.getElementById('settings-toggle-btn');
        const closeBtn = document.getElementById('settings-close-btn');
        const backdrop = document.getElementById('settings-backdrop');
        const drawer = document.getElementById('settings-drawer');

        function openDrawer() {
            drawer.classList.add('visible');
            backdrop.classList.add('visible');
        }

        function closeDrawer() {
            drawer.classList.remove('visible');
            backdrop.classList.remove('visible');
        }

        toggleBtn.addEventListener('click', openDrawer);
        closeBtn.addEventListener('click', closeDrawer);
        backdrop.addEventListener('click', closeDrawer);

        // Theme buttons
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                settings.theme = btn.dataset.theme;
                applySettings();
                saveSettings();
            });
        });

        // Searchable Autocomplete Font Input & Scan
        const fontInput = document.getElementById('font-search-input');
        const fontDropdown = document.getElementById('font-search-results');
        const scanBtn = document.getElementById('scan-local-fonts-btn');
        
        if (fontInput && fontDropdown) {
            fontInput.addEventListener('focus', () => {
                renderFontSuggestions(fontInput.value);
                fontDropdown.classList.add('open');
            });
            
            fontInput.addEventListener('input', (e) => {
                renderFontSuggestions(e.target.value);
                fontDropdown.classList.add('open');
            });

            fontInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    selectFont(fontInput.value);
                }
            });
            
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.font-search-wrapper')) {
                    fontDropdown.classList.remove('open');
                }
            });
        }
        
        if (scanBtn) {
            scanBtn.addEventListener('click', () => {
                scanLocalFonts();
            });
        }

        // Font Size Slider
        document.getElementById('font-size-slider').addEventListener('input', (e) => {
            settings.fontSize = parseInt(e.target.value);
            applySettings();
            saveSettings();
        });

        // Line Height Slider
        document.getElementById('line-height-slider').addEventListener('input', (e) => {
            settings.lineHeight = parseFloat(e.target.value);
            applySettings();
            saveSettings();
        });

        // Max Width Slider
        document.getElementById('container-width-slider').addEventListener('input', (e) => {
            settings.maxWidth = parseInt(e.target.value);
            applySettings();
            saveSettings();
        });

        // Speech Toggle
        document.getElementById('speech-styling-toggle').addEventListener('change', (e) => {
            settings.speechEnabled = e.target.checked;
            applySettings();
            saveSettings();
        });

        // Highlight Mode Select
        document.getElementById('highlight-mode-select').addEventListener('change', (e) => {
            settings.highlightMode = e.target.value;
            applySettings();
            saveSettings();
        });

        // Electro-Cellulose E-Paper Transition
        const epaperToggle = document.getElementById('epaper-transition-toggle');
        const epaperDurationContainer = document.getElementById('epaper-duration-container');
        const epaperDurationSlider = document.getElementById('epaper-duration-slider');
        const epaperDurationVal = document.getElementById('epaper-duration-val');

        if (epaperToggle) {
            epaperToggle.addEventListener('change', (e) => {
                settings.epaperTransition = e.target.checked;
                if (epaperDurationContainer) {
                    epaperDurationContainer.style.display = settings.epaperTransition ? 'block' : 'none';
                }
                saveSettings();
                if (settings.epaperTransition) {
                    triggerEpaperRefresh();
                }
            });
        }

        if (epaperDurationSlider) {
            let previewDebounceTimer = null;
            epaperDurationSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                settings.epaperDuration = val;
                if (epaperDurationVal) {
                    epaperDurationVal.innerText = `${val.toFixed(2)}s`;
                }
                document.documentElement.style.setProperty('--epaper-bloom-duration', `${val}s`);
                saveSettings();

                // Live preview with light debounce
                clearTimeout(previewDebounceTimer);
                previewDebounceTimer = setTimeout(() => {
                    triggerEpaperRefresh();
                }, 150);
            });
        }

        const epaperPreviewBtn = document.getElementById('epaper-preview-btn');
        if (epaperPreviewBtn) {
            epaperPreviewBtn.addEventListener('click', () => {
                triggerEpaperRefresh();
            });
        }

        // Tactile SFX Controls
        const sfxToggle = document.getElementById('reader-sfx-toggle');
        const sfxSlider = document.getElementById('reader-sfx-volume-slider');
        const sfxVal = document.getElementById('reader-sfx-volume-val');

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

        // Case and chapter progression management buttons
        const relockBtn = document.getElementById('relock-cases-btn');
        if (relockBtn) {
            relockBtn.addEventListener('click', () => {
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('case_solved_') || key.startsWith('chapter_read_') || key.startsWith('deduction_engine_save_')) {
                        localStorage.removeItem(key);
                    }
                });
                renderNavigation();
                if (activeDocPath) loadDocument(activeDocPath);
                alert("🔒 All progression reset. Gated chapters and cases are now locked!");
            });
        }

        const unlockBtn = document.getElementById('unlock-cases-btn');
        if (unlockBtn) {
            unlockBtn.addEventListener('click', () => {
                Object.values(progressionRules).forEach(r => {
                    if (r.requires) {
                        if (r.requires.type === 'chapter' || (r.requires.id && r.requires.id.endsWith('.nwd'))) {
                            localStorage.setItem(`chapter_read_${r.requires.id}`, 'true');
                        } else if (r.requires.id) {
                            localStorage.setItem(`case_solved_${r.requires.id}`, 'true');
                        }
                    }
                });
                docList.forEach(d => {
                    if (d.path) localStorage.setItem(`chapter_read_${d.path}`, 'true');
                });
                renderNavigation();
                if (activeDocPath) loadDocument(activeDocPath);
                alert("🔓 All cases marked solved and all chapters unlocked!");
            });
        }
    }

    async function loadTagsIndex() {
        try {
            const res = await fetch(`${basePath}meta/index.json?t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                tagsIndex = data["novelWriter.tagsIndex"] || {};
            }
        } catch (e) {
            console.error("Failed to load meta/index.json:", e);
        }
    }

    let projectStructure = {};

    // 7. Load and Parse ToC (directly from nwProject.nwx)
    function loadTableOfContents() {
        if (window.location.protocol === 'file:') {
            const bodyContainer = document.getElementById('document-body');
            bodyContainer.innerHTML = `
                <div class="loader" style="text-align:center; padding:40px; color:var(--text-primary);">
                    <div style="font-size: 40px; margin-bottom: 20px;">⚠️</div>
                    <h3>Browser Security (CORS) Restriction</h3>
                    <p style="margin: 15px 0; max-width: 500px; line-height: 1.5; font-size: 14px; color: var(--text-secondary);">
                        Browsers restrict loading files via <code>fetch()</code> when opening pages directly from the file system (using <code>file://</code>).
                    </p>
                    <div style="text-align: left; background: var(--bg-tertiary); padding: 18px; border-radius: var(--border-radius-md); border: 1px solid var(--border-color); font-size: 13px; max-width: 500px; line-height: 1.6;">
                        <strong style="color:var(--accent);">To view the reader locally, run a local web server:</strong><br>
                        1. Open a terminal in the project directory.<br>
                        2. Run: <code>python3 -m http.server 8000</code><br>
                        3. Open: <a href="http://localhost:8000/reader/" target="_blank" style="color:var(--accent); text-decoration: underline;">http://localhost:8000/reader/</a><br><br>
                        <strong style="color:var(--accent);">Or host it on GitHub:</strong><br>
                        Push this project to a GitHub repository and enable GitHub Pages in the repository settings!
                    </div>
                </div>
            `;
            document.getElementById('chapters-list').innerHTML = '<li class="nav-placeholder">Run a server to load chapters</li>';
            document.getElementById('current-chapter-title').innerText = 'Local Preview Restriction';
            return;
        }

        Promise.all([loadTagsIndex(), loadProgressionRules()]).finally(async () => {
            try {
                const res = await fetch(`${basePath}nwProject.nwx?t=${Date.now()}`);
                if (!res.ok) throw new Error('nwProject.nwx could not be found.');
                const text = await res.text();
                
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, 'text/xml');

                // Extract project name dynamically
                const projectNameNode = xmlDoc.querySelector('project > name');
                if (projectNameNode) {
                    const projectName = projectNameNode.textContent.trim();
                    document.title = `${projectName} Reader`;
                    const logoTitleNode = document.querySelector('.logo-title');
                    if (logoTitleNode) {
                        logoTitleNode.textContent = projectName.toUpperCase();
                    }
                }
                
                const contentNode = xmlDoc.getElementsByTagName('content')[0];
                if (contentNode) {
                    totalNovelWords = contentNode.getAttribute('novelWords') || '0';
                }
                
                const items = xmlDoc.getElementsByTagName('item');
                
                projectStructure = {};
                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    const handle = item.getAttribute('handle');
                    const parent = item.getAttribute('parent');
                    const type = item.getAttribute('type');
                    const className = item.getAttribute('class');
                    const layout = item.getAttribute('layout') || '';
                    
                    const nameNode = item.getElementsByTagName('name')[0];
                    const name = nameNode ? nameNode.textContent : '';
                    
                    projectStructure[handle] = {
                        handle,
                        parent,
                        type,
                        class: className,
                        layout,
                        name,
                        children: []
                    };
                }
                
                // Helper to check if item is in trash
                function isTrash(handle) {
                    let current = projectStructure[handle];
                    while (current) {
                        if (current.class === 'TRASH') return true;
                        current = projectStructure[current.parent];
                    }
                    return false;
                }
                
                // Build docList directly from XML elements
                docList = Object.values(projectStructure)
                    .filter(item => item.type === 'FILE' && !isTrash(item.handle))
                    .map(item => ({
                        hash: item.handle,
                        path: `content/${item.handle}.nwd`,
                        class: item.class,
                        layout: item.layout,
                        title: item.name,
                        parentHash: item.parent,
                        children: []
                    }));
                
                // Build hierarchy parent-children links in projectStructure
                for (const item of Object.values(projectStructure)) {
                    if (item.parent && projectStructure[item.parent]) {
                        projectStructure[item.parent].children.push(item);
                    }
                }
                
                initializeNovelStructure();
                buildDynamicAliases();
                renderNavigation();
                handleRoute(); // Load default file or route from URL parameter
                
            } catch (err) {
                console.error(err);
                document.getElementById('chapters-list').innerHTML = `
                    <li class="nav-placeholder" style="color:red">Failed to load project files: ${err.message}</li>
                `;
            }
        });
    }

    // Link parent-children relationships for NOVEL items in docList
    function initializeNovelStructure() {
        const novels = docList.filter(d => d.class === 'NOVEL');
        novels.forEach(item => {
            const parent = docList.find(p => p.hash === item.parentHash);
            if (parent) {
                parent.children.push(item);
            }
        });
    }

    // Resolves human-readable categories by walking up folder hierarchy
    function getLoreCategoryName(item) {
        let currentHash = item.parentHash;
        let pathParts = [];

        while (currentHash && projectStructure[currentHash]) {
            const node = projectStructure[currentHash];
            if (node.type === 'FOLDER' || node.type === 'ROOT') {
                pathParts.unshift(node.name);
            }
            currentHash = node.parent;
        }

        if (pathParts.length > 0) {
            // Join category path: e.g. "History > World 8" or "Characters > Former 36th SOT Members"
            return pathParts.join(' > ');
        }

        // Fallback to class name if no parent hierarchy
        return `${item.class} Notes`;
    }

    // Group and render sidebar items
    function renderNavigation(justUnlockedPaths = []) {
        const chaptersList = document.getElementById('chapters-list');
        const loreCategories = document.getElementById('lore-categories');

        chaptersList.innerHTML = '';
        loreCategories.innerHTML = '';

        const novels = docList.filter(item => item.class === 'NOVEL');
        const novelHashes = new Set(novels.map(item => item.hash));
        
        // Filter chapters: only display top-level chapters/folders
        const rootChapters = novels.filter(item => !novelHashes.has(item.parentHash));
        const loreItems = docList.filter(item => item.class !== 'NOVEL');

        // Render Chapters
        rootChapters.forEach(ch => {
            const li = document.createElement('li');
            li.className = 'nav-item';
            li.dataset.path = ch.path;

            const req = progressionRules[ch.path];
            const unlocked = isChapterUnlocked(ch.path);
            const isRead = localStorage.getItem(`chapter_read_${ch.path}`) === 'true';

            let statusSubtitle = ch.layout;
            if (req && req.requires) {
                if (!unlocked) {
                    li.classList.add('locked-nav-item');
                    statusSubtitle = req.requires.type === 'chapter' ? '🔒 Chapter Required' : '🔒 Case Required';
                } else {
                    li.classList.add('unlocked-nav-item');
                    statusSubtitle = isRead ? '✓ Completed' : (req.requires.type === 'chapter' ? '✓ Chapter Unlocked' : '✓ Case Solved');
                }
            } else if (isRead) {
                li.classList.add('unlocked-nav-item');
                statusSubtitle = '✓ Completed';
            }

            if (ch.path === activeDocPath) {
                li.classList.add('active');
            }

            if (justUnlockedPaths && justUnlockedPaths.includes(ch.path)) {
                li.classList.add('just-unlocked');
            }

            li.innerHTML = `
                <span class="nav-item-title">${req && !unlocked ? '🔒 ' : ''}${ch.title}</span>
                <span class="nav-item-subtitle">${statusSubtitle}</span>
            `;
            li.addEventListener('click', () => navigateToDocument(ch.path));
            chaptersList.appendChild(li);
        });

        // Group and Render Lore items
        const groupedLore = {};
        loreItems.forEach(item => {
            const category = getLoreCategoryName(item);
            if (!groupedLore[category]) {
                groupedLore[category] = [];
            }
            groupedLore[category].push(item);
        });

        for (const [category, items] of Object.entries(groupedLore)) {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'lore-group';

            // Category header
            const header = document.createElement('div');
            header.className = 'lore-group-header';
            header.innerText = category;
            groupDiv.appendChild(header);

            // Item list
            const ul = document.createElement('ul');
            ul.className = 'nav-list';

            items.forEach(item => {
                const li = document.createElement('li');
                li.className = 'nav-item';
                li.dataset.path = item.path;
                li.innerHTML = `
                    <span class="nav-item-title">${item.title}</span>
                    <span class="nav-item-subtitle">${item.layout}</span>
                `;
                li.addEventListener('click', () => navigateToDocument(item.path));
                ul.appendChild(li);
            });

            groupDiv.appendChild(ul);
            loreCategories.appendChild(groupDiv);
        }

        // Setup search functionality
        initSearch();
    }

    // Search bar filter
    function initSearch() {
        const searchInput = document.getElementById('search-input');
        
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            
            document.querySelectorAll('.nav-item').forEach(item => {
                const title = item.querySelector('.nav-item-title').innerText.toLowerCase();
                const subtitle = item.querySelector('.nav-item-subtitle').innerText.toLowerCase();
                
                if (title.includes(query) || subtitle.includes(query)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });

            // Hide lore groups if all their items are hidden
            document.querySelectorAll('.lore-group').forEach(group => {
                const visibleItems = Array.from(group.querySelectorAll('.nav-item')).filter(i => i.style.display !== 'none');
                if (visibleItems.length === 0 && query !== '') {
                    group.style.display = 'none';
                } else {
                    group.style.display = 'block';
                }
            });
        });
    }

    // URL State Routing
    function handleRoute() {
        const params = new URLSearchParams(window.location.search);
        const pathParam = params.get('file') || params.get('doc');

        if (pathParam && docList.some(item => item.path === pathParam)) {
            loadDocument(pathParam);
        } else {
            // Try loading from bookmark first if no explicit URL file param is set
            const savedPath = localStorage.getItem('chronos_bookmark_path');
            if (savedPath && docList.some(item => item.path === savedPath)) {
                navigateToDocument(savedPath);
            } else if (docList.length > 0) {
                // Load the first NOVEL chapter by default
                const firstNovel = docList.find(item => item.class === 'NOVEL');
                if (firstNovel) {
                    navigateToDocument(firstNovel.path);
                } else {
                    loadDocument(docList[0].path);
                }
            }
        }
    }

    function navigateToDocument(path) {
        // Close sidebar on mobile
        document.getElementById('sidebar').classList.add('collapsed');

        // Update URL
        const url = new URL(window.location);
        url.searchParams.set('file', path);
        window.history.pushState({}, '', url);

        loadDocument(path);
    }

    // 8. Fetch, Parse, and Render File (Consolidating sub-scenes dynamically)
    async function loadDocument(path) {
        activeDocPath = path;
        focusedParagraphIndex = -1;
        const bodyContainer = document.getElementById('document-body');
        
        const activeDoc = docList.find(d => d.path === path);
        if (activeDoc) {
            if (activeDoc.class === 'NOVEL') {
                switchSidebarTab('manuscript');
            } else {
                switchSidebarTab('lore');
            }
        }
        
        // Update active sidebar selection
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.path === path) {
                item.classList.add('active');
            }
        });

        document.getElementById('current-chapter-title').innerText = activeDoc ? activeDoc.title : '36th SOT';

        // Check if chapter is locked behind an unsolved case or unread chapter
        if (!isChapterUnlocked(path)) {
            const rule = progressionRules[path];
            const req = rule ? rule.requires : null;
            const activeDoc = docList.find(d => d.path === path);
            const isCaseReq = !req || req.type === 'case';
            
            bodyContainer.innerHTML = `
                <div class="chapter-locked-screen">
                    <div class="locked-security-banner">
                        <span style="color: var(--accent);">☭</span>
                        <span>MVD COGNITIVE CLEARANCE REQUIRED // SECURITY LEVEL 2</span>
                    </div>
                    <div class="locked-icon">🔒</div>
                    <h2 class="locked-chapter-title">${activeDoc ? activeDoc.title : 'Restricted Chapter'}</h2>
                    <p class="locked-description">
                        This chapter is classified. You must first complete the required ${isCaseReq ? 'investigation in the <strong>Case Investigation Terminal</strong>' : 'preceding chapter in the <strong>Novel Reader</strong>'}.
                    </p>

                    <div class="locked-case-card">
                        <div class="locked-case-header">
                            <span>📋 ${isCaseReq ? 'PREREQUISITE CASE INVESTIGATION' : 'PREREQUISITE NOVEL CHAPTER'}</span>
                            <span class="locked-status-tag">STATUS: LOCKED</span>
                        </div>
                        <div class="locked-case-title">${req?.title || (isCaseReq ? 'Case Investigation' : 'Previous Chapter')}</div>
                        <div class="locked-case-teaser">“${req?.teaser || (isCaseReq ? 'Reconstruct the investigation timeline to unlock.' : 'Read the previous chapter to unlock.')}”</div>
                        <a href="${req?.url || (isCaseReq ? 'game.html' : 'index.html')}" class="locked-case-action-btn">
                            <span>${isCaseReq ? '🚀 Launch Case Investigation' : '📖 Read Required Chapter'}</span>
                            <span>↵</span>
                        </a>
                    </div>
                </div>
            `;
            bodyContainer.classList.remove('transition-exit');
            setupPrevNextButtons();
            return;
        }

        // 1. Add fade-out transition class
        bodyContainer.classList.add('transition-exit');
        
        // 2. Start fetching in parallel
        let fetchError = null;
        let combinedHtml = '';
        
        const fetchPromise = (async () => {
            // Reset document metadata state
            chapterMetadata = {
                povs: new Set(),
                focuses: new Set(),
                characters: new Set(),
                mentions: new Set(),
                tags: new Set()
            };
            footnoteMap = {};
            encounteredFootnotes = [];

            try {
                // Find if this document has sub-scenes
                const docNode = docList.find(d => d.path === path);
                if (docNode && docNode.children && docNode.children.length > 0) {
                    // Fetch and parse the parent chapter container first
                    const parentRes = await fetch(`${basePath}${path}?t=${Date.now()}`);
                    if (!parentRes.ok) throw new Error('Parent container not found');
                    const parentText = await parentRes.text();
                    combinedHtml += parseNovelWriterFile(parentText, false);

                    // Fetch and parse all sub-scenes sequentially
                    for (let i = 0; i < docNode.children.length; i++) {
                        const child = docNode.children[i];
                        const childRes = await fetch(`${basePath}${child.path}?t=${Date.now()}`);
                        if (!childRes.ok) continue;
                        const childText = await childRes.text();

                        // Parse and append sub-scene content
                        combinedHtml += parseNovelWriterFile(childText, true);
                    }
                } else {
                    // Standalone document
                    const res = await fetch(`${basePath}${path}?t=${Date.now()}`);
                    if (!res.ok) throw new Error('File not found.');
                    const text = await res.text();
                    combinedHtml = parseNovelWriterFile(text, false);
                }

                // Append footnotes section once at the bottom of the consolidated HTML
                if (encounteredFootnotes.length > 0) {
                    combinedHtml += `
                        <div class="footnotes-section">
                            <h4 class="footnotes-title">Footnotes</h4>
                            <ol class="footnotes-list">
                    `;
                    encounteredFootnotes.forEach(hash => {
                        const content = footnoteMap[hash] || 'Footnote explanation not found.';
                        combinedHtml += `
                            <li id="fn-${hash}">
                                ${content}
                                <a href="#" class="footnote-back" data-hash="${hash}" title="Scroll back to text">↩</a>
                            </li>
                        `;
                    });
                    combinedHtml += `
                            </ol>
                        </div>
                    `;
                }
            } catch (err) {
                fetchError = err;
            }
        })();

        // 3. Wait for the exit transition (150ms)
        const exitDelay = new Promise(resolve => setTimeout(resolve, 150));
        await exitDelay;
        
        // 4. Check if fetch is already done. If not, show spinner
        let isFetchDone = false;
        fetchPromise.then(() => {
            isFetchDone = true;
        });
        
        // Brief sleep to yield and verify if fetch resolved instantly
        await new Promise(resolve => setTimeout(resolve, 0));
        
        if (!isFetchDone) {
            bodyContainer.innerHTML = `
                <div class="loader">
                    <div class="spinner"></div>
                    <p>Loading document content...</p>
                </div>
            `;
            // Fade loader in by temporarily removing transition-exit
            bodyContainer.classList.remove('transition-exit');
            bodyContainer.classList.add('transition-enter');
            bodyContainer.offsetHeight; // trigger reflow
            bodyContainer.classList.remove('transition-enter');
        }
        
        // 5. Wait for the fetch promise to complete
        await fetchPromise;
        
        // 6. Fade out loader if it was shown
        if (bodyContainer.querySelector('.loader')) {
            bodyContainer.classList.add('transition-exit');
            await new Promise(resolve => setTimeout(resolve, 150));
        }
        
        // 7. Inject loaded content / error
        if (fetchError) {
            console.error(fetchError);
            bodyContainer.innerHTML = `
                <div style="color:red; text-align:center; padding:40px;">
                    <h3>Failed to load document</h3>
                    <p>${fetchError.message}</p>
                </div>
            `;
        } else {
            bodyContainer.innerHTML = combinedHtml;
        }

        // 8. Render meta dossier & setups
        renderMetaDossier();
        setupFootnotesTooltips();
        setupChapterKeywords(path);
        setupPrevNextButtons();

        // 9. Restore scroll position
        const savedPath = localStorage.getItem('chronos_bookmark_path');
        let restored = false;
        
        if (savedPath === path) {
            const savedRatio = parseFloat(localStorage.getItem('chronos_bookmark_ratio') || '0');
            if (savedRatio > 0.01) {
                const wrapper = document.getElementById('document-wrapper');
                setTimeout(() => {
                    const scrollHeight = wrapper.scrollHeight - wrapper.clientHeight;
                    wrapper.scrollTop = savedRatio * scrollHeight;
                    showResumeToast();
                    triggerSpotlightUpdate();
                }, 100);
                restored = true;
            }
        }

        if (!restored) {
            document.getElementById('document-wrapper').scrollTop = 0;
            triggerSpotlightUpdate();
        }

        // 10. Reveal the new content with Electro-Cellulose E-Paper Magnetic Refresh
        bodyContainer.classList.remove('transition-exit');
        if (settings.epaperTransition) {
            triggerEpaperRefresh();
        } else {
            bodyContainer.classList.add('transition-enter');
            bodyContainer.offsetHeight; // trigger reflow
            bodyContainer.classList.remove('transition-enter');
        }
    }

    let epaperTimeout = null;
    function triggerEpaperRefresh() {
        const bodyContainer = document.getElementById('document-body');
        if (!bodyContainer) return;

        if (epaperTimeout) {
            clearTimeout(epaperTimeout);
            epaperTimeout = null;
        }

        bodyContainer.classList.remove('epaper-assembling');
        void bodyContainer.offsetWidth; // force reflow
        bodyContainer.classList.add('epaper-assembling');

        if (window.sfx && typeof window.sfx.playPaperRustle === 'function') {
            window.sfx.playPaperRustle();
        }

        const durationSec = typeof settings.epaperDuration === 'number' ? settings.epaperDuration : 0.50;
        const totalDurationMs = Math.max(500, Math.round(durationSec * 1600));

        epaperTimeout = setTimeout(() => {
            bodyContainer.classList.remove('epaper-assembling');
            epaperTimeout = null;
        }, totalDurationMs);
    }

    // Core Headless Parser
    function parseNovelWriterFile(rawText, isScene = false) {
        const lines = rawText.split('\n');
        let html = '';
        let isTitlePage = false;
        
        lines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;

            // 1. Metadata Block
            if (trimmed.startsWith('%%~')) {
                if (trimmed.startsWith('%%~name:')) {
                    const docName = trimmed.substring(8).trim().toLowerCase();
                    if (docName.includes('title page')) {
                        isTitlePage = true;
                    }
                }
                return; // Discard metadata header lines
            }

            // 2. Reference tags
            if (trimmed.startsWith('@pov:')) {
                trimmed.substring(5).split(',').forEach(c => chapterMetadata.povs.add(c.trim()));
                return;
            }
            if (trimmed.startsWith('@focus:')) {
                trimmed.substring(7).split(',').forEach(c => chapterMetadata.focuses.add(c.trim()));
                return;
            }
            if (trimmed.startsWith('@char:')) {
                trimmed.substring(6).split(',').forEach(c => chapterMetadata.characters.add(c.trim()));
                return;
            }
            if (trimmed.startsWith('@mention:')) {
                trimmed.substring(9).split(',').forEach(m => chapterMetadata.mentions.add(m.trim()));
                return;
            }
            if (trimmed.startsWith('@tag:')) {
                trimmed.substring(5).split(',').forEach(c => chapterMetadata.tags.add(c.trim()));
                return;
            }

            // 3. Footnote definitions: %Footnote.hash: content
            const fnMatch = trimmed.match(/^%Footnote\.(\w+):\s*(.*)$/);
            if (fnMatch) {
                footnoteMap[fnMatch[1]] = applyInlineFormatting(fnMatch[2]);
                return;
            }

            // 0. Spacing and Fields preprocessing
            let lineText = trimmed;
            
            // Replace [br]
            lineText = lineText.replace(/\[br\]/g, '<br>');
            
            // Replace [field:textWords]
            const formattedWords = Number(totalNovelWords || 0).toLocaleString();
            lineText = lineText.replace(/\[field:textWords\]/g, formattedWords);

            // Replace [vspace:N] or [vspace]
            const vspaceMatch = lineText.match(/^\[vspace:?(\d+)?\]$/);
            if (vspaceMatch) {
                const multiplier = vspaceMatch[1] ? parseInt(vspaceMatch[1]) : 1;
                html += `<div class="vspace" style="height: ${multiplier * 1.5}em;"></div>`;
                return;
            }

            // 4. Headings
            if (lineText.startsWith('#')) {
                const hashMatch = lineText.match(/^(#+)/);
                if (hashMatch) {
                    const level = hashMatch[1].length;
                    const rest = lineText.substring(level).trim();
                    
                    const hasBang = lineText.startsWith('#'.repeat(level) + '!');
                    const isDisplayHeader = !isScene || hasBang;
                    
                    if (isDisplayHeader) {
                        let cleanHeading = rest;
                        if (cleanHeading.startsWith('!')) {
                            cleanHeading = cleanHeading.substring(1).trim();
                        }
                        
                        html += `<h${level}>${cleanHeading}</h${level}>`;
                    }
                    return;
                }
            }

            // 5. Alignment check
            let alignClass = '';
            let isTransition = false;
            
            if (lineText.startsWith('>>') && lineText.endsWith('<<')) {
                lineText = lineText.substring(2, lineText.length - 2).trim();
                // Heuristic: If it's not the title page, is short, and has no formatting tags, treat as scene-divider (transition)
                if (!isTitlePage && lineText.length < 50 && !lineText.includes('**') && !lineText.includes('_') && !lineText.includes('*')) {
                    isTransition = true;
                } else {
                    alignClass = 'align-center';
                }
            } else if (lineText.startsWith('>>')) {
                lineText = lineText.substring(2).trim();
                alignClass = 'align-right';
            } else if (lineText.endsWith('<<')) {
                lineText = lineText.substring(0, lineText.length - 2).trim();
                alignClass = 'align-left';
            }

            if (isTransition) {
                html += `<div class="scene-divider"><span>${lineText}</span></div>`;
                return;
            }

            // 6. Regular Paragraph Body
            // Run speech parser first on raw text before HTML tag attributes are generated
            let parsedLine = parseParagraphSpeech(lineText);

            // Apply inline formatting and collectible [Keywords]
            parsedLine = applyInlineFormatting(parsedLine);

            // Parse Footnote references [footnote:hash]
            parsedLine = parsedLine.replace(/\[footnote:(\w+)\]/g, (match, hash) => {
                let fnIndex = encounteredFootnotes.indexOf(hash);
                if (fnIndex === -1) {
                    encounteredFootnotes.push(hash);
                    fnIndex = encounteredFootnotes.length;
                } else {
                    fnIndex = fnIndex + 1; // 1-indexed
                }
                return `<sup><button class='footnote-ref' data-hash='${hash}'>[${fnIndex}]</button></sup>`;
            });

            // Wrap in paragraph tag
            if (parsedLine.includes('class="has-speech"')) {
                if (alignClass) {
                    parsedLine = parsedLine.replace('class="has-speech"', `class="has-speech ${alignClass}"`);
                }
                html += parsedLine; // Already wrapped in <p class="has-speech">
            } else {
                const classAttr = alignClass ? ` class="${alignClass}"` : '';
                html += `<p${classAttr}>${parsedLine}</p>`;
            }
        });

        return html;
    }

    function applyInlineFormatting(text) {
        if (!text) return '';
        let res = text
            .replace(/\*\*([^\s\*](?:[^\*]*?[^\s\*])?)\*\*/g, '<strong>$1</strong>')
            .replace(/__([^\s_](?:[^_]*?[^\s_])?)__/g, '<strong>$1</strong>')
            .replace(/\[b\](.*?)\[\/b\]/g, '<strong>$1</strong>')
            .replace(/_([^\s_](?:[^_]*?[^\s_])?)_/g, '<em>$1</em>')
            .replace(/\*([^\s\*](?:[^\*]*?[^\s\*])?)\*/g, '<em>$1</em>')
            .replace(/\[i\](.*?)\[\/i\]/g, '<em>$1</em>')
            .replace(/~~(.*?)~~/g, '<del>$1</del>')
            .replace(/==(.*?)==/g, '<mark>$1</mark>');

        // Parse Russian Cyrillic + IPA phonetic pronunciation buttons: e.g. (Валенки [ˈvalʲɪnkʲɪ])
        res = res.replace(/([А-Яа-яЁё\-]+(?:\s+[А-Яа-яЁё\-]+)*)\s*\[([^\]]+)\]/g, (match, word, ipa) => {
            const cleanWord = word.trim();
            const cleanIpa = ipa.trim();
            return `${cleanWord} <button type="button" class="pronounce-btn" data-speak="${cleanWord}" title="Click to hear Russian pronunciation: ${cleanWord}">🔊 &#91;${cleanIpa}&#93;</button>`;
        });

        // Parse collectible [Keywords] (avoiding system tags like [br], [vspace], [field:], [footnote:], [img:], [b], [/b], [i], [/i])
        res = res.replace(/\[\[([^\]]+)\]\]/g, '<span class="reader-kw" data-word="$1" tabindex="0" role="button" title="Click to collect keyword for case investigations">$1</span>');
        res = res.replace(/\[(?!br\b|vspace\b|field:|footnote:|img:|b\b|\/b\b|i\b|\/i\b)([^\]]+)\]/g, '<span class="reader-kw" data-word="$1" tabindex="0" role="button" title="Click to collect keyword for case investigations">$1</span>');

        return res;
    }

    function setupChapterKeywords(path) {
        if (!path) return;
        const kwEls = document.querySelectorAll('.reader-kw');
        if (kwEls.length === 0) return;

        let saved = [];
        try {
            const raw = localStorage.getItem(`chapter_keywords_${path}`);
            if (raw) saved = JSON.parse(raw);
        } catch (e) {}

        const collectedSet = new Set(Array.isArray(saved) ? saved : []);

        kwEls.forEach(el => {
            const word = el.dataset.word || el.innerText.trim();
            if (collectedSet.has(word)) {
                el.classList.add('collected');
            }

            el.addEventListener('click', (e) => {
                e.stopPropagation();
                collectedSet.add(word);
                el.classList.add('collected');
                localStorage.setItem(`chapter_keywords_${path}`, JSON.stringify(Array.from(collectedSet)));
                showUnlockToast(`Keyword Discovered: "${word}"`, `game.html`, 'case');
            });

            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    el.click();
                }
            });
        });
    }

    function autoCollectAllChapterKeywords(path) {
        if (!path) return;
        const kwEls = document.querySelectorAll('.reader-kw');
        if (kwEls.length === 0) return;

        let saved = [];
        try {
            const raw = localStorage.getItem(`chapter_keywords_${path}`);
            if (raw) saved = JSON.parse(raw);
        } catch (e) {}

        const collectedSet = new Set(Array.isArray(saved) ? saved : []);
        kwEls.forEach(el => {
            const word = el.dataset.word || el.innerText.trim();
            if (word) {
                collectedSet.add(word);
                el.classList.add('collected');
            }
        });
        localStorage.setItem(`chapter_keywords_${path}`, JSON.stringify(Array.from(collectedSet)));
    }

    // Speech tagging heuristics
    function parseParagraphSpeech(paragraph) {
        // Matches text inside typographer quotes “...” or standard quotes "..."
        const speechRegex = /[“"]([^”"]+)[”"]/g;
        if (!paragraph.match(speechRegex)) return paragraph;

        // Wrap the quotes inside spans
        const styledParagraph = paragraph.replace(speechRegex, (match, speechContent) => {
            return `<span class="speech-quote">“${speechContent}”</span>`;
        });

        return `<p class="has-speech">${styledParagraph}</p>`;
    }

    function buildDynamicAliases() {
        dynamicAliases = {};
        
        // Initialize for all docs
        for (const doc of docList) {
            dynamicAliases[doc.hash] = new Set();
            
            // Add lowercase title
            const cleanTitle = doc.title.toLowerCase().trim();
            dynamicAliases[doc.hash].add(cleanTitle);
            
            // Generate split-word aliases
            const words = cleanTitle.split(/[\s'’]+/);
            const commonTitles = new Set(["commander", "coordinator", "general", "minor", "member", "members", "the", "and", "notes", "codex", "project", "interlude", "intermission"]);
            for (const word of words) {
                const cleanWord = word.replace(/[^a-zA-Z0-9-]/g, "").toLowerCase().trim();
                if (cleanWord.length > 2 && !commonTitles.has(cleanWord)) {
                    dynamicAliases[doc.hash].add(cleanWord);
                }
            }
        }
        
        // Add all tags pointing to the same handle from tagsIndex
        for (const [tag, tagInfo] of Object.entries(tagsIndex)) {
            const handle = tagInfo.handle;
            if (handle && dynamicAliases[handle]) {
                dynamicAliases[handle].add(tag.toLowerCase().trim());
            }
        }
        
        // Special case: If a character note represents "Commander Eisenhardt" (our main POV),
        // we can map "you" to it if it isn't already.
        const eisenhardtDoc = docList.find(d => d.title.includes("Eisenhardt"));
        if (eisenhardtDoc) {
            dynamicAliases[eisenhardtDoc.hash].add("you");
        }
    }

    // Autocomplete font selection helpers
    async function scanLocalFonts() {
        if ('queryLocalFonts' in window) {
            try {
                const fonts = await window.queryLocalFonts();
                const families = Array.from(new Set(fonts.map(f => f.family))).sort();
                if (families.length > 0) {
                    localFontsList = families;
                    availableFonts["Installed Local Fonts"] = localFontsList;
                    renderFontSuggestions();
                    
                    const scanBtn = document.getElementById('scan-local-fonts-btn');
                    if (scanBtn) {
                        scanBtn.innerHTML = '✅';
                        scanBtn.title = `Found ${families.length} system fonts!`;
                    }
                }
            } catch (e) {
                console.warn("Failed scanning local fonts:", e);
                alert("Permission was denied or local fonts scan failed.");
            }
        } else {
            alert("Your browser does not support the Local Font Access API. Chrome, Edge, or Opera is recommended.");
        }
    }

    function renderFontSuggestions(query = "") {
        const resultsContainer = document.getElementById('font-search-results');
        if (!resultsContainer) return;
        
        resultsContainer.innerHTML = "";
        const cleanQuery = query.toLowerCase().trim();
        let hasMatches = false;
        
        for (const [groupName, fontList] of Object.entries(availableFonts)) {
            const filtered = fontList.filter(font => font.toLowerCase().includes(cleanQuery));
            if (filtered.length === 0) continue;
            
            hasMatches = true;
            
            const header = document.createElement('div');
            header.className = 'font-search-header';
            header.innerText = groupName;
            resultsContainer.appendChild(header);
            
            filtered.forEach(font => {
                const item = document.createElement('div');
                item.className = 'font-search-item';
                item.innerText = font;
                item.style.fontFamily = font === 'System Default' ? 'system-ui' : font;
                
                item.addEventListener('click', () => {
                    selectFont(font);
                });
                resultsContainer.appendChild(item);
            });
        }
        
        if (cleanQuery && !hasMatches) {
            const header = document.createElement('div');
            header.className = 'font-search-header';
            header.innerText = "Custom Font Option";
            resultsContainer.appendChild(header);

            const item = document.createElement('div');
            item.className = 'font-search-item';
            item.innerText = `Use "${query}"...`;
            item.addEventListener('click', () => {
                selectFont(query);
            });
            resultsContainer.appendChild(item);
        }
    }

    function selectFont(fontName) {
        settings.fontFamily = fontName;
        applySettings();
        saveSettings();
        
        const dropdown = document.getElementById('font-search-results');
        if (dropdown) dropdown.classList.remove('open');
    }

    function findLoreDocument(name) {
        const cleanName = name.toLowerCase().trim();
        
        // 1. Direct match on dynamicAliases (which includes title, tagsIndex, split words, and special aliases)
        for (const [handle, aliases] of Object.entries(dynamicAliases)) {
            if (aliases.has(cleanName)) {
                const doc = docList.find(d => d.hash === handle);
                if (doc) return doc;
            }
        }
        
        // 2. Fallback to direct match on title substring
        let match = docList.find(d => d.title.toLowerCase().trim() === cleanName);
        if (match) return match;
        
        // 3. Fallback to substring matching on name (e.g. "Hadiya al-Kuwari" if search is "Hadiya")
        match = docList.find(d => d.title.toLowerCase().includes(cleanName));
        if (match) return match;

        return null;
    }

    function renderBadgeWithLink(name, extraClass = '', extraStyle = '') {
        const doc = findLoreDocument(name);
        const styleAttr = extraStyle ? ` style="${extraStyle}"` : '';
        if (doc) {
            return `<button class="badge badge-link ${extraClass}" data-path="${doc.path}"${styleAttr} title="Click to view Lore Codex for ${name}">${name}</button>`;
        }
        return `<span class="badge ${extraClass}"${styleAttr}>${name}</span>`;
    }

    // 9. Render Meta Dossier Card
    function renderMetaDossier() {
        const dossier = document.getElementById('metadata-dossier');
        dossier.innerHTML = '';

        const activeDoc = docList.find(d => d.path === activeDocPath);
        const isTitlePage = activeDoc && activeDoc.title.toLowerCase().includes('title page');

        if (isTitlePage) {
            dossier.style.display = 'none';
            return;
        }

        const bodyContainer = document.getElementById('document-body');
        const plainText = bodyContainer ? (bodyContainer.innerText || "") : "";
        const words = plainText.trim().split(/\s+/).filter(w => {
            if (!w) return false;
            if (/^\[\d+\]$/.test(w)) return false; // exclude footnote markers like [1]
            return true;
        });
        const wordCount = words.length;
        const readingTime = Math.max(1, Math.round(wordCount / 200));
        
        let hasData = false;

        // Stats Row (Reading Time and Word Count)
        if (wordCount > 0) {
            const row = document.createElement('div');
            row.className = 'dossier-row';
            row.innerHTML = `
                <div class="dossier-label">Stats</div>
                <div class="dossier-values" style="align-items: center; color: var(--text-secondary); font-weight: 500;">
                    <span>⏱️ ${readingTime} min read &nbsp;•&nbsp; ${wordCount.toLocaleString()} words</span>
                </div>
            `;
            dossier.appendChild(row);
            hasData = true;
        }

        // POV
        if (chapterMetadata.povs.size > 0) {
            const row = document.createElement('div');
            row.className = 'dossier-row';
            row.innerHTML = `
                <div class="dossier-label">POV</div>
                <div class="dossier-values">
                    ${Array.from(chapterMetadata.povs).map(p => renderBadgeWithLink(p, 'badge-pov')).join('')}
                </div>
            `;
            dossier.appendChild(row);
            hasData = true;
        }

        // Focus
        if (chapterMetadata.focuses.size > 0) {
            const row = document.createElement('div');
            row.className = 'dossier-row';
            row.innerHTML = `
                <div class="dossier-label">Focus</div>
                <div class="dossier-values">
                    ${Array.from(chapterMetadata.focuses).map(f => renderBadgeWithLink(f, 'badge-focus')).join('')}
                </div>
            `;
            dossier.appendChild(row);
            hasData = true;
        }

        // Characters Present
        if (chapterMetadata.characters.size > 0) {
            const row = document.createElement('div');
            row.className = 'dossier-row';
            row.innerHTML = `
                <div class="dossier-label">Characters</div>
                <div class="dossier-values">
                    ${Array.from(chapterMetadata.characters).map(c => renderBadgeWithLink(c)).join('')}
                </div>
            `;
            dossier.appendChild(row);
            hasData = true;
        }

        // Mentions
        if (chapterMetadata.mentions.size > 0) {
            const row = document.createElement('div');
            row.className = 'dossier-row';
            row.innerHTML = `
                <div class="dossier-label">Mentions</div>
                <div class="dossier-values">
                    ${Array.from(chapterMetadata.mentions).map(m => renderBadgeWithLink(m, '', 'font-style:italic;')).join('')}
                </div>
            `;
            dossier.appendChild(row);
            hasData = true;
        }

        if (hasData) {
            dossier.style.display = 'flex';
        } else {
            dossier.style.display = 'none';
        }
    }

    // 10. Interactive Footnote Tooltips
    function setupFootnotesTooltips() {
        const tooltip = document.getElementById('footnote-tooltip');
        const tooltipContent = tooltip.querySelector('.tooltip-content');
        const tooltipClose = tooltip.querySelector('.tooltip-close');

        // Close tooltip event
        tooltipClose.addEventListener('click', hideTooltip);

        // Position and show tooltip
        document.querySelectorAll('.footnote-ref').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const hash = btn.dataset.hash;
                const content = footnoteMap[hash] || 'Footnote definition not found.';
                
                tooltipContent.innerHTML = content;
                tooltip.classList.remove('hidden');

                // Positioning logic
                const rect = btn.getBoundingClientRect();
                const tooltipWidth = 300;
                
                let topPosition = rect.bottom + window.scrollY + 8;
                let leftPosition = rect.left + window.scrollX - (tooltipWidth / 2) + (rect.width / 2);

                // Boundary collision checking
                if (leftPosition < 10) leftPosition = 10;
                if (leftPosition + tooltipWidth > window.innerWidth - 10) {
                    leftPosition = window.innerWidth - tooltipWidth - 10;
                }

                tooltip.style.top = `${topPosition}px`;
                tooltip.style.left = `${leftPosition}px`;
                tooltip.classList.add('visible');
            });
        });

        // Setup Footnote Backlink clicks to scroll to reference
        document.querySelectorAll('.footnote-back').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const hash = link.dataset.hash;
                const ref = document.querySelector(`.footnote-ref[data-hash="${hash}"]`);
                if (ref) {
                    ref.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Visual highlight animation
                    ref.style.backgroundColor = 'var(--accent-glow)';
                    ref.style.boxShadow = '0 0 8px var(--accent)';
                    setTimeout(() => {
                        ref.style.backgroundColor = '';
                        ref.style.boxShadow = '';
                    }, 2000);
                }
            });
        });

        // Close tooltip when clicking outside
        document.addEventListener('click', (e) => {
            if (!tooltip.contains(e.target)) {
                hideTooltip();
            }
        });

        function hideTooltip() {
            tooltip.classList.remove('visible');
            setTimeout(() => {
                if (!tooltip.classList.contains('visible')) {
                    tooltip.classList.add('hidden');
                }
            }, 150);
        }
    }

    // 11. Russian Term Pronunciation Player (Hybrid: Auto-Indexed Audio Files + Dynamic Transliteration + Web Speech Fallback)
    const CYRILLIC_TO_LATIN = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };

    function cyrillicToSlug(text) {
        return String(text || '').toLowerCase().split('').map(c => {
            if (CYRILLIC_TO_LATIN[c] !== undefined) return CYRILLIC_TO_LATIN[c];
            if (/[a-z0-9\-_]/.test(c)) return c;
            return '';
        }).join('');
    }

    let pronunciationIndex = {};
    fetch('audio/pronunciations/index.json')
        .then(r => r.ok ? r.json() : {})
        .then(data => { pronunciationIndex = data || {}; })
        .catch(() => {});

    let currentPronounceAudio = null;

    function fallbackSpeech(text) {
        if (!('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            const cleanText = String(text).replace(/[\[\]\(\)\{\}\/_🔊]/g, '').trim();
            if (!cleanText) return;

            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = 'ru-RU';
            utterance.rate = 0.85; // Slightly slower, clear pacing for vocabulary learning
            utterance.pitch = 1.0;

            const voices = window.speechSynthesis.getVoices();
            const ruVoice = voices.find(v => v.lang && (v.lang === 'ru-RU' || v.lang.startsWith('ru')));
            if (ruVoice) {
                utterance.voice = ruVoice;
            }

            window.speechSynthesis.speak(utterance);
        } catch (err) {
            console.warn('Speech synthesis error:', err);
        }
    }

    function speakRussian(text) {
        const cleanWord = String(text)
            .replace(/[\[\]\(\)\{\}\/_🔊\.,!?:;'"]/g, '')
            .trim();
        if (!cleanWord) return;

        if (currentPronounceAudio) {
            try {
                currentPronounceAudio.pause();
                currentPronounceAudio.currentTime = 0;
            } catch (e) {}
        }

        const key = cleanWord.toLowerCase();
        const slug = cyrillicToSlug(key);
        const audioSrc = pronunciationIndex[key] || pronunciationIndex[slug] || `audio/pronunciations/${slug}.mp3`;

        const audio = new Audio(audioSrc);
        currentPronounceAudio = audio;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(err => {
                console.warn('Local audio playback failed, falling back to Web Speech API:', err);
                fallbackSpeech(cleanWord);
            });
        }
    }

    // Global Pronunciation Button Listener (Works in tooltips, footnote list, anywhere)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.pronounce-btn');
        if (btn) {
            e.stopPropagation();
            const word = btn.getAttribute('data-speak') || btn.innerText;
            btn.classList.add('speaking');
            speakRussian(word);
            setTimeout(() => {
                btn.classList.remove('speaking');
            }, 1200);
        }
    });



    // 12. Bottom Navigation Page Turners
    function setupPrevNextButtons() {
        const novels = docList.filter(item => item.class === 'NOVEL');
        const novelHashes = new Set(novels.map(item => item.hash));
        const rootChapters = novels.filter(item => !novelHashes.has(item.parentHash));
        const currentIndex = rootChapters.findIndex(n => n.path === activeDocPath);

        const prevBtn = document.getElementById('prev-chapter-btn');
        const nextBtn = document.getElementById('next-chapter-btn');

        if (currentIndex > 0) {
            prevBtn.disabled = false;
            const prevDoc = rootChapters[currentIndex - 1];
            document.getElementById('prev-chapter-title').innerText = prevDoc.title;
            // Clear previous events
            const newPrevBtn = prevBtn.cloneNode(true);
            prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
            newPrevBtn.addEventListener('click', () => navigateToDocument(prevDoc.path));
        } else {
            prevBtn.disabled = true;
        }

        if (currentIndex !== -1 && currentIndex < rootChapters.length - 1) {
            nextBtn.disabled = false;
            const nextDoc = rootChapters[currentIndex + 1];
            document.getElementById('next-chapter-title').innerText = nextDoc.title;
            const newNextBtn = nextBtn.cloneNode(true);
            nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
            newNextBtn.addEventListener('click', () => {
                navigateToDocument(nextDoc.path);
            });
        } else {
            nextBtn.disabled = true;
        }
    }

    // 13. Progress Scroll Bar Indicator & Auto-Bookmark
    let saveScrollTimeout;
    function updateScrollProgress() {
        const wrapper = document.getElementById('document-wrapper');
        const progressBar = document.getElementById('progress-bar');
        
        wrapper.addEventListener('scroll', () => {
            const scrollTop = wrapper.scrollTop;
            const scrollHeight = wrapper.scrollHeight - wrapper.clientHeight;
            const percent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
            progressBar.style.width = `${percent}%`;

            // Dynamically update paragraph spotlight in Zen Mode on scroll
            triggerSpotlightUpdate();

            // Auto-mark chapter as read upon completing (scrolling past 80%)
            if (activeDocPath && isChapterUnlocked(activeDocPath) && percent >= 80) {
                markChapterAsRead(activeDocPath);
            }

            // Auto-Bookmark Scroll Position (Debounced)
            if (activeDocPath) {
                clearTimeout(saveScrollTimeout);
                saveScrollTimeout = setTimeout(() => {
                    const activeDoc = docList.find(d => d.path === activeDocPath);
                    // Don't bookmark the Title Page
                    const isTitlePage = activeDoc && activeDoc.title.toLowerCase().includes('title page');
                    if (isTitlePage) return;

                    const scrollRatio = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
                    localStorage.setItem('chronos_bookmark_path', activeDocPath);
                    localStorage.setItem('chronos_bookmark_ratio', scrollRatio.toString());
                }, 300);
            }
        });
    }

    // 14. Popstate navigation (Back / Forward browser buttons support)
    window.addEventListener('popstate', () => {
        handleRoute();
    });

    let toastTimeout;

    function showResumeToast() {
        const toast = document.getElementById('resume-toast');
        if (!toast) return;

        toast.classList.remove('hidden');
        
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            hideResumeToast();
        }, 6000); // Hide after 6 seconds
    }

    function hideResumeToast() {
        const toast = document.getElementById('resume-toast');
        if (toast) {
            toast.classList.add('hidden');
        }
    }

    function setupResumeToastEvents() {
        const restartBtn = document.getElementById('toast-restart-btn');
        const closeBtn = document.getElementById('toast-close-btn');
        const wrapper = document.getElementById('document-wrapper');

        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                wrapper.scrollTop = 0;
                if (activeDocPath) {
                    localStorage.setItem('chronos_bookmark_ratio', '0');
                }
                hideResumeToast();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                hideResumeToast();
            });
        }
    }

    function setupUnlockToastEvents() {
        const closeBtn = document.getElementById('unlock-toast-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                hideUnlockToast();
            });
        }
    }

    let spotlightThrottleTimeout;
    function triggerSpotlightUpdate() {
        if (!spotlightThrottleTimeout) {
            spotlightThrottleTimeout = requestAnimationFrame(() => {
                updateSpotlight();
                spotlightThrottleTimeout = null;
            });
        }
    }

    function updateSpotlight() {
        const wrapper = document.getElementById('document-wrapper');
        const container = document.getElementById('document-body');
        if (!container || !wrapper) return;
        
        const blocks = Array.from(container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, .scene-divider'));
        if (blocks.length === 0) return;

        // Clean up spotlight classes if Zen/Spotlight is disabled
        if (!settings.zenEnabled || !settings.spotlightEnabled) {
            blocks.forEach(block => {
                block.classList.remove('scroll-active', 'scroll-neighbor-1', 'scroll-neighbor-2');
            });
            return;
        }

        const viewportHeight = window.innerHeight;
        const targetCenter = viewportHeight * 0.35; // 35% down from top

        // Find currently closest block to targetCenter to update focusedParagraphIndex
        let closestIndex = -1;
        let minDistance = Infinity;

        blocks.forEach((block, idx) => {
            const rect = block.getBoundingClientRect();
            // Overlap check: is this element covering the target reading center line?
            if (rect.top <= targetCenter && rect.bottom >= targetCenter) {
                closestIndex = idx;
                minDistance = 0;
                return;
            }
            const blockCenter = rect.top + rect.height / 2;
            const distance = Math.abs(blockCenter - targetCenter);
            if (distance < minDistance) {
                minDistance = distance;
                closestIndex = idx;
            }
        });

        if (closestIndex !== -1) {
            focusedParagraphIndex = closestIndex;
        }

        const size = parseInt(settings.spotlightSize) || 3;
        blocks.forEach((block, idx) => {
            block.classList.remove('scroll-active', 'scroll-neighbor-1', 'scroll-neighbor-2');
            const diff = Math.abs(idx - closestIndex);
            if (diff === 0) {
                block.classList.add('scroll-active');
            } else if (size >= 3 && diff === 1) {
                block.classList.add('scroll-neighbor-1');
            } else if (size >= 5 && diff === 2) {
                block.classList.add('scroll-neighbor-2');
            }
        });
    }

    function setupZenModeEvents() {
        const zenModeToggle = document.getElementById('zen-mode-toggle');
        const spotlightToggle = document.getElementById('spotlight-toggle');
        const spotlightSizeSelect = document.getElementById('spotlight-size-select');
        const zenExitBtn = document.getElementById('zen-exit-btn');

        if (zenModeToggle) {
            zenModeToggle.addEventListener('change', (e) => {
                settings.zenEnabled = e.target.checked;
                applySettings();
                saveSettings();
            });
        }

        if (spotlightToggle) {
            spotlightToggle.addEventListener('change', (e) => {
                settings.spotlightEnabled = e.target.checked;
                applySettings();
                saveSettings();
            });
        }

        if (spotlightSizeSelect) {
            spotlightSizeSelect.addEventListener('change', (e) => {
                settings.spotlightSize = parseInt(e.target.value);
                applySettings();
                saveSettings();
            });
        }

        if (zenExitBtn) {
            zenExitBtn.addEventListener('click', () => {
                settings.zenEnabled = false;
                applySettings();
                saveSettings();
            });
        }
    }

    function showShortcutsModal() {
        const modal = document.getElementById('shortcuts-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    function hideShortcutsModal() {
        const modal = document.getElementById('shortcuts-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    function setupShortcutsModalEvents() {
        const closeBtn = document.getElementById('shortcuts-close-btn');
        const backdrop = document.querySelector('#shortcuts-modal .modal-backdrop');
        const headerToggleBtn = document.getElementById('shortcuts-toggle-btn');
        const sidebarToggleBtn = document.getElementById('sidebar-shortcuts-btn');
        const zenShortcutsBtn = document.getElementById('zen-shortcuts-btn');

        if (closeBtn) {
            closeBtn.addEventListener('click', hideShortcutsModal);
        }
        if (backdrop) {
            backdrop.addEventListener('click', hideShortcutsModal);
        }
        if (headerToggleBtn) {
            headerToggleBtn.addEventListener('click', (e) => {
                const modal = document.getElementById('shortcuts-modal');
                if (modal && !modal.classList.contains('hidden')) {
                    hideShortcutsModal();
                } else {
                    showShortcutsModal();
                }
                e.stopPropagation();
            });
        }
        if (sidebarToggleBtn) {
            sidebarToggleBtn.addEventListener('click', (e) => {
                const modal = document.getElementById('shortcuts-modal');
                if (modal && !modal.classList.contains('hidden')) {
                    hideShortcutsModal();
                } else {
                    showShortcutsModal();
                }
                e.stopPropagation();
            });
        }
        if (zenShortcutsBtn) {
            zenShortcutsBtn.addEventListener('click', (e) => {
                const modal = document.getElementById('shortcuts-modal');
                if (modal && !modal.classList.contains('hidden')) {
                    hideShortcutsModal();
                } else {
                    showShortcutsModal();
                }
                e.stopPropagation();
            });
        }
    }

    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Check for Escape and Ctrl+K BEFORE returning early for inputs!
            if (e.key === 'Escape') {
                const palette = document.getElementById('search-palette-modal');
                if (palette && !palette.classList.contains('hidden')) {
                    hideSearchPalette();
                    e.preventDefault();
                    return;
                }
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
                const palette = document.getElementById('search-palette-modal');
                if (palette && !palette.classList.contains('hidden')) {
                    hideSearchPalette();
                } else {
                    showSearchPalette();
                }
                e.preventDefault();
                return;
            }

            const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
            if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
                return;
            }

            // 'Z' key toggles Zen Focus Mode
            if (e.key === 'z' || e.key === 'Z') {
                settings.zenEnabled = !settings.zenEnabled;
                applySettings();
                saveSettings();
                e.preventDefault();
            }

            // '[' key toggles Sidebar
            if (e.key === '[') {
                document.getElementById('sidebar-toggle-btn')?.click();
                e.preventDefault();
            }

            // '+' or '=' key increases font size
            if (e.key === '+' || e.key === '=') {
                settings.fontSize = Math.min(28, settings.fontSize + 1);
                applySettings();
                saveSettings();
                e.preventDefault();
            }

            // '-' or '_' key decreases font size
            if (e.key === '-' || e.key === '_') {
                settings.fontSize = Math.max(14, settings.fontSize - 1);
                applySettings();
                saveSettings();
                e.preventDefault();
            }

            // '?' or '/' key toggles Keyboard Shortcuts Modal
            if (e.key === '?' || e.key === '/') {
                const modal = document.getElementById('shortcuts-modal');
                if (modal && !modal.classList.contains('hidden')) {
                    hideShortcutsModal();
                } else {
                    showShortcutsModal();
                }
                e.preventDefault();
            }

            // 'ArrowLeft' navigates to Previous Chapter
            if (e.key === 'ArrowLeft') {
                const prevBtn = document.getElementById('prev-chapter-btn');
                if (prevBtn && !prevBtn.disabled) {
                    prevBtn.click();
                    e.preventDefault();
                }
            }

            // 'ArrowRight' navigates to Next Chapter
            if (e.key === 'ArrowRight') {
                const nextBtn = document.getElementById('next-chapter-btn');
                if (nextBtn && !nextBtn.disabled) {
                    nextBtn.click();
                    e.preventDefault();
                }
            }

            // 'ArrowDown' or 'ArrowUp' focuses Next/Previous Paragraph (supports single taps & continuous holding)
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                const blocks = Array.from(document.querySelectorAll('#document-body p, #document-body h1, #document-body h2, #document-body h3, #document-body h4, #document-body h5, #document-body h6, #document-body .scene-divider'));
                if (blocks.length > 0) {
                    const wrapper = document.getElementById('document-wrapper');
                    const targetCenter = window.innerHeight * 0.35;
                    
                    if (focusedParagraphIndex < 0 || focusedParagraphIndex >= blocks.length) {
                        let minDistance = Infinity;
                        blocks.forEach((block, idx) => {
                            const rect = block.getBoundingClientRect();
                            if (rect.top <= targetCenter && rect.bottom >= targetCenter) {
                                focusedParagraphIndex = idx;
                                minDistance = 0;
                                return;
                            }
                            const blockCenter = rect.top + rect.height / 2;
                            const distance = Math.abs(blockCenter - targetCenter);
                            if (distance < minDistance) {
                                minDistance = distance;
                                focusedParagraphIndex = idx;
                            }
                        });
                    }
                    
                    let targetIndex = focusedParagraphIndex;
                    if (e.key === 'ArrowDown') {
                        targetIndex = Math.min(blocks.length - 1, focusedParagraphIndex + 1);
                    } else if (e.key === 'ArrowUp') {
                        targetIndex = Math.max(0, focusedParagraphIndex - 1);
                    }
                    
                    if (targetIndex !== focusedParagraphIndex || e.repeat) {
                        focusedParagraphIndex = targetIndex;
                        const targetBlock = blocks[targetIndex];
                        const rect = targetBlock.getBoundingClientRect();
                        const wrapperRect = wrapper.getBoundingClientRect();
                        const relativeTop = rect.top - wrapperRect.top + wrapper.scrollTop;
                        const targetScrollTop = relativeTop + (rect.height / 2) - targetCenter;
                        
                        wrapper.scrollTo({
                            top: Math.max(0, targetScrollTop),
                            behavior: e.repeat ? 'auto' : 'smooth'
                        });
                        
                        updateSpotlight();
                        e.preventDefault();
                    }
                }
            }

            // 'Escape' closes modal, drawer, or exits Zen mode
            if (e.key === 'Escape') {
                const modal = document.getElementById('shortcuts-modal');
                const drawer = document.getElementById('settings-drawer');
                const backdrop = document.getElementById('settings-backdrop');
                
                if (modal && !modal.classList.contains('hidden')) {
                    hideShortcutsModal();
                    e.preventDefault();
                } else if (drawer && drawer.classList.contains('visible')) {
                    drawer.classList.remove('visible');
                    backdrop?.classList.remove('visible');
                    e.preventDefault();
                } else if (settings.zenEnabled) {
                    settings.zenEnabled = false;
                    applySettings();
                    saveSettings();
                    e.preventDefault();
                }
            }
        });
    }

    function setupDossierLinks() {
        const dossier = document.getElementById('metadata-dossier');
        if (dossier) {
            dossier.addEventListener('click', (e) => {
                const btn = e.target.closest('.badge-link');
                if (btn) {
                    const path = btn.getAttribute('data-path');
                    if (path) {
                        navigateToDocument(path);
                    }
                }
            });
        }
    }

    // 16. Command / Search Palette Functions
    function showSearchPalette() {
        const palette = document.getElementById('search-palette-modal');
        if (palette) {
            palette.classList.remove('hidden');
            const input = document.getElementById('search-palette-input');
            if (input) {
                input.value = '';
                input.focus();
            }
            updateSearchPaletteResults();
        }
    }

    function hideSearchPalette() {
        const palette = document.getElementById('search-palette-modal');
        if (palette) {
            palette.classList.add('hidden');
        }
    }

    function updateSearchPaletteResults() {
        const input = document.getElementById('search-palette-input');
        const container = document.getElementById('search-palette-results');
        if (!input || !container) return;

        const query = input.value.toLowerCase().trim();
        container.innerHTML = '';
        focusedResultIndex = -1;

        // Filter out sub-scenes (NOVEL items whose parent is also a NOVEL item)
        const novels = docList.filter(item => item.class === 'NOVEL');
        const novelHashes = new Set(novels.map(item => item.hash));
        const subSceneHashes = new Set(novels.filter(item => novelHashes.has(item.parentHash)).map(item => item.hash));
        const searchableDocs = docList.filter(item => !subSceneHashes.has(item.hash));

        let matches = [];
        if (query === '') {
            // By default, list all chapters first, then all notes
            matches = searchableDocs;
        } else {
            matches = searchableDocs.filter(item => {
                const titleMatch = item.title.toLowerCase().includes(query);
                const classMatch = item.class.toLowerCase().includes(query);
                const category = item.class === 'NOVEL' ? 'manuscript' : getLoreCategoryName(item).toLowerCase();
                const categoryMatch = category.includes(query);
                
                // Tag / Alias search
                let aliasMatch = false;
                const aliasSet = dynamicAliases[item.hash];
                if (aliasSet) {
                    for (const alias of aliasSet) {
                        if (alias.includes(query)) {
                            aliasMatch = true;
                            break;
                        }
                    }
                }
                
                return titleMatch || classMatch || categoryMatch || aliasMatch;
            });

            // Sort: exact matches or matches starting with query first
            matches.sort((a, b) => {
                const aTitle = a.title.toLowerCase();
                const bTitle = b.title.toLowerCase();
                const aStarts = aTitle.startsWith(query);
                const bStarts = bTitle.startsWith(query);

                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;

                // Prioritize chapters (NOVEL) over lore notes
                if (a.class === 'NOVEL' && b.class !== 'NOVEL') return -1;
                if (a.class !== 'NOVEL' && b.class === 'NOVEL') return 1;

                return a.title.localeCompare(b.title);
            });
        }

        const limit = 30;
        const sliced = matches.slice(0, limit);

        if (sliced.length === 0) {
            container.innerHTML = `
                <div class="nav-placeholder" style="text-align: center; padding: 30px 10px; color: var(--text-secondary);">
                    No chapters or notes match your search.
                </div>
            `;
            return;
        }

        sliced.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            if (idx === 0) {
                div.classList.add('focused');
                focusedResultIndex = 0;
            }
            div.setAttribute('data-path', item.path);

            const isNovel = item.class === 'NOVEL';
            
            // Find matched alias to highlight it
            let aliasSuffix = '';
            if (query !== '' && dynamicAliases[item.hash]) {
                for (const alias of dynamicAliases[item.hash]) {
                    if (alias.includes(query) && alias !== item.title.toLowerCase().trim() && !item.title.toLowerCase().includes(alias)) {
                        const displayAlias = alias.startsWith('@') ? alias : `@${alias}`;
                        aliasSuffix = ` <span class="result-alias-match">(${displayAlias})</span>`;
                        break;
                    }
                }
            }

            div.innerHTML = `
                <div class="result-left">
                    <span class="result-icon">${isNovel ? '📖' : '🧠'}</span>
                    <div class="result-details">
                        <span class="result-title">${item.title}${aliasSuffix}</span>
                        <span class="result-subtitle">${isNovel ? 'Chapter' : getLoreCategoryName(item)}</span>
                    </div>
                </div>
                <span class="result-badge">${isNovel ? 'Manuscript' : 'Lore Codex'}</span>
            `;

            div.addEventListener('mouseenter', () => {
                const items = container.querySelectorAll('.search-result-item');
                if (focusedResultIndex >= 0 && focusedResultIndex < items.length) {
                    items[focusedResultIndex].classList.remove('focused');
                }
                focusedResultIndex = idx;
                div.classList.add('focused');
            });

            div.addEventListener('click', () => {
                navigateToDocument(item.path);
                hideSearchPalette();
            });

            container.appendChild(div);
        });
    }

    function navigateSearchResults(direction) {
        const container = document.getElementById('search-palette-results');
        if (!container) return;
        const items = container.querySelectorAll('.search-result-item');
        if (items.length === 0) return;

        if (focusedResultIndex >= 0 && focusedResultIndex < items.length) {
            items[focusedResultIndex].classList.remove('focused');
        }

        focusedResultIndex += direction;
        if (focusedResultIndex >= items.length) {
            focusedResultIndex = 0;
        } else if (focusedResultIndex < 0) {
            focusedResultIndex = items.length - 1;
        }

        const newFocusedItem = items[focusedResultIndex];
        newFocusedItem.classList.add('focused');
        newFocusedItem.scrollIntoView({ block: 'nearest' });
    }

    function openFocusedSearchResult() {
        const container = document.getElementById('search-palette-results');
        if (!container) return;
        const activeItem = container.querySelector('.search-result-item.focused');
        if (activeItem) {
            const path = activeItem.getAttribute('data-path');
            if (path) {
                navigateToDocument(path);
                hideSearchPalette();
            }
        }
    }

    function setupSearchPaletteEvents() {
        const searchBtn = document.getElementById('search-palette-btn');
        const zenSearchBtn = document.getElementById('zen-search-btn');
        const closeBtn = document.getElementById('search-palette-close-btn');
        const backdrop = document.querySelector('#search-palette-modal .modal-backdrop');
        const input = document.getElementById('search-palette-input');

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                showSearchPalette();
            });
        }
        if (zenSearchBtn) {
            zenSearchBtn.addEventListener('click', () => {
                showSearchPalette();
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', hideSearchPalette);
        }
        if (backdrop) {
            backdrop.addEventListener('click', hideSearchPalette);
        }
        if (input) {
            input.addEventListener('input', () => {
                updateSearchPaletteResults();
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowDown') {
                    navigateSearchResults(1);
                    e.preventDefault();
                } else if (e.key === 'ArrowUp') {
                    navigateSearchResults(-1);
                    e.preventDefault();
                } else if (e.key === 'Enter') {
                    openFocusedSearchResult();
                    e.preventDefault();
                }
            });
        }
    }

    // 15. Run on Startup
    initTabs();
    initDrawer();
    applySettings();
    setupDossierLinks();
    setupResumeToastEvents();
    setupUnlockToastEvents();
    setupZenModeEvents();
    setupKeyboardShortcuts();
    setupShortcutsModalEvents();
    setupSearchPaletteEvents();
    updateScrollProgress();
    loadTableOfContents();

})();
