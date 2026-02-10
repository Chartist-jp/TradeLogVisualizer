import React, { useEffect, useState } from 'react';
import { db, AggregatedTrade } from '../db/database';
import TradingChart from './TradingChart';
import './AggregatedTradeList.css';

const AggregatedTradeList: React.FC = () => {
    const [trades, setTrades] = useState<AggregatedTrade[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTrade, setSelectedTrade] = useState<AggregatedTrade | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: keyof AggregatedTrade; direction: 'asc' | 'desc' } | null>({ key: 'exitDate', direction: 'desc' });

    useEffect(() => {
        loadTrades();
    }, []);

    const loadTrades = async () => {
        try {
            const allTrades = await db.aggregatedTrades.toArray();
            setTrades(allTrades);
        } catch (error) {
            console.error('統合トレードの読み込みエラー:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: keyof AggregatedTrade) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedTrades = React.useMemo(() => {
        let sortableTrades = [...trades];
        if (sortConfig !== null) {
            sortableTrades.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue === undefined || bValue === undefined) return 0;

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableTrades;
    }, [trades, sortConfig]);

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
                        <th onClick={() => handleSort('symbol')} className="sortable">銘柄 {sortConfig?.key === 'symbol' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                        <th onClick={() => handleSort('entryDate')} className="sortable">エントリー日 {sortConfig?.key === 'entryDate' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                        <th onClick={() => handleSort('exitDate')} className="sortable">エグジット日 {sortConfig?.key === 'exitDate' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                        <th onClick={() => handleSort('holdingDays')} className="sortable">保有日数 {sortConfig?.key === 'holdingDays' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                        <th onClick={() => handleSort('totalQuantity')} className="sortable">数量 {sortConfig?.key === 'totalQuantity' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                        <th onClick={() => handleSort('avgEntryPrice')} className="sortable">平均取得単価 {sortConfig?.key === 'avgEntryPrice' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                        <th onClick={() => handleSort('avgExitPrice')} className="sortable">平均売却単価 {sortConfig?.key === 'avgExitPrice' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                        <th onClick={() => handleSort('profitLoss')} className="sortable">損益額 {sortConfig?.key === 'profitLoss' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                        <th onClick={() => handleSort('profitLossPercent')} className="sortable">利益率 {sortConfig?.key === 'profitLossPercent' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                        <th>アクション</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedTrades.map((trade, index) => (
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
