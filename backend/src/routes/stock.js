const express = require('express');
const router = express.Router();
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

/**
 * Yahoo Finance APIから株価データを取得するエンドポイント
 * GET /api/stock/:symbol
 * Query Params:
 * - country: 'JP' | 'US'
 * - startDate: YYYY-MM-DD
 * - endDate: YYYY-MM-DD
 */
router.get('/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { country } = req.query; // endDate, startDate are not strictly used by Alpha Vantage Daily (it returns full history compact/full), but we could filter if needed.

        // Alpha Vantage API Key
        const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
        if (!apiKey) {
            console.error('Alpha Vantage API Key is missing.');
            return res.status(500).json({ error: 'Server configuration error: API Key missing' });
        }

        // シンボル変換 (Alpha Vantageは日本株には非対応の可能性が高いが、US株はそのまま)
        // 日本株(.T)対応はAlpha Vantageの仕様によるが、通常は "6758.TOK" などの形式が必要な場合がある。
        // ここではユーザー要望に従いAlpha Vantageへ切り替えるが、日本株のサポート状況に注意が必要。
        // 一旦そのままのシンボルまたは単純な変換で試行する。
        // 米国株: そのまま (e.g. AAPL)
        // 日本株: Alpha Vantageは主要な取引所をサポートしているが、シンボル形式は "8035.TOK" (Tokyo) 等の場合がある。
        // とりあえず ".T" -> ".TOK" 変換などを試みるが、まずはそのまま送ってみる。

        // *User request implies replacing Yahoo limitation. 
        // Alpha Vantage's "TIME_SERIES_DAILY" returns daily data.

        // Free Tier limitation: 'full' outputsize is premium. Default is 'compact' (latest 100 data points).
        const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`;

        console.log(`[DEBUG] Fetching data for ${symbol} from Alpha Vantage`);
        console.log(`[DEBUG] URL: https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=HIDDEN`);

        const response = await fetch(url);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[DEBUG] Alpha Vantage API Error: ${response.status}`, errorText);
            return res.status(response.status).json({
                error: `Alpha Vantage API error: ${response.statusText}`,
                details: errorText
            });
        }

        const data = await response.json();

        // Log the keys of the response to see what we got
        console.log(`[DEBUG] Response keys: ${Object.keys(data).join(', ')}`);

        // エラーレスポンスハンドリング (Alpha Vantageは200 OKでもエラーメッセージをJSONで返すことがある)
        if (data['Error Message']) {
            console.error('[DEBUG] Alpha Vantage Error:', data['Error Message']);
            return res.status(404).json({ error: 'Symbol not found or API error', details: data['Error Message'] });
        }
        if (data['Note']) {
            // Rate Limit etc.
            console.warn('[DEBUG] Alpha Vantage Note (Rate Limit?):', data['Note']);
            // Limit reached is often 200 OK with a Note
            return res.status(429).json({ error: 'API Rate limit exceeded', details: data['Note'] });
        }
        if (data['Information']) {
            console.warn('[DEBUG] Alpha Vantage Information:', data['Information']);
            return res.status(429).json({ error: 'API Information message (limit?)', details: data['Information'] });
        }

        const timeSeries = data['Time Series (Daily)'];
        if (!timeSeries) {
            console.error('[DEBUG] "Time Series (Daily)" not found in response.');
            return res.status(404).json({ error: 'No data found for this symbol', rawData: data });
        }

        // データ変換
        // Alpha Vantage format:
        // "2023-10-27": {
        //     "1. open": "166.9100",
        //     "2. high": "168.9600",
        //     "3. low": "166.8300",
        //     "4. close": "168.2200",
        //     "5. volume": "58499129"
        // }

        const candles = Object.entries(timeSeries).map(([date, values]) => {
            const v = values; // Type: any
            return {
                time: date,
                open: parseFloat(v['1. open']),
                high: parseFloat(v['2. high']),
                low: parseFloat(v['3. low']),
                close: parseFloat(v['4. close']),
                volume: parseInt(v['5. volume'], 10)
            };
        });

        console.log(`[DEBUG] Successfully processed ${candles.length} candles for ${symbol}`);

        // 日付昇順にソート (Alpha Vantageは通常降順で返すが、チャートライブラリは昇順を期待することが多い)
        candles.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

        res.json({
            symbol: symbol,
            country: country,
            data: candles
        });

    } catch (error) {
        console.error('[DEBUG] API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
