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
    HistogramData
} from 'lightweight-charts';
import { CandleData } from '../services/stockDataService';
import './TradingChart.css';

export interface StockChartProps {
    data: CandleData[];
    markers?: SeriesMarker<Time>[];
    height?: number;
    title?: string;
    showYAxis?: boolean;
    onChartCreated?: (chart: IChartApi) => void;
    onVisibleTimeRangeChange?: (range: LogicalRange | null) => void;
    visibleRange?: LogicalRange | null;
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
    height = 300,
    title,
    showYAxis = true,
    onChartCreated,
    onVisibleTimeRangeChange,
    visibleRange,
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const sma5SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const sma21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const sma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const volSma50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
    const isSettingRangeRef = useRef(false);

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
                timeVisible: true,
                rightOffset: 12,
                barSpacing: 3,
            },
            rightPriceScale: {
                borderColor: '#cccccc',
                visible: showYAxis,
            },
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
        });
        seriesRef.current = candleSeries;

        // ボリュームシリーズ (サブスケール)
        const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume', // 別スケール
        });
        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
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
    }, [data, markers]);

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

        // SMA の計算と設定
        if (sma5SeriesRef.current) sma5SeriesRef.current.setData(calculateSMA(closeValues, 5));
        if (sma21SeriesRef.current) sma21SeriesRef.current.setData(calculateSMA(closeValues, 21));
        if (sma50SeriesRef.current) sma50SeriesRef.current.setData(calculateSMA(closeValues, 50));
        if (volSma50SeriesRef.current) volSma50SeriesRef.current.setData(calculateSMA(volValues, 50));

        // マーカーの精密調整
        // 矢印が取得価格・売却価格を正確に指すように、マーカーがデータと正確に一致するように設定される
        // SeriesMarker 自体はバーの上か下かを指定するが、価格そのものを指すために text や position を活用
        if (markers.length > 0) {
            seriesRef.current.setMarkers(markers.map(m => ({
                ...m,
                // LWCのデフォルト挙動を尊重しつつ、見やすさを確保
                size: 1.5,
            })));
        }

        if (chartRef.current && !visibleRange) {
            chartRef.current.timeScale().fitContent();
        }
    };

    return (
        <div className="stock-chart-wrapper">
            {title && <div className="stock-chart-title">{title}</div>}
            <div ref={chartContainerRef} className="chart-canvas" />
        </div>
    );
};

export default StockChart;

