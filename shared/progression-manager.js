/**
 * LOGOS-3 PROGRESSION MANAGER
 * Centralized progression rule evaluation, unlock verification, and achievement toasts.
 */
(function (global) {
    'use strict';

    const DEFAULT_RULES = {
        'content/27601e10419ce.nwd': {
            targetType: 'chapter',
            targetTitle: 'Chapter 1.1: Crime in the Future',
            requires: {
                type: 'case',
                id: 'chapter_01_morning_routine',
                title: 'Case 1: Morning Routine',
                url: '../game/?case=cases/chapter_01_morning_routine.json',
                teaser: 'Solve Case 1: Morning Routine to unlock Chapter 1.1.'
            }
        },
        'chapter_01_award_ceremony': {
            targetType: 'case',
            targetTitle: 'Case 2: The Conferral Ceremony',
            requires: {
                type: 'chapter',
                id: 'content/27601e10419ce.nwd',
                title: 'Chapter 1.1: Crime in the Future',
                url: 'index.html?file=content%2F27601e10419ce.nwd',
                teaser: 'Read Chapter 1.1 in the Novel Reader to unlock this conferral ceremony investigation.'
            }
        },
        'content/8e0179d6fe5e5.nwd': {
            targetType: 'chapter',
            targetTitle: 'Chapter 1.2: The Man on the News',
            requires: {
                type: 'case',
                id: 'chapter_01_award_ceremony',
                title: 'Case 2: The Conferral Ceremony',
                url: '../game/?case=cases/chapter_01_award_ceremony.json',
                teaser: 'Solve Case 2: The Conferral Ceremony to unlock Chapter 1.2.'
            }
        },
        'chapter_01_the_man_on_the_news': {
            targetType: 'case',
            targetTitle: 'Case 3: The Man on the News',
            requires: {
                type: 'chapter',
                id: 'content/8e0179d6fe5e5.nwd',
                title: 'Chapter 1.2: The Man on the News',
                url: 'index.html?file=content%2F8e0179d6fe5e5.nwd',
                teaser: 'Read Chapter 1.2 in the Novel Reader to unlock this suspect reconstruction investigation.'
            }
        },
        'content/1bd7b006c55ac.nwd': {
            targetType: 'chapter',
            targetTitle: 'Chapter 1.3: The Charred Body',
            requires: {
                type: 'case',
                id: 'chapter_01_the_man_on_the_news',
                title: 'Case 3: The Man on the News',
                url: '../game/?case=cases/chapter_01_the_man_on_the_news.json',
                teaser: 'Solve Case 3: The Man on the News to unlock Chapter 1.3.'
            }
        },
        'content/9d0d0bb96c432.nwd': {
            targetType: 'chapter',
            targetTitle: 'Chapter 1.4: Prime Suspect',
            requires: {
                type: 'chapter',
                id: 'content/1bd7b006c55ac.nwd',
                title: 'Chapter 1.3: The Charred Body',
                url: 'index.html?file=content%2F1bd7b006c55ac.nwd',
                teaser: 'Read Chapter 1.3 in the Novel Reader to unlock Chapter 1.4.'
            }
        }
    };

    let progressionRules = {};
    Object.entries(DEFAULT_RULES).forEach(([target, ruleObj]) => {
        progressionRules[target] = ruleObj;
        const cleanTarget = target.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
        progressionRules[cleanTarget] = ruleObj;
        if (!target.endsWith('.nwd')) {
            progressionRules[`cases/${cleanTarget}.json`] = ruleObj;
        }
    });

    let rulesLoaded = false;
    let toastTimeout = null;

    const LogosProgression = {
        async loadRules(customUrl = null) {
            try {
                let url = 'cases/progression.json';
                if (customUrl) {
                    url = customUrl;
                } else if (typeof window !== 'undefined' && window.location.pathname.includes('/reader')) {
                    url = '../game/cases/progression.json';
                }
                const res = await fetch(`${url}?t=${Date.now()}`);
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
                                    const cleanCaseId = rule.requiresCase.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                                    req = {
                                        type: 'case',
                                        id: rule.requiresCase,
                                        title: rule.caseTitle || `Case ${rule.requiresCase}`,
                                        url: rule.caseUrl || `?case=cases/${cleanCaseId}.json`,
                                        teaser: rule.teaser || 'Solve the preceding case to unlock.'
                                    };
                                } else if (rule.requiresChapter) {
                                    req = {
                                        type: 'chapter',
                                        id: rule.requiresChapter,
                                        title: rule.chapterTitle || 'Previous Chapter',
                                        url: rule.chapterUrl || `index.html?file=${encodeURIComponent(rule.requiresChapter)}`,
                                        teaser: rule.teaser || 'Read the required chapter to unlock.'
                                    };
                                }
                            } else {
                                if (req.type === 'case' && (!req.url || req.url.endsWith('/game/') || req.url === '../game/')) {
                                    const cleanCaseId = (req.id || '').replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                                    req.url = `../game/?case=cases/${cleanCaseId}.json`;
                                } else if (req.type === 'chapter' && !req.url && req.id) {
                                    req.url = `index.html?file=${encodeURIComponent(req.id)}`;
                                }
                            }

                            const ruleObj = {
                                targetType: rule.targetType || (target.endsWith('.nwd') ? 'chapter' : 'case'),
                                targetTitle: rule.targetTitle || '',
                                requires: req
                            };

                            progressionRules[target] = ruleObj;

                            // Index aliases for robust key matching
                            const cleanTarget = target.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                            progressionRules[cleanTarget] = ruleObj;
                            if (!target.endsWith('.nwd')) {
                                progressionRules[`cases/${cleanTarget}.json`] = ruleObj;
                            }
                        });
                    } else if (data && typeof data === 'object') {
                        progressionRules = data;
                    }
                    rulesLoaded = true;
                }
            } catch (e) {
                console.warn("Could not load progression rules:", e);
            }
            return progressionRules;
        },

        getRules() {
            return progressionRules;
        },

        getRule(target) {
            if (!target) return null;
            const cleanTarget = target.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
            const rawTarget = cleanTarget.replace(/^content\//, '');
            return progressionRules[target] || 
                   progressionRules[cleanTarget] || 
                   progressionRules[rawTarget] || 
                   progressionRules[`content/${rawTarget}`] || 
                   progressionRules[`cases/${cleanTarget}.json`] || 
                   null;
        },

        setRules(rules) {
            progressionRules = rules || {};
            rulesLoaded = true;
        },

        isChapterUnlocked(path) {
            if (!path) return true;
            const cleanPath = path.replace(/^[./]+/, '').replace(/^\.\.\//, '');
            const rawPath = cleanPath.replace(/^content\//, '');
            if (
                localStorage.getItem(`chapter_unlocked_${path}`) === 'true' ||
                localStorage.getItem(`chapter_unlocked_${cleanPath}`) === 'true' ||
                localStorage.getItem(`chapter_unlocked_${rawPath}`) === 'true' ||
                localStorage.getItem(`chapter_unlocked_content/${rawPath}`) === 'true'
            ) {
                return true;
            }

            const rule = progressionRules[path] || 
                         progressionRules[cleanPath] || 
                         progressionRules[rawPath] || 
                         progressionRules[`content/${rawPath}`];
            if (!rule || !rule.requires) return true;

            const req = rule.requires;
            if (req.type === 'chapter' || (req.id && req.id.endsWith('.nwd'))) {
                const reqPath = req.id.replace(/^[./]+/, '');
                const rawReqPath = reqPath.replace(/^content\//, '');
                return localStorage.getItem(`chapter_read_${req.id}`) === 'true' ||
                       localStorage.getItem(`chapter_read_${reqPath}`) === 'true' ||
                       localStorage.getItem(`chapter_read_${rawReqPath}`) === 'true' ||
                       localStorage.getItem(`chapter_read_content/${rawReqPath}`) === 'true';
            }
            const reqCaseId = (req.id || "").replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
            return localStorage.getItem(`case_solved_${reqCaseId}`) === 'true' ||
                   localStorage.getItem(`case_solved_${req.id}`) === 'true' ||
                   localStorage.getItem(`case_solved_cases/${reqCaseId}.json`) === 'true';
        },

        isCaseUnlocked(caseId, caseFile = null, caseRequires = null) {
            const cleanId = (caseId || "").replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
            const cleanFile = (caseFile || "").replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');

            if (
                (caseId && localStorage.getItem(`case_unlocked_${caseId}`) === 'true') ||
                (cleanId && localStorage.getItem(`case_unlocked_${cleanId}`) === 'true') ||
                (caseFile && localStorage.getItem(`case_unlocked_${caseFile}`) === 'true') ||
                (cleanFile && localStorage.getItem(`case_unlocked_${cleanFile}`) === 'true') ||
                (cleanId && localStorage.getItem(`case_unlocked_cases/${cleanId}.json`) === 'true')
            ) {
                return { unlocked: true, requirement: null };
            }

            let req = null;
            if (caseRequires) {
                req = caseRequires;
            } else if (progressionRules) {
                const rule = progressionRules[caseId] || 
                             progressionRules[caseFile] || 
                             progressionRules[cleanId] || 
                             progressionRules[cleanFile] ||
                             progressionRules[`cases/${cleanId}.json`];
                if (rule && rule.requires) req = rule.requires;
            }

            if (!req || !req.id) return { unlocked: true, requirement: null };

            let isUnlocked = false;
            if (req.type === 'chapter' || (req.id && req.id.endsWith('.nwd'))) {
                const reqPath = req.id.replace(/^[./]+/, '');
                const rawReqPath = reqPath.replace(/^content\//, '');
                isUnlocked = localStorage.getItem(`chapter_read_${req.id}`) === 'true' ||
                             localStorage.getItem(`chapter_read_${reqPath}`) === 'true' ||
                             localStorage.getItem(`chapter_read_${rawReqPath}`) === 'true' ||
                             localStorage.getItem(`chapter_read_content/${rawReqPath}`) === 'true';
            } else {
                const reqCaseId = (req.id || "").replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                isUnlocked = localStorage.getItem(`case_solved_${reqCaseId}`) === 'true' ||
                             localStorage.getItem(`case_solved_${req.id}`) === 'true' ||
                             localStorage.getItem(`case_solved_cases/${reqCaseId}.json`) === 'true';
            }

            return {
                unlocked: isUnlocked,
                requirement: req
            };
        },

        markChapterRead(path) {
            if (!path) return;
            const cleanPath = path.replace(/^[./]+/, '').replace(/^\.\.\//, '');
            const rawPath = cleanPath.replace(/^content\//, '');
            localStorage.setItem(`chapter_read_${path}`, 'true');
            localStorage.setItem(`chapter_read_${cleanPath}`, 'true');
            localStorage.setItem(`chapter_read_${rawPath}`, 'true');
            localStorage.setItem(`chapter_read_content/${rawPath}`, 'true');
        },

        markCaseSolved(caseId) {
            if (!caseId) return;
            const cleanId = (caseId || "").replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
            localStorage.setItem(`case_solved_${caseId}`, 'true');
            localStorage.setItem(`case_solved_${cleanId}`, 'true');
            localStorage.setItem(`case_solved_cases/${cleanId}.json`, 'true');
        },

        unlockChapter(path) {
            if (!path) return;
            const cleanPath = path.replace(/^[./]+/, '').replace(/^\.\.\//, '');
            const rawPath = cleanPath.replace(/^content\//, '');
            localStorage.setItem(`chapter_unlocked_${path}`, 'true');
            localStorage.setItem(`chapter_unlocked_${cleanPath}`, 'true');
            localStorage.setItem(`chapter_unlocked_${rawPath}`, 'true');
            localStorage.setItem(`chapter_unlocked_content/${rawPath}`, 'true');
        },

        unlockCase(caseId, caseFile = null) {
            if (!caseId && !caseFile) return;
            const cleanId = (caseId || "").replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
            const cleanFile = (caseFile || "").replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
            if (caseId) localStorage.setItem(`case_unlocked_${caseId}`, 'true');
            if (cleanId) localStorage.setItem(`case_unlocked_${cleanId}`, 'true');
            if (caseFile) localStorage.setItem(`case_unlocked_${caseFile}`, 'true');
            if (cleanFile) localStorage.setItem(`case_unlocked_${cleanFile}`, 'true');
            if (cleanId) localStorage.setItem(`case_unlocked_cases/${cleanId}.json`, 'true');
        },

        showUnlockToast(title, url, type = 'chapter') {
            if (typeof document === 'undefined') return;
            const toast = document.getElementById('unlock-toast');
            if (!toast) return;

            const badgeEl = document.getElementById('unlock-toast-badge');
            const titleEl = document.getElementById('unlock-toast-title');
            const btnEl = document.getElementById('unlock-toast-btn');

            if (badgeEl) {
                if (type === 'case') {
                    badgeEl.innerText = 'CASE UNLOCKED';
                } else if (type === 'chapter') {
                    badgeEl.innerText = 'CHAPTER UNLOCKED';
                } else {
                    badgeEl.innerText = 'CONTENT UNLOCKED';
                }
            }

            if (titleEl) titleEl.innerText = title || 'New Content Available';
            if (btnEl && url) {
                btnEl.href = url;
                btnEl.style.display = 'inline-flex';
            }

            toast.classList.remove('hidden');
            toast.classList.add('visible');
            try {
                if (window.sfx) {
                    if (typeof window.sfx.playUnlock === 'function') {
                        window.sfx.playUnlock();
                    } else if (typeof window.sfx.playSuccess === 'function') {
                        window.sfx.playSuccess();
                    }
                }
            } catch (e) {}

            if (toastTimeout) clearTimeout(toastTimeout);
            toastTimeout = setTimeout(() => {
                toast.classList.remove('visible');
                toast.classList.add('hidden');
            }, 8000);
        },

        hideUnlockToast() {
            if (typeof document === 'undefined') return;
            const toast = document.getElementById('unlock-toast');
            if (toast) {
                toast.classList.remove('visible');
                toast.classList.add('hidden');
            }
            if (toastTimeout) clearTimeout(toastTimeout);
        }
    };

    // Auto-initialize rules on browser load
    if (typeof window !== 'undefined') {
        LogosProgression.loadRules();
    }

    global.LogosProgression = LogosProgression;
})(typeof window !== 'undefined' ? window : globalThis);
