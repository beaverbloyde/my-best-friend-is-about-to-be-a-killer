#!/usr/bin/env python3
import os
import re
import urllib.request
import urllib.parse
import json

CONTENT_DIR = os.path.join(os.path.dirname(__file__), '..', 'content')
AUDIO_DIR = os.path.join(os.path.dirname(__file__), '..', 'reader', 'audio', 'pronunciations')
INDEX_FILE = os.path.join(AUDIO_DIR, 'index.json')

CYRILLIC_TO_LATIN = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
}

def transliterate(text):
    res = []
    for char in text.lower():
        if char in CYRILLIC_TO_LATIN:
            res.append(CYRILLIC_TO_LATIN[char])
        elif char.isalnum() or char in '-_':
            res.append(char)
    return ''.join(res)

def extract_russian_terms():
    terms = set()
    regex = re.compile(r'([А-Яа-яЁё\-]+(?:\s+[А-Яа-яЁё\-]+)*)\s*\[([^\]]+)\]')
    
    if not os.path.exists(CONTENT_DIR):
        print(f'Content directory not found: {CONTENT_DIR}')
        return terms

    for root, _, files in os.walk(CONTENT_DIR):
        for f in files:
            if f.endswith('.nwd'):
                path = os.path.join(root, f)
                with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                    content = fp.read()
                    matches = regex.findall(content)
                    for word, ipa in matches:
                        clean_word = word.strip()
                        if clean_word:
                            terms.add(clean_word)
    return terms

def download_audio(word, filename):
    encoded = urllib.parse.quote(word)
    url = f'https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ru&q={encoded}'
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
        print(f'Failed to download audio for "{word}": {e}')
    return False

def sync():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    terms = extract_russian_terms()
    print(f'Found {len(terms)} Russian terms across all chapters: {terms}')

    index = {}
    if os.path.exists(INDEX_FILE):
        try:
            with open(INDEX_FILE, 'r', encoding='utf-8') as f:
                index = json.load(f)
        except Exception:
            index = {}

    for word in terms:
        key = word.lower()
        slug = transliterate(key)
        filename = f'{slug}.mp3'
        filepath = os.path.join(AUDIO_DIR, filename)

        if not os.path.exists(filepath) or os.path.getsize(filepath) < 500:
            print(f'Downloading audio for "{word}" -> {filename}...')
            if download_audio(word, filepath):
                print(f'  ✓ Saved {filename}')
            else:
                print(f'  ✗ Failed for {word}')
        
        index[key] = f'audio/pronunciations/{filename}'
        index[slug] = f'audio/pronunciations/{filename}'

    with open(INDEX_FILE, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)
    print(f'Pronunciation index saved to {INDEX_FILE} ({len(index)} mappings).')

if __name__ == '__main__':
    sync()
