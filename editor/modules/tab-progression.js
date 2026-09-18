/**
 * LOGOS-3 CASE AUTHORING TERMINAL - TAB 2: STORY & PROGRESSION GRAPH
 */
(function (global) {
    'use strict';

    const CaseEditorProgression = {
        computeBezierPath(x1, y1, x2, y2) {
            const isForward = x2 >= x1;
            if (isForward) {
                const dx = Math.max(40, (x2 - x1) * 0.5);
                return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
            } else {
                const backDx = Math.max(50, Math.abs(x1 - x2) * 0.5);
                return `M ${x1} ${y1} C ${x1 + backDx} ${y1}, ${x2 - backDx} ${y2}, ${x2} ${y2}`;
            }
        },

        renderProgressionTab(container) {
            const rules = this.progressionData.rules || [];
            const currentCaseId = (this.caseData.id || "").replace(/^cases\//, '').replace(/\.json$/, '');

            if (!this.canvasState) {
                this.canvasState = { panX: 40, panY: 40, zoom: 1.0, isPanning: false, startX: 0, startY: 0, expanded: false, activeFilter: 'all', customPositions: {} };
            }
            if (!this.canvasState.customPositions) this.canvasState.customPositions = {};

            // 1. Build Dynamic DAG Nodes & Bezier Connections
            const nodeMap = new Map();
            const incomingEdges = new Map();
            const outgoingEdges = new Map();

            const ensureNode = (id, type, title) => {
                if (!id) return null;
                const cleanId = id.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                if (cleanId === 'case_template') return null;
                if (!nodeMap.has(cleanId)) {
                    nodeMap.set(cleanId, {
                        id: cleanId,
                        fullId: id,
                        type: type,
                        title: title || cleanId,
                        level: 0,
                        x: 0,
                        y: 0
                    });
                    incomingEdges.set(cleanId, new Set());
                    outgoingEdges.set(cleanId, new Set());
                } else {
                    const n = nodeMap.get(cleanId);
                    if (title && (!n.title || n.title === cleanId)) n.title = title;
                }
                return cleanId;
            };

            // Add custom/orphan nodes created by user
            if (this.progressionData.customNodes) {
                this.progressionData.customNodes.forEach(cn => {
                    ensureNode(cn.id, cn.type, cn.title);
                });
            }

            // Add standard/known cases into graph (excluding templates)
            (this.availableCases || []).forEach(c => {
                if (c.id === 'case_template' || c.path === 'cases/case_template.json') return;
                ensureNode(c.id, 'case', c.title);
            });

            // Add progression rules connections
            rules.forEach(r => {
                let fromId = null;
                let toId = null;

                if (r.requires && r.requires.id) {
                    const isChap = r.requires.type === 'chapter' || r.requires.id.endsWith('.nwd');
                    fromId = ensureNode(r.requires.id, isChap ? 'chapter' : 'case', r.requires.title);
                }
                if (r.target) {
                    const isChap = r.targetType === 'chapter' || r.target.endsWith('.nwd');
                    toId = ensureNode(r.target, isChap ? 'chapter' : 'case', r.targetTitle);
                }

                if (fromId && toId && fromId !== toId) {
                    incomingEdges.get(toId).add(fromId);
                    outgoingEdges.get(fromId).add(toId);
                }
            });

            // Calculate Topological Column Levels (DAG depth)
            const allNodes = Array.from(nodeMap.values());
            const roots = allNodes.filter(n => incomingEdges.get(n.id).size === 0);
            if (roots.length === 0 && allNodes.length > 0) roots.push(allNodes[0]);

            const queue = roots.map(r => ({ id: r.id, level: 0 }));
            const visitedLevels = new Map();
            roots.forEach(r => visitedLevels.set(r.id, 0));

            while (queue.length > 0) {
                const { id, level } = queue.shift();
                const node = nodeMap.get(id);
                if (node) {
                    node.level = Math.max(node.level, level);
                }
                const nextNodes = outgoingEdges.get(id) || new Set();
                nextNodes.forEach(nextId => {
                    const nextLevel = level + 1;
                    if (!visitedLevels.has(nextId) || visitedLevels.get(nextId) < nextLevel) {
                        visitedLevels.set(nextId, nextLevel);
                        queue.push({ id: nextId, level: nextLevel });
                    }
                });
            }

            // Assign 2D positions based on custom positions or auto-DAG layout
            const levelBuckets = new Map();
            allNodes.forEach(n => {
                if (!levelBuckets.has(n.level)) levelBuckets.set(n.level, []);
                levelBuckets.get(n.level).push(n);
            });

            const nodeW = 210;
            const nodeH = 70;
            const colGap = 120;
            const rowGap = 32;

            levelBuckets.forEach((bucket, lvl) => {
                bucket.forEach((n, idx) => {
                    if (this.canvasState.customPositions && this.canvasState.customPositions[n.id]) {
                        n.x = this.canvasState.customPositions[n.id].x;
                        n.y = this.canvasState.customPositions[n.id].y;
                    } else {
                        n.x = 60 + lvl * (nodeW + colGap);
                        n.y = 50 + idx * (nodeH + rowGap);
                    }
                });
            });

            // Render Node HTML
            let nodesHtml = "";
            allNodes.forEach(n => {
                const isActiveCase = (n.type === "case" && (n.id === currentCaseId || currentCaseId.includes(n.id)));
                const nodeClass = n.type === "case" ? "node-case" : "node-chapter";
                const activeClass = isActiveCase ? "active-case-node" : "";

                nodesHtml += `
                    <div class="canvas-node-card ${nodeClass} ${activeClass}" 
                         id="node-${n.id}"
                         data-node-id="${n.id}"
                         data-node-type="${n.type}"
                         data-node-title="${n.title.replace(/"/g, '&quot;')}"
                         style="left: ${n.x}px; top: ${n.y}px;">
                        <div class="canvas-node-port-in" data-port-type="in" data-node-id="${n.id}" title="Input Port (Drag prerequisite wire here)"></div>
                        <div class="canvas-node-header">
                            <span class="canvas-node-tag">${n.type === 'case' ? '🎮 CASE' : '📖 NOVEL CHAPTER'}</span>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                ${isActiveCase ? '<span style="font-size: 8px; background: var(--accent); color: #000; font-weight: 800; padding: 1px 4px; border-radius: 2px;">ACTIVE</span>' : ''}
                                <span class="canvas-node-delete-btn" onclick="event.stopPropagation(); window.caseEditor.deleteProgressionNode('${n.id}')" title="Delete card from graph">✕</span>
                            </div>
                        </div>
                        <div class="canvas-node-title" title="${n.title.replace(/"/g, '&quot;')}">${n.title}</div>
                        <div class="canvas-node-sub">${n.id}</div>
                        <div class="canvas-node-port-out" data-port-type="out" data-node-id="${n.id}" title="Output Port (Drag wire to next card or empty space)"></div>
                    </div>
                `;
            });

            // Render SVG Bezier Connections with Clickable Hitbox Groups
            let wiresHtml = "";
            rules.forEach((r, ruleIdx) => {
                if (r.requires?.id && r.target) {
                    const fromClean = r.requires.id.replace(/^cases\//, '').replace(/\.json$/, '');
                    const toClean = r.target.replace(/^cases\//, '').replace(/\.json$/, '');
                    const fromNode = nodeMap.get(fromClean);
                    const toNode = nodeMap.get(toClean);

                    if (fromNode && toNode) {
                        const x1 = fromNode.x + nodeW;
                        const y1 = fromNode.y + nodeH / 2;
                        const x2 = toNode.x;
                        const y2 = toNode.y + nodeH / 2;
                        const d = this.computeBezierPath(x1, y1, x2, y2);
                        const isActiveWire = (fromNode.id === currentCaseId || toNode.id === currentCaseId);
                        const wireTypeClass = fromNode.type === 'case' ? 'wire-from-case' : 'wire-from-chapter';
                        wiresHtml += `
                            <g class="canvas-wire-group" data-rule-idx="${ruleIdx}">
                                <path d="${d}" class="canvas-wire-hitbox" data-rule-idx="${ruleIdx}" />
                                <path d="${d}" class="canvas-wire ${wireTypeClass} ${isActiveWire ? 'active-wire' : ''}" data-rule-idx="${ruleIdx}" />
                            </g>
                        `;
                    }
                }
            });

            const isExpanded = this.canvasState.expanded;
            const detectedCycles = this.detectProgressionCycles();
            const cycleAlertHtml = detectedCycles.length > 0
                ? `<div class="canvas-cycle-alert" style="background: rgba(255, 69, 58, 0.15); border: 1px solid var(--danger); color: var(--danger); padding: 8px 12px; border-radius: 4px; margin-top: 8px; font-size: 12px; display: flex; align-items: center; gap: 8px;">
                    <span>⚠️ <strong>CIRCULAR DEPENDENCY DETECTED:</strong> ${detectedCycles.map(c => c.join(' ➔ ')).join(' | ')}. Story branches with circular loops will deadlock gameplay!</span>
                   </div>`
                : '';

            container.innerHTML = `
                <div class="form-section" style="margin-bottom: 0;">
                    <div class="form-section-title">
                        <span>🗺️ Interactive Story & Case Progression Graph</span>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-sm btn-primary" onclick="window.caseEditor.saveProgressionToFile()" title="Save directly into game/cases/progression.json">💾 Save File</button>
                            <button class="btn btn-sm" onclick="window.caseEditor.copyProgressionJSON()">📋 Copy JSON</button>
                            <button class="btn btn-sm" onclick="window.caseEditor.exportProgressionJSON()">⤓ Export JSON</button>
                        </div>
                    </div>
                    <div class="form-help">
                        <strong>Controls:</strong> Drag background to pan. Mouse wheel to zoom. <strong>Drag cards</strong> to reposition. <strong>Drag from ● output port to ● input port</strong> to connect rules, or <strong>drag wire to empty space</strong> to create & link a new card. Click wire to delete.
                    </div>
                    ${cycleAlertHtml}

                    <!-- Interactive Node Graph Canvas -->
                    <div class="progression-canvas-wrapper ${isExpanded ? 'canvas-expanded' : ''}" id="progression-canvas-wrapper">
                        <!-- Floating HUD Toolbar -->
                        <div class="canvas-hud-toolbar">
                            <!-- Card Search Box -->
                            <div class="canvas-search-wrap">
                                <input type="text" id="canvas-card-search" class="canvas-search-input" placeholder="🔍 Find card..." value="${this.canvasCardSearchQuery || ''}" oninput="window.caseEditor.filterCanvasCards(this.value)" onkeydown="window.caseEditor.onCanvasSearchKey(event)" title="Find cards by title or ID (Press Enter / Shift+Enter to navigate)" />
                                <span id="canvas-search-count" class="canvas-search-count"></span>
                                <button class="canvas-hud-btn" style="padding: 2px 4px; font-size: 9px;" onclick="window.caseEditor.canvasSearchPrev()" title="Previous Match (Shift+Enter)">▲</button>
                                <button class="canvas-hud-btn" style="padding: 2px 4px; font-size: 9px;" onclick="window.caseEditor.canvasSearchNext()" title="Next Match (Enter)">▼</button>
                            </div>
                            <button class="canvas-hud-btn" style="color: var(--accent); font-weight: 700;" onclick="window.caseEditor.openAddNodeModal()" title="Add a new Case or Chapter node card to the canvas">+ Card</button>
                            <button class="canvas-hud-btn" onclick="window.caseEditor.canvasZoomOut()" title="Zoom Out">-</button>
                            <span class="canvas-hud-zoom-label" id="canvas-zoom-val">${Math.round(this.canvasState.zoom * 100)}%</span>
                            <button class="canvas-hud-btn" onclick="window.caseEditor.canvasZoomIn()" title="Zoom In">+</button>
                            <button class="canvas-hud-btn" onclick="window.caseEditor.canvasResetZoom()" title="Reset to 100%">1:1</button>
                            <button class="canvas-hud-btn" onclick="window.caseEditor.canvasFitView()" title="Fit all nodes to view">⛶ Fit</button>
                            <button class="canvas-hud-btn" onclick="window.caseEditor.canvasFocusActive()" title="Focus active case node">🎯 Focus</button>
                            <button class="canvas-hud-btn" onclick="window.caseEditor.resetCanvasAutoLayout()" title="Reset layout to clean tree">⟳ Auto-Arrange</button>
                            <button class="canvas-hud-btn" onclick="window.caseEditor.toggleCanvasExpand()" title="Toggle canvas height">${isExpanded ? 'Collapse ⤓' : 'Expand ⤒'}</button>
                        </div>

                        <!-- Mini Legend -->
                        <div class="canvas-mini-legend">
                            <span><strong style="color: var(--accent);">🎮 Amber</strong> = Deduction Case</span>
                            <span><strong style="color: var(--success);">📖 Green</strong> = Novel Chapter</span>
                            <span><strong style="color: #fff; background: var(--accent); padding: 0 4px; border-radius: 2px; color: #000;">Active</strong> = Current Case</span>
                        </div>

                        <!-- Viewport Layer (Panned & Scaled) -->
                        <div class="progression-canvas-viewport" id="progression-canvas-viewport" style="transform: translate(${this.canvasState.panX}px, ${this.canvasState.panY}px) scale(${this.canvasState.zoom});">
                            <svg class="progression-canvas-svg" id="progression-canvas-svg">
                                ${wiresHtml}
                                <path id="canvas-temp-wire" class="canvas-wire temp-wire" style="display: none;" />
                            </svg>
                            <div class="progression-canvas-nodes" id="progression-canvas-nodes">
                                ${nodesHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.setupCanvasPanAndZoom(nodeMap, currentCaseId);
        },

        setupCanvasPanAndZoom(nodeMap, currentCaseId) {
            const wrapper = document.getElementById("progression-canvas-wrapper");
            const viewport = document.getElementById("progression-canvas-viewport");
            const svg = document.getElementById("progression-canvas-svg");
            const tempWire = document.getElementById("canvas-temp-wire");
            const zoomLabel = document.getElementById("canvas-zoom-val");
            if (!wrapper || !viewport) return;

            const nodeW = 210;
            const nodeH = 70;

            const updateTransform = () => {
                viewport.style.transform = `translate(${this.canvasState.panX}px, ${this.canvasState.panY}px) scale(${this.canvasState.zoom})`;
                if (zoomLabel) zoomLabel.innerText = `${Math.round(this.canvasState.zoom * 100)}%`;
            };

            const redrawWires = () => {
                if (!svg) return;
                const rules = this.progressionData.rules || [];
                let html = "";
                rules.forEach((r, ruleIdx) => {
                    if (r.requires?.id && r.target) {
                        const fromClean = r.requires.id.replace(/^cases\//, '').replace(/\.json$/, '');
                        const toClean = r.target.replace(/^cases\//, '').replace(/\.json$/, '');
                        const fromNode = nodeMap.get(fromClean);
                        const toNode = nodeMap.get(toClean);

                        if (fromNode && toNode) {
                            const x1 = fromNode.x + nodeW;
                            const y1 = fromNode.y + nodeH / 2;
                            const x2 = toNode.x;
                            const y2 = toNode.y + nodeH / 2;
                            const d = this.computeBezierPath(x1, y1, x2, y2);
                            const isActiveWire = (fromNode.id === currentCaseId || toNode.id === currentCaseId);
                            const wireTypeClass = fromNode.type === 'case' ? 'wire-from-case' : 'wire-from-chapter';
                            html += `
                                <g class="canvas-wire-group" data-rule-idx="${ruleIdx}">
                                    <path d="${d}" class="canvas-wire-hitbox" data-rule-idx="${ruleIdx}" />
                                    <path d="${d}" class="canvas-wire ${wireTypeClass} ${isActiveWire ? 'active-wire' : ''}" data-rule-idx="${ruleIdx}" />
                                </g>
                            `;
                        }
                    }
                });
                if (tempWire) {
                    html += tempWire.outerHTML;
                }
                svg.innerHTML = html;
            };

            let dragInfo = null;

            // 1-Click Wire Deletion Listener
            wrapper.onclick = (e) => {
                const wire = e.target.closest('.canvas-wire, .canvas-wire-hitbox, .canvas-wire-group');
                if (wire) {
                    e.stopPropagation();
                    const idx = parseInt(wire.dataset.ruleIdx, 10);
                    if (!isNaN(idx)) {
                        this.deleteProgressionWireByIndex(idx);
                    }
                }
            };

            wrapper.onmousedown = (e) => {
                const wire = e.target.closest('.canvas-wire, .canvas-wire-hitbox, .canvas-wire-group');
                const deleteBtn = e.target.closest('.canvas-node-delete-btn');
                const portOut = e.target.closest('.canvas-node-port-out');
                const portIn = e.target.closest('.canvas-node-port-in');
                const nodeCard = e.target.closest('.canvas-node-card');
                const hud = e.target.closest('.canvas-hud-toolbar');

                if (hud || deleteBtn || wire) return;

                // 1. Dragging from Output Port
                if (portOut) {
                    e.stopPropagation();
                    const fromId = portOut.dataset.nodeId;
                    const fromNode = nodeMap.get(fromId);
                    if (!fromNode) return;
                    const startX = fromNode.x + nodeW;
                    const startY = fromNode.y + nodeH / 2;

                    dragInfo = {
                        type: 'wire',
                        dir: 'forward',
                        nodeId: fromId,
                        nodeObj: fromNode,
                        startX: startX,
                        startY: startY
                    };
                    if (tempWire) {
                        tempWire.style.display = 'block';
                        tempWire.setAttribute('d', `M ${startX} ${startY} C ${startX + 30} ${startY}, ${startX + 30} ${startY}, ${startX} ${startY}`);
                    }
                    return;
                }

                // 2. Dragging from Input Port
                if (portIn) {
                    e.stopPropagation();
                    const toId = portIn.dataset.nodeId;
                    const toNode = nodeMap.get(toId);
                    if (!toNode) return;
                    const startX = toNode.x;
                    const startY = toNode.y + nodeH / 2;

                    dragInfo = {
                        type: 'wire',
                        dir: 'backward',
                        nodeId: toId,
                        nodeObj: toNode,
                        startX: startX,
                        startY: startY
                    };
                    if (tempWire) {
                        tempWire.style.display = 'block';
                        tempWire.setAttribute('d', `M ${startX} ${startY} C ${startX - 30} ${startY}, ${startX - 30} ${startY}, ${startX} ${startY}`);
                    }
                    return;
                }

                // 3. Dragging Node Card
                if (nodeCard) {
                    const nodeId = nodeCard.dataset.nodeId;
                    const nodeObj = nodeMap.get(nodeId);
                    if (!nodeObj) return;

                    nodeCard.classList.add('is-dragging');

                    dragInfo = {
                        type: 'node',
                        nodeId: nodeId,
                        nodeObj: nodeObj,
                        nodeEl: nodeCard,
                        mouseStartX: e.clientX,
                        mouseStartY: e.clientY,
                        startNodeX: nodeObj.x,
                        startNodeY: nodeObj.y,
                        moved: false
                    };
                    return;
                }

                // 4. Dragging Canvas Background to Pan
                this.canvasState.isPanning = true;
                this.canvasState.startX = e.clientX - this.canvasState.panX;
                this.canvasState.startY = e.clientY - this.canvasState.panY;
                wrapper.style.cursor = 'grabbing';
            };

            window.addEventListener('mousemove', (e) => {
                const zoom = this.canvasState.zoom || 1.0;

                // Wire creation dragging
                if (dragInfo && dragInfo.type === 'wire') {
                    const rect = wrapper.getBoundingClientRect();
                    const mouseCanvasX = (e.clientX - rect.left - this.canvasState.panX) / zoom;
                    const mouseCanvasY = (e.clientY - rect.top - this.canvasState.panY) / zoom;

                    let d = "";
                    if (dragInfo.dir === 'forward') {
                        d = this.computeBezierPath(dragInfo.startX, dragInfo.startY, mouseCanvasX, mouseCanvasY);
                    } else {
                        d = this.computeBezierPath(mouseCanvasX, mouseCanvasY, dragInfo.startX, dragInfo.startY);
                    }

                    const curTempWire = document.getElementById("canvas-temp-wire");
                    if (curTempWire) {
                        curTempWire.style.display = 'block';
                        curTempWire.setAttribute('d', d);
                    }
                    return;
                }

                // Node card dragging
                if (dragInfo && dragInfo.type === 'node') {
                    const dx = (e.clientX - dragInfo.mouseStartX) / zoom;
                    const dy = (e.clientY - dragInfo.mouseStartY) / zoom;
                    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                        dragInfo.moved = true;
                    }

                    const newX = dragInfo.startNodeX + dx;
                    const newY = dragInfo.startNodeY + dy;

                    dragInfo.nodeObj.x = newX;
                    dragInfo.nodeObj.y = newY;
                    dragInfo.nodeEl.style.left = `${newX}px`;
                    dragInfo.nodeEl.style.top = `${newY}px`;

                    this.canvasState.customPositions[dragInfo.nodeId] = { x: newX, y: newY };
                    redrawWires();
                    return;
                }

                // Canvas background panning
                if (this.canvasState?.isPanning) {
                    this.canvasState.panX = e.clientX - this.canvasState.startX;
                    this.canvasState.panY = e.clientY - this.canvasState.startY;
                    updateTransform();
                }
            });

            window.addEventListener('mouseup', (e) => {
                // Handle Wire Connection drop
                if (dragInfo && dragInfo.type === 'wire') {
                    const curTempWire = document.getElementById("canvas-temp-wire");
                    if (curTempWire) curTempWire.style.display = 'none';

                    const underCursor = document.elementFromPoint(e.clientX, e.clientY);
                    const targetCardOrPort = underCursor?.closest('.canvas-node-card, .canvas-node-port-in, .canvas-node-port-out');

                    if (targetCardOrPort) {
                        const targetId = targetCardOrPort.dataset.nodeId;
                        const targetNode = nodeMap.get(targetId);

                        if (targetNode && targetNode.id !== dragInfo.nodeId) {
                            let fromNode, toNode;
                            if (dragInfo.dir === 'forward') {
                                fromNode = dragInfo.nodeObj;
                                toNode = targetNode;
                            } else {
                                fromNode = targetNode;
                                toNode = dragInfo.nodeObj;
                            }

                            // Check if rule already exists
                            const exists = (this.progressionData.rules || []).some(r => {
                                const rReq = (r.requires?.id || "").replace(/^cases\//, '').replace(/\.json$/, '');
                                const rTarget = (r.target || "").replace(/^cases\//, '').replace(/\.json$/, '');
                                return rReq === fromNode.id && rTarget === toNode.id;
                            });

                            if (exists) {
                                this.showToast("Connection already exists.");
                            } else if (this.wouldCreateCycle(fromNode.id, toNode.id)) {
                                this.showToast(`⚠️ Blocked: Connecting "${fromNode.title}" ➔ "${toNode.title}" creates a circular dependency!`);
                            } else {
                                if (!this.progressionData.rules) this.progressionData.rules = [];
                                this.progressionData.rules.push({
                                    target: toNode.fullId || toNode.id,
                                    targetType: toNode.type,
                                    targetTitle: toNode.title,
                                    requires: {
                                        type: fromNode.type,
                                        id: fromNode.fullId || fromNode.id,
                                        title: fromNode.title,
                                        teaser: fromNode.type === 'chapter' ? `Read ${fromNode.title} in the Novel Reader to unlock.` : `Solve ${fromNode.title} to unlock.`
                                    }
                                });
                                this.renderProgressionTab(document.getElementById("tab-workspace"));
                                this.updateBadgeCounts();
                                this.showToast(`Connected ${fromNode.title} ➔ ${toNode.title}!`);
                            }
                        }
                    } else {
                        // Dropped on empty canvas space: open Add Node Modal and auto-connect
                        const rect = wrapper.getBoundingClientRect();
                        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
                            const zoom = this.canvasState.zoom || 1.0;
                            const dropCanvasX = Math.round((e.clientX - rect.left - this.canvasState.panX) / zoom);
                            const dropCanvasY = Math.round((e.clientY - rect.top - this.canvasState.panY) / zoom);

                            if (dragInfo.dir === 'forward') {
                                this.openAddNodeModal({
                                    connectFromNode: dragInfo.nodeObj,
                                    spawnX: dropCanvasX,
                                    spawnY: dropCanvasY
                                });
                            } else {
                                this.openAddNodeModal({
                                    connectToNode: dragInfo.nodeObj,
                                    spawnX: dropCanvasX,
                                    spawnY: dropCanvasY
                                });
                            }
                        }
                    }
                    dragInfo = null;
                    return;
                }

                if (dragInfo && dragInfo.type === 'node') {
                    if (dragInfo.nodeEl) {
                        dragInfo.nodeEl.classList.remove('is-dragging');
                    }
                    dragInfo = null;
                    return;
                }

                if (this.canvasState) {
                    this.canvasState.isPanning = false;
                    if (wrapper) wrapper.style.cursor = 'grab';
                }
            });

            wrapper.onwheel = (e) => {
                e.preventDefault();
                const rect = wrapper.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const zoomFactor = e.deltaY < 0 ? 1.12 : 0.88;
                const newZoom = Math.min(2.0, Math.max(0.35, this.canvasState.zoom * zoomFactor));

                this.canvasState.panX = mouseX - (mouseX - this.canvasState.panX) * (newZoom / this.canvasState.zoom);
                this.canvasState.panY = mouseY - (mouseY - this.canvasState.panY) * (newZoom / this.canvasState.zoom);
                this.canvasState.zoom = newZoom;
                updateTransform();
            };

            if (this.canvasCardSearchQuery) {
                setTimeout(() => this.filterCanvasCards(this.canvasCardSearchQuery), 30);
            }
        },

        openAddNodeModal(options = null) {
            this.pendingNodeConnection = options || null;

            const existingModal = document.getElementById("canvas-add-node-modal");
            if (existingModal) existingModal.remove();

            let chapOptions = "";
            (this.availableChapters || []).forEach(chap => {
                chapOptions += `<option value="${chap.path}" data-type="chapter" data-title="${chap.title.replace(/"/g, '&quot;')}">📖 ${chap.title} (${chap.handle})</option>`;
            });

            let caseOptions = "";
            (this.availableCases || []).forEach(c => {
                if (c.id === 'case_template' || c.path === 'cases/case_template.json') return;
                caseOptions += `<option value="${c.id}" data-type="case" data-title="${c.title.replace(/"/g, '&quot;')}">🎮 ${c.title} (${c.id})</option>`;
            });

            let linkBanner = "";
            if (options?.connectFromNode) {
                linkBanner = `
                    <div style="background: rgba(229, 169, 60, 0.12); border: 1px solid rgba(229, 169, 60, 0.4); border-radius: 4px; padding: 6px 10px; font-size: 11px; color: var(--accent); display: flex; align-items: center; gap: 6px;">
                        <span>🔗</span>
                        <span>Will unlock from: <strong>${options.connectFromNode.title}</strong></span>
                    </div>
                `;
            } else if (options?.connectToNode) {
                linkBanner = `
                    <div style="background: rgba(74, 222, 128, 0.12); border: 1px solid rgba(74, 222, 128, 0.4); border-radius: 4px; padding: 6px 10px; font-size: 11px; color: var(--success); display: flex; align-items: center; gap: 6px;">
                        <span>🔗</span>
                        <span>Will unlock target: <strong>${options.connectToNode.title}</strong></span>
                    </div>
                `;
            }

            const modalOverlay = document.createElement("div");
            modalOverlay.id = "canvas-add-node-modal";
            modalOverlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center;";

            modalOverlay.innerHTML = `
                <div style="background: #151921; border: 1px solid var(--accent); border-radius: 8px; width: 460px; max-width: 90vw; padding: 22px; box-shadow: 0 16px 40px rgba(0,0,0,0.8); display: flex; flex-direction: column; gap: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-size: 15px; color: var(--accent); font-weight: 700;">+ Add Card / Node to Graph</h3>
                        <button class="btn btn-sm" onclick="document.getElementById('canvas-add-node-modal').remove()">✕</button>
                    </div>

                    ${linkBanner}
                    
                    <div style="display: flex; gap: 14px;">
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; color: var(--text-main);">
                            <input type="radio" name="node-source-type" value="project" checked onchange="document.getElementById('node-project-section').style.display='block'; document.getElementById('node-custom-section').style.display='none';">
                            From Project Files
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer; color: var(--text-main);">
                            <input type="radio" name="node-source-type" value="custom" onchange="document.getElementById('node-project-section').style.display='none'; document.getElementById('node-custom-section').style.display='block';">
                            Create Custom Node
                        </label>
                    </div>

                    <!-- Project Selection Section -->
                    <div id="node-project-section" style="display: flex; flex-direction: column; gap: 10px;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label" style="font-size: 11px;">Select Existing Chapter or Case:</label>
                            <select id="modal-project-item-select" style="width: 100%; font-size: 12px; padding: 6px 8px;">
                                <optgroup label="📖 Novel Chapters">
                                    ${chapOptions || '<option disabled>No chapters found</option>'}
                                </optgroup>
                                <optgroup label="🎮 Cases">
                                    ${caseOptions || '<option disabled>No cases found</option>'}
                                </optgroup>
                            </select>
                        </div>
                    </div>

                    <!-- Custom Section -->
                    <div id="node-custom-section" style="display: none; flex-direction: column; gap: 10px;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label" style="font-size: 11px;">Node Type:</label>
                            <select id="modal-custom-type" style="width: 100%; font-size: 12px; padding: 6px 8px;">
                                <option value="case">🎮 Deduction Case</option>
                                <option value="chapter">📖 Novel Chapter</option>
                            </select>
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label" style="font-size: 11px;">Display Title:</label>
                            <input type="text" id="modal-custom-title" placeholder="e.g. Case 4: The Abandoned Yard" style="width: 100%; font-size: 12px; padding: 6px 8px;">
                        </div>
                        <div class="form-group" style="margin-bottom: 0;">
                            <label class="form-label" style="font-size: 11px;">Identifier / Path:</label>
                            <input type="text" id="modal-custom-id" placeholder="e.g. chapter_02_abandoned_yard" style="width: 100%; font-size: 12px; padding: 6px 8px;">
                        </div>
                    </div>

                    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px;">
                        <button class="btn btn-sm" onclick="document.getElementById('canvas-add-node-modal').remove()">Cancel</button>
                        <button class="btn btn-sm btn-primary" onclick="window.caseEditor.confirmAddProgressionNode()">+ Add & Connect</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modalOverlay);
        },

        confirmAddProgressionNode() {
            const isCustom = document.querySelector('input[name="node-source-type"]:checked')?.value === 'custom';
            let id = "";
            let title = "";
            let type = "case";

            if (isCustom) {
                title = document.getElementById("modal-custom-title")?.value?.trim() || "";
                id = document.getElementById("modal-custom-id")?.value?.trim() || "";
                type = document.getElementById("modal-custom-type")?.value || "case";
                if (!title || !id) {
                    alert("Please provide both a Title and an Identifier for the custom node.");
                    return;
                }
            } else {
                const select = document.getElementById("modal-project-item-select");
                if (!select || !select.value) {
                    alert("Please select a project file.");
                    return;
                }
                const opt = select.selectedOptions[0];
                id = select.value;
                title = opt.dataset.title || id;
                type = opt.dataset.type || (id.endsWith(".nwd") ? "chapter" : "case");
            }

            const cleanId = id.replace(/^cases\//, '').replace(/\.json$/, '');

            if (!this.progressionData.customNodes) this.progressionData.customNodes = [];
            const exists = this.progressionData.customNodes.some(n => n.id.replace(/^cases\//, '').replace(/\.json$/, '') === cleanId);
            if (!exists) {
                this.progressionData.customNodes.push({ id, type, title });
            }

            const panX = this.canvasState?.panX || 40;
            const panY = this.canvasState?.panY || 40;
            const zoom = this.canvasState?.zoom || 1.0;
            const spawnX = (this.pendingNodeConnection?.spawnX != null)
                ? this.pendingNodeConnection.spawnX
                : Math.max(40, Math.round((-panX + 320) / zoom));
            const spawnY = (this.pendingNodeConnection?.spawnY != null)
                ? this.pendingNodeConnection.spawnY
                : Math.max(40, Math.round((-panY + 180) / zoom));

            if (!this.canvasState.customPositions) this.canvasState.customPositions = {};
            this.canvasState.customPositions[cleanId] = { x: spawnX, y: spawnY };

            // Auto-connect if spawned from a dragged wire (forward or backward)
            if (this.pendingNodeConnection?.connectFromNode) {
                const fromNode = this.pendingNodeConnection.connectFromNode;
                if (!this.progressionData.rules) this.progressionData.rules = [];
                const ruleExists = this.progressionData.rules.some(r => {
                    const rReq = (r.requires?.id || "").replace(/^cases\//, '').replace(/\.json$/, '');
                    const rTarget = (r.target || "").replace(/^cases\//, '').replace(/\.json$/, '');
                    return rReq === fromNode.id && rTarget === cleanId;
                });
                if (!ruleExists) {
                    if (this.wouldCreateCycle(fromNode.id, cleanId)) {
                        this.showToast(`⚠️ Warning: Card created, but auto-connection skipped to avoid circular deadlock.`);
                    } else {
                        this.progressionData.rules.push({
                            target: id,
                            targetType: type,
                            targetTitle: title,
                            requires: {
                                type: fromNode.type,
                                id: fromNode.fullId || fromNode.id,
                                title: fromNode.title,
                                teaser: fromNode.type === 'chapter' ? `Read ${fromNode.title} in the Novel Reader to unlock.` : `Solve ${fromNode.title} to unlock.`
                            }
                        });
                    }
                }
            } else if (this.pendingNodeConnection?.connectToNode) {
                const toNode = this.pendingNodeConnection.connectToNode;
                if (!this.progressionData.rules) this.progressionData.rules = [];
                const ruleExists = this.progressionData.rules.some(r => {
                    const rReq = (r.requires?.id || "").replace(/^cases\//, '').replace(/\.json$/, '');
                    const rTarget = (r.target || "").replace(/^cases\//, '').replace(/\.json$/, '');
                    return rReq === cleanId && rTarget === toNode.id;
                });
                if (!ruleExists) {
                    if (this.wouldCreateCycle(cleanId, toNode.id)) {
                        this.showToast(`⚠️ Warning: Card created, but auto-connection skipped to avoid circular deadlock.`);
                    } else {
                        this.progressionData.rules.push({
                            target: toNode.fullId || toNode.id,
                            targetType: toNode.type,
                            targetTitle: toNode.title,
                            requires: {
                                type: type,
                                id: id,
                                title: title,
                                teaser: type === 'chapter' ? `Read ${title} in the Novel Reader to unlock.` : `Solve ${title} to unlock.`
                            }
                        });
                    }
                }
            }

            this.pendingNodeConnection = null;

            const modal = document.getElementById("canvas-add-node-modal");
            if (modal) modal.remove();

            this.renderProgressionTab(document.getElementById("tab-workspace"));
            this.updateBadgeCounts();
            this.showToast(`Added card: ${title}`);
        },

        deleteProgressionNode(nodeId) {
            const cleanId = nodeId.replace(/^cases\//, '').replace(/\.json$/, '');
            const rules = this.progressionData.rules || [];
            const connectedRules = rules.filter(r => {
                const reqClean = (r.requires?.id || "").replace(/^cases\//, '').replace(/\.json$/, '');
                const targetClean = (r.target || "").replace(/^cases\//, '').replace(/\.json$/, '');
                return reqClean === cleanId || targetClean === cleanId;
            });

            const confirmMsg = connectedRules.length > 0
                ? `Remove card "${nodeId}" from graph?\nThis will also delete ${connectedRules.length} connected progression rule(s).`
                : `Remove card "${nodeId}" from graph?`;

            if (confirm(confirmMsg)) {
                this.progressionData.rules = rules.filter(r => {
                    const reqClean = (r.requires?.id || "").replace(/^cases\//, '').replace(/\.json$/, '');
                    const targetClean = (r.target || "").replace(/^cases\//, '').replace(/\.json$/, '');
                    return reqClean !== cleanId && targetClean !== cleanId;
                });

                if (this.progressionData.customNodes) {
                    this.progressionData.customNodes = this.progressionData.customNodes.filter(n => n.id.replace(/^cases\//, '').replace(/\.json$/, '') !== cleanId);
                }

                if (this.canvasState?.customPositions) {
                    delete this.canvasState.customPositions[cleanId];
                }

                this.renderProgressionTab(document.getElementById("tab-workspace"));
                this.updateBadgeCounts();
                this.showToast(`Removed node ${nodeId}`);
            }
        },

        deleteProgressionWireByIndex(index) {
            const rule = this.progressionData.rules?.[index];
            if (!rule) return;
            const fromTitle = rule.requires?.title || rule.requires?.id || "Previous Step";
            const toTitle = rule.targetTitle || rule.target || "Next Step";

            if (confirm(`Disconnect / delete progression rule #${index + 1}?\n\n"${fromTitle}" ➔ "${toTitle}"`)) {
                this.progressionData.rules.splice(index, 1);
                this.renderProgressionTab(document.getElementById("tab-workspace"));
                this.updateBadgeCounts();
                this.showToast(`Deleted progression connection.`);
            }
        },

        resetCanvasAutoLayout() {
            if (this.canvasState) {
                this.canvasState.customPositions = {};
            }
            this.renderProgressionTab(document.getElementById("tab-workspace"));
            this.showToast("Reset graph layout to auto-arranged tree.");
        },

        canvasZoomIn() {
            if (!this.canvasState) return;
            this.canvasState.zoom = Math.min(2.0, this.canvasState.zoom * 1.2);
            const viewport = document.getElementById("progression-canvas-viewport");
            const zoomLabel = document.getElementById("canvas-zoom-val");
            if (viewport) viewport.style.transform = `translate(${this.canvasState.panX}px, ${this.canvasState.panY}px) scale(${this.canvasState.zoom})`;
            if (zoomLabel) zoomLabel.innerText = `${Math.round(this.canvasState.zoom * 100)}%`;
        },

        canvasZoomOut() {
            if (!this.canvasState) return;
            this.canvasState.zoom = Math.max(0.35, this.canvasState.zoom * 0.8);
            const viewport = document.getElementById("progression-canvas-viewport");
            const zoomLabel = document.getElementById("canvas-zoom-val");
            if (viewport) viewport.style.transform = `translate(${this.canvasState.panX}px, ${this.canvasState.panY}px) scale(${this.canvasState.zoom})`;
            if (zoomLabel) zoomLabel.innerText = `${Math.round(this.canvasState.zoom * 100)}%`;
        },

        canvasResetZoom() {
            if (!this.canvasState) return;
            this.canvasState.zoom = 1.0;
            this.canvasState.panX = 40;
            this.canvasState.panY = 40;
            const viewport = document.getElementById("progression-canvas-viewport");
            const zoomLabel = document.getElementById("canvas-zoom-val");
            if (viewport) viewport.style.transform = `translate(${this.canvasState.panX}px, ${this.canvasState.panY}px) scale(${this.canvasState.zoom})`;
            if (zoomLabel) zoomLabel.innerText = `100%`;
        },

        canvasFitView() {
            const wrapper = document.getElementById("progression-canvas-wrapper");
            const viewport = document.getElementById("progression-canvas-viewport");
            if (!wrapper || !viewport || !this.canvasState) return;

            const nodes = wrapper.querySelectorAll('.canvas-node-card');
            if (nodes.length === 0) return;

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            nodes.forEach(el => {
                const x = parseFloat(el.style.left) || 0;
                const y = parseFloat(el.style.top) || 0;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x + 210);
                maxY = Math.max(maxY, y + 70);
            });

            const contentW = maxX - minX + 80;
            const contentH = maxY - minY + 80;
            const wrapperW = wrapper.clientWidth || 800;
            const wrapperH = wrapper.clientHeight || 580;

            const scale = Math.min(1.2, Math.max(0.4, Math.min(wrapperW / contentW, wrapperH / contentH)));
            this.canvasState.zoom = scale;
            this.canvasState.panX = (wrapperW - (maxX + minX) * scale) / 2;
            this.canvasState.panY = (wrapperH - (maxY + minY) * scale) / 2;

            viewport.style.transform = `translate(${this.canvasState.panX}px, ${this.canvasState.panY}px) scale(${this.canvasState.zoom})`;
            const zoomLabel = document.getElementById("canvas-zoom-val");
            if (zoomLabel) zoomLabel.innerText = `${Math.round(this.canvasState.zoom * 100)}%`;
        },

        canvasFocusActive() {
            const wrapper = document.getElementById("progression-canvas-wrapper");
            const viewport = document.getElementById("progression-canvas-viewport");
            if (!wrapper || !viewport || !this.canvasState) return;

            const activeNode = wrapper.querySelector('.active-case-node');
            if (!activeNode) {
                this.showToast("No active case node found to focus.");
                return;
            }

            const x = parseFloat(activeNode.style.left) || 0;
            const y = parseFloat(activeNode.style.top) || 0;
            const wrapperW = wrapper.clientWidth || 800;
            const wrapperH = wrapper.clientHeight || 580;

            this.canvasState.zoom = 1.0;
            this.canvasState.panX = (wrapperW / 2) - (x + 105);
            this.canvasState.panY = (wrapperH / 2) - (y + 35);

            viewport.style.transform = `translate(${this.canvasState.panX}px, ${this.canvasState.panY}px) scale(${this.canvasState.zoom})`;
            const zoomLabel = document.getElementById("canvas-zoom-val");
            if (zoomLabel) zoomLabel.innerText = `100%`;
            this.showToast("Focused on active case node.");
        },

        toggleCanvasExpand() {
            if (!this.canvasState) this.canvasState = {};
            this.canvasState.expanded = !this.canvasState.expanded;
            const container = document.getElementById("tab-workspace");
            if (container) this.renderProgressionTab(container);
        },

        // --- Card Search & Navigation ---

        filterCanvasCards(query) {
            this.canvasCardSearchQuery = (query || "").trim();
            const q = this.canvasCardSearchQuery.toLowerCase();
            const wrapper = document.getElementById("progression-canvas-wrapper");
            if (!wrapper) return;

            const cards = Array.from(wrapper.querySelectorAll('.canvas-node-card'));
            const countLabel = document.getElementById("canvas-search-count");

            if (!q) {
                if (countLabel) countLabel.innerText = "";
                this.canvasSearchMatches = [];
                this.canvasSearchIndex = -1;
                return;
            }

            this.canvasSearchMatches = [];
            cards.forEach(card => {
                const title = (card.querySelector('.canvas-node-title')?.innerText || "").toLowerCase();
                const sub = (card.querySelector('.canvas-node-sub')?.innerText || "").toLowerCase();
                const tag = (card.querySelector('.canvas-node-tag')?.innerText || "").toLowerCase();
                const nodeId = (card.dataset.nodeId || "").toLowerCase();

                const isMatch = title.includes(q) || sub.includes(q) || tag.includes(q) || nodeId.includes(q);
                if (isMatch) {
                    this.canvasSearchMatches.push(card);
                }
            });

            if (this.canvasSearchMatches.length > 0) {
                this.canvasSearchIndex = 0;
                this.focusCanvasSearchMatch(0);
                if (countLabel) countLabel.innerText = `1/${this.canvasSearchMatches.length}`;
            } else {
                this.canvasSearchIndex = -1;
                if (countLabel) countLabel.innerText = "0/0";
            }
        },

        focusCanvasSearchMatch(index) {
            if (!this.canvasSearchMatches || this.canvasSearchMatches.length === 0) return;
            const idx = ((index % this.canvasSearchMatches.length) + this.canvasSearchMatches.length) % this.canvasSearchMatches.length;
            this.canvasSearchIndex = idx;

            const targetCard = this.canvasSearchMatches[idx];
            if (targetCard) {
                this.centerOnCanvasCard(targetCard);
            }

            const countLabel = document.getElementById("canvas-search-count");
            if (countLabel) {
                countLabel.innerText = `${idx + 1}/${this.canvasSearchMatches.length}`;
            }
        },

        centerOnCanvasCard(cardEl) {
            const wrapper = document.getElementById("progression-canvas-wrapper");
            const viewport = document.getElementById("progression-canvas-viewport");
            if (!wrapper || !viewport || !this.canvasState) return;

            const x = parseFloat(cardEl.style.left) || 0;
            const y = parseFloat(cardEl.style.top) || 0;
            const wrapperW = wrapper.clientWidth || 800;
            const wrapperH = wrapper.clientHeight || 580;
            const zoom = this.canvasState.zoom || 1.0;

            this.canvasState.panX = (wrapperW / 2) - (x + 105) * zoom;
            this.canvasState.panY = (wrapperH / 2) - (y + 35) * zoom;

            viewport.style.transform = `translate(${this.canvasState.panX}px, ${this.canvasState.panY}px) scale(${zoom})`;
        },

        canvasSearchNext() {
            if (!this.canvasSearchMatches || this.canvasSearchMatches.length === 0) return;
            this.focusCanvasSearchMatch(this.canvasSearchIndex + 1);
        },

        canvasSearchPrev() {
            if (!this.canvasSearchMatches || this.canvasSearchMatches.length === 0) return;
            this.focusCanvasSearchMatch(this.canvasSearchIndex - 1);
        },

        onCanvasSearchKey(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.canvasSearchPrev();
                } else {
                    this.canvasSearchNext();
                }
            } else if (e.key === 'Escape') {
                e.preventDefault();
                const input = document.getElementById("canvas-card-search");
                if (input) {
                    input.value = "";
                    this.filterCanvasCards("");
                    input.blur();
                }
            }
        },

        getGroupedProgressionData() {
            const rawRules = this.progressionData?.rules || [];
            const groupedMap = new Map();

            rawRules.forEach(rule => {
                const target = rule.target;
                if (!target) return;
                const normKey = target.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                if (!groupedMap.has(normKey)) {
                    groupedMap.set(normKey, {
                        target: target,
                        targetType: rule.targetType || (target.endsWith('.nwd') ? 'chapter' : 'case'),
                        targetTitle: rule.targetTitle || target,
                        requires: []
                    });
                }
                const group = groupedMap.get(normKey);
                if (rule.requires) {
                    if (Array.isArray(rule.requires)) {
                        rule.requires.forEach(req => {
                            if (req && req.id && !group.requires.some(existing => existing.id === req.id)) {
                                group.requires.push(req);
                            }
                        });
                    } else if (rule.requires.id) {
                        if (!group.requires.some(existing => existing.id === rule.requires.id)) {
                            group.requires.push(rule.requires);
                        }
                    }
                }
            });

            const formattedRules = [];
            groupedMap.forEach(group => {
                formattedRules.push({
                    target: group.target,
                    targetType: group.targetType,
                    targetTitle: group.targetTitle,
                    requires: group.requires.length === 1 ? group.requires[0] : group.requires
                });
            });

            return {
                version: this.progressionData?.version || "2.0",
                rules: formattedRules,
                customNodes: this.progressionData?.customNodes || []
            };
        },

        copyProgressionJSON() {
            const grouped = this.getGroupedProgressionData();
            const formatted = JSON.stringify(grouped, null, 2);
            navigator.clipboard.writeText(formatted).then(() => {
                this.showToast("Copied grouped progression.json to clipboard!");
            }).catch(() => {
                this.showToast("Could not access clipboard.");
            });
        },

        async saveProgressionToFile() {
            const grouped = this.getGroupedProgressionData();
            const formatted = JSON.stringify(grouped, null, 2);

            // 1. Try local dev server API endpoint
            try {
                const res = await fetch("/api/save-file", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        file: "game/cases/progression.json",
                        content: formatted
                    })
                });
                if (res.ok) {
                    this.showToast("✓ Saved directly to game/cases/progression.json!");
                    return;
                }
            } catch (err) {}

            // 2. Try File System Access API
            if (window.showSaveFilePicker) {
                try {
                    if (!this._progressionFileHandle) {
                        this._progressionFileHandle = await window.showSaveFilePicker({
                            suggestedName: "progression.json",
                            types: [{ description: "JSON Progression Rules", accept: { "application/json": [".json"] } }]
                        });
                    }
                    const writable = await this._progressionFileHandle.createWritable();
                    await writable.write(formatted);
                    await writable.close();
                    this.showToast("✓ Saved progression.json directly to disk!");
                    return;
                } catch (err) {
                    if (err.name === "AbortError") return;
                }
            }

            // 3. Fallback: Download file
            this.exportProgressionJSON();
        },

        exportProgressionJSON() {
            const grouped = this.getGroupedProgressionData();
            const formatted = JSON.stringify(grouped, null, 2);
            const blob = new Blob([formatted], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "progression.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.showToast("Downloaded progression.json (Grouped format)");
        },

        wouldCreateCycle(fromId, toId, customRules = null) {
            const cleanFrom = (fromId || "").replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
            const cleanTo = (toId || "").replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
            if (!cleanFrom || !cleanTo) return false;
            if (cleanFrom === cleanTo) return true;

            const rules = customRules || this.progressionData?.rules || [];
            const adj = new Map();

            rules.forEach(r => {
                const reqList = Array.isArray(r.requires) ? r.requires : (r.requires ? [r.requires] : []);
                reqList.forEach(req => {
                    if (!req || !req.id || !r.target) return;
                    const u = req.id.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                    const v = r.target.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                    if (!adj.has(u)) adj.set(u, new Set());
                    adj.get(u).add(v);
                });
            });

            const visited = new Set();
            const queue = [cleanTo];
            visited.add(cleanTo);

            while (queue.length > 0) {
                const curr = queue.shift();
                if (curr === cleanFrom) return true;

                const neighbors = adj.get(curr);
                if (neighbors) {
                    for (const next of neighbors) {
                        if (!visited.has(next)) {
                            visited.add(next);
                            queue.push(next);
                        }
                    }
                }
            }

            return false;
        },

        detectProgressionCycles(customRules = null) {
            const rules = customRules || this.progressionData?.rules || [];
            const adj = new Map();
            const allNodes = new Set();

            rules.forEach(r => {
                const reqList = Array.isArray(r.requires) ? r.requires : (r.requires ? [r.requires] : []);
                reqList.forEach(req => {
                    if (!req || !req.id || !r.target) return;
                    const u = req.id.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                    const v = r.target.replace(/^[./]+/, '').replace(/^cases\//, '').replace(/\.json$/, '');
                    allNodes.add(u);
                    allNodes.add(v);
                    if (!adj.has(u)) adj.set(u, []);
                    adj.get(u).push(v);
                });
            });

            const state = new Map();
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
                            const cyclePath = path.slice(cycleStartIndex).concat(v);
                            cycles.push(cyclePath);
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
        }
    };

    global.CaseEditorProgression = CaseEditorProgression;
})(typeof window !== 'undefined' ? window : globalThis);
