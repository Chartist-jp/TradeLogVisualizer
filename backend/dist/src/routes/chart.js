"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dbConfig_1 = __importDefault(require("../dbConfig"));
const router = express_1.default.Router();
// Helper to get limit offset
const getPagination = (page, size) => {
    const limit = size ? +size : 30;
    const offset = page ? (page - 1) * limit : 0;
    return { limit, offset };
};
// Mapping from frontend ranking types to DB columns
const getRankInfo = (ranking) => {
    // Frontend uses _, query_chart.py uses -
    const r = ranking.replace('_', '-');
    const map = {
        'up-52wk': ['rank_52wk', 'up_rate_52wk'],
        'ipo': ['ipo_date_rank', 'ipo_date'],
        'gain-daily': ['day_up_rank', 'day_up'],
        'gain-weekly': ['wk_up_rank', 'wk_up'],
        'gain-monthly': ['mon_up_rank', 'mon_up'],
        'lose-daily': ['day_down_rank', 'day_down'],
        'lose-weekly': ['wk_down_rank', 'wk_down'],
        'lose-monthly': ['mon_down_rank', 'mon_down'],
        'trading-value-all': ['trading_value_all_rank', 'trading_value'],
        'trading-value-prm': ['trading_value_prm_rank', 'trading_value'],
        'trading-value-std': ['trading_value_std_rank', 'trading_value'],
        'trading-value-grt': ['trading_value_grt_rank', 'trading_value'],
        'volume-change': ['volume_change_rank', 'volume_change'],
        'volume-increase': ['volume_change_rank', 'volume_change'], // alias
        'high-per': ['high_per_rank', 'per'],
        'low-per': ['low_per_rank', 'per'],
        'low-pbr': ['low_pbr_rank', 'pbr'],
        'high-dividend': ['dividend_yield_rank', 'dividend_yield'],
        'golden-cross': ['golden_cross_num', 'rs_rate'],
    };
    return map[r] || ['', ''];
};
// --- Ranking Charts API ---
router.post('/ranking', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { period = 'daily', ranking, page = 1 } = req.body;
        const { limit, offset } = getPagination(page, 30);
        const [rankCol, infoCol] = getRankInfo(ranking);
        if (!rankCol) {
            console.error('Invalid ranking type:', ranking);
            return res.status(400).json({ error: 'Invalid ranking type' });
        }
        const priceTable = period === 'weekly' ? 'weekly_price' : (period === 'monthly' ? 'monthly_price' : 'daily_price');
        // 1. Get total count
        const [countRows] = yield dbConfig_1.default.query(`SELECT COUNT(*) as count FROM ranking WHERE date = (SELECT MAX(date) FROM ranking WHERE ${rankCol} IS NOT NULL) AND ${rankCol} IS NOT NULL`);
        const totalItems = countRows[0].count;
        const totalPages = Math.ceil(totalItems / limit);
        // 2. Get ranked charts
        // Simplified JOIN query based on query_chart.py
        const query = `
            WITH ranked AS (
                SELECT r.code, r.name, r.${rankCol} AS num, r.${infoCol} AS info,
                    ROW_NUMBER() OVER (ORDER BY r.${rankCol} ASC) AS row_num
                FROM ranking r
                WHERE r.date = (SELECT MAX(date) FROM ranking WHERE ${rankCol} IS NOT NULL)
                    AND r.${rankCol} IS NOT NULL
            )
            SELECT r.code, r.name, r.num, r.info,
                p.date, p.open, p.high, p.low, p.close, p.volume
            FROM ranked r
            JOIN ${priceTable} p ON r.code = p.code
            WHERE r.row_num BETWEEN ? AND ?
                AND p.date >= DATE_SUB(CURRENT_DATE(), INTERVAL 150 DAY)
            ORDER BY r.num ASC, p.date ASC
        `;
        const [rows] = yield dbConfig_1.default.query(query, [offset + 1, offset + limit]);
        // 3. Group by code for ChartData format
        const chartDataMap = {};
        rows.forEach((row) => {
            if (!chartDataMap[row.code]) {
                chartDataMap[row.code] = {
                    code: row.code,
                    name: row.name,
                    dates: [],
                    opens: [],
                    highs: [],
                    lows: [],
                    closes: [],
                    volumes: [],
                    info: { ranking_value: row.info }
                };
            }
            const d = chartDataMap[row.code];
            d.dates.push(row.date);
            d.opens.push(row.open);
            d.highs.push(row.high);
            d.lows.push(row.low);
            d.closes.push(row.close);
            d.volumes.push(row.volume);
        });
        res.json({
            data: Object.values(chartDataMap),
            total_pages: totalPages,
            current_page: page
        });
    }
    catch (error) {
        console.error('Error fetching ranking charts:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}));
// --- Screening API (Stub based on Ranking) ---
router.post('/screening', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // For now, reuse ranking logic or implement specific screening logic
    // Implementation omitted for brevity but similar to ranking
    try {
        const { period = 'daily', screening, page = 1 } = req.body;
        // ... implementation similar to ranking but with different criteria
        res.json({ data: [], total_pages: 0, current_page: page });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
}));
// --- Single Stock Analysis API ---
router.post('/analysis', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let { code, period = 'daily' } = req.body;
        // Normalize code: Add trailing '0' if it's 4 digits
        if (code && code.length === 4 && /^\d+$/.test(code)) {
            code = code + '0';
        }
        const priceTable = period === 'weekly' ? 'weekly_price' : (period === 'monthly' ? 'monthly_price' : 'daily_price');
        const [rows] = yield dbConfig_1.default.query(`SELECT * FROM ${priceTable} WHERE code = ? ORDER BY date ASC`, [code]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Stock not found' });
        }
        const data = {
            code: code,
            name: rows[rows.length - 1].name || code,
            dates: rows.map((r) => r.date),
            opens: rows.map((r) => r.open),
            highs: rows.map((r) => r.high),
            lows: rows.map((r) => r.low),
            closes: rows.map((r) => r.close),
            volumes: rows.map((r) => r.volume),
        };
        res.json(data);
    }
    catch (error) {
        console.error('Error fetching stock analysis:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}));
exports.default = router;
