import React, { useEffect, useState } from 'react';
import { db, AggregatedTrade } from '../db/database';
import TradingChart from './TradingChart';
import './AggregatedTradeList.css';

const AggregatedTradeList: React.FC = () => {
    const [trades, setTrades] = useState<AggregatedTrade[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTrade, setSelectedTrade] = useState<AggregatedTrade | null>(null);

    useEffect(() => {
        loadTrades();
    }, []);

    const loadTrades = async () => {
        try {
            const allTrades = await db.aggregatedTrades.toArray();
            // 最新順にソート (exitDate降順)
            allTrades.sort((a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime());
            setTrades(allTrades);
        } catch (error) {
            console.error('統合トレードの読み込みエラー:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number, country: 'JP' | 'US') => {
        if (country === 'JP') {
            return `¥${value.toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`;
        } else {
            return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
    };

    const formatPercent = (value: number) => {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    };

    const stats = {
        totalTrades: trades.length,
        winRate: trades.length > 0 ? (trades.filter(t => t.profitLoss > 0).length / trades.length) * 100 : 0,
        totalPL_JP: trades.filter(t => t.country === 'JP').reduce((sum, t) => sum + t.profitLoss, 0),
        totalPL_US: trades.filter(t => t.country === 'US').reduce((sum, t) => sum + t.profitLoss, 0),
    };

    if (loading) {
        return <div className="loading">読み込み中...</div>;
    }

    if (trades.length === 0) {
        return (
            <div className="empty-state">
                <p>統合されたトレードがありません。</p>
                <p>CSVファイルをインポートしてください。</p>
            </div>
        );
    }

    return (
        <div className="aggregated-trade-list">
            <div className="list-header">
                <h2>トレード履歴（統合済み）</h2>
            </div>

            {/* 選択したトレードのチャート表示 */}
            {selectedTrade && (
                <div className="chart-section">
                    <div className="chart-header-actions">
                        <button
                            className="close-chart-btn"
                            onClick={() => setSelectedTrade(null)}
                        >
                            ✕ チャートを閉じる
                        </button>
                    </div>
                    <TradingChart trade={selectedTrade} />
                </div>
            )}

            <div className="trade-stats">
                <div className="stat-item">
                    <span className="stat-label">総トレード数:</span>
                    <span className="stat-value">{stats.totalTrades}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">勝率:</span>
                    <span className="stat-value">{stats.winRate.toFixed(1)}%</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">合計損益 (JP):</span>
                    <span className={`stat-value ${stats.totalPL_JP >= 0 ? 'profit' : 'loss'}`}>
                        {formatCurrency(stats.totalPL_JP, 'JP')}
                    </span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">合計損益 (US):</span>
                    <span className={`stat-value ${stats.totalPL_US >= 0 ? 'profit' : 'loss'}`}>
                        {formatCurrency(stats.totalPL_US, 'US')}
                    </span>
                </div>
            </div>

            <table className="trade-table">
                <thead>
                    <tr>
                        <th>銘柄</th>
                        <th>エントリー日</th>
                        <th>エグジット日</th>
                        <th>保有日数</th>
                        <th>数量</th>
                        <th>平均取得単価</th>
                        <th>平均売却単価</th>
                        <th>損益額</th>
                        <th>利益率</th>
                        <th>アクション</th>
                    </tr>
                </thead>
                <tbody>
                    {trades.map((trade, index) => (
                        <tr
                            key={trade.id || index}
                            className={`${trade.profitLoss >= 0 ? 'profit-row' : 'loss-row'} ${selectedTrade?.id === trade.id ? 'selected-row' : ''}`}
                        >
                            <td>
                                <div className="symbol-cell">
                                    <div className="symbol-info">
                                        <span className="symbol">{trade.symbol}</span>
                                        <span className="name">{trade.name}</span>
                                    </div>
                                    <span className="country-badge">{trade.country}</span>
                                </div>
                            </td>
                            <td>{trade.entryDate}</td>
                            <td>{trade.exitDate}</td>
                            <td>{trade.holdingDays}日</td>
                            <td>{trade.totalQuantity.toLocaleString()}</td>
                            <td>{formatCurrency(trade.avgEntryPrice, trade.country)}</td>
                            <td>{formatCurrency(trade.avgExitPrice, trade.country)}</td>
                            <td className={trade.profitLoss >= 0 ? 'profit' : 'loss'}>
                                {formatCurrency(trade.profitLoss, trade.country)}
                            </td>
                            <td className={trade.profitLossPercent >= 0 ? 'profit' : 'loss'}>
                                {formatPercent(trade.profitLossPercent)}
                            </td>
                            <td>
                                <button
                                    className="view-chart-btn"
                                    onClick={() => setSelectedTrade(trade)}
                                >
                                    📊 チャート
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default AggregatedTradeList;
