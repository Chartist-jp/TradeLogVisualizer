import { useState } from 'react';
import CSVImport from './components/CSVImport';
import TradeList from './components/TradeList';
import AggregatedTradeList from './components/AggregatedTradeList';
import PortfolioAnalysis from './components/PortfolioAnalysis';
import MultiChartDashboard from './components/MultiChartDashboard';
import './App.css';

type TabType = 'import' | 'list' | 'dashboard' | 'analysis';

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
                    📥 インポート
                </button>
                <button
                    className={`tab-button ${activeTab === 'list' ? 'active' : ''}`}
                    onClick={() => setActiveTab('list')}
                >
                    📋 トレード一覧
                </button>
                <button
                    className={`tab-button ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dashboard')}
                >
                    📉 チャートダッシュボード
                </button>
                <button
                    className={`tab-button ${activeTab === 'analysis' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analysis')}
                >
                    📊 ポートフォリオ分析
                </button>
            </nav>

            <main className="app-content">
                {activeTab === 'import' && (
                    <>
                        <CSVImport onImportSuccess={handleImportSuccess} />
                        <hr className="section-divider" />
                        <TradeList key={refreshKey} />
                    </>
                )}
                {activeTab === 'list' && (
                    <AggregatedTradeList key={refreshKey} />
                )}
                {activeTab === 'dashboard' && (
                    <MultiChartDashboard key={refreshKey} />
                )}
                {activeTab === 'analysis' && (
                    <PortfolioAnalysis key={refreshKey} />
                )}
            </main>
        </div>
    );
}

export default App;
