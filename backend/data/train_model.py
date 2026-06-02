import os
import tensorflow as tf
from tensorflow import keras  # Use direct keras import

# Image data preprocessing
ImageDataGenerator = keras.preprocessing.image.ImageDataGenerator

# Pretrained model & preprocessing
MobileNetV2 = keras.applications.MobileNetV2
preprocess_input = keras.applications.mobilenet_v2.preprocess_input

# Model components
Model = keras.Model
Dense = keras.layers.Dense
GlobalAveragePooling2D = keras.layers.GlobalAveragePooling2D

# Optimizers
Adam = keras.optimizers.Adam

# Training parameters and dataset path
DATASET_DIR = "../dataset"      # Directory with subfolders for each gesture
IMG_SIZE = 224               # Input image size for MobileNetV2
BATCH_SIZE = 16
EPOCHS = 10

# Image data generator with preprocessing and validation split
datagen = ImageDataGenerator(
    preprocessing_function=preprocess_input,
    validation_split=0.2  # 80% training, 20% validation
)

# Load training data
train_data = datagen.flow_from_directory(
    DATASET_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='training'
)

# Load validation data
val_data = datagen.flow_from_directory(
    DATASET_DIR,
    target_size=(IMG_SIZE, IMG_SIZE),
    batch_size=BATCH_SIZE,
    class_mode='categorical',
    subset='validation'
)

# Load the MobileNetV2 base model (exclude top layers)
base_model = MobileNetV2(include_top=False, weights='imagenet', input_shape=(IMG_SIZE, IMG_SIZE, 3))
base_model.trainable = False  # Freeze the base model

# Add custom classification layers on top
x = base_model.output
x = GlobalAveragePooling2D()(x)
x = Dense(128, activation='relu')(x)
predictions = Dense(train_data.num_classes, activation='softmax')(x)

# Create the final model
model = Model(inputs=base_model.input, outputs=predictions)

# Compile the model
model.compile(optimizer=Adam(), loss='categorical_crossentropy', metrics=['accuracy'])

# Setup callbacks: early stopping for overfitting and model checkpoint to save the best model
from keras.src.callbacks import EarlyStopping, ModelCheckpoint
early_stopping = EarlyStopping(monitor="val_loss", patience=3, restore_best_weights=True)
checkpoint = ModelCheckpoint("best_hand_sign_model.h5", monitor="val_loss", save_best_only=True, verbose=1)

# Train the model
history = model.fit(
    train_data,
    validation_data=val_data,
    epochs=EPOCHS,
    callbacks=[early_stopping, checkpoint]
)

print("Model training complete and saved as best_hand_sign_model.h5")