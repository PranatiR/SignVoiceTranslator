import speech_recognition as sr

def listen_and_convert():
    recognizer = sr.Recognizer()

    with sr.Microphone() as source:
        print(" Please speak...")
        recognizer.adjust_for_ambient_noise(source)
        audio = recognizer.listen(source)

    try:
        text = recognizer.recognize_google(audio)
        print(" You said:", text)
        return text

    except sr.UnknownValueError:
        print(" Could not understand the audio.")
        return "Sorry, I didn't catch that."

    except sr.RequestError as e:
        print(f" Could not request results; {e}")
        return "Speech recognition service is unavailable."


# Optional: Run this script directly to test it
if __name__ == "__main__":
    while True:
        result = listen_and_convert()
        print("📄 Transcription:", result)
        print("-" * 40)
