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
import time # Import the time module for delays
from newspaper import Article, Config # Import Config for custom user-agent
from transformers import pipeline
from gtts import gTTS
from PIL import Image, ImageDraw, ImageFont
from pydub import AudioSegment
from googletrans import Translator
import traceback
import math

# Download NLTK punkt tokenizer data if not already present
try:
    nltk.data.find('tokenizers/punkt')
except nltk.downloader.DownloadError:
    nltk.download('punkt', quiet=True)
    sys.stderr.write("NLTK 'punkt' tokenizer downloaded.\n")


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

    # Try common system font directories (Windows, macOS, Linux)
    system_font_paths = [
        os.path.join(os.environ.get("WINDIR", "C:\\Windows"), "Fonts", font_name), # Windows
        "/System/Library/Fonts/" + font_name, # macOS
        "/Library/Fonts/" + font_name,        # macOS
        "/usr/share/fonts/truetype/msttcorefonts/" + font_name, # Linux (Ubuntu/Debian)
        "/usr/share/fonts/truetype/dejavu/" + font_name,        # Linux (DejaVu)
    ]
    for p in system_font_paths:
        if os.path.exists(p):
            return p

    sys.stderr.write(f"Warning: Font file '{font_name}' not found in script directory or common system paths. Using a default font, which might not look as expected.\n")
    return None # Fallback to PIL's default font if not found


def clean_text(text):
    """Basic text cleaning for summarization."""
    if not text:
        return ""
    # Remove excessive newlines and trim whitespace
    text = text.replace('\n', ' ').replace('\r', '').strip()
    # Replace multiple spaces with a single space
    text = ' '.join(text.split())
    return text

def split_text_into_lines(text, max_width_chars):
    """Splits a long text into lines for better display on an image."""
    lines = []
    # Use textwrap to wrap text based on character width
    wrapped_lines = textwrap.wrap(text, width=max_width_chars)
    lines.extend(wrapped_lines)
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

def add_text_to_image_with_background(image_pil, text_to_display, font_size, text_color, background_color, max_width_chars, line_spacing_factor=1.0):
    draw = ImageDraw.Draw(image_pil)
    font_path = get_font_path("arial.ttf")

    try:
        if font_path:
            font = ImageFont.truetype(font_path, font_size)
        else:
            font = ImageFont.load_default()
    except Exception as e:
        sys.stderr.write(f"Error loading specified font: {e}. Falling back to default font.\n")
        font = ImageFont.load_default()

    lines = split_text_into_lines(text_to_display, max_width_chars)

    # Calculate total text height and bounding box for centering
    total_text_height = 0
    line_heights = []
    # Calculate line heights and total text height
    for line in lines:
        # textbbox returns (left, top, right, bottom)
        # Use textbbox to get accurate height, including ascenders/descenders
        bbox = draw.textbbox((0, 0), line, font=font)
        line_height = bbox[3] - bbox[1]
        line_heights.append(line_height)
        total_text_height += line_height

    # Calculate total height including spacing
    total_height_with_spacing = total_text_height + (len(lines) - 1) * (font_size * (line_spacing_factor - 1))

    # Calculate initial y for vertical centering
    y_start_text = (image_pil.height - total_height_with_spacing) // 2

    current_y = y_start_text
    text_padding = 15 # Increased padding around text for the background rectangle

    # Determine the widest line for background rectangle width
    max_line_width = 0
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        max_line_width = max(max_line_width, bbox[2] - bbox[0])

    # Draw background rectangle for the entire block of text
    bg_rect_x1 = (image_pil.width - max_line_width) // 2 - text_padding
    bg_rect_y1 = y_start_text - text_padding
    bg_rect_x2 = (image_pil.width + max_line_width) // 2 + text_padding
    bg_rect_y2 = y_start_text + total_height_with_spacing + text_padding
    
    # Ensure background rectangle is within image bounds
    bg_rect_x1 = max(0, bg_rect_x1)
    bg_rect_y1 = max(0, bg_rect_y1)
    bg_rect_x2 = min(image_pil.width, bg_rect_x2)
    bg_rect_y2 = min(image_pil.height, bg_rect_y2)

    draw.rectangle([bg_rect_x1, bg_rect_y1, bg_rect_x2, bg_rect_y2], fill=background_color)

    # Draw text line by line
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=font)
        line_width = bbox[2] - bbox[0]
        x_text = (image_pil.width - line_width) // 2
        draw.text((x_text, current_y), line, font=font, fill=text_color)
        current_y += line_heights[i] + (font_size * (line_spacing_factor - 1)) # Add spacing based on factor
    return image_pil


def generate_video_from_summary(summary, image_url, output_dir, output_filename="summary_video.mp4"):
    temp_files = []
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

        audio_segment = AudioSegment.from_file(temp_audio_path)
        audio_duration = audio_segment.duration_seconds

        # 2. Download and process base image
        try:
            img_response = requests.get(image_url, stream=True)
            img_response.raise_for_status()
            base_img_pil = Image.open(io.BytesIO(img_response.content)).convert("RGB")
        except requests.exceptions.RequestException as e:
            sys.stderr.write(f"Error downloading image from {image_url}: {e}\n")
            return None
        except Exception as e:
            sys.stderr.write(f"Error processing image: {e}\n")
            return None

        target_width = 1280
        target_height = 720
        base_img_pil = resize_and_pad_image(base_img_pil, target_width, target_height)

        # 3. Prepare for progressive text rendering
        words = summary.split()
        num_words = len(words)
        fps = 30 # Frames per second
        total_frames = math.ceil(audio_duration * fps)
        
        # Calculate average duration per word more precisely
        # Distribute words evenly over the audio duration
        word_display_times = []
        if num_words > 0:
            for i in range(num_words):
                # Time at which this word should appear
                word_time = (audio_duration / num_words) * i
                word_display_times.append(word_time)
        
        frame_paths = []

        for i in range(total_frames):
            current_time = i / fps
            
            # Determine how many words to show based on current time
            words_to_show_count = 0
            for j, display_time in enumerate(word_display_times):
                if current_time >= display_time:
                    words_to_show_count = j + 1
                else:
                    break # Stop when current_time is less than display_time
            
            current_text_to_display = " ".join(words[:words_to_show_count])

            # Create a fresh copy of the base image for each frame
            frame_img = base_img_pil.copy()

            # Add text with background to the current frame
            # Adjusted font size, text color, background color, and line spacing factor
            add_text_to_image_with_background(
                frame_img,
                current_text_to_display,
                font_size=45,  # Medium-small font size
                text_color=(0, 0, 0),  # Black text
                background_color=(255, 255, 255), # White background
                max_width_chars=50, # Adjusted for medium-small font
                line_spacing_factor=1.0 # No extra space between lines (1.0 means font_size + 0)
            )

            # Save frame to a temporary file
            frame_filename = os.path.join(tempfile.gettempdir(), f"frame_{i:05d}.png")
            frame_img.save(frame_filename)
            frame_paths.append(frame_filename)
            temp_files.append(frame_filename) # Add to cleanup list

        # 4. Combine frames and audio using ffmpeg-python
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        final_video_relative_path = os.path.join('uploads', output_filename)
        final_video_full_path = os.path.join(output_dir, output_filename)

        # Input video stream from image sequence
        # Use -framerate to specify input frame rate, then -i for sequence
        # Pipe the list of image paths to ffmpeg
        input_frames = ffmpeg.input(f'{tempfile.gettempdir()}/frame_%05d.png', framerate=fps)
        audio_stream = ffmpeg.input(temp_audio_path)

        (
            ffmpeg
            .output(input_frames, audio_stream,
                    final_video_full_path,
                    vcodec='libx264',
                    acodec='aac',
                    preset='fast',
                    pix_fmt='yuv420p',
                    vf=f'scale={target_width}:{target_height},format=yuv420p',
                    shortest=None, # Ensure video ends with shortest stream (audio)
                    threads=0)
            .overwrite_output()
            .run(capture_stdout=False, capture_stderr=True)
        )

        sys.stderr.write(f"DEBUG: Video successfully generated at {final_video_full_path}\n")
        return final_video_relative_path

    except ffmpeg.Error as e:
        sys.stderr.write(f"FFmpeg command failed: {e.stderr.decode('utf8')}\n")
        sys.stderr.write(f"Traceback: {traceback.format_exc()}\n")
        return None
    except Exception as e:
        sys.stderr.write(f"An unexpected error occurred during video generation: {e}\n")
        sys.stderr.write(f"Traceback: {traceback.format_exc()}\n")
        return None
    finally:
        for f in temp_files:
            if os.path.exists(f):
                os.remove(f)
                # sys.stderr.write(f"DEBUG: Cleaned up temporary file: {f}\n") # Too verbose


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
    # Configure newspaper to use a custom user-agent
    config = Config()
    config.browser_user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    
    MAX_RETRIES = 3
    for attempt in range(MAX_RETRIES):
        try:
            # 1. Article Extraction
            article = Article(url, config=config) # Pass the config to the Article
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
            
            # If we reached here, article processing was successful, break the retry loop
            break 

        except requests.exceptions.RequestException as e:
            sys.stderr.write(f"Attempt {attempt + 1} failed for URL {url}: {e}\n")
            if attempt < MAX_RETRIES - 1:
                wait_time = 2 ** attempt # Exponential backoff
                sys.stderr.write(f"Retrying in {wait_time} seconds...\n")
                time.sleep(wait_time)
            else:
                response_data["error"] = f"Failed to download article after {MAX_RETRIES} attempts: {e}"
                sys.stderr.write(f"Failed to download article after {MAX_RETRIES} attempts: {e}\n")
                sys.stderr.write(f"Traceback: {traceback.format_exc()}\n")
        except Exception as e: # This general exception will catch any other unhandled errors during processing
            response_data["error"] = f"Failed to process article: {e}"
            sys.stderr.write(f"Unhandled error in process_article: {e}\n")
            sys.stderr.write(f"Traceback: {traceback.format_exc()}\n")
            break # Exit loop on unexpected error

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
        sys.stdout.flush() # Explicitly flush stdout
        sys.stderr.write("DEBUG: Python script finished successfully, JSON sent to stdout.\n")

    except json.JSONDecodeError:
        sys.stderr.write(json.dumps({"error": "Invalid JSON input to Python script."}) + '\n')
        sys.exit(1)
    except Exception as e:
        error_traceback = traceback.format_exc()
        sys.stderr.write(json.dumps({"error": f"An unexpected Python script error occurred: {e}", "trace": error_traceback}) + '\n')
        sys.stderr.flush() # Explicitly flush stderr
        sys.exit(1)