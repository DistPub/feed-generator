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
        image_data = None
        try:
            with requests.get(url, stream=True) as res:
                res.raise_for_status()
                image_data = io.BytesIO(res.content)
                with Image.open(image_data) as img:
                    result = reader.readtext(img, detail = 0)
                    text.append(' '.join(result))
        except Exception as e:
            print(f'Error processing {url}: {e}')
        finally:
            if image_data is not None:
                image_data.close()
    return {"text": text}