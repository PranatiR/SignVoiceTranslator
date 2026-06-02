from flask import Flask
from api import api_blueprint
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allow React frontend to call it

app.register_blueprint(api_blueprint, url_prefix="/api")

if __name__ == "__main__":
    app.run(debug=True)
