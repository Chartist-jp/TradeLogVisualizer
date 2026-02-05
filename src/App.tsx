import { useState } from 'react';
import CSVImport from './components/CSVImport';
import TradeList from './components/TradeList';
import AggregatedTradeList from './components/AggregatedTradeList';
import './App.css';

type TabType = 'import' | 'trades' | 'aggregated';

function App() {
    const [refreshKey, setRefreshKey] = useState(0);
    const [activeTab, setActiveTab] = useState<TabType>('import');

    const handleImportSuccess = () => {
        setRefreshKey(prev => prev + 1);
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <h1>📊 TradeLog Visualizer</h1>
                <p className="app-subtitle">トレード分析・可視化ツール</p>
            </header>

            <nav className="tab-navigation">
                <button
                    className={`tab-button ${activeTab === 'import' ? 'active' : ''}`}
                    onClick={() => setActiveTab('import')}
                >
                    📥 データインポート
                </button>
                <button
                    className={`tab-button ${activeTab === 'trades' ? 'active' : ''}`}
                    onClick={() => setActiveTab('trades')}
                >
                    📋 約定履歴
                </button>
                <button
                    className={`tab-button ${activeTab === 'aggregated' ? 'active' : ''}`}
                    onClick={() => setActiveTab('aggregated')}
                >
                    📈 トレード分析
                </button>
            </nav>

            <main className="app-content">
                {activeTab === 'import' && (
                    <CSVImport onImportSuccess={handleImportSuccess} />
                )}
                {activeTab === 'trades' && (
                    <TradeList key={refreshKey} />
                )}
                {activeTab === 'aggregated' && (
                    <AggregatedTradeList key={refreshKey} />
                )}
            </main>
        </div>
    );
}

export default App;
