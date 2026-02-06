import React, { useEffect, useState } from 'react';
import { AggregatedTrade } from '../db/database';
import { fetchStockDataWithCache, CandleData } from '../services/stockDataService';
import StockChart from './StockChart';
import { Time, SeriesMarker, LogicalRange } from 'lightweight-charts';
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
        setLoading(true);
        setError('');
        try {
            // 前後120日のデータを取得（日足用、少し広めに）
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

    // マーカー生成
    const createMarkers = (): SeriesMarker<Time>[] => {
        const markers: SeriesMarker<Time>[] = [];
        const format = (d: string) => d.replace(/\//g, '-') as Time;
        const cur = trade.country === 'JP' ? '¥' : '$';

        markers.push({
            time: format(trade.entryDate),
            position: 'belowBar',
            color: '#2196F3',
            shape: 'arrowUp',
            text: `Buy ${cur}${trade.avgEntryPrice.toLocaleString()}`,
        });

        markers.push({
            time: format(trade.exitDate),
            position: 'aboveBar',
            color: trade.profitLoss >= 0 ? '#4CAF50' : '#F44336',
            shape: 'arrowDown',
            text: `Sell ${cur}${trade.avgExitPrice.toLocaleString()}`,
        });

        return markers;
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
                        return (
                            <>
                                <div className="stat-item">
                                    <span className="label">取得:</span>
                                    <span className="value">{cur}{trade.avgEntryPrice.toLocaleString()}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="label">売却:</span>
                                    <span className="value">{cur}{trade.avgExitPrice.toLocaleString()}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="label">株数:</span>
                                    <span className="value">{trade.totalQuantity.toLocaleString()}</span>
                                </div>
                                <div className="stat-item">
                                    <span className="label">損益:</span>
                                    <span className={`value ${profitClassName}`}>
                                        {cur}{trade.profitLoss.toLocaleString()} ({trade.profitLossPercent.toFixed(2)}%)
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
                    markers={createMarkers()}
                    title="日足"
                    height={250}
                    onVisibleTimeRangeChange={onTimeRangeChange}
                    visibleRange={visibleRange}
                />
            </div>
        </div>
    );
};

export default TradeChartGroup;
