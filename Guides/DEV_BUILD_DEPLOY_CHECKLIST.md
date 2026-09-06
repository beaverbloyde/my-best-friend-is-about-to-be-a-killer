# Developer Build, Test & Deployment Checklist

A comprehensive checklist for AI agents and human developers maintaining, updating, and deploying the **Project Chronos** reader and game.

---

## 🚀 1. Local Development Setup

Start the local development server from the repository root:
```bash
./run_reader.sh
```
* Access the **Novel Reader**: `http://localhost:8002/reader/`
* Access the **Deduction Game**: `http://localhost:8002/reader/game.html`

---

## 🔄 2. Post-Chapter Authoring Workflow

Whenever new `.nwd` chapters are added or footnotes are edited:

1. **Synchronize Pronunciation Audio**:
   ```bash
   python3 scripts/sync_pronunciations.py
   ```
   * Automatically scans all `.nwd` files for `(Слово [IPA])`.
   * Downloads missing `.mp3` clips to `reader/audio/pronunciations/`.
   * Regenerates `reader/audio/pronunciations/index.json`.

2. **Verify Case Progression**:
   If a new case or chapter lock is introduced, register the rule in `reader/cases/progression.json`.

---

## 🧪 3. Quality Assurance & Regression Checklist

Run syntax checks across all engine scripts:
```bash
node -c reader/app.js
node -c reader/engine/deduction-engine.js
node -c reader/engine/bgm-player.js
node -c reader/engine/sfx.js
```

### Manual Testing Matrix in Browser (`http://localhost:8002/reader/`):
- [ ] **Footnotes & Pronunciation**: Click `[footnote:*]` links in text. Confirm popup opens and clicking **🔊 [IPA]** plays clear Russian audio.
- [ ] **Dialogue Highlighting**: Verify speech quotes render in `--speech-default` color without broken HTML tags.
- [ ] **Zen Focus Mode**: Press `Z` to enter Zen mode. Scroll down and verify Paragraph Spotlight fades adjacent text smoothly. Press `Esc` to exit.
- [ ] **Auto-Bookmark**: Scroll halfway down a chapter, reload the page, and verify the `#resume-toast` appears and restores scroll position.
- [ ] **Search Palette**: Press `Ctrl + K` (or `Cmd + K`), search for a chapter or character name, and navigate with Arrow keys and Enter.
- [ ] **Case Deduction Game**: Open `game.html?case=cases/chapter_01_morning_routine.json`, drag keywords into slots, enter numbers, and click "Submit Docket" to verify validation feedback.

---

## ⚠️ 4. Critical Pitfalls & Rules

1. **HTML Attribute Quotes in Parsed Text**:
   * Always use single quotes (`'`) for HTML attributes generated in `reader/app.js` (e.g. `<button class='footnote-ref'>`). Double quotes will collide with dialogue quotation regexes.
2. **Never Hardcode Domain Names**:
   * Use relative asset paths (e.g. `audio/pronunciations/`) so the app works identically on `localhost:8002` and GitHub Pages (`https://.../reader/`).
3. **Always Ask Before Remote Push**:
   * Stage and commit changes locally to git, but do not execute `git push` without user review and explicit confirmation.

---

## 🌐 5. Deployment Guide (GitHub Pages)

1. Verify all working tree changes are committed:
   ```bash
   git status
   ```
2. Push commits to the remote repository:
   ```bash
   git push origin master
   ```
3. Live deployment updates automatically via GitHub Pages.
