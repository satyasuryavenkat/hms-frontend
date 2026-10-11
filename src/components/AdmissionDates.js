import { useEffect, useState } from 'react';

export const dateInputValue = value => {
  if (!value) return '';
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) return value.slice(0, 16);
  return new Date(value).toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).replace(' ', 'T').slice(0, 16);
};

export function AdmissionDates({ admission, api, onSaved, onDirty, disabled = false }) {
  const savedStart = dateInputValue(admission.admissionDateTime);
  const savedEnd = dateInputValue(admission.dischargeDateTime);
  const [start, setStart] = useState(savedStart);
  const [end, setEnd] = useState(savedEnd);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { setStart(savedStart); setEnd(savedEnd); }, [savedStart, savedEnd]);
  const dirty = start !== savedStart || end !== savedEnd;
  const valid = Boolean(start) && (!end || end >= start) && (admission.status !== 'DISCHARGED' || Boolean(end));
  const change = (field, value) => {
    setError(''); setMessage('');
    if (field === 'start') { setStart(value); onDirty?.(value !== savedStart || end !== savedEnd); }
    else { setEnd(value); onDirty?.(start !== savedStart || value !== savedEnd); }
  };
  const save = async () => {
    if (!valid || !dirty) return;
    setBusy(true); setError('');
    try {
      const updated = await api.updateDates(admission.id, { admissionDateTime: `${start}:00`, dischargeDateTime: end ? `${end}:00+05:30` : null });
      onSaved(updated); onDirty?.(false); setMessage('Admission and discharge dates saved.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return <section className="admission-dates-editor">
    <div className="form-grid billing-stay-dates">
      <label>Admission date<input aria-label="Admission date" type="datetime-local" value={start} disabled={busy || disabled} onChange={event => change('start', event.target.value)}/></label>
      <label>Discharge date<input aria-label="Discharge date" type="datetime-local" min={start || undefined} value={end} disabled={busy || disabled} onChange={event => change('end', event.target.value)}/></label>
    </div>
    {!valid && <p role="alert" className="api-message error">Enter an admission date and a discharge date on or after admission. Completed visits require both dates.</p>}
    {error && <p role="alert" className="api-message error">{error}</p>}
    {message && <p role="status">{message}</p>}
    <div className="form-actions"><button type="button" className="secondary" disabled={busy || disabled || !dirty || !valid} onClick={save}>{busy ? 'Saving dates…' : 'Save dates'}</button>{dirty && <small>Save dates before printing or settling the bill.</small>}</div>
  </section>;
}
