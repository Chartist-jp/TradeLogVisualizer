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
        const { country, startDate, endDate } = req.query;

        if (!country || !startDate || !endDate) {
            return res.status(400).json({
                error: 'Missing required query parameters: country, startDate, endDate'
            });
        }

        // Yahoo Finance形式のシンボル変換
        // 日本株の場合は .T を付与（既に付いている場合はそのまま）
        let yahooSymbol = symbol;
        if (country === 'JP' && !symbol.endsWith('.T')) {
            yahooSymbol = `${symbol}.T`;
        }

        // 日付をUnixタイムスタンプに変換
        const period1 = Math.floor(new Date(startDate).getTime() / 1000);
        const period2 = Math.floor(new Date(endDate).getTime() / 1000);

        console.log(`Fetching data for ${yahooSymbol} from ${startDate} to ${endDate}`);

        // Yahoo Finance APIへのリクエスト
        // interval=1d (日足)
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${period1}&period2=${period2}&interval=1d`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Yahoo Finance API Error: ${response.status} ${response.statusText}`, errorText);
            return res.status(response.status).json({
                error: `Yahoo Finance API error: ${response.statusText}`,
                details: errorText,
                url: url
            });
        }

        const data = await response.json();

        // データが存在しない場合のチェック
        if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
            return res.status(404).json({ error: 'No data found for this symbol' });
        }

        const result = data.chart.result[0];
        const timestamps = result.timestamp;
        const indicators = result.indicators.quote[0];

        // データがない場合
        if (!timestamps || !indicators) {
            return res.status(404).json({ error: 'No chart data available' });
        }

        // クライアントが期待する形式に変換
        const candles = timestamps.map((timestamp, index) => {
            // null値のチェック（取引停止などでデータが欠損している場合）
            if (indicators.open[index] === null) return null;

            return {
                time: new Date(timestamp * 1000).toISOString().split('T')[0],
                open: indicators.open[index],
                high: indicators.high[index],
                low: indicators.low[index],
                close: indicators.close[index],
                volume: indicators.volume[index]
            };
        }).filter(candle => candle !== null); // nullを除外

        res.json({
            symbol: symbol,
            country: country,
            data: candles
        });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
