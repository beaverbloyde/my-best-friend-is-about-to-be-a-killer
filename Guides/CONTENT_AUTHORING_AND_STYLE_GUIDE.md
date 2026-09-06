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

The dialogue in the novel is **grounded, conversational, and natural**—avoiding stiff melodrama or exaggerated accents. Spoken lines reflect modern conversational pacing framed within a Soviet retro-futuristic backdrop.

### Core Characters & Dialogue Styles

| Character | Role & Persona | Spoken Voice & Dialogue Cadence | Key Behavioral Quirks & Dynamics |
| :--- | :--- | :--- | :--- |
| **Luka Huo** | Protagonist & POV. Theoretical physicist fellow at PIRM (half-Chinese, half-Russian). | **Rational, polite, hesitant when unsure, dryly self-aware.** Pauses when what he is saying sounds absurd (*"…I’m here to report a crime. That is—well, how should I put this…"*). Speaks with quiet sincerity rather than bravado. | Observant, slightly guarded, hates looking foolish or wasting people's time. Internal monologue is dry and practical (*"Oh great, now she’s just going to keep dragging me around like her partner-in-crime"*). Reluctantly goes along with Nadya's schemes because his curiosity gets the better of him. |
| **Nadezhda (Nadya) Morozova** | Junior Militsiya intake desk officer at Pogranichny ROVD. | **Energetic, candid, witty, expressive, slightly dramatic.** Shifts rapidly from standard official intake to warm, conspiratorial camaraderie (*"Aha! You almost had me!"*, *"Ugh, this is killing me, comrade. Out of all the times it could have happened, it just has to be on my shift…"*, *"Please… I’ll bring you back whatever you want from town. Snacks, pastries, fidget toys, whatever you like!"*). | Ambitious and restless behind the desk; hates missing out on the action. Scheming and opportunistic in a playful way (talks Senya into covering her shift so she can sneak out to the crime scene). Openly teases back (*"Ugh, Uncle, I’ve told you a hundred times that I like women, haven’t I?"*). |
| **Uncle Senya (Semyon)** | Veteran *Starshina* (Senior Sergeant), station administrative anchor. | **Earthy, relaxed, grandfatherly, fond of teasing.** Gravelly conversational rhythm (*"So… What can I do for you, lass?"*, *"Woah, woah, hold on right there! Don’t fill an old man's head with gory images before breakfast! It’ll ruin my morning tea."*, *"Don't let Tarasov bite your heads off!"*). | Veteran who has seen everything and prefers a quiet cup of tea over unnecessary drama. Sees right through Nadya’s scheming, but indulges her anyway because he enjoys supporting eager youth (and getting free oolong tea). |
| **Aleksey (Alex) Volkov** | Luka's best friend. Brilliant hardware engineer at PIRM. | **Outgoing, effortless, charismatic, warm.** Casual and relaxed (*"Hey bro, wanna go out for a drink tonight?"*). | Sharp and effortlessly handsome—the quintessential popular-guy profile. Despite looking like someone who should be insufferable, he is genuinely kind, brilliant, and fiercely loyal to Luka. The mystery revolves around Luka's vision of him committing/involved in a future killing. |

---

### Golden Rules for Prose & Dialogue Editing

1. **Dialogue Stays Casual & Grounded**: When refining prose, **do not overwrite or formalize character dialogue**. Preserve short sentence structures, natural hesitation marks, trailing ellipses, and everyday conversational banter.
2. **Rich Prose, Lean Speech**: Keep atmospheric worldbuilding, weather, sensory cues, and internal thoughts rich and evocative in the narrative paragraphs, while keeping spoken dialogue swift and punchy.
3. **Dialogue Tag Restraint**: Let the spoken words carry the emotion. Avoid stacking heavy adverbs onto speech tags (prefer simple `said`, `asked`, `replied`, or action beats).

## ❄️ Worldbuilding & Setting Standards (Pogranichny 2118)

- **Setting**: Pogranichny, Primorsky Krai, USSR, Year 2118 (Alternative Retro-Futuristic Timeline).
- **Aesthetic**: Soviet Neoclassical stone architecture fused with high-tech Soviet electronics (Setun balanced-ternary computers, e-paper tablets, aerogel insulation, GLONASS satellite guidance).
- **The Event**: The *Time Ripple* catastrophe occurred 3 months prior, causing temporal displacements, ripple sickness, and localized reality distortions.
