/**
 * LOGOS-3 GAME DRAG & DROP ENGINE
 * HTML5 Desktop slot swapping & mobile touch drag-and-drop with floating ghost element.
 */
(function (global) {
    'use strict';

    class LogosDragDrop {
        constructor(engine) {
            this.engine = engine;
            this.draggedSourceSlotId = null;
            this.initDesktopDragAndDrop();
            this.initTouchDragAndDrop();
        }

        initDesktopDragAndDrop() {
            const slots = document.querySelectorAll(".slot, .num-slot");
            slots.forEach(slot => {
                slot.setAttribute("draggable", "true");

                slot.addEventListener("dragstart", (e) => {
                    const slotId = slot.getAttribute("data-id");
                    let currentWord = "";
                    if (slot.classList.contains("num-slot")) {
                        currentWord = slot.value.trim();
                    } else {
                        currentWord = slot.innerText.trim();
                        if (currentWord === "[ ? ]") currentWord = "";
                    }

                    if (currentWord) {
                        this.draggedSourceSlotId = slotId;
                        e.dataTransfer.setData("text/plain", currentWord);
                        e.dataTransfer.setData("application/x-docket-slot", slotId);
                    } else {
                        e.preventDefault();
                    }
                });

                slot.addEventListener("dragover", (e) => {
                    e.preventDefault();
                    slot.classList.add("drag-over");
                });

                slot.addEventListener("dragleave", () => {
                    slot.classList.remove("drag-over");
                });

                slot.addEventListener("drop", (e) => {
                    e.preventDefault();
                    slot.classList.remove("drag-over");

                    const incomingWord = e.dataTransfer.getData("text/plain");
                    if (!incomingWord) return;

                    const targetSlotId = slot.getAttribute("data-id");
                    const sourceSlotId = this.draggedSourceSlotId || e.dataTransfer.getData("application/x-docket-slot");

                    let existingTargetWord = "";
                    if (slot.classList.contains("num-slot")) {
                        existingTargetWord = slot.value.trim();
                    } else {
                        existingTargetWord = slot.innerText.trim();
                        if (existingTargetWord === "[ ? ]") existingTargetWord = "";
                    }

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
                        this.engine.docketSlots[targetSlotId] = incomingWord;
                        this.engine.updateSlotAppearance(slot, incomingWord);
                    }

                    if (sourceEl && sourceSlotId !== targetSlotId) {
                        if (existingTargetWord) {
                            if (sourceEl.classList.contains("num-slot")) {
                                const digits = existingTargetWord.replace(/[^0-9]/g, "");
                                if (digits.length > 0) {
                                    const maxLen = parseInt(sourceEl.getAttribute("maxlength") || "4", 10);
                                    sourceEl.value = digits.slice(0, maxLen);
                                    sourceEl.classList.add("filled");
                                    sourceEl.classList.remove("wrong", "correct");
                                    this.engine.docketSlots[sourceSlotId] = sourceEl.value;
                                } else {
                                    sourceEl.value = "";
                                    sourceEl.classList.remove("filled", "wrong", "correct");
                                    delete this.engine.docketSlots[sourceSlotId];
                                }
                            } else {
                                this.engine.docketSlots[sourceSlotId] = existingTargetWord;
                                this.engine.updateSlotAppearance(sourceEl, existingTargetWord);
                            }
                        } else {
                            if (sourceEl.classList.contains("num-slot")) {
                                sourceEl.value = "";
                                sourceEl.classList.remove("filled", "wrong", "correct");
                            } else {
                                this.engine.updateSlotAppearance(sourceEl, null);
                            }
                            delete this.engine.docketSlots[sourceSlotId];
                        }
                    }

                    this.draggedSourceSlotId = null;
                    window.sfx?.playSnap();
                    this.engine.updateProgress();
                    this.engine.saveProgress();
                });
            });
        }

        initTouchDragAndDrop() {
            const ghost = document.getElementById("touch-drag-ghost");
            let touchDraggedWord = null;
            let touchSourceSlotId = null;
            let isTouchDragging = false;
            let currentHoveredSlot = null;
            let startX = 0, startY = 0;
            let touchThresholdPassed = false;

            document.addEventListener("touchstart", (e) => {
                const touch = e.touches[0];
                const target = e.target.closest(".kw, .tray-word, .slot, .num-slot");
                if (!target) return;

                let word = "";
                let sourceSlotId = null;

                if (target.classList.contains("slot")) {
                    word = target.innerText.trim();
                    sourceSlotId = target.getAttribute("data-id");
                    if (word === "[ ? ]") word = "";
                } else if (target.classList.contains("num-slot")) {
                    word = target.value.trim();
                    sourceSlotId = target.getAttribute("data-id");
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
                        currentHoveredSlot.classList.remove("drag-over");
                    }

                    if (slot) {
                        slot.classList.add("drag-over");
                        currentHoveredSlot = slot;
                    } else {
                        currentHoveredSlot = null;
                    }

                    if (e.cancelable) e.preventDefault();
                }
            }, { passive: false });

            document.addEventListener("touchend", () => {
                if (!isTouchDragging) return;

                if (ghost) ghost.style.display = "none";
                if (currentHoveredSlot) currentHoveredSlot.classList.remove("drag-over");

                if (touchThresholdPassed) {
                    this.engine.justTouchDragged = true;
                    setTimeout(() => { this.engine.justTouchDragged = false; }, 100);

                    if (currentHoveredSlot && touchDraggedWord) {
                        const targetSlotId = currentHoveredSlot.getAttribute("data-id");
                        const isTargetNum = currentHoveredSlot.classList.contains("num-slot");

                        let existingTargetWord = "";
                        if (isTargetNum) {
                            existingTargetWord = currentHoveredSlot.value.trim();
                        } else {
                            existingTargetWord = currentHoveredSlot.innerText.trim();
                            if (existingTargetWord === "[ ? ]") existingTargetWord = "";
                        }

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
                            this.engine.docketSlots[targetSlotId] = touchDraggedWord;
                            this.engine.updateSlotAppearance(currentHoveredSlot, touchDraggedWord);
                        }

                        if (touchSourceSlotId && touchSourceSlotId !== targetSlotId) {
                            const sourceEl = document.querySelector(`[data-id="${touchSourceSlotId}"]`);
                            if (sourceEl) {
                                const isSourceNum = sourceEl.classList.contains("num-slot");
                                if (existingTargetWord) {
                                    if (isSourceNum) {
                                        const digits = existingTargetWord.replace(/[^0-9]/g, "");
                                        if (digits.length > 0) {
                                            const maxLen = parseInt(sourceEl.getAttribute("maxlength") || "4", 10);
                                            sourceEl.value = digits.slice(0, maxLen);
                                            sourceEl.classList.add("filled");
                                            sourceEl.classList.remove("wrong", "correct");
                                            this.engine.docketSlots[touchSourceSlotId] = sourceEl.value;
                                        } else {
                                            sourceEl.value = "";
                                            sourceEl.classList.remove("filled", "wrong", "correct");
                                            delete this.engine.docketSlots[touchSourceSlotId];
                                        }
                                    } else {
                                        this.engine.docketSlots[touchSourceSlotId] = existingTargetWord;
                                        this.engine.updateSlotAppearance(sourceEl, existingTargetWord);
                                    }
                                } else {
                                    if (isSourceNum) {
                                        sourceEl.value = "";
                                        sourceEl.classList.remove("filled", "wrong", "correct");
                                    } else {
                                        this.engine.updateSlotAppearance(sourceEl, null);
                                    }
                                    delete this.engine.docketSlots[touchSourceSlotId];
                                }
                            }
                        }
                        window.sfx?.playSnap();
                        this.engine.updateProgress();
                        this.engine.saveProgress();
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
