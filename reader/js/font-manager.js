/**
 * LOGOS-3 NOVEL READER FONT MANAGER
 * Dynamic Google Fonts loader, local system fonts scanner & autocomplete dropdown.
 */
(function (global) {
    'use strict';

    const PRESET_FONTS = {
        "Default Fonts": ["Lora", "Inter", "JetBrains Mono", "System Default"],
        "Serif (Novel / Literary)": [
            "Merriweather", "Playfair Display", "EB Garamond", "Cinzel", "PT Serif", 
            "Crimson Text", "Libre Baskerville", "Cormorant Garamond", "Source Serif Pro", 
            "Spectral", "Bitter", "Vollkorn", "Alegreya", "Cardo", "Literata", 
            "Frank Ruhl Libre", "Newsreader", "Besley", "Castoro", "Faustina"
        ],
        "Sans-Serif (Clean / Modern)": [
            "Roboto", "Open Sans", "Montserrat", "Lato", "Poppins", 
            "Raleway", "Nunito", "Rubik", "Work Sans", "Quicksand", 
            "Fira Sans", "Mulish", "Barlow", "Karla", "Cabinet Grotesk", 
            "Plus Jakarta Sans", "DM Sans", "Manrope", "Outfit", "Space Grotesk"
        ],
        "Monospace (CRT / Terminal)": [
            "IBM Plex Mono", "Fira Code", "Source Code Pro", "Inconsolata", 
            "Space Mono", "Roboto Mono", "Ubuntu Mono", "Courier Prime", 
            "Anonymous Pro", "VT323", "Share Tech Mono", "Cutive Mono"
        ],
        "Display & Retro Theme": [
            "Special Elite", "Cinzel Decorative", "Press Start 2P", 
            "UnifrakturMaguntia", "Old Standard TT", "Syne", "Comfortaa"
        ]
    };

    const LogosFontManager = {
        availableFonts: { ...PRESET_FONTS },
        localFontsList: [],

        loadGoogleFont(fontName) {
            if (!fontName || fontName === 'System Default' || fontName === 'system-ui') return;
            const apiFontName = fontName.trim().replace(/\s+/g, '+');
            const linkId = `gfont-${apiFontName.toLowerCase()}`;
            if (document.getElementById(linkId)) return;

            const link = document.createElement('link');
            link.id = linkId;
            link.rel = 'stylesheet';
            link.href = `https://fonts.googleapis.com/css2?family=${apiFontName}:ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,700&display=swap`;
            document.head.appendChild(link);
        },

        resolveCssFont(fontFamily) {
            if (fontFamily === 'Lora') return 'var(--font-lora)';
            if (fontFamily === 'Inter') return 'var(--font-inter)';
            if (fontFamily === 'JetBrains Mono') return 'var(--font-mono)';
            if (fontFamily === 'System Default' || fontFamily === 'system-ui') return 'system-ui';
            this.loadGoogleFont(fontFamily);
            return `'${fontFamily}', serif`;
        },

        async scanLocalFonts(onComplete = null) {
            if ('queryLocalFonts' in window) {
                try {
                    const fonts = await window.queryLocalFonts();
                    const families = Array.from(new Set(fonts.map(f => f.family))).sort();
                    if (families.length > 0) {
                        this.localFontsList = families;
                        this.availableFonts["Installed Local Fonts"] = this.localFontsList;
                        const scanBtn = document.getElementById('scan-local-fonts-btn');
                        if (scanBtn) {
                            scanBtn.innerHTML = '✅';
                            scanBtn.title = `Found ${families.length} system fonts!`;
                        }
                        if (onComplete) onComplete(families);
                        return families;
                    }
                } catch (e) {
                    console.warn("Failed scanning local fonts:", e);
                    alert("Permission was denied or local fonts scan failed.");
                }
            } else {
                alert("Your browser does not support the Local Font Access API. Chrome, Edge, or Opera is recommended.");
            }
            return [];
        },

        renderFontSuggestions(query = "", onSelect = null) {
            const resultsContainer = document.getElementById('font-search-results');
            if (!resultsContainer) return;

            resultsContainer.innerHTML = "";
            const cleanQuery = query.toLowerCase().trim();
            let hasMatches = false;

            for (const [groupName, fontList] of Object.entries(this.availableFonts)) {
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
                        if (onSelect) onSelect(font);
                        resultsContainer.classList.remove('open');
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
                    if (onSelect) onSelect(query);
                    resultsContainer.classList.remove('open');
                });
                resultsContainer.appendChild(item);
            }
        }
    };

    global.LogosFontManager = LogosFontManager;
})(typeof window !== 'undefined' ? window : globalThis);
