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
    let rulesByTarget = {}; // cleanTarget -> Array<ruleObj>
    let rawRulesList = [];

    function normalizeTargetKey(target) {
        if (!target) return "";
        return target.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '').replace(/^content\//, '');
    }

    function checkSingleRequirement(req) {
        if (!req || !req.id) return true;
        if (req.type === 'chapter' || (req.id && req.id.endsWith('.nwd'))) {
            const reqPath = req.id.replace(/^[./]+/, '');
            const rawReqPath = reqPath.replace(/^content\//, '');
            return localStorage.getItem(`chapter_read_${req.id}`) === 'true' ||
                   localStorage.getItem(`chapter_read_${reqPath}`) === 'true' ||
                   localStorage.getItem(`chapter_read_${rawReqPath}`) === 'true' ||
                   localStorage.getItem(`chapter_read_content/${rawReqPath}`) === 'true';
        } else {
            const reqCaseId = (req.id || "").replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
            return localStorage.getItem(`case_solved_${reqCaseId}`) === 'true' ||
                   localStorage.getItem(`case_solved_${req.id}`) === 'true' ||
                   localStorage.getItem(`case_solved_cases/${reqCaseId}.json`) === 'true';
        }
    }

    function getContextPrefix() {
        if (typeof window === 'undefined' || !window.location) return { reader: '../reader/', game: '../game/' };
        const path = window.location.pathname || '';
        if (path.includes('/reader')) {
            return { reader: '', game: '../game/' };
        } else if (path.includes('/game')) {
            return { reader: '../reader/', game: '' };
        } else if (path.includes('/editor')) {
            return { reader: '../reader/', game: '../game/' };
        }
        return { reader: 'reader/', game: 'game/' };
    }

    function formatRequirement(req) {
        if (!req) return null;
        const formatted = { ...req };
        const prefixes = getContextPrefix();
        if (formatted.type === 'case') {
            const cleanCaseId = (formatted.id || '').replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
            if (!formatted.url || formatted.url.endsWith('/game/') || formatted.url === '../game/' || formatted.url.startsWith('?case=') || formatted.url.startsWith('../game/?case=')) {
                formatted.url = `${prefixes.game}?case=cases/${cleanCaseId}.json`;
            }
        } else if (formatted.type === 'chapter' && formatted.id) {
            const cleanChapterId = formatted.id.replace(/^[./]+/, '');
            if (!formatted.url || formatted.url.startsWith('index.html?file=') || formatted.url.startsWith('?file=') || formatted.url.startsWith('../reader/')) {
                formatted.url = prefixes.reader 
                    ? `${prefixes.reader}?file=${encodeURIComponent(cleanChapterId)}`
                    : `index.html?file=${encodeURIComponent(cleanChapterId)}`;
            }
        }
        return formatted;
    }

    function indexRules(rulesArray) {
        progressionRules = {};
        rulesByTarget = {};
        rawRulesList = Array.isArray(rulesArray) ? rulesArray : [];

        rawRulesList.forEach(rule => {
            const target = rule.target || rule.chapter || rule.case;
            if (!target) return;

            let reqList = [];
            if (Array.isArray(rule.requires)) {
                reqList = rule.requires.map(r => formatRequirement(r)).filter(Boolean);
            } else if (rule.requires && typeof rule.requires === 'object') {
                reqList = [formatRequirement(rule.requires)].filter(Boolean);
            } else if (rule.requiresCase) {
                const cleanCaseId = rule.requiresCase.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                const prefixes = getContextPrefix();
                reqList = [{
                    type: 'case',
                    id: rule.requiresCase,
                    title: rule.caseTitle || `Case ${rule.requiresCase}`,
                    url: rule.caseUrl || `${prefixes.game}?case=cases/${cleanCaseId}.json`,
                    teaser: rule.teaser || 'Solve the preceding case to unlock.'
                }];
            } else if (rule.requiresChapter) {
                const cleanChapterId = rule.requiresChapter.replace(/^[./]+/, '');
                const prefixes = getContextPrefix();
                reqList = [{
                    type: 'chapter',
                    id: rule.requiresChapter,
                    title: rule.chapterTitle || 'Previous Chapter',
                    url: rule.chapterUrl || (prefixes.reader ? `${prefixes.reader}?file=${encodeURIComponent(cleanChapterId)}` : `index.html?file=${encodeURIComponent(cleanChapterId)}`),
                    teaser: rule.teaser || 'Read the required chapter to unlock.'
                }];
            }

            const normKey = normalizeTargetKey(target);
            if (!rulesByTarget[normKey]) rulesByTarget[normKey] = [];

            reqList.forEach(req => {
                const ruleObj = {
                    target: target,
                    targetType: rule.targetType || (target.endsWith('.nwd') ? 'chapter' : 'case'),
                    targetTitle: rule.targetTitle || '',
                    requires: req
                };
                rulesByTarget[normKey].push(ruleObj);

                // Backward compatibility dictionary
                progressionRules[target] = ruleObj;
                progressionRules[normKey] = ruleObj;
                if (!target.endsWith('.nwd')) {
                    progressionRules[`cases/${normKey}.json`] = ruleObj;
                }
            });
        });
    }

    // Initialize default rules
    const defaultRulesArray = [];
    Object.entries(DEFAULT_RULES).forEach(([target, ruleObj]) => {
        defaultRulesArray.push({
            target: target,
            targetType: ruleObj.targetType,
            targetTitle: ruleObj.targetTitle,
            requires: ruleObj.requires
        });
    });
    indexRules(defaultRulesArray);

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
                        indexRules(data.rules);
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

        getRulesForTarget(target) {
            if (!target) return [];
            const norm = normalizeTargetKey(target);
            return rulesByTarget[norm] || [];
        },

        getRule(target) {
            const list = this.getRulesForTarget(target);
            return list.length > 0 ? list[0] : (progressionRules[target] || null);
        },

        setRules(rules) {
            if (Array.isArray(rules)) {
                indexRules(rules);
            } else {
                progressionRules = rules || {};
            }
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

            const targetRules = this.getRulesForTarget(path);
            if (!targetRules || targetRules.length === 0) return true;

            // Multiple Prerequisites: ALL requirements must be satisfied (AND logic)
            return targetRules.every(r => checkSingleRequirement(r.requires));
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
                return { unlocked: true, requirement: null, pendingRequirements: [] };
            }

            if (caseRequires) {
                const met = checkSingleRequirement(caseRequires);
                return {
                    unlocked: met,
                    requirement: met ? null : caseRequires,
                    pendingRequirements: met ? [] : [caseRequires]
                };
            }

            const targetRules = this.getRulesForTarget(caseId || caseFile || cleanId);
            if (!targetRules || targetRules.length === 0) {
                return { unlocked: true, requirement: null, pendingRequirements: [] };
            }

            // Multiple Prerequisites: Collect all unmet requirements
            const unmetRules = targetRules.filter(r => !checkSingleRequirement(r.requires));
            if (unmetRules.length === 0) {
                return { unlocked: true, requirement: null, pendingRequirements: [] };
            }

            // Build combined teaser message
            let combinedTeaser = "";
            if (unmetRules.length === 1) {
                combinedTeaser = unmetRules[0].requires.teaser || `Complete ${unmetRules[0].requires.title} to unlock.`;
            } else {
                const reqNames = unmetRules.map(r => r.requires.title || r.requires.id).join(' & ');
                combinedTeaser = `Requires completing multiple leads: ${reqNames}.`;
            }

            return {
                unlocked: false,
                requirement: unmetRules[0].requires,
                pendingRequirements: unmetRules.map(r => r.requires),
                combinedTeaser: combinedTeaser
            };
        },

        // Evaluate all downstream targets unlocked by completing a specific case or chapter
        getNewlyUnlockedTargets(completedId, completedType = 'case') {
            const cleanCompletedId = normalizeTargetKey(completedId);
            const newlyUnlocked = [];

            const visitedTargets = new Set();
            for (const [normTarget, rules] of Object.entries(rulesByTarget)) {
                if (visitedTargets.has(normTarget)) continue;
                const hasMatchingPrereq = (rules || []).some(r => {
                    const req = r.requires;
                    if (!req || !req.id) return false;
                    return normalizeTargetKey(req.id) === cleanCompletedId;
                });
                if (!hasMatchingPrereq) continue;

                visitedTargets.add(normTarget);
                const firstRule = rules[0] || {};
                const target = firstRule.target || normTarget;
                const isChapter = firstRule.targetType === 'chapter' || target.endsWith('.nwd');
                const isNowUnlocked = isChapter ? this.isChapterUnlocked(target) : this.isCaseUnlocked(target).unlocked;

                if (isNowUnlocked) {
                    newlyUnlocked.push({
                        target: target,
                        targetType: firstRule.targetType || (isChapter ? 'chapter' : 'case'),
                        targetTitle: firstRule.targetTitle || target,
                        href: isChapter ? `../reader/?file=${encodeURIComponent(target)}` : `?case=cases/${normTarget}.json`
                    });
                }
            }

            return newlyUnlocked;
        },

        // Detect any circular dependency loops in progression rules
        findCycles() {
            const adj = new Map();
            const allNodes = new Set();

            for (const [normTarget, rules] of Object.entries(rulesByTarget)) {
                allNodes.add(normTarget);
                (rules || []).forEach(r => {
                    const req = r.requires;
                    if (!req || !req.id) return;
                    const u = normalizeTargetKey(req.id);
                    allNodes.add(u);
                    if (!adj.has(u)) adj.set(u, []);
                    adj.get(u).push(normTarget);
                });
            }

            const state = new Map(); // 0 = unvisited, 1 = visiting, 2 = visited
            const cycles = [];

            for (const node of allNodes) {
                state.set(node, 0);
            }

            function dfs(u, path) {
                state.set(u, 1);
                path.push(u);

                const neighbors = adj.get(u) || [];
                for (const v of neighbors) {
                    if (state.get(v) === 1) {
                        const cycleStartIndex = path.indexOf(v);
                        if (cycleStartIndex !== -1) {
                            cycles.push(path.slice(cycleStartIndex).concat(v));
                        }
                    } else if (state.get(v) === 0) {
                        dfs(v, path);
                    }
                }

                path.pop();
                state.set(u, 2);
            }

            for (const node of allNodes) {
                if (state.get(node) === 0) {
                    dfs(node, []);
                }
            }

            return cycles;
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
