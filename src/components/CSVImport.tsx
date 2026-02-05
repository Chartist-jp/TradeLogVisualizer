import React, { useState } from 'react';
import { parseSBICSV, decodeShiftJIS } from '../utils/csvParser';
import { db } from '../db/database';
import { recalculateAggregatedTrades } from '../utils/tradeAggregator';
import './CSVImport.css';

interface CSVImportProps {
    onImportSuccess?: () => void;
}

const CSVImport: React.FC<CSVImportProps> = ({ onImportSuccess }) => {
    const [dragActive, setDragActive] = useState(false);
    const [importedCount, setImportedCount] = useState(0);
    const [error, setError] = useState<string>('');
    const [detectedCountry, setDetectedCountry] = useState<'JP' | 'US' | null>(null);

    // 手入力フォーム用のstate
    const [manualForm, setManualForm] = useState({
        symbol: '',
        date: '',
        side: 'BUY' as 'BUY' | 'SELL',
        price: '',
        quantity: '',
        name: '',
        country: 'JP' as 'JP' | 'US'
    });

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await processFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            await processFile(e.target.files[0]);
        }
    };

    const processFile = async (file: File) => {
        setError('');
        setImportedCount(0);
        setDetectedCountry(null);

        try {
            // ArrayBufferとして読み込み、Shift-JISをデコード
            const arrayBuffer = await file.arrayBuffer();
            const text = decodeShiftJIS(arrayBuffer);

            const trades = parseSBICSV(text); // 自動判別版

            if (trades.length === 0) {
                setError('CSVファイルからデータを読み取れませんでした。フォーマットを確認してください。');
                return;
            }

            // 判別された国を表示用に保存
            setDetectedCountry(trades[0].country);

            // IndexedDBに保存
            const tradesWithTimestamp = trades.map(trade => ({
                ...trade,
                createdAt: new Date()
            }));

            await db.trades.bulkAdd(tradesWithTimestamp);

            // 統合トレードを再計算
            await recalculateAggregatedTrades(db);

            setImportedCount(trades.length);
            onImportSuccess?.();
        } catch (err) {
            setError(`エラー: ${err instanceof Error ? err.message : '不明なエラー'}`);
        }
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            await db.trades.add({
                symbol: manualForm.symbol,
                date: manualForm.date,
                side: manualForm.side,
                price: parseFloat(manualForm.price),
                quantity: parseFloat(manualForm.quantity),
                name: manualForm.name || manualForm.symbol,
                country: manualForm.country,
                createdAt: new Date()
            });

            // 統合トレードを再計算
            await recalculateAggregatedTrades(db);

            // フォームをリセット
            setManualForm({
                symbol: '',
                date: '',
                side: 'BUY',
                price: '',
                quantity: '',
                name: '',
                country: 'JP'
            });

            setImportedCount(1);
            onImportSuccess?.();
        } catch (err) {
            setError(`エラー: ${err instanceof Error ? err.message : '不明なエラー'}`);
        }
    };

    return (
        <div className="csv-import-container">
            <h1>トレードデータのインポート</h1>

            {/* CSVファイルインポート */}
            <section className="import-section">
                <h2>CSVファイルからインポート</h2>

                <div
                    className={`drop-zone ${dragActive ? 'active' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <p>SBI証券のCSVファイルをここにドラッグ&ドロップ</p>
                    <p className="sub-text">（日本株・米国株を自動判別します）</p>
                    <p className="or-text">または</p>
                    <label className="file-upload-btn">
                        ファイルを選択
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                    </label>
                </div>

                {detectedCountry && (
                    <div className="detected-info">
                        検出: {detectedCountry === 'JP' ? '日本株' : '米国株'}
                    </div>
                )}
            </section>

            {/* 手入力フォーム */}
            <section className="import-section">
                <h2>手動入力</h2>
                <form onSubmit={handleManualSubmit} className="manual-form">
                    <div className="form-row">
                        <label>
                            国:
                            <select
                                value={manualForm.country}
                                onChange={(e) => setManualForm({ ...manualForm, country: e.target.value as 'JP' | 'US' })}
                            >
                                <option value="JP">日本株</option>
                                <option value="US">米国株</option>
                            </select>
                        </label>
                        <label>
                            銘柄コード:
                            <input
                                type="text"
                                value={manualForm.symbol}
                                onChange={(e) => setManualForm({ ...manualForm, symbol: e.target.value })}
                                required
                                placeholder={manualForm.country === 'JP' ? '9984' : 'AAPL'}
                            />
                        </label>
                    </div>

                    <div className="form-row">
                        <label>
                            銘柄名（任意）:
                            <input
                                type="text"
                                value={manualForm.name}
                                onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })}
                            />
                        </label>
                        <label>
                            約定日:
                            <input
                                type="date"
                                value={manualForm.date}
                                onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                                required
                            />
                        </label>
                    </div>

                    <div className="form-row">
                        <label>
                            売買:
                            <select
                                value={manualForm.side}
                                onChange={(e) => setManualForm({ ...manualForm, side: e.target.value as 'BUY' | 'SELL' })}
                            >
                                <option value="BUY">買い</option>
                                <option value="SELL">売り</option>
                            </select>
                        </label>
                        <label>
                            価格:
                            <input
                                type="number"
                                step="0.01"
                                value={manualForm.price}
                                onChange={(e) => setManualForm({ ...manualForm, price: e.target.value })}
                                required
                            />
                        </label>
                    </div>

                    <div className="form-row">
                        <label>
                            数量:
                            <input
                                type="number"
                                step="0.01"
                                value={manualForm.quantity}
                                onChange={(e) => setManualForm({ ...manualForm, quantity: e.target.value })}
                                required
                            />
                        </label>
                        <div></div>
                    </div>

                    <button type="submit" className="submit-btn">追加</button>
                </form>
            </section>

            {/* ステータス表示 */}
            {importedCount > 0 && (
                <div className="success-message">
                    ✓ {importedCount}件のトレードをインポートしました
                </div>
            )}

            {error && (
                <div className="error-message">
                    {error}
                </div>
            )}
        </div>
    );
};

export default CSVImport;
