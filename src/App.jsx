import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ConfigPage from './pages/ConfigPage';
import ShiftTypesPage from './pages/ShiftTypesPage';
import StaffListPage from './pages/StaffListPage';
import MonthlyRosterPage from './pages/MonthlyRosterPage';
import ResultsPage from './pages/ResultsPage';
import AIRosterPage from './pages/AIRosterPage';
import PrintPage from './pages/PrintPage';
import './App.css';

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="main-content-inner">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/print" element={<PrintPage />} />
        <Route path="*" element={
          <AppLayout>
            <Routes>
              <Route path="/" element={<ConfigPage />} />
              <Route path="/shift-types" element={<ShiftTypesPage />} />
              <Route path="/staff" element={<StaffListPage />} />
              <Route path="/roster" element={<MonthlyRosterPage />} />
              <Route path="/results" element={<ResultsPage />} />
              <Route path="/ai-roster" element={<AIRosterPage />} />
            </Routes>
          </AppLayout>
        } />
      </Routes>
    </BrowserRouter>
  );
}
