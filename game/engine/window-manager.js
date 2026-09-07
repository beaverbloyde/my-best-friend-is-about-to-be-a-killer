/**
 * LOGOS-3 GAME WINDOW MANAGER
 * Dragging, Resizing, Stacking/Z-Index management, Maximize/Restore, and Dimension Persistence.
 */
(function (global) {
    'use strict';

    let highestZIndex = 1000;

    const LogosWindowManager = {
        getHighestZIndex() {
            return highestZIndex;
        },

        bringToFront(el) {
            if (!el) return;
            highestZIndex += 2;
            el.style.zIndex = highestZIndex;
        },

        makeWindowDraggable(modal, header) {
            if (!modal || !header) return;

            modal.addEventListener("mousedown", () => this.bringToFront(modal));
            modal.addEventListener("touchstart", () => this.bringToFront(modal), { passive: true });

            let isDragging = false;
            let startX, startY, initialLeft, initialTop;

            const startDrag = (clientX, clientY, target) => {
                if (window.innerWidth <= 900) return;
                if (target.tagName === "BUTTON" || target.closest("button") || target.tagName === "INPUT") return;
                this.bringToFront(modal);
                isDragging = true;
                startX = clientX;
                startY = clientY;
                const rect = modal.getBoundingClientRect();
                initialLeft = rect.left;
                initialTop = rect.top;
                modal.style.left = `${initialLeft}px`;
                modal.style.top = `${initialTop}px`;
                modal.style.transform = "none";
                document.body.style.userSelect = "none";
            };

            const moveDrag = (clientX, clientY) => {
                if (!isDragging) return;
                const dx = clientX - startX;
                const dy = clientY - startY;
                modal.style.left = `${initialLeft + dx}px`;
                modal.style.top = `${initialTop + dy}px`;
            };

            const endDrag = () => {
                if (isDragging) {
                    isDragging = false;
                    document.body.style.userSelect = "";
                }
            };

            header.addEventListener("mousedown", (e) => startDrag(e.clientX, e.clientY, e.target));
            document.addEventListener("mousemove", (e) => moveDrag(e.clientX, e.clientY));
            document.addEventListener("mouseup", endDrag);

            header.addEventListener("touchstart", (e) => {
                if (e.touches.length === 1) startDrag(e.touches[0].clientX, e.touches[0].clientY, e.target);
            }, { passive: true });
            document.addEventListener("touchmove", (e) => {
                if (isDragging && e.touches.length === 1) moveDrag(e.touches[0].clientX, e.touches[0].clientY);
            }, { passive: true });
            document.addEventListener("touchend", endDrag);
        },

        makeWindowResizable(modal, handle, storageKeyPrefix = "docket", minWidth = 380, minHeight = 260) {
            if (!modal || !handle) return;

            let isResizing = false;
            let startX, startY, startWidth, startHeight;

            const startResize = (clientX, clientY) => {
                if (window.innerWidth <= 900) return;
                this.bringToFront(modal);
                isResizing = true;
                startX = clientX;
                startY = clientY;
                const rect = modal.getBoundingClientRect();
                startWidth = rect.width;
                startHeight = rect.height;
                modal.style.left = `${rect.left}px`;
                modal.style.top = `${rect.top}px`;
                modal.style.transform = "none";
                document.body.style.userSelect = "none";
                modal.classList.remove("expanded");
                const expandBtn = modal.querySelector(".window-expand-btn, #docket-expand-btn");
                if (expandBtn) {
                    expandBtn.innerText = "⤢";
                    expandBtn.title = "Maximize";
                }
            };

            const moveResize = (clientX, clientY) => {
                if (!isResizing) return;
                const newWidth = Math.max(minWidth, Math.min(window.innerWidth * 0.98, startWidth + (clientX - startX)));
                const newHeight = Math.max(minHeight, Math.min(window.innerHeight * 0.96, startHeight + (clientY - startY)));
                modal.style.width = `${newWidth}px`;
                modal.style.height = `${newHeight}px`;
            };

            const endResize = () => {
                if (isResizing) {
                    isResizing = false;
                    document.body.style.userSelect = "";
                    const rect = modal.getBoundingClientRect();
                    localStorage.setItem(`${storageKeyPrefix}_width`, Math.round(rect.width));
                    localStorage.setItem(`${storageKeyPrefix}_height`, Math.round(rect.height));
                }
            };

            handle.addEventListener("mousedown", (e) => {
                e.stopPropagation();
                startResize(e.clientX, e.clientY);
            });
            document.addEventListener("mousemove", (e) => moveResize(e.clientX, e.clientY));
            document.addEventListener("mouseup", endResize);

            handle.addEventListener("touchstart", (e) => {
                if (e.touches.length === 1) {
                    e.stopPropagation();
                    startResize(e.touches[0].clientX, e.touches[0].clientY);
                }
            }, { passive: true });
            document.addEventListener("touchmove", (e) => {
                if (isResizing && e.touches.length === 1) {
                    moveResize(e.touches[0].clientX, e.touches[0].clientY);
                }
            }, { passive: true });
            document.addEventListener("touchend", endResize);
        },

        toggleWindowExpand(modal, btn, storageKeyPrefix = "window", defaultWidth = null, defaultHeight = null) {
            if (!modal) return;
            const isExpanded = modal.classList.toggle("expanded");
            if (btn) {
                btn.innerText = isExpanded ? "⤦" : "⤢";
                btn.title = isExpanded ? "Restore Previous Size" : "Maximize";
            }
            if (!isExpanded) {
                const savedW = localStorage.getItem(`${storageKeyPrefix}_width`);
                const savedH = localStorage.getItem(`${storageKeyPrefix}_height`);
                if (savedW && parseInt(savedW, 10) >= 360) {
                    modal.style.width = `${Math.min(parseInt(savedW, 10), window.innerWidth * 0.98)}px`;
                } else if (defaultWidth) {
                    modal.style.width = `${defaultWidth}px`;
                } else {
                    modal.style.width = "";
                }

                if (savedH && parseInt(savedH, 10) >= 240) {
                    modal.style.height = `${Math.min(parseInt(savedH, 10), window.innerHeight * 0.96)}px`;
                } else if (defaultHeight) {
                    modal.style.height = `${defaultHeight}px`;
                } else {
                    modal.style.height = "";
                }
            }
            window.sfx?.playClick();
        },

        restoreWindowSize(modal, storageKeyPrefix, defaultW = null, defaultH = null) {
            if (window.innerWidth <= 900 || !modal) return;
            const savedW = localStorage.getItem(`${storageKeyPrefix}_width`);
            const savedH = localStorage.getItem(`${storageKeyPrefix}_height`);
            if (savedW && parseInt(savedW, 10) >= 360) {
                modal.style.width = `${Math.min(parseInt(savedW, 10), window.innerWidth * 0.98)}px`;
            } else if (defaultW) {
                modal.style.width = `${defaultW}px`;
            } else {
                modal.style.width = "";
            }
            if (savedH && parseInt(savedH, 10) >= 240) {
                modal.style.height = `${Math.min(parseInt(savedH, 10), window.innerHeight * 0.96)}px`;
            } else if (defaultH) {
                modal.style.height = `${defaultH}px`;
            } else {
                modal.style.height = "";
            }
        }
    };

    global.LogosWindowManager = LogosWindowManager;
})(typeof window !== 'undefined' ? window : globalThis);
