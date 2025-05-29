import sys
import json
import os
import requests
import nltk
import numpy as np
import cv2
import textwrap
import tempfile
import shutil
import io
import ffmpeg
import torch
from newspaper import Article
from transformers import pipeline
from gtts import gTTS
from PIL import Image, ImageDraw, ImageFont
from pydub import AudioSegment
from googletrans import Translator
import traceback

# --- Global Configurations ---

# Set path to FFmpeg and FFprobe executables
# IMPORTANT: REPLACE THIS WITH THE ACTUAL PATH TO YOUR FFmpeg/bin FOLDER
# Example: FFMPEG_BIN_PATH = r"C:\ffmpeg\bin"
FFMPEG_BIN_PATH = r"C:\ffmpeg-master-latest-win64-gpl-shared\bin" # <--- **DOUBLE-CHECK AND UPDATE THIS PATH**

# Set the PATH environment variable for this Python process
# Do this as early as possible so pydub and ffmpeg-python can find ffmpeg/ffprobe
if os.path.exists(os.path.join(FFMPEG_BIN_PATH, "ffmpeg.exe")):
    if FFMPEG_BIN_PATH not in os.environ["PATH"]: # Prevent adding it multiple times
        os.environ["PATH"] += os.pathsep + FFMPEG_BIN_PATH
        sys.stderr.write(f"Added FFmpeg bin path to system PATH for current process: {FFMPEG_BIN_PATH}\n")
    else:
        sys.stderr.write(f"FFmpeg bin path already in PATH for current process: {FFMPEG_BIN_PATH}\n")
else:
    sys.stderr.write(f"ERROR: FFmpeg bin path not found at {FFMPEG_BIN_PATH}. Please verify the path. Video generation will likely fail.\n")


# Set device for Hugging Face pipelines
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
sys.stderr.write(f"Device set to use {DEVICE}\n")

# Path for saving generated videos. Ensure this directory exists.
# Videos will be served by Node.js from http://localhost:3001/uploads/
VIDEO_OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(VIDEO_OUTPUT_DIR, exist_ok=True) # Ensure directory exists

# --- Initialize Hugging Face Pipelines ---
try:
    # Use a smaller, faster summarization model
    summarizer = pipeline("summarization", model="sshleifer/distilbart-cnn-6-6", device=0 if DEVICE == "cuda" else -1)
    sys.stderr.write("Summarization pipeline initialized.\n")
except Exception as e:
    sys.stderr.write(f"Error initializing summarization pipeline: {e}\n")
    summarizer = None # Set to None if initialization fails

# --- Translator Initialization ---
translator = Translator()
sys.stderr.write("Google Translator initialized.\n")

# --- Helper Functions ---

# Function to get a font file for text overlay
def get_font_path(font_name="arial.ttf"):
    # Try to find the font in the script's directory first
    script_dir = os.path.dirname(os.path.abspath(__file__))
    font_path = os.path.join(script_dir, font_name)
    if os.path.exists(font_path):
        return font_path
    else:
        sys.stderr.write(f"Warning: Font file not found at {font_path}. Using a default font, which might not look as expected.\n")
        return None

def clean_text(text):
    """Basic text cleaning for summarization."""
    if not text:
        return ""
    # Remove excessive newlines and trim whitespace
    text = text.replace('\n', ' ').replace('\r', '').strip()
    # Replace multiple spaces with a single space
    text = ' '.join(text.split())
    return text

def split_text_into_lines(text, max_width_chars=50):
    """Splits a long text into lines for better display on an image."""
    lines = []
    paragraphs = text.split('\n')
    for para in paragraphs:
        lines.extend(textwrap.wrap(para, width=max_width_chars))
    return lines

def generate_tts_audio(text, temp_dir):
    """Generates an MP3 audio file from text using gTTS."""
    if not text:
        sys.stderr.write("Error: No text provided for TTS audio generation.\n")
        return None
    try:
        tts = gTTS(text=text, lang='en', slow=False)
        audio_filename = f"audio_{os.urandom(8).hex()}.mp3"
        audio_path = os.path.join(temp_dir, audio_filename)
        tts.save(audio_path)
        sys.stderr.write(f"DEBUG: Audio saved to {audio_path}\n")
        return audio_path
    except Exception as e:
        sys.stderr.write(f"Error generating TTS audio: {e}\n")
        sys.stderr.write(f"Traceback: {traceback.format_exc()}\n")
        return None

def resize_and_pad_image(image_pil, target_width, target_height):
    """Resizes and pads an image to fit a target resolution with black bars."""
    original_width, original_height = image_pil.size
    original_aspect = original_width / original_height
    target_aspect = target_width / target_height

    if original_aspect > target_aspect: # Original is wider
        new_width = target_width
        new_height = int(new_width / original_aspect)
    else: # Original is taller or same aspect
        new_height = target_height
        new_width = int(new_height * original_aspect)

    resized_image = image_pil.resize((new_width, new_height), Image.Resampling.LANCZOS)

    # Create a new blank image with the target dimensions
    padded_image = Image.new("RGB", (target_width, target_height), (0, 0, 0)) # Black background
    # Paste the resized image onto the center of the padded image
    paste_x = (target_width - new_width) // 2
    paste_y = (target_height - new_height) // 2
    padded_image.paste(resized_image, (paste_x, paste_y))

    return padded_image

def add_text_to_image(image_pil, text_summary, font_size=40, text_color=(255, 255, 255), max_width_chars=60):
    """Adds wrapped text summary as an overlay to the image."""
    draw = ImageDraw.Draw(image_pil)
    font_path = get_font_path("arial.ttf") # Use the helper to get font path

    try:
        if font_path:
            font = ImageFont.truetype(font_path, font_size)
        else:
            font = ImageFont.load_default() # Fallback to PIL's default font
    except Exception as e:
        sys.stderr.write(f"Error loading specified font: {e}. Falling back to default font.\n")
        font = ImageFont.load_default() # Fallback to PIL's default font

    lines = split_text_into_lines(text_summary, max_width_chars)

    # Calculate text height to center it
    total_text_height = sum(draw.textbbox((0, 0), line, font=font)[3] - draw.textbbox((0, 0), line, font=font)[1] for line in lines)
    y_text = (image_pil.height - total_text_height) // 2

    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        line_width = bbox[2] - bbox[0]
        x_text = (image_pil.width - line_width) // 2
        draw.text((x_text, y_text), line, font=font, fill=text_color)
        y_text += font_size + 5 # Add some line spacing

    return image_pil

def generate_video_from_summary(summary, image_url, output_dir, output_filename="summary_video.mp4"):
    """
    Generates a video from a summary and an image URL.
    The video consists of the image with text overlay and the summary audio.
    """
    temp_files = [] # To keep track of temporary files for cleanup
    try:
        if not summary or not image_url:
            sys.stderr.write("Error: Summary or image URL missing for video generation.\n")
            return None

        # 1. Generate TTS Audio
        temp_audio_path = generate_tts_audio(summary, tempfile.gettempdir())
        if not temp_audio_path:
            sys.stderr.write("Error: Audio generation failed for video (TTS creation problem).\n")
            return None
        temp_files.append(temp_audio_path)

        # pydub will now rely on the system PATH correctly set above
        audio_segment = AudioSegment.from_file(temp_audio_path)
        audio_duration = audio_segment.duration_seconds

        # 2. Download and process image
        try:
            img_response = requests.get(image_url, stream=True)
            img_response.raise_for_status()
            img_pil = Image.open(io.BytesIO(img_response.content)).convert("RGB")
        except requests.exceptions.RequestException as e:
            sys.stderr.write(f"Error downloading image from {image_url}: {e}\n")
            return None
        except Exception as e:
            sys.stderr.write(f"Error processing image: {e}\n")
            return None

        target_width = 1280
        target_height = 720 # Standard HD resolution
        img_pil = resize_and_pad_image(img_pil, target_width, target_height)
        img_with_text = add_text_to_image(img_pil, summary)

        # Save processed image to a temporary file
        temp_image_path = os.path.join(tempfile.gettempdir(), f"processed_image_{os.urandom(8).hex()}.png")
        img_with_text.save(temp_image_path)
        temp_files.append(temp_image_path)
        sys.stderr.write(f"DEBUG: Processed image saved to {temp_image_path}\n")

        # 3. Combine image and audio using ffmpeg-python
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        final_video_relative_path = os.path.join('uploads', output_filename) # Relative path for client
        final_video_full_path = os.path.join(output_dir, output_filename)

        sys.stderr.write(f"DEBUG: Combining image '{temp_image_path}' and audio '{temp_audio_path}' into '{final_video_full_path}'\n")

        # Create input streams for both image (as video) and audio
        image_stream = ffmpeg.input(temp_image_path, loop=1, t=audio_duration) # Loop image for audio duration
        audio_stream = ffmpeg.input(temp_audio_path)

        # Use ffmpeg-python to run the command
        (
            ffmpeg
            .output(image_stream, audio_stream, # Pass both streams as inputs to the output
                    final_video_full_path,
                    vcodec='libx264',
                    acodec='aac',
                    preset='fast',
                    pix_fmt='yuv420p',
                    vf=f'scale={target_width}:{target_height},format=yuv420p', # Added format filter
                    shortest=None, # Ensure video ends with shortest stream (audio)
                    threads=0) # Use all available threads
            .overwrite_output() # Overwrite if output file exists
            .run(capture_stdout=False, capture_stderr=True) # Capture stderr for debugging ffmpeg process
        )

        sys.stderr.write(f"DEBUG: Video successfully generated at {final_video_full_path}\n")
        return final_video_relative_path # Return relative path for client

    except ffmpeg.Error as e:
        # This specifically catches errors from the ffmpeg-python library when it runs FFmpeg
        sys.stderr.write(f"FFmpeg command failed: {e.stderr.decode('utf8')}\n")
        sys.stderr.write(f"Traceback: {traceback.format_exc()}\n")
        return None
    except Exception as e: # This general exception will catch any other unhandled errors
        sys.stderr.write(f"An unexpected error occurred during video generation: {e}\n")
        sys.stderr.write(f"Traceback: {traceback.format_exc()}\n")
        return None
    finally:
        # Clean up temporary files
        for f in temp_files:
            if os.path.exists(f):
                os.remove(f)
                sys.stderr.write(f"DEBUG: Cleaned up temporary file: {f}\n")

# --- Main Article Processing Function ---
def process_article(url):
    response_data = {
        "title": None,
        "summary": None,
        "keywords": [],
        "top_image": None,
        "authors": [],
        "publish_date": None,
        "video_path": None,
        "trans_hindi": None,
        "trans_marathi": None,
        "error": None
    }
    try: # <--- This is the try statement Pylance is complaining about
        # 1. Article Extraction
        article = Article(url)
        article.download()
        article.parse()
        article.nlp() # Performs summarization, keyword extraction

        response_data["title"] = article.title
        response_data["keywords"] = article.keywords
        response_data["top_image"] = article.top_image
        response_data["authors"] = article.authors
        response_data["publish_date"] = str(article.publish_date) if article.publish_date else None

        cleaned_text = clean_text(article.text)

        # 2. Summarization (using Hugging Face)
        if summarizer and cleaned_text:
            try:
                # Limit input length to what the model can handle
                max_model_input = summarizer.model.config.max_position_embeddings
                # For distilbart-cnn-6-6, max_position_embeddings is 1024
                # We need to tokenize the text to be precise, but for now, simple char limit
                if len(cleaned_text) > max_model_input * 2: # Rough estimate: 2 chars per token
                    summary_input = cleaned_text[:max_model_input * 2]
                else:
                    summary_input = cleaned_text

                summary_result = summarizer(summary_input, max_length=150, min_length=50, do_sample=False)
                summary_text = summary_result[0]['summary_text']
                response_data["summary"] = summary_text
                sys.stderr.write("DEBUG: Article summarized.\n")
            except Exception as e:
                response_data["summary"] = None
                response_data["error"] = f"Summarization failed: {e}"
                sys.stderr.write(f"Error during summarization: {e}\n")
                sys.stderr.write(f"Traceback: {traceback.format_exc()}\n")
        else:
            response_data["error"] = "Summarizer not initialized or no text to summarize."
            sys.stderr.write("Warning: Summarizer not initialized or no text for summarization.\n")

        # 3. Translations
        if response_data["summary"]:
            try:
                hindi_trans = translator.translate(response_data["summary"], dest='hi').text
                response_data["trans_hindi"] = hindi_trans
                sys.stderr.write("DEBUG: Translated to Hindi.\n")
            except Exception as e:
                response_data["trans_hindi"] = None
                sys.stderr.write(f"Error translating to Hindi: {e}\n")
                sys.stderr.write(f"Traceback: {traceback.format_exc()}\n")

            try:
                marathi_trans = translator.translate(response_data["summary"], dest='mr').text
                response_data["trans_marathi"] = marathi_trans
                sys.stderr.write("DEBUG: Translated to Marathi.\n")
            except Exception as e:
                response_data["trans_marathi"] = None
                sys.stderr.write(f"Error translating to Marathi: {e}\n")
                sys.stderr.write(f"Traceback: {traceback.format_exc()}\n")

        # 4. Video Generation
        if response_data["summary"] and response_data["top_image"]:
            try:
                # Use a unique filename to avoid conflicts if multiple videos are generated
                video_filename = f"summary_video_{os.urandom(8).hex()}.mp4"
                video_path = generate_video_from_summary(
                    response_data["summary"],
                    response_data["top_image"],
                    VIDEO_OUTPUT_DIR,
                    output_filename=video_filename
                )
                response_data["video_path"] = video_path
                if not video_path:
                    # If video_path is None, update the error message.
                    # Ensure response_data["error"] is always a string before concatenation.
                    current_error = response_data.get("error")
                    if current_error:
                        response_data["error"] = current_error + " Video generation failed."
                    else:
                        response_data["error"] = "Video generation failed."
            except Exception as e:
                response_data["video_path"] = None
                # Safely update error message
                current_error = response_data.get("error")
                error_msg_to_add = f" Unexpected video generation error: {e}"
                if current_error:
                    response_data["error"] = current_error + error_msg_to_add
                else:
                    response_data["error"] = error_msg_to_add
                sys.stderr.write(f"Unhandled error during video generation: {e}\n")
                sys.stderr.write(f"Traceback: {traceback.format_exc()}\n")
        else:
            current_error = response_data.get("error")
            if current_error:
                response_data["error"] = current_error + " No summary or top image for video generation."
            else:
                response_data["error"] = "No summary or top image for video generation."
            sys.stderr.write("Warning: Skipping video generation (no summary or top image).\n")

    except Exception as e: # <--- This is the except block for the top-level try
        response_data["error"] = f"Failed to process article: {e}"
        sys.stderr.write(f"Unhandled error in process_article: {e}\n")
        sys.stderr.write(f"Traceback: {traceback.format_exc()}\n")

    return response_data

# --- Main execution block for the script ---
if __name__ == '__main__':
    try:
        # Read the input URL from stdin (sent as JSON by Node.js)
        input_data_str = sys.stdin.read()
        input_data = json.loads(input_data_str)
        url = input_data.get('url')

        if not url:
            result = {"error": "No URL provided."}
        else:
            sys.stderr.write(f"DEBUG: Processing URL: {url}\n")
            result = process_article(url)

        # Write the JSON result to stdout for Node.js to capture
        sys.stdout.write(json.dumps(result) + '\n')
        sys.stderr.write("DEBUG: Python script finished successfully, JSON sent to stdout.\n")

    except json.JSONDecodeError:
        sys.stderr.write(json.dumps({"error": "Invalid JSON input to Python script."}) + '\n')
        sys.exit(1)
    except Exception as e:
        error_traceback = traceback.format_exc()
        sys.stderr.write(json.dumps({"error": f"An unexpected Python script error occurred: {e}", "trace": error_traceback}) + '\n')
        sys.exit(1)