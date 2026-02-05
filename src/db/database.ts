import Dexie, { Table } from 'dexie';

export interface Trade {
    id?: number;
    date: string;
    symbol: string;
    name: string;
    side: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    country: 'JP' | 'US';
    createdAt: Date;
}

// 統合されたトレードデータ（買い→売りのペア）
export interface AggregatedTrade {
    id?: number;
    symbol: string;
    name: string;
    country: 'JP' | 'US';

    // エントリー情報
    entryDate: string;
    avgEntryPrice: number;
    totalQuantity: number;
    totalEntryCost: number;

    // エグジット情報
    exitDate: string;
    avgExitPrice: number;
    totalExitRevenue: number;

    // 損益情報
    profitLoss: number;
    profitLossPercent: number;
    holdingDays: number;

    // メタデータ
    entryTradeIds: number[];
    exitTradeIds: number[];
    createdAt: Date;
}

export class TradeLogDB extends Dexie {
    trades!: Table<Trade>;
    aggregatedTrades!: Table<AggregatedTrade>;

    constructor() {
        super('TradeLogDB');
        this.version(1).stores({
            trades: '++id, symbol, date, side, country, createdAt'
        });

        // バージョン2: 統合トレードテーブル追加
        this.version(2).stores({
            trades: '++id, symbol, date, side, country, createdAt',
            aggregatedTrades: '++id, symbol, country, entryDate, exitDate, profitLoss, profitLossPercent, createdAt'
        });
    }
}

export const db = new TradeLogDB();
