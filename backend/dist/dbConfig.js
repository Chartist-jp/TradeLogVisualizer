"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var promise_1 = __importDefault(require("mysql2/promise"));
var dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Create the connection pool. The pool-specific settings are the defaults
var pool = promise_1.default.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '', // ローカル開発用パスワード考慮
    database: process.env.DB_NAME || 'chartistdb',
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10, // max idle connections, the default value is the same as `connectionLimit`
    idleTimeout: 60000, // idle connections timeout, in milliseconds, the default value 60000
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
});
exports.default = pool;
