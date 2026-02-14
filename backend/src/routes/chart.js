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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = __importDefault(require("express"));
var dbConfig_1 = __importDefault(require("../dbConfig"));
var router = express_1.default.Router();
// Helper to get limit offset
var getPagination = function (page, size) {
    var limit = size ? +size : 30;
    var offset = page ? (page - 1) * limit : 0;
    return { limit: limit, offset: offset };
};
// --- Ranking Charts API ---
router.post('/ranking', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, period, ranking, _b, page, _c, limit, offset, query, countQuery, params, orderBy, rows, codes, placeholders, chartRows, chartDataMap_1, data, error_1;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 3, , 4]);
                _a = req.body, period = _a.period, ranking = _a.ranking, _b = _a.page, page = _b === void 0 ? 1 : _b;
                _c = getPagination(page, 30), limit = _c.limit, offset = _c.offset;
                query = '';
                countQuery = '';
                params = [];
                orderBy = 'code ASC';
                if (ranking === 'gain_daily')
                    orderBy = 'ranking_value DESC'; // 仮
                return [4 /*yield*/, dbConfig_1.default.query("SELECT DISTINCT code FROM daily_price ORDER BY date DESC, code ASC LIMIT ? OFFSET ?", [limit, offset])];
            case 1:
                rows = (_d.sent())[0];
                codes = rows.map(function (r) { return r.code; });
                if (codes.length === 0) {
                    return [2 /*return*/, res.json({ data: [], total_pages: 0, current_page: page })];
                }
                placeholders = codes.map(function () { return '?'; }).join(',');
                return [4 /*yield*/, dbConfig_1.default.query("SELECT * FROM daily_price WHERE code IN (".concat(placeholders, ") ORDER BY code, date ASC"), __spreadArray([], codes, true))];
            case 2:
                chartRows = (_d.sent())[0];
                chartDataMap_1 = {};
                chartRows.forEach(function (row) {
                    if (!chartDataMap_1[row.code]) {
                        chartDataMap_1[row.code] = {
                            code: row.code,
                            name: row.name || 'Unknown', // nameカラムがあると仮定
                            dates: [],
                            opens: [],
                            highs: [],
                            lows: [],
                            closes: [],
                            volumes: [],
                            ma5: [], // 計算が必要
                            ma25: [],
                            ma75: []
                        };
                    }
                    var d = chartDataMap_1[row.code];
                    d.dates.push(row.date);
                    d.opens.push(row.open);
                    d.highs.push(row.high);
                    d.lows.push(row.low);
                    d.closes.push(row.close);
                    d.volumes.push(row.volume);
                });
                data = Object.values(chartDataMap_1);
                res.json({
                    data: data,
                    total_pages: 10, // 仮
                    current_page: page
                });
                return [3 /*break*/, 4];
            case 3:
                error_1 = _d.sent();
                console.error('Error fetching ranking charts:', error_1);
                res.status(500).json({ error: 'Internal Server Error' });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// --- Single Stock Analysis API ---
router.post('/analysis', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, code, period, rows, data, error_2;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _b.trys.push([0, 2, , 3]);
                _a = req.body, code = _a.code, period = _a.period;
                return [4 /*yield*/, dbConfig_1.default.query("SELECT * FROM daily_price WHERE code = ? ORDER BY date ASC", [code])];
            case 1:
                rows = (_b.sent())[0];
                if (rows.length === 0) {
                    return [2 /*return*/, res.status(404).json({ error: 'Stock not found' })];
                }
                data = {
                    code: code,
                    name: rows[0].name || code, // 名前取得ロジック必要
                    dates: rows.map(function (r) { return r.date; }),
                    opens: rows.map(function (r) { return r.open; }),
                    highs: rows.map(function (r) { return r.high; }),
                    lows: rows.map(function (r) { return r.low; }),
                    closes: rows.map(function (r) { return r.close; }),
                    volumes: rows.map(function (r) { return r.volume; }),
                    // MA計算はフロントエンドかここで実施
                };
                res.json(data);
                return [3 /*break*/, 3];
            case 2:
                error_2 = _b.sent();
                console.error('Error fetching stock analysis:', error_2);
                res.status(500).json({ error: 'Internal Server Error' });
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); });
exports.default = router;
