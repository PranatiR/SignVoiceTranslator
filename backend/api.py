from flask import Blueprint, request, jsonify, send_file, send_from_directory
import base64
import cv2
import numpy as np
import os
import sys
import importlib
import tempfile
import io
from keras.models import load_model
import mediapipe.python.solutions.hands as mp_hands
from gtts import gTTS
import speech_recognition as sr
from PIL import Image, ImageDraw, ImageFont

# Compatibility alias for old NumPy saved arrays
sys.modules.setdefault('numpy._core', np.core)
sys.modules.setdefault('numpy._core.multiarray', importlib.import_module('numpy.core.multiarray'))

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, 'data', 'best_hand_sign_model.h5')
LABEL_PATH = os.path.join(BASE_DIR, 'data', 'label_classes.npy')

if not os.path.isfile(MODEL_PATH):
    raise FileNotFoundError(f"Model not found at: {MODEL_PATH}")

if not os.path.isfile(LABEL_PATH):
    raise FileNotFoundError(f"Label classes file not found at: {LABEL_PATH}")

label_classes = np.load(LABEL_PATH, allow_pickle=True).tolist()
num_classes = len(label_classes)

# Load the MLP model directly
model = load_model(MODEL_PATH)

print(f"[INFO] Loaded landmark model from {MODEL_PATH}")
print(f"[INFO] Loaded {num_classes} label classes")

# Initialize MediaPipe Hands
hands = mp_hands.Hands(
    static_image_mode=True,
    max_num_hands=1,
    min_detection_confidence=0.5
)

api_blueprint = Blueprint("api", __name__)


def generate_placeholder_sign(letter, output_path):
    """
    Dynamically renders a clean, high-contrast visual card for an alphabet letter
    to serve as a placeholder for its sign representation.
    """
    # Create a 200x200 image with a modern slate dark background
    img = Image.new('RGB', (200, 200), color='#1E293B')
    draw = ImageDraw.Draw(img)

    # Try loading Arial font, fallback to default
    try:
        font = ImageFont.truetype("arial.ttf", 90)
    except IOError:
        font = ImageFont.load_default()

    text = letter.upper()
    
    # Calculate centering
    try:
        left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
        text_w = right - left
        text_h = bottom - top
    except AttributeError:
        # Compatibility for older Pillow versions
        text_w, text_h = draw.textsize(text, font=font)

    x = (200 - text_w) / 2
    y = (200 - text_h) / 2 - 10

    # Draw border card decoration
    draw.rectangle([8, 8, 192, 192], outline="#3B82F6", width=3) # Tailwind blue-500 border

    # Draw Letter
    draw.text((x, y), text, fill="#F8FAFC", font=font) # Slate-50 text

    # Add subtitle
    try:
        sub_font = ImageFont.truetype("arial.ttf", 14)
    except IOError:
        sub_font = ImageFont.load_default()
    
    caption = f"Sign card: {text}"
    try:
        left, top, right, bottom = draw.textbbox((0, 0), caption, font=sub_font)
        cap_w = right - left
    except AttributeError:
        cap_w, cap_h = draw.textsize(caption, font=sub_font)

    draw.text(((200 - cap_w) / 2, 150), caption, fill="#94A3B8", font=sub_font) # Slate-400 text

    # Save file
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path)


@api_blueprint.route("/static/<path:filename>", methods=["GET"])
def serve_static(filename):
    """
    Serves static images directly from backend/data directory.
    """
    return send_from_directory(os.path.join(BASE_DIR, "data"), filename)


@api_blueprint.route("/ping", methods=["GET"])
def ping():
    return jsonify({"message": "pong"})


@api_blueprint.route("/predict_sign", methods=["POST"])
def predict_sign():
    """
    Expects JSON: { "image": "<base64-encoded JPEG frame>" }
    Returns JSON: { "text": "<predicted gesture name>", "confidence": float }
    """
    data = request.get_json()

    if not data or "image" not in data:
        return jsonify({"error": "No image provided"}), 400

    img_data = data["image"].split(",")[-1]
    img_bytes = base64.b64decode(img_data)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return jsonify({"error": "Could not decode image"}), 400

    # Convert BGR to RGB for MediaPipe
    rgb_img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    results = hands.process(rgb_img)

    if results.multi_hand_landmarks:
        # Extract 63 coordinates from the first detected hand
        hand_landmarks = results.multi_hand_landmarks[0]
        landmarks_list = []
        for lm in hand_landmarks.landmark:
            landmarks_list.extend([lm.x, lm.y, lm.z])

        features = np.array([landmarks_list], dtype=np.float32)
        preds = model.predict(features)
        label_idx = int(np.argmax(preds[0]))
        confidence = float(preds[0][label_idx])
        predicted = label_classes[label_idx] if label_idx < len(label_classes) else "Unknown"

        print(f"[INFO] Prediction: {predicted} (confidence={confidence:.4f})")
        return jsonify({"text": predicted, "confidence": confidence})
    else:
        # No hand detected -> return 'wave' so the frontend ignores it
        return jsonify({"text": "wave", "confidence": 0.0})


@api_blueprint.route("/speech_to_text", methods=["POST"])
def speech_to_text():
    """
    Expects multi-part form data with 'audio' containing WAV audio data.
    Returns JSON: { "text": "<transcribed text>" }
    """
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    temp_dir = tempfile.gettempdir()
    temp_path = os.path.join(temp_dir, "temp_audio.wav")
    audio_file.save(temp_path)

    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(temp_path) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)
            return jsonify({"text": text})
    except sr.UnknownValueError:
        return jsonify({"error": "Speech was not recognized"}), 422
    except sr.RequestError as e:
        return jsonify({"error": f"Speech transcription error: {e}"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@api_blueprint.route("/text_to_speech", methods=["POST"])
def text_to_speech():
    """
    Expects JSON: { "text": "<text to read>" }
    Returns MP3 audio stream.
    """
    data = request.get_json()
    if not data or "text" not in data:
        return jsonify({"error": "No text provided"}), 400

    text = data["text"]
    try:
        tts = gTTS(text=text, lang='en')
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        return send_file(
            fp,
            mimetype="audio/mp3",
            as_attachment=False,
            download_name="speech.mp3"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_blueprint.route("/voice_to_sign", methods=["POST"])
def voice_to_sign():
    """
    Expects JSON: { "text": "<phrase>" }
    Returns JSON: { "signs": ["/api/static/..."] }
    """
    data = request.get_json()
    if not data or "text" not in data:
        return jsonify({"error": "No text provided"}), 400

    text = data["text"].lower().strip()
    words = text.split()
    signs = []

    for word in words:
        # 1. Check if direct word image exists
        word_img_name = f"{word}.jpg"
        word_img_path = os.path.join(BASE_DIR, "data", "word_sign_images", word_img_name)
        if os.path.exists(word_img_path):
            signs.append(f"/api/static/word_sign_images/{word_img_name}")
        else:
            # 2. Spell it out letter by letter using letter sign card images
            for letter in word:
                if letter.isalpha():
                    letter_img_name = f"{letter}.jpg"
                    letter_img_path = os.path.join(BASE_DIR, "data", "alphabet_images", letter_img_name)
                    
                    # Generate placeholder sign card if not already created
                    if not os.path.exists(letter_img_path):
                        generate_placeholder_sign(letter, letter_img_path)
                        
                    signs.append(f"/api/static/alphabet_images/{letter_img_name}")

    return jsonify({"signs": signs})
