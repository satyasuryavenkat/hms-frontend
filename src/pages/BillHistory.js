import { AdmissionDates } from '../components/AdmissionDates';
import { useEffect, useRef, useState } from 'react';
import { opApi, labApi, pharmacyApi, ipdApi, daycareApi, billingHistoryApi } from '../api/services';
import { OPPrintReceipt } from './OPBilling';
import { LabPrintReceipt } from './LabBilling';
import { PharmacyReceipt } from './PharmacyBilling';
import { IPDFinalBillPrint, IPDDischargePrint, IPD_CONFIG, DAYCARE_CONFIG } from './IPDBilling';
import { formatMoney } from '../data/hospitalData';
import { Icon } from '../components/Icon';

const sections = { op: 'OP', ipd: 'IPD', daycare: 'Daycare', lab: 'Lab', pharmacy: 'Pharmacy' };
const admissionApi = section => section === 'ipd' ? ipdApi : daycareApi;
const isAdmission = section => section === 'ipd' || section === 'daycare';

export const hospitalDate = (offset = 0) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const date = new Date(today + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

export async function loadPreviousBills(section, query, page, dates = {}) {
  const result = await billingHistoryApi.list(section, { query, page, size: 20, ...dates });
  return { ...result, content: result.content.map(item => item.record) };
}

export function BillingWorkspace({ section, children }) {
  const [history, setHistory] = useState(false);
  if (!sections[section]) return children;
  return <>
    <div className="tabs bill-history-navigation"><button className={!history ? 'active' : ''} onClick={() => setHistory(false)}>Current billing</button><button className={history ? 'active' : ''} onClick={() => setHistory(true)}>Previous bills</button></div>
    <div className={history ? 'billing-workspace-hidden' : ''}>{children}</div>
    {history && <BillHistory section={section}/>}
  </>;
}

export function BillHistory({ section }) {
  const [query, setQuery] = useState('');
  const [dates, setDates] = useState({ startDate: '', endDate: '' });
  const validDates = (!dates.startDate && !dates.endDate) || (dates.startDate && dates.endDate && dates.startDate <= dates.endDate);
  const selectDate = offset => { const date = hospitalDate(offset); setDates({ startDate: date, endDate: date }); setPage(0); };
  const [page, setPage] = useState(0);
  const [result, setResult] = useState({ content: [], totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [datesDirty, setDatesDirty] = useState(false);
  const [documentType, setDocumentType] = useState('bill');
  const [opening, setOpening] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const previewRef = useRef(null);
  const previewTrigger = useRef(null);
  useEffect(() => {
    if (!selected) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    previewRef.current?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape') { event.preventDefault(); setSelected(null); }
      if (event.key !== 'Tab') return;
      const buttons = [...previewRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === previewRef.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previewTrigger.current?.focus();
    };
  }, [selected]);
  useEffect(() => {
    if (!validDates) { setLoading(false); return undefined; }
    let active = true;
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      loadPreviousBills(section, query.trim(), page, dates).then(data => {
        if (active) setResult(data);
      }).catch(err => { if (active) setError(err.message); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [section, query, page, refresh, dates, validDates]);

  const open = async (record, trigger) => {
    previewTrigger.current = trigger;
    setOpening(true);
    setError('');
    setSelected(null);
    setDocumentType('bill');
    setDatesDirty(false);
    try {
      if (isAdmission(section)) {
        const api = admissionApi(section);
        const [admission, bill] = await Promise.all([api.getAdmission(record.id), api.finalBill(record.id)]);
        if (!bill.settledAt) throw new Error('This bill is no longer settled. Refresh the list.');
        if (admission.dischargeDraft && admission.status !== 'DISCHARGED') setDocumentType('summary');
        setSelected({ admission, bill });
      } else {
        const detail = section === 'op' ? await opApi.receipt(record.visitId) : section === 'lab' ? await labApi.getOrder(record.id) : await pharmacyApi.sale(record.id);
        if (detail.paymentStatus !== 'PAID' || detail.reportStatus === 'CANCELLED') throw new Error('This bill is no longer available as a completed bill. Refresh the list.');
        setSelected(detail);
      }
    } catch (err) { setError(err.message); }
    finally { setOpening(false); }
  };

  return <>
    <section className="card form-card bill-history-controls">
      <h2>Previous {sections[section]} bills</h2>
      <p>Find a settled bill, preview it, and print another copy.</p>
      <form className="bill-history-search" role="search" aria-label={`Search previous ${sections[section]} bills`} onSubmit={event => { event.preventDefault(); setPage(0); setRefresh(value => value + 1); }}>
        <div className="bill-history-search-field">
          <label htmlFor={`bill-search-${section}`}>Search previous bills</label>
          <div className="bill-history-search-input"><Icon name="search"/><input id={`bill-search-${section}`} type="search" aria-describedby={`bill-search-help-${section}`} placeholder={isAdmission(section) ? 'Patient name, UHID, mobile or admission number' : 'Patient name, UHID, mobile or bill number'} value={query} onChange={event => { setQuery(event.target.value); setPage(0); }}/></div>
          <small id={`bill-search-help-${section}`}>Search all previous {sections[section]} bills, including older pages. Results update as you type.</small>
        </div>
        <div className="bill-history-search-actions"><button className="primary" type="submit"><Icon name="search" size={16}/>Search</button>{query && <button className="secondary" type="button" onClick={() => { setQuery(''); setPage(0); }}>Clear search</button>}<button className="secondary" type="button" onClick={() => setRefresh(value => value + 1)} disabled={loading}>Refresh</button></div>
      </form>
      <div className="bill-date-filters"><button type="button" className="secondary" onClick={() => selectDate(0)}>Today</button><button type="button" className="secondary" onClick={() => selectDate(-1)}>Yesterday</button><label>Start date<input aria-label="Bill start date" type="date" value={dates.startDate} max={dates.endDate || undefined} onChange={event => { setDates({ ...dates, startDate: event.target.value }); setPage(0); }}/></label><label>End date<input aria-label="Bill end date" type="date" value={dates.endDate} min={dates.startDate || undefined} onChange={event => { setDates({ ...dates, endDate: event.target.value }); setPage(0); }}/></label><button type="button" className="secondary" onClick={() => { setDates({ startDate: '', endDate: '' }); setPage(0); }}>All dates</button></div>
      <p className="bill-date-hint">Dates are inclusive in IST. IPD and Daycare use settlement date; other bills use billing date.</p>
      {!validDates && <p role="alert" className="api-message error">Select both dates with the end date on or after the start date.</p>}
      {error && <div className="api-message error" role="alert">{error}</div>}
      {loading ? <p role="status">Loading previous bills…</p> : !error && validDates && <>
        <div className="table-wrap"><table><thead><tr><th>Bill / Admission</th><th>Patient</th><th>Date</th><th>Status</th><th>Paid amount</th><th/></tr></thead><tbody>{result.content.map(record => <tr key={record.visitId ?? record.id}>
          <td>{record.receiptNumber || record.invoiceNumber || record.orderNumber || record.ipdNumber}</td><td><b>{record.patient?.name || record.customerName}</b><small>{record.patient?.uhid || 'Walk-in'}</small></td><td>{new Date(record.settledAt || record.dischargeDraftSavedAt || record.dischargeDateTime || record.admissionDateTime || record.createdAt).toLocaleString('en-IN')}</td><td>{record.dischargeDraft && record.status !== 'DISCHARGED' ? 'Saved draft' : 'Completed bill'}</td><td>{formatMoney(record.paidAmount ?? record.finalPaidAmount ?? 0)}</td><td><button className="secondary" disabled={opening} onClick={event => open(record, event.currentTarget)}>View bill</button></td>
        </tr>)}</tbody></table></div>
        {!result.content.length && <p>No saved records on this page match your search.</p>}
        <div className="form-actions"><button className="secondary" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1} of {Math.max(1, result.totalPages)}</span><button className="secondary" disabled={page + 1 >= result.totalPages} onClick={() => setPage(value => value + 1)}>Next</button></div>
      </>}
      {opening && <p role="status">Loading saved bill…</p>}
    </section>
    {selected && <div className="bill-preview-backdrop" onClick={event => { if (event.target === event.currentTarget) setSelected(null); }}><section ref={previewRef} tabIndex={-1} role="dialog" aria-modal="true" className="bill-history-document" aria-label="Saved document preview">
      <header className="bill-preview-toolbar">
        <div><span className="bill-preview-eyebrow">SAVED DOCUMENT</span><h3>{documentType === 'summary' ? (section === 'daycare' ? 'Completion summary' : 'Discharge summary') : `${sections[section]} bill preview`}</h3><p>{selected.admission?.patient?.name || selected.patient?.name || selected.customerName} · {selected.bill?.invoiceNumber || selected.receiptNumber || selected.orderNumber || selected.invoiceNumber}</p></div>
        <div className="bill-preview-actions"><button className="primary" disabled={datesDirty} onClick={() => window.print()}><Icon name="print" size={16}/>{documentType === 'summary' ? (selected.admission.status === 'DISCHARGED' ? 'Print final summary' : 'Print draft summary') : 'Print bill'}</button><button className="secondary" onClick={() => setSelected(null)}>Close preview</button></div>
      </header>
      {isAdmission(section) && <div className="bill-preview-document-tabs"><div className="tabs"><button className={documentType === 'bill' ? 'active' : ''} onClick={() => setDocumentType('bill')}>{selected.bill.paymentStatus === 'PAID' ? 'Final bill' : 'Current bill'}</button><button className={documentType === 'summary' ? 'active' : ''} disabled={!selected.admission.dischargeDraft && selected.admission.status !== 'DISCHARGED'} onClick={() => setDocumentType('summary')}>{selected.admission.status === 'DISCHARGED' ? 'Final summary' : 'Draft summary'}</button></div>{(!selected.admission.dischargeDraft && selected.admission.status !== 'DISCHARGED') && <p>The summary will be available after the {section === 'daycare' ? 'completion' : 'discharge'} summary is saved.</p>}</div>}
      {isAdmission(section) && <div className="bill-preview-date-editor"><AdmissionDates admission={selected.admission} api={admissionApi(section)} onSaved={admission => setSelected(current => ({ ...current, admission }))} onDirty={setDatesDirty}/></div>}
      <div className="bill-history-preview">
      {section === 'op' && <OPPrintReceipt patient={selected.patient} age={selected.patient.age} visit={selected} doctor={selected.doctor}/>}
      {section === 'lab' && <LabPrintReceipt patient={selected.patient} selected={selected.tests.map(test => ({ ...test, id: test.testId, price: test.amount }))} order={selected} doctor={selected.referringDoctor}/>}
      {section === 'pharmacy' && <PharmacyReceipt invoice={selected}/>}
      {isAdmission(section) && (documentType === 'summary'
        ? <IPDDischargePrint admission={selected.admission} form={selected.admission} config={section === 'ipd' ? IPD_CONFIG : DAYCARE_CONFIG}/>
        : <IPDFinalBillPrint admission={selected.admission} bill={selected.bill} charges={selected.bill.charges} config={section === 'ipd' ? IPD_CONFIG : DAYCARE_CONFIG}/>)}
      </div>
    </section></div>}
  </>;
}
