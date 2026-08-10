import { useState } from 'react';
import { Icon } from '../Icon';
import { HospitalLogo } from '../HospitalLogo';
import { usePatientSearch } from '../../hooks/usePatientSearch';

const navItems = [
  { id: 'op', label: 'OP Billing', detail: 'Registration', icon: 'user' },
  { id: 'lab', label: 'Lab Services', detail: 'Billing & reports', icon: 'flask' },
  { id: 'ipd', label: 'IPD Billing', detail: 'Discharge', icon: 'bed' },
  { id: 'pharmacy', label: 'Pharmacy', detail: 'Billing & stock', icon: 'pill' },
  { id: 'followups', label: 'Follow-ups', detail: 'Tomorrow’s reminders', icon: 'calendar' },
  { id: 'admin', label: 'Admin Configuration', detail: 'Masters & access', icon: 'settings', adminOnly: true },
];

export function AppShell({ activePage, onNavigate, page, children, onPatientSelect, onLogout, currentUser, followUpReminders = [], refreshFollowUps }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const pendingReminders = followUpReminders.filter(item => item.status === 'PENDING');
  const navigate = id => { onNavigate(id); setMobileOpen(false); setNotificationsOpen(false); };
  const { patients: globalMatches } = usePatientSearch(globalQuery);
  const selectGlobalPatient = patient => {
    onPatientSelect(patient);
    setGlobalQuery('');
    setGlobalSearchOpen(false);
  };
  const handleGlobalKeyDown = event => {
    if (event.key === 'Enter' && globalMatches.length) {
      event.preventDefault();
      selectGlobalPatient(globalMatches[0]);
    }
    if (event.key === 'Escape') setGlobalSearchOpen(false);
  };
  const displayName = currentUser?.displayName || currentUser?.userId || 'User';
  const userRole = currentUser?.role ? currentUser.role.toLowerCase().split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ') : 'Hospital Staff';
  const userInitials = displayName.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'U';
  const visibleNavItems = navItems.filter(item => !item.adminOnly || currentUser?.role === 'ADMINISTRATOR');

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
      <div className="brand"><HospitalLogo className="sidebar-logo"/><div><strong>Lakshmi Sreenivaasa</strong><small className="hospital-type">Multi Speciality Hospital</small><small className="hospital-tagline">Healing · Caring · Serving</small></div></div>
      <div className="nav-label">WORKSPACE</div>
      <nav>
        <button className="nav-overview"><Icon name="grid"/><span>Overview</span><small>Soon</small></button>
        {visibleNavItems.map(item => <button key={item.id} className={activePage === item.id ? 'active' : ''} onClick={() => navigate(item.id)}>
          <span className="nav-icon"><Icon name={item.icon}/></span><span><b>{item.label}{item.id === 'followups' && pendingReminders.length > 0 && <small className="followup-nav-badge">{pendingReminders.length}</small>}</b><em>{item.detail}</em></span><Icon name="chevron" size={15}/>
        </button>)}
      </nav>
      <div className="sidebar-help"><div className="help-icon">?</div><strong>Need assistance?</strong><span>Contact hospital IT support</span><button>Get help</button></div>
      <div className="user-card"><div className="avatar">{userInitials}</div><div><b>{displayName}</b><span>{userRole}</span></div><button className="logout-button" onClick={onLogout} aria-label={`Log out ${displayName}`} title="Log out"><Icon name="logout" size={17}/></button></div>
    </aside>
    {mobileOpen && <div className="scrim" onClick={() => setMobileOpen(false)}/>} 
    <main>
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileOpen(true)}><Icon name="menu"/></button>
        <div><h1>{page.title}</h1><p>{page.subtitle}</p></div>
        <div className="top-actions">
          <div className="global-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setGlobalSearchOpen(false); }}><Icon name="search"/><input aria-label="Global patient search" value={globalQuery} onFocus={() => setGlobalSearchOpen(true)} onChange={event => { setGlobalQuery(event.target.value); setGlobalSearchOpen(true); }} onKeyDown={handleGlobalKeyDown} placeholder="Search patient, UHID..." autoComplete="off"/>{globalSearchOpen && globalQuery && <div className="global-results">{globalMatches.length ? globalMatches.map((patient, index) => <button type="button" key={patient.uhid} onClick={() => selectGlobalPatient(patient)}><span><b>{patient.name}</b><small>{patient.uhid} · {patient.mobile}</small></span>{index === 0 ? <kbd>Enter</kbd> : <Icon name="chevron" size={14}/>}</button>) : <p>No patient found</p>}</div>}</div>
          <div className="notification-wrap" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setNotificationsOpen(false); }}>
            <button className={`icon-button notification ${notificationsOpen ? 'active' : ''}`} aria-label={`${pendingReminders.length} follow-up reminders`} onClick={() => { setNotificationsOpen(open => !open); refreshFollowUps?.(); }}><Icon name="bell"/>{pendingReminders.length > 0 && <span>{pendingReminders.length > 9 ? '9+' : pendingReminders.length}</span>}</button>
            {notificationsOpen && <div className="notification-panel"><header><div><b>Tomorrow's follow-ups</b><small>{pendingReminders.length} call{pendingReminders.length === 1 ? '' : 's'} pending today</small></div><button onClick={() => refreshFollowUps?.()}><Icon name="clock" size={14}/></button></header>{pendingReminders.length ? <div>{pendingReminders.slice(0, 4).map(item => <button className="notification-item" key={item.id} onClick={() => navigate('followups')}><span>{item.patient.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><div><b>{item.patient.name}</b><small>{new Date(item.visitDateTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} · +91 {item.patient.mobile}</small></div><Icon name="chevron" size={14}/></button>)}</div> : <div className="notification-empty"><Icon name="check"/><b>No reminder calls pending</b><small>Tomorrow's visits will appear here today.</small></div>}<button className="notification-view-all" onClick={() => navigate('followups')}>Open Follow-ups</button></div>}
          </div>
          <div className="top-avatar" title={`${displayName} · ${userRole}`}>{userInitials}</div>
        </div>
      </header>
      <div className="content">{children}</div>
    </main>
  </div>;
}
