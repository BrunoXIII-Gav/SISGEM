from flask import Flask, jsonify
from flask_cors import CORS


app = Flask(__name__)
CORS(app)


@app.get('/inicio')
def begin():
    return jsonify({"message": "API is running"}), 200


if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000, debug=True)
