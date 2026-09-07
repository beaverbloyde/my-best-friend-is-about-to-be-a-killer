/**
 * LOGOS-3 NOVEL READER SETTINGS & DISPLAY ENGINE
 * Theme manager, typography controls, CRT visual profiles, e-paper transition & settings drawer.
 */
(function (global) {
    'use strict';

    const SCANLINE_SPEED_PRESETS = [
        { label: "Static", duration: "0s", isStatic: true },
        { label: "Slow (14s)", duration: "14s", isStatic: false },
        { label: "Normal (7s)", duration: "7s", isStatic: false },
        { label: "Fast (3.5s)", duration: "3.5s", isStatic: false },
        { label: "Rapid (1.8s)", duration: "1.8s", isStatic: false }
    ];

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

    class LogosReaderSettings {
        constructor() {
            this.settings = {
                theme: localStorage.getItem('reader-theme') || 'soviet-amber',
                fontFamily: getStoredFontFamily(),
                fontSize: parseInt(localStorage.getItem('reader-font-size'), 10) || 18,
                lineHeight: parseFloat(localStorage.getItem('reader-line-height')) || 1.6,
                maxWidth: parseInt(localStorage.getItem('reader-max-width'), 10) || 750,
                speechEnabled: localStorage.getItem('reader-speech-enabled') !== 'false',
                highlightMode: localStorage.getItem('reader-highlight-mode') || 'text-only',
                epaperTransition: localStorage.getItem('reader-epaper-transition') !== 'false',
                epaperDuration: parseFloat(localStorage.getItem('reader-epaper-duration')) || 0.50,
                displayProfile: localStorage.getItem('reader-display-profile') || 'clean',
                displayIntensity: parseInt(localStorage.getItem('reader-display-intensity') || '65', 10),
                displaySpeed: parseInt(localStorage.getItem('reader-display-speed') || '2', 10),
                zenEnabled: localStorage.getItem('reader-zen-enabled') === 'true',
                spotlightEnabled: localStorage.getItem('reader-spotlight-enabled') === 'true',
                spotlightSize: parseInt(localStorage.getItem('reader-spotlight-size'), 10) || 3
            };

            this.epaperTimeout = null;
        }

        applySettings() {
            document.body.className = '';
            document.body.classList.add(`theme-${this.settings.theme}`);

            const root = document.documentElement;
            root.style.setProperty('--reader-font-size', `${this.settings.fontSize}px`);
            root.style.setProperty('--reader-line-height', this.settings.lineHeight);
            root.style.setProperty('--reader-max-width', `${this.settings.maxWidth}px`);

            if (global.LogosFontManager) {
                const activeFont = global.LogosFontManager.resolveCssFont(this.settings.fontFamily);
                root.style.setProperty('--reader-font-family', activeFont);
            }

            const reader = document.getElementById('document-body');
            if (reader) {
                reader.className = '';
                if (this.settings.speechEnabled) {
                    reader.classList.add(`speech-mode-${this.settings.highlightMode}`);
                } else {
                    reader.classList.add('speech-disabled');
                }
            }

            // Sync controls
            const fontSearchInput = document.getElementById('font-search-input');
            if (fontSearchInput) fontSearchInput.value = this.settings.fontFamily;

            const sizeSlider = document.getElementById('font-size-slider');
            if (sizeSlider) sizeSlider.value = this.settings.fontSize;
            const sizeVal = document.getElementById('font-size-value');
            if (sizeVal) sizeVal.innerText = `${this.settings.fontSize}px`;

            const lhSlider = document.getElementById('line-height-slider');
            if (lhSlider) lhSlider.value = this.settings.lineHeight;
            const lhVal = document.getElementById('line-height-value');
            if (lhVal) lhVal.innerText = this.settings.lineHeight;

            const wSlider = document.getElementById('container-width-slider');
            if (wSlider) wSlider.value = this.settings.maxWidth;
            const wVal = document.getElementById('container-width-value');
            if (wVal) wVal.innerText = `${this.settings.maxWidth}px`;

            const speechToggle = document.getElementById('speech-styling-toggle');
            if (speechToggle) speechToggle.checked = this.settings.speechEnabled;

            const hlModeSelect = document.getElementById('highlight-mode-select');
            if (hlModeSelect) hlModeSelect.value = this.settings.highlightMode;

            const hlModeContainer = document.getElementById('highlight-mode-container');
            if (hlModeContainer) {
                hlModeContainer.style.display = this.settings.speechEnabled ? 'flex' : 'none';
            }

            const zenToggle = document.getElementById('zen-mode-toggle');
            if (zenToggle) zenToggle.checked = this.settings.zenEnabled;

            const spotlightToggle = document.getElementById('spotlight-toggle');
            if (spotlightToggle) spotlightToggle.checked = this.settings.spotlightEnabled;

            if (this.settings.zenEnabled) {
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

            if (this.settings.zenEnabled && this.settings.spotlightEnabled) {
                document.body.classList.add('spotlight-mode');
                const spotlightSizeSelect = document.getElementById('spotlight-size-select');
                if (spotlightSizeSelect) {
                    spotlightSizeSelect.value = this.settings.spotlightSize;
                    spotlightSizeSelect.parentElement.style.display = 'flex';
                }
            } else {
                document.body.classList.remove('spotlight-mode');
                const spotlightSizeSelect = document.getElementById('spotlight-size-select');
                if (spotlightSizeSelect) spotlightSizeSelect.parentElement.style.display = 'none';
            }

            // Theme Buttons active class
            document.querySelectorAll('.theme-btn').forEach(btn => {
                if (btn.dataset.theme === this.settings.theme) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });

            // Display Profile CRT classes
            document.body.classList.remove('profile-crt-green', 'profile-crt-amber', 'profile-paper', 'profile-scanlines', 'profile-clean');
            if (this.settings.displayProfile === 'crt') {
                document.body.classList.add('profile-scanlines');
            } else if (this.settings.displayProfile === 'crt-amber') {
                document.body.classList.add('profile-crt-amber');
            } else if (this.settings.displayProfile === 'crt-green') {
                document.body.classList.add('profile-crt-green');
            } else if (this.settings.displayProfile === 'paper') {
                document.body.classList.add('profile-paper');
            } else {
                document.body.classList.add('profile-clean');
            }

            // CRT Intensity and Speed CSS variables
            const crtOpacity = (this.settings.displayIntensity / 100).toFixed(2);
            root.style.setProperty('--scanlines-opacity', crtOpacity);
            const speedPreset = SCANLINE_SPEED_PRESETS[this.settings.displaySpeed] || SCANLINE_SPEED_PRESETS[2];
            root.style.setProperty('--scanlines-duration', speedPreset.duration);

            const displayProfileSelect = document.getElementById('display-profile-select');
            if (displayProfileSelect) displayProfileSelect.value = this.settings.displayProfile;

            const crtControls = document.getElementById('crt-controls-group');
            if (crtControls) {
                crtControls.style.display = (this.settings.displayProfile === 'clean' || this.settings.displayProfile === 'paper') ? 'none' : 'block';
            }

            const intensitySlider = document.getElementById('display-intensity-slider');
            if (intensitySlider) intensitySlider.value = this.settings.displayIntensity;
            const intensityVal = document.getElementById('display-intensity-value');
            if (intensityVal) intensityVal.innerText = `${this.settings.displayIntensity}%`;

            const speedSlider = document.getElementById('display-speed-slider');
            if (speedSlider) speedSlider.value = this.settings.displaySpeed;
            const speedVal = document.getElementById('display-speed-value');
            if (speedVal) speedVal.innerText = speedPreset.label;

            const epaperToggle = document.getElementById('epaper-transition-toggle');
            if (epaperToggle) epaperToggle.checked = this.settings.epaperTransition;

            const epaperDurationContainer = document.getElementById('epaper-duration-container');
            if (epaperDurationContainer) {
                epaperDurationContainer.style.display = this.settings.epaperTransition ? 'flex' : 'none';
            }
            const epaperSlider = document.getElementById('epaper-duration-slider');
            if (epaperSlider) epaperSlider.value = this.settings.epaperDuration;
            const epaperVal = document.getElementById('epaper-duration-value');
            if (epaperVal) epaperVal.innerText = `${this.settings.epaperDuration.toFixed(2)}s`;
        }

        saveSettings() {
            localStorage.setItem('reader-theme', this.settings.theme);
            localStorage.setItem('reader-font-family', this.settings.fontFamily);
            localStorage.setItem('reader-font-size', this.settings.fontSize);
            localStorage.setItem('reader-line-height', this.settings.lineHeight);
            localStorage.setItem('reader-max-width', this.settings.maxWidth);
            localStorage.setItem('reader-speech-enabled', this.settings.speechEnabled);
            localStorage.setItem('reader-highlight-mode', this.settings.highlightMode);
            localStorage.setItem('reader-epaper-transition', this.settings.epaperTransition);
            localStorage.setItem('reader-epaper-duration', this.settings.epaperDuration);
            localStorage.setItem('reader-display-profile', this.settings.displayProfile);
            localStorage.setItem('reader-display-intensity', this.settings.displayIntensity);
            localStorage.setItem('reader-display-speed', this.settings.displaySpeed);
            localStorage.setItem('reader-zen-enabled', this.settings.zenEnabled);
            localStorage.setItem('reader-spotlight-enabled', this.settings.spotlightEnabled);
            localStorage.setItem('reader-spotlight-size', this.settings.spotlightSize);
        }

        triggerEpaperRefresh(callback = null) {
            const bodyContainer = document.getElementById('document-body-container');
            if (!this.settings.epaperTransition || !bodyContainer) {
                if (callback) callback();
                return;
            }

            const flashDurationMs = Math.round(this.settings.epaperDuration * 1000 * 0.4);
            const totalDurationMs = Math.round(this.settings.epaperDuration * 1000);

            if (this.epaperTimeout) {
                clearTimeout(this.epaperTimeout);
                bodyContainer.classList.remove('epaper-flash', 'epaper-assembling');
            }

            bodyContainer.classList.add('epaper-flash');

            setTimeout(() => {
                bodyContainer.classList.remove('epaper-flash');
                bodyContainer.classList.add('epaper-assembling');
                if (callback) callback();
            }, flashDurationMs);

            this.epaperTimeout = setTimeout(() => {
                bodyContainer.classList.remove('epaper-assembling');
                this.epaperTimeout = null;
            }, totalDurationMs);
        }
    }

    global.LogosReaderSettings = LogosReaderSettings;
})(typeof window !== 'undefined' ? window : globalThis);
