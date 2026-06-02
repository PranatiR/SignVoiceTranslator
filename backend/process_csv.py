import os
import pandas as pd
import numpy as np

def load_keypoint_data(csv_path):
    print("Loading keypoint dataset...")

    if not os.path.isfile(csv_path):
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    df = pd.read_csv(csv_path)
    print(f"CSV loaded successfully! Found {len(df)} entries.")

    if "label" not in df.columns:
        raise ValueError("CSV must contain a 'label' column.")

    labels = df["label"].values
    features = df.drop("label", axis=1).values  # Drop label and keep keypoints

    print(f"Dataset ready! Features shape: {features.shape}, Labels shape: {labels.shape}")
    return features, labels

if __name__ == "__main__":
    csv_path = os.path.join(os.path.dirname(__file__), "data", "hand_sign_data.csv")
    features, labels = load_keypoint_data(csv_path)
    print(f"Final dataset: {len(features)} samples, each with {features.shape[1]} features.")
