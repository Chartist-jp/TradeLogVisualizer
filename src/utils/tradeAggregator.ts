import { Trade, AggregatedTrade } from '../db/database';

/**
 * 約定データをトレード単位に統合する
 * 同じ銘柄の買いと売りをマッチングし、損益を計算する
 */
export function aggregateTrades(trades: Trade[]): AggregatedTrade[] {
    // 銘柄別にグループ化
    const groupedBySymbol = groupBySymbol(trades);

    const aggregatedTrades: AggregatedTrade[] = [];

    // 各銘柄ごとに処理
    for (const symbolTrades of Object.values(groupedBySymbol)) {
        // 日付順にソート
        const sortedTrades = symbolTrades.sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // FIFOベースでマッチング
        const matched = matchBuysAndSells(sortedTrades);
        aggregatedTrades.push(...matched);
    }

    return aggregatedTrades;
}

/**
 * 銘柄別にグループ化（symbol + country）
 */
function groupBySymbol(trades: Trade[]): Record<string, Trade[]> {
    const grouped: Record<string, Trade[]> = {};

    for (const trade of trades) {
        const key = `${trade.symbol}_${trade.country}`;
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(trade);
    }

    return grouped;
}

/**
 * 買いと売りをマッチングし、統合トレードを生成
 * FIFOアルゴリズム: 先に買ったものから先に売る
 */
function matchBuysAndSells(trades: Trade[]): AggregatedTrade[] {
    const aggregated: AggregatedTrade[] = [];
    const buyQueue: Trade[] = [];

    for (const trade of trades) {
        if (trade.side === 'BUY') {
            // 買いはキューに追加
            buyQueue.push(trade);
        } else {
            // 売りの場合、キューから買いを取り出してマッチング
            let remainingSellQuantity = trade.quantity;
            const matchedBuys: Trade[] = [];

            while (remainingSellQuantity > 0 && buyQueue.length > 0) {
                const buy = buyQueue[0];

                if (buy.quantity <= remainingSellQuantity) {
                    // 買いポジション全体を決済
                    matchedBuys.push(buy);
                    remainingSellQuantity -= buy.quantity;
                    buyQueue.shift();
                } else {
                    // 買いポジションの一部を決済
                    const partialBuy: Trade = {
                        ...buy,
                        quantity: remainingSellQuantity
                    };
                    matchedBuys.push(partialBuy);

                    // 残りの買いポジションを更新
                    buy.quantity -= remainingSellQuantity;
                    remainingSellQuantity = 0;
                }
            }

            // マッチした買いと売りから統合トレードを生成
            if (matchedBuys.length > 0) {
                const aggregatedTrade = createAggregatedTrade(matchedBuys, trade);
                aggregated.push(aggregatedTrade);
            }
        }
    }

    return aggregated;
}

/**
 * マッチした買いと売りから統合トレードを生成
 */
function createAggregatedTrade(buys: Trade[], sell: Trade): AggregatedTrade {
    // 加重平均の計算
    const totalQuantity = buys.reduce((sum, buy) => sum + buy.quantity, 0);
    const totalEntryCost = buys.reduce((sum, buy) => sum + (buy.price * buy.quantity), 0);
    const avgEntryPrice = totalEntryCost / totalQuantity;

    // 売りの情報
    const totalExitRevenue = sell.price * totalQuantity;
    const avgExitPrice = sell.price;

    // 損益計算
    const profitLoss = totalExitRevenue - totalEntryCost;
    const profitLossPercent = (profitLoss / totalEntryCost) * 100;

    // 保有期間計算
    const entryDate = buys[0].date;
    const exitDate = sell.date;
    const holdingDays = calculateHoldingDays(entryDate, exitDate);

    return {
        symbol: sell.symbol,
        name: sell.name,
        country: sell.country,

        entryDate,
        avgEntryPrice,
        totalQuantity,
        totalEntryCost,

        exitDate,
        avgExitPrice,
        totalExitRevenue,

        profitLoss,
        profitLossPercent,
        holdingDays,

        entryTradeIds: buys.map(b => b.id!).filter(id => id !== undefined),
        exitTradeIds: [sell.id!].filter(id => id !== undefined),
        createdAt: new Date()
    };
}

/**
 * 保有期間を日数で計算
 */
function calculateHoldingDays(entryDate: string, exitDate: string): number {
    const entry = new Date(entryDate);
    const exit = new Date(exitDate);
    const diffTime = Math.abs(exit.getTime() - entry.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

/**
 * 統合トレードを再計算してDBに保存
 */
export async function recalculateAggregatedTrades(db: any): Promise<number> {
    // 全ての約定データを取得
    const allTrades = await db.trades.toArray();

    // 統合トレードを計算
    const aggregated = aggregateTrades(allTrades);

    // 既存の統合トレードを削除
    await db.aggregatedTrades.clear();

    // 新しい統合トレードを保存
    await db.aggregatedTrades.bulkAdd(aggregated);

    return aggregated.length;
}
