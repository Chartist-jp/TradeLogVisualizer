import React, { useEffect, useState } from 'react';
import { db, AggregatedTrade } from '../db/database';
import TradeChartGroup from './TradeChartGroup';
import { LogicalRange } from 'lightweight-charts';
import './MultiChartDashboard.css';

const MultiChartDashboard: React.FC = () => {
    const [trades, setTrades] = useState<AggregatedTrade[]>([]);
    const [loading, setLoading] = useState(true);
    const [displayCount, setDisplayCount] = useState(6); // 初期表示数を6に変更
    const [sharedTimeRange, setSharedTimeRange] = useState<LogicalRange | null>(null);

    // 同期ハンドラ
    const handleTimeRangeChange = (range: LogicalRange | null) => {
        setSharedTimeRange(range);
    };

    useEffect(() => {
        loadTrades();
    }, []);

    const loadTrades = async () => {
        setLoading(true);
        try {
            // インデックスを使用して新しい順（降順）に取得
            // idはautoIncrementなので、大きいほど新しいと仮定できるが、
            // exitDateでソートするのが確実。
            // Dexieで全件取得後ソート（件数が少なければ）

            const allTrades = await db.aggregatedTrades.toArray();

            // 決済日（exitDate）の降順でソート
            allTrades.sort((a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime());

            setTrades(allTrades);
        } catch (error) {
            console.error('トレード取得エラー:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLoadMore = () => {
        setDisplayCount(prev => prev + 6);
    };

    if (loading) return <div className="dashboard-loading">読み込み中...</div>;

    const visibleTrades = trades.slice(0, displayCount);

    return (
        <div className="multi-chart-dashboard">
            <div className="dashboard-header-stats">
                <h2>📊 チャートダッシュボード</h2>
                <div className="stats-info">
                    全 {trades.length} トレード中 {visibleTrades.length} 件を表示（同期中）
                </div>
            </div>

            <div className="dashboard-grid">
                {visibleTrades.map(trade => (
                    <TradeChartGroup
                        key={trade.id}
                        trade={trade}
                        onTimeRangeChange={handleTimeRangeChange}
                        visibleRange={sharedTimeRange}
                    />
                ))}
            </div>

            {visibleTrades.length < trades.length && (
                <div className="load-more-container">
                    <button className="load-more-btn" onClick={handleLoadMore}>
                        もっと読み込む (+6)
                    </button>
                </div>
            )}
        </div>
    );
};

export default MultiChartDashboard;
