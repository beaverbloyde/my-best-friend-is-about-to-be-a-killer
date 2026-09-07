/**
 * LOGOS-3 RUSSIAN PHONETICS & PRONUNCIATION ENGINE
 * Transliteration, Cyrillic slugification, pre-recorded audio playback & Web Speech fallback.
 */
(function (global) {
    'use strict';

    const CYRILLIC_TO_LATIN = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };

    let pronunciationIndex = {};
    let currentPronounceAudio = null;
    let indexLoaded = false;

    const LogosPhonetics = {
        CYRILLIC_TO_LATIN,

        cyrillicToSlug(text) {
            return String(text || '').toLowerCase().split('').map(c => {
                if (CYRILLIC_TO_LATIN[c] !== undefined) return CYRILLIC_TO_LATIN[c];
                if (/[a-z0-9\-_]/.test(c)) return c;
                return '';
            }).join('');
        },

        cyrillicToTranslit(text) {
            return String(text || '').split('').map(c => {
                const lower = c.toLowerCase();
                if (CYRILLIC_TO_LATIN[lower] !== undefined) {
                    const trans = CYRILLIC_TO_LATIN[lower];
                    return (c === c.toUpperCase() && trans.length > 0)
                        ? trans.charAt(0).toUpperCase() + trans.slice(1)
                        : trans;
                }
                return c;
            }).join('');
        },

        async loadPronunciationIndex(basePath = null) {
            if (indexLoaded && Object.keys(pronunciationIndex).length > 0) return pronunciationIndex;
            try {
                let url = 'audio/pronunciations/index.json';
                if (basePath) {
                    url = `${basePath.replace(/\/+$/, '')}/audio/pronunciations/index.json`;
                } else if (typeof window !== 'undefined') {
                    if (window.location.pathname.includes('/reader') || window.location.pathname.includes('/game')) {
                        url = '../audio/pronunciations/index.json';
                    }
                }
                const res = await fetch(`${url}?t=${Date.now()}`);
                if (res.ok) {
                    pronunciationIndex = (await res.json()) || {};
                    indexLoaded = true;
                }
            } catch (e) {
                console.warn("Could not load pronunciation index:", e);
            }
            return pronunciationIndex;
        },

        fallbackSpeech(text) {
            if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
            try {
                window.speechSynthesis.cancel();
                window.speechSynthesis.resume();
                const cleanText = String(text).replace(/[\[\]\(\)\{\}\/_🔊]/g, '').trim();
                if (!cleanText) return;

                const utterance = new SpeechSynthesisUtterance(cleanText);
                utterance.lang = 'ru-RU';
                utterance.rate = 0.85;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;

                const voices = window.speechSynthesis.getVoices();
                if (voices && voices.length > 0) {
                    const ruVoice = voices.find(v => v.lang && (v.lang === 'ru-RU' || v.lang.startsWith('ru') || v.lang.includes('ru')));
                    if (ruVoice) {
                        utterance.voice = ruVoice;
                    }
                }

                window.speechSynthesis.speak(utterance);
            } catch (err) {
                console.warn('Speech synthesis error:', err);
            }
        },

        speakRussian(text, basePath = null) {
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
            const slug = this.cyrillicToSlug(key);
            const prefix = basePath !== null ? basePath : ((typeof window !== 'undefined' && (window.location.pathname.includes('/reader') || window.location.pathname.includes('/game'))) ? '../' : '');

            let audioSrc = null;
            if (pronunciationIndex && pronunciationIndex[key]) {
                const raw = pronunciationIndex[key];
                audioSrc = (raw.startsWith('http') || raw.startsWith('/')) ? raw : prefix + raw.replace(/^\.\.\//, '');
            } else if (pronunciationIndex && pronunciationIndex[slug]) {
                const raw = pronunciationIndex[slug];
                audioSrc = (raw.startsWith('http') || raw.startsWith('/')) ? raw : prefix + raw.replace(/^\.\.\//, '');
            }

            if (audioSrc) {
                const audio = new Audio(audioSrc);
                audio.volume = 1.0;
                currentPronounceAudio = audio;

                let hasFallenBack = false;
                const triggerFallback = () => {
                    if (!hasFallenBack) {
                        hasFallenBack = true;
                        this.fallbackSpeech(cleanWord);
                    }
                };

                audio.onerror = () => triggerFallback();

                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(() => triggerFallback());
                }
            } else {
                this.fallbackSpeech(cleanWord);
            }
        },

        initGlobalListeners() {
            if (typeof document === 'undefined') return;
            if (this._listenersInitialized) return;
            this._listenersInitialized = true;
            document.addEventListener('click', (e) => {
                const btn = e.target.closest('.pronounce-btn');
                if (!btn) return;
                e.stopPropagation();
                const word = btn.getAttribute('data-speak') || btn.dataset?.speak || btn.getAttribute('data-word') || btn.dataset?.word || btn.innerText;
                btn.classList.add('speaking');
                if (typeof window !== 'undefined' && window.sfx?.playClick) {
                    try { window.sfx.playClick(); } catch (err) {}
                }
                if (word) {
                    this.speakRussian(word);
                }
                setTimeout(() => {
                    btn.classList.remove('speaking');
                }, 1200);
            });
        }
    };

    // Auto-initialize index and click listeners
    if (typeof window !== 'undefined') {
        LogosPhonetics.loadPronunciationIndex();
        LogosPhonetics.initGlobalListeners();
    }

    global.LogosPhonetics = LogosPhonetics;
})(typeof window !== 'undefined' ? window : globalThis);
