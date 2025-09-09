async function main1() {
  try {
    const urls = [
        'https://go.smitechow.com/+x/cdn.bsky.app/img/feed_thumbnail/plain/did:plc:mxabcpwk5hmlblzrzp4u7x7z/bafkreidrnmxji64lw2d7m7ukrhc4ifx7t6whpscectaxnujsbi6qlfayxu@jpeg',
        'https://go.smitechow.com/+c+x/https://video.cdn.bsky.app/hls/did:plc:7u6iswx7tidj53nvdljnrfrt/bafkreihib4a22j2iei2jlfqasa54cbir37mtsdeeaqolxsjsrcd2oepu3i/thumbnail.jpg',
        'https://go.smitechow.com/+x/cdn.bsky.app/img/feed_thumbnail/plain/did:plc:clk7274ezih5yuc7e3474rep/bafkreideuqdhql5dvzfutx3kq3p4pidmawt7s5muog2tzlm7paiuhyj3hu@jpeg'
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