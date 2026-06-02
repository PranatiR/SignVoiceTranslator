import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from tensorflow import keras

# Model components
Sequential = keras.Sequential
Dense = keras.layers.Dense
Dropout = keras.layers.Dropout

# Utility functions
to_categorical = keras.utils.to_categorical

# Callbacks
ModelCheckpoint = keras.callbacks.ModelCheckpoint
# Path to your CSV file
csv_path = 'data/hand_sign_data.csv'

# Load dataset
df = pd.read_csv(csv_path)

# Split features and labels
X = df.drop('label', axis=1).values
y = df['label'].values

# Show shape for debugging
print("Shape of X (features):", X.shape)  # (num_samples, ?)
print("Shape of y (labels):", y.shape)

# Encode labels (e.g., A, B, C -> 0, 1, 2)
le = LabelEncoder()
y_encoded = le.fit_transform(y)

# Convert to categorical (one-hot encoding)
y_categorical = to_categorical(y_encoded)

# Train-test split
X_train, X_test, y_train, y_test = train_test_split(X, y_categorical, test_size=0.2, random_state=42)

# Get input shape dynamically from X
input_shape = X_train.shape[1]
num_classes = y_categorical.shape[1]

# Build model
model = Sequential([
    Dense(128, activation='relu', input_shape=(input_shape,)),
    Dense(64, activation='relu'),
    Dense(num_classes, activation='softmax')
])

# Compile model
model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])

# Save best model only
checkpoint = ModelCheckpoint('best_hand_sign_model.h5', monitor='val_accuracy', save_best_only=True)

# Train model
model.fit(X_train, y_train, epochs=30, batch_size=8, validation_data=(X_test, y_test), callbacks=[checkpoint])

print(" Training completed and best model saved as 'best_hand_sign_model.h5'")
