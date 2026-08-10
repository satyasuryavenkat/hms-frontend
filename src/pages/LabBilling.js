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
  const [testQuery, setTestQuery] = useState('');
  const [tab, setTab] = useState('billing');
  const [order, setOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [printDocument, setPrintDocument] = useState(null);
  const [reportPreview, setReportPreview] = useState(null);
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
  const selectPatient = item => { setPatient(item); setPatientQuery(''); setPatientSearchOpen(false); setOrder(null); };
  const patientInitials = patient ? patient.name.split(' ').map(part => part[0]).slice(0, 2).join('') : '—';

  const createOrder = async () => {
    if (!patient || !selected.length) return;
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const created = await labApi.createOrder({ patientId: patient.id, referringDoctorId: referringDoctorId ? Number(referringDoctorId) : null, priority, testIds: selected.map(test => test.id), paymentMode });
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

  return <><div className="lab-screen"><div className="tabs"><button className={tab === 'billing' ? 'active' : ''} onClick={() => setTab('billing')}>New lab order</button><button className={tab === 'report' ? 'active' : ''} onClick={() => setTab('report')}>Report entry</button></div>
    {tab === 'billing' ? <div className="page-grid lab-layout"><section className="card form-card"><SectionTitle step="01" title="Patient & referral" description="Find a patient and add referral details"/><div className="form-grid"><FormField label="Patient / UHID" required wide><div className="lab-patient-lookup" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPatientSearchOpen(false); }}><Icon name="search"/><input aria-label="Search lab patient" value={patientQuery} onFocus={() => setPatientSearchOpen(true)} onChange={event => { setPatientQuery(event.target.value); setPatientSearchOpen(true); }} onKeyDown={event => { if (event.key === 'Enter' && patientMatches.length) { event.preventDefault(); selectPatient(patientMatches[0]); } }} placeholder={patient ? `${patient.name} · ${patient.uhid}` : 'Search name, UHID or mobile number...'}/>{patient && !patientQuery && <span className="selected-patient-value"><b>{patient.name}</b><small>{patient.uhid}</small></span>}{patientSearchOpen && patientQuery.trim() && <div className="patient-results lab-patient-results">{patientLoading ? <p>Searching…</p> : patientError ? <p>{patientError}</p> : patientMatches.length ? patientMatches.map((item, index) => <button type="button" key={item.id} onClick={() => selectPatient(item)}><span className="avatar soft blue">{item.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><span><b>{item.name}</b><small>{item.uhid} · +91 {item.mobile}</small></span>{index === 0 ? <kbd>Enter</kbd> : <Icon name="chevron" size={15}/>}</button>) : <p>No matching patient found</p>}</div>}</div></FormField><FormField label="Referring doctor"><select aria-label="Referring doctor" value={referringDoctorId} onChange={event => setReferringDoctorId(event.target.value)}><option value="">Self referral</option>{doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.name} — {doctor.department}</option>)}</select></FormField><FormField label="Sample priority"><select value={priority} onChange={event => setPriority(event.target.value)}><option value="ROUTINE">Routine</option><option value="URGENT">Urgent</option></select></FormField></div><div className="divider"/><SectionTitle step="02" title="Select investigations" description="Search and add tests to this order"/><div className="test-search"><Icon name="search"/><input value={testQuery} onChange={event => setTestQuery(event.target.value)} placeholder="Search by test name or code..."/>{testQuery && <div className="search-results">{available.map(test => <button key={test.id} onClick={() => { setSelected([...selected, test]); setTestQuery(''); }}><span><b>{test.name}</b><small>{test.code} · {test.department} · {test.specimenType || 'BLOOD'}</small></span><strong>{formatMoney(test.price)} <Icon name="plus" size={15}/></strong></button>)}{!available.length && <p>No matching tests</p>}</div>}</div><div className="table-wrap"><table><thead><tr><th>Investigation</th><th>Department</th><th>Specimen</th><th>Amount</th><th/></tr></thead><tbody>{selected.map(test => <tr key={test.id}><td><b>{test.name}</b><small>{test.code}</small></td><td>{test.department}</td><td><span className={`specimen-pill ${String(test.specimenType || 'BLOOD').toLowerCase()}`}>{test.specimenType || 'BLOOD'}</span></td><td><b>{formatMoney(test.price)}</b></td><td><button className="table-action" onClick={() => setSelected(selected.filter(item => item.id !== test.id))}><Icon name="trash" size={16}/></button></td></tr>)}</tbody></table></div>{!selected.length && <p className="empty-inline">Search and add at least one investigation.</p>}{message.text && <div className={`api-message ${message.type}`}>{message.text}</div>}</section>
      <aside className="card bill-card"><div className="bill-header"><div><span>LAB ORDER</span><strong>#{order?.orderNumber || 'Pending'}</strong></div><Status>{priority}</Status></div><div className="patient-mini"><div className="avatar soft blue">{patientInitials}</div><div><strong>{patient?.name || 'No patient selected'}</strong><span>{patient ? `${patient.uhid} · ${patient.gender}` : 'Search and select a patient'}</span></div></div><h3>Order summary</h3>{selected.map(test => <div className="summary-line" key={test.id}><span>{test.name}</span><b>{formatMoney(test.price)}</b></div>)}<div className="total-row"><span>Total payable</span><strong>{formatMoney(subtotal)}</strong></div>{order?.specimens?.length > 0 && <div className="generated-specimens"><b>Sample barcodes generated</b>{order.specimens.map(specimen => <div key={specimen.barcode}><span className={`specimen-dot ${specimen.specimenType.toLowerCase()}`}/><span>{specimen.specimenType}</span><strong>{specimen.barcode}</strong></div>)}</div>}<FormField label="Payment mode"><div className="payment-modes" role="group" aria-label="Lab payment mode">{['CASH', 'UPI', 'CARD'].map(mode => <button type="button" key={mode} className={paymentMode === mode ? 'selected' : ''} onClick={() => setPaymentMode(mode)}>{mode}</button>)}</div></FormField><button className="primary full" disabled={!selected.length || !patient || submitting} onClick={createOrder}><Icon name="file"/> {submitting ? 'Generating…' : 'Generate lab order'}</button><button className="secondary full sample-print-button" disabled={!order?.specimens?.length} onClick={() => printFormatted({ type: 'labels' })}><Icon name="print"/> Print sample stickers</button><button className="secondary full" disabled={!order} onClick={() => printFormatted({ type: 'receipt' })}><Icon name="print"/> Print formatted receipt</button></aside></div> : <ReportEntry currentUser={currentUser} onPreview={document => setReportPreview({ ...document, html: buildLabReportHtml(document) })}/>}</div>
    {printDocument?.type === 'receipt' && <LabPrintReceipt patient={patient} selected={selected} total={subtotal} paymentMode={paymentMode} doctor={doctors.find(item => String(item.id) === referringDoctorId)} order={order}/>} 
    {printDocument?.type === 'labels' && <SampleStickerSheet order={order}/>}
    {printDocument?.type === 'report' && <LabReportPrint {...printDocument}/>} 
    {reportPreview && <LabReportEditorDialog initialHtml={reportPreview.html} onClose={() => setReportPreview(null)} onPrint={html => { setReportPreview(null); printFormatted({ type: 'report', html }); }}/>}</>;
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
    <header><b>Lakshmi Sreenivaasa Hospital</b><strong className={`sample-type ${specimen.specimenType.toLowerCase()}`}>{specimen.specimenType}</strong></header>
    <div className="sample-patient"><b>{order.patient?.name}</b><span>{order.patient?.uhid} · {order.patient?.age}Y / {order.patient?.gender}</span></div>
    <Code39Barcode value={specimen.barcode}/>
    <div className="barcode-number">{specimen.barcode}</div>
    <footer><span>{order.orderNumber}</span><span>{specimen.testCodes?.join(', ')}</span><span>{new Date(order.createdAt).toLocaleDateString('en-IN')}</span></footer>
  </article>)}</section>;
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
    return <tr className="text-result-row"><td><b>{item.name}</b><small className="result-type-label">Text observation</small></td><td colSpan="3"><textarea rows="2" className="text-result-input" aria-label={`${test.name} ${item.name} result value`} placeholder="Enter clinical observation or interpretation" value={value.result || ''} onChange={event => update('result', event.target.value)}/></td><td><input className="parameter-remarks-input" aria-label={`${test.name} ${item.name} remarks`} placeholder="Add remarks" value={value.remarks || ''} onChange={event => update('remarks', event.target.value)}/></td></tr>;
  }

  return <tr><td><b>{item.name}</b><small className="result-type-label">Numeric value</small></td><td><input type="number" step="any" className="result-input" aria-label={`${test.name} ${item.name} result value`} placeholder="Enter value" value={value.result || ''} onChange={event => update('result', event.target.value)}/></td><td>{item.unit}</td><td>{item.referenceRange}</td><td><input className="parameter-remarks-input" aria-label={`${test.name} ${item.name} remarks`} placeholder="Add remarks" value={value.remarks || ''} onChange={event => update('remarks', event.target.value)}/></td></tr>;
}

function ReportEntry({ currentUser, onPreview }) {
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [results, setResults] = useState({});
  const [remarks, setRemarks] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    labApi.pendingReports({ page: 0, size: 20 }).then(page => {
      setOrders(page.content || []);
      if (page.content?.length) setOrder(page.content[0]);
    }).catch(error => setMessage({ type: 'error', text: error.message }));
  }, []);

  useEffect(() => {
    const values = {};
    order?.tests?.forEach(test => test.results?.forEach(result => { values[result.parameterId] = { result: result.result || '', remarks: result.remarks || '', abnormal: result.abnormal }; }));
    setResults(values);
    setRemarks(order?.remarks || '');
  }, [order]);

  const reportItems = order?.tests?.flatMap(test => test.results || []) || [];
  const resultItems = reportItems.filter(item => item.parameterType !== 'HEADING');
  const save = async publish => {
    if (!order) return;
    if (!resultItems.length) {
      setMessage({ type: 'error', text: 'No result fields are available for this order. Reload the order to generate the report entry field.' });
      return;
    }
    if (publish && resultItems.some(item => !results[item.parameterId]?.result?.trim())) {
      setMessage({ type: 'error', text: 'Enter a result for every report parameter before publishing.' });
      return;
    }
    setBusy(true);
    try {
      let saved = await labApi.saveReport(order.id, { results: resultItems.map(item => ({ parameterId: item.parameterId, result: results[item.parameterId]?.result || '', remarks: results[item.parameterId]?.remarks || '', abnormal: Boolean(results[item.parameterId]?.abnormal) })), remarks });
      if (publish) saved = await labApi.publishReport(order.id, { pathologistId: currentUser?.id, remarks });
      setOrder(saved);
      setMessage({ type: 'success', text: publish ? 'Report verified and published.' : 'Report draft saved.' });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };

  return <section className="card form-card report-card">
    <SectionTitle step="03" title="Lab report entry" description="Lab Technician enters patient investigation values here" action={<Status tone="amber">{order?.reportStatus || 'PENDING'}</Status>}/>
    <FormField label="Pending lab order"><select value={order?.id || ''} onChange={event => setOrder(orders.find(item => String(item.id) === event.target.value))}><option value="">Select pending order</option>{orders.map(item => <option key={item.id} value={item.id}>{item.orderNumber} — {item.patient.name}</option>)}</select></FormField>
    {order && <>
      <div className="report-patient"><div><small>Patient</small><strong>{order.patient.name} · {order.patient.uhid}</strong></div><div><small>Order</small><strong>{order.orderNumber}</strong></div><div><small>Status</small><strong>{order.reportStatus}</strong></div></div>
      {resultItems.length ? <div className="table-wrap"><table className="lab-result-table"><thead><tr><th>Parameter</th><th>Patient result value</th><th>Unit</th><th>Reference range</th><th>Parameter remarks</th></tr></thead>{order.tests.map(test => <tbody key={`${test.testId}-${test.code}`}><tr className="lab-result-test"><td colSpan="5"><b>{test.name}</b><span>{test.code} · {test.department}</span></td></tr>{(test.results || []).map(item => <ResultEntryRow key={item.parameterId} test={test} item={item} results={results} setResults={setResults}/>)}</tbody>)}</table></div> : <div className="lab-no-parameters"><Icon name="flask"/><div><b>Result field is not available</b><p>Reload this order after restarting the backend. Its configured test parameters will be loaded for Lab Technician entry.</p></div></div>}
      <FormField label="Pathologist remarks"><textarea rows="3" value={remarks} onChange={event => setRemarks(event.target.value)}/></FormField>
      <div className="form-actions"><button className="secondary" disabled={busy || !resultItems.length} onClick={() => save(false)}>Save draft</button><button className="primary" disabled={busy || !currentUser?.id || !resultItems.length} onClick={() => save(true)}><Icon name="check"/> Verify & publish</button><button className="secondary report-preview-button" disabled={!resultItems.length} onClick={() => onPreview({ order, results, remarks })}><Icon name="file"/> Preview & edit report</button></div>
    </>}
    {message.text && <div className={`api-message ${message.type}`}>{message.text}</div>}
  </section>;
}

function LabPrintReceipt({ patient, selected, total, paymentMode, doctor, order }) {
  const createdAt = order?.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');
  return <article className="print-receipt lab-print-receipt">
    <HospitalPrintHeader/>
    <div className="receipt-title">LABORATORY PAYMENT RECEIPT</div>
    <section className="receipt-details"><div><p><b>Lab Order:</b> {order?.orderNumber || 'Pending'}</p><p><b>Receipt:</b> {order?.receiptNumber || '—'}</p><p><b>UHID:</b> {patient?.uhid || '—'}</p><p><b>Patient:</b> {patient?.name || '—'}</p><p><b>Age / Gender:</b> {patient?.age ?? '—'} / {patient?.gender || '—'}</p><p><b>Mobile:</b> {patient?.mobile ? `+91 ${patient.mobile}` : '—'}</p></div><div><p><b>Receipt Date:</b> {createdAt}</p><p><b>Referring Doctor:</b> {doctor?.name || 'Self referral'}</p><p><b>Department:</b> {doctor?.department || 'Laboratory'}</p><p><b>Priority:</b> {order?.priority || 'ROUTINE'}</p><p><b>Payment Mode:</b> {order?.paymentMode || paymentMode}</p><p><b>Payment Status:</b> {order?.paymentStatus || 'PAID'}</p></div></section>
    <table className="receipt-table"><thead><tr><th>S.No.</th><th>Investigation</th><th>Department</th><th>Amount (₹)</th></tr></thead><tbody>{selected.map((test, index) => <tr key={test.id}><td>{index + 1}</td><td>{test.name}<small>{test.code}</small></td><td>{test.department}</td><td>{Number(test.price).toFixed(2)}</td></tr>)}<tr className="receipt-total"><td colSpan="3">Paid Amount</td><td>₹{Number(order?.paidAmount ?? total).toFixed(2)}</td></tr></tbody></table>
    <div className="receipt-paid-note">Received with thanks <b>{formatMoney(order?.paidAmount ?? total)}</b> from <b>{patient?.name || 'the patient'}</b>.</div>
    <PrintFooter text="Please retain this receipt when collecting laboratory reports."/>
  </article>;
}

function LabReportPrint({ html }) {
  return <article className="print-receipt lab-report-content-print ql-editor" dangerouslySetInnerHTML={{ __html: html }}/>;
}

function PrintFooter({ text, signature = 'Authorized Signature' }) {
  return <footer className="receipt-footer"><div><p>This is a computer-generated hospital document.</p><p>{text}</p></div><div className="signature">{signature}</div></footer>;
}
