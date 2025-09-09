async function main1() {
  try {
    const urls = [
        'https://go.smitechow.com/+x/cdn.bsky.app/img/feed_thumbnail/plain/did:plc:gfd2yz6v44s5fv4mniyqnutu/bafkreidwjrk6j5nfwbbmv44552sa5nnlrgz5725rtxsiew2nmxjuuspusy@jpeg',
        'https://go.smitechow.com/+x/cdn.bsky.app/img/feed_thumbnail/plain/did:plc:gfd2yz6v44s5fv4mniyqnutu/bafkreihhs6wbw5bzdlvybgzssi6ghqqki7w6ylvxnkgyayakof2ehn4yui@jpeg'
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