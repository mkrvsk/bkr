from flask import Flask, request, jsonify
import torch
import librosa
import numpy as np
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
MODEL_PATH = "mobilenet_model.torchscript.pt"
CLASSES = ['ambulance', 'firetruck', 'police', 'traffic']

model = torch.jit.load(MODEL_PATH, map_location=torch.device('cpu'))
model.eval()

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'Файл не знайдено'}), 400

    file = request.files['file']
    filename = secure_filename(file.filename)
    file_path = os.path.join("temp", filename)
    os.makedirs("temp", exist_ok=True)
    file.save(file_path)

    try:
        y, sr = librosa.load(file_path, sr=44100)
        mel = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=84)
        mel_db = librosa.power_to_db(mel, ref=np.max)
        mel_resized = librosa.util.fix_length(mel_db, size=117, axis=1)

        tensor = torch.tensor(mel_resized).unsqueeze(0).unsqueeze(0).repeat(1, 3, 1, 1).float()
        with torch.no_grad():
            output = model(tensor)
            pred = output.argmax().item()
            label = CLASSES[pred]

        return jsonify({'prediction': label})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        os.remove(file_path)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)