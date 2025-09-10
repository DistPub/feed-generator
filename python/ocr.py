from typing import List

from rapidocr import RapidOCR

engine = RapidOCR()

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Minimal")

class Item(BaseModel):
    urls: List[str]

@app.post("/ocr")
def read_root(target: Item):
    text = []
    for url in target.urls:
        try:
            result = engine(url)
            if result.txts is None:
                text.append('')
            else:
                text.append(' '.join(list(result.txts)))
        except Exception as e:
            print(f'Error processing {url}: {e}')
    return {"text": text}