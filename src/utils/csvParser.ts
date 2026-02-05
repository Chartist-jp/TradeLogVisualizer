import Encoding from 'encoding-japanese';

export interface Trade {
    date: string;
    symbol: string;
    name: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    country: 'JP' | 'US';
}

/**
 * CSVの内容から日本株か米国株かを自動判別
 */
const detectCountry = (csvText: string): 'JP' | 'US' | null => {
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line !== "");

    // ヘッダー行を探す
    for (const line of lines) {
        // 日本株の特徴: "銘柄コード" カラムが存在
        if (line.includes("銘柄コード")) {
            return 'JP';
        }
        // 米国株の特徴: "国内約定日" カラムが存在、または取引所名が含まれる
        if (line.includes("国内約定日") && line.includes("銘柄名")) {
            return 'US';
        }
    }

    // データ行から判別を試みる
    for (const line of lines.slice(1, 10)) { // 最初の数行をチェック
        const cols = line.split(',').map(c => c.replace(/"/g, ''));

        // 米国株の特徴: 取引所名が含まれる
        if (cols.some(col => col.includes('New York Stock Exchange') || col.includes('NASDAQ'))) {
            return 'US';
        }

        // 日本株の特徴: 数字のみの銘柄コード（4桁程度）
        if (cols.some(col => /^\d{4,5}$/.test(col))) {
            return 'JP';
        }
    }

    return null;
};

/**
 * SBI証券 CSVパースロジック（自動判別版・Shift-JIS対応）
 */
export const parseSBICSV = (csvText: string): Trade[] => {
    const country = detectCountry(csvText);

    if (!country) {
        throw new Error('CSVファイルの形式を判別できませんでした。SBI証券の約定履歴CSVであることを確認してください。');
    }

    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line !== "");
    const results: Trade[] = [];

    if (country === 'JP') {
        // 日本株：ヘッダー行（約定日,銘柄,銘柄コード...）を探す
        const headerIndex = lines.findIndex(l => l.includes("約定日") && l.includes("銘柄コード"));
        if (headerIndex === -1) {
            throw new Error('日本株CSVのヘッダー行が見つかりませんでした。');
        }

        const dataLines = lines.slice(headerIndex + 1);

        dataLines.forEach(line => {
            // 空行をスキップ
            if (!line || line.trim() === '') return;

            const cols = line.split(',').map(c => c.replace(/"/g, '').trim());
            if (cols.length < 10) return;

            // 投信などは銘柄コードがないためスキップ
            if (!cols[2] || cols[2] === "" || cols[2] === "--") return;

            // 取引列から売買を判定
            const tradeType = cols[4]; // "株式現物買" or "株式現物売"
            if (!tradeType.includes("買") && !tradeType.includes("売")) return;

            results.push({
                date: cols[0],             // 2025/10/03
                symbol: cols[2],           // 4593
                name: cols[1],             // ヘリオス
                side: tradeType.includes("買") ? "BUY" : "SELL",
                quantity: parseFloat(cols[8].replace(/,/g, '')),
                price: parseFloat(cols[9].replace(/,/g, '')),
                country: 'JP'
            });
        });

    } else if (country === 'US') {
        // 米国株：ヘッダー行（国内約定日,通貨,銘柄名...）を探す
        const headerIndex = lines.findIndex(l => l.includes("国内約定日") && l.includes("銘柄名"));
        if (headerIndex === -1) {
            throw new Error('米国株CSVのヘッダー行が見つかりませんでした。');
        }

        const dataLines = lines.slice(headerIndex + 1);

        dataLines.forEach(line => {
            // 空行をスキップ
            if (!line || line.trim() === '') return;

            const cols = line.split(',').map(c => c.replace(/"/g, '').trim());
            if (cols.length < 7) return;

            // 銘柄名からティッカーを抽出 (例: "アメンタム ホールディングス インク AMTM / New York Stock Exchange" -> "AMTM")
            const symbolNameCol = cols[2];
            const tickerMatch = symbolNameCol.match(/([A-Z]{2,5})\s*\//);
            const ticker = tickerMatch ? tickerMatch[1] : symbolNameCol;

            // 銘柄名部分を抽出（ティッカーと取引所名を除く）
            const nameMatch = symbolNameCol.split(' / ')[0];
            const name = nameMatch.replace(/\s+[A-Z]{2,5}\s*$/, '').trim();

            // 取引列から売買を判定
            const tradeType = cols[3]; // "買付" or "売却"
            if (!tradeType.includes("買") && !tradeType.includes("売")) return;

            // 日付を統一フォーマットに変換 "2026年01月30日" -> "2026/01/30"
            const formattedDate = cols[0].replace(/年|月/g, '/').replace(/日/g, '');

            results.push({
                date: formattedDate,
                symbol: ticker,
                name: name,
                side: tradeType.includes("買") ? "BUY" : "SELL",
                quantity: parseFloat(cols[5].replace(/,/g, '')),
                price: parseFloat(cols[6].replace(/,/g, '')),
                country: 'US'
            });
        });
    }

    return results;
};

/**
 * ArrayBufferをShift-JISからUTF-8にデコード
 */
export const decodeShiftJIS = (buffer: ArrayBuffer): string => {
    const uint8Array = new Uint8Array(buffer);
    const unicodeArray = Encoding.convert(uint8Array, {
        to: 'UNICODE',
        from: 'SJIS'
    });
    return Encoding.codeToString(unicodeArray);
};
