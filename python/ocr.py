from PIL import Image
import requests
import io
from typing import List

import easyocr

# Initialize EasyOCR reader for English language, specifying CPU usage
reader = easyocr.Reader(['en', 'ch_sim'], gpu=False)

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Minimal")

class Item(BaseModel):
    urls: List[str]

@app.post("/ocr")
def read_root(target: Item):
    text = []
    for url in target.urls:
         res= requests.get(url)
         image_data = io.BytesIO(res.content)
         img = Image.open(image_data)
         result = reader.readtext(img, detail = 0)
         text.append(' '.join(result))
    return {"text": text}