/**
 * RETRO TACTILE SFX ENGINE
 * Zero-dependency, low-latency procedural sound synthesizer for clicks, switches, snaps & terminal chimes.
 */
class SFXEngine {
    constructor() {
        this.ctx = null;
        this.enabled = localStorage.getItem('sfx_enabled') !== 'false';
        const savedVol = parseFloat(localStorage.getItem('sfx_volume'));
        this.volume = !isNaN(savedVol) ? Math.max(0, Math.min(1, savedVol)) : 0.45;
        this.lastPlayTime = 0;

        // Auto-resume / init Web Audio Context on first user interaction
        const initAudio = () => {
            if (!this.ctx) {
                try {
                    const AudioCtx = window.AudioContext || window.webkitAudioContext;
                    if (AudioCtx) {
                        this.ctx = new AudioCtx();
                    }
                } catch (e) {
                    console.warn("SFX AudioContext initialization failed:", e);
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        };

        ['click', 'touchstart', 'keydown'].forEach(evt => {
            window.addEventListener(evt, initAudio, { once: false, passive: true });
        });

        this.initGlobalDelegation();
    }

    ensureContext() {
        if (!this.ctx) {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) this.ctx = new AudioCtx();
            } catch (e) {}
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    }

    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, parseFloat(vol) || 0));
        localStorage.setItem('sfx_volume', this.volume);
    }

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        localStorage.setItem('sfx_enabled', this.enabled);
    }

    // 1. Tactile Mechanical Microswitch Click (buttons, links, chips, toggles)
    playClick(pitchMultiplier = 1.0, volumeScale = 1.0) {
        if (!this.enabled || this.volume <= 0) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        // Debounce ultrafast duplicate calls (< 15ms)
        if (now - this.lastPlayTime < 0.015) return;
        this.lastPlayTime = now;

        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(this.volume * 0.35 * volumeScale, now);
        masterGain.connect(ctx.destination);

        // Click Body (fast pitch-drop transient)
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1600 * pitchMultiplier, now);
        osc.frequency.exponentialRampToValueAtTime(320 * pitchMultiplier, now + 0.018);

        oscGain.gain.setValueAtTime(1.0, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
        osc.connect(oscGain);
        oscGain.connect(masterGain);

        // Noise snap (mechanical friction)
        const sampleCount = Math.floor(ctx.sampleRate * 0.012);
        const noiseBuffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < sampleCount; i++) {
            output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleCount * 0.3));
        }

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(3800 * pitchMultiplier, now);
        filter.Q.setValueAtTime(3.5, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.6, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.02);
        noise.start(now);
        noise.stop(now + 0.015);
    }

    // 2. Mechanical Clack / Keystroke (number slots, typing)
    playType() {
        if (!this.enabled || this.volume <= 0) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(this.volume * 0.28, now);
        masterGain.connect(ctx.destination);

        const randPitch = 0.9 + Math.random() * 0.25;

        // Thump
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(540 * randPitch, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.025);

        oscGain.gain.setValueAtTime(0.8, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
        osc.connect(oscGain);
        oscGain.connect(masterGain);

        // Click
        const sampleCount = Math.floor(ctx.sampleRate * 0.008);
        const noiseBuffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < sampleCount; i++) {
            output[i] = (Math.random() * 2 - 1);
        }

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(4200, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.03);
        noise.start(now);
        noise.stop(now + 0.01);
    }

    // 3. Keyword Snap / Slot Latch (keyword dropped into slot)
    playSnap() {
        if (!this.enabled || this.volume <= 0) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(this.volume * 0.45, now);
        masterGain.connect(ctx.destination);

        // High mechanical latch click
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(2200, now);
        osc1.frequency.exponentialRampToValueAtTime(450, now + 0.035);
        gain1.gain.setValueAtTime(1.0, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        osc1.connect(gain1);
        gain1.connect(masterGain);

        // Low magnetic snap thump
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(320, now + 0.005);
        osc2.frequency.exponentialRampToValueAtTime(80, now + 0.05);
        gain2.gain.setValueAtTime(0.8, now + 0.005);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc2.connect(gain2);
        gain2.connect(masterGain);

        osc1.start(now);
        osc1.stop(now + 0.04);
        osc2.start(now + 0.005);
        osc2.stop(now + 0.055);
    }

    // 4. Pop / Slot Clear / Word Removed
    playPop() {
        if (!this.enabled || this.volume <= 0) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(this.volume * 0.35, now);
        masterGain.connect(ctx.destination);

        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.03);

        oscGain.gain.setValueAtTime(0.8, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.connect(oscGain);
        oscGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.035);
    }

    // 5. Open Modal / Window / Dossier (retro relay chirp)
    playOpen() {
        if (!this.enabled || this.volume <= 0) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(this.volume * 0.3, now);
        masterGain.connect(ctx.destination);

        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(950, now + 0.045);

        oscGain.gain.setValueAtTime(0.6, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        osc.connect(oscGain);
        oscGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.05);
    }

    // 6. Close Modal / Window (downward relay latch)
    playClose() {
        if (!this.enabled || this.volume <= 0) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(this.volume * 0.28, now);
        masterGain.connect(ctx.destination);

        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(750, now);
        osc.frequency.exponentialRampToValueAtTime(280, now + 0.04);

        oscGain.gain.setValueAtTime(0.6, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.connect(oscGain);
        oscGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.045);
    }

    // 7. Tab / Segment Switch (crisp relay flip)
    playTab() {
        this.playClick(1.25, 0.9);
    }

    // 8. Positive Verification / Evaluation Passed (Soviet terminal chime)
    playSuccess() {
        if (!this.enabled || this.volume <= 0) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(this.volume * 0.4, now);
        masterGain.connect(ctx.destination);

        // Two harmonized bell tones: D5 (587Hz) -> A5 (880Hz)
        const notes = [
            { freq: 587.33, start: 0, dur: 0.25 },
            { freq: 880.00, start: 0.1, dur: 0.45 }
        ];

        notes.forEach(n => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(n.freq, now + n.start);

            gain.gain.setValueAtTime(0.7, now + n.start);
            gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);

            osc.connect(gain);
            gain.connect(masterGain);

            osc.start(now + n.start);
            osc.stop(now + n.start + n.dur);
        });
    }

    playCorrect() {
        return this.playSuccess();
    }

    // 9. Negative Verification / Rejection Alert (low muffled warning buzz)
    playError() {
        if (!this.enabled || this.volume <= 0) return;
        const ctx = this.ensureContext();
        if (!ctx) return;

        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(this.volume * 0.35, now);
        masterGain.connect(ctx.destination);

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.setValueAtTime(120, now + 0.08);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, now);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    // Global Click Listener for Instant Tactile Feedback on Interactive Elements
    initGlobalDelegation() {
        document.addEventListener('click', (e) => {
            // Find closest interactive element
            const target = e.target.closest(
                'button, .theme-btn, .game-theme-card, .time-btn, .sidebar-tab-btn, .filter-chip, .open-docket-btn, ' +
                '.tray-word, .kw, .slot, .slot-picker-item, .clue-table-trigger-card, .lore-card, ' +
                'input[type="checkbox"], input[type="radio"], select, .chapter-item, .toc-link, .nav-action-btn, a'
            );

            if (!target) return;

            // Specific sounds based on type
            if (target.classList.contains('sidebar-tab-btn') || target.classList.contains('time-btn') || target.classList.contains('filter-chip')) {
                this.playTab();
            } else if (target.classList.contains('kw') || target.classList.contains('tray-word')) {
                this.playClick(1.3, 1.1);
            } else if (target.classList.contains('slot')) {
                this.playClick(1.0, 0.9);
            } else if (target.classList.contains('clue-table-trigger-card') || target.classList.contains('lore-card') || target.classList.contains('open-docket-btn')) {
                this.playOpen();
            } else {
                this.playClick(1.0, 1.0);
            }
        }, { passive: true, capture: true });

        // Input keydown for number slots and typing
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.classList.contains('num-slot')) {
                if (e.key && e.key.length === 1) {
                    this.playType();
                } else if (e.key === 'Backspace' || e.key === 'Delete') {
                    this.playClick(0.8, 0.7);
                }
            }
        }, { passive: true, capture: true });
    }
}

// Global Singleton
window.sfx = new SFXEngine();
