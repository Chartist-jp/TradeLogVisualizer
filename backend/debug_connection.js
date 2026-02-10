const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function checkSymbol(symbol) {
    console.log(`\nTesting ${symbol}...`);
    // Alpha Vantage Daily API doesn't strictly use startDate/endDate for filtering the response size (it returns compact/full), 
    // but we include them as query params because the backend expects them or logs them.
    const url = `http://localhost:3001/api/stock/${symbol}?country=US&startDate=2024-01-01&endDate=2024-01-31`;

    console.log(`Requesting: ${url}`);

    try {
        const res = await fetch(url);
        console.log(`Response Status: ${res.status} ${res.statusText}`);

        const text = await res.text();
        try {
            const json = JSON.parse(text);
            // Log a summary to avoid huge output, but log error details if present
            if (json.error || json.details) {
                console.log('Error Response:', JSON.stringify(json, null, 2));
            } else if (json.data && Array.isArray(json.data)) {
                console.log(`Success! Received ${json.data.length} candles.`);
                console.log('First candle:', json.data[0]);
            } else {
                console.log('Response Body (JSON):', JSON.stringify(json, null, 2).slice(0, 500) + '...');
            }
        } catch (e) {
            console.log('Response Body (Text):', text.slice(0, 500));
        }
    } catch (error) {
        console.error('Fetch error (Make sure backend server is running on port 3001):', error.message);
    }
}

async function main() {
    console.log('--- Starting API Debug Check ---');
    await checkSymbol('AAPL'); // Should succeed if API key is valid
    await checkSymbol('SNDK'); // Likely to fail (delisted/acquired)
    console.log('\n--- End of Debug Check ---');
}

main();
