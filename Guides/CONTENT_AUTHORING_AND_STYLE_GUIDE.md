# Content Authoring & Prose Style Guide

This guide outlines authoring rules, narrative tone, formatting conventions, and worldbuilding standards for **My Best Friend is (about to be) A Killer**.

---

## 📖 Chapter File Format (`content/*.nwd`)

All novel content files are plain text `.nwd` files conforming to the novelWriter format.

### Header & Metadata Structure
```text
%Title: The Charred Body
%Encoding: UTF-8

@pov: Luka Huo
@focus: Uncle Senya
@char: Luka Huo, Uncle Senya
@tag: ROVD, Crime Scene, Far East

### Scene Heading (Only displayed if ending in '!')

A silver-haired senior officer stomped the Siberian snow from his heavy valenki[footnote:fg5hd]...

%Footnote.fg5hd: _Valenki_ (Валенки [ˈvalʲɪnkʲɪ]): Traditional seamless Russian winter boots crafted from pressed sheep's wool felt.
```

---

## 🇷🇺 Russian Words & Footnotes Rules

When introducing Russian terms, cultural objects, or Soviet administrative ranks:

1. **Inline Reference**: Append `[footnote:<unique_5char_id>]` immediately to the term in the prose (e.g. `valenki[footnote:fg5hd]`, `Starshina[footnote:fvtrp]`).
2. **Footnote Definition Syntax**:
   - Place `%Footnote.<id>:` at the bottom of the scene.
   - Include:
     - The English/Transliterated term in italics.
     - Cyrillic spelling and phonetic **IPA in square brackets**: `(Валенки [ˈvalʲɪnkʲɪ])`.
     - A concise, historically and culturally accurate explanation.
3. **Automatic Audio Synchronization**:
   - The reader engine scans `([А-Яа-яЁё\-]+(?:\s+[А-Яа-яЁё\-]+)*)\s*\[([^\]]+)\]` to automatically create an interactive audio pronunciation button.
   - Running `python3 scripts/sync_pronunciations.py` automatically caches the pronunciation MP3 file.

---

## 🧩 Collectible Gameplay Keywords

To make key nouns, locations, or clues collectible for the Detective Deduction Game:
- Wrap the word or phrase in brackets: `[Valenki]`, `[Aerogel]`, `[Time Ripple]`.
- Inside the novel reader, this renders as an interactive keyword chip.
- In deduction cases scoped to this chapter, the player can drag or autocomplete these words into case dockets.

---

## 🎭 Character Voices & Dialogue Guidelines

Maintain natural, grounded dialogue with distinct character identities:

| Character | Voice & Cadence | Behavioral Quirks |
| :--- | :--- | :--- |
| **Luka Huo** | Calm, observant, introspective, dryly humorous. Expatriate researcher from China working in the Soviet Far East. | Analytic, grounded, slightly guarded, careful with procedures. |
| **Igor Solovyov** | Charismatic, playful, enigmatic, unpredictable, intellectually agile. | Speaks casually with understated sharpness; hides secrets under a relaxed grin. |
| **Uncle Senya (Semyon)** | Veteran *Starshina* (Senior Sergeant). Gravelly, paternal, pragmatic, Siberian-hardened. | Stomps snow off boots, scratches his chin through his ushanka, knows everyone in the district. |
| **Nadezhda** | Crisp, efficient, sharp desk officer at the ROVD counter. | Swift keyboard clatter, balanced-ternary terminal queries, no-nonsense professionalism. |

---

## ❄️ Worldbuilding & Setting Standards (Pogranichny 2118)

- **Setting**: Pogranichny, Primorsky Krai, USSR, Year 2118 (Alternative Retro-Futuristic Timeline).
- **Aesthetic**: Soviet Neoclassical stone architecture fused with high-tech Soviet electronics (Setun balanced-ternary computers, e-paper tablets, aerogel insulation, GLONASS satellite guidance).
- **The Event**: The *Time Ripple* catastrophe occurred 3 months prior, causing temporal displacements, ripple sickness, and localized reality distortions.
