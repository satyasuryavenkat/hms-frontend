import { useEffect, useState } from 'react';
import './App.css';
import { AppShell } from './components/layout/AppShell';
import { OPBilling } from './pages/OPBilling';
import { LabBilling } from './pages/LabBilling';
import { IPDBilling } from './pages/IPDBilling';
import { LoginPage } from './pages/LoginPage';
import { AdminConfiguration } from './pages/AdminConfiguration';
import { PharmacyBilling } from './pages/PharmacyBilling';
import { authApi } from './api/services';
import { tokenStore } from './api/client';

const pages = {
  op: { title: 'OP Billing & Registration', subtitle: 'Register patients and create outpatient invoices', component: OPBilling },
  lab: { title: 'Lab Billing & Reporting', subtitle: 'Manage investigations, billing and lab results', component: LabBilling },
  ipd: { title: 'IPD Billing & Discharge', subtitle: 'Review inpatient charges and prepare discharge summaries', component: IPDBilling },
  pharmacy: { title: 'Pharmacy Billing', subtitle: 'Search medicines, manage quantities and generate invoices', component: PharmacyBilling },
  admin: { title: 'Admin Configuration', subtitle: 'Manage hospital masters, pricing and user access', component: AdminConfiguration },
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(tokenStore.getAccess()));
  const [authChecking, setAuthChecking] = useState(() => Boolean(tokenStore.getAccess()));
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('medora-user')) || null; } catch { return null; }
  });
  const [activePage, setActivePage] = useState('op');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const Page = pages[activePage].component;

  useEffect(() => {
    if (!tokenStore.getAccess()) return;
    authApi.me().then(user => {
      setCurrentUser(user);
      sessionStorage.setItem('medora-user', JSON.stringify(user));
      setIsAuthenticated(true);
    }).catch(() => {
      tokenStore.clear();
      sessionStorage.removeItem('medora-user');
      setIsAuthenticated(false);
    }).finally(() => setAuthChecking(false));
  }, []);

  const handleGlobalPatientSelect = patient => {
    setSelectedPatient(patient);
    setActivePage('op');
  };

  const handleLogin = async credentials => {
    const result = await authApi.login(credentials);
    tokenStore.set(result);
    sessionStorage.setItem('medora-user', JSON.stringify(result.user));
    setCurrentUser(result.user);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* Clear local session even if backend is unavailable. */ }
    tokenStore.clear();
    sessionStorage.removeItem('medora-user');
    setCurrentUser(null);
    setSelectedPatient(null);
    setActivePage('op');
    setIsAuthenticated(false);
  };

  if (authChecking) return <div className="app-loading"><div className="loading-spinner"/><p>Restoring secure session…</p></div>;
  if (!isAuthenticated) return <LoginPage onLogin={handleLogin}/>;

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage} page={pages[activePage]} onPatientSelect={handleGlobalPatientSelect} onLogout={handleLogout} currentUser={currentUser}>
      <Page selectedPatient={activePage === 'op' ? selectedPatient : undefined} currentUser={currentUser}/>
    </AppShell>
  );
}

export default App;
