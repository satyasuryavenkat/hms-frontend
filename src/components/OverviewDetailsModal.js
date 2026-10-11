import { useEffect, useRef, useState } from 'react';
import { overviewApi } from '../api/services';
import { formatMoney } from '../data/hospitalData';

const names = { op: 'Outpatient', ipd: 'IPD', daycare: 'Daycare', lab: 'Laboratory' };
const dateTime = value => value ? new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}+05:30`).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Not recorded';
const text = value => value ? String(value).replaceAll('_', ' ') : 'Not recorded';

export function OverviewDetailsModal({ section, range, onClose }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const dialog = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current.focus();
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.current.querySelectorAll('button:not(:disabled), input, summary')];
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); opener?.focus(); };
  }, [onClose]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const timer = setTimeout(() => overviewApi.records(section, { ...range, query, page, size: 20 })
      .then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); }), 200);
    return () => { active = false; clearTimeout(timer); };
  }, [section, range, query, page, revision]);
  return <div className="bill-preview-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="overview-record-modal" ref={dialog} role="dialog" aria-modal="true" aria-label={`${names[section]} details`} tabIndex={-1}>
      <header className="bill-preview-toolbar"><div><h3>{names[section]} details</h3><p>{range.startDate} to {range.endDate} · IST</p></div><button className="secondary" onClick={onClose}>Close details</button></header>
      <div className="overview-record-content"><label className="overview-record-search">Search records<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Patient, UHID, mobile or record number"/></label>
        {loading ? <p role="status">Loading details…</p> : error ? <p role="alert">{error} <button className="secondary" onClick={() => setRevision(value => value + 1)}>Retry</button></p> : <>
          <p>{data?.totalElements || 0} records. Expand a record for its patient, billing and clinical details.</p>
          {!data?.content.length && <p>No records match this period and search.</p>}
          {data?.content.map(({ record: r, bill }) => <details className="overview-record" key={r.visitId ?? r.id}>
            <summary><span><b>{r.patient?.name}</b><small>{r.patient?.uhid} · {r.opNumber || r.ipdNumber || r.orderNumber}</small></span><span>{dateTime(r.admissionDateTime || r.createdAt)}<small>{formatMoney(bill ? Math.max(0, Number(bill.grossCharges) - Number(bill.discount)) : r.totalPayable)} billed</small></span></summary>
            <div className="overview-record-body"><dl>
              <div><dt>Age / Gender</dt><dd>{r.patient?.age ?? '—'} / {text(r.patient?.gender)}</dd></div><div><dt>Mobile</dt><dd>{text(r.patient?.mobile)}</dd></div><div><dt>Address</dt><dd>{text(r.patient?.address)}</dd></div>
              <div><dt>Doctor</dt><dd>{r.doctor?.name || r.consultant?.name || r.referringDoctor?.name || 'Self referral'}</dd></div><div><dt>Status</dt><dd>{text(r.status || r.reportStatus || r.paymentStatus)}</dd></div><div><dt>Payment mode</dt><dd>{text(bill?.paymentMode || r.paymentMode)}</dd></div>
              <div><dt>Discount</dt><dd>{formatMoney(bill?.discount ?? r.discount)}</dd></div><div><dt>Collected</dt><dd>{formatMoney(bill ? Number(bill.advanceReceived) + Number(bill.paidAmount) : r.paidAmount)}</dd></div>
              {bill && <><div><dt>Invoice</dt><dd>{bill.invoiceNumber}</dd></div><div><dt>Advance received</dt><dd>{formatMoney(bill.advanceReceived)}</dd></div><div><dt>Balance</dt><dd>{formatMoney(bill.balancePayable)}</dd></div><div><dt>Ward / Bed</dt><dd>{r.ward} / {r.bedNumber}</dd></div><div><dt>Discharge</dt><dd>{dateTime(r.dischargeDateTime)}</dd></div><div><dt>Attendant</dt><dd>{text(r.attendantName)} · {text(r.attendantMobile)}</dd></div></>}
              {section === 'op' && <><div><dt>Receipt</dt><dd>{r.receiptNumber}</dd></div><div><dt>Appointment</dt><dd>{r.appointmentDate} {r.appointmentTime}</dd></div><div><dt>Visit type</dt><dd>{text(r.visitType)}</dd></div><div><dt>Symptoms / Notes</dt><dd>{text(r.symptoms)}</dd></div></>}
            </dl>
            {bill && <><h4>Charges</h4><div className="table-wrap"><table><thead><tr><th>Section</th><th>Item</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{bill.charges.map(c => <tr key={c.id}><td>{text(c.category)}</td><td>{c.description}</td><td>{c.quantity}</td><td>{formatMoney(c.rate)}</td><td>{formatMoney(c.amount)}</td></tr>)}</tbody></table></div><h4>Clinical details</h4><p><b>Provisional diagnosis:</b> {text(r.provisionalDiagnosis)}</p><p><b>Final diagnosis:</b> {text(r.finalDiagnosis)}</p><p><b>Clinical summary:</b> {text(r.clinicalSummary)}</p><p><b>Advice:</b> {text(r.advice)}</p><p><b>Follow-up:</b> {r.followUpDate || 'Not recorded'} · {r.followUpDoctor?.name || ''}</p>{r.medications?.map((m, i) => <p key={i}>{m.medicine} · {m.dose} · {m.frequency} · {m.duration} · {m.instructions}</p>)}</>}
            {r.tests?.map(test => <section key={test.testId}><h4>{test.name} · {formatMoney(test.amount)}</h4><p>{test.department} · {text(test.specimenType)} · {text(test.status)}</p><div className="table-wrap"><table><thead><tr><th>Parameter</th><th>Result</th><th>Unit</th><th>Reference range</th></tr></thead><tbody>{test.results?.map(result => <tr key={result.parameterId}><td>{result.name}</td><td>{result.result || 'Pending'}{result.abnormal ? ' *' : ''}</td><td>{result.unit}</td><td>{result.referenceRange}</td></tr>)}</tbody></table></div></section>)}
            {r.specimens?.map(s => <p key={s.barcode}><b>Sample:</b> {s.barcode} · {text(s.specimenType)} · {dateTime(s.createdAt)}</p>)}
            </div>
          </details>)}
          <div className="form-actions"><button className="secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous page</button><span>Page {page + 1} of {Math.max(1, data?.totalPages || 0)}</span><button className="secondary" disabled={page + 1 >= (data?.totalPages || 0)} onClick={() => setPage(value => value + 1)}>Next page</button></div>
        </>}
      </div>
    </section>
  </div>;
}
