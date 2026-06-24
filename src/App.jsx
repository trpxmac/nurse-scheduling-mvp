import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import ConfigPage from './pages/ConfigPage';
import ShiftTypesPage from './pages/ShiftTypesPage';
import StaffListPage from './pages/StaffListPage';
import MonthlyRosterPage from './pages/MonthlyRosterPage';
import ResultsPage from './pages/ResultsPage';
import AIRosterPage from './pages/AIRosterPage';
import LeaveSchedulePage from './pages/LeaveSchedulePage';
import PrintPage from './pages/PrintPage';
import { pullFromDatabase } from './utils/storage';
import './App.css';
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', background: '#fee2e2', color: '#991b1b', height: '100vh', overflow: 'auto' }}>
          <h2>Something went wrong.</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error && this.state.error.toString()}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8em' }}>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <ErrorBoundary>
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
                <Route path="/leave-schedule" element={<LeaveSchedulePage />} />
              </Routes>
            </AppLayout>
          } />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
