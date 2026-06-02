import speech_recognition as sr
import os
from PIL import Image
import matplotlib.pyplot as plt

# Correct relative path to word sign images
IMAGE_DIR = os.path.join("data", "word_sign_images")

def recognize_speech():
    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        print("🎙️ Speak now...")
        audio = recognizer.listen(source)

    try:
        text = recognizer.recognize_google(audio).lower()
        print(f"✅ You said: {text}")
        return text
    except sr.UnknownValueError:
        print("❌ Could not understand audio.")
    except sr.RequestError as e:
        print(f"🔌 Could not request results; {e}")
    return None

def show_sign_image(word):
    for ext in ["jpg", "png"]:
        image_path = os.path.join(IMAGE_DIR, f"{word}.{ext}")
        if os.path.exists(image_path):
            print(f"🖼️ Showing sign image for: '{word}'")
            img = Image.open(image_path)
            plt.imshow(img)
            plt.axis('off')
            plt.show()
            return
    print(f"🚫 No image found for word: {word}")

if __name__ == "__main__":
    spoken_word = recognize_speech()
    if spoken_word:
        show_sign_image(spoken_word)
