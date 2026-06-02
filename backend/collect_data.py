import cv2
import os

# === Configuration ===
gesture_name = "thumbs_up"  # Change this to the gesture you're recording
output_dir = f"dataset/{gesture_name}"
os.makedirs(output_dir, exist_ok=True)

# === Start capturing ===
cap = cv2.VideoCapture(0)
frame_count = 0
max_frames = 1000  # You can change this to how many frames you want to collect

print(f"Collecting data for gesture: '{gesture_name}'")
print("Press 'q' to stop early.\n")

while True:
    ret, frame = cap.read()
    if not ret:
        print("Failed to grab frame.")
        break

    frame_count += 1

    # Save frame as image
    file_path = os.path.join(output_dir, f"{gesture_name}_{frame_count}.jpg")
    cv2.imwrite(file_path, frame)

    # Show live video feed
    cv2.imshow("Collecting Gesture Data", frame)

    # Reduce logging spam
    if frame_count % 100 == 0:
        print(f"Captured {frame_count} frames so far...")

    # Exit on 'q' or after reaching max_frames
    if cv2.waitKey(1) & 0xFF == ord('q'):
        print("Early exit requested.")
        break

    if frame_count >= max_frames:
        print(f"Reached maximum frame count of {max_frames}.")
        break

# === Cleanup ===
cap.release()
cv2.destroyAllWindows()
print("Data collection complete.")
 