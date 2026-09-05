# AI Agent Instructions - 36th SOT Reader

This document provides developer guidelines and implementation rules for AI coding agents working on the 36th SOT Reader Interface.

---

## 🛠️ Tech Stack & Constraints
1. **Vanilla CSS & HTML**: Do not use Tailwind CSS or CSS frameworks. All styling resides in `reader/style.css` using CSS custom properties.
2. **No Build Step**: The reader runs directly in the browser. Do not introduce compile steps, transpilers, or bundlers.
3. **No Cache Assumptions**: All network fetches of novelWriter files (ToC, indices, and scenes) must use cache-busting query strings `?t=${Date.now()}` to bypass browser caching.

---

## 📂 Data Sources & Project Structure

1. **`nwProject.nwx` (XML)**: The project configuration tree. Rebuild the document list (`docList`) directly from `<item>` elements. Ignore any element whose parent tree links to a `class="TRASH"` node.
2. **`meta/index.json`**: Contains `"novelWriter.tagsIndex"`, which maps user-defined tags/aliases to item handles.
3. **`content/{handle}.nwd`**: The raw scene/chapter text files.
4. **Dynamic Word Count**: Read the `novelWords` attribute from the XML's `<content>` element. Inject it as a comma-separated string replacing the token `[field:textWords]` on the Title Page.
5. **Dynamic Project Name**: Extract the project name from `<project> <name>` in `nwProject.nwx`. Use it to set `document.title` and the sidebar logo title dynamically.

---

## ⚙️ Parsing Rules & Heuristics (`app.js`)

When modifying the document parser (`parseNovelWriterFile`), respect the following rules:

### 1. Header Exclusion Rule (Consolidated Scenes)
* **Rule**: When consolidating sub-scenes inside a chapter container, do NOT display headers (e.g. `### Heading`) unless the heading tag ends with an exclamation mark (`!`) (e.g., `### Scene Title!`). 
* **Scope**: This exclusion rule applies *only* to sub-scene files (where `isScene` is true). Standalone files or parent chapter headers must always be displayed.
* **Separators**: Strip standard separator characters (like `***` or `* * *`) between scenes.

### 2. Reference Tag Parsing
* All reference tags (`@pov:`, `@focus:`, `@char:`, `@mention:`, `@tag:`) must be **split by comma** to support multiple values per tag. Each value is `.trim()`-ed and added to the respective `Set` in `chapterMetadata`.
* Reference tags are consumed during parsing and are NOT rendered as visible text.

### 3. Dialogue Highlighting
* **Rule**: Enclose text inside quotes (`"..."` or `"..."`) in `<span class="speech-quote">` and highlight using `--speech-default`.
* **HTML Attribute Collision Pitfall**: Double quotes inside HTML attributes (e.g., `<button class="footnote-ref" data-hash="abc">`) will collide with the speech quotes regex.
  * **Fix**: Always use single quotes for HTML attributes inside parsed strings: `<sup><button class='footnote-ref' data-hash='${hash}'>` to prevent the speech regex from breaking the HTML syntax.

### 4. Font Autocomplete & Scan
* **Combobox**: The UI utilizes `#font-search-input` and `#font-search-results` for searchable autocomplete.
* **Google Fonts**: Append a `<link>` stylesheet to `document.head` dynamically inside `loadGoogleFont(fontName)` using the URL:
  `https://fonts.googleapis.com/css2?family=${apiFontName}:ital,wght@0,300;0,400;0,500;0,700;1,300;1,400;1,700&display=swap`
* **Local System Fonts**: Query installed fonts using the Local Font Access API (`window.queryLocalFonts()`) and populate `availableFonts["Installed Local Fonts"]`.

### 5. Dynamic Aliases & Mention Badges
* **Nicknames**: The static name mapping is replaced by a runtime dynamic alias dictionary (`dynamicAliases`). 
* **Resolution**:
  * Group all tags in `tagsIndex` pointing to the same document hash as aliases.
  * Split document titles (e.g., "Heinrich Scherer") into individual words, ignore common titles (`commander`, `general`, `members`), and register the words as aliases.
  * Map `"you"` dynamically to the main POV character note (Eisenhardt).

### 6. Layout Presets & Formatting
* **Alignment**: Center lines starting with `>>` and ending with `<<`.
* **Scene Dividers**: Center-aligned short text in double angle brackets (`>> ... <<`) outside the Title Page should render as flanked scene dividers (`.scene-divider`). On the Title Page, center text cleanly without lines.
* **Spacing**: Translate `[br]` to `<br>` and `[vspace:N]` to `<div class="vspace" style="height: {N*1.5}em;"></div>`. A bare `[vspace]` defaults to `N=1`.

### 7. Reading Stats & Word Count
* **Word Count**: Extracted from `bodyContainer.innerText` by splitting on whitespace (excluding bracketed footnote numbers like `[1]`).
* **Reading Time**: Calculated based on 200 WPM, rounded to the nearest minute, with a minimum of 1 minute.
* **Dossier Integration**: Rendered as a dedicated row under `Stats` at the top of `#metadata-dossier`. Hidden on the Title Page.

### 8. Auto-Bookmark & Scroll Resume
* **State Saving**: The current active document path and vertical scroll ratio (scrollTop / scrollHeight) inside `#document-wrapper` are saved in `localStorage` under keys `chronos_bookmark_path` and `chronos_bookmark_ratio`. Saves are debounced by 300ms on scroll.
* **State Restoration**: If the user visits the root page without a `?file=` query parameter, the app navigates to the bookmarked path automatically. When any document is loaded, if its path matches the bookmark path and the ratio is above 1%, the scroll position is restored after a 100ms layout delay, and a floatable `#resume-toast` notification is displayed.
* **UI Controls**: The toast includes a "Restart Chapter" button which resets scrollTop to 0 and updates the saved scroll ratio to 0 in `localStorage`. The Title Page is never bookmarked.

### 9. Zen Focus Mode & Paragraph Spotlight
* **Zen Layout**: Hides `#sidebar`, `#main-header`, and `#progress-bar-container`. `#document-wrapper` is padded and centered. Activated via settings toggle or pressing `Z`. Pressing `Escape` or `Z` or clicking the floating `#zen-exit-btn` exits Zen mode.
* **Paragraph Spotlight**: Reduces opacity of all non-focused elements (`p`, `h1`-`h6`, `.scene-divider`) to 0.25 under `body.spotlight-enabled`. The active block gets opacity 1. Neighbors fade out gradually (`.scroll-neighbor-1` gets `0.65` opacity, `.scroll-neighbor-2` gets `0.4` opacity).
* **Focus Customization**: A dropdown in settings (`settings.spotlightSize`) allows configuring the spotlight spread: 1 paragraph (Narrow), 3 paragraphs (Medium), or 5 paragraphs (Wide).
* **Active State Tracker**: Focuses the block that is hovered, or the block(s) intersecting focus zone bands (defined around a 35% viewport height reading line, plus an overlap check for tall paragraphs to keep them active). Scrolling updates are throttled inside `requestAnimationFrame`.

---

## 🌐 Hosting & Deployment

* **GitHub Pages**: The reader is deployed live at `https://mafiath.github.io/Project-Chronos/reader/`. The `basePath` resolver (`isSubFolder` check on `window.location.pathname`) handles both local and hosted paths automatically.
* **Local Development**: Use `run_reader.sh` (Linux/macOS) or `python3 -m http.server 8001` from the project root, then open `http://localhost:8001/reader/`.

---

## 🧪 Testing & Verification
1. Run syntax verification on JavaScript before staging:
   ```bash
   node -c reader/app.js
   ```
2. Serve locally to verify visual rendering:
   ```bash
   ./run_reader.sh
   ```
   * Confirm that theme changes, typography, and font sliders render immediately.
   * Verify that footnote tooltips open on click.
   * Ensure that the autocomplete font selector correctly renders typeface previews.
   * Verify that metadata dossier badges (POV, Focus, Characters, Mentions) render as separate chips per name, not merged.
   * Verify that clicking a badge navigates to the corresponding lore codex entry.
   * Verify that the `Stats` row (word count and reading time) displays correctly at the top of the dossier, and is hidden on the Title Page.
   * Verify that scrolling a chapter saves the bookmark, reloading the page restores the scroll position, shows the floatable resume toast, and clicking "Restart Chapter" resets to top.
   * Verify that Zen Focus Mode hides headers/sidebars, pressing `Z` or `Esc` toggles it, and Paragraph Spotlight highlights the text block closest to 35% height on scroll or hover.
   * Verify that Arrow Up/Arrow Down smoothly focus the previous/next paragraph, both in and out of Zen Focus Mode.
   * Verify that holding Arrow keys scrolls smoothly and continuous tap-navigation does not get stuck.
   * Verify that pressing `?` or `/` toggles the Keyboard Shortcuts helper modal, and it can also be toggled by clicking the "Shortcuts (?)" header button, the sidebar footer button, or the Zen Mode floating shortcuts button.
   * Verify that pressing `Ctrl + K` or `Cmd + K` toggles the Search Palette modal, automatically focusing the input field.
   * Verify that typing in the search palette filters chapters and lore notes dynamically, and that matches are navigable via Arrow Up / Arrow Down and selectable via Enter.
   * Verify that clicking the "Search (Ctrl+K)" header button or the floating Zen Mode search button opens the palette.
