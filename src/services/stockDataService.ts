/**
 * 株価データ取得サービス
 * 
 * 無料で利用できるデータソース:
 * 1. Yahoo Finance (非公式API) - 日本株・米国株対応
 * 2. Alpha Vantage - 無料枠あり（1日500リクエスト）
 * 3. Finnhub - 無料枠あり（1分60リクエスト）
 * 
 * このファイルではYahoo Finance非公式APIを使用
 */

export interface CandleData {
    time: string; // YYYY-MM-DD形式
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface StockDataResponse {
    symbol: string;
    data: CandleData[];
}

/**
 * Yahoo Finance APIから株価データを取得
 * 日本株: 銘柄コード.T (例: 9984.T)
 * 米国株: そのまま (例: AAPL)
 */
export async function fetchStockData(
    symbol: string,
    country: 'JP' | 'US',
    startDate: string,
    endDate: string
): Promise<CandleData[]> {
    try {
        // バックエンドAPI経由でデータを取得
        // 開発環境: http://localhost:3001
        const API_BASE_URL = 'http://localhost:3001';
        const url = `${API_BASE_URL}/api/stock/${symbol}?country=${country}&startDate=${startDate}&endDate=${endDate}`;

        console.log(`Fetching data from: ${url}`);

        const response = await fetch(url);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API Error: ${response.status} ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        return data.data; // バックエンドが整形したデータを返す
    } catch (error) {
        console.error(`株価データ取得エラー (${symbol}):`, error);
        throw error;
    }
}

/**
 * 複数銘柄の株価データを一括取得
 */
export async function fetchMultipleStockData(
    symbols: Array<{ symbol: string; country: 'JP' | 'US' }>,
    startDate: string,
    endDate: string
): Promise<Map<string, CandleData[]>> {
    const results = new Map<string, CandleData[]>();

    // 並列リクエスト（レート制限に注意）
    const promises = symbols.map(async ({ symbol, country }) => {
        try {
            const data = await fetchStockData(symbol, country, startDate, endDate);
            const key = `${symbol}_${country}`;
            results.set(key, data);
        } catch (error) {
            console.error(`${symbol}のデータ取得に失敗:`, error);
            // エラーでも続行
        }
    });

    await Promise.all(promises);

    return results;
}

/**
 * ローカルストレージにキャッシュする
 */
const CACHE_PREFIX = 'stock_data_cache_';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24時間

export async function fetchStockDataWithCache(
    symbol: string,
    country: 'JP' | 'US',
    startDate: string,
    endDate: string
): Promise<CandleData[]> {
    const cacheKey = `${CACHE_PREFIX}${symbol}_${country}_${startDate}_${endDate}`;

    // キャッシュチェック
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;

        if (age < CACHE_DURATION) {
            console.log(`キャッシュから取得: ${symbol}`);
            return data;
        }
    }

    // 新規取得
    const data = await fetchStockData(symbol, country, startDate, endDate);

    // キャッシュに保存
    localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
    }));

    return data;
}

/**
 * IndexedDBにキャッシュする（大量データ向け）
 * 将来的な拡張用のプレースホルダー関数
 */
export async function cacheStockDataToDB(): Promise<void> {
    // 将来的にIndexedDBでのキャッシュを実装
    // 現在はlocalStorageを使用
}
