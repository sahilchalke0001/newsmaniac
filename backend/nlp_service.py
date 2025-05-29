# backend/nlp_service.py
import sys
import json
from newspaper import Article
from transformers import pipeline
import nltk
import torch

# First install required version: pip install googletrans==3.1.0a0
from googletrans import Translator

# --- NLTK Setup ---
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

# Device configuration
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# --- Model Loading ---
# Models are loaded once when the script is first run (by Node.js)
summarizer = None
translator = None

def load_models():
    global summarizer, translator

    if summarizer is not None and translator is not None:
        return # Models already loaded

    try:
        device_id = 0 if DEVICE == "cuda" else -1
        summarizer = pipeline(
            "summarization",
            model="sshleifer/distilbart-cnn-12-6",
            device=device_id
        )
    except Exception as e:
        sys.stderr.write(f"Model load error: {e}\n")
        summarizer = None

    try:
        translator = Translator()
    except Exception as e:
        sys.stderr.write(f"Translator init error: {e}\n")
        translator = None

# Load models when the script starts
load_models()

# --- Translation Function ---
def translate_text(text, target_lang):
    if not translator:
        raise Exception("Translation service not available.")
    try:
        result = translator.translate(text, dest=target_lang)
        return result.text
    except Exception as e:
        raise Exception(f"Translation error ({target_lang}): {e}")

# --- Main processing logic ---
def process_article(url):
    if summarizer is None or translator is None:
        raise Exception("NLP models or translator failed to load.")

    article = Article(url)
    article.download()
    article.parse()

    if not article.text:
        raise Exception("No content found in the article.")

    # Prepare article data
    article_data = {
        "title": article.title,
        "publish_date": str(article.publish_date) if article.publish_date else None,
        "authors": article.authors,
        "top_image": article.top_image,
        "images": list(article.images) if article.images else []
    }

    # Generate summary
    summary = summarizer(
        article.text,
        max_length=150,
        min_length=50,
        do_sample=False
    )[0]['summary_text']

    # Generate translations
    trans_hindi = translate_text(summary, 'hi')
    trans_marathi = translate_text(summary, 'mr')

    return {
        "article_data": article_data,
        "summary": summary,
        "trans_hindi": trans_hindi,
        "trans_marathi": trans_marathi
    }

# --- Command-line interface for Node.js communication ---
if __name__ == '__main__':
    try:
        # Read input URL from stdin (sent by Node.js)
        input_data = json.loads(sys.stdin.read())
        url = input_data.get('url')

        if not url:
            raise ValueError("URL is required.")

        result = process_article(url)
        # Write JSON output to stdout for Node.js to read
        sys.stdout.write(json.dumps(result))
    except Exception as e:
        sys.stderr.write(json.dumps({"error": str(e)}) + '\n')
        sys.exit(1) # Indicate an error to Node.js