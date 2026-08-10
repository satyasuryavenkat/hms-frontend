import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { HospitalLogo } from '../components/HospitalLogo';
import { HospitalPrintHeader } from '../components/HospitalPrintHeader';
import { FormField, SectionTitle, Status } from '../components/ui/FormField';
import { doctorApi, ipdApi } from '../api/services';
import { usePatientSearch } from '../hooks/usePatientSearch';
import { formatMoney } from '../data/hospitalData';

const currentDate = () => new Date().toLocaleDateString('en-CA');
const emptyAdmission = { patientId: '', admissionType: 'PLANNED', admissionDate: currentDate(), admissionTime: '10:30', consultantId: '', ward: 'General', bedNumber: '', provisionalDiagnosis: '', attendantName: '', attendantMobile: '' };

export function IPDBilling({ currentUser }) {
  const [tab, setTab] = useState('registration');
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [charges, setCharges] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [bill, setBill] = useState(null);
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceMode, setAdvanceMode] = useState('CASH');
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [printDocument, setPrintDocument] = useState(null);

  useEffect(() => { ipdApi.catalog().then(setCatalog).catch(error => setMessage({ type: 'error', text: error.message })); }, []);

  const loadBilling = async admission => {
    setSelectedAdmission(admission);
    setMessage({ type: '', text: '' });
    try {
      const [chargeData, billData] = await Promise.all([ipdApi.charges(admission.id), ipdApi.finalBill(admission.id)]);
      setCharges(chargeData.charges || []);
      setBill(billData);
      setDiscount(Number(billData.discount || 0));
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
  };

  const addCharge = async charge => {
    setBusy(true);
    try {
      const created = await ipdApi.addCharge(selectedAdmission.id, charge);
      setCharges(current => [...current, created]);
      setChargeDialogOpen(false);
      setBill(await ipdApi.finalBill(selectedAdmission.id));
      setMessage({ type: 'success', text: 'Charge added successfully.' });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };

  const updateChargeLocal = (id, field, value) => setCharges(current => current.map(charge => charge.id === id ? { ...charge, [field]: value } : charge));
  const saveCharge = async charge => {
    setBusy(true);
    try {
      const updated = await ipdApi.updateCharge(selectedAdmission.id, charge.id, { category: charge.category, department: charge.department, serviceCode: charge.serviceCode || null, description: charge.description, quantity: Number(charge.quantity), rate: Number(charge.rate) });
      setCharges(current => current.map(item => item.id === updated.id ? updated : item));
      setBill(await ipdApi.finalBill(selectedAdmission.id));
      setMessage({ type: 'success', text: 'Charge updated.' });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };
  const deleteCharge = async chargeId => {
    setBusy(true);
    try {
      await ipdApi.deleteCharge(selectedAdmission.id, chargeId);
      setCharges(current => current.filter(charge => charge.id !== chargeId));
      setBill(await ipdApi.finalBill(selectedAdmission.id));
      setMessage({ type: 'success', text: 'Charge deleted.' });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };

  const recordAdvance = async () => {
    if (!Number(advanceAmount)) return;
    setBusy(true);
    try {
      const receipt = await ipdApi.addAdvance(selectedAdmission.id, { amount: Number(advanceAmount), paymentMode: advanceMode, referenceNumber: null, remarks: 'IPD advance' });
      setAdvanceAmount('');
      setBill(await ipdApi.finalBill(selectedAdmission.id));
      setMessage({ type: 'success', text: `Advance recorded: ${receipt.receiptNumber}` });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };

  const settleBill = async () => {
    setBusy(true);
    try {
      const settled = await ipdApi.settle(selectedAdmission.id, { discount: Number(discount), discountReason: 'Approved during final settlement', paymentMode, paidAmount: Math.max(0, Number(bill?.grossCharges || 0) - Number(bill?.advanceReceived || 0) - Number(discount)), paymentReference: null });
      setBill(settled);
      setMessage({ type: 'success', text: `Final bill ${settled.invoiceNumber} settled.` });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };

  const changeTab = value => { setTab(value); if (value === 'registration') setSelectedAdmission(null); };
  const balance = Math.max(0, Number(bill?.grossCharges || 0) - Number(bill?.advanceReceived || 0) - Number(discount));
  const printFormatted = document => {
    setPrintDocument(document);
    setTimeout(() => window.print(), 0);
  };

  return <><div className="ipd-screen">{selectedAdmission && tab !== 'registration' && <PatientBanner admission={selectedAdmission}/>}<div className="tabs ipd-tabs"><button className={tab === 'registration' ? 'active' : ''} onClick={() => changeTab('registration')}>IPD registration</button><button className={tab === 'bill' ? 'active' : ''} onClick={() => changeTab('bill')}>Final billing</button><button className={tab === 'discharge' ? 'active' : ''} onClick={() => changeTab('discharge')}>Discharge summary</button></div>
    {tab === 'registration' && <IPDRegistration onCreated={admission => { setTab('bill'); loadBilling(admission); }} setParentMessage={setMessage}/>} 
    {tab !== 'registration' && !selectedAdmission && <AdmissionSearch mode={tab} onSelect={loadBilling}/>} 
    {tab === 'bill' && selectedAdmission && <div className="page-grid ipd-layout"><section className="card form-card"><div className="selected-toolbar"><button onClick={() => setSelectedAdmission(null)}><Icon name="search"/> Select another admission</button></div><SectionTitle step="01" title="Consolidated bill" description="Charges are persisted immediately to the IPD account" action={<button className="secondary small" onClick={() => setChargeDialogOpen(true)}><Icon name="plus"/> Add charge</button>}/><div className="table-wrap"><table className="billing-table editable-billing-table"><thead><tr><th>Category / Description</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Actions</th></tr></thead><tbody>{charges.map((charge, index) => <tr key={charge.id}><td><select aria-label={`Charge category ${index + 1}`} value={charge.category} onChange={event => { const category = event.target.value; const selectedCatalog = catalog.find(item => item.category === category); updateChargeLocal(charge.id, 'category', category); if (selectedCatalog?.services?.[0]) { updateChargeLocal(charge.id, 'description', selectedCatalog.services[0].name); updateChargeLocal(charge.id, 'department', selectedCatalog.services[0].department); } }}><option value={charge.category}>{charge.category}</option>{catalog.filter(item => item.category !== charge.category).map(item => <option key={item.category} value={item.category}>{item.label}</option>)}</select><input className="charge-detail-input" value={charge.description} onChange={event => updateChargeLocal(charge.id, 'description', event.target.value)}/></td><td><input type="number" value={charge.quantity} onChange={event => updateChargeLocal(charge.id, 'quantity', event.target.value)}/></td><td><input type="number" value={charge.rate} onChange={event => updateChargeLocal(charge.id, 'rate', event.target.value)}/></td><td><b>{formatMoney(Number(charge.quantity) * Number(charge.rate))}</b></td><td><div className="row-actions"><button title="Save charge" onClick={() => saveCharge(charge)}><Icon name="check" size={15}/></button><button className="delete-charge" onClick={() => deleteCharge(charge.id)}><Icon name="trash" size={15}/></button></div></td></tr>)}</tbody></table></div>{!charges.length && <p className="empty-inline">No charges recorded for this admission.</p>}{message.text && <div className={`api-message ${message.type}`}>{message.text}</div>}</section>
      <aside className="card bill-card settlement"><div className="bill-header"><div><span>FINAL SETTLEMENT</span><strong>#{bill?.invoiceNumber || 'Pending'}</strong></div><HospitalLogo className="logo-mini"/></div><div className="summary-line"><span>Gross charges</span><b>{formatMoney(bill?.grossCharges || 0)}</b></div><div className="summary-line"><span>Advance received</span><b className="green-text">− {formatMoney(bill?.advanceReceived || 0)}</b></div><div className="advance-entry"><FormField label="Record new advance"><input aria-label="Advance received" type="number" min="0" value={advanceAmount} onChange={event => setAdvanceAmount(event.target.value)} placeholder="Amount"/></FormField><select value={advanceMode} onChange={event => setAdvanceMode(event.target.value)}><option>CASH</option><option>UPI</option><option>CARD</option></select><button onClick={recordAdvance} disabled={busy || !Number(advanceAmount)}>Record</button></div><div className="charge-row discount"><span>Discount approved</span><label>− ₹ <input type="number" min="0" value={discount} onChange={event => setDiscount(event.target.value)}/></label></div><div className="total-row"><span>Balance payable</span><strong>{formatMoney(balance)}</strong></div><FormField label="Final payment mode"><select value={paymentMode} onChange={event => setPaymentMode(event.target.value)}><option>CASH</option><option>UPI</option><option>CARD</option><option>INSURANCE</option></select></FormField><button className="primary full" disabled={busy || !charges.length || bill?.paymentStatus === 'PAID'} onClick={settleBill}><Icon name="check"/> {bill?.paymentStatus === 'PAID' ? 'Payment settled' : 'Settle final bill'}</button><button className="secondary full" disabled={!bill} onClick={() => printFormatted({ type: 'bill' })}><Icon name="print"/> Print formatted final bill</button></aside></div>}
    {tab === 'discharge' && selectedAdmission && <DischargeSummary admission={selectedAdmission} currentUser={currentUser} onChangePatient={() => setSelectedAdmission(null)} onPrint={form => printFormatted({ type: 'discharge', form })}/>} 
    {chargeDialogOpen && <AddChargeDialog catalog={catalog} busy={busy} onClose={() => setChargeDialogOpen(false)} onAdd={addCharge}/>}</div>
    {printDocument?.type === 'bill' && <IPDFinalBillPrint admission={selectedAdmission} bill={bill} charges={charges} paymentMode={paymentMode}/>} 
    {printDocument?.type === 'discharge' && <IPDDischargePrint admission={selectedAdmission} form={printDocument.form}/>}</>;
}

function AdmissionSearch({ onSelect, mode }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!query.trim()) { setMatches([]); return undefined; }
    let active = true;
    const timer = setTimeout(async () => { setLoading(true); try { const data = await ipdApi.searchAdmissions(query, 'ACTIVE'); if (active) { setMatches(data); setError(''); } } catch (requestError) { if (active) setError(requestError.message); } finally { if (active) setLoading(false); } }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);
  return <section className="card admission-search-card"><div className="search-illustration"><Icon name={mode === 'bill' ? 'rupee' : 'file'} size={25}/></div><h2>Select an IPD admission</h2><p>Search an active admission before continuing.</p><div className="ipd-search-box"><Icon name="search"/><input autoFocus aria-label="Search IPD admission" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && matches.length) onSelect(matches[0]); }} placeholder="Name, UHID, IPD number, mobile, ward or bed..."/>{query && <div className="ipd-search-results">{loading ? <p>Searching…</p> : error ? <p>{error}</p> : matches.length ? matches.map(item => <button key={item.id} onClick={() => onSelect(item)}><span><b>{item.patient.name}</b><small>{item.ipdNumber} · {item.ward} / {item.bedNumber}</small></span><Icon name="chevron" size={15}/></button>) : <p>No active admission found</p>}</div>}</div></section>;
}

function IPDRegistration({ onCreated, setParentMessage }) {
  const [form, setForm] = useState(emptyAdmission);
  const [patient, setPatient] = useState(null);
  const [query, setQuery] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [validationMessage, setValidationMessage] = useState('');
  const { patients, loading, error } = usePatientSearch(query);
  useEffect(() => { doctorApi.list(true).then(data => { setDoctors(data); if (data.length) setForm(current => ({ ...current, consultantId: String(data[0].id) })); }).catch(requestError => setParentMessage({ type: 'error', text: requestError.message })); }, [setParentMessage]);
  const update = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
    setFieldErrors(current => ({ ...current, [field]: '' }));
    setValidationMessage('');
  };
  const choosePatient = item => { setPatient(item); update('patientId', item.id); setQuery(''); };
  const validate = () => {
    const mobile = form.attendantMobile.replace(/\D/g, '');
    const errors = {};
    if (!form.patientId) errors.patientId = 'Search and select a registered patient.';
    if (!form.admissionDate) errors.admissionDate = 'Select the admission date.';
    if (!form.admissionTime) errors.admissionTime = 'Select the admission time.';
    if (!form.consultantId) errors.consultantId = 'Select a consulting doctor.';
    if (!form.ward.trim()) errors.ward = 'Select a ward.';
    if (!form.bedNumber.trim()) errors.bedNumber = 'Enter the assigned bed number.';
    if (!form.provisionalDiagnosis.trim()) errors.provisionalDiagnosis = 'Enter the provisional diagnosis.';
    if (!form.attendantName.trim()) errors.attendantName = 'Enter the attendant name.';
    if (!mobile) errors.attendantMobile = 'Enter the attendant mobile number.';
    else if (!/^\d{10,15}$/.test(mobile)) errors.attendantMobile = 'Enter 10 to 15 digits only, without spaces or country-code symbols.';
    setFieldErrors(errors);
    const firstField = Object.keys(errors)[0];
    if (firstField) {
      setValidationMessage(`Please correct ${Object.keys(errors).length} highlighted field${Object.keys(errors).length === 1 ? '' : 's'} before admission.`);
      window.setTimeout(() => document.getElementById(`ipd-${firstField}`)?.focus(), 0);
      return false;
    }
    return true;
  };
  const submit = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const created = await ipdApi.createAdmission({ patientId: Number(form.patientId), admissionType: form.admissionType, admissionDate: form.admissionDate, admissionTime: form.admissionTime, consultantId: Number(form.consultantId), ward: form.ward, bedNumber: form.bedNumber, provisionalDiagnosis: form.provisionalDiagnosis, attendant: { name: form.attendantName, mobile: form.attendantMobile.replace(/\D/g, '') } });
      onCreated(created);
      setParentMessage({ type: 'success', text: `Admission ${created.ipdNumber} completed.` });
    } catch (requestError) { setParentMessage({ type: 'error', text: requestError.message }); }
    finally { setBusy(false); }
  };
  const inputState = field => ({ id: `ipd-${field}`, className: fieldErrors[field] ? 'invalid' : '', 'aria-invalid': Boolean(fieldErrors[field]), 'aria-describedby': fieldErrors[field] ? `ipd-${field}-error` : undefined });
  const errorFor = field => fieldErrors[field] && <small id={`ipd-${field}-error`} className="field-error">{fieldErrors[field]}</small>;
  return <section className="card form-card ipd-registration">
    <SectionTitle step="01" title="Patient admission" description="Register a patient for inpatient care"/>
    <div className={`patient-lookup ${fieldErrors.patientId ? 'invalid' : ''}`}><Icon name="search"/><input aria-label="Find patient for IPD registration" value={query} onChange={event => { setQuery(event.target.value); setFieldErrors(current => ({ ...current, patientId: '' })); }} placeholder={patient ? `${patient.name} · ${patient.uhid}` : 'Find registered patient...'}/>{query && <div className="patient-results">{loading ? <p>Searching…</p> : error ? <p>{error}</p> : patients.map(item => <button type="button" key={item.id} onClick={() => choosePatient(item)}><span><b>{item.name}</b><small>{item.uhid} · {item.mobile}</small></span></button>)}</div>}</div>
    <p className="lookup-hint">Patients must be registered before IPD admission.</p>
    <div className="form-grid">
      <FormField label="Selected patient" required><input {...inputState('patientId')} value={patient?.name || ''} readOnly/>{errorFor('patientId')}</FormField>
      <FormField label="Admission type" required><select value={form.admissionType} onChange={event => update('admissionType', event.target.value)}><option>PLANNED</option><option>EMERGENCY</option><option>TRANSFER</option></select></FormField>
      <FormField label="Admission date" required><input {...inputState('admissionDate')} type="date" value={form.admissionDate} onChange={event => update('admissionDate', event.target.value)}/>{errorFor('admissionDate')}</FormField>
      <FormField label="Admission time" required><input {...inputState('admissionTime')} type="time" value={form.admissionTime} onChange={event => update('admissionTime', event.target.value)}/>{errorFor('admissionTime')}</FormField>
      <FormField label="Consulting doctor" required wide><select {...inputState('consultantId')} value={form.consultantId} onChange={event => update('consultantId', event.target.value)}><option value="">Select doctor</option>{doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.name} — {doctor.department}</option>)}</select>{errorFor('consultantId')}</FormField>
      <FormField label="Ward" required><select {...inputState('ward')} value={form.ward} onChange={event => update('ward', event.target.value)}><option>General</option><option>Private</option><option>Deluxe</option><option>ICU</option></select>{errorFor('ward')}</FormField>
      <FormField label="Bed number" required><input {...inputState('bedNumber')} value={form.bedNumber} onChange={event => update('bedNumber', event.target.value)}/>{errorFor('bedNumber')}</FormField>
      <FormField label="Provisional diagnosis" required wide><textarea {...inputState('provisionalDiagnosis')} rows="3" value={form.provisionalDiagnosis} onChange={event => update('provisionalDiagnosis', event.target.value)}/>{errorFor('provisionalDiagnosis')}</FormField>
      <FormField label="Attendant name" required><input {...inputState('attendantName')} value={form.attendantName} onChange={event => update('attendantName', event.target.value)}/>{errorFor('attendantName')}</FormField>
      <FormField label="Attendant mobile" required hint="Enter 10 to 15 digits"><input {...inputState('attendantMobile')} inputMode="numeric" autoComplete="tel" value={form.attendantMobile} onChange={event => update('attendantMobile', event.target.value)} placeholder="Example: 9876543210"/>{errorFor('attendantMobile')}</FormField>
    </div>
    {validationMessage && <div className="validation-summary" role="alert"><Icon name="info" size={16}/>{validationMessage}</div>}
    <div className="form-actions"><button className="primary" disabled={busy} onClick={submit}><Icon name="bed"/> {busy ? 'Admitting…' : 'Complete admission'}</button></div>
  </section>;
}

function AddChargeDialog({ catalog, onClose, onAdd, busy }) {
  const firstCategory = catalog[0];
  const firstService = firstCategory?.services?.[0];
  const [charge, setCharge] = useState({ category: firstCategory?.category || 'OTHER', department: firstService?.department || 'Inpatient Services', serviceCode: firstService?.code || null, description: firstService?.name || '', quantity: 1, rate: firstService?.defaultRate || '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const changeCategory = category => { const item = catalog.find(entry => entry.category === category); const service = item?.services?.[0]; setCharge(current => ({ ...current, category, department: service?.department || '', serviceCode: service?.code || null, description: service?.name || '', rate: service?.defaultRate || '' })); };
  const services = catalog.find(item => item.category === charge.category)?.services || [];
  const changeService = code => { const service = services.find(item => item.code === code); if (service) setCharge(current => ({ ...current, serviceCode: service.code, description: service.name, department: service.department, rate: service.defaultRate })); };
  const update = (field, value) => { setCharge(current => ({ ...current, [field]: value })); setFieldErrors(current => ({ ...current, [field]: '' })); };
  const submit = () => {
    const errors = {};
    if (!charge.department.trim()) errors.department = 'Enter the billing department.';
    if (!charge.description.trim()) errors.description = 'Enter the charge description.';
    if (!(Number(charge.quantity) > 0)) errors.quantity = 'Quantity must be greater than zero.';
    if (Number(charge.rate) < 0 || charge.rate === '') errors.rate = 'Rate must be zero or greater.';
    setFieldErrors(errors);
    const firstField = Object.keys(errors)[0];
    if (firstField) { window.setTimeout(() => document.getElementById(`charge-${firstField}`)?.focus(), 0); return; }
    onAdd({ ...charge, quantity: Number(charge.quantity), rate: Number(charge.rate) });
  };
  const errorFor = field => fieldErrors[field] && <small className="field-error">{fieldErrors[field]}</small>;
  return <div className="dialog-backdrop"><div className="charge-dialog" role="dialog" aria-modal="true" aria-labelledby="add-charge-title">
    <div className="dialog-header"><div><h2 id="add-charge-title">Add billing charge</h2><p>Charges are saved to the selected IPD admission</p></div><button onClick={onClose}>×</button></div>
    <div className="dialog-body"><div className="form-grid">
      <FormField label="Category" required><select value={charge.category} onChange={event => changeCategory(event.target.value)}>{catalog.map(item => <option key={item.category} value={item.category}>{item.label}</option>)}</select></FormField>
      <FormField label="Service"><select value={charge.serviceCode || ''} onChange={event => changeService(event.target.value)}><option value="">Custom service</option>{services.map(service => <option key={service.code} value={service.code}>{service.name}</option>)}</select></FormField>
      <FormField label="Department" required><input id="charge-department" className={fieldErrors.department ? 'invalid' : ''} value={charge.department} onChange={event => update('department', event.target.value)}/>{errorFor('department')}</FormField>
      <FormField label="Description" required><input id="charge-description" className={fieldErrors.description ? 'invalid' : ''} value={charge.description} onChange={event => update('description', event.target.value)}/>{errorFor('description')}</FormField>
      <FormField label="Quantity" required><input id="charge-quantity" className={fieldErrors.quantity ? 'invalid' : ''} type="number" min="0.01" value={charge.quantity} onChange={event => update('quantity', event.target.value)}/>{errorFor('quantity')}</FormField>
      <FormField label="Rate" required><input id="charge-rate" className={fieldErrors.rate ? 'invalid' : ''} type="number" min="0" value={charge.rate} onChange={event => update('rate', event.target.value)}/>{errorFor('rate')}</FormField>
    </div></div>
    <div className="dialog-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy} onClick={submit}>Add to bill</button></div>
  </div></div>;
}

function PatientBanner({ admission }) { return <div className="patient-banner card"><div className="avatar patient-photo">{admission.patient.name.split(' ').map(word => word[0]).slice(0, 2).join('')}</div><div className="patient-primary"><span>IPD PATIENT</span><h2>{admission.patient.name} <Status>{admission.status}</Status></h2><p>{admission.patient.uhid} · {admission.patient.gender} · <b>{admission.ipdNumber}</b></p></div><div className="patient-stat"><small>Ward / Bed</small><strong>{admission.ward} · {admission.bedNumber}</strong></div><div className="patient-stat"><small>Consultant</small><strong>{admission.consultant.name}</strong></div></div>; }

function DischargeSummary({ admission, currentUser, onChangePatient, onPrint }) {
  const [form, setForm] = useState({ dischargeDateTime: `${currentDate()}T16:00:00+05:30`, dischargeType: 'ROUTINE', finalDiagnosis: admission.provisionalDiagnosis || '', clinicalSummary: '', advice: '', followUpDate: '', followUpDoctorId: admission.consultant.id });
  const [message, setMessage] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const update = (field, value) => { setForm(current => ({ ...current, [field]: value })); setFieldErrors(current => ({ ...current, [field]: '' })); };
  const validate = () => {
    const errors = {};
    if (!form.finalDiagnosis.trim()) errors.finalDiagnosis = 'Enter the final diagnosis.';
    if (!form.clinicalSummary.trim()) errors.clinicalSummary = 'Enter the clinical summary.';
    setFieldErrors(errors);
    const firstField = Object.keys(errors)[0];
    if (firstField) {
      setMessage({ type: 'error', text: errors[firstField] });
      window.setTimeout(() => document.getElementById(`discharge-${firstField}`)?.focus(), 0);
      return false;
    }
    return true;
  };
  const save = async finalize => { if (!validate()) return; setBusy(true); try { await ipdApi.saveDischarge(admission.id, { ...form, followUpDate: form.followUpDate || null, medications: [] }); if (finalize) await ipdApi.finalizeDischarge(admission.id, currentUser.id); setMessage({ type: 'success', text: finalize ? 'Patient discharged successfully.' : 'Discharge draft saved.' }); } catch (error) { setMessage({ type: 'error', text: error.message }); } finally { setBusy(false); } };
  const print = () => { if (validate()) onPrint(form); };
  return <section className="card form-card discharge">
    <div className="selected-toolbar"><button onClick={onChangePatient}><Icon name="search"/> Select another admission</button></div>
    <SectionTitle step="02" title="Discharge summary" description={`Complete the clinical summary for ${admission.patient.name}`}/>
    <div className="form-grid">
      <FormField label="Discharge type" required><select value={form.dischargeType} onChange={event => update('dischargeType', event.target.value)}><option>ROUTINE</option><option>LAMA</option><option>TRANSFER</option><option>DEATH</option></select></FormField>
      <FormField label="Follow-up date"><input type="date" value={form.followUpDate} onChange={event => update('followUpDate', event.target.value)}/></FormField>
      <FormField label="Final diagnosis" required wide><textarea id="discharge-finalDiagnosis" className={fieldErrors.finalDiagnosis ? 'invalid' : ''} rows="2" value={form.finalDiagnosis} onChange={event => update('finalDiagnosis', event.target.value)}/>{fieldErrors.finalDiagnosis && <small className="field-error">{fieldErrors.finalDiagnosis}</small>}</FormField>
      <FormField label="Clinical summary" required wide><textarea id="discharge-clinicalSummary" className={fieldErrors.clinicalSummary ? 'invalid' : ''} rows="5" value={form.clinicalSummary} onChange={event => update('clinicalSummary', event.target.value)}/>{fieldErrors.clinicalSummary && <small className="field-error">{fieldErrors.clinicalSummary}</small>}</FormField>
      <FormField label="Advice & follow-up" wide><textarea rows="4" value={form.advice} onChange={event => update('advice', event.target.value)}/></FormField>
    </div>
    {message.text && <div className={`api-message ${message.type}`}>{message.text}</div>}
    <div className="form-actions"><button className="secondary" disabled={busy} onClick={() => save(false)}>Save draft</button><button className="primary" disabled={busy} onClick={() => save(true)}><Icon name="check"/> Finalize discharge</button><button className="secondary" onClick={print}><Icon name="print"/> Print formatted discharge</button></div>
  </section>;
}

function IPDFinalBillPrint({ admission, bill, charges, paymentMode }) {
  const items = bill?.charges?.length ? bill.charges : charges;
  return <article className="print-receipt ipd-final-print">
    <HospitalPrintHeader/>
    <div className="receipt-title">IPD FINAL BILL & PAYMENT RECEIPT</div>
    <section className="receipt-details"><div><p><b>Patient:</b> {admission?.patient?.name || '—'}</p><p><b>UHID:</b> {admission?.patient?.uhid || '—'}</p><p><b>IPD No.:</b> {admission?.ipdNumber || '—'}</p><p><b>Age / Gender:</b> {admission?.patient?.age ?? '—'} / {admission?.patient?.gender || '—'}</p><p><b>Mobile:</b> {admission?.patient?.mobile ? `+91 ${admission.patient.mobile}` : '—'}</p><p><b>Ward / Bed:</b> {admission?.ward || '—'} / {admission?.bedNumber || '—'}</p></div><div><p><b>Invoice No.:</b> {bill?.invoiceNumber || 'Pending'}</p><p><b>Invoice Date:</b> {bill?.settledAt ? new Date(bill.settledAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN')}</p><p><b>Admission:</b> {admission?.admissionDateTime?.replace('T', ' ') || '—'}</p><p><b>Admission Type:</b> {admission?.admissionType || '—'}</p><p><b>Consultant:</b> {admission?.consultant?.name || '—'}</p><p><b>Payment:</b> {bill?.paymentMode || paymentMode} / {bill?.paymentStatus || 'PENDING'}</p></div></section>
    <table className="receipt-table ipd-print-table"><thead><tr><th>S.No.</th><th>Particular</th><th>Category</th><th>Qty</th><th>Rate</th><th>Amount (₹)</th></tr></thead><tbody>{items.map((charge, index) => <tr key={charge.id || index}><td>{index + 1}</td><td>{charge.description}<small>{charge.department}</small></td><td>{charge.category}</td><td>{Number(charge.quantity).toFixed(2)}</td><td>{Number(charge.rate).toFixed(2)}</td><td>{Number(charge.amount ?? Number(charge.quantity) * Number(charge.rate)).toFixed(2)}</td></tr>)}<tr className="receipt-summary-row"><td colSpan="5">Gross Charges</td><td>{Number(bill?.grossCharges || 0).toFixed(2)}</td></tr><tr className="receipt-summary-row"><td colSpan="5">Advance Received</td><td>− {Number(bill?.advanceReceived || 0).toFixed(2)}</td></tr><tr className="receipt-summary-row"><td colSpan="5">Discount</td><td>− {Number(bill?.discount || 0).toFixed(2)}</td></tr><tr className="receipt-total"><td colSpan="5">Paid Amount</td><td>₹{Number(bill?.paidAmount || 0).toFixed(2)}</td></tr><tr className="receipt-summary-row"><td colSpan="5">Balance Payable</td><td>₹{Number(bill?.balancePayable || 0).toFixed(2)}</td></tr></tbody></table>
    <div className="receipt-paid-note">Received with thanks <b>{formatMoney(bill?.paidAmount || 0)}</b> from <b>{admission?.patient?.name || 'the patient'}</b>.</div>
    <IPDPrintFooter text="Please retain this final bill for insurance and hospital records."/>
  </article>;
}

function IPDDischargePrint({ admission, form }) {
  return <article className="print-receipt ipd-discharge-print">
    <HospitalPrintHeader/>
    <div className="receipt-title">IPD DISCHARGE SUMMARY</div>
    <section className="receipt-details"><div><p><b>Patient:</b> {admission?.patient?.name || '—'}</p><p><b>UHID:</b> {admission?.patient?.uhid || '—'}</p><p><b>IPD No.:</b> {admission?.ipdNumber || '—'}</p><p><b>Age / Gender:</b> {admission?.patient?.age ?? '—'} / {admission?.patient?.gender || '—'}</p><p><b>Ward / Bed:</b> {admission?.ward || '—'} / {admission?.bedNumber || '—'}</p></div><div><p><b>Consultant:</b> {admission?.consultant?.name || '—'}</p><p><b>Admission:</b> {admission?.admissionDateTime?.replace('T', ' ') || '—'}</p><p><b>Discharge:</b> {form?.dischargeDateTime?.replace('T', ' ') || '—'}</p><p><b>Discharge Type:</b> {form?.dischargeType || '—'}</p><p><b>Follow-up Date:</b> {form?.followUpDate || 'As advised'}</p></div></section>
    <section className="discharge-print-section"><h3>Provisional diagnosis</h3><p>{admission?.provisionalDiagnosis || '—'}</p></section>
    <section className="discharge-print-section"><h3>Final diagnosis</h3><p>{form?.finalDiagnosis || '—'}</p></section>
    <section className="discharge-print-section"><h3>Clinical summary</h3><p>{form?.clinicalSummary || '—'}</p></section>
    <section className="discharge-print-section"><h3>Advice and follow-up</h3><p>{form?.advice || 'Follow treating consultant instructions.'}</p></section>
    <IPDPrintFooter text="Seek immediate medical attention if symptoms worsen." signature="Consultant Signature"/>
  </article>;
}

function IPDPrintFooter({ text, signature = 'Authorized Signature' }) {
  return <footer className="receipt-footer"><div><p>This is a computer-generated hospital document.</p><p>{text}</p></div><div className="signature">{signature}</div></footer>;
}
