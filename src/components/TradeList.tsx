import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import type { Trade } from '../db/database';
import { recalculateAggregatedTrades } from '../utils/tradeAggregator';
import './TradeList.css';

const TradeList: React.FC = () => {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Trade; direction: 'asc' | 'desc' } | null>(null);
    const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

    useEffect(() => {
        loadTrades();
    }, []);

    const loadTrades = async () => {
        try {
            const allTrades = await db.trades.orderBy('date').reverse().toArray();
            setTrades(allTrades);
        } catch (err) {
            console.error('Failed to load trades:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (key: keyof Trade) => {
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

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm('このトレードを削除しますか？')) {
            await db.trades.delete(id);
            await recalculateAggregatedTrades(db);
            loadTrades();
        }
    };

    const handleClearAll = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (window.confirm('全てのトレードデータを削除しますか？この操作は取り消せません。')) {
            await db.trades.clear();
            await recalculateAggregatedTrades(db);
            loadTrades();
        }
    };

    const handleEditClick = (trade: Trade) => {
        setEditingTrade({ ...trade });
    };

    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTrade || !editingTrade.id) return;

        try {
            await db.trades.update(editingTrade.id, editingTrade);
            await recalculateAggregatedTrades(db);
            setEditingTrade(null);
            loadTrades();
        } catch (err) {
            console.error('Failed to update trade:', err);
            alert('更新に失敗しました。');
        }
    };

    const handleEditChange = (key: keyof Trade, value: any) => {
        if (editingTrade) {
            setEditingTrade({ ...editingTrade, [key]: value });
        }
    };

    if (loading) {
        return <div className="trade-list-container">読み込み中...</div>;
    }

    return (
        <div className="trade-list-container">
            <div className="trade-list-header">
                <h2>インポート済みトレード ({trades.length}件)</h2>
                {trades.length > 0 && (
                    <button onClick={handleClearAll} className="clear-all-btn">
                        全て削除
                    </button>
                )}
            </div>

            {trades.length === 0 ? (
                <p className="empty-message">まだトレードデータがありません。上記からインポートしてください。</p>
            ) : (
                <div className="trade-table-wrapper">
                    <table className="trade-table">
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('date')} className="sortable">日付 {sortConfig?.key === 'date' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                <th onClick={() => handleSort('name')} className="sortable">銘柄 {sortConfig?.key === 'name' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                <th onClick={() => handleSort('symbol')} className="sortable">コード {sortConfig?.key === 'symbol' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                <th onClick={() => handleSort('side')} className="sortable">売買 {sortConfig?.key === 'side' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                <th onClick={() => handleSort('price')} className="sortable">価格 {sortConfig?.key === 'price' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                <th onClick={() => handleSort('quantity')} className="sortable">数量 {sortConfig?.key === 'quantity' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                <th onClick={() => handleSort('country')} className="sortable">国 {sortConfig?.key === 'country' && (sortConfig.direction === 'asc' ? '▲' : '▼')}</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedTrades.map((trade) => (
                                <tr key={trade.id}>
                                    <td>{trade.date}</td>
                                    <td>{trade.name}</td>
                                    <td>{trade.symbol}</td>
                                    <td>
                                        <span className={`side-badge ${trade.side.toLowerCase()}`}>
                                            {trade.side === 'BUY' ? '買い' : '売り'}
                                        </span>
                                    </td>
                                    <td className="number">
                                        {trade.country === 'JP' ? '¥' : '$'}
                                        {trade.price.toLocaleString(undefined, trade.country === 'US' ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {})}
                                    </td>
                                    <td className="number">{trade.quantity.toLocaleString()}</td>
                                    <td>
                                        <span className="country-badge">{trade.country}</span>
                                    </td>
                                    <td className="action-buttons">
                                        <button
                                            onClick={() => handleEditClick(trade)}
                                            className="edit-btn"
                                        >
                                            編集
                                        </button>
                                        <button
                                            onClick={(e) => trade.id && handleDelete(e, trade.id)}
                                            className="delete-btn"
                                        >
                                            削除
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit Modal */}
            {editingTrade && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>トレード編集</h3>
                        <form onSubmit={handleEditSave}>
                            <div className="form-group">
                                <label>日付:</label>
                                <input
                                    type="date"
                                    value={editingTrade.date}
                                    onChange={(e) => handleEditChange('date', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>銘柄名:</label>
                                <input
                                    type="text"
                                    value={editingTrade.name}
                                    onChange={(e) => handleEditChange('name', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>コード:</label>
                                <input
                                    type="text"
                                    value={editingTrade.symbol}
                                    onChange={(e) => handleEditChange('symbol', e.target.value)}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>売買:</label>
                                <select
                                    value={editingTrade.side}
                                    onChange={(e) => handleEditChange('side', e.target.value as 'BUY' | 'SELL')}
                                >
                                    <option value="BUY">買い</option>
                                    <option value="SELL">売り</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>価格:</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editingTrade.price}
                                    onChange={(e) => handleEditChange('price', parseFloat(e.target.value))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>数量:</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editingTrade.quantity}
                                    onChange={(e) => handleEditChange('quantity', parseFloat(e.target.value))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>国:</label>
                                <select
                                    value={editingTrade.country}
                                    onChange={(e) => handleEditChange('country', e.target.value as 'JP' | 'US')}
                                >
                                    <option value="JP">日本</option>
                                    <option value="US">米国</option>
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="button" onClick={() => setEditingTrade(null)} className="cancel-btn">キャンセル</button>
                                <button type="submit" className="save-btn">保存</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TradeList;
