/**
 * LOGOS-3 GAME CATEGORY THEMES & COLOR ENGINE
 * Palette configurations, Gosplan CRT color definitions, category stylers, and dynamic gradients.
 */
(function (global) {
    'use strict';

    const CATEGORY_COLORS = {
        name: { hex: "#38bdf8", text: "#7dd3fc", bg: "rgba(56, 189, 248, 0.16)", border: "rgba(56, 189, 248, 0.8)", icon: "👤", label: "Name" },
        location: { hex: "#34d399", text: "#6ee7b7", bg: "rgba(52, 211, 153, 0.16)", border: "rgba(52, 211, 153, 0.8)", icon: "📍", label: "Location" },
        verb: { hex: "#fbbf24", text: "#fde68a", bg: "rgba(251, 191, 36, 0.16)", border: "rgba(251, 191, 36, 0.8)", icon: "⚡", label: "Verb" },
        medical: { hex: "#c084fc", text: "#e9d5ff", bg: "rgba(192, 132, 252, 0.16)", border: "rgba(192, 132, 252, 0.8)", icon: "💊", label: "Medical" },
        temporal: { hex: "#fb7185", text: "#fecdd3", bg: "rgba(251, 113, 133, 0.16)", border: "rgba(251, 113, 133, 0.8)", icon: "🌀", label: "Temporal" },
        calendar: { hex: "#fb923c", text: "#fed7aa", bg: "rgba(251, 146, 60, 0.16)", border: "rgba(251, 146, 60, 0.8)", icon: "📅", label: "Calendar" },
        rank: { hex: "#f59e0b", text: "#fde68a", bg: "rgba(245, 158, 11, 0.16)", border: "rgba(245, 158, 11, 0.8)", icon: "🎖️", label: "Rank" },
        insignia: { hex: "#eab308", text: "#fef08a", bg: "rgba(234, 179, 8, 0.16)", border: "rgba(234, 179, 8, 0.8)", icon: "⭐", label: "Insignia" },
        noun: { hex: "#94a3b8", text: "#e2e8f0", bg: "rgba(148, 163, 184, 0.16)", border: "rgba(148, 163, 184, 0.8)", icon: "📦", label: "Noun" }
    };

    const GOSPLAN_CATEGORY_COLORS = {
        name: { hex: "#0284c7", text: "#075985", bg: "rgba(2, 132, 199, 0.14)", border: "#0369a1", icon: "👤", label: "Name" },
        location: { hex: "#059669", text: "#065f46", bg: "rgba(5, 150, 105, 0.14)", border: "#047857", icon: "📍", label: "Location" },
        verb: { hex: "#d97706", text: "#92400e", bg: "rgba(217, 119, 6, 0.14)", border: "#b45309", icon: "⚡", label: "Verb" },
        medical: { hex: "#9333ea", text: "#6b21a8", bg: "rgba(147, 51, 234, 0.14)", border: "#7e22ce", icon: "💊", label: "Medical" },
        temporal: { hex: "#e11d48", text: "#9f1239", bg: "rgba(225, 29, 72, 0.14)", border: "#be123c", icon: "🌀", label: "Temporal" },
        calendar: { hex: "#ea580c", text: "#9a3412", bg: "rgba(234, 88, 12, 0.14)", border: "#c2410c", icon: "📅", label: "Calendar" },
        rank: { hex: "#d97706", text: "#92400e", bg: "rgba(217, 119, 6, 0.14)", border: "#b45309", icon: "🎖️", label: "Rank" },
        insignia: { hex: "#ca8a04", text: "#854d0e", bg: "rgba(202, 138, 4, 0.14)", border: "#a16207", icon: "⭐", label: "Insignia" },
        noun: { hex: "#475569", text: "#1e293b", bg: "rgba(71, 85, 105, 0.14)", border: "#334155", icon: "📦", label: "Noun" }
    };

    const THEMES = ['soviet-amber', 'soviet-emerald', 'arctic', 'gosplan', 'monochrome'];

    const SCANLINE_SPEED_PRESETS = [
        { label: "Static", duration: "0s", isStatic: true },
        { label: "Slow (14s)", duration: "14s", isStatic: false },
        { label: "Normal (7s)", duration: "7s", isStatic: false },
        { label: "Fast (3.5s)", duration: "3.5s", isStatic: false },
        { label: "Rapid (1.8s)", duration: "1.8s", isStatic: false }
    ];

    const LogosCategoryTheme = {
        CATEGORY_COLORS,
        GOSPLAN_CATEGORY_COLORS,
        THEMES,
        SCANLINE_SPEED_PRESETS,

        hexToRgba(hex, alpha = 0.2) {
            if (!hex || typeof hex !== "string") return `rgba(148, 163, 184, ${alpha})`;
            let clean = hex.replace("#", "").trim();
            if (clean.length === 3) {
                clean = clean.split("").map(c => c + c).join("");
            }
            if (clean.length !== 6) return `rgba(148, 163, 184, ${alpha})`;
            const r = parseInt(clean.substring(0, 2), 16);
            const g = parseInt(clean.substring(2, 4), 16);
            const b = parseInt(clean.substring(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        },

        getCanonicalCategories(tagOrTags) {
            if (!tagOrTags) return ["noun"];
            let tags = [];
            if (Array.isArray(tagOrTags)) {
                tags = tagOrTags;
            } else if (typeof tagOrTags === "string") {
                tags = tagOrTags.split(/[,/|]+/).map(t => t.trim()).filter(Boolean);
            }
            if (tags.length === 0) return ["noun"];

            const canonical = [];
            for (const tag of tags) {
                const t = String(tag).toLowerCase().trim();
                let cat = t;
                if (["name", "names", "person", "people", "suspect", "victim", "witness", "officer", "character"].includes(t)) cat = "name";
                else if (["location", "locations", "place", "places", "facility", "venue", "city", "region", "country", "destination"].includes(t)) cat = "location";
                else if (["verb", "verbs", "action", "actions"].includes(t)) cat = "verb";
                else if (["medical", "medicine", "drug", "pathology", "symptom"].includes(t)) cat = "medical";
                else if (["temporal", "time", "anomaly"].includes(t)) cat = "temporal";
                else if (["calendar", "date", "dates", "day", "month", "year"].includes(t)) cat = "calendar";
                else if (["rank", "ranks", "officer_rank"].includes(t)) cat = "rank";
                else if (["insignia", "star", "stars"].includes(t)) cat = "insignia";
                else if (["noun", "nouns", "item", "items", "vehicle", "weapon", "object"].includes(t)) cat = "noun";

                if (!canonical.includes(cat)) {
                    canonical.push(cat);
                }
            }
            return canonical.length > 0 ? canonical : ["noun"];
        },

        getCategoryConfig(catKey, currentCase = null) {
            const canonical = this.getCanonicalCategories(catKey)[0] || "noun";
            const isGosplan = typeof document !== "undefined" && document.body && document.body.classList.contains("theme-gosplan");
            const defaultPalette = isGosplan ? GOSPLAN_CATEGORY_COLORS : CATEGORY_COLORS;
            const defaultConf = defaultPalette[canonical] || defaultPalette.noun;

            const custom = currentCase?.categories?.[catKey] ||
                           currentCase?.categories?.[canonical] ||
                           currentCase?.categoryColors?.[catKey] ||
                           currentCase?.categoryColors?.[canonical];

            if (custom) {
                return {
                    hex: custom.hex || custom.color || defaultConf.hex,
                    text: custom.text || custom.textColor || (isGosplan ? "#075985" : "#ffffff"),
                    bg: custom.bg || custom.background || this.hexToRgba(custom.hex || defaultConf.hex, 0.2),
                    border: custom.border || custom.borderColor || defaultConf.border,
                    icon: custom.icon || defaultConf.icon,
                    label: custom.label || custom.name || defaultConf.label
                };
            }

            return defaultConf;
        },

        buildSplitGradient(colors, angle = "to right") {
            if (!colors || colors.length === 0) return "none";
            if (colors.length === 1) return colors[0];
            const step = 100 / colors.length;
            const stops = [];
            for (let i = 0; i < colors.length; i++) {
                const startPct = (i * step).toFixed(2);
                const endPct = ((i + 1) * step).toFixed(2);
                stops.push(`${colors[i]} ${startPct}% ${endPct}%`);
            }
            return `linear-gradient(${angle}, ${stops.join(", ")})`;
        },

        applyCategoryStyleToElement(element, canonicalTags, options = {}, currentCase = null) {
            if (!element) return;
            const { isSlotEmpty = false, isCollected = false, isFilled = false, isSlot = false } = options;
            const isGosplan = typeof document !== "undefined" && document.body && document.body.classList.contains("theme-gosplan");
            const multiTextColor = isGosplan ? "#0a0705" : "#ffffff";

            element.classList.remove(
                "cat-theme-name", "cat-theme-location", "cat-theme-verb",
                "cat-theme-medical", "cat-theme-temporal", "cat-theme-calendar", "cat-theme-noun"
            );
            element.style.border = "";
            element.style.borderTop = "";
            element.style.borderBottom = "";
            element.style.borderLeft = "";
            element.style.borderRight = "";
            element.style.borderImage = "";
            element.style.background = "";
            element.style.color = "";

            if (!canonicalTags || canonicalTags.length === 0) {
                canonicalTags = ["noun"];
            }

            if (canonicalTags.length === 1) {
                const cat = canonicalTags[0];
                const conf = this.getCategoryConfig(cat, currentCase);

                if (isSlot && isSlotEmpty) {
                    element.style.color = conf.text;
                    element.style.background = this.hexToRgba(conf.hex, 0.12);
                    element.style.borderBottom = `2.5px dashed ${conf.hex}`;
                    element.style.boxShadow = `inset 0 0 6px ${this.hexToRgba(conf.hex, 0.15)}`;
                } else if (isSlot && isFilled) {
                    element.style.color = isGosplan ? conf.text : "#ffffff";
                    element.style.background = isGosplan ? this.hexToRgba(conf.hex, 0.22) : this.hexToRgba(conf.hex, 0.35);
                    element.style.border = `1.5px solid ${conf.hex}`;
                    element.style.boxShadow = `0 0 8px ${this.hexToRgba(conf.hex, 0.35)}`;
                } else {
                    element.style.color = conf.text;
                    element.style.borderLeft = `3.5px solid ${conf.hex}`;
                    if (isCollected) {
                        element.style.background = this.hexToRgba(conf.hex, 0.25);
                        element.style.borderRight = `1.5px solid ${this.hexToRgba(conf.hex, 0.5)}`;
                        element.style.borderTop = `1px solid ${this.hexToRgba(conf.hex, 0.3)}`;
                        element.style.borderBottom = `1px solid ${this.hexToRgba(conf.hex, 0.3)}`;
                    }
                }
            } else {
                // Multi-category tag styling
                const hexes = canonicalTags.map(c => this.getCategoryConfig(c, currentCase).hex);
                const bgRgba = canonicalTags.map(c => this.hexToRgba(this.getCategoryConfig(c, currentCase).hex, 0.25));

                if (isSlot && isSlotEmpty) {
                    element.style.color = multiTextColor;
                    element.style.background = this.buildSplitGradient(
                        canonicalTags.map(c => this.hexToRgba(this.getCategoryConfig(c, currentCase).hex, 0.12)),
                        "90deg"
                    );
                    element.style.borderBottom = `2.5px dashed ${hexes[0]}`;
                } else if (isSlot && isFilled) {
                    element.style.color = multiTextColor;
                    element.style.background = this.buildSplitGradient(bgRgba, "90deg");
                    element.style.border = `1.5px solid ${hexes[0]}`;
                    element.style.borderImage = `${this.buildSplitGradient(hexes, "90deg")} 1`;
                    element.style.boxShadow = `0 0 8px ${this.hexToRgba(hexes[0], 0.35)}`;
                } else {
                    element.style.color = multiTextColor;
                    element.style.borderLeft = `3.5px solid transparent`;
                    element.style.borderImage = `${this.buildSplitGradient(hexes, "to bottom")} 1`;
                    if (isCollected) {
                        element.style.background = this.buildSplitGradient(bgRgba, "90deg");
                        element.style.borderTop = `1px solid ${this.hexToRgba(hexes[0], 0.3)}`;
                        element.style.borderBottom = `1px solid ${this.hexToRgba(hexes[hexes.length - 1], 0.3)}`;
                    }
                }
            }
        }
    };

    global.LogosCategoryTheme = LogosCategoryTheme;
})(typeof window !== 'undefined' ? window : globalThis);
