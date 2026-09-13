/**
 * LOGOS-3 GAME DRAG & DROP ENGINE
 * HTML5 Desktop slot swapping & mobile touch drag-and-drop with floating ghost element.
 */
(function (global) {
    'use strict';

    class LogosDragDrop {
        constructor(engine) {
            this.engine = engine;
            this._draggedSourceSlotId = null;
            this._globalBound = false;
            this._touchBound = false;
            this.initGlobalDesktopDrop();
            this.initDesktopDragAndDrop();
            this.initTouchDragAndDrop();
        }

        get draggedSourceSlotId() {
            return this.engine ? this.engine.draggedSourceSlotId : this._draggedSourceSlotId;
        }

        set draggedSourceSlotId(val) {
            if (this.engine) this.engine.draggedSourceSlotId = val;
            this._draggedSourceSlotId = val;
        }

        clearSlot(slotId) {
            if (!slotId) return;
            const sourceEl = document.querySelector(`[data-id="${slotId}"]`);
            if (sourceEl && !sourceEl.classList.contains("num-slot")) {
                delete this.engine.docketSlots[slotId];
                this.engine.updateSlotAppearance(sourceEl, null);
                window.sfx?.playPop?.() || window.sfx?.playSnap?.();
                this.engine.updateProgress();
                this.engine.saveProgress();
            }
        }

        initGlobalDesktopDrop() {
            if (this._globalBound) return;
            this._globalBound = true;

            // Capture-phase click interceptor to prevent synthetic click events on slots/buttons after dragging
            window.addEventListener("click", (e) => {
                if (this.engine.justDragged || this.engine.justTouchDragged || this.engine.isDragging) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    e.preventDefault();
                }
            }, true);

            const ghost = document.getElementById("touch-drag-ghost");

            // Delegated Desktop Drag & Drop handlers on document
            document.addEventListener("dragstart", (e) => {
                const target = e.target.closest?.(".slot, .num-slot, .kw, .tray-word");
                if (!target) return;

                if (target.classList.contains("num-slot")) {
                    e.preventDefault();
                    return;
                }

                let draggedWord = "";
                if (target.classList.contains("slot")) {
                    const slotId = target.getAttribute("data-id");
                    const currentWord = this.engine.docketSlots[slotId] || (target.innerText.trim() !== "[ ? ]" ? target.innerText.trim() : "");

                    if (currentWord) {
                        this.draggedSourceSlotId = slotId;
                        draggedWord = currentWord;
                        this.engine.isDragging = true;
                        e.dataTransfer.setData("text/plain", currentWord);
                        e.dataTransfer.setData("application/x-docket-slot", slotId);
                        e.dataTransfer.effectAllowed = "move";
                    } else {
                        e.preventDefault();
                    }
                } else {
                    draggedWord = target.getAttribute("data-id") || target.getAttribute("data-word") || target.innerText.trim();
                    this.draggedSourceSlotId = null;
                    this.engine.isDragging = true;
                    e.dataTransfer.setData("text/plain", draggedWord);
                    e.dataTransfer.setData("application/x-docket-slot", "");
                }
                this.draggedWord = draggedWord;

                if (draggedWord && ghost) {
                    const def = this.engine.getKeywordDefinition(draggedWord);
                    const baseText = def?.variations?.base || def?.baseWord || draggedWord;
                    ghost.innerText = baseText;
                    ghost.style.display = "block";
                    ghost.style.left = `${e.clientX}px`;
                    ghost.style.top = `${e.clientY}px`;

                    try {
                        const emptyImg = document.createElement("canvas");
                        emptyImg.width = 1;
                        emptyImg.height = 1;
                        if (e.dataTransfer && e.dataTransfer.setDragImage) {
                            e.dataTransfer.setDragImage(emptyImg, 0, 0);
                        }
                    } catch (err) {}
                }
            });

            document.addEventListener("drag", (e) => {
                if (this.draggedWord && ghost && (e.clientX !== 0 || e.clientY !== 0)) {
                    ghost.style.left = `${e.clientX}px`;
                    ghost.style.top = `${e.clientY}px`;
                    ghost.style.display = "block";
                }
            });

            document.addEventListener("dragover", (e) => {
                if (this.draggedWord && ghost && (e.clientX !== 0 || e.clientY !== 0)) {
                    ghost.style.left = `${e.clientX}px`;
                    ghost.style.top = `${e.clientY}px`;
                    ghost.style.display = "block";
                }

                const slot = e.target.closest?.(".slot, .num-slot");
                if (slot) {
                    e.preventDefault();
                    const isAllowed = !this.draggedWord || this.engine.isWordAllowedInSlot(this.draggedWord, slot);

                    if (isAllowed) {
                        slot.classList.add("drag-over");
                        slot.classList.remove("drag-invalid");
                        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";

                        if (this.draggedWord && !slot.classList.contains("num-slot")) {
                            const variation = slot.getAttribute("data-variation") || "base";
                            const capitalize = slot.getAttribute("data-capitalize");
                            const conjugated = this.engine.getConjugatedKeyword(this.draggedWord, variation, capitalize);
                            if (ghost) ghost.innerText = conjugated;
                            if (!slot.classList.contains("previewing-drag")) {
                                slot.classList.add("previewing-drag");
                                slot.setAttribute("data-prev-text", slot.innerText);
                            }
                            slot.innerText = conjugated;
                        }
                    } else {
                        slot.classList.add("drag-invalid");
                        slot.classList.remove("drag-over");
                        if (slot.classList.contains("previewing-drag")) {
                            slot.classList.remove("previewing-drag");
                            const prev = slot.getAttribute("data-prev-text");
                            if (prev !== null && prev !== undefined) slot.innerText = prev;
                            slot.removeAttribute("data-prev-text");
                        }
                        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                        if (this.draggedWord && ghost) {
                            const def = this.engine.getKeywordDefinition(this.draggedWord);
                            const baseText = def?.variations?.base || def?.baseWord || this.draggedWord;
                            ghost.innerText = baseText;
                        }
                    }
                } else if (this.draggedSourceSlotId || this.engine.isDragging) {
                    e.preventDefault();
                    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                    if (this.draggedWord && ghost) {
                        const def = this.engine.getKeywordDefinition(this.draggedWord);
                        const baseText = def?.variations?.base || def?.baseWord || this.draggedWord;
                        ghost.innerText = baseText;
                    }
                }
            });

            document.addEventListener("dragleave", (e) => {
                const slot = e.target.closest?.(".slot, .num-slot");
                if (slot) {
                    slot.classList.remove("drag-over", "drag-invalid");
                    if (slot.classList.contains("previewing-drag")) {
                        slot.classList.remove("previewing-drag");
                        const prev = slot.getAttribute("data-prev-text");
                        if (prev !== null && prev !== undefined) slot.innerText = prev;
                        slot.removeAttribute("data-prev-text");
                    }
                }
            });

            document.addEventListener("drop", (e) => {
                if (ghost) ghost.style.display = "none";
                const slot = e.target.closest?.(".slot, .num-slot");

                if (slot) {
                    e.preventDefault();
                    slot.classList.remove("drag-over", "drag-invalid");
                    if (slot.classList.contains("previewing-drag")) {
                        slot.classList.remove("previewing-drag");
                        slot.removeAttribute("data-prev-text");
                    }

                    const incomingWord = e.dataTransfer.getData("text/plain");
                    if (!incomingWord) return;

                    // Enforce category restriction
                    if (!this.engine.isWordAllowedInSlot(incomingWord, slot)) {
                        window.sfx?.playError?.() || window.sfx?.playPop?.();
                        const slotTag = slot.getAttribute("data-tag") || "required category";
                        const def = this.engine.getKeywordDefinition(incomingWord);
                        const display = def?.variations?.base || def?.baseWord || incomingWord;
                        this.engine.showToast(`⚠️ Category mismatch: "${display}" is not a ${slotTag} keyword`, "warning");
                        this.draggedSourceSlotId = null;
                        this.draggedWord = null;
                        return;
                    }

                    const targetSlotId = slot.getAttribute("data-id");
                    const sourceSlotId = this.draggedSourceSlotId || e.dataTransfer.getData("application/x-docket-slot");

                    const existingTargetWord = slot.classList.contains("num-slot")
                        ? slot.value.trim()
                        : (this.engine.docketSlots[targetSlotId] || "");

                    const sourceEl = sourceSlotId ? document.querySelector(`[data-id="${sourceSlotId}"]`) : null;

                    if (slot.classList.contains("num-slot")) {
                        const digits = incomingWord.replace(/[^0-9]/g, "");
                        if (digits.length > 0) {
                            const maxLen = parseInt(slot.getAttribute("maxlength") || "4", 10);
                            slot.value = digits.slice(0, maxLen);
                            slot.classList.add("filled");
                            slot.classList.remove("wrong", "correct");
                            this.engine.docketSlots[targetSlotId] = slot.value;
                        }
                    } else {
                        const def = this.engine.getKeywordDefinition(incomingWord);
                        const canonVal = def ? def.id : incomingWord;
                        this.engine.docketSlots[targetSlotId] = canonVal;
                        this.engine.updateSlotAppearance(slot, canonVal);
                    }

                    // Auto-collect keyword when placed into a valid slot
                    this.engine.collectWord(null, incomingWord);

                    if (sourceEl && sourceSlotId && sourceSlotId !== targetSlotId && !sourceEl.classList.contains("num-slot")) {
                        if (existingTargetWord && this.engine.isWordAllowedInSlot(existingTargetWord, sourceEl)) {
                            const exDef = this.engine.getKeywordDefinition(existingTargetWord);
                            const exCanonVal = exDef ? exDef.id : existingTargetWord;
                            this.engine.docketSlots[sourceSlotId] = exCanonVal;
                            this.engine.updateSlotAppearance(sourceEl, exCanonVal);
                        } else {
                            delete this.engine.docketSlots[sourceSlotId];
                            this.engine.updateSlotAppearance(sourceEl, null);
                        }
                    }

                    this.draggedSourceSlotId = null;
                    this.draggedWord = null;
                    window.sfx?.playSnap();
                    this.engine.updateProgress();
                    this.engine.saveProgress();
                } else if (this.draggedSourceSlotId) {
                    e.preventDefault();
                    const sourceSlotId = this.draggedSourceSlotId;
                    this.draggedSourceSlotId = null;
                    this.draggedWord = null;
                    this.clearSlot(sourceSlotId);
                }
            });

            document.addEventListener("dragend", () => {
                if (ghost) ghost.style.display = "none";
                this.engine.isDragging = false;
                this.engine.justDragged = true;
                setTimeout(() => { this.engine.justDragged = false; }, 300);

                document.querySelectorAll(".previewing-drag, .drag-over, .drag-invalid").forEach(s => {
                    s.classList.remove("previewing-drag", "drag-over", "drag-invalid");
                    const prev = s.getAttribute("data-prev-text");
                    if (prev !== null && prev !== undefined) s.innerText = prev;
                    s.removeAttribute("data-prev-text");
                });

                if (this.draggedSourceSlotId) {
                    const sourceSlotId = this.draggedSourceSlotId;
                    this.draggedSourceSlotId = null;
                    this.clearSlot(sourceSlotId);
                }
                this.draggedWord = null;
            });
        }

        initDesktopDragAndDrop() {
            const wordSlots = document.querySelectorAll(".slot");
            const numSlots = document.querySelectorAll(".num-slot");

            wordSlots.forEach(slot => {
                slot.setAttribute("draggable", "true");
            });

            numSlots.forEach(slot => {
                slot.setAttribute("draggable", "false");
            });
        }

        initTouchDragAndDrop() {
            if (this._touchBound) return;
            this._touchBound = true;

            const ghost = document.getElementById("touch-drag-ghost");
            let touchDraggedWord = null;
            let touchSourceSlotId = null;
            let isTouchDragging = false;
            let currentHoveredSlot = null;
            let startX = 0, startY = 0;
            let touchThresholdPassed = false;

            document.addEventListener("touchstart", (e) => {
                const touch = e.touches[0];
                const target = e.target.closest(".kw, .tray-word, .slot");
                if (!target || target.classList.contains("num-slot")) return;

                let word = "";
                let sourceSlotId = null;

                if (target.classList.contains("slot")) {
                    sourceSlotId = target.getAttribute("data-id");
                    word = this.engine.docketSlots[sourceSlotId] || (target.innerText.trim() !== "[ ? ]" ? target.innerText.trim() : "");
                } else {
                    word = target.getAttribute("data-word") || target.innerText.trim();
                }

                if (!word) return;

                startX = touch.clientX;
                startY = touch.clientY;
                touchDraggedWord = word;
                touchSourceSlotId = sourceSlotId;
                isTouchDragging = true;
                touchThresholdPassed = false;
            }, { passive: true });

            document.addEventListener("touchmove", (e) => {
                if (!isTouchDragging || !touchDraggedWord) return;
                const touch = e.touches[0];

                const dx = touch.clientX - startX;
                const dy = touch.clientY - startY;
                if (!touchThresholdPassed && Math.sqrt(dx * dx + dy * dy) > 8) {
                    touchThresholdPassed = true;
                    if (ghost) {
                        ghost.innerText = touchDraggedWord;
                        ghost.style.display = "block";
                    }
                }

                if (touchThresholdPassed && ghost) {
                    ghost.style.left = `${touch.clientX}px`;
                    ghost.style.top = `${touch.clientY}px`;

                    const elBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                    const slot = elBelow ? elBelow.closest(".slot, .num-slot") : null;

                    if (currentHoveredSlot && currentHoveredSlot !== slot) {
                        currentHoveredSlot.classList.remove("drag-over", "drag-invalid");
                        if (currentHoveredSlot.classList.contains("previewing-drag")) {
                            currentHoveredSlot.classList.remove("previewing-drag");
                            const prev = currentHoveredSlot.getAttribute("data-prev-text");
                            if (prev !== null && prev !== undefined) currentHoveredSlot.innerText = prev;
                            currentHoveredSlot.removeAttribute("data-prev-text");
                        }
                    }

                    if (slot) {
                        const isAllowed = this.engine.isWordAllowedInSlot(touchDraggedWord, slot);
                        currentHoveredSlot = slot;

                        if (isAllowed) {
                            slot.classList.add("drag-over");
                            slot.classList.remove("drag-invalid");

                            if (!slot.classList.contains("num-slot")) {
                                const variation = slot.getAttribute("data-variation") || "base";
                                const capitalize = slot.getAttribute("data-capitalize");
                                const conjugated = this.engine.getConjugatedKeyword(touchDraggedWord, variation, capitalize);
                                if (ghost) ghost.innerText = conjugated;
                                if (!slot.classList.contains("previewing-drag")) {
                                    slot.classList.add("previewing-drag");
                                    slot.setAttribute("data-prev-text", slot.innerText);
                                }
                                slot.innerText = conjugated;
                            }
                        } else {
                            slot.classList.add("drag-invalid");
                            slot.classList.remove("drag-over");
                            if (slot.classList.contains("previewing-drag")) {
                                slot.classList.remove("previewing-drag");
                                const prev = slot.getAttribute("data-prev-text");
                                if (prev !== null && prev !== undefined) slot.innerText = prev;
                                slot.removeAttribute("data-prev-text");
                            }
                            const def = this.engine.getKeywordDefinition(touchDraggedWord);
                            const baseText = def?.variations?.base || def?.baseWord || touchDraggedWord;
                            if (ghost) ghost.innerText = baseText;
                        }
                    } else {
                        currentHoveredSlot = null;
                        const def = this.engine.getKeywordDefinition(touchDraggedWord);
                        const baseText = def?.variations?.base || def?.baseWord || touchDraggedWord;
                        if (ghost) ghost.innerText = baseText;
                    }

                    if (e.cancelable) e.preventDefault();
                }
            }, { passive: false });

            document.addEventListener("touchend", () => {
                if (!isTouchDragging) return;

                if (ghost) ghost.style.display = "none";
                if (currentHoveredSlot) {
                    currentHoveredSlot.classList.remove("drag-over", "drag-invalid");
                    if (currentHoveredSlot.classList.contains("previewing-drag")) {
                        currentHoveredSlot.classList.remove("previewing-drag");
                        currentHoveredSlot.removeAttribute("data-prev-text");
                    }
                }

                if (touchThresholdPassed) {
                    this.engine.justTouchDragged = true;
                    setTimeout(() => { this.engine.justTouchDragged = false; }, 300);

                    if (currentHoveredSlot && touchDraggedWord) {
                        const isAllowed = this.engine.isWordAllowedInSlot(touchDraggedWord, currentHoveredSlot);
                        if (!isAllowed) {
                            window.sfx?.playError?.() || window.sfx?.playPop?.();
                            const slotTag = currentHoveredSlot.getAttribute("data-tag") || "required category";
                            const def = this.engine.getKeywordDefinition(touchDraggedWord);
                            const display = def?.variations?.base || def?.baseWord || touchDraggedWord;
                            this.engine.showToast(`⚠️ Category mismatch: "${display}" is not a ${slotTag} keyword`, "warning");
                            isTouchDragging = false;
                            touchDraggedWord = null;
                            touchSourceSlotId = null;
                            currentHoveredSlot = null;
                            touchThresholdPassed = false;
                            return;
                        }

                        const targetSlotId = currentHoveredSlot.getAttribute("data-id");
                        const isTargetNum = currentHoveredSlot.classList.contains("num-slot");

                        const existingTargetWord = isTargetNum
                            ? currentHoveredSlot.value.trim()
                            : (this.engine.docketSlots[targetSlotId] || "");

                        if (isTargetNum) {
                            const digits = touchDraggedWord.replace(/[^0-9]/g, "");
                            if (digits.length > 0) {
                                const maxLen = parseInt(currentHoveredSlot.getAttribute("maxlength") || "4", 10);
                                currentHoveredSlot.value = digits.slice(0, maxLen);
                                currentHoveredSlot.classList.add("filled");
                                currentHoveredSlot.classList.remove("wrong", "correct");
                                this.engine.docketSlots[targetSlotId] = currentHoveredSlot.value;
                            }
                        } else {
                            const def = this.engine.getKeywordDefinition(touchDraggedWord);
                            const canonVal = def ? def.id : touchDraggedWord;
                            this.engine.docketSlots[targetSlotId] = canonVal;
                            this.engine.updateSlotAppearance(currentHoveredSlot, canonVal);
                        }

                        // Auto-collect keyword when placed into a valid slot
                        this.engine.collectWord(null, touchDraggedWord);

                        if (touchSourceSlotId && touchSourceSlotId !== targetSlotId) {
                            const sourceEl = document.querySelector(`[data-id="${touchSourceSlotId}"]`);
                            if (sourceEl && !sourceEl.classList.contains("num-slot")) {
                                if (existingTargetWord && this.engine.isWordAllowedInSlot(existingTargetWord, sourceEl)) {
                                    const exDef = this.engine.getKeywordDefinition(existingTargetWord);
                                    const exCanonVal = exDef ? exDef.id : existingTargetWord;
                                    this.engine.docketSlots[touchSourceSlotId] = exCanonVal;
                                    this.engine.updateSlotAppearance(sourceEl, exCanonVal);
                                } else {
                                    delete this.engine.docketSlots[touchSourceSlotId];
                                    this.engine.updateSlotAppearance(sourceEl, null);
                                }
                            }
                        }
                        window.sfx?.playSnap();
                        this.engine.updateProgress();
                        this.engine.saveProgress();
                    } else if (touchSourceSlotId) {
                        this.clearSlot(touchSourceSlotId);
                    }
                }

                isTouchDragging = false;
                touchDraggedWord = null;
                touchSourceSlotId = null;
                currentHoveredSlot = null;
                touchThresholdPassed = false;
            });
        }
    }

    global.LogosDragDrop = LogosDragDrop;
})(typeof window !== 'undefined' ? window : globalThis);
