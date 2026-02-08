import React, { useState, useEffect, useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { db, AggregatedTrade } from '../db/database';
import './PortfolioAnalysis.css';

interface Props {
    // No props needed for this standalone component
}

interface AnalysisStats {
    totalPL: number;
    winRate: number;
    avgHoldingDays: number;
    profitFactor: number;
    tradeCount: number;
}

const PortfolioAnalysis: React.FC<Props> = () => {
    // ... (rest of the component state remains the same)
    // State for main date range
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    // State for comparison date range
    const [compStartDate, setCompStartDate] = useState<string>('');
    const [compEndDate, setCompEndDate] = useState<string>('');
    const [showComparison, setShowComparison] = useState<boolean>(false);

    // Data state
    const [trades, setTrades] = useState<AggregatedTrade[]>([]);
    const [compTrades, setCompTrades] = useState<AggregatedTrade[]>([]);

    // Initial data load
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const allTrades = await db.aggregatedTrades.toArray();

                if (allTrades.length > 0) {
                    // Set default range to cover all trades
                    const dates = allTrades.map(t => t.exitDate).sort();
                    setStartDate(dates[0]);
                    setEndDate(dates[dates.length - 1]);
                    setTrades(allTrades);
                }
            } catch (error) {
                console.error("Failed to load trades:", error);
            } finally {
            }
        };
        loadInitialData();
    }, []);

    // Filter trades when date range changes
    useEffect(() => {
        const fetchTrades = async () => {
            if (!startDate || !endDate) return;

            const filtered = await db.aggregatedTrades
                .where('exitDate')
                .between(startDate, endDate, true, true)
                .toArray();
            setTrades(filtered);
        };
        fetchTrades();
    }, [startDate, endDate]);

    // Filter comparison trades
    useEffect(() => {
        const fetchCompTrades = async () => {
            if (!showComparison || !compStartDate || !compEndDate) {
                setCompTrades([]);
                return;
            }

            const filtered = await db.aggregatedTrades
                .where('exitDate')
                .between(compStartDate, compEndDate, true, true)
                .toArray();
            setCompTrades(filtered);
        };
        fetchCompTrades();
    }, [showComparison, compStartDate, compEndDate]);

    // Calculate Histogram Data
    const calculateHistogramData = (main: AggregatedTrade[], comp: AggregatedTrade[]) => {
        const bucketSize = 5; // 5%
        const buckets: Record<string, { range: string; main: number; comp: number; min: number }> = {};

        const getBucketKey = (percent: number) => {
            const lower = Math.floor(percent / bucketSize) * bucketSize;
            return lower;
        };

        let minP = 0, maxP = 0;
        [...main, ...comp].forEach(t => {
            if (t.profitLossPercent < minP) minP = t.profitLossPercent;
            if (t.profitLossPercent > maxP) maxP = t.profitLossPercent;
        });

        const startBucket = Math.floor(minP / bucketSize) * bucketSize;
        const endBucket = Math.floor(maxP / bucketSize) * bucketSize + bucketSize;

        for (let i = startBucket; i < endBucket; i += bucketSize) {
            buckets[i] = {
                range: `${i}% ~ ${i + bucketSize}%`,
                main: 0,
                comp: 0,
                min: i
            };
        }

        main.forEach(t => {
            const k = getBucketKey(t.profitLossPercent);
            if (buckets[k]) buckets[k].main += t.profitLoss;
        });

        comp.forEach(t => {
            const k = getBucketKey(t.profitLossPercent);
            if (buckets[k]) buckets[k].comp += t.profitLoss;
        });

        return Object.values(buckets).sort((a, b) => a.min - b.min);
    };

    // Filter trades by country
    const mainTradesJP = useMemo(() => trades.filter(t => t.country === 'JP'), [trades]);
    const mainTradesUS = useMemo(() => trades.filter(t => t.country === 'US'), [trades]);

    const compTradesJP = useMemo(() => compTrades.filter(t => t.country === 'JP'), [compTrades]);
    const compTradesUS = useMemo(() => compTrades.filter(t => t.country === 'US'), [compTrades]);

    const histogramDataJP = useMemo(() => calculateHistogramData(mainTradesJP, compTradesJP), [mainTradesJP, compTradesJP]);
    const histogramDataUS = useMemo(() => calculateHistogramData(mainTradesUS, compTradesUS), [mainTradesUS, compTradesUS]);

    // Calculate Statistics per country
    const calcStats = (data: AggregatedTrade[]): AnalysisStats => {
        if (data.length === 0) return { totalPL: 0, winRate: 0, avgHoldingDays: 0, profitFactor: 0, tradeCount: 0 };

        const totalPL = data.reduce((sum, t) => sum + t.profitLoss, 0);

        const winCount = data.filter(t => t.profitLoss > 0).length;
        const winRate = (winCount / data.length) * 100;
        const avgHoldingDays = data.reduce((sum, t) => sum + t.holdingDays, 0) / data.length;

        const grossProfit = data.filter(t => t.profitLoss > 0).reduce((sum, t) => sum + t.profitLoss, 0);
        const grossLoss = Math.abs(data.filter(t => t.profitLoss < 0).reduce((sum, t) => sum + t.profitLoss, 0));
        const profitFactor = grossLoss === 0 ? grossProfit : grossProfit / grossLoss;

        return { totalPL, winRate, avgHoldingDays, profitFactor, tradeCount: data.length };
    };

    // Calculate stats for each subset
    const mainStatsJP = useMemo(() => calcStats(mainTradesJP), [mainTradesJP]);
    const mainStatsUS = useMemo(() => calcStats(mainTradesUS), [mainTradesUS]);

    const compStatsJP = useMemo(() => calcStats(compTradesJP), [compTradesJP]);
    const compStatsUS = useMemo(() => calcStats(compTradesUS), [compTradesUS]);

    return (
        <div className="portfolio-analysis-container">
            <div className="analysis-controls">
                <div className="range-selector">
                    <h3>メイン期間</h3>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    <span>~</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>

                <div className="range-selector comparison">
                    <div className="comp-toggle">
                        <label>
                            <input
                                type="checkbox"
                                checked={showComparison}
                                onChange={e => setShowComparison(e.target.checked)}
                            />
                            比較
                        </label>
                    </div>
                    {showComparison && (
                        <>
                            <input type="date" value={compStartDate} onChange={e => setCompStartDate(e.target.value)} />
                            <span>~</span>
                            <input type="date" value={compEndDate} onChange={e => setCompEndDate(e.target.value)} />
                        </>
                    )}
                </div>
            </div>

            <div className="analysis-dashboard">
                {/* 日本株セクション */}
                <div className="country-section">
                    <h3 className="section-title">🇯🇵 日本株 (JP)</h3>
                    <div className="stats-panel">
                        <StatsCard title="現在の期間" stats={mainStatsJP} color="#4caf50" country="JP" />
                        {showComparison && <StatsCard title="比較期間" stats={compStatsJP} color="#2196f3" country="JP" />}
                    </div>

                    <div className="chart-panel">
                        <h3>損益率別の損益額分布 (日本株)</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={histogramDataJP} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="range" />
                                <YAxis
                                    label={{ value: '合計損益額', angle: -90, position: 'insideLeft' }}
                                    tickFormatter={(val) => `¥${val.toLocaleString()}`}
                                />
                                <Tooltip formatter={(val: any) => typeof val === 'number' ? `¥${val.toLocaleString()}` : val} />
                                <Legend />
                                <Bar name="現在" dataKey="main" fill="#82ca9d">
                                    {histogramDataJP.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.main >= 0 ? '#4caf50' : '#ef5350'} />
                                    ))}
                                </Bar>
                                {showComparison && (
                                    <Bar name="比較期間" dataKey="comp" fill="#8884d8" opacity={0.6} />
                                )}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 米国株セクション */}
                <div className="country-section">
                    <h3 className="section-title">🇺🇸 米国株 (US)</h3>
                    <div className="stats-panel">
                        <StatsCard title="現在の期間" stats={mainStatsUS} color="#4caf50" country="US" />
                        {showComparison && <StatsCard title="比較期間" stats={compStatsUS} color="#2196f3" country="US" />}
                    </div>

                    <div className="chart-panel">
                        <h3>損益率別の損益額分布 (米国株)</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={histogramDataUS} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="range" />
                                <YAxis
                                    label={{ value: '合計損益額', angle: -90, position: 'insideLeft' }}
                                    tickFormatter={(val) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                                />
                                <Tooltip formatter={(val: any) => typeof val === 'number' ? `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : val} />
                                <Legend />
                                <Bar name="現在" dataKey="main" fill="#82ca9d">
                                    {histogramDataUS.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.main >= 0 ? '#4caf50' : '#ef5350'} />
                                    ))}
                                </Bar>
                                {showComparison && (
                                    <Bar name="比較期間" dataKey="comp" fill="#8884d8" opacity={0.6} />
                                )}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatsCard: React.FC<{ title: string, stats: AnalysisStats, color: string, country: 'JP' | 'US' }> = ({ title, stats, color, country }) => {
    const formatCurrency = (val: number) => {
        if (country === 'JP') return `¥${val.toLocaleString()}`;
        return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="stats-card" style={{ borderTop: `4px solid ${color}` }}>
            <h4>{title}</h4>
            <div className="stat-row">
                <span>合計損益:</span>
                <span className={stats.totalPL >= 0 ? 'plus' : 'minus'}>
                    {formatCurrency(stats.totalPL)}
                </span>
            </div>
            <div className="stat-row">
                <span>勝率:</span>
                <span>{stats.winRate.toFixed(1)}% ({stats.tradeCount} トレード)</span>
            </div>
            <div className="stat-row">
                <span>プロフィットファクター:</span>
                <span>{stats.profitFactor.toFixed(2)}</span>
            </div>
            <div className="stat-row">
                <span>平均保有日数:</span>
                <span>{stats.avgHoldingDays.toFixed(1)} 日</span>
            </div>
        </div>
    );
};

export default PortfolioAnalysis;
