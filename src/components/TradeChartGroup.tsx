import React, { useEffect, useState } from 'react';
import { AggregatedTrade } from '../db/database';
import { fetchStockDataWithCache, CandleData } from '../services/stockDataService';
import StockChart, { PrecisionMarker } from './StockChart';
import { Time, LogicalRange } from 'lightweight-charts';
import './TradeChartGroup.css';

interface TradeChartGroupProps {
    trade: AggregatedTrade;
    onTimeRangeChange?: (range: LogicalRange | null) => void;
    visibleRange?: LogicalRange | null;
}

const TradeChartGroup: React.FC<TradeChartGroupProps> = ({ trade, onTimeRangeChange, visibleRange }) => {
    const [dailyData, setDailyData] = useState<CandleData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadData();
    }, [trade]);

    const loadData = async () => {
        // ... (既存のコード)
        setLoading(true);
        setError('');
        try {
            const startDate = new Date(trade.entryDate);
            startDate.setDate(startDate.getDate() - 120);

            const endDate = new Date(trade.exitDate);
            endDate.setDate(endDate.getDate() + 80);

            const data = await fetchStockDataWithCache(
                trade.symbol,
                trade.country,
                startDate.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0]
            );

            if (data.length === 0) {
                setError('データがありません');
                return;
            }

            setDailyData(data);
        } catch (err) {
            console.error(err);
            setError('データの読み込みに失敗');
        } finally {
            setLoading(false);
        }
    };

    // 精密マーカーの生成
    const createPrecisionMarkers = (): PrecisionMarker[] => {
        const format = (d: string) => d.replace(/\//g, '-') as Time;
        const cur = trade.country === 'JP' ? '¥' : '$';
        const priceDigits = trade.country === 'JP' ? 0 : 2;

        return [
            {
                time: format(trade.entryDate),
                price: trade.avgEntryPrice,
                direction: 'up',
                color: '#2196F3',
                // text: `Buy ${cur}${trade.avgEntryPrice.toLocaleString(undefined, { minimumFractionDigits: priceDigits, maximumFractionDigits: priceDigits })}`,
                text: `Buy`,
            },
            {
                time: format(trade.exitDate),
                price: trade.avgExitPrice,
                direction: 'down',
                color: trade.profitLoss >= 0 ? '#4CAF50' : '#F44336',
                // text: `Sell ${cur}${trade.avgExitPrice.toLocaleString(undefined, { minimumFractionDigits: priceDigits, maximumFractionDigits: priceDigits })}`,
                text: `Sell`,
            }
        ];
    };

    const getTradingViewUrl = () => {
        const symbol = trade.country === 'JP' ? `TSE:${trade.symbol}` : trade.symbol;
        return `https://www.tradingview.com/chart/?symbol=${symbol}`;
    };

    if (loading) return <div className="chart-group-loading">読み込み中...</div>;
    if (error) return <div className="chart-group-error">{error}</div>;

    const profitClassName = trade.profitLoss >= 0 ? 'profit' : 'loss';

    return (
        <div className={`trade-chart-group ${profitClassName}`}>
            <div className="chart-group-header">
                <div className="trade-info-main">
                    <div className="trade-info-left">
                        <span className="symbol">{trade.symbol}</span>
                        <span className="name">{trade.name}</span>
                    </div>
                    <div className="header-actions">
                        <a
                            href={getTradingViewUrl()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tv-link"
                            title="TradingViewで開く"
                        >
                            📈 TradingView
                        </a>
                    </div>
                </div>
                <div className="trade-stats-row">
                    {(() => {
                        const cur = trade.country === 'JP' ? '¥' : '$';
                        const digits = trade.country === 'JP' ? 0 : 2;
                        const f = (val: number) => val.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

                        return (
                            <>
                                <div className="stat-item">
                                    <span className="label">取得:</span>
                                    <span className="value">{cur}{f(trade.avgEntryPrice)}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="label">売却:</span>
                                    <span className="value">{cur}{f(trade.avgExitPrice)}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="label">株数:</span>
                                    <span className="value">{trade.totalQuantity.toLocaleString()}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="label">損益:</span>
                                    <span className={`value ${profitClassName}`}>
                                        {cur}{f(trade.profitLoss)} ({trade.profitLossPercent.toFixed(2)}%)
                                    </span>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>
            <div className="charts-single">
                <StockChart
                    data={dailyData}
                    precisionMarkers={createPrecisionMarkers()}
                    // title="日足"
                    height={250}
                    country={trade.country}
                    onVisibleTimeRangeChange={onTimeRangeChange}
                    visibleRange={visibleRange}
                />
            </div>
        </div>
    );
};

export default TradeChartGroup;

