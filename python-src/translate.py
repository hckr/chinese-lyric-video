import os
from pprint import pprint
import time
import jieba
import json
import re
from opencc import OpenCC
from google import genai
from google.genai.types import AutomaticFunctionCallingConfig, GenerateContentConfig, ThinkingConfig, ThinkingLevel
from dotenv import load_dotenv

# 1. Load Environment Variables & Configure Gemini
load_dotenv()  # This reads the .env file

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    raise ValueError(
        "GEMINI_API_KEY not found! Make sure you created a .env file.")

client = genai.Client(api_key=API_KEY)

cc = OpenCC('t2s')  # Traditional to Simplified converter


# 2. Load Dictionary Data
def load_cedict(file_path):
    cedict = {}
    with open(file_path, 'r', encoding='utf-8') as file:
        for line in file:
            if line.startswith('#'): continue
            # Format: Traditional Simplified [pinyin] /def 1/def 2/
            match = re.match(r'(.*?) (.*?) \[(.*?)\] /(.*)/', line)
            if match:
                _trad, simp, pinyin, defs = match.groups()

                if simp not in cedict:
                    cedict[simp] = []

                cedict[simp].append(f"[{pinyin}] /{defs}/")

    return cedict


print("Loading dictionary... (Takes a few seconds)")
cedict = load_cedict("../public/cedict_1_0_ts_utf-8_mdbg.txt")

# Force Jieba to recognize dictionary words (prevents splitting idioms)
for word in cedict.keys():
    jieba.add_word(word)

# 3. Input Phrases
phrases = ["第三层", "你吃过饺子吗？", "谁有四把椅子？", "妈妈呢？"]

# 4. Process & Translate EACH Phrase Separately
final_results = {}
MODEL_NAME = 'gemma-4-31b-it'

for phrase in phrases:
    print(f"\nProcessing: {phrase}")

    simp_phrase = cc.convert(phrase)
    words = list(jieba.cut(simp_phrase))
    characters = list(simp_phrase)
    all_tokens = set(words + characters)

    # Grab dictionary definitions strictly for this phrase
    phrase_context = []
    for token in all_tokens:
        if token in cedict:
            for definition in cedict[token]:
                phrase_context.append(f"{token}: {definition}")

    # pprint(words)
    # pprint(phrase_context)

    # Build LLM Prompt for this single phrase
    prompt = f"""
    You are an expert Chinese translator. Translate the following Chinese phrase.

    DICTIONARY CONTEXT:
    {chr(10).join(phrase_context)}

    PHRASE TO TRANSLATE:
    "{simp_phrase}"

    INSTRUCTIONS:
    1. Output a JSON object containing the translation and the word-by-word breakdown.
    2. GRAMMATICAL GENDER: Do NOT assume gender. Use gender-neutral phrasing in English and Polish.
    3. SYNONYMS: In the word array, provide multiple good translations separated by slashes (e.g., "to want / to desire").
    4. Ignore punctuation marks for the word-by-word breakdown.
    5. Non-Chinese elements should have empty hanzi/pinyin fields.

    Output format strictly as:
    {{
      "translation": {{ "en": "...", "pl": "..." }},
      "words": [
        {{ "hanzi": "word1", "pinyin": "pinyin1", "translation": {{ "en": "meaning 1 / meaning 2" }} }}
      ]
    }}
    """

    try:
        # Call the LLM for this specific phrase
        max_retries = 5
        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model=MODEL_NAME,
                    contents=prompt,
                    config=GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1,
                        thinking_config=ThinkingConfig(
                            thinking_level=ThinkingLevel.HIGH),
                        automatic_function_calling=
                        AutomaticFunctionCallingConfig(disable=True),
                    ),
                )

                phrase_data = json.loads(response.text)

                # Save it into our final dictionary under the phrase key
                final_results[simp_phrase] = phrase_data
                pprint(response)
                print(
                    f"✓ Translated!"
                )  # Sleep for 2 seconds after a success to avoid triggering rate limits on the next loop iteration
                time.sleep(2)
                break  # Break out of the retry loop and move to the next phrase

            except Exception as e:
                error_str = str(e)
                # Catch server busy (503) or rate limit (429) errors
                if '503' in error_str or '429' in error_str:
                    wait_time = 2**attempt  # Waits 1s, 2s, 4s, 8s...
                    print(f"Server busy. Retrying in {wait_time} seconds...")
                    print(error_str)
                    time.sleep(wait_time)
                else:
                    print(f"✗ Failed to translate '{simp_phrase}': {e}")
                    break  # If it's a different error (like bad JSON), skip to the next phrase

    except Exception as e:
        print(f"✗ Failed to translate '{simp_phrase}': {e}")

# 5. Output the Result
print("\n--- FINAL TRANSLATION RESULT ---\n")
print(json.dumps(final_results, ensure_ascii=False, indent=2))
