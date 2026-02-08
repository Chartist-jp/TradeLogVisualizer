import React, { useEffect, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
import { fetchStockDataWithCache } from '../services/stockDataService';
import { AggregatedTrade } from '../db/database';
import './TradingChart.css';

interface TradingChartProps {
    trade: AggregatedTrade;
}

/**
 * 売買ポイント専用のPrimitive（カスタム描画）
 * 先端が価格位置に正確に接地する矢印を描画します
 */
class ArrowPrimitive {
    private _data: any[];
    private _chart: IChartApi | null = null;
    private _series: ISeriesApi<'Candlestick'> | null = null;

    constructor(data: any[]) {
        this._data = data;
    }

    attached(param: { chart: IChartApi; series: ISeriesApi<'Candlestick'> }) {
        this._chart = param.chart;
        this._series = param.series;
    }

    detached() {
        this._chart = null;
        this._series = null;
    }

    updateAllViews() { }

    paneViews() {
        return [{
            renderer: () => ({
                draw: (target: any) => {
                    target.useMediaCoordinateSpace((scope: any) => {
                        this._drawArrows(scope.context);
                    });
                }
            })
        }];
    }

    private _drawArrows(ctx: CanvasRenderingContext2D) {
        if (!this._chart || !this._series) return;

        const timeScale = this._chart.timeScale();

        this._data.forEach(item => {
            const x = timeScale.timeToCoordinate(item.time as Time);
            const y = this._series?.priceToCoordinate(item.price);

            if (x === null || y === null || y === undefined) return;

            ctx.fillStyle = item.color;
            ctx.beginPath();

            const size = 12; // 矢印の高さ
            const halfWidth = 6; // 矢印の幅の半分

            if (item.direction === 'up') {
                // 上向き矢印（買い）：先端(x, y)が価格位置
                ctx.moveTo(x, y);
                ctx.lineTo(x - halfWidth, y + size);
                ctx.lineTo(x + halfWidth, y + size);
            } else {
                // 下向き矢印（売り）：先端(x, y)が価格位置
                ctx.moveTo(x, y);
                ctx.lineTo(x - halfWidth, y - size);
                ctx.lineTo(x + halfWidth, y - size);
            }
            ctx.fill();

            if (item.text) {
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'center';
                if (item.direction === 'up') {
                    ctx.textBaseline = 'top';
                    ctx.fillText(item.text, x, y + size + 2);
                } else {
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(item.text, x, y - size - 2);
                }
            }
        });
    }
}

const TradingChart: React.FC<TradingChartProps> = ({ trade }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // チャート初期化
        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: 400,
            layout: {
                background: { color: '#ffffff' },
                textColor: '#333',
            },
            grid: {
                vertLines: { color: '#f0f0f0' },
                horzLines: { color: '#f0f0f0' },
            },
            timeScale: {
                borderColor: '#cccccc',
                timeVisible: true,
            },
            rightPriceScale: {
                borderColor: '#cccccc',
            },
        });

        chartRef.current = chart;

        // ローソク足シリーズ追加
        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        });

        candlestickSeriesRef.current = candlestickSeries;

        // 出来高シリーズ追加
        const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: {
                type: 'volume',
            },
            priceScaleId: '', // priceScaleIdを空にするとメインのチャートに重ねて表示
        });

        // 出来高を画面下部20%に表示するためのマージン設定
        volumeSeries.priceScale().applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0,
            },
        });

        volumeSeriesRef.current = volumeSeries;

        // データ取得
        loadChartData();

        // リサイズ対応
        const handleResize = () => {
            if (chartContainerRef.current && chartRef.current) {
                chartRef.current.applyOptions({
                    width: chartContainerRef.current.clientWidth,
                });
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [trade]);

    const loadChartData = async () => {
        setLoading(true);
        setError('');

        try {
            // エントリー日の60日前からエグジット日の60日後までのデータを取得 (期間を延長)
            const startDate = new Date(trade.entryDate);
            startDate.setDate(startDate.getDate() - 60);

            const endDate = new Date(trade.exitDate);
            endDate.setDate(endDate.getDate() + 60);

            const stockData = await fetchStockDataWithCache(
                trade.symbol,
                trade.country,
                startDate.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0]
            );

            if (stockData.length === 0) {
                setError('株価データが取得できませんでした');
                return;
            }

            // Lightweight Charts形式に変換
            const chartData: CandlestickData[] = stockData.map(candle => ({
                time: candle.time as Time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
            }));

            candlestickSeriesRef.current?.setData(chartData);

            // 出来高データを変換（色の設定を含む）
            const volumeData = stockData.map(candle => ({
                time: candle.time as Time,
                value: candle.volume,
                color: candle.close >= candle.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
            }));

            volumeSeriesRef.current?.setData(volumeData);

            // トレード情報（マーカーとプライスライン）を追加
            addTradeVisuals();

            // 表示範囲を調整
            chartRef.current?.timeScale().fitContent();

        } catch (err) {
            console.error('チャートデータ読み込みエラー:', err);
            setError('データの読み込みに失敗しました');
        } finally {
            setLoading(false);
        }
    };

    const addTradeVisuals = () => {
        if (!candlestickSeriesRef.current) return;

        const dateToTime = (dateStr: string): Time => {
            return dateStr.replace(/\//g, '-') as Time;
        };

        const entryTime = dateToTime(trade.entryDate);
        const exitTime = dateToTime(trade.exitDate);

        // 1. カスタムマーカー (Primitive) の追加
        const arrowsData = [
            {
                time: entryTime,
                price: trade.avgEntryPrice,
                direction: 'up',
                color: '#2196F3',
                text: `買 ¥${trade.avgEntryPrice.toLocaleString()}`
            },
            {
                time: exitTime,
                price: trade.avgExitPrice,
                direction: 'down',
                color: trade.profitLoss >= 0 ? '#4CAF50' : '#F44336',
                text: `売 ¥${trade.avgExitPrice.toLocaleString()}`
            }
        ];

        // @ts-ignore: Primitive API type compatibility
        candlestickSeriesRef.current.attachPrimitive(new ArrowPrimitive(arrowsData));

        // 2. プライスライン（点線）の追加
        // エントリーライン
        candlestickSeriesRef.current.createPriceLine({
            price: trade.avgEntryPrice,
            color: '#2196F3',
            lineWidth: 2,
            lineStyle: 2, // Dashed (LineStyle.Dashed)
            axisLabelVisible: true,
            title: '買い',
        });

        // エグジットライン
        candlestickSeriesRef.current.createPriceLine({
            price: trade.avgExitPrice,
            color: trade.profitLoss >= 0 ? '#4CAF50' : '#F44336',
            lineWidth: 2,
            lineStyle: 2, // Dashed (LineStyle.Dashed)
            axisLabelVisible: true,
            title: '売り',
        });
    };

    return (
        <div className="trading-chart-container">
            <div className="chart-header">
                <div className="chart-title">
                    <h3>{trade.symbol} - {trade.name}</h3>
                    <span className="country-badge">{trade.country}</span>
                </div>
                <div className="trade-summary">
                    <span className={`profit-loss ${trade.profitLoss >= 0 ? 'profit' : 'loss'}`}>
                        {trade.profitLoss >= 0 ? '+' : ''}
                        {trade.profitLoss.toLocaleString()}円
                        ({trade.profitLossPercent >= 0 ? '+' : ''}{trade.profitLossPercent.toFixed(2)}%)
                    </span>
                    <span className="holding-period">{trade.holdingDays}日保有</span>
                </div>
            </div>

            {loading && <div className="chart-loading">チャートを読み込み中...</div>}
            {error && <div className="chart-error">{error}</div>}

            <div ref={chartContainerRef} className="chart-canvas" />
        </div>
    );
};

export default TradingChart;
