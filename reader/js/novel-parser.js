/**
 * LOGOS-3 NOVELWRITER MARKUP PARSER
 * Headless parser for NovelWriter files (.nwd), bracket metadata, speech quotes, inline tags & footnotes.
 */
(function (global) {
    'use strict';

    const LogosNovelParser = {
        parseParagraphSpeech(paragraph) {
            const speechRegex = /[“"]([^”"]+)[”"]/g;
            if (!paragraph.match(speechRegex)) return paragraph;

            const styledParagraph = paragraph.replace(speechRegex, (match, speechContent) => {
                return `<span class="speech-quote">“${speechContent}”</span>`;
            });

            return `<p class="has-speech">${styledParagraph}</p>`;
        },

        applyInlineFormatting(text, options = {}) {
            const { totalKeywordsSet = new Set(), isScene = false } = options;
            let formatted = text;

            // 1. Russian Cyrillic + IPA phonetic pronunciation buttons: e.g. (Валенки [IPA_ru:ˈvalʲɪnkʲɪ])
            formatted = formatted.replace(/([А-Яа-яЁё\-]+(?:\s+[А-Яа-яЁё\-]+)*)\s*\[IPA[_-]ru:([^\]]+)\]/g, (match, word, ipa) => {
                const cleanWord = word.trim();
                const cleanIpa = ipa.trim();
                return `${cleanWord} <button type="button" class="pronounce-btn" data-speak="${cleanWord}" data-lang="ru-RU" title="Click to hear Russian pronunciation: ${cleanWord}">🔊 &#91;${cleanIpa}&#93;</button>`;
            });

            // 2. Chinese Hanzi + Pinyin + IPA pronunciation buttons: e.g. (东北 / _Dōngběi_ [IPA_zh:tʊ́ŋ.pèi])
            formatted = formatted.replace(/([一-龥]+)\s*\/\s*(?:_|\*)*([A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s\-]+)(?:_|\*)*\s*\[IPA[_-]zh:([^\]]+)\]/g, (match, hanzi, pinyin, ipa) => {
                const cleanHanzi = hanzi.trim();
                const cleanPinyin = pinyin.trim();
                const cleanIpa = ipa.trim();
                return `${cleanHanzi} / <em>${cleanPinyin}</em> <button type="button" class="pronounce-btn" data-speak="${cleanHanzi}" data-lang="zh-CN" title="Click to hear Chinese pronunciation: ${cleanHanzi} (${cleanPinyin})">🔊 &#91;${cleanIpa}&#93;</button>`;
            });

            // 3. Parse Chinese Hanzi + IPA without pinyin: e.g. (东北 [IPA_zh:tʊ́ŋ.pèi])
            formatted = formatted.replace(/([一-龥]+)\s*\[IPA[_-]zh:([^\]]+)\]/g, (match, hanzi, ipa) => {
                const cleanHanzi = hanzi.trim();
                const cleanIpa = ipa.trim();
                return `${cleanHanzi} <button type="button" class="pronounce-btn" data-speak="${cleanHanzi}" data-lang="zh-CN" title="Click to hear Chinese pronunciation: ${cleanHanzi}">🔊 &#91;${cleanIpa}&#93;</button>`;
            });

            // 4. Generic fallback for any [IPA_lang:ipa] tags
            formatted = formatted.replace(/\[IPA[_-]([a-zA-Z0-9\-_]+):([^\]]+)\]/g, (match, lang, ipa) => {
                const cleanIpa = ipa.trim();
                return `<span class="ipa-text">&#91;${cleanIpa}&#93;</span>`;
            });

            // 5. Bold **text**
            formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

            // Italic *text* or _text_
            formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
            formatted = formatted.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');

            // Strikethrough ~~text~~
            formatted = formatted.replace(/~~([^~]+)~~/g, '<del>$1</del>');

            // 6. Collectible Keywords / Character Mentions: [Word]
            formatted = formatted.replace(/\[(?!br\b|vspace\b|field:|footnote:|img:|b\b|\/b\b|i\b|\/i\b|IPA[_-][a-zA-Z0-9\-_]+:|slot:|num:)([^\]]+)\]/g, (match, word) => {
                const cleanWord = word.trim();
                if (!cleanWord || cleanWord.startsWith('%%') || cleanWord.startsWith('@')) {
                    return match;
                }

                // If Russian Cyrillic word, enrich with phonetic pronunciation button
                const hasCyrillic = /[а-яА-ЯёЁ]/.test(cleanWord);
                const pronounceHtml = hasCyrillic
                    ? `<button type="button" class="pronounce-btn" data-speak="${cleanWord}" data-word="${cleanWord}" title="Hear Pronunciation (Russian Audio)">🔊</button>`
                    : '';

                return `<span class="reader-kw" data-word="${cleanWord}" tabindex="0" role="button" title="Keyword: Click to collect for deduction">${cleanWord}${pronounceHtml}</span>`;
            });

            return formatted;
        },

        parseNovelWriterFile(rawText, options = {}) {
            const {
                isScene = false,
                totalNovelWords = 0,
                chapterMetadata = { povs: new Set(), focuses: new Set(), characters: new Set(), mentions: new Set(), tags: new Set() },
                footnoteMap = {},
                encounteredFootnotes = []
            } = options;

            const lines = rawText.split('\n');
            let html = '';
            let isTitlePage = false;

            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) return;

                // 1. Metadata Block
                if (trimmed.startsWith('%%~')) {
                    if (trimmed.startsWith('%%~name:')) {
                        const docName = trimmed.substring(8).trim().toLowerCase();
                        if (docName.includes('title page')) {
                            isTitlePage = true;
                        }
                    }
                    return;
                }

                // 2. Reference tags
                if (trimmed.startsWith('@pov:')) {
                    trimmed.substring(5).split(',').forEach(c => chapterMetadata.povs.add(c.trim()));
                    return;
                }
                if (trimmed.startsWith('@focus:')) {
                    trimmed.substring(7).split(',').forEach(c => chapterMetadata.focuses.add(c.trim()));
                    return;
                }
                if (trimmed.startsWith('@char:')) {
                    trimmed.substring(6).split(',').forEach(c => chapterMetadata.characters.add(c.trim()));
                    return;
                }
                if (trimmed.startsWith('@mention:')) {
                    trimmed.substring(9).split(',').forEach(m => chapterMetadata.mentions.add(m.trim()));
                    return;
                }
                if (trimmed.startsWith('@tag:')) {
                    trimmed.substring(5).split(',').forEach(c => chapterMetadata.tags.add(c.trim()));
                    return;
                }

                // 3. Footnote definitions: %Footnote.hash: content
                const fnMatch = trimmed.match(/^%Footnote\.(\w+):\s*(.*)$/);
                if (fnMatch) {
                    footnoteMap[fnMatch[1]] = this.applyInlineFormatting(fnMatch[2], options);
                    return;
                }

                // Spacing and Fields preprocessing
                let lineText = trimmed;
                lineText = lineText.replace(/\[br\]/g, '<br>');
                const formattedWords = Number(totalNovelWords || 0).toLocaleString();
                lineText = lineText.replace(/\[field:textWords\]/g, formattedWords);

                const vspaceMatch = lineText.match(/^\[vspace:?(\d+)?\]$/);
                if (vspaceMatch) {
                    const multiplier = vspaceMatch[1] ? parseInt(vspaceMatch[1], 10) : 1;
                    html += `<div class="vspace" style="height: ${multiplier * 1.5}em;"></div>`;
                    return;
                }

                // 4. Headings
                if (lineText.startsWith('#')) {
                    const hashMatch = lineText.match(/^(#+)/);
                    if (hashMatch) {
                        const level = hashMatch[1].length;
                        const rest = lineText.substring(level).trim();
                        const hasBang = lineText.startsWith('#'.repeat(level) + '!');
                        const isDisplayHeader = !isScene || hasBang;

                        if (isDisplayHeader) {
                            let cleanHeading = rest;
                            if (cleanHeading.startsWith('!')) {
                                cleanHeading = cleanHeading.substring(1).trim();
                            }
                            html += `<h${level}>${cleanHeading}</h${level}>`;
                        }
                        return;
                    }
                }

                // 5. Alignment check
                let alignClass = '';
                let isTransition = false;

                if (lineText.startsWith('>>') && lineText.endsWith('<<')) {
                    lineText = lineText.substring(2, lineText.length - 2).trim();
                    if (!isTitlePage && lineText.length < 50 && !lineText.includes('**') && !lineText.includes('_') && !lineText.includes('*')) {
                        isTransition = true;
                    } else {
                        alignClass = 'align-center';
                    }
                } else if (lineText.startsWith('>>')) {
                    lineText = lineText.substring(2).trim();
                    alignClass = 'align-right';
                } else if (lineText.endsWith('<<')) {
                    lineText = lineText.substring(0, lineText.length - 2).trim();
                    alignClass = 'align-left';
                }

                if (isTransition) {
                    html += `<div class="scene-divider"><span>${lineText}</span></div>`;
                    return;
                }

                // 6. Regular Paragraph Body
                let parsedLine = this.parseParagraphSpeech(lineText);
                parsedLine = this.applyInlineFormatting(parsedLine, options);

                parsedLine = parsedLine.replace(/\[footnote:(\w+)\]/g, (match, hash) => {
                    let fnIndex = encounteredFootnotes.indexOf(hash);
                    if (fnIndex === -1) {
                        encounteredFootnotes.push(hash);
                        fnIndex = encounteredFootnotes.length;
                    } else {
                        fnIndex = fnIndex + 1;
                    }
                    return `<sup><button class='footnote-ref' data-hash='${hash}'>[${fnIndex}]</button></sup>`;
                });

                if (parsedLine.includes('class="has-speech"')) {
                    if (alignClass) {
                        parsedLine = parsedLine.replace('class="has-speech"', `class="has-speech ${alignClass}"`);
                    }
                    html += parsedLine;
                } else {
                    const classAttr = alignClass ? ` class="${alignClass}"` : '';
                    html += `<p${classAttr}>${parsedLine}</p>`;
                }
            });

            return html;
        }
    };

    global.LogosNovelParser = LogosNovelParser;
})(typeof window !== 'undefined' ? window : globalThis);
