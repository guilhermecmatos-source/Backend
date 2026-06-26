async function testDDG(query) {
  const url = `https://duckduckgo.com/v1/images?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    console.log('DDG Status:', res.status);
    const data = await res.json();
    console.log('DDG Data keys:', Object.keys(data));
    if (data.results && data.results.length > 0) {
      console.log('DDG First result image:', data.results[0].image);
    }
  } catch (err) {
    console.error('DDG Error:', err.message);
  }
}

async function run() {
  await testDDG('toyota hilux 2023 car');
}

run();
