/**
 * LOGOS-3 GAME SLOT PICKER AUTOCOMPLETE
 * Searchable keyword popover, constraint badges, keyboard navigation & slot selection.
 */
(function (global) {
    'use strict';

    class LogosSlotPicker {
        constructor(engine) {
            this.engine = engine;
            this.activeSlot = null;
            this.highlightedIndex = -1;
            this.initDOM();
        }

        initDOM() {
            const popover = document.getElementById("slot-picker-popover");
            const input = document.getElementById("slot-picker-input");
            const clearBtn = document.getElementById("slot-picker-clear-btn");
            if (!popover || !input) return;

            input.addEventListener("input", (e) => {
                this.filter(e.target.value);
            });

            if (clearBtn) {
                clearBtn.addEventListener("click", () => {
                    this.clearActiveSlot();
                });
            }

            input.addEventListener("keydown", (e) => {
                const list = document.getElementById("slot-picker-list");
                const items = list ? Array.from(list.querySelectorAll(".slot-picker-item")) : [];

                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    if (items.length === 0) return;
                    this.highlightedIndex = (this.highlightedIndex + 1) % items.length;
                    this.updateHighlight(items);
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    if (items.length === 0) return;
                    this.highlightedIndex = (this.highlightedIndex - 1 + items.length) % items.length;
                    this.updateHighlight(items);
                } else if (e.key === "Enter") {
                    e.preventDefault();
                    if (this.highlightedIndex >= 0 && items[this.highlightedIndex]) {
                        items[this.highlightedIndex].click();
                    } else if (items.length === 1) {
                        items[0].click();
                    } else {
                        const query = input.value.trim().toLowerCase();
                        if (!query) {
                            this.close();
                            return;
                        }
                        for (let word of this.engine.collectedWords) {
                            if (word.toLowerCase() === query) {
                                this.selectWord(word);
                                return;
                            }
                        }
                    }
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    this.close();
                }
            });

            // Close when clicking or touching outside
            document.addEventListener("mousedown", (e) => {
                if (!popover.classList.contains("hidden")) {
                    if (!popover.contains(e.target) && !e.target.closest(".slot")) {
                        this.close();
                    }
                }
            });

            document.addEventListener("touchstart", (e) => {
                if (!popover.classList.contains("hidden")) {
                    if (!popover.contains(e.target) && !e.target.closest(".slot")) {
                        this.close();
                    }
                }
            }, { passive: true });
        }

        updateHighlight(items) {
            items.forEach((item, idx) => {
                if (idx === this.highlightedIndex) {
                    item.classList.add("highlighted");
                    item.scrollIntoView({ block: "nearest" });
                } else {
                    item.classList.remove("highlighted");
                }
            });
        }

        matchesSlotTag(word, slotTag) {
            if (!slotTag || slotTag === "all") return true;
            const allowedCanonical = LogosCategoryTheme.getCanonicalCategories(slotTag);
            const wordCanonical = this.engine.getKeywordTags(word);
            return allowedCanonical.some(tag => wordCanonical.includes(tag));
        }

        open(slot) {
            if (this.engine.justTouchDragged) return;
            const popover = document.getElementById("slot-picker-popover");
            const input = document.getElementById("slot-picker-input");
            const clearBtn = document.getElementById("slot-picker-clear-btn");
            const badge = document.getElementById("slot-picker-constraint-badge");
            if (!popover || !input) return;

            this.activeSlot = slot;
            this.highlightedIndex = -1;

            const slotId = slot.getAttribute("data-id");
            const slotTag = slot.getAttribute("data-tag");
            const currentWord = this.engine.docketSlots[slotId] || "";

            if (clearBtn) {
                clearBtn.style.display = currentWord ? "inline-block" : "none";
            }

            if (badge) {
                if (slotTag) {
                    badge.style.display = "inline-flex";
                    const tags = LogosCategoryTheme.getCanonicalCategories(slotTag);
                    if (tags.length === 1) {
                        const conf = LogosCategoryTheme.getCategoryConfig(tags[0], this.engine.currentCase);
                        badge.style.background = conf.hex;
                        badge.style.color = "#000000";
                        badge.innerText = `${conf.icon} ${conf.label.toUpperCase()}`;
                    } else {
                        const hexes = tags.map(c => LogosCategoryTheme.getCategoryConfig(c, this.engine.currentCase).hex);
                        badge.style.background = LogosCategoryTheme.buildSplitGradient(hexes, "90deg");
                        badge.style.color = "#ffffff";
                        badge.innerText = tags.map(c => LogosCategoryTheme.getCategoryConfig(c, this.engine.currentCase).label.toUpperCase()).join(" / ");
                    }
                } else {
                    badge.style.display = "none";
                }
            }

            if (input) {
                input.placeholder = slotTag ? `Filter [${slotTag.toUpperCase()}] keywords...` : "Search keywords...";
            }

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
            this.filter("");
            setTimeout(() => input.focus(), 60);
        }

        filter(query = "") {
            const list = document.getElementById("slot-picker-list");
            if (!list) return;
            list.innerHTML = "";

            const slotId = this.activeSlot?.getAttribute("data-id");
            const slotTag = this.activeSlot?.getAttribute("data-tag");
            const currentSlotWord = slotId ? this.engine.docketSlots[slotId] : "";

            const q = (query || "").trim().toLowerCase();
            let words = Array.from(this.engine.collectedWords);

            if (slotTag) {
                words = words.filter(w => this.matchesSlotTag(w, slotTag));
            }

            if (words.length === 0) {
                if (slotTag) {
                    list.innerHTML = `<div class="slot-picker-empty">No [${this.engine.escapeHtml(slotTag.toUpperCase())}] keywords collected yet.<br>Explore scene clues & timeline first!</div>`;
                } else {
                    list.innerHTML = `<div class="slot-picker-empty">No keywords collected yet.<br>Explore scene clues & timeline first!</div>`;
                }
                return;
            }

            words.sort((a, b) => a.localeCompare(b));

            if (q) {
                words = words.filter(w => w.toLowerCase().includes(q));
            }

            if (words.length === 0) {
                list.innerHTML = `<div class="slot-picker-empty">No matching keywords for "${this.engine.escapeHtml(query)}"</div>`;
                return;
            }

            words.forEach((word) => {
                const canonicalTags = this.engine.getKeywordTags(word);

                let badgesHtml = "";
                canonicalTags.forEach(cat => {
                    const conf = LogosCategoryTheme.getCategoryConfig(cat, this.engine.currentCase);
                    badgesHtml += `<span class="cat-pill" style="background: ${conf.bg}; border: 1px solid ${conf.border}; color: ${conf.text};">${conf.icon} ${conf.label}</span>`;
                });

                const item = document.createElement("button");
                item.type = "button";
                item.className = "slot-picker-item";
                if (word === currentSlotWord) {
                    item.classList.add("active-choice");
                }

                if (canonicalTags.length === 1) {
                    const conf = LogosCategoryTheme.getCategoryConfig(canonicalTags[0], this.engine.currentCase);
                    item.style.borderLeft = `3.5px solid ${conf.hex}`;
                } else if (canonicalTags.length > 1) {
                    const hexes = canonicalTags.map(c => LogosCategoryTheme.getCategoryConfig(c, this.engine.currentCase).hex);
                    item.style.borderLeft = `3.5px solid transparent`;
                    item.style.borderImage = `${LogosCategoryTheme.buildSplitGradient(hexes, "to bottom")} 1`;
                }

                item.innerHTML = `
                    <div class="slot-picker-item-left">
                        <div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">
                            ${badgesHtml}
                        </div>
                        <span style="font-weight: 600;">${this.engine.escapeHtml(word)}</span>
                    </div>
                    ${word === currentSlotWord ? '<span style="font-size: 11px; font-weight: 700; color: var(--accent);">✓</span>' : ""}
                `;

                item.addEventListener("click", () => {
                    this.selectWord(word);
                });

                list.appendChild(item);
            });

            this.highlightedIndex = -1;
        }

        selectWord(word) {
            if (!this.activeSlot) return;
            const slotId = this.activeSlot.getAttribute("data-id");
            this.engine.docketSlots[slotId] = word;
            this.engine.updateSlotAppearance(this.activeSlot, word);
            window.sfx?.playSnap();
            this.engine.updateProgress();
            this.engine.saveProgress();
            this.close();
        }

        clearActiveSlot() {
            if (!this.activeSlot) return;
            const slotId = this.activeSlot.getAttribute("data-id");
            delete this.engine.docketSlots[slotId];
            this.engine.updateSlotAppearance(this.activeSlot, null);
            window.sfx?.playPop();
            this.engine.updateProgress();
            this.engine.saveProgress();
            this.close();
        }

        close() {
            const popover = document.getElementById("slot-picker-popover");
            if (popover) {
                popover.classList.add("hidden");
            }
            this.activeSlot = null;
            this.highlightedIndex = -1;
        }
    }

    global.LogosSlotPicker = LogosSlotPicker;
})(typeof window !== 'undefined' ? window : globalThis);
