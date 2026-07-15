from pymongo import MongoClient
from sentence_transformers import SentenceTransformer
import json
import os

# 1) Connect to MongoDB


client = MongoClient("mongodb+srv://lakyvasu:<db_password>@personalitytwo.kqsqwn8.mongodb.net/?retryWrites=true&w=majority&appName=personalitytwo")  # or your Atlas URI
db = client["transcripts_db"]
col = db["calls"]

# 2) Load embedder
embedder = SentenceTransformer("all-MiniLM-L6-v2")

data_dir = "./transcripts.json"

for fname in data_dir:
    if not fname.endswith(".json"):
        continue
    convo = json.load(open(os.path.join(data_dir, fname)))
    # Assume convo = [{"role":"user","text":...}, {"role":"agent","text":...}, ...]
    for turn in zip(convo, convo[1:]):
        user, agent = turn
        if user["role"]!="user" or agent["role"]!="agent":
            continue
        text = user["text"]
        emb = embedder.encode(text).tolist()
        col.insert_one({
            "user": text,
            "agent": agent["text"],
            "embedding": emb
        })
print("Ingestion complete.")