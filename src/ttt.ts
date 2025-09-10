async function main1() {
  try {
    const urls = [
        'https://cdn.bsky.app/img/feed_thumbnail/plain/did:plc:qylgajeqnvrxlwl42dxdwczu/bafkreibrzu4hpyuwfankjfcdbj7j5ktn77gq474ui3m74njmij624z27zi',
    ];
    const res = await fetch('http://127.0.0.1:8000/ocr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls }),
    });
    const data = await res.json();
    console.log('OCR Results:', data);
  } catch (error) {
    console.error('OCR Error:', error.message);
  }
}
console.log('Starting OCR process...');
main1();