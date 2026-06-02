# SignVoiceTranslator 🤟🔊

A real-time communication system enabling conversation between deaf or speech-impaired individuals and hearing individuals.  
It translates hand signs into both **text and speech**, and spoken language into **text**, creating a seamless bridge for inclusive communication.

---

## ✨ Features

- 📷 Real-time hand sign detection using webcam
- 🧠 Deep learning model trained to recognize sign language
- 🔊 Converts recognized signs into **spoken words**
- 🎙️ Converts **spoken input** into text for deaf individuals
- 💡 Modular and easy to expand with more signs

---

## 📁 Project Structure

SignVoiceTranslator/ ├── backend/ │ ├── test_cam.py # Live webcam sign prediction │ ├── hand_to_text.py # Mapping signs to text │ ├── speech_to_text.py # Speech-to-text logic (for hearing-to-deaf) ├── data/ # Data collection & preprocessing ├── dataset/ # Your sign image dataset ├── model/ │ └── best_hand_sign_model.h5 # Trained model ├── requirements.txt └── README.md