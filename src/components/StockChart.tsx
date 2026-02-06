import React, { useEffect, useRef } from 'react';
import {
    createChart,
    IChartApi,
    ISeriesApi,
    CandlestickData,
    Time,
    SeriesMarker,
    LogicalRange,
    LineData,
    HistogramData,
    ISeriesPrimitive,
    ISeriesPrimitivePaneView,
    ISeriesPrimitivePaneRenderer,
    Coordinate,
    PriceLineOptions,
    LineStyle,
    SeriesAttachedParameter
} from 'lightweight-charts';
import { CandleData } from '../services/stockDataService';
import './TradingChart.css';

export interface PrecisionMarker {
    time: Time;
    price: number;
    direction: 'up' | 'down';
    color: string;
    text?: string;
}

export interface StockChartProps {
    data: CandleData[];
    markers?: SeriesMarker<Time>[]; // 互換性のために残す
    precisionMarkers?: PrecisionMarker[]; // 精密描画用
    height?: number;
    title?: string;
    showYAxis?: boolean;
    country?: 'JP' | 'US';
    onChartCreated?: (chart: IChartApi) => void;
    onVisibleTimeRangeChange?: (range: LogicalRange | null) => void;
    visibleRange?: LogicalRange | null;
}

// 精密矢印描画用 Primitive
class ArrowPrimitive implements ISeriesPrimitive<Time> {
    private _data: PrecisionMarker[];
    private _chart: IChartApi | null = null;
    private _series: ISeriesApi<'Candlestick'> | null = null;

    constructor(data: PrecisionMarker[]) {
        this._data = data;
    }

    attached(param: SeriesAttachedParameter<Time>): void {
        this._chart = param.chart;
        this._series = param.series as ISeriesApi<'Candlestick'>;
    }

    detached(): void {
        this._chart = null;
        this._series = null;
    }

    paneViews(): readonly ISeriesPrimitivePaneView[] {
        return [{
            renderer: () => new ArrowRenderer(this._data, this._chart, this._series),
        }];
    }

    updateAllViews?(): void { }
}

class ArrowRenderer implements ISeriesPrimitivePaneRenderer {
    constructor(
        private data: PrecisionMarker[],
        private chart: IChartApi | null,
        private series: ISeriesApi<'Candlestick'> | null
    ) { }

    draw(target: any): void {
        target.useMediaCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            if (!this.chart || !this.series) return;

            const timeScale = this.chart.timeScale();

            this.data.forEach(item => {
                const x = timeScale.timeToCoordinate(item.time);
                const y = this.series!.priceToCoordinate(item.price);

                if (x === null || y === null) return;

                // スケールに応じた座標変換
                const xCoord = x as number;
                const yCoord = y as number;

                ctx.fillStyle = item.color;
                ctx.beginPath();

                const size = 12;
                const halfWidth = 6;

                if (item.direction === 'up') {
                    // 上向き：先端が y
                    ctx.moveTo(xCoord, yCoord);
                    ctx.lineTo(xCoord - halfWidth, yCoord + size);
                    ctx.lineTo(xCoord + halfWidth, yCoord + size);
                } else {
                    // 下向き：先端が y
                    ctx.moveTo(xCoord, yCoord);
                    ctx.lineTo(xCoord - halfWidth, yCoord - size);
                    ctx.lineTo(xCoord + halfWidth, yCoord - size);
                }
                ctx.fill();

                if (item.text) {
                    ctx.font = '11px sans-serif';
                    ctx.textAlign = 'center';
                    if (item.direction === 'up') {
                        ctx.textBaseline = 'top';
                        ctx.fillText(item.text, xCoord, yCoord + size + 2);
                    } else {
                        ctx.textBaseline = 'bottom';
                        ctx.fillText(item.text, xCoord, yCoord - size - 2);
                    }
                }
            });
        });
    }
}

// 移動平均線の計算
const calculateSMA = (data: { value: number, time: Time }[], period: number): LineData[] => {
    const sma: LineData[] = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) continue;
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].value;
        }
        sma.push({ time: data[i].time, value: sum / period });
    }
    return sma;
};

const StockChart: React.FC<StockChartProps> = ({
    data,
    markers = [],
    precisionMarkers = [],
    height = 300,
    title,
    showYAxis = true,
    country = 'JP',
    onChartCreated,
    onVisibleTimeRangeChange,
    visibleRange,
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const legendRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const sma5SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const sma21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const sma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const volSma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const primitiveRef = useRef<ArrowPrimitive | null>(null);
    const priceLinesRef = useRef<any[]>([]); // PriceLineの参照保持用
    const isSettingRangeRef = useRef(false);
    const lastDataRef = useRef<any>(null); // 非ホバー時の初期表示用

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            width: chartContainerRef.current.clientWidth,
            height: height,
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
                timeVisible: false, // 時刻を非表示
                rightOffset: 12,
                barSpacing: 3,
            },
            rightPriceScale: {
                borderColor: '#cccccc',
                visible: showYAxis,
            },
            localization: {
                // ホバー時の日付ツールチップから時刻を削除
                timeFormatter: (time: Time) => {
                    if (typeof time === 'string') return time;
                    const date = new Date((time as number) * 1000);
                    return date.toLocaleDateString();
                }
            }
        });

        chartRef.current = chart;
        if (onChartCreated) {
            onChartCreated(chart);
        }

        if (onVisibleTimeRangeChange) {
            chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
                if (isSettingRangeRef.current) return;
                onVisibleTimeRangeChange(range);
            });
        }

        // シリーズの初期化
        const candleSeries = chart.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
            lastValueVisible: false, // 最新値ラベルを表示しない
            priceFormat: {
                type: 'price',
                precision: country === 'JP' ? 0 : 2,
                minMove: country === 'JP' ? 1 : 0.01,
            },
        });
        seriesRef.current = candleSeries;

        // ボリュームシリーズ (サブスケール)
        const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume', // 別スケール
            lastValueVisible: false, // 最新値ラベルを表示しない
        });
        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
            visible: false, // 出来高軸自体を非表示にする（ラベルも消える）
        });
        volumeSeriesRef.current = volumeSeries;

        // SMA シリーズ
        sma5SeriesRef.current = chart.addLineSeries({
            color: '#ff9800',
            lineWidth: 1,
            lastValueVisible: false,
            priceLineVisible: false,
        });
        sma21SeriesRef.current = chart.addLineSeries({
            color: '#2196f3',
            lineWidth: 1,
            lastValueVisible: false,
            priceLineVisible: false,
        });
        sma50SeriesRef.current = chart.addLineSeries({
            color: '#4caf50',
            lineWidth: 1,
            lastValueVisible: false,
            priceLineVisible: false,
        });

        // 出来高SMA (ボリュームと同じスケールに配置)
        volSma50SeriesRef.current = chart.addLineSeries({
            color: '#e91e63',
            lineWidth: 1,
            priceScaleId: 'volume',
            lastValueVisible: false,
            priceLineVisible: false,
        });

        // 凡例(Legend)の更新ロジック
        chart.subscribeCrosshairMove((param) => {
            if (!legendRef.current) return;

            if (
                param.point === undefined ||
                !param.time ||
                param.point.x < 0 ||
                param.point.x > chartContainerRef.current!.clientWidth ||
                param.point.y < 0 ||
                param.point.y > height
            ) {
                // 範囲外なら最新（一番最後）のデータを表示
                updateLegendText(lastDataRef.current);
            } else {
                const dateStr = typeof param.time === 'string' ? param.time : new Date((param.time as number) * 1000).toLocaleDateString();
                const candle = param.seriesData.get(candleSeries) as CandlestickData;
                const volume = param.seriesData.get(volumeSeries) as HistogramData;
                const sma5 = param.seriesData.get(sma5SeriesRef.current!) as LineData;
                const sma21 = param.seriesData.get(sma21SeriesRef.current!) as LineData;
                const sma50 = param.seriesData.get(sma50SeriesRef.current!) as LineData;

                updateLegendText({ dateStr, candle, volume, sma5, sma21, sma50 });
            }
        });

        updateChartData();

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
    }, []);

    useEffect(() => {
        if (chartRef.current && visibleRange && !isSettingRangeRef.current) {
            isSettingRangeRef.current = true;
            chartRef.current.timeScale().setVisibleLogicalRange(visibleRange);
            setTimeout(() => {
                isSettingRangeRef.current = false;
            }, 10);
        }
    }, [visibleRange]);

    useEffect(() => {
        updateChartData();
    }, [data, markers, precisionMarkers]);

    const updateChartData = () => {
        if (!seriesRef.current || data.length === 0) return;

        const candlestickData: CandlestickData[] = [];
        const volumeData: HistogramData[] = [];
        const closeValues: { value: number, time: Time }[] = [];
        const volValues: { value: number, time: Time }[] = [];

        data.forEach(candle => {
            const time = candle.time as Time;
            candlestickData.push({
                time,
                open: candle.open,
                high: candle.high,
                low: candle.low,
                close: candle.close,
            });
            volumeData.push({
                time,
                value: candle.volume,
                color: candle.close >= candle.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)',
            });
            closeValues.push({ time, value: candle.close });
            volValues.push({ time, value: candle.volume });
        });

        seriesRef.current.setData(candlestickData);
        if (volumeSeriesRef.current) volumeSeriesRef.current.setData(volumeData);

        // SMA の計算
        const sma5Data = calculateSMA(closeValues, 5);
        const sma21Data = calculateSMA(closeValues, 21);
        const sma50Data = calculateSMA(closeValues, 50);
        const volSma50Data = calculateSMA(volValues, 50);

        if (sma5SeriesRef.current) sma5SeriesRef.current.setData(sma5Data);
        if (sma21SeriesRef.current) sma21SeriesRef.current.setData(sma21Data);
        if (sma50SeriesRef.current) sma50SeriesRef.current.setData(sma50Data);
        if (volSma50SeriesRef.current) volSma50SeriesRef.current.setData(volSma50Data);

        // 最新データを保持（非ホバー時の表示用）
        const lastCandle = candlestickData[candlestickData.length - 1];
        const lastVol = volumeData[volumeData.length - 1];
        const lastS5 = sma5Data[sma5Data.length - 1];
        const lastS21 = sma21Data[sma21Data.length - 1];
        const lastS50 = sma50Data[sma50Data.length - 1];

        lastDataRef.current = {
            dateStr: typeof lastCandle.time === 'string' ? lastCandle.time : new Date((lastCandle.time as number) * 1000).toLocaleDateString(),
            candle: lastCandle,
            volume: lastVol,
            sma5: lastS5,
            sma21: lastS21,
            sma50: lastS50
        };

        // 初期表示・データ更新時に凡例を更新
        updateLegendText(lastDataRef.current);

        // 標準マーカーの設定
        if (markers.length > 0) {
            seriesRef.current.setMarkers(markers.map(m => ({
                ...m,
                size: 1.5,
            })));
        }

        // 精密マーカー (Primitive) の設定
        if (precisionMarkers.length > 0) {
            if (primitiveRef.current) {
                seriesRef.current.detachPrimitive(primitiveRef.current);
            }
            primitiveRef.current = new ArrowPrimitive(precisionMarkers);
            seriesRef.current.attachPrimitive(primitiveRef.current);

            // 既存のPriceLineを削除
            priceLinesRef.current.forEach(line => seriesRef.current?.removePriceLine(line));
            priceLinesRef.current = [];

            // PriceLineの追加
            precisionMarkers.forEach(pm => {
                const line = seriesRef.current!.createPriceLine({
                    price: pm.price,
                    color: pm.color,
                    lineWidth: 1,
                    lineStyle: LineStyle.Dashed,
                    axisLabelVisible: true,
                    title: pm.direction === 'up' ? 'BUY' : 'SELL',
                });
                priceLinesRef.current.push(line);
            });
        }

        if (chartRef.current && !visibleRange) {
            chartRef.current.timeScale().fitContent();
        }
    };

    const updateLegendText = (info: any) => {
        if (!legendRef.current) return;
        if (!info) {
            legendRef.current.innerHTML = '';
            return;
        }

        const { dateStr, candle, volume, sma5, sma21, sma50 } = info;
        const prec = country === 'JP' ? 0 : 2;
        const f = (v: number | undefined) => v !== undefined ? v.toLocaleString(undefined, { minimumFractionDigits: prec, maximumFractionDigits: prec }) : 'n/a';

        let html = `<div class="legend-row">
            <span class="legend-date">${dateStr}</span>
            <span class="legend-label">O</span><span class="legend-value">${f(candle?.open)}</span>
            <span class="legend-label">H</span><span class="legend-value">${f(candle?.high)}</span>
            <span class="legend-label">L</span><span class="legend-value">${f(candle?.low)}</span>
            <span class="legend-label">C</span><span class="legend-value">${f(candle?.close)}</span>
            <span class="legend-label">V</span><span class="legend-value">${volume?.value?.toLocaleString() || 'n/a'}</span>
        </div>`;

        html += `<div class="legend-row sma-row">
            <span class="sma-label" style="color:#ff9800">SMA5: ${f(sma5?.value)}</span>
            <span class="sma-label" style="color:#2196f3">SMA21: ${f(sma21?.value)}</span>
            <span class="sma-label" style="color:#4caf50">SMA50: ${f(sma50?.value)}</span>
        </div>`;

        legendRef.current.innerHTML = html;
    };

    return (
        <div className="stock-chart-wrapper">
            {title && <div className="stock-chart-title">{title}</div>}
            <div className="chart-relative-container">
                <div ref={legendRef} className="chart-legend" />
                <div ref={chartContainerRef} className="chart-canvas" />
            </div>
        </div>
    );
};

export default StockChart;
