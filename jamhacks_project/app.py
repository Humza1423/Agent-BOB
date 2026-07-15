from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
import wave
import subprocess
from vosk import Model, KaldiRecognizer
import requests
from vapi_python import Vapi
from openai import OpenAI
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
load_dotenv()

openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

vapi_client = Vapi(
    token=os.environ.get('VAPI_API_KEY'),
)

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///test.db'
db = SQLAlchemy(app)
CORS(app)

def call(voice_id, number, prompt):
    call = vapi_client.calls.create(
        assistant_id=os.environ.get('VAPI_ASSISTANT_ID'), 
        phone_number_id=os.environ.get('VAPI_PHONE_NUMBER_ID'),
        customer={"number": number},
        assistant={
            "model": {
                "provider": "openai",
                "model": "gpt-4",
                "messages": [
                    {
                        "role": "system",
                        "content": prompt
                    }
                ]
            },
            "voice": {
                "provider": "cartesia",
                "voiceId": voice_id,
                "fillerInjectionEnabled": False
            }
        }
    )

class Accounts(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(200), nullable=False, unique=True)
    username = db.Column(db.String(200), nullable=False, unique=True)
    password_hash = db.Column(db.String(256), nullable=False)
    voice_id = db.Column(db.String(200), nullable=False, unique=True)
    phone_number = db.Column(db.String(20), nullable=False, unique=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<Account name: {self.username}, id: {self.id}>'

def get_place_phone_number(business_query):
    search_url = "https://maps.googleapis.com/maps/api/place/findplacefromtext/json"
    search_params = {
        "input": business_query,
        "inputtype": "textquery",
        "fields": "place_id",
        "key": os.environ.get('GCP_API_KEY')
    }
    search_response = requests.get(search_url, params=search_params).json()

    if not search_response.get("candidates"):
        return None

    place_id = search_response["candidates"][0]["place_id"]

    details_url = "https://maps.googleapis.com/maps/api/place/details/json"
    details_params = {
        "place_id": place_id,
        "fields": "formatted_phone_number",
        "key": os.environ.get('GCP_API_KEY')
    }
    details_response = requests.get(details_url, params=details_params).json()

    return details_response.get("result", {}).get("formatted_phone_number")

def parse_transcription(transcript):
    prompt_response = openai_client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are an AI that transforms short user requests into detailed, natural-sounding instructions for a voice agent that is meant to act like the user. Your job is to take a short transcript and convert it into a clear and specific second-person instruction the voice agent can follow. Assume a realistic context. If the user didn't provide enough detail (e.g., time, name, location), infer reasonable defaults. The output should sound like: 'You are calling [business]. Your name is Yakshith. You want to [action with inferred or explicit details]. Be friendly.' Here are some examples: Input: 'Book a barber appointment for me.' Output: 'You are calling a local barbershop. Your name is Alex. You want to book a standard haircut sometime this week, ideally in the afternoon. Ask about availability and be polite and friendly.' Input: 'Order me a large pepperoni pizza.' Output: 'You are calling a local pizza place. Your name is Alex. You want to order one large pepperoni pizza for delivery to your usual address. Confirm the delivery time and be polite.' Input: 'Cancel my dentist appointment.' Output: 'You are calling your dentist's office. Your name is Alex. You want to cancel your upcoming appointment scheduled for later this week. Apologize for the cancellation and ask if they need to reschedule.' Now do the same for this input: " + transcript}
        ],
        max_tokens=150,
    )

    prompt = prompt_response.choices[0].message.content

    extraction_response = openai_client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "Extract only the business name and location (if available) from this user request. If the business name isn't specific, return something general like 'local barbershop'."},
            {"role": "user", "content": transcript}
        ],
        max_tokens=20
    )

    business_query = extraction_response.choices[0].message.content.strip()

    number = get_place_phone_number(business_query)

    return number, prompt

def convert_to_wav(input_path, output_path):
    command = [
        "ffmpeg", "-y", "-i", input_path,
        "-ac", "1",
        "-ar", "16000",
        "-acodec", "pcm_s16le",
        output_path
    ]
    subprocess.run(command, check=True)

def convert_to_webm(input_path, output_path):
    command = [
        "ffmpeg", "-y", "-i", input_path,
        "-c:a", "libopus",
        "-b:a", "96k",
        output_path
    ]
    subprocess.run(command, check=True)

def clone(input_url):
    response = requests.post(
        "https://api.cartesia.ai/voices/clone",
        headers={
            "X-API-Key": os.environ.get('CARTESIA_API_KEY'),
            "Cartesia-Version": "2024-11-13"
        },
        data={
            'name': "A high-stability cloned voice",
            'description': "Copied from Cartesia docs",
            'language': "en",
            'mode': "similarity",
            'enhance': False,
        },
        files={
            'clip': (input_url, open(input_url, 'rb')),
        },
    )
    return response.json().get('id')

@app.route('/', methods=['POST', 'GET'])
def index():
    return jsonify({'message': 'some random page'})

@app.route('/signup', methods=['POST'])
def signup():
    try:
        email = request.form.get('email')
        username = request.form.get('username')
        password = request.form.get('password')
        phone_number = request.form.get('phone_number')
        
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file in request'}), 400
        
        os.makedirs('uploads', exist_ok=True)
        audio_file = request.files['audio']
        input_file_path = os.path.join('uploads', audio_file.filename)
        audio_file.save(input_file_path)

        if not os.path.exists("model"):
            return jsonify({"error": "Speech model not found. Please download a Vosk model and place it in the 'model' folder."}), 500
        
        wav_file_path = os.path.splitext(input_file_path)[0] + ".wav"
        try:
            convert_to_wav(input_file_path, wav_file_path)
        except Exception as e:
            return jsonify({"error": f"Conversion to WAV failed: {str(e)}"}), 500
        
        try:
            wf = wave.open(wav_file_path, "rb")
        except Exception as e:
            return jsonify({"error": f"Could not open WAV file: {str(e)}"}), 400
        
        if wf.getnchannels() != 1 or wf.getsampwidth() != 2:
            return jsonify({"error": "Audio file must be mono PCM WAV 16-bit."}), 400

        webm_file_path = os.path.splitext(input_file_path)[0] + ".webm"
        try:
            convert_to_webm(input_file_path, webm_file_path)
            audio_id = clone(webm_file_path)
            if not audio_id:
                print("Warning: Failed to clone audio, but continuing with transcription")
                print(f"Cloned audio ID: {audio_id}")
        except Exception as e:
            print(f"Warning: WebM conversion or cloning failed: {str(e)}")

        voice_id = audio_id

        if not email or not username or not password or not voice_id or not phone_number:
            return jsonify({'error': 'Missing required fields'}), 400

        new_account = Accounts(email=email, username=username)
        new_account.set_password(password)
        new_account.voice_id = voice_id
        new_account.phone_number = phone_number

        db.session.add(new_account)
        db.session.commit()

        return jsonify({'message': 'Account created successfully'}), 201
    except Exception as e:
        print(f"Error during signup: {str(e)}")
        return jsonify({'error': 'An error occurred during signup'}), 500

@app.route('/login', methods=['POST'])
def login_route():
    data = request.get_json()
    if not data:
        return jsonify({'message': 'No input data provided'}), 400
        
    email = data.get('email')
    password = data.get('password')
    
    account = Accounts.query.filter_by(email=email).first()
    if account and account.check_password(password):
        return jsonify({
            'id': account.id,
            'username': account.username,
            'email': account.email
        }), 200
    else:
        return jsonify({'message': 'Invalid credentials'}), 401

@app.route('/upload-audio', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file in request'}), 400
    
    os.makedirs('uploads', exist_ok=True)
    audio_file = request.files['audio']
    audio_file.save(os.path.join('uploads', audio_file.filename))
    print(f"Received audio file: {audio_file.filename}")
    return jsonify({'message': 'Audio received successfully'})

@app.route('/upload-audio-stt', methods=['POST'])
def upload_audio_stt():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file in request'}), 400
    
    os.makedirs('uploads', exist_ok=True)
    audio_file = request.files['audio']
    input_file_path = os.path.join('uploads', audio_file.filename)
    audio_file.save(input_file_path)
    
    if not os.path.exists("model"):
        return jsonify({"error": "Speech model not found. Please download a Vosk model and place it in the 'model' folder."}), 500
    
    wav_file_path = os.path.splitext(input_file_path)[0] + ".wav"
    try:
        convert_to_wav(input_file_path, wav_file_path)
    except Exception as e:
        return jsonify({"error": f"Conversion to WAV failed: {str(e)}"}), 500
    
    try:
        wf = wave.open(wav_file_path, "rb")
    except Exception as e:
        return jsonify({"error": f"Could not open WAV file: {str(e)}"}), 400
    
    if wf.getnchannels() != 1 or wf.getsampwidth() != 2:
        return jsonify({"error": "Audio file must be mono PCM WAV 16-bit."}), 400

    model = Model("model")
    rec = KaldiRecognizer(model, wf.getframerate())
    
    transcript = ""
    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break
        if rec.AcceptWaveform(data):
            result = rec.Result()
            transcript += result
    transcript += rec.FinalResult()
    
    print(f"Transcription result: {transcript}")
    return jsonify({"transcript": transcript})

@app.route('/upload-audio-2', methods=['POST'])
def upload_audio_2():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file in request'}), 400
    
    os.makedirs('uploads', exist_ok=True)
    audio_file = request.files['audio']
    input_file_path = os.path.join('uploads', audio_file.filename)
    audio_file.save(input_file_path)

    if not os.path.exists("model"):
        return jsonify({"error": "Speech model not found. Please download a Vosk model and place it in the 'model' folder."}), 500
    
    wav_file_path = os.path.splitext(input_file_path)[0] + ".wav"
    try:
        convert_to_wav(input_file_path, wav_file_path)
    except Exception as e:
        return jsonify({"error": f"Conversion to WAV failed: {str(e)}"}), 500
    
    try:
        wf = wave.open(wav_file_path, "rb")
    except Exception as e:
        return jsonify({"error": f"Could not open WAV file: {str(e)}"}), 400
    
    if wf.getnchannels() != 1 or wf.getsampwidth() != 2:
        return jsonify({"error": "Audio file must be mono PCM WAV 16-bit."}), 400

    webm_file_path = os.path.splitext(input_file_path)[0] + ".webm"
    try:
        convert_to_webm(input_file_path, webm_file_path)
        audio_id = clone(webm_file_path)
        if not audio_id:
           print("Warning: Failed to clone audio, but continuing with transcription")
        print(f"Cloned audio ID: {audio_id}")
    except Exception as e:
        print(f"Warning: WebM conversion or cloning failed: {str(e)}")
    
    model = Model("model")
    rec = KaldiRecognizer(model, wf.getframerate())
    
    transcript = ""
    while True:
        data = wf.readframes(4000)
        if len(data) == 0:
            break
        if rec.AcceptWaveform(data):
            result = rec.Result()
            transcript += result
    transcript += rec.FinalResult()
    
    print(f"Transcription result: {transcript}")

    number, prompt = parse_transcription(transcript)

    number = "+14372605922"

    call(audio_id, number, prompt)
    print(f"Calling {number} with prompt: {prompt}")

    return jsonify({"transcript": transcript})

if __name__ == '__main__':
    with app.app_context():
        num_deleted = Accounts.query.delete()
        db.session.commit()
        print(f"Deleted {num_deleted} record(s) from the Accounts table.")
    app.run(host="0.0.0.0", port=5001, debug=True)