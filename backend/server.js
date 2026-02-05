const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const stockRoutes = require('./src/routes/stock');

// 環境変数の読み込み
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ミドルウェアの設定
app.use(cors()); // 開発中はすべてのオリジンを許可（本番環境では制限が必要）
app.use(express.json());

// ルートの設定
app.get('/', (req, res) => {
    res.send('TradeLog Visualizer API Server is running');
});

// 株価データAPI
app.use('/api/stock', stockRoutes);

// エラーハンドリング
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
