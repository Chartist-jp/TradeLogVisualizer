import React, { useState, useEffect } from 'react';
import { db } from '../db/database';
import type { Trade } from '../db/database';
import './TradeList.css';

const TradeList: React.FC = () => {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);

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

    const handleDelete = async (id: number) => {
        if (confirm('このトレードを削除しますか？')) {
            await db.trades.delete(id);
            loadTrades();
        }
    };

    const handleClearAll = async () => {
        if (confirm('全てのトレードデータを削除しますか？この操作は取り消せません。')) {
            await db.trades.clear();
            loadTrades();
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
                                <th>日付</th>
                                <th>銘柄</th>
                                <th>コード</th>
                                <th>売買</th>
                                <th>価格</th>
                                <th>数量</th>
                                <th>国</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trades.map((trade) => (
                                <tr key={trade.id}>
                                    <td>{trade.date}</td>
                                    <td>{trade.name}</td>
                                    <td>{trade.symbol}</td>
                                    <td>
                                        <span className={`side-badge ${trade.side.toLowerCase()}`}>
                                            {trade.side === 'BUY' ? '買い' : '売り'}
                                        </span>
                                    </td>
                                    <td className="number">{trade.price.toLocaleString()}</td>
                                    <td className="number">{trade.quantity.toLocaleString()}</td>
                                    <td>
                                        <span className="country-badge">{trade.country}</span>
                                    </td>
                                    <td>
                                        <button
                                            onClick={() => trade.id && handleDelete(trade.id)}
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
        </div>
    );
};

export default TradeList;
