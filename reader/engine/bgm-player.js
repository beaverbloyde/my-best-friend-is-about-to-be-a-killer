/**
 * RETRO SOVIET TAPE DECK // BGM AUDIO PLAYER
 * Ambient soundscape and music player for Reader & Case Investigation Terminal
 */

class BGMPlayer {
    constructor() {
        this.tracks = [
            {
                id: 'sb_the_long_dark',
                title: 'The Long Dark (Noir Piano & Synth)',
                artist: 'Scott Buckley (CC-BY 4.0)',
                type: 'stream',
                url: 'audio/sb_the_long_dark.ogg',
                desc: 'Melancholic ambient piano and slow analog drone for deduction.'
            },
            {
                id: 'procedural_logos',
                title: 'LOGOS-3 Mainframe (Soviet Drone)',
                artist: 'Procedural Analog Synth (Offline)',
                type: 'procedural',
                desc: 'Synthesized Polivoks D-minor drone, cassette tape flutter, and vintage CRT hum.'
            },
            {
                id: 'cyberpunk_ambient',
                title: 'District 9 Cyber-Noir Ambient',
                artist: 'Terminus Void (CC-BY 3.0)',
                type: 'stream',
                url: 'audio/cyberpunk_ambient.opus',
                desc: 'Dark dystopian cyberpunk space atmosphere and synth drones.'
            },
            {
                id: 'district_rain',
                title: 'District 9 Heavy Night Rain',
                artist: 'Atmospheric Weather Loop',
                type: 'stream',
                url: 'audio/district_rain.ogg',
                desc: 'Heavy cold rain and howling industrial wind.'
            },
            {
                id: 'calm_rain',
                title: 'Calm Night Rain & Droplets',
                artist: 'Continuous Rain Soundscape',
                type: 'stream',
                url: 'audio/calm_rain.ogg',
                desc: 'Gentle continuous rainfall for quiet reading.'
            }
        ];

        this.currentTrackIndex = 0;
        this.isPlaying = false;
        this.isSeeking = false;
        this.volume = parseFloat(localStorage.getItem('bgm_volume'));
        if (isNaN(this.volume)) this.volume = 0.35;

        this.audioEl = new Audio();
        this.audioEl.loop = true;
        this.audioEl.preload = 'none';

        // Continuous timestamp tracking
        this.audioEl.addEventListener('timeupdate', () => {
            if (this.isPlaying && !this.isSeeking) {
                const track = this.getCurrentTrack();
                if (track && track.type === 'stream' && this.audioEl.currentTime > 0) {
                    localStorage.setItem('bgm_pos_' + track.id, this.audioEl.currentTime);
                    localStorage.setItem('bgm_last_pos', this.audioEl.currentTime);
                }
                this.updateTimeDisplay();
            }
        });
        this.audioEl.addEventListener('loadedmetadata', () => this.updateTimeDisplay());
        this.audioEl.addEventListener('durationchange', () => this.updateTimeDisplay());

        // Web Audio procedural generator state
        this.audioCtx = null;
        this.synthNodes = null;

        // Restore saved track index (default to The Long Dark)
        const savedTrackId = localStorage.getItem('bgm_track_id');
        if (savedTrackId) {
            const idx = this.tracks.findIndex(t => t.id === savedTrackId);
            if (idx !== -1) this.currentTrackIndex = idx;
        } else {
            const defaultIdx = this.tracks.findIndex(t => t.id === 'sb_the_long_dark');
            if (defaultIdx !== -1) this.currentTrackIndex = defaultIdx;
        }

        this.initDOM();
        this.initEvents();

        // Check if audio was active before navigating or first time player (default: autoplay ON)
        const isPlayingPref = localStorage.getItem('bgm_is_playing');
        if (isPlayingPref === 'true' || isPlayingPref === null) {
            this.play();
        }
    }

    initDOM() {
        // Remove any old floating pill if present
        const oldPill = document.getElementById('bgm-floating-pill');
        if (oldPill) oldPill.remove();

        // 1. Header Mini Widget
        let widget = document.getElementById('bgm-header-widget');
        if (!widget) {
            widget = document.createElement('button');
            widget.id = 'bgm-header-widget';
            widget.className = 'bgm-header-widget';
            this.mountWidget(widget);
        }
        this.widgetEl = widget;
        this.widgetEl.title = 'Open LOGOS Audio Tape Deck (Shortcut: M / Shift+M)';

        // 2. Popover Tape Deck Modal Backdrop & Panel
        let backdrop = document.getElementById('bgm-backdrop');
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = 'bgm-backdrop';
            backdrop.className = 'bgm-popover-backdrop';
            document.body.appendChild(backdrop);
        }
        this.backdropEl = backdrop;

        let deck = document.getElementById('bgm-deck-panel');
        if (!deck) {
            deck = document.createElement('div');
            deck.id = 'bgm-deck-panel';
            deck.className = 'bgm-deck-panel';
            document.body.appendChild(deck);
        }
        this.deckEl = deck;

        // Render contents only if deck is empty to avoid stomping DOM
        if (!this.deckEl.hasChildNodes() || !this.deckEl.querySelector('.bgm-deck-header')) {
            this.deckEl.innerHTML = `
                <div class="bgm-deck-header">
                    <div class="bgm-deck-title">
                        <span style="color: var(--bgm-red);">☭</span>
                        <span>LOGOS-3 // REEL AUDIO DECK</span>
                    </div>
                    <button class="bgm-deck-close" id="bgm-deck-close-btn" title="Close deck">✕</button>
                </div>

                <div class="bgm-cassette-display">
                    <div class="bgm-reels-container">
                        <div class="bgm-reel"><div class="bgm-reel-spokes"></div></div>
                        <div class="bgm-tape-bridge"></div>
                        <div class="bgm-reel"><div class="bgm-reel-spokes"></div></div>
                    </div>
                    <div class="bgm-deck-track-info">
                        <div class="bgm-deck-now-playing">NOW PLAYING // TAPE CHANNEL</div>
                        <div class="bgm-deck-track-name" id="bgm-deck-title">${this.getCurrentTrack().title}</div>
                        <div class="bgm-deck-track-artist" id="bgm-deck-artist">${this.getCurrentTrack().artist}</div>
                    </div>
                </div>

                <div class="bgm-progress-row">
                    <span class="bgm-time-display" id="bgm-current-time">00:00</span>
                    <div class="bgm-seeker-wrap">
                        <input type="range" class="bgm-seeker-slider" id="bgm-seeker-slider" min="0" max="100" value="0" step="0.1" title="Audio Position Scrubber">
                    </div>
                    <span class="bgm-time-display" id="bgm-duration-time">00:00</span>
                </div>

                <div class="bgm-control-group">
                    <label class="bgm-control-label">Audio Frequency / Channel</label>
                    <select class="bgm-select" id="bgm-track-select">
                        ${this.tracks.map((t, idx) => `<option value="${idx}" ${idx === this.currentTrackIndex ? 'selected' : ''}>${t.title} [${t.artist}]</option>`).join('')}
                    </select>
                </div>

                <div class="bgm-transport">
                    <button class="bgm-btn" id="bgm-prev-btn" title="Previous Track">⏮ Prev</button>
                    <button class="bgm-btn bgm-btn-primary" id="bgm-play-btn" title="Toggle Playback">▶ Play</button>
                    <button class="bgm-btn" id="bgm-next-btn" title="Next Track">Next ⏭</button>
                </div>

                <div class="bgm-volume-row">
                    <span style="font-size: 13px;">🔊</span>
                    <input type="range" id="bgm-volume-slider" min="0" max="1" step="0.01" value="${this.volume}" title="Master Volume">
                    <span class="bgm-volume-val" id="bgm-volume-val">${Math.round(this.volume * 100)}%</span>
                </div>

                <div class="bgm-custom-box">
                    <label class="bgm-file-label" title="Load any local MP3/WAV/OGG file">
                        📂 Load Custom Audio File
                        <input type="file" id="bgm-custom-file" accept="audio/*" style="display: none;">
                    </label>
                </div>
            `;
        }

        this.updateUI();
    }

    mountWidget(widget) {
        // Try Reader header right controls
        const headerRight = document.querySelector('.header-right');
        if (headerRight) {
            headerRight.insertBefore(widget, headerRight.firstChild);
            return;
        }

        // Try Game terminal header controls
        const gameHeaderControls = document.querySelector('.header-controls');
        if (gameHeaderControls) {
            gameHeaderControls.appendChild(widget);
            return;
        }

        // Fallback: append to document body
        document.body.appendChild(widget);
    }

    initEvents() {
        if (this._eventsInitialized) return;
        this._eventsInitialized = true;

        // Header widget click
        if (this.widgetEl) {
            this.widgetEl.addEventListener('click', (e) => {
                if (e.target.closest('.bgm-mini-play-btn')) {
                    e.stopPropagation();
                    this.togglePlay();
                } else {
                    this.openDeck();
                }
            });
        }

        // Backdrop click closes deck
        if (this.backdropEl) {
            this.backdropEl.addEventListener('click', () => this.closeDeck());
        }

        // Robust Event Delegation on Deck Panel (handles clicks, selects, volume slider inputs)
        if (this.deckEl) {
            // 1. Dropdown and File change
            this.deckEl.addEventListener('change', (e) => {
                if (e.target && e.target.id === 'bgm-track-select') {
                    const newIndex = parseInt(e.target.value, 10);
                    this.selectTrack(newIndex);
                } else if (e.target && e.target.id === 'bgm-seeker-slider') {
                    this.commitSeek(parseFloat(e.target.value));
                } else if (e.target && e.target.id === 'bgm-custom-file') {
                    const file = e.target.files[0];
                    if (file) {
                        const objectUrl = URL.createObjectURL(file);
                        const customTrack = {
                            id: 'custom_' + Date.now(),
                            title: file.name.replace(/\.[^/.]+$/, ''),
                            artist: 'Local Custom File',
                            type: 'stream',
                            url: objectUrl,
                            desc: 'User uploaded audio file.'
                        };
                        this.tracks.push(customTrack);
                        this.refreshTrackSelect();
                        this.selectTrack(this.tracks.length - 1);
                    }
                }
            });

            // 2. Button clicks inside deck
            this.deckEl.addEventListener('click', (e) => {
                if (e.target.closest('#bgm-play-btn')) {
                    this.togglePlay();
                } else if (e.target.closest('#bgm-prev-btn')) {
                    this.prevTrack();
                } else if (e.target.closest('#bgm-next-btn')) {
                    this.nextTrack();
                } else if (e.target.closest('#bgm-deck-close-btn')) {
                    this.closeDeck();
                }
            });

            // 3. Slider Inputs (Volume & Scrubber)
            this.deckEl.addEventListener('input', (e) => {
                if (e.target && e.target.id === 'bgm-volume-slider') {
                    this.setVolume(parseFloat(e.target.value));
                } else if (e.target && e.target.id === 'bgm-seeker-slider') {
                    this.isSeeking = true;
                    if (this.audioEl && this.audioEl.duration && !isNaN(this.audioEl.duration)) {
                        const targetSec = (parseFloat(e.target.value) / 100) * this.audioEl.duration;
                        const curTimeEl = document.getElementById('bgm-current-time');
                        if (curTimeEl) curTimeEl.innerText = this.formatTime(targetSec);
                    }
                }
            });

            // Handle pointer release on seeker
            this.deckEl.addEventListener('pointerup', (e) => {
                if (e.target && e.target.id === 'bgm-seeker-slider') {
                    this.commitSeek(parseFloat(e.target.value));
                }
            });
            this.deckEl.addEventListener('touchend', (e) => {
                if (e.target && e.target.id === 'bgm-seeker-slider') {
                    this.commitSeek(parseFloat(e.target.value));
                }
            });
        }

        // On seeked event from audio element, clear seeking flag and update display
        this.audioEl.addEventListener('seeked', () => {
            this.isSeeking = false;
            this.updateTimeDisplay();
        });

        // Save timestamp before leaving page or refreshing
        window.addEventListener('beforeunload', () => this.saveCurrentTimestamp());
        window.addEventListener('pagehide', () => this.saveCurrentTimestamp());

        // Gesture unlock for browser autoplay policy
        const unlockAutoplay = () => {
            const isPlayingPref = localStorage.getItem('bgm_is_playing');
            if (isPlayingPref === 'true' || isPlayingPref === null) {
                if (!this.isPlaying) {
                    this.play();
                } else {
                    if (this.audioCtx && this.audioCtx.state === 'suspended') {
                        this.audioCtx.resume();
                    }
                    if (this.audioEl && this.audioEl.paused && this.getCurrentTrack().type === 'stream') {
                        this.audioEl.play().catch(() => {});
                    }
                }
            }
            document.removeEventListener('click', unlockAutoplay);
            document.removeEventListener('keydown', unlockAutoplay);
            document.removeEventListener('touchstart', unlockAutoplay);
            document.removeEventListener('pointerdown', unlockAutoplay);
        };

        document.addEventListener('click', unlockAutoplay);
        document.addEventListener('keydown', unlockAutoplay);
        document.addEventListener('touchstart', unlockAutoplay);
        document.addEventListener('pointerdown', unlockAutoplay);

        // Keyboard Shortcuts (M for play/pause, Shift+M for deck panel)
        window.addEventListener('keydown', (e) => {
            if (e.target.matches('input, textarea, select')) return;
            if (e.key === 'm' || e.key === 'M') {
                if (e.shiftKey) {
                    this.deckEl.classList.contains('open') ? this.closeDeck() : this.openDeck();
                } else {
                    this.togglePlay();
                }
            }
            if (e.key === 'Escape' && this.deckEl && this.deckEl.classList.contains('open')) {
                this.closeDeck();
            }
        });
    }

    commitSeek(sliderPercent) {
        const track = this.getCurrentTrack();
        if (track.type === 'stream' && this.audioEl && this.audioEl.duration && !isNaN(this.audioEl.duration)) {
            const targetSec = (Math.max(0, Math.min(100, sliderPercent)) / 100) * this.audioEl.duration;
            try {
                this.audioEl.currentTime = targetSec;
            } catch (err) {
                console.warn('Error setting currentTime:', err);
            }
            localStorage.setItem('bgm_pos_' + track.id, targetSec);
            localStorage.setItem('bgm_last_pos', targetSec);
        }
        this.isSeeking = false;
        this.updateTimeDisplay();
    }

    saveCurrentTimestamp() {
        const track = this.getCurrentTrack();
        if (track && track.type === 'stream' && this.audioEl && !isNaN(this.audioEl.currentTime) && this.audioEl.currentTime > 0) {
            localStorage.setItem('bgm_pos_' + track.id, this.audioEl.currentTime);
            localStorage.setItem('bgm_last_pos', this.audioEl.currentTime);
        }
    }

    formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return '00:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    updateTimeDisplay() {
        const curTimeEl = document.getElementById('bgm-current-time');
        const durTimeEl = document.getElementById('bgm-duration-time');
        const seeker = document.getElementById('bgm-seeker-slider');
        const track = this.getCurrentTrack();

        if (track.type === 'procedural') {
            if (curTimeEl) curTimeEl.innerText = 'LIVE';
            if (durTimeEl) durTimeEl.innerText = '∞';
            if (seeker) {
                seeker.value = 0;
                seeker.disabled = true;
            }
            return;
        }

        if (seeker) seeker.disabled = false;

        const current = this.audioEl ? this.audioEl.currentTime : 0;
        const duration = (this.audioEl && this.audioEl.duration && !isNaN(this.audioEl.duration)) ? this.audioEl.duration : 0;

        if (curTimeEl && !this.isSeeking) {
            curTimeEl.innerText = this.formatTime(current);
        }
        if (durTimeEl) {
            durTimeEl.innerText = duration > 0 ? this.formatTime(duration) : '--:--';
        }

        if (seeker && !this.isSeeking && duration > 0) {
            seeker.value = (current / duration) * 100;
        }
    }

    getCurrentTrack() {
        return this.tracks[this.currentTrackIndex] || this.tracks[0];
    }

    refreshTrackSelect() {
        const selectEl = document.getElementById('bgm-track-select');
        if (selectEl) {
            selectEl.innerHTML = this.tracks.map((t, idx) => 
                `<option value="${idx}" ${idx === this.currentTrackIndex ? 'selected' : ''}>${t.title} [${t.artist}]</option>`
            ).join('');
        }
    }

    openDeck() {
        if (this.deckEl) this.deckEl.classList.add('open');
        if (this.backdropEl) this.backdropEl.classList.add('open');
        this.updateTimeDisplay();
    }

    closeDeck() {
        if (this.deckEl) this.deckEl.classList.remove('open');
        if (this.backdropEl) this.backdropEl.classList.remove('open');
    }

    setVolume(val) {
        this.volume = Math.max(0, Math.min(1, val));
        localStorage.setItem('bgm_volume', this.volume);
        
        if (this.audioEl) this.audioEl.volume = this.volume;
        if (this.synthGain && this.audioCtx) {
            this.synthGain.gain.setValueAtTime(this.volume * 0.18, this.audioCtx.currentTime);
        }

        const valEl = document.getElementById('bgm-volume-val');
        if (valEl) valEl.innerText = `${Math.round(this.volume * 100)}%`;

        const slider = document.getElementById('bgm-volume-slider');
        if (slider && parseFloat(slider.value) !== this.volume) slider.value = this.volume;
    }

    selectTrack(index) {
        if (index < 0 || index >= this.tracks.length) return;
        const changed = this.currentTrackIndex !== index;
        this.currentTrackIndex = index;
        const track = this.getCurrentTrack();
        localStorage.setItem('bgm_track_id', track.id);

        if (changed) {
            localStorage.setItem('bgm_pos_' + track.id, '0');
        }

        this.updateUI();

        if (this.isPlaying) {
            this.stopAll();
            this.playCurrent(changed);
        }
    }

    prevTrack() {
        const prev = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
        this.selectTrack(prev);
    }

    nextTrack() {
        const next = (this.currentTrackIndex + 1) % this.tracks.length;
        this.selectTrack(next);
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        this.isPlaying = true;
        localStorage.setItem('bgm_is_playing', 'true');
        this.playCurrent(false);
        this.updateUI();
    }

    pause() {
        this.isPlaying = false;
        localStorage.setItem('bgm_is_playing', 'false');
        this.saveCurrentTimestamp();
        this.stopAll();
        this.updateUI();
    }

    resolveUrl(relativeAudioPath) {
        if (!relativeAudioPath || relativeAudioPath.startsWith('http') || relativeAudioPath.startsWith('blob:') || relativeAudioPath.startsWith('data:')) {
            return relativeAudioPath;
        }
        const cleanPath = relativeAudioPath.replace(/^\/+/, '').replace(/^reader\//, '');
        const isSubFolder = window.location.pathname.includes('/reader/') || window.location.pathname.endsWith('/reader') || window.location.pathname.includes('/reader');
        if (isSubFolder) {
            return cleanPath.startsWith('audio/') ? cleanPath : 'audio/' + cleanPath;
        } else {
            return cleanPath.startsWith('audio/') ? 'reader/' + cleanPath : 'reader/audio/' + cleanPath;
        }
    }

    playCurrent(resetTime = false) {
        const track = this.getCurrentTrack();
        if (track.type === 'procedural') {
            this.stopAudioElement();
            this.startProceduralSynth();
        } else if (track.type === 'stream') {
            this.stopProceduralSynth();
            const finalUrl = this.resolveUrl(track.url);
            const savedPos = (!resetTime) ? parseFloat(localStorage.getItem('bgm_pos_' + track.id) || 0) : 0;

            this.audioEl.src = finalUrl;
            this.audioEl.volume = this.volume;

            const applyTimestamp = () => {
                if (savedPos > 0 && !isNaN(savedPos)) {
                    try {
                        if (this.audioEl.duration && savedPos < this.audioEl.duration) {
                            this.audioEl.currentTime = savedPos;
                        } else if (!this.audioEl.duration) {
                            this.audioEl.currentTime = savedPos;
                        }
                    } catch (err) {}
                }
            };

            this.audioEl.addEventListener('loadedmetadata', applyTimestamp, { once: true });
            this.audioEl.addEventListener('canplay', applyTimestamp, { once: true });

            this.audioEl.load();
            const playPromise = this.audioEl.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    if (savedPos > 0 && Math.abs(this.audioEl.currentTime - savedPos) > 2) {
                        try { this.audioEl.currentTime = savedPos; } catch(e) {}
                    }
                }).catch(err => {
                    console.warn('Audio stream autoplay waiting for first user gesture:', err);
                });
            }
        }
        this.updateTimeDisplay();
    }

    stopAudioElement() {
        if (this.audioEl) {
            this.saveCurrentTimestamp();
            this.audioEl.pause();
            this.audioEl.src = '';
        }
    }

    stopAll() {
        this.stopAudioElement();
        this.stopProceduralSynth();
    }

    // --- Procedural Soviet Analog Mainframe Generator (Web Audio API) ---
    startProceduralSynth() {
        if (!window.AudioContext && !window.webkitAudioContext) return;
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
        }

        this.stopProceduralSynth();

        const ctx = this.audioCtx;
        const now = ctx.currentTime;

        // Master Synth Gain
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(this.volume * 0.18, now);
        masterGain.connect(ctx.destination);
        this.synthGain = masterGain;

        // D-Minor Ambient Chord Drone: D2 (73.42Hz), A2 (110Hz), F3 (174.61Hz)
        const freqs = [73.42, 110.00, 174.61, 220.00];
        const oscs = [];

        freqs.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
            osc.frequency.setValueAtTime(freq, now);

            // Subtle tape wow & flutter via low-frequency detune modulation
            const lfo = ctx.createOscillator();
            lfo.frequency.setValueAtTime(0.12 + idx * 0.05, now);
            const lfoGain = ctx.createGain();
            lfoGain.gain.setValueAtTime(1.2, now);
            lfo.connect(lfoGain);
            lfoGain.connect(osc.detune);
            lfo.start();

            // Low-pass filter for vintage warm tape character
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(320 + idx * 60, now);

            const oscGain = ctx.createGain();
            oscGain.gain.setValueAtTime(0.22 / freqs.length, now);

            osc.connect(filter);
            filter.connect(oscGain);
            oscGain.connect(masterGain);

            osc.start();
            oscs.push(osc, lfo);
        });

        // Tape Hiss / Noise Buffer (Soviet cassette tape ambiance)
        const bufferSize = ctx.sampleRate * 2;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99765 * b0 + white * 0.05;
            b1 = 0.96300 * b1 + white * 0.06;
            b2 = 0.57000 * b2 + white * 0.15;
            output[i] = (b0 + b1 + b2) * 0.02;
        }

        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1200, now);
        noiseFilter.Q.setValueAtTime(0.8, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.04, now);

        whiteNoise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(masterGain);
        whiteNoise.start();

        this.synthNodes = { oscs, whiteNoise, masterGain };
    }

    stopProceduralSynth() {
        if (this.synthNodes) {
            try {
                if (this.synthNodes.oscs) {
                    this.synthNodes.oscs.forEach(node => {
                        try { node.stop(); node.disconnect(); } catch(e) {}
                    });
                }
                if (this.synthNodes.whiteNoise) {
                    try { this.synthNodes.whiteNoise.stop(); this.synthNodes.whiteNoise.disconnect(); } catch(e) {}
                }
                if (this.synthNodes.masterGain) {
                    try { this.synthNodes.masterGain.disconnect(); } catch(e) {}
                }
            } catch (err) {
                console.warn('Error stopping synth:', err);
            }
            this.synthNodes = null;
        }
    }

    updateUI() {
        const track = this.getCurrentTrack();

        // 1. Update Header Widget
        if (this.widgetEl) {
            this.widgetEl.classList.toggle('is-playing', this.isPlaying);
            this.widgetEl.innerHTML = `
                <span class="bgm-mini-play-btn" aria-label="Play/Pause Music">${this.isPlaying ? '⏸' : '▶'}</span>
                <span class="bgm-mini-track-label">BGM: ${track.title}</span>
                <div class="bgm-mini-eq">
                    <span></span><span></span><span></span>
                </div>
            `;
        }

        // 2. Update Popover Deck
        if (this.deckEl) {
            this.deckEl.classList.toggle('is-playing', this.isPlaying);
            const titleEl = document.getElementById('bgm-deck-title');
            if (titleEl) titleEl.innerText = track.title;
            const artistEl = document.getElementById('bgm-deck-artist');
            if (artistEl) artistEl.innerText = track.artist;

            const playBtn = document.getElementById('bgm-play-btn');
            if (playBtn) playBtn.innerText = this.isPlaying ? '⏸ Pause' : '▶ Play';

            const selectEl = document.getElementById('bgm-track-select');
            if (selectEl && parseInt(selectEl.value, 10) !== this.currentTrackIndex) {
                selectEl.value = this.currentTrackIndex;
            }
        }
    }
}

// Global initialization that runs whether DOM is already loaded or still loading
function initBGMPlayerInstance() {
    if (!window.bgmPlayer) {
        window.bgmPlayer = new BGMPlayer();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBGMPlayerInstance);
} else {
    initBGMPlayerInstance();
}

window.addEventListener('pageshow', () => {
    initBGMPlayerInstance();
    if (window.bgmPlayer) {
        window.bgmPlayer.initDOM();
        window.bgmPlayer.updateUI();
        const isPlayingPref = localStorage.getItem('bgm_is_playing');
        if ((isPlayingPref === 'true' || isPlayingPref === null) && !window.bgmPlayer.isPlaying) {
            window.bgmPlayer.play();
        }
    }
});
