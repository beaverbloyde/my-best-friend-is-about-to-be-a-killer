/**
 * LOGOS-3 CASE AUTHORING TERMINAL - CONSTANTS & REGISTRY
 */
(function (global) {
    'use strict';

    const DEFAULT_CATEGORIES = {
        name: { hex: "#38bdf8", icon: "👤", label: "Name" },
        location: { hex: "#34d399", icon: "📍", label: "Location" },
        verb: { hex: "#fbbf24", icon: "⚡", label: "Verb" },
        rank: { hex: "#f59e0b", icon: "🎖️", label: "Rank" },
        calendar: { hex: "#fb923c", icon: "📅", label: "Calendar" },
        temporal: { hex: "#fb7185", icon: "🌀", label: "Temporal" },
        medical: { hex: "#c084fc", icon: "💊", label: "Medical" },
        insignia: { hex: "#ca8a04", icon: "⭐", label: "Insignia" },
        noun: { hex: "#94a3b8", icon: "📦", label: "Noun" }
    };

    const WIDGET_REGISTRY = [
        {
            id: "text",
            label: "📝 Text Evidence",
            badge: "Text",
            match: (clue) => !clue.phone && !clue.clock && !clue.audio && !clue.badge && !clue.idBadge && !clue.poster && !clue.rx && !clue.prescription && !clue.table && !clue.roster,
            defaultProps: (title, badgeType) => ({
                title: title || "New Evidence",
                type: badgeType || "Physical Evidence",
                text: "Describe the physical scene, note, or object with [Keyword] brackets..."
            })
        },
        {
            id: "phone",
            label: "📱 Mobile Phone / Lockscreen",
            badge: "Phone",
            match: (clue) => !!clue.phone,
            defaultProps: (title, badgeType) => ({
                title: title || "Phone",
                type: badgeType || "Smart Device",
                phone: {
                    network: "☭ SOV-NET // ROAMING",
                    battery: "88%",
                    time: "07:25",
                    date: "14th [april]",
                    messages: []
                }
            })
        },
        {
            id: "clock",
            label: "⏰ Telemetry Clock",
            badge: "Clock",
            match: (clue) => !!clue.clock,
            defaultProps: (title, badgeType) => ({
                title: title || "Alarm Clock & Calendar",
                type: badgeType || "Environment",
                clock: {
                    title: "BEDSIDE TELEMETRY",
                    time: "07:02",
                    temperature: "24°C",
                    date: "[thursday]"
                }
            })
        },
        {
            id: "audio",
            label: "🎙️ Audio Log / Wiretap",
            badge: "Audio",
            match: (clue) => !!clue.audio,
            defaultProps: (title, badgeType) => ({
                title: title || "Phone Call Log",
                type: badgeType || "Audio Log",
                audio: {
                    label: "⏺ COMM-REC // OUTGOING VOICEMAIL",
                    time: "00:00 / 00:45",
                    lines: [{ speaker: "System", type: "system", text: "Commencing playback..." }]
                }
            })
        },
        {
            id: "badge",
            label: "🪪 ID Card / Nameplate",
            badge: "ID Card",
            match: (clue) => !!(clue.badge || clue.idBadge),
            defaultProps: (title, badgeType) => ({
                title: title || "Name plate",
                type: badgeType || "ID Card",
                badge: {
                    avatar: "👤",
                    dept: "FEBRAS [pirm] Institute",
                    name: "[luka_huo]",
                    role: "Theoretical Physics Department"
                }
            })
        },
        {
            id: "rx",
            label: "💊 Prescription Bottle",
            badge: "Prescription",
            match: (clue) => !!(clue.rx || clue.prescription),
            defaultProps: (title, badgeType) => ({
                title: title || "Pill bottle",
                type: badgeType || "Prescription",
                rx: {
                    dispensary: "Polyclinic Dispensary #4",
                    status: "DEPLETED",
                    drug: "anti-hallucination sedatives",
                    date: "12 [january]",
                    doctor: ""
                }
            })
        },
        {
            id: "poster",
            label: "📢 Public Notice / Poster",
            badge: "Poster",
            match: (clue) => !!clue.poster,
            defaultProps: (title, badgeType) => ({
                title: title || "Poster",
                type: badgeType || "Public Notice",
                poster: {
                    logo: "[wss]",
                    established: "EST. 2050",
                    badge: "68th JUBILEE",
                    headline: "Commemorate Anniversary Together!",
                    date: "[sunday] 10 [april]",
                    venue: "[vladivostok] Central Plenary Hall",
                    agenda: ["**What's Next After [time_ripple]?** — Dr. [stanislav_krotov]", "**Spacetime Paradigm** — Jr. [researcher:upper] [luka_huo]"]
                }
            })
        },
        {
            id: "table",
            label: "📊 Data Table / Roster",
            badge: "Roster",
            match: (clue) => !!(clue.table || clue.roster),
            defaultProps: (title, badgeType) => ({
                title: title || "Roster",
                type: badgeType || "Data Table",
                table: {
                    caption: "OFFICIAL REGISTRY ROSTER",
                    headers: ["No.", "Officer Candidate", "Division", "Current Rank", "Conferred Rank"],
                    rows: [
                        ["01", "[anton_belov]", "Motorized Patrol", "[junior_lieutenant]", "[senior_lieutenant]"]
                    ],
                    footer: "Authorized by Ministry"
                }
            })
        }
    ];

    const BLANK_CASE_TEMPLATE = {
        id: "new_case",
        meta: {
            title: "NEW INVESTIGATION CASE",
            subtitle: "DISTRICT 4 // TIME & LOCATION",
            docketTitle: "📋 OFFICIAL INVESTIGATION DOCKET",
            author: "Investigator",
            version: "1.0",
            successMessage: "☭ DEDUCTION VERIFIED! Case Successfully Solved!"
        },
        timeline: {
            "08:00": {
                time: "08:00",
                title: "08:00 (Crime Scene)",
                location: "Pogranichny District",
                clues: [
                    {
                        type: "Physical Evidence",
                        title: "Initial Observation",
                        text: "An investigator arrived at the scene finding a discarded document."
                    }
                ]
            }
        },
        lore: {},
        categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
        keywords: {},
        initialKeywords: [],
        docket: {
            template: "At [num:time_hour:2:HH]:[num:time_min:2:MM], the suspect named [slot:p1_name:name] arrived at the [slot:p1_dest:location]."
        },
        solution: {
            time_hour: "08",
            time_min: "00"
        },
        hints: [
            {
                stage: 1,
                title: "Stage 1: Initial Direction",
                text: "Review the earliest timestamps in the timeline to identify the suspect's destination."
            }
        ]
    };

    global.CaseEditorConstants = {
        DEFAULT_CATEGORIES,
        WIDGET_REGISTRY,
        BLANK_CASE_TEMPLATE
    };
})(typeof window !== 'undefined' ? window : globalThis);
