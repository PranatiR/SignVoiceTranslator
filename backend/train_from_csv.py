import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
from tensorflow import keras
import matplotlib.pyplot as plt
import seaborn as sns

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

print("\n" + "="*80)
print("TRAINING COMPLETED - MODEL EVALUATION REPORT")
print("="*80)

# Make predictions on test set
y_pred_prob = model.predict(X_test)
y_pred = np.argmax(y_pred_prob, axis=1)
y_test_labels = np.argmax(y_test, axis=1)

# Calculate accuracy
test_accuracy = accuracy_score(y_test_labels, y_pred)
print(f"\nOverall Test Accuracy: {test_accuracy:.4f} ({test_accuracy*100:.2f}%)")

# Generate classification report
print("\n" + "-"*80)
print("DETAILED CLASSIFICATION REPORT")
print("-"*80)
# Get unique labels in test set and their corresponding class names
unique_labels = np.unique(y_test_labels)
target_names = [le.classes_[i] for i in unique_labels]
report = classification_report(y_test_labels, y_pred, labels=unique_labels, target_names=target_names, digits=4)
print(report)

# Confusion Matrix
print("\n" + "-"*80)
print("CONFUSION MATRIX")
print("-"*80)
cm = confusion_matrix(y_test_labels, y_pred)
print(cm)

# Save confusion matrix as visualization
plt.figure(figsize=(12, 10))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
            xticklabels=target_names, yticklabels=target_names)
plt.title('Confusion Matrix - Hand Sign Classification')
plt.ylabel('True Label')
plt.xlabel('Predicted Label')
plt.tight_layout()
plt.savefig('confusion_matrix.png', dpi=300, bbox_inches='tight')
print("\nConfusion matrix visualization saved as 'confusion_matrix.png'")

# Model Summary
print("\n" + "-"*80)
print("MODEL ARCHITECTURE SUMMARY")
print("-"*80)
model.summary()

print("\n" + "="*80)
print("Model saved as 'best_hand_sign_model.h5'")
print("="*80 + "\n")
