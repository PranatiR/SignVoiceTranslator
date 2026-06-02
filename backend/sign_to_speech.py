import cv2
import mediapipe as mp
import pyttsx3
import time

# Initialize text-to-speech engine
engine = pyttsx3.init()

# Initialize MediaPipe
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(static_image_mode=False,
                       max_num_hands=1,
                       min_detection_confidence=0.7,
                       min_tracking_confidence=0.5)
mp_drawing = mp.solutions.drawing_utils

# Gesture map (just a demo — you can expand)
gesture_map = {
    "FIVE": "Hello",
    "ONE": "Yes",
    "ZERO": "No"
}

def classify_gesture(landmarks):
    fingers = []

    # Thumb
    if landmarks[4].x < landmarks[3].x:
        fingers.append(1)
    else:
        fingers.append(0)

    # Other fingers
    tips = [8, 12, 16, 20]
    for tip in tips:
        if landmarks[tip].y < landmarks[tip - 2].y:
            fingers.append(1)
        else:
            fingers.append(0)

    total_fingers = sum(fingers)

    if total_fingers == 5:
        return "FIVE"
    elif total_fingers == 1:
        return "ONE"
    elif total_fingers == 0:
        return "ZERO"
    else:
        return None

# Start camera
cap = cv2.VideoCapture(0)
prev_gesture = ""
last_spoken_time = time.time()

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        break

    frame = cv2.flip(frame, 1)
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = hands.process(rgb_frame)

    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            mp_drawing.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

            gesture = classify_gesture(hand_landmarks.landmark)
            if gesture and gesture != prev_gesture:
                word = gesture_map.get(gesture, "")
                if word and time.time() - last_spoken_time > 2:
                    print("Detected Gesture:", gesture, "→", word)
                    cv2.putText(frame, word, (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 1.5, (0, 255, 0), 3)
                    engine.say(word)
                    engine.runAndWait()
                    prev_gesture = gesture
                    last_spoken_time = time.time()

    cv2.imshow("Sign Language to Text & Voice", frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
