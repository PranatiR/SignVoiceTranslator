import os
import cv2
import numpy as np
import pyttsx3
from tensorflow import keras

# Load trained model
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
model_path = os.path.join(BASE_DIR, 'data', 'best_hand_sign_model.h5')

if not os.path.isfile(model_path):
    raise FileNotFoundError(f"Model not found at: {model_path}")

model = keras.models.load_model(model_path)
print(f"[INFO] Model loaded from: {model_path}")

# Update this list to match your dataset
gesture_folders = ['Goodbye', 'hello', 'no', 'yes']
label_map = {idx: gesture for idx, gesture in enumerate(gesture_folders)}

# Voice engine
engine = pyttsx3.init()
engine.setProperty('rate', 150)

# Input size and webcam
IMG_SIZE = 224
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    raise IOError("Cannot open webcam")

last_prediction = ""
cooldown = 30
frame_count = 0

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Preprocess
    img = cv2.resize(frame, (IMG_SIZE, IMG_SIZE))
    img = img.astype("float32") / 255.0
    img = np.expand_dims(img, axis=0)

    # Predict
    preds = model.predict(img)
    label_idx = np.argmax(preds[0])
    confidence = preds[0][label_idx]
    gesture = label_map.get(label_idx, "Unknown")

    # Display on frame
    cv2.putText(frame, f"Gesture: {gesture}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    cv2.imshow('Hand-to-Text & Voice', frame)

    print(f"[INFO] Prediction: {gesture} ({confidence:.2f})")

    # Speak only when confident and changed
    if gesture != last_prediction and confidence > 0.80:
        engine.say(gesture)
        engine.runAndWait()
        last_prediction = gesture
        frame_count = 0
    else:
        frame_count += 1
        if frame_count > cooldown:
            last_prediction = ""

    # Quit
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
