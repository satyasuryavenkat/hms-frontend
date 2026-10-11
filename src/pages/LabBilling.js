import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { HospitalPrintHeader } from '../components/HospitalPrintHeader';
import { buildLabReportHtml, LabReportEditorDialog } from '../components/LabReportEditor';
import { FormField, SectionTitle, Status } from '../components/ui/FormField';
import { doctorApi, labApi } from '../api/services';
import { usePatientSearch } from '../hooks/usePatientSearch';
import { formatMoney } from '../data/hospitalData';

export function LabBilling({ currentUser }) {
  const [tests, setTests] = useState([]);
  const [selected, setSelected] = useState([]);
  const [patient, setPatient] = useState(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientSearchOpen, setPatientSearchOpen] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [referringDoctorId, setReferringDoctorId] = useState('');
  const [priority, setPriority] = useState('ROUTINE');
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [discount, setDiscount] = useState(0);
  const [testQuery, setTestQuery] = useState('');
  const [tab, setTab] = useState('billing');
  const [order, setOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [printDocument, setPrintDocument] = useState(null);
  const [reportPreview, setReportPreview] = useState(null);
  const [inlineTestId, setInlineTestId] = useState(null);
  const { patients: patientMatches, loading: patientLoading, error: patientError } = usePatientSearch(patientQuery);

  useEffect(() => {
    Promise.all([labApi.tests('', undefined, true), doctorApi.list(true)]).then(([testData, doctorData]) => {
      setTests(testData);
      setDoctors(doctorData);
      if (doctorData.length) setReferringDoctorId(String(doctorData[0].id));
    }).catch(error => setMessage({ type: 'error', text: error.message }));
  }, []);

  const available = tests.filter(test => !selected.some(item => item.id === test.id) && `${test.name} ${test.code}`.toLowerCase().includes(testQuery.toLowerCase()));
  const subtotal = useMemo(() => selected.reduce((sum, test) => sum + Number(test.price), 0), [selected]);
  const total = Math.max(0, subtotal - Number(discount || 0));
  const selectPatient = item => { setPatient(item); setPatientQuery(''); setPatientSearchOpen(false); setOrder(null); };
  const patientInitials = patient ? patient.name.split(' ').map(part => part[0]).slice(0, 2).join('') : '—';

  const createOrder = async () => {
    if (!patient || !selected.length) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const created = await labApi.createOrder({ patientId: patient.id, referringDoctorId: referringDoctorId ? Number(referringDoctorId) : null, priority, testIds: selected.map(test => test.id), discount: Number(discount || 0), paymentMode });
      setOrder(created);
      setPrintDocument(null);
      setMessage({ type: 'success', text: `Lab order ${created.orderNumber} generated with ${created.specimens?.length || 0} unique sample barcode${created.specimens?.length === 1 ? '' : 's'}.` });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setSubmitting(false); }
  };

  const printFormatted = document => {
    setPrintDocument(document);
    setTimeout(() => window.print(), 0);
  };

  const printIndividualTest = testId => {
    if (!order) return;
    const test = order.tests?.find(item => String(item.testId) === String(testId));
    if (!test) return;
    printFormatted({ type: 'report', html: buildLabReportHtml({
      order: { ...order, tests: [test] },
      results: Object.fromEntries((test.results || []).map(item => [item.parameterId, item])),
    }) });
  };

  return <><div className="lab-screen"><div className="tabs"><button className={tab === 'billing' ? 'active' : ''} onClick={() => setTab('billing')}>New lab order</button><button className={tab === 'report' ? 'active' : ''} onClick={() => setTab('report')}>Report entry</button><button className={tab === 'previous' ? 'active' : ''} onClick={() => setTab('previous')}>Previous reports</button></div>
    {tab === 'billing' ? <><div className="page-grid lab-layout"><section className="card form-card"><SectionTitle step="01" title="Patient & referral" description="Find a patient and add referral details"/><div className="form-grid"><FormField label="Patient / UHID" required wide><div className="lab-patient-lookup" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPatientSearchOpen(false); }}><Icon name="search"/><input aria-label="Search lab patient" value={patientQuery} onFocus={() => setPatientSearchOpen(true)} onChange={event => { setPatientQuery(event.target.value); setPatientSearchOpen(true); }} onKeyDown={event => { if (event.key === 'Enter' && patientMatches.length) { event.preventDefault(); selectPatient(patientMatches[0]); } }} placeholder={patient ? `${patient.name} · ${patient.uhid}` : 'Search name, UHID or mobile number...'}/>{patient && !patientQuery && <span className="selected-patient-value"><b>{patient.name}</b><small>{patient.uhid}</small></span>}{patientSearchOpen && patientQuery.trim() && <div className="patient-results lab-patient-results">{patientLoading ? <p>Searching…</p> : patientError ? <p>{patientError}</p> : patientMatches.length ? patientMatches.map((item, index) => <button type="button" key={item.id} onClick={() => selectPatient(item)}><span className="avatar soft blue">{item.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><span><b>{item.name}</b><small>{item.uhid} · +91 {item.mobile}</small></span>{index === 0 ? <kbd>Enter</kbd> : <Icon name="chevron" size={15}/>}</button>) : <p>No matching patient found</p>}</div>}</div></FormField><FormField label="Referring doctor"><select aria-label="Referring doctor" value={referringDoctorId} onChange={event => setReferringDoctorId(event.target.value)}><option value="">Self referral</option>{doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.name} — {doctor.department}</option>)}</select></FormField><FormField label="Sample priority"><select value={priority} onChange={event => setPriority(event.target.value)}><option value="ROUTINE">Routine</option><option value="URGENT">Urgent</option></select></FormField></div><div className="divider"/><SectionTitle step="02" title="Select investigations" description="Search and add tests to this order"/><div className="test-search"><Icon name="search"/><input value={testQuery} onChange={event => setTestQuery(event.target.value)} placeholder="Search by test name or code..."/>{testQuery && <div className="search-results">{available.map(test => <button key={test.id} onClick={() => { setSelected([...selected, test]); setTestQuery(''); }}><span><b>{test.name}</b><small>{test.code} · {test.department} · {(test.specimenType || 'BLOOD').replaceAll('_', ' ')}</small></span><strong>{formatMoney(test.price)} <Icon name="plus" size={15}/></strong></button>)}{!available.length && <p>No matching tests</p>}</div>}</div><div className="table-wrap"><table><thead><tr><th>Investigation</th><th>Department</th><th>Specimen</th><th>Amount</th><th>Report actions</th><th/></tr></thead><tbody>{selected.map(test => <tr key={test.id}><td><b>{test.name}</b><small>{test.code}</small></td><td>{test.department}</td><td><span className={`specimen-pill ${String(test.specimenType || 'BLOOD').toLowerCase()}`}>{(test.specimenType || 'BLOOD').replaceAll('_', ' ')}</span></td><td><b>{formatMoney(test.price)}</b></td><td><div className="lab-test-actions"><button type="button" className="secondary small" disabled={!order} onClick={() => setInlineTestId(test.id)}>Fill report</button><button type="button" className="secondary small" disabled={!order} onClick={() => printIndividualTest(test.id)}><Icon name="print" size={14}/> Print test</button></div></td><td><button className="table-action" onClick={() => setSelected(selected.filter(item => item.id !== test.id))}><Icon name="trash" size={16}/></button></td></tr>)}</tbody></table></div>{!selected.length && <p className="empty-inline">Search and add at least one investigation.</p>}{message.text && <div className={`api-message ${message.type}`}>{message.text}</div>}</section>
      <aside className="card bill-card"><div className="bill-header"><div><span>LAB ORDER</span><strong>#{order?.orderNumber || 'Pending'}</strong></div><Status>{priority}</Status></div><div className="patient-mini"><div className="avatar soft blue">{patientInitials}</div><div><strong>{patient?.name || 'No patient selected'}</strong><span>{patient ? `${patient.uhid} · ${patient.gender}` : 'Search and select a patient'}</span></div></div><h3>Order summary</h3>{selected.map(test => <div className="summary-line" key={test.id}><span>{test.name}</span><b>{formatMoney(test.price)}</b></div>)}<div className="summary-line"><span>Subtotal</span><b>{formatMoney(subtotal)}</b></div><div className="charge-row discount"><span>Discount</span><label>− ₹ <input aria-label="Lab bill discount" type="number" min="0" max={subtotal} disabled={Boolean(order)} value={discount} onChange={event => setDiscount(Math.min(subtotal, Math.max(0, Number(event.target.value))))}/></label></div><div className="total-row"><span>Total payable</span><strong>{formatMoney(order?.totalPayable ?? total)}</strong></div>{order?.specimens?.length > 0 && <div className="generated-specimens"><b>Sample barcodes generated</b>{order.specimens.map(specimen => <div key={specimen.barcode}><span className={`specimen-dot ${specimen.specimenType.toLowerCase()}`}/><span>{specimen.specimenType.replaceAll('_', ' ')}</span><strong>{specimen.barcode}</strong></div>)}</div>}<FormField label="Payment mode"><div className="payment-modes" role="group" aria-label="Lab payment mode">{['CASH', 'UPI', 'CARD'].map(mode => <button type="button" key={mode} className={paymentMode === mode ? 'selected' : ''} onClick={() => setPaymentMode(mode)}>{mode}</button>)}</div></FormField><button className="primary full" disabled={!selected.length || !patient || submitting} onClick={createOrder}><Icon name="file"/> {submitting ? 'Generating…' : 'Generate lab order'}</button><button className="secondary full sample-print-button" disabled={!order?.specimens?.length} onClick={() => printFormatted({ type: 'labels' })}><Icon name="print"/> Print sample stickers</button><button className="secondary full" disabled={!order} onClick={() => printFormatted({ type: 'receipt' })}><Icon name="print"/> Print formatted receipt</button></aside></div>{inlineTestId && order && <div className="inline-report-workspace"><ReportEntry currentUser={currentUser} initialOrder={order} focusedTestId={inlineTestId} onOrderChange={setOrder} onClose={() => setInlineTestId(null)} onPreview={document => setReportPreview({ ...document, html: buildLabReportHtml(document) })}/></div>}</> : tab === 'report' ? <ReportEntry currentUser={currentUser} onPreview={document => setReportPreview({ ...document, html: buildLabReportHtml(document) })}/> : <PreviousReports onPreview={html => setReportPreview({ html })}/>}</div>
    {printDocument?.type === 'receipt' && <LabPrintReceipt patient={patient} selected={selected} total={total} paymentMode={paymentMode} doctor={doctors.find(item => String(item.id) === referringDoctorId)} order={order}/>}
    {printDocument?.type === 'labels' && <SampleStickerSheet order={order}/>}
    {printDocument?.type === 'report' && <LabReportPrint {...printDocument}/>} 
    {reportPreview && <LabReportEditorDialog initialHtml={reportPreview.html} onClose={() => setReportPreview(null)} onPrint={html => { setReportPreview(null); printFormatted({ type: 'report', html }); }}/>}</>;
}

export const reportResultValues = order => Object.fromEntries((order?.tests || [])
  .flatMap(test => test.results || [])
  .map(result => [result.parameterId, { result: result.result || '', abnormal: result.abnormal }]));

export const selectedReportTest = (report, testId) =>
  (report?.tests || []).find(test => String(test.testId) === String(testId)) || report?.tests?.[0];

export const buildPreviousReportHtml = (report, testId) => {
  const test = selectedReportTest(report, testId);
  if (!test) return '';
  return buildLabReportHtml({
    order: { ...report, tests: [test] },
    results: reportResultValues(report),
  });
};

function PreviousReports({ onPreview }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [reports, setReports] = useState([]);
  const [pageInfo, setPageInfo] = useState({ totalElements: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [downloadingId] = useState(null);
  const [selectedTestIds, setSelectedTestIds] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      labApi.completedReports({ query, page, size: 20 }).then(result => {
        if (!active) return;
        setReports(result.content || []);
        setPageInfo({ totalElements: result.totalElements || 0, totalPages: result.totalPages || 0 });
        setMessage({ type: '', text: '' });
      }).catch(error => active && setMessage({ type: 'error', text: error.message }))
        .finally(() => active && setLoading(false));
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, page]);

  const selectedTest = report => selectedReportTest(report, selectedTestIds[report.id]);

  const printReport = report => {
    const html = buildPreviousReportHtml(report, selectedTestIds[report.id]);
    if (html) onPreview(html);
  };

  // Saving through the browser print dialog deliberately uses the same Quill HTML as Print.
  // The former server-generated PDF rebuilt the table independently and changed its layout.
  const downloadReport = report => printReport(report);

  return <section className="card previous-reports-card">
    <header className="previous-reports-header"><div><span>COMPLETED LAB REPORTS</span><h2>Previous reports</h2><p>Search by patient name, UHID, or lab order number, then print or download the completed report.</p></div><div className="previous-report-search"><Icon name="search"/><input aria-label="Search previous lab reports" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Search patient, UHID or order number..."/></div></header>
    {message.text && <div className={`api-message ${message.type}`}>{message.text}</div>}
    {loading ? <div className="previous-reports-empty">Loading previous reports…</div> : reports.length ? <div className="table-wrap"><table className="previous-reports-table"><thead><tr><th>Lab order</th><th>Patient</th><th>Test</th><th>Report date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{reports.map(report => <tr key={report.id}><td><b>{report.orderNumber}</b><small>{report.priority || 'ROUTINE'}</small></td><td><b>{report.patient?.name}</b><small>{report.patient?.uhid} · {report.patient?.age ?? '—'}Y / {report.patient?.gender || '—'}</small></td><td>{(report.tests || []).length > 1 ? <select className="previous-report-test-select" aria-label={`Select test for ${report.orderNumber}`} value={selectedTest(report)?.testId || ''} onChange={event => setSelectedTestIds(current => ({ ...current, [report.id]: event.target.value }))}>{report.tests.map(test => <option key={test.testId} value={test.testId}>{test.name} — {test.code}</option>)}</select> : <><b>{selectedTest(report)?.name || '—'}</b><small>{selectedTest(report)?.code || ''}</small></>}</td><td>{report.createdAt ? new Date(report.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td><td><Status>{report.reportStatus}</Status></td><td><div className="previous-report-actions"><button type="button" className="secondary small" disabled={!selectedTest(report)} onClick={() => printReport(report)}><Icon name="print" size={14}/> Print</button><button type="button" className="secondary small" disabled={!selectedTest(report) || downloadingId === report.id} onClick={() => downloadReport(report)}><Icon name="download" size={14}/> {downloadingId === report.id ? 'Downloading…' : 'Download PDF'}</button></div></td></tr>)}</tbody></table></div> : <div className="previous-reports-empty"><Icon name="file" size={28}/><b>No completed reports found</b><span>Verified lab reports will appear here for printing and download.</span></div>}
    {pageInfo.totalPages > 1 && <footer className="previous-reports-pagination"><span>{pageInfo.totalElements} completed reports</span><div><button type="button" disabled={page === 0} onClick={() => setPage(current => current - 1)}>Previous</button><strong>Page {page + 1} of {pageInfo.totalPages}</strong><button type="button" disabled={page + 1 >= pageInfo.totalPages} onClick={() => setPage(current => current + 1)}>Next</button></div></footer>}
  </section>;
}

const code39 = {
  '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101', '4': '101001101011',
  '5': '110100110101', '6': '101100110101', '7': '101001011011', '8': '110100101101', '9': '101100101101',
  A: '110101001011', B: '101101001011', C: '110110100101', D: '101011001011', E: '110101100101',
  F: '101101100101', G: '101010011011', H: '110101001101', I: '101101001101', J: '101011001101',
  K: '110101010011', L: '101101010011', M: '110110101001', N: '101011010011', O: '110101101001',
  P: '101101101001', Q: '101010110011', R: '110101011001', S: '101101011001', T: '101011011001',
  U: '110010101011', V: '100110101011', W: '110011010101', X: '100101101011', Y: '110010110101',
  Z: '100110110101', '-': '100101011011', '.': '110010101101', ' ': '100110101101', '*': '100101101101',
};

function Code39Barcode({ value }) {
  const encoded = `*${String(value).toUpperCase()}*`.split('').map(character => code39[character] || code39['-']).join('0');
  return <svg className="code39-barcode" viewBox={`0 0 ${encoded.length} 48`} role="img" aria-label={`Barcode ${value}`} preserveAspectRatio="none">{encoded.split('').map((bar, index) => bar === '1' ? <rect key={index} x={index} y="0" width="1" height="48"/> : null)}</svg>;
}

function SampleStickerSheet({ order }) {
  if (!order?.specimens?.length) return null;
  return <section className="sample-label-print">{order.specimens.map(specimen => <article className="sample-sticker" key={specimen.barcode}>
    <header><b>Lakshmi Sreenivaasa Hospital</b><strong className={`sample-type ${specimen.specimenType.toLowerCase()}`}>{specimen.specimenType.replaceAll('_', ' ')}</strong></header>
    <div className="sample-patient"><b>{order.patient?.name}</b><span>{order.patient?.uhid} · {order.patient?.age}Y / {order.patient?.gender}</span></div>
    <Code39Barcode value={specimen.barcode}/>
    <div className="barcode-number">{specimen.barcode}</div>
    <footer><span>{order.orderNumber}</span><span>{specimen.testCodes?.join(', ')}</span><span>{new Date(order.createdAt).toLocaleDateString('en-IN')}</span></footer>
  </article>)}</section>;
}

function advanceReportField(event) {
  if (event.key !== 'Enter' || event.shiftKey) return;
  event.preventDefault();
  const fields = [...event.currentTarget.closest('.report-card').querySelectorAll('[data-report-entry]:not(:disabled)')];
  fields[fields.indexOf(event.currentTarget) + 1]?.focus();
}

function ResultEntryRow({ test, item, results, setResults }) {
  if (item.parameterType === 'HEADING') {
    return <tr className="lab-result-section-heading"><td colSpan="5">{item.name}</td></tr>;
  }
  const value = results[item.parameterId] || {};
  const update = (field, nextValue) => setResults(current => ({
    ...current,
    [item.parameterId]: { ...current[item.parameterId], [field]: nextValue },
  }));

  if (item.parameterType === 'TEXT') {
    return <tr className="text-result-row"><td><b>{item.name}</b><small className="result-type-label">Text observation</small></td><td colSpan="3"><textarea data-report-entry rows="2" className="text-result-input" aria-label={`${test.name} ${item.name} result value`} placeholder="Enter clinical observation or interpretation" value={value.result || ''} onChange={event => update('result', event.target.value)} onKeyDown={advanceReportField}/></td></tr>;
  }

  return <tr><td><b>{item.name}</b><small className="result-type-label">Numeric value</small></td><td><input data-report-entry type="number" step="any" className="result-input" aria-label={`${test.name} ${item.name} result value`} placeholder="Enter value" value={value.result || ''} onChange={event => update('result', event.target.value)} onKeyDown={advanceReportField}/></td><td>{item.unit}</td><td>{item.referenceRange}</td></tr>;
}

function ReportEntry({ currentUser, onPreview, initialOrder = null, focusedTestId = null, onOrderChange, onClose }) {
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(initialOrder);
  const [selectedTestId, setSelectedTestId] = useState(focusedTestId ? String(focusedTestId) : '');
  const [results, setResults] = useState({});
  const [message, setMessage] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [signatureDesignation, setSignatureDesignation] = useState('LAB_INCHARGE');

  useEffect(() => {
    if (initialOrder) {
      setOrders([initialOrder]);
      setOrder(initialOrder);
      return;
    }
    labApi.pendingReports({ page: 0, size: 20 }).then(page => {
      setOrders(page.content || []);
      if (page.content?.length) setOrder(page.content[0]);
    }).catch(error => setMessage({ type: 'error', text: error.message }));
  }, [initialOrder]);

  useEffect(() => {
    const values = {};
    order?.tests?.forEach(test => test.results?.forEach(result => { values[result.parameterId] = { result: result.result || '', abnormal: result.abnormal }; }));
    setResults(values);
    setSignatureDesignation(order?.signatureDesignation || 'LAB_INCHARGE');
    const orderTests = order?.tests || [];
    const requestedTest = focusedTestId && orderTests.find(test => String(test.testId) === String(focusedTestId));
    setSelectedTestId(current => {
      if (requestedTest) return String(requestedTest.testId);
      if (orderTests.some(test => String(test.testId) === String(current))) return current;
      return orderTests[0] ? String(orderTests[0].testId) : '';
    });
  }, [order, focusedTestId]);

  const reportItems = order?.tests?.flatMap(test => test.results || []) || [];
  const resultItems = reportItems.filter(item => item.parameterType !== 'HEADING');
  const orderTests = order?.tests || [];
  const visibleTests = orderTests.filter(test => String(test.testId) === String(selectedTestId));
  const visibleResultItems = visibleTests.flatMap(test => test.results || []).filter(item => item.parameterType !== 'HEADING');
  const save = async publish => {
    if (!order) return;
    if (!resultItems.length) {
      setMessage({ type: 'error', text: 'No result fields are available for this order. Reload the order to generate the report entry field.' });
      return;
    }
    const incompleteTest = publish && orderTests.find(test => (test.results || [])
      .filter(item => item.parameterType !== 'HEADING')
      .some(item => !String(results[item.parameterId]?.result || '').trim()));
    if (incompleteTest) {
      setSelectedTestId(String(incompleteTest.testId));
      setMessage({ type: 'error', text: `Complete all result fields for ${incompleteTest.name} before publishing.` });
      return;
    }
    setBusy(true);
    try {
      let saved = await labApi.saveReport(order.id, { results: resultItems.map(item => ({ parameterId: item.parameterId, result: results[item.parameterId]?.result || '', abnormal: Boolean(results[item.parameterId]?.abnormal) })), signatureDesignation });
      if (publish) saved = await labApi.publishReport(order.id, { pathologistId: currentUser?.id, signatureDesignation });
      setOrder(saved);
      onOrderChange?.(saved);
      setMessage({ type: 'success', text: publish ? 'Report verified and published.' : 'Report draft saved.' });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };

  return <section className="card form-card report-card">
    <SectionTitle step="03" title={focusedTestId ? `Fill ${visibleTests[0]?.name || 'test'} report` : 'Lab report entry'} description="Press Enter to move to the next result box; use Shift+Enter for a new line" action={<div className="report-heading-actions"><Status tone="amber">{order?.reportStatus || 'PENDING'}</Status>{onClose && <button type="button" className="table-action" onClick={onClose} aria-label="Close inline report">×</button>}</div>}/>
    {!initialOrder && <FormField label="Pending lab order"><select value={order?.id || ''} onChange={event => setOrder(orders.find(item => String(item.id) === event.target.value))}><option value="">Select pending order</option>{orders.map(item => <option key={item.id} value={item.id}>{item.orderNumber} — {item.patient.name}</option>)}</select></FormField>}
    {order && <>
      <div className="report-patient"><div><small>Patient</small><strong>{order.patient.name} · {order.patient.uhid}</strong></div><div><small>Order</small><strong>{order.orderNumber}</strong></div><div><small>Status</small><strong>{order.reportStatus}</strong></div></div>
      {orderTests.length > 1 && <div className="lab-entry-test-selector"><FormField label="Test / Investigation" required><select aria-label="Select test for lab entry" value={selectedTestId} onChange={event => { setSelectedTestId(event.target.value); setMessage({ type: '', text: '' }); }}>{orderTests.map(test => <option key={test.testId} value={test.testId}>{test.name} — {test.code}</option>)}</select></FormField><small>Select a test to enter or update its report values.</small></div>}
      {visibleResultItems.length ? <div className="table-wrap"><table className="lab-result-table"><thead><tr><th>Parameter</th><th>Patient result value</th><th>Unit</th><th>Reference range</th></tr></thead>{visibleTests.map(test => <tbody key={`${test.testId}-${test.code}`}><tr className="lab-result-test"><td colSpan="3"><b>{test.name}</b><span>{test.code} · {test.department}</span></td><td><button type="button" className="secondary small" onClick={() => onPreview({ order: { ...order, tests: [test] }, results, signatureDesignation })}><Icon name="print" size={14}/> Print test</button></td></tr>{(test.results || []).map(item => <ResultEntryRow key={item.parameterId} test={test} item={item} results={results} setResults={setResults}/>)}</tbody>)}</table></div> : <div className="lab-no-parameters"><Icon name="flask"/><div><b>Result field is not available</b><p>Reload this order after restarting the backend. Its configured test parameters will be loaded for Lab Technician entry.</p></div></div>}
      <div className="lab-signature-selector"><FormField label="Signature text" required><select aria-label="Signature text" value={signatureDesignation} onChange={event => setSignatureDesignation(event.target.value)}><option value="LAB_INCHARGE">Lab Incharge</option><option value="CONSULTANT_PATHOLOGIST">Consultant Pathologist</option></select></FormField><small>This designation will appear at the end of every test report in this lab order.</small></div>
      <div className="form-actions"><button className="secondary" disabled={busy || !visibleResultItems.length} onClick={() => save(false)}>Save test draft</button><button className="primary" disabled={busy || !currentUser?.id || !resultItems.length} onClick={() => save(true)}><Icon name="check"/> Verify & publish</button><button className="secondary report-preview-button" disabled={!visibleResultItems.length} onClick={() => onPreview({ order: { ...order, tests: visibleTests }, results, signatureDesignation })}><Icon name="file"/> Preview selected test</button></div>
    </>}
    {message.text && <div className={`api-message ${message.type}`}>{message.text}</div>}
  </section>;
}

export function LabPrintReceipt({ patient, selected, total, doctor, order }) {
  const createdAt = order?.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');
  return <article className="print-receipt lab-print-receipt">
    <HospitalPrintHeader/>
    <div className="receipt-title">LABORATORY PAYMENT RECEIPT</div>
    <section className="receipt-details"><div><p><b>Lab Order:</b> {order?.orderNumber || 'Pending'}</p><p><b>Receipt:</b> {order?.receiptNumber || '—'}</p><p><b>UHID:</b> {patient?.uhid || '—'}</p><p><b>Patient:</b> {patient?.name || '—'}</p><p><b>Age / Gender:</b> {patient?.age ?? '—'} / {patient?.gender || '—'}</p><p><b>Mobile:</b> {patient?.mobile ? `+91 ${patient.mobile}` : '—'}</p></div><div><p><b>Receipt Date:</b> {createdAt}</p><p><b>Referring Doctor:</b> {doctor?.name || 'Self referral'}</p><p><b>Department:</b> {doctor?.department || 'Laboratory'}</p><p><b>Priority:</b> {order?.priority || 'ROUTINE'}</p></div></section>
    <table className="receipt-table"><thead><tr><th>S.No.</th><th>Investigation</th><th>Department</th><th>Amount (₹)</th></tr></thead><tbody>{selected.map((test, index) => <tr key={test.id}><td>{index + 1}</td><td>{test.name}<small>{test.code}</small></td><td>{test.department}</td><td>{Number(test.price).toFixed(2)}</td></tr>)}{Number(order?.discount || 0) > 0 && <><tr className="receipt-summary-row"><td colSpan="3">Subtotal</td><td>₹{Number(order.subtotal).toFixed(2)}</td></tr><tr className="receipt-summary-row"><td colSpan="3">Discount</td><td>− ₹{Number(order.discount).toFixed(2)}</td></tr></>}<tr className="receipt-total"><td colSpan="3">Paid Amount</td><td>₹{Number(order?.paidAmount ?? total).toFixed(2)}</td></tr></tbody></table>
    <div className="receipt-paid-note">Received with thanks <b>{formatMoney(order?.paidAmount ?? total)}</b> from <b>{patient?.name || 'the patient'}</b>.</div>
  </article>;
}

function LabReportPrint({ html }) {
  return <article className="print-receipt lab-report-content-print ql-editor" dangerouslySetInnerHTML={{ __html: html }}/>;
}
