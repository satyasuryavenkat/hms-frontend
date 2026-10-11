import { OverviewDetailsModal } from '../components/OverviewDetailsModal';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { overviewApi } from '../api/services';
import { Icon } from '../components/Icon';
import { formatMoney } from '../data/hospitalData';
import './Overview.css';

const hospitalToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const labels = {
  op: { name: 'Outpatient', unit: 'OP visits', icon: 'user', color: '#138b76' },
  ipd: { name: 'IPD', unit: 'admissions', icon: 'bed', color: '#417bc1' },
  daycare: { name: 'Day Care', unit: 'admissions', icon: 'clock', color: '#9a68b4' },
  lab: { name: 'Laboratory', unit: 'tests ordered', icon: 'flask', color: '#ca8735' },
};
const number = value => Number(value || 0).toLocaleString('en-IN');
const dateLabel = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function Overview() {
  const [detailSection, setDetailSection] = useState(null);
  const closeDetails = useCallback(() => setDetailSection(null), []);
  const [range, setRange] = useState(() => { const end = hospitalToday(); return { startDate: `${end.slice(0, 7)}-01`, endDate: end }; });
  const [applied, setApplied] = useState(range);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const valid = range.startDate && range.endDate && range.startDate <= range.endDate;

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setData(null);
    overviewApi.get(applied.startDate, applied.endDate).then(result => {
      if (active) setData(result);
    }).catch(err => {
      if (active) setError(err.message || 'Unable to load the overview. Please retry.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applied]);

  const preset = kind => {
    const endDate = hospitalToday();
    let startDate = endDate;
    if (kind === 'month') startDate = `${endDate.slice(0, 7)}-01`;
    if (kind === 'week') {
      const start = new Date(`${endDate}T12:00:00Z`);
      start.setUTCDate(start.getUTCDate() - 6);
      startDate = start.toISOString().slice(0, 10);
    }
    const next = { startDate, endDate }; setRange(next); setApplied(next);
  };
  const maxBilled = Math.max(1, ...(data?.departments || []).map(item => Number(item.billed)));

  return <div className="overview-page">
    <section className="overview-hero">
      <div><span className="overview-eyebrow">HOSPITAL AT A GLANCE</span><h2>A clear view of your hospital</h2><p>Track patient activity, billed amounts and collections in one place.</p></div>
      <div className="overview-period"><Icon name="calendar"/><div><small>REPORTING PERIOD · IST</small><strong>{dateLabel(applied.startDate)} — {dateLabel(applied.endDate)}</strong></div></div>
    </section>

    <CurrentBedPatients/>
    {detailSection && <OverviewDetailsModal section={detailSection} range={applied} onClose={closeDetails}/>}

    <form className="overview-filters" onSubmit={event => { event.preventDefault(); if (valid) setApplied({ ...range }); }}>
      <div className="overview-presets">{[['today', 'Today'], ['week', 'Last 7 days'], ['month', 'This month']].map(([key, label]) => <button type="button" key={key} onClick={() => preset(key)}>{label}</button>)}</div>
      <label>Start date<input type="date" required aria-label="Start date" value={range.startDate} max={range.endDate || undefined} onChange={e => setRange({ ...range, startDate: e.target.value })}/></label>
      <label>End date<input type="date" required aria-label="End date" value={range.endDate} min={range.startDate || undefined} onChange={e => setRange({ ...range, endDate: e.target.value })}/></label>
      <button className="primary" type="submit" disabled={!valid || loading}>{loading ? 'Loading…' : 'Apply dates'}</button>
      {!valid && <p role="alert" className="overview-validation">Select both dates; end date must be on or after start date.</p>}
    </form>

    {error && <div role="alert" className="api-message error">{error} <button className="secondary small" onClick={() => setApplied({ ...applied })}>Retry</button></div>}
    {loading && <div className="overview-loading" role="status">Loading hospital overview…</div>}
    {data && !loading && <>
      <div className="overview-summary">
        <article><span>Patients served</span><strong>{number(data.patientsServed)}</strong><small>Unique patients across the four services</small></article>
        <article><span>New patients</span><strong>{number(data.newPatients)}</strong><small>Registrations during the selected period</small></article>
        <article className="overview-total"><span>Total billed</span><strong>{formatMoney(data.billed)}</strong><small>After discounts · four services combined</small></article>
        <article><span>Total collected</span><strong>{formatMoney(data.collected)}</strong><small>Payments recorded against these visits / admissions</small></article>
      </div>
      <div className="overview-departments">{data.departments.map(item => {
        const meta = labels[item.id];
        return <article role="button" tabIndex={0} aria-label={`View ${meta.name} details`} onClick={() => setDetailSection(item.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetailSection(item.id); } }} className="overview-department" key={item.id} style={{ '--department-color': meta.color }}>
          <header><span className="overview-department-icon"><Icon name={meta.icon}/></span><h3>{meta.name}</h3></header>
          <div className="overview-count"><strong>{number(item.count)}</strong><span>{meta.unit}</span></div>
          <div className="overview-department-money"><span>Billed<strong>{formatMoney(item.billed)}</strong></span><span>Collected<strong>{formatMoney(item.collected)}</strong></span></div>
          <footer>{item.id === 'lab' ? `${number(item.records)} orders · cancelled orders excluded` : item.id === 'op' ? 'By billing creation date' : 'By admission start date'}<span className="overview-view-details">View details</span></footer>
        </article>;
      })}</div>
      <div className="overview-bottom">
        <section className="overview-panel"><h3>Billing by service</h3><p>Compare billed amounts for the selected records.</p>
          <div className="overview-bars">{data.departments.map(item => <div key={item.id}><div><span>{labels[item.id].name}</span><strong>{formatMoney(item.billed)}</strong></div><div className="overview-bar-track"><div style={{ width: `${Math.max(0, Number(item.billed)) / maxBilled * 100}%`, background: labels[item.id].color }}/></div></div>)}</div>
        </section>
        <section className="overview-panel"><h3>Service summary</h3><p>Counts and amounts from the same reporting period.</p><div className="overview-table-wrap"><table><thead><tr><th>Service</th><th>Count</th><th>Billed</th><th>Collected</th></tr></thead><tbody>{data.departments.map(item => <tr key={item.id}><td>{labels[item.id].name}</td><td>{number(item.count)}</td><td>{formatMoney(item.billed)}</td><td>{formatMoney(item.collected)}</td></tr>)}</tbody><tfoot><tr><th>Total amount</th><td>—</td><td>{formatMoney(data.billed)}</td><td>{formatMoney(data.collected)}</td></tr></tfoot></table></div></section>
      </div>
      {data.departments.every(item => item.records === 0) && <p className="overview-empty">No visits, admissions or lab orders in this date range. Select another period to view activity.</p>}
      <p className="overview-note">Both dates are inclusive, in Asia/Kolkata time. OP and lab use billing creation dates; IPD and Day Care use admission dates. Admission amounts include all charges and payments currently recorded for those admissions, even if added later. Collections include advances and final payments; this is not a cash-receipts report by payment date. Pharmacy is not included.</p>
    </>}
  </div>;
}


function CurrentBedPatients() {
  const [patients, setPatients] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [careType, setCareType] = useState('ALL');
  const [revision, setRevision] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setPatients(null);
    overviewApi.currentBeds().then(result => {
      if (active) { setPatients(result); setUpdatedAt(new Date()); }
    }).catch(err => { if (active) setError(err.message || 'Unable to load current bed patients.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  const filtered = useMemo(() => (patients || []).filter(patient => {
    const text = [patient.patientName, patient.uhid, patient.mobile, patient.admissionNumber,
      patient.ward, patient.bedNumber, patient.consultantName].filter(Boolean).join(' ').toLowerCase();
    return (careType === 'ALL' || patient.careType === careType)
      && query.trim().toLowerCase().split(/\s+/).every(word => text.includes(word));
  }), [patients, careType, query]);
  const toggle = () => { if (!open) setRevision(value => value + 1); setOpen(value => !value); };
  const admissionTime = value => value ? new Date(value + '+05:30').toLocaleString('en-IN',
    { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not recorded';
  return <section className="overview-beds">
    <button type="button" className="overview-beds-card" aria-expanded={open} aria-controls="overview-bed-patients" onClick={toggle}>
      <span className="overview-beds-icon"><Icon name="bed" size={24}/></span>
      <span className="overview-beds-copy"><strong>Current bed patients</strong><small>IPD beds and day care chairs / beds occupied now</small></span>
      <span className="overview-beds-count">{loading ? '...' : error ? '--' : number(patients?.length)}<small>patients</small></span>
      <span className="overview-beds-action">{open ? 'Hide patients' : 'View patients'}<Icon name="chevron" size={17}/></span>
    </button>
    {!open && error && <p role="alert" className="overview-beds-error">{error} Open the patient list to retry.</p>}
    {open && <div id="overview-bed-patients" className="overview-beds-content">
      <div className="overview-beds-toolbar"><label className="overview-bed-search"><Icon name="search" size={17}/><input type="search" aria-label="Search current bed patients" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search patient, UHID, bed or consultant"/></label>
        <label className="overview-care-filter">Care type<select aria-label="Bed patient care type" value={careType} onChange={event => setCareType(event.target.value)}><option value="ALL">All patients</option><option value="IPD">IPD</option><option value="DAYCARE">Day care</option></select></label>
        <button type="button" className="secondary small" disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh patients</button>
      </div>
      <p className="overview-beds-note">Current occupancy across all admission dates. Patients awaiting discharge are included.{updatedAt && !loading && !error && ' Updated at ' + updatedAt.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) + ' IST.'}</p>
      {loading ? <p role="status" className="overview-bed-empty">Loading current bed patients...</p> : error ? <p role="alert" className="overview-beds-error">{error} Use Refresh patients to try again.</p> : <>
        <div className="overview-beds-result-count">{filtered.length} of {patients?.length || 0} patients</div>
        {!filtered.length && <p className="overview-bed-empty">{patients?.length ? 'No patients match your search or care type.' : 'No patients currently occupy an IPD bed or day care chair / bed.'}</p>}
        <div className="overview-bed-grid">{filtered.map(patient => <article className="overview-bed-patient" key={patient.admissionId}>
          <header><span className="overview-bed-location"><Icon name="bed" size={17}/>{patient.careType === 'DAYCARE' ? 'Chair / Bed ' : 'Bed '}{patient.bedNumber}</span><span className="overview-bed-type">{patient.careType === 'DAYCARE' ? 'Day care' : 'IPD'}</span></header>
          <div className="overview-bed-name"><h3>{patient.patientName}</h3><p>{patient.uhid || 'UHID not recorded'} &middot; {patient.age ?? '--'} years &middot; {patient.gender || 'Not recorded'}</p></div>
          <dl>
            <div><dt>Ward / unit</dt><dd>{patient.ward || 'Not recorded'}</dd></div>
            <div><dt>Consultant</dt><dd>{patient.consultantName || 'Not recorded'}</dd></div>
            <div><dt>Admission</dt><dd>{patient.admissionNumber || 'Not recorded'}</dd></div>
            <div><dt>Admitted on</dt><dd>{admissionTime(patient.admissionDateTime)}</dd></div>
            <div><dt>Mobile</dt><dd>{patient.mobile || 'Not recorded'}</dd></div>
            <div><dt>Status</dt><dd>{patient.status === 'DISCHARGE_PLANNED' ? 'Awaiting discharge' : 'Active'}</dd></div>
          </dl>
          <details><summary>More patient details</summary><dl>
            <div><dt>Diagnosis</dt><dd>{patient.diagnosis || 'Not recorded'}</dd></div>
            <div><dt>Attendant</dt><dd>{patient.attendantName || 'Not recorded'}</dd></div>
            <div><dt>Attendant mobile</dt><dd>{patient.attendantMobile || 'Not recorded'}</dd></div>
          </dl></details>
        </article>)}</div>
      </>}
    </div>}
  </section>;
}
