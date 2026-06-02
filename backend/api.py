from flask import Blueprint, request, jsonify
import base64
import cv2
import numpy as np

api_blueprint = Blueprint("api", __name__)

@api_blueprint.route("/ping", methods=["GET"])
def ping():
    return jsonify({"message": "pong"})

@api_blueprint.route("/predict_sign", methods=["POST"])
def predict_sign():
    """
    Expects JSON: { "image": "<base64-encoded JPEG frame>" }
    Returns JSON: { "text": "<predicted gesture name>" }
    """
    data = request.get_json()

    if not data or "image" not in data:
        return jsonify({"error": "No image provided"}), 400

    img_data = data["image"].split(",")[-1]
    img_bytes = base64.b64decode(img_data)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # TODO: integrate your real gesture-recognition logic
    predicted = "wave"  # placeholder

    return jsonify({"text": predicted})
