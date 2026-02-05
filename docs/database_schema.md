# データベース設計書

## 推奨データベース
**PostgreSQL** (時系列拡張 TimescaleDB の導入も視野)

## テーブル定義 (Schema)

### 1. Users (ユーザー管理)
| Column | Type | Description |
|---|---|---|
| user_id | PK | ユーザー識別子 |
| email | String | メールアドレス |
| password_hash | String | 暗号化パスワード |
| plan_type | String | FREE / PRO |
| created_at | Timestamp | 登録日 |

### 2. Symbols (銘柄マスタ)
| Column | Type | Description |
|---|---|---|
| symbol_id | PK | 内部ID |
| ticker_code | String | 銘柄コード/ティッカー (9984, AMTM) |
| country_code | String | 'JP' or 'US' |
| name | String | 銘柄名 |
| market | String | 市場 (東証プライム, NYSE等) |

### 3. StockPrices (時系列データ)
パフォーマンス最適化のため、時間足ごとにテーブルを分ける（またはパーティショニング）。

**Tables:** `DailyPrices`, `WeeklyPrices`, `MonthlyPrices`
| Column | Type | Description |
|---|---|---|
| price_id | PK |  |
| symbol_id | FK | Symbols.symbol_id |
| date | Date | 日付 |
| open | Decimal | 始値 |
| high | Decimal | 高値 |
| low | Decimal | 安値 |
| close | Decimal | 終値 |
| volume | BigInt | 出来高 |

### 4. TradeLogs (インポート履歴)
SBI証券CSVの生データに近い履歴。
| Column | Type | Description |
|---|---|---|
| trade_id | PK |  |
| user_id | FK | Users.user_id |
| symbol_id | FK | Symbols.symbol_id |
| execution_date | Date | 約定日 |
| side | String | 'BUY' / 'SELL' |
| price | Decimal | 約定単価 |
| quantity | Decimal | 数量 |
| raw_csv_row | Text | 解析元データ |

### 5. AnalysisGroups (分析グループ)
ユーザーによる分類（「勝ちパターン」「失敗」など）。
| Column | Type | Description |
|---|---|---|
| group_id | PK |  |
| user_id | FK | Users.user_id |
| group_name | String | グループ名 |
| display_order | Int | 表示順 |
| related_trade_ids | JSON | 紐付くトレードIDリスト |

## 算出ロジック (Derived Logic)

- **平均取得単価:** 同一銘柄・同方向の複数約定を加重平均。
- **損益 (PnL):** (売却単価 - 平均取得単価) * 数量
