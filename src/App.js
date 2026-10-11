import { useCallback, useEffect, useState } from 'react';
import './App.css';
import { BillingWorkspace } from './pages/BillHistory';
import { AppShell } from './components/layout/AppShell';
import { SessionExpiredModal } from './components/SessionExpiredModal';
import { OPBilling } from './pages/OPBilling';
import { LabBilling } from './pages/LabBilling';
import { DaycareBilling, IPDBilling } from './pages/IPDBilling';
import { LoginPage } from './pages/LoginPage';
import { AdminConfiguration } from './pages/AdminConfiguration';
import { PharmacyBilling } from './pages/PharmacyBilling';
import { FollowUps } from './pages/FollowUps';
import { Overview } from './pages/Overview';
import { authApi, followUpApi } from './api/services';
import { SESSION_EXPIRED_EVENT, tokenStore } from './api/client';
import { accessiblePageIds, canAccessPage } from './auth/moduleAccess';

const pages = {
  overview: { title: 'Hospital Overview', subtitle: 'Patient activity and billing across your hospital', component: Overview },
  op: { title: 'OP Billing & Registration', subtitle: 'Register patients and create outpatient invoices', component: OPBilling },
  lab: { title: 'Lab Billing & Reporting', subtitle: 'Manage investigations, billing and lab results', component: LabBilling },
  ipd: { title: 'IPD Billing & Discharge', subtitle: 'Review inpatient charges and prepare discharge summaries', component: IPDBilling },
  daycare: { title: 'Daycare Admission & Billing', subtitle: 'Manage same-day care, charges and completion summaries', component: DaycareBilling },
  pharmacy: { title: 'Pharmacy Billing', subtitle: 'Search medicines, manage quantities and generate invoices', component: PharmacyBilling },
  followups: { title: 'Patient Follow-ups', subtitle: 'Schedule revisits and complete tomorrow’s reminder calls', component: FollowUps },
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
  const [followUpReminders, setFollowUpReminders] = useState([]);
  const [sessionExpired, setSessionExpired] = useState(null);
  const allowedPages = accessiblePageIds(currentUser);
  const resolvedActivePage = allowedPages.includes(activePage) ? activePage : allowedPages[0];
  const Page = resolvedActivePage ? pages[resolvedActivePage].component : null;

  const refreshFollowUps = useCallback(async () => {
    if (!tokenStore.getAccess() || !canAccessPage(currentUser, 'followups')) return;
    try {
      const result = await followUpApi.reminders();
      setFollowUpReminders(result || []);
    } catch {
      setFollowUpReminders([]);
    }
  }, [currentUser]);

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

  useEffect(() => {
    const showSessionExpired = event => setSessionExpired(
      event.detail?.message || 'For your security, your session has expired. Sign in again to continue without losing the information already entered in this form.'
    );
    window.addEventListener(SESSION_EXPIRED_EVENT, showSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, showSessionExpired);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    refreshFollowUps();
    const timer = setInterval(refreshFollowUps, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [isAuthenticated, refreshFollowUps]);

  const handleGlobalPatientSelect = patient => {
    if (!canAccessPage(currentUser, 'op')) return;
    setSelectedPatient(patient);
    setActivePage('op');
  };

  const handleLogin = async credentials => {
    const result = await authApi.login(credentials);
    tokenStore.set(result);
    sessionStorage.setItem('medora-user', JSON.stringify(result.user));
    setCurrentUser(result.user);
    setActivePage(accessiblePageIds(result.user)[0] || 'op');
    setIsAuthenticated(true);
  };

  const handleRelogin = async credentials => {
    const result = await authApi.login(credentials);
    tokenStore.set(result);
    sessionStorage.setItem('medora-user', JSON.stringify(result.user));
    setCurrentUser(result.user);
    setSessionExpired(null);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* Clear local session even if backend is unavailable. */ }
    tokenStore.clear();
    sessionStorage.removeItem('medora-user');
    setCurrentUser(null);
    setSelectedPatient(null);
    setFollowUpReminders([]);
    setSessionExpired(null);
    setActivePage('op');
    setIsAuthenticated(false);
  };

  if (authChecking) return <div className="app-loading"><div className="loading-spinner"/><p>Restoring secure session…</p></div>;
  if (!isAuthenticated) return <LoginPage onLogin={handleLogin}/>;
  if (!Page) return <div className="access-denied-page"><div><h1>No modules allocated</h1><p>Ask an administrator to assign at least one module to this account.</p><button className="primary" onClick={handleLogout}>Log out</button></div></div>;

  return <>
    <AppShell activePage={resolvedActivePage} onNavigate={setActivePage} page={pages[resolvedActivePage]} onPatientSelect={handleGlobalPatientSelect} onLogout={handleLogout} currentUser={currentUser} followUpReminders={followUpReminders} refreshFollowUps={refreshFollowUps}>
      <BillingWorkspace key={resolvedActivePage} section={resolvedActivePage}><Page selectedPatient={resolvedActivePage === 'op' ? selectedPatient : undefined} currentUser={currentUser} reminders={followUpReminders} refreshFollowUps={refreshFollowUps}/></BillingWorkspace>
    </AppShell>
    {sessionExpired && currentUser && <SessionExpiredModal user={currentUser} message={sessionExpired} onRelogin={handleRelogin} onLogout={handleLogout}/>}
  </>;
}

export default App;
