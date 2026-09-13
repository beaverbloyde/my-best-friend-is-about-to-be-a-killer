#!/usr/bin/env python3
import os
import re
import urllib.request
import urllib.parse
import json
import unicodedata

CONTENT_DIR = os.path.join(os.path.dirname(__file__), '..', 'content')
AUDIO_DIR = os.path.join(os.path.dirname(__file__), '..', 'audio', 'pronunciations')
INDEX_FILE = os.path.join(AUDIO_DIR, 'index.json')

CYRILLIC_TO_LATIN = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
}

def cyrillic_to_slug(text):
    res = []
    for char in text.lower():
        if char in CYRILLIC_TO_LATIN:
            res.append(CYRILLIC_TO_LATIN[char])
        elif char.isalnum() or char in '-_':
            res.append(char)
    return ''.join(res)

def pinyin_to_slug(pinyin_text):
    nfkd = unicodedata.normalize('NFKD', pinyin_text)
    ascii_text = ''.join([c for c in nfkd if not unicodedata.combining(c)])
    slug = re.sub(r'[^a-zA-Z0-9]+', '_', ascii_text.strip().lower()).strip('_')
    return slug

def extract_terms():
    # Returns a list of dicts: { 'text': str, 'lang': 'ru'|'zh-CN', 'slug': str, 'alt_keys': list[str] }
    terms = []
    seen = set()

    regex_ru = re.compile(r'([А-Яа-яЁё\-]+(?:\s+[А-Яа-яЁё\-]+)*)\s*\[IPA_ru:([^\]]+)\]')
    regex_zh = re.compile(r'([一-龥]+)\s*\/\s*(?:_|\*)*([A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ\s\-]+)(?:_|\*)*\s*\[IPA_zh:([^\]]+)\]')
    
    if not os.path.exists(CONTENT_DIR):
        print(f'Content directory not found: {CONTENT_DIR}')
        return terms

    for root, _, files in os.walk(CONTENT_DIR):
        for f in files:
            if f.endswith('.nwd'):
                path = os.path.join(root, f)
                with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                    content = fp.read()
                    
                    # Russian terms
                    for word, ipa in regex_ru.findall(content):
                        clean_word = word.strip()
                        if clean_word and clean_word not in seen:
                            seen.add(clean_word)
                            slug = cyrillic_to_slug(clean_word)
                            terms.append({
                                'text': clean_word,
                                'lang': 'ru',
                                'slug': slug,
                                'alt_keys': [clean_word.lower(), slug]
                            })
                    
                    # Chinese terms
                    for hanzi, pinyin, ipa in regex_zh.findall(content):
                        clean_hanzi = hanzi.strip()
                        clean_pinyin = pinyin.strip()
                        if clean_hanzi and clean_hanzi not in seen:
                            seen.add(clean_hanzi)
                            slug = pinyin_to_slug(clean_pinyin)
                            nfkd = unicodedata.normalize('NFKD', clean_pinyin)
                            plain_pinyin = ''.join([c for c in nfkd if not unicodedata.combining(c)]).lower()
                            terms.append({
                                'text': clean_hanzi,
                                'lang': 'zh-CN',
                                'slug': slug,
                                'alt_keys': [clean_hanzi, clean_pinyin.lower(), plain_pinyin, slug]
                            })
    return terms

def download_audio(word, lang, filename):
    encoded = urllib.parse.quote(word)
    url = f'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl={lang}&q={encoded}'
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0'}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
            if len(data) > 500:
                with open(filename, 'wb') as out_f:
                    out_f.write(data)
                return True
    except Exception as e:
        print(f'Failed to download audio for "{word}" ({lang}): {e}')
    return False

def sync():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    terms = extract_terms()
    print(f'Found {len(terms)} pronunciation terms across all chapters.')

    index = {}
    if os.path.exists(INDEX_FILE):
        try:
            with open(INDEX_FILE, 'r', encoding='utf-8') as f:
                index = json.load(f)
        except Exception:
            index = {}

    for item in terms:
        word = item['text']
        lang = item['lang']
        slug = item['slug']
        filename = f'{slug}.mp3'
        filepath = os.path.join(AUDIO_DIR, filename)

        if not os.path.exists(filepath) or os.path.getsize(filepath) < 500:
            print(f'Downloading audio for "{word}" ({lang}) -> {filename}...')
            if download_audio(word, lang, filepath):
                print(f'  ✓ Saved {filename}')
            else:
                print(f'  ✗ Failed for {word}')
        
        rel_path = f'audio/pronunciations/{filename}'
        index[word] = rel_path
        index[word.lower()] = rel_path
        for alt in item['alt_keys']:
            index[alt] = rel_path

    with open(INDEX_FILE, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print(f'Pronunciation index saved to {INDEX_FILE} ({len(index)} mappings).')

if __name__ == '__main__':
    sync()
