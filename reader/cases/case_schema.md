# Deduction Engine — Clean Case Authoring Specification

The **Deduction Engine** uses a human-friendly format where writers never have to write HTML tags (`<div>`, `<span class="kw">`, `<input>`). The engine parses bracket keywords, markdown formatting, and declarative artifact objects automatically.

---

## 1. Keywords Syntax: `[Word]`
To make any word collectible, draggable, and highlighted in a clue, quote, or lore dossier, simply wrap it in brackets:
- `[Luka]` -> Automatically rendered as an interactive, draggable keyword.
- `[Time Ripple]` -> Works for multi-word phrases too.

---

## 2. Declarative In-Universe Artifacts
Instead of writing HTML divs and styling classes, use clean JSON blocks:

### 📱 Phone / Smartphone Lockscreen (with optional Navigation HUD)
```json
{
  "type": "Smart Device",
  "title": "Phone",
  "phone": {
    "network": "☭ SOV-NET 5G // ROAMING",
    "battery": "88%",
    "time": "07:25",
    "date": "14th [April]",
    "nav": {
      "arrow": "↱",
      "subtitle": "GLONASS ACTIVE GUIDANCE (350m)",
      "instruction": "Turn right at next crossroad",
      "destination": "Destination: 1.6 km from [ROVD]"
    },
    "messages": [
      {
        "app": "MESSAGING APP",
        "time": "07:22",
        "sender": "Alex ([best friend])",
        "text": "Hey bro, wanna go out for a [drink] tonight?"
      }
    ]
  }
}
```

### 🛰️ Navigation HUD
```json
{
  "type": "Navigation",
  "title": "Navigation Phone",
  "nav": {
    "network": "🛰️ GLONASS-IV ACTIVE GUIDANCE",
    "time": "07:50",
    "arrow": "↱",
    "subtitle": "Next Turn (350m)",
    "instruction": "Turn right at the next crossroad",
    "destination": "Destination: 1.6 km from [ROVD]"
  }
}
```

### 🪪 ID Card Badge
```json
{
  "type": "ID Card",
  "title": "Name plate",
  "badge": {
    "avatar": "👤",
    "dept": "FEBRAS PIRM Institute",
    "name": "[Luka] [Huo]",
    "role": "[Theoretical Physics] Department"
  }
}
```

### 💊 Polyclinic Prescription Label (Rx)
```json
{
  "type": "Prescription",
  "title": "Pill bottle",
  "rx": {
    "dispensary": "Polyclinic Dispensary #4",
    "status": "PARTIAL",
    "active": true,
    "drug": "Prescribed daily [medication] bottle.",
    "date": "21 [March]",
    "doctor": "polyclinic [doctors]"
  }
}
```

### 📼 Audio Tape / Voicemail Player
```json
{
  "type": "Audio Log",
  "title": "Voicemail recording",
  "audio": {
    "label": "⏺ COMM-REC // OUTGOING VOICEMAIL",
    "time": "00:32 / 00:45",
    "lines": [
      {
        "speaker": "Voicemail Greeting",
        "text": "This is Professor [Stanislav Krotov]...",
        "type": "system"
      },
      {
        "speaker": "Luka Huo",
        "text": "Professor, I need to call in sick today from [Ripple Sickness]...",
        "type": "user"
      }
    ]
  }
}
```

### 📜 Soviet / Propaganda Jubilee Poster
```json
{
  "type": "Public Notice",
  "title": "Poster",
  "poster": {
    "logo": "[WSS]",
    "established": "EST. 2050",
    "badge": "68th JUBILEE",
    "headline": "Commemorate the 68th Anniversary of [WSS] Together!",
    "date": "10 [May]",
    "venue": "[Vladivostok] Central Plenary Hall",
    "agenda": [
      "**Panel 1** — Dr. Krotov",
      "**Panel 2** — Jr. Researcher Luka Huo"
    ]
  }
}
```

## 3. Initial / Starter Keywords (`initialKeywords` / `presetKeywords`)
Instead of forcing every basic verb, direction, or common word unnaturally into scene descriptions, you can supply baseline starter keywords that are automatically present in the player's evidence tray and autocomplete dropdown from the start:

```json
"initialKeywords": [
  "North",
  "South",
  "East",
  "West",
  { "word": "fled", "category": "verb" },
  { "word": "arrived", "category": "verb" },
  { "word": "sedan", "category": "noun" }
]
```
- Accepts simple strings (`"North"`) or category-tagged objects (`{ "word": "fled", "category": "verb" }`).
- Automatically counted in the keyword collection counter and immediately available for docket placement.

---

## 4. Chapter-Scoped Keywords (`chapterScope`)
To keep the player's keyword tray focused and prevent keywords from accumulating across the entire novel, a case can link directly to specific novel chapter(s):

```json
"chapterScope": [
  "content/27601e10419ce.nwd",
  "content/ch02_the_snowbank.nwd"
]
```
- **In Novel Reader**: Words marked as `[Keyword]` in the `.nwd` chapter text are rendered with an interactive highlight and can be clicked or auto-collected upon reading.
- **In Deduction Engine**: The investigation only imports keywords that originate from the specified `chapterScope` (plus the case's own scene clues and starter keywords), keeping the keyword tray pristine and relevant to that case.

---

## 5. Case Docket Slot Syntax & Slot Constraints

Write the case deduction docket using simple markdown and slot tags:
- `[slot:slot_id]` -> An open word slot displaying all collected keywords in autocomplete.
- `[slot:slot_id:category_tag]` -> **Constrained slot** (e.g. `[slot:suspect_name:name]`, `[slot:escape_action:verb]`, `[slot:escape_route:location]`).
  - The autocomplete dropdown automatically filters choices to only show keywords matching that category or semantic tag, preventing choice overload.
  - Displays a visual tag badge (e.g. `🏷️ NAME`, `🏷️ VERB`, `🏷️ LOCATION`) and customized search placeholder in the autocomplete popover.
- `[num:slot_id:length:placeholder]` -> A numeric input slot with digit constraints. E.g. `[num:day:2:DD]`, `[num:year:4:YYYY]`, `[num:months:1:#]`.

Example:
```markdown
**INCIDENT SUMMARY:**
At [num:time_hour:2:HH]:[num:time_min:2:MM], the suspect named [slot:suspect_name:name] [slot:action:verb] on a [slot:vehicle_noun:noun] towards the [slot:destination:location].
```

---

## 6. Master Solution Verification (`solution`)
Map slot IDs to the expected answer string or list of acceptable alternatives:
```json
"solution": {
  "day": "14",
  "month": "April",
  "year": "2118",
  "country1": ["Russia SFSR", "USSR"],
  "country2": ["USSR", "Russia SFSR"],
  "p1_first": "Luka"
}
```

---

## 7. Universal Progression & Prerequisite Rules (`progression.json` & `meta.unlocks`)

The progression system supports all four prerequisite relationships with **zero code modifications**:

### A. Central Progression Rules (`reader/cases/progression.json`)

```json
{
  "version": "2.0",
  "rules": [
    {
      "target": "content/27601e10419ce.nwd",
      "targetType": "chapter",
      "targetTitle": "Chapter 1: The ROVD",
      "requires": {
        "type": "case",
        "id": "chapter_01_morning_routine",
        "title": "Case 1: Morning Routine",
        "url": "game.html?case=cases/chapter_01_morning_routine.json",
        "teaser": "Reconstruct the morning timeline to verify the case docket."
      }
    },
    {
      "target": "case_02_mountain_pass",
      "targetType": "case",
      "targetTitle": "Case 2: The Mountain Pass",
      "requires": {
        "type": "chapter",
        "id": "content/27601e10419ce.nwd",
        "title": "Chapter 1: The ROVD",
        "url": "index.html?file=content/27601e10419ce.nwd",
        "teaser": "Read Chapter 1 in the Novel Reader to unlock this case investigation."
      }
    },
    {
      "target": "case_03_advanced_investigation",
      "targetType": "case",
      "requires": {
        "type": "case",
        "id": "case_02_mountain_pass",
        "title": "Case 2: Mountain Pass",
        "teaser": "Solve Case 2 to unlock Case 3."
      }
    },
    {
      "target": "content/ch03_aftermath.nwd",
      "targetType": "chapter",
      "requires": {
        "type": "chapter",
        "id": "content/ch02_the_snowbank.nwd",
        "title": "Chapter 2: The Snowbank",
        "teaser": "Read Chapter 2 to proceed."
      }
    }
  ]
}
```

### B. Shorthand Rule Notation
You can also write concise single-line entries in `progression.json`:
- **Chapter requires Case:**
  `{ "chapter": "content/ch01.nwd", "requiresCase": "case_01", "caseTitle": "Case 1" }`
- **Case requires Chapter:**
  `{ "case": "case_02", "requiresChapter": "content/ch01.nwd", "chapterTitle": "Chapter 1" }`
- **Case requires Case:**
  `{ "case": "case_03", "requiresCase": "case_02", "caseTitle": "Case 2" }`
- **Chapter requires Chapter:**
  `{ "chapter": "content/ch02.nwd", "requiresChapter": "content/ch01.nwd", "chapterTitle": "Chapter 1" }`

### C. Per-Case Victory Unlock Card (`meta.unlocks`)
Inside any case JSON file (`cases/*.json`), add an `unlocks` block under `meta`:
```json
"meta": {
  "title": "CASE 1: MORNING ROUTINE",
  "docketTitle": "📋 MVD FORM 0-A // MORNING COGNITIVE EVALUATION",
  "successMessage": "☭ DEDUCTION VERIFIED! Case 1 Confirmed.",
  "unlocks": {
    "chapter": "content/27601e10419ce.nwd",
    "title": "Chapter 1: The ROVD (The Weight of Unfallen Snow)",
    "description": "Proceed to the Novel Reader to continue reading the story."
  }
}
```
*Both the Deduction Engine and Novel Reader automatically detect lock status, render security lock screens with direct navigation buttons, display `🔒` badges in dropdowns/TOCs, and mark items as completed upon reading or solving.*

