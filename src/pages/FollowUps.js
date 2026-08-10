import { useMemo, useState } from 'react';
import { followUpApi } from '../api/services';
import { Icon } from '../components/Icon';
import { usePatientSearch } from '../hooks/usePatientSearch';

const localDate = date => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const tomorrow = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return localDate(date);
};

const initials = name => name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();

export function FollowUps({ reminders = [], refreshFollowUps }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [patient, setPatient] = useState(null);
  const [followUpDate, setFollowUpDate] = useState(tomorrow);
  const [followUpTime, setFollowUpTime] = useState('10:00');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  const { patients, loading, error } = usePatientSearch(query, modalOpen);
  const pending = useMemo(() => reminders.filter(item => item.status === 'PENDING'), [reminders]);
  const reminded = reminders.length - pending.length;

  const resetAndClose = () => {
    setModalOpen(false);
    setQuery('');
    setPatient(null);
    setFollowUpDate(tomorrow());
    setFollowUpTime('10:00');
    setErrors({});
  };

  const close = () => { if (!saving) resetAndClose(); };

  const selectPatient = selected => {
    setPatient(selected);
    setQuery('');
    setErrors(current => ({ ...current, patient: '' }));
  };

  const submit = async event => {
    event.preventDefault();
    const nextErrors = {};
    if (!patient) nextErrors.patient = 'Search and select a patient from the results.';
    if (!followUpDate) nextErrors.followUpDate = 'Select the next visit date.';
    if (!followUpTime) nextErrors.followUpTime = 'Select the next visit time.';
    if (followUpDate && followUpTime && new Date(`${followUpDate}T${followUpTime}:00`) <= new Date()) {
      nextErrors.followUpDate = 'The follow-up date and time must be in the future.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await followUpApi.create({ patientId: patient.id, followUpDate, followUpTime });
      await refreshFollowUps?.();
      setMessage({ type: 'success', text: `Follow-up scheduled for ${patient.name}. The reminder will appear one day before the visit.` });
      resetAndClose();
    } catch (requestError) {
      setErrors({ form: requestError.message });
    } finally {
      setSaving(false);
    }
  };

  const markReminded = async followUp => {
    setUpdatingId(followUp.id);
    setMessage({ type: '', text: '' });
    try {
      await followUpApi.markReminded(followUp.id);
      await refreshFollowUps?.();
      setMessage({ type: 'success', text: `${followUp.patient.name} has been marked as reminded.` });
    } catch (requestError) {
      setMessage({ type: 'error', text: requestError.message });
    } finally {
      setUpdatingId(null);
    }
  };

  return <div className="followups-page">
    <section className="followups-hero">
      <div><span>Patient continuity</span><h2>Tomorrow's follow-up reminders</h2><p>Only patients visiting tomorrow appear here. Call them today and record when the reminder is complete.</p></div>
      <button className="primary followup-add" onClick={() => setModalOpen(true)}><Icon name="plus"/>Add follow-up</button>
    </section>

    <section className="followup-stats">
      <div><span className="followup-stat-icon amber"><Icon name="bell"/></span><div><small>Calls pending</small><strong>{pending.length}</strong></div></div>
      <div><span className="followup-stat-icon green"><Icon name="check"/></span><div><small>Patients reminded</small><strong>{reminded}</strong></div></div>
      <div><span className="followup-stat-icon blue"><Icon name="calendar"/></span><div><small>Visit date</small><strong>{new Date(`${tomorrow()}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></div></div>
    </section>

    {message.text && <div className={`api-message ${message.type}`}>{message.text}</div>}
    <section className="card followup-list-card">
      <header><div><span>Reminder queue</span><h3>Patients to contact today</h3></div><button className="secondary" onClick={() => refreshFollowUps?.()}><Icon name="clock"/>Refresh</button></header>
      {reminders.length ? <div className="followup-table-wrap"><table className="followup-table"><thead><tr><th>Patient</th><th>Contact</th><th>Next visit</th><th>Status</th><th>Action</th></tr></thead><tbody>{reminders.map(followUp => <tr key={followUp.id} className={followUp.status === 'REMINDED' ? 'reminded' : ''}>
        <td><div className="followup-patient"><span>{initials(followUp.patient.name)}</span><div><b>{followUp.patient.name}</b><small>{followUp.patient.uhid} · {followUp.patient.age} years / {followUp.patient.gender}</small></div></div></td>
        <td><a href={`tel:${followUp.patient.mobile}`}><Icon name="phone" size={15}/><span><b>+91 {followUp.patient.mobile}</b><small>Click to call</small></span></a></td>
        <td><b>{new Date(followUp.visitDateTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</b><small>{new Date(followUp.visitDateTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}</small></td>
        <td>{followUp.status === 'REMINDED' ? <span className="followup-status done"><Icon name="check" size={13}/>Reminded</span> : <span className="followup-status pending"><Icon name="bell" size={13}/>Call pending</span>}</td>
        <td>{followUp.status === 'REMINDED' ? <small className="reminded-meta">By {followUp.remindedBy || 'staff'}<br/>{followUp.remindedAt ? new Date(followUp.remindedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : ''}</small> : <button className="mark-reminded" disabled={updatingId === followUp.id} onClick={() => markReminded(followUp)}><Icon name="check" size={15}/>{updatingId === followUp.id ? 'Updating…' : 'Mark reminded'}</button>}</td>
      </tr>)}</tbody></table></div> : <div className="followup-empty"><span><Icon name="calendar" size={25}/></span><h3>No calls due today</h3><p>Follow-ups scheduled for tomorrow will appear here automatically.</p><button className="secondary" onClick={() => setModalOpen(true)}><Icon name="plus"/>Schedule a follow-up</button></div>}
    </section>

    {modalOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && close()}><form className="followup-dialog" onSubmit={submit} noValidate>
      <div className="dialog-header"><div className="dialog-icon"><Icon name="calendar"/></div><div><h2>Add patient follow-up</h2><p>Schedule the patient's next hospital visit</p></div><button type="button" onClick={close} aria-label="Close">×</button></div>
      <div className="followup-dialog-body">
        <label className={`followup-patient-search ${errors.patient ? 'field-invalid' : ''}`}><span>Patient / UHID <i>*</i></span><div className="followup-search-input"><Icon name="search"/><input aria-label="Search follow-up patient" value={query} onChange={event => { setQuery(event.target.value); setPatient(null); }} placeholder={patient ? `${patient.name} · ${patient.uhid}` : 'Search name, UHID or mobile number…'} autoComplete="off"/>{patient && !query && <button type="button" onClick={() => setPatient(null)}>Change</button>}</div>{query.trim() && <div className="followup-patient-results">{loading ? <p>Searching…</p> : error ? <p>{error}</p> : patients.length ? patients.map(item => <button type="button" key={item.id} onClick={() => selectPatient(item)}><span>{initials(item.name)}</span><div><b>{item.name}</b><small>{item.uhid} · +91 {item.mobile}</small></div><Icon name="chevron" size={15}/></button>) : <p>No matching patient found</p>}</div>}{errors.patient && <small className="field-error">{errors.patient}</small>}</label>
        {patient && <div className="selected-followup-patient"><span>{initials(patient.name)}</span><div><small>Selected patient</small><b>{patient.name}</b><p>{patient.uhid} · +91 {patient.mobile}</p></div><Icon name="check"/></div>}
        <div className="followup-date-grid"><label className={errors.followUpDate ? 'field-invalid' : ''}><span>Next visit date <i>*</i></span><input type="date" min={localDate(new Date())} value={followUpDate} onChange={event => { setFollowUpDate(event.target.value); setErrors(current => ({ ...current, followUpDate: '' })); }}/>{errors.followUpDate && <small className="field-error">{errors.followUpDate}</small>}</label><label className={errors.followUpTime ? 'field-invalid' : ''}><span>Visit time <i>*</i></span><input type="time" value={followUpTime} onChange={event => { setFollowUpTime(event.target.value); setErrors(current => ({ ...current, followUpTime: '' })); }}/>{errors.followUpTime && <small className="field-error">{errors.followUpTime}</small>}</label></div>
        <div className="followup-reminder-note"><Icon name="bell"/><div><b>Automatic reminder</b><p>This patient will appear in Follow-ups and the notification bell only one day before the visit.</p></div></div>
        {errors.form && <div className="api-message error">{errors.form}</div>}
      </div>
      <div className="dialog-actions"><button type="button" className="secondary" onClick={close}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Scheduling…' : 'Schedule follow-up'}</button></div>
    </form></div>}
  </div>;
}
