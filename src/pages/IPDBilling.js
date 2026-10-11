import { AdmissionDates } from '../components/AdmissionDates';
import { useEffect, useState } from 'react';
import { Icon } from '../components/Icon';
import { HospitalLogo } from '../components/HospitalLogo';
import { HospitalPrintHeader } from '../components/HospitalPrintHeader';
import { FormField, SectionTitle, Status } from '../components/ui/FormField';
import { LabChargesSection, LabTestsDialog, PharmacyChargesSection, PharmacyItemsDialog, ServiceChargesSection } from '../components/IPDChargeSections';
import { daycareApi, doctorApi, ipdApi, labApi } from '../api/services';
import { usePatientSearch } from '../hooks/usePatientSearch';
import { formatMoney } from '../data/hospitalData';

const currentDate = () => new Date().toLocaleDateString('en-CA');
export const currentSystemTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};
const printDateTime = value => value
  ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  : '—';
export const createEmptyAdmission = (defaultWard = 'General') => ({ patientId: '', admissionType: 'PLANNED', admissionDate: currentDate(), admissionTime: currentSystemTime(), consultantId: '', ward: defaultWard, bedNumber: '', provisionalDiagnosis: '', attendantName: '', attendantMobile: '' });

export const IPD_CONFIG = {
  api: ipdApi, key: 'ipd', shortName: 'IPD', patientLabel: 'IPD PATIENT',
  registrationTitle: 'Patient admission', registrationDescription: 'Register a patient for inpatient care',
  defaultWard: 'General', wards: ['General', 'Private', 'Deluxe', 'ICU'],
  wardLabel: 'Ward', bedLabel: 'Bed number', locationLabel: 'Ward / Bed',
  completionTab: 'Discharge summary', completionTitle: 'Discharge summary', completionAction: 'Finalize discharge',
};

export const DAYCARE_CONFIG = {
  api: daycareApi, key: 'daycare', shortName: 'Daycare', patientLabel: 'DAYCARE PATIENT',
  registrationTitle: 'Daycare admission', registrationDescription: 'Register a patient for same-day treatment or observation',
  defaultWard: 'Daycare', wards: ['Daycare', 'Procedure Room', 'Observation', 'Dialysis', 'Chemotherapy'],
  wardLabel: 'Daycare unit', bedLabel: 'Chair / bed number', locationLabel: 'Unit / Chair-Bed',
  completionTab: 'Completion summary', completionTitle: 'Daycare completion summary', completionAction: 'Complete daycare visit',
};

export function IPDBilling({ currentUser }) {
  return <AdmissionBilling currentUser={currentUser} config={IPD_CONFIG}/>;
}

export function DaycareBilling({ currentUser }) {
  return <AdmissionBilling currentUser={currentUser} config={DAYCARE_CONFIG}/>;
}

function AdmissionBilling({ currentUser, config }) {
  const admissionApi = config.api;
  const [tab, setTab] = useState('registration');
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [charges, setCharges] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [labTests, setLabTests] = useState([]);
  const [bill, setBill] = useState(null);
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [labDialogOpen, setLabDialogOpen] = useState(false);
  const [pharmacyDialogOpen, setPharmacyDialogOpen] = useState(false);
  const [datesDirty, setDatesDirty] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceMode, setAdvanceMode] = useState('CASH');
  const [discount, setDiscount] = useState(0);
  const [sectionDiscounts, setSectionDiscounts] = useState({ hospitalDiscount: 0, laboratoryDiscount: 0, pharmacyDiscount: 0 });
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [printDocument, setPrintDocument] = useState(null);

  useEffect(() => { admissionApi.catalog().then(setCatalog).catch(error => setMessage({ type: 'error', text: error.message })); }, [admissionApi]);
  useEffect(() => { labApi.tests('', undefined, true).then(setLabTests).catch(error => setMessage({ type: 'error', text: error.message })); }, []);

  const loadBilling = async admission => {
    setSelectedAdmission(admission);
    setDatesDirty(false);
    setCharges([]);
    setBill(null);
    setBusy(true);
    setMessage({ type: '', text: '' });
    try {
      const [chargeData, billData] = await Promise.all([admissionApi.charges(admission.id), admissionApi.finalBill(admission.id)]);
      setCharges(chargeData.charges || []);
      setBill(billData);
      const discounts = { hospitalDiscount: Number(billData.hospitalDiscount || 0), laboratoryDiscount: Number(billData.laboratoryDiscount || 0), pharmacyDiscount: Number(billData.pharmacyDiscount || 0) };
      setSectionDiscounts(discounts);
      setDiscount(Math.max(0, Number(billData.discount || 0) - Object.values(discounts).reduce((sum, value) => sum + value, 0)));
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };

  const addCharge = async charge => {
    setBusy(true);
    try {
      const created = await admissionApi.addCharge(selectedAdmission.id, charge);
      setCharges(current => [...current, created]);
      setChargeDialogOpen(false);
      setBill(await admissionApi.finalBill(selectedAdmission.id));
      setMessage({ type: 'success', text: 'Charge added successfully.' });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };

  const addSpecialCharges = async (items, closeDialog, successText) => {
    setBusy(true);
    try {
      const outcomes = await Promise.allSettled(items.map(item => admissionApi.addCharge(selectedAdmission.id, item)));
      const created = outcomes.filter(item => item.status === 'fulfilled').map(item => item.value);
      const failed = outcomes.find(item => item.status === 'rejected');
      setCharges(current => [...current, ...created]);
      closeDialog(false);
      setBill(await admissionApi.finalBill(selectedAdmission.id));
      setMessage(failed ? { type: 'error', text: `${created.length} item(s) added. ${failed.reason.message}` } : { type: 'success', text: successText });
    } catch (error) {
      const current = await admissionApi.charges(selectedAdmission.id).catch(() => null);
      if (current) setCharges(previous => (current.charges || []).map(charge => previous.find(item => item.id === charge.id && item.dirty) || charge));
      setBill(await admissionApi.finalBill(selectedAdmission.id).catch(() => bill));
      setMessage({ type: 'error', text: error.message });
    } finally { setBusy(false); }
  };

  const addLabTests = tests => addSpecialCharges(
    tests.map(test => ({ category: 'LAB_TESTS', department: test.department || 'Laboratory', description: test.name, quantity: 1, labTestId: test.id })),
    setLabDialogOpen,
    `${tests.length} lab test${tests.length === 1 ? '' : 's'} added to the final bill.`
  );
  const addPharmacyItems = items => addSpecialCharges(
    items.map(item => ({ category: 'PHARMACY', department: 'Pharmacy', description: item.description, quantity: item.quantity, rate: item.rate })),
    setPharmacyDialogOpen,
    `${items.length} pharmacy item${items.length === 1 ? '' : 's'} added to the final bill.`
  );

  const updateChargeLocal = (id, field, value) => setCharges(current => current.map(charge => charge.id === id ? { ...charge, [field]: value, dirty: true } : charge));
  const applyServiceToCharge = (chargeId, category, service) => setCharges(current => current.map(charge => charge.id === chargeId ? { ...charge, category, description: service.name, department: service.department, rate: service.defaultRate, dirty: true } : charge));
  const changeSavedChargeCategory = (chargeId, category) => {
    const service = catalog.find(item => item.category === category)?.services?.[0];
    if (service) applyServiceToCharge(chargeId, category, service);
  };
  const changeSavedChargeService = (chargeId, category, serviceIndex) => {
    const service = catalog.find(item => item.category === category)?.services?.[Number(serviceIndex)];
    if (service) applyServiceToCharge(chargeId, category, service);
  };
  const saveCharge = async charge => {
    setBusy(true);
    try {
      const labTest = charge.category === 'LAB_TESTS' ? labTests.find(test => test.id === Number(charge.labTestId) || (test.name === charge.description && test.department === charge.department)) : null;
      const body = charge.category === 'LAB_TESTS'
        ? { category: 'LAB_TESTS', department: labTest?.department || charge.department, description: labTest?.name || charge.description, quantity: 1, labTestId: labTest?.id }
        : charge.category === 'PHARMACY'
          ? { category: 'PHARMACY', department: 'Pharmacy', description: charge.description, quantity: Number(charge.quantity), rate: Number(charge.rate) }
          : { category: charge.category, department: charge.department, description: charge.description, quantity: Number(charge.quantity) };
      const updated = await admissionApi.updateCharge(selectedAdmission.id, charge.id, body);
      setCharges(current => current.map(item => item.id === updated.id ? updated : item));
      setBill(await admissionApi.finalBill(selectedAdmission.id));
      setMessage({ type: 'success', text: 'Charge updated.' });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };
  const changeLabCharge = (chargeId, test) => setCharges(current => current.map(charge => charge.id === chargeId ? { ...charge, labTestId: test.id, department: test.department || 'Laboratory', description: test.name, quantity: 1, rate: test.price, amount: test.price, dirty: true } : charge));
  const deleteCharge = async chargeId => {
    setBusy(true);
    try {
      await admissionApi.deleteCharge(selectedAdmission.id, chargeId);
      setCharges(current => current.filter(charge => charge.id !== chargeId));
      setBill(await admissionApi.finalBill(selectedAdmission.id));
      setMessage({ type: 'success', text: 'Charge deleted.' });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };

  const recordAdvance = async () => {
    if (!Number(advanceAmount)) return;
    setBusy(true);
    try {
      const receipt = await admissionApi.addAdvance(selectedAdmission.id, { amount: Number(advanceAmount), paymentMode: advanceMode, referenceNumber: null, remarks: `${config.shortName} advance` });
      setAdvanceAmount('');
      setBill(await admissionApi.finalBill(selectedAdmission.id));
      setMessage({ type: 'success', text: `Advance recorded: ${receipt.receiptNumber}` });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };

  const settleBill = async () => {
    setBusy(true);
    try {
      const settled = await admissionApi.settle(selectedAdmission.id, { dischargeDateTime: selectedAdmission.dischargeDateTime || null, ...sectionDiscounts, discount: totalDiscount, discountReason: 'Approved during final settlement', paymentMode, paidAmount: Math.max(0, Math.round((grossCharges - Number(bill?.advanceReceived || 0) - totalDiscount) * 100) / 100), paymentReference: null });
      setBill(settled);
      setMessage({ type: 'success', text: `Final bill ${settled.invoiceNumber} settled.` });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  };

  const changeTab = value => { setDatesDirty(false); setTab(value); if (value === 'registration') setSelectedAdmission(null); };
  const grossCharges = charges.reduce((sum, charge) => sum + Math.round(Number(charge.quantity || 0) * Number(charge.rate || 0) * 100), 0) / 100;
  const groupGross = { hospitalDiscount: 0, laboratoryDiscount: 0, pharmacyDiscount: 0 };
  charges.forEach(charge => { const key = charge.category === 'LAB_TESTS' ? 'laboratoryDiscount' : charge.category === 'PHARMACY' ? 'pharmacyDiscount' : 'hospitalDiscount'; groupGross[key] += Math.round(Number(charge.quantity || 0) * Number(charge.rate || 0) * 100) / 100; });
  const totalDiscount = Math.round((Number(discount || 0) + Object.values(sectionDiscounts).reduce((sum, value) => sum + Number(value || 0), 0)) * 100) / 100;
  const invalidDiscount = !Number.isFinite(totalDiscount) || Number(discount) < 0 || totalDiscount > grossCharges || Object.entries(sectionDiscounts).some(([key, value]) => Number(value) < 0 || Number(value) > Math.round(groupGross[key] * 100) / 100);
  const discountField = (key, label) => <div className="section-discount"><label>{label} discount (INR)<input aria-label={label + ' discount'} type="number" min="0" max={groupGross[key]} step="0.01" disabled={busy || Boolean(bill?.settledAt)} value={sectionDiscounts[key]} onChange={event => setSectionDiscounts(current => ({ ...current, [key]: Number(event.target.value) }))}/></label><span>Section total <b>{formatMoney(Math.max(0, groupGross[key] - sectionDiscounts[key]))}</b></span></div>;
  const hasUnsavedCharges = charges.some(charge => charge.dirty);
  const balance = Math.max(0, Math.round((grossCharges - Number(bill?.advanceReceived || 0) - totalDiscount - Number(bill?.paidAmount || 0)) * 100) / 100);
  const printableBill = bill?.settledAt ? bill : { ...bill, charges, grossCharges, discount: totalDiscount, ...sectionDiscounts, balancePayable: balance };
  const printFormatted = document => {
    setPrintDocument(document);
    setTimeout(() => window.print(), 0);
  };

  return <><div className="ipd-screen">{selectedAdmission && tab !== 'registration' && <PatientBanner admission={selectedAdmission} config={config}/>}<div className="tabs ipd-tabs"><button className={tab === 'registration' ? 'active' : ''} onClick={() => changeTab('registration')}>{config.shortName} registration</button><button className={tab === 'bill' ? 'active' : ''} onClick={() => changeTab('bill')}>Final billing</button><button className={tab === 'discharge' ? 'active' : ''} onClick={() => changeTab('discharge')}>{config.completionTab}</button></div>
    {tab === 'registration' && <AdmissionRegistration config={config} onCreated={admission => { setTab('bill'); loadBilling(admission); }} setParentMessage={setMessage}/>}
    {tab === 'registration' && message.text && <div className={`api-message ipd-registration-message ${message.type}`} role={message.type === 'error' ? 'alert' : 'status'}>{message.text}</div>}
    {tab !== 'registration' && !selectedAdmission && <AdmissionSearch mode={tab} onSelect={loadBilling} config={config}/>}
    {tab === 'bill' && selectedAdmission && <div className="page-grid ipd-layout"><section className="card form-card ipd-consolidated-charges"><div className="selected-toolbar"><button onClick={() => setSelectedAdmission(null)}><Icon name="search"/> Select another admission</button></div>{selectedAdmission.dischargeDraft && selectedAdmission.status !== 'DISCHARGED' && <div className="form-actions"><span>Saved summary draft</span><button className="secondary" disabled={busy || datesDirty || hasUnsavedCharges} onClick={() => changeTab('discharge')}>Edit saved draft</button></div>}<AdmissionDates admission={selectedAdmission} api={admissionApi} disabled={busy} onSaved={setSelectedAdmission} onDirty={setDatesDirty}/><SectionTitle step="01" title="Consolidated bill" description="Hospital services, lab tests and pharmacy items are combined in the final bill"/>
      <ServiceChargesSection catalog={catalog} charges={charges.filter(charge => charge.category !== 'LAB_TESTS' && charge.category !== 'PHARMACY')} busy={busy} onAdd={() => setChargeDialogOpen(true)} onChange={updateChargeLocal} onCategoryChange={changeSavedChargeCategory} onServiceChange={changeSavedChargeService} onSave={saveCharge} onDelete={deleteCharge}/>
      {discountField('hospitalDiscount', 'Hospital services')}
      <LabChargesSection tests={labTests} charges={charges.filter(charge => charge.category === 'LAB_TESTS')} busy={busy} onAdd={() => setLabDialogOpen(true)} onChange={changeLabCharge} onSave={saveCharge} onDelete={deleteCharge}/>
      {discountField('laboratoryDiscount', 'Laboratory')}
      <PharmacyChargesSection charges={charges.filter(charge => charge.category === 'PHARMACY')} busy={busy} onAdd={() => setPharmacyDialogOpen(true)} onChange={updateChargeLocal} onSave={saveCharge} onDelete={deleteCharge}/>
      {discountField('pharmacyDiscount', 'Pharmacy')}
      {invalidDiscount && <p role="alert" className="api-message error">Discounts must be non-negative and cannot exceed their section charges or the total bill.</p>}
      {message.text && <div className={`api-message ${message.type}`}>{message.text}</div>}
    </section>
      <aside className="card bill-card settlement">{hasUnsavedCharges && <p className="api-message" role="status">Totals include unsaved changes. Save each edited charge using its checkmark before settling or printing.</p>}<div className="bill-header"><div><span>FINAL SETTLEMENT</span><strong>#{bill?.invoiceNumber || 'Pending'}</strong></div><HospitalLogo className="logo-mini"/></div><div className="summary-line"><span>Gross charges</span><b>{formatMoney(grossCharges)}</b></div><div className="summary-line"><span>Advance received</span><b className="green-text">− {formatMoney(bill?.advanceReceived || 0)}</b></div><div className="advance-entry"><FormField label="Record new advance"><input aria-label="Advance received" type="number" min="0" value={advanceAmount} onChange={event => setAdvanceAmount(event.target.value)} placeholder="Amount"/></FormField><select value={advanceMode} onChange={event => setAdvanceMode(event.target.value)}><option>CASH</option><option>UPI</option><option>CARD</option></select><button onClick={recordAdvance} disabled={busy || !Number(advanceAmount)}>Record</button></div><div className="charge-row discount"><span>Additional bill discount</span><label>− ₹ <input type="number" min="0" step="0.01" disabled={busy || Boolean(bill?.settledAt)} value={discount} onChange={event => setDiscount(event.target.value)}/></label></div><div className="summary-line"><span>Hospital services discount</span><b>{formatMoney(sectionDiscounts.hospitalDiscount)}</b></div><div className="summary-line"><span>Laboratory discount</span><b>{formatMoney(sectionDiscounts.laboratoryDiscount)}</b></div><div className="summary-line"><span>Pharmacy discount</span><b>{formatMoney(sectionDiscounts.pharmacyDiscount)}</b></div><div className="summary-line"><span>Total discount</span><b>{formatMoney(totalDiscount)}</b></div><div className="total-row"><span>Balance payable</span><strong>{formatMoney(balance)}</strong></div><FormField label="Final payment mode"><select value={paymentMode} onChange={event => setPaymentMode(event.target.value)}><option>CASH</option><option>UPI</option><option>CARD</option><option>INSURANCE</option></select></FormField><button className="primary full" disabled={busy || invalidDiscount || datesDirty || !bill || hasUnsavedCharges || !charges.length || bill?.paymentStatus === 'PAID'} onClick={settleBill}><Icon name="check"/> {bill?.paymentStatus === 'PAID' ? 'Payment settled' : 'Settle final bill'}</button><button className="secondary full" disabled={busy || invalidDiscount || !bill || hasUnsavedCharges} onClick={() => printFormatted({ type: 'bill' })}><Icon name="print"/> Print formatted final bill</button></aside></div>}
    {tab === 'discharge' && selectedAdmission && <DischargeSummary key={selectedAdmission.id} onSaved={setSelectedAdmission} admission={selectedAdmission} currentUser={currentUser} admissionApi={admissionApi} config={config} onChangePatient={() => setSelectedAdmission(null)} onPrint={form => printFormatted({ type: 'discharge', form })}/>}
    {chargeDialogOpen && <AddChargeDialog catalog={catalog} busy={busy} config={config} onClose={() => setChargeDialogOpen(false)} onAdd={addCharge}/>}
    {labDialogOpen && <LabTestsDialog tests={labTests} busy={busy} onClose={() => setLabDialogOpen(false)} onAdd={addLabTests}/>}
    {pharmacyDialogOpen && <PharmacyItemsDialog busy={busy} onClose={() => setPharmacyDialogOpen(false)} onAdd={addPharmacyItems}/>}</div>
    {printDocument?.type === 'bill' && <IPDFinalBillPrint admission={selectedAdmission} bill={printableBill} charges={charges} paymentMode={paymentMode} config={config}/>}
    {printDocument?.type === 'discharge' && <IPDDischargePrint admission={selectedAdmission} form={printDocument.form} config={config}/>}</>;
}

function AdmissionSearch({ onSelect, mode, config }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => { setLoading(true); try { const groups = await Promise.all(['ACTIVE', 'DISCHARGE_PLANNED'].map(status => config.api.searchAdmissions(query, status))); const data = [...new Map(groups.flat().map(item => [item.id, item])).values()]; if (active) { setMatches(data); setError(''); } } catch (requestError) { if (active) setError(requestError.message); } finally { if (active) setLoading(false); } }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, config]);
  return <section className="card admission-search-card"><div className="search-illustration"><Icon name={mode === 'bill' ? 'rupee' : 'file'} size={25}/></div><h2>Select a {config.shortName} admission</h2><p>Select an active admission or saved draft to continue billing and edit its summary.</p><div className="ipd-search-box"><Icon name="search"/><input autoFocus aria-label={`Search ${config.shortName} admission`} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && matches.length) onSelect(matches[0]); }} placeholder={`Name, UHID, ${config.shortName} number, mobile or location...`}/>{<div className="ipd-search-results">{loading ? <p>Searching…</p> : error ? <p>{error}</p> : matches.length ? matches.map(item => <button key={item.id} onClick={() => onSelect(item)}><span><b>{item.patient.name}</b><small>{item.ipdNumber} {item.dischargeDraft ? ' - Saved draft' : ' - Active admission'}</small></span><Icon name="chevron" size={15}/></button>) : <p>No active admissions or saved drafts found</p>}</div>}</div></section>;
}

function AdmissionRegistration({ onCreated, setParentMessage, config }) {
  const [form, setForm] = useState(() => createEmptyAdmission(config.defaultWard));
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
    if (!form.ward.trim()) errors.ward = `Select a ${config.wardLabel.toLowerCase()}.`;
    if (!form.bedNumber.trim()) errors.bedNumber = `Enter the assigned ${config.bedLabel.toLowerCase()}.`;
    if (!form.provisionalDiagnosis.trim()) errors.provisionalDiagnosis = 'Enter the provisional diagnosis.';
    if (!form.attendantName.trim()) errors.attendantName = 'Enter the attendant name.';
    if (!mobile) errors.attendantMobile = 'Enter the attendant mobile number.';
    else if (!/^\d{10,15}$/.test(mobile)) errors.attendantMobile = 'Enter 10 to 15 digits only, without spaces or country-code symbols.';
    setFieldErrors(errors);
    const firstField = Object.keys(errors)[0];
    if (firstField) {
      setValidationMessage(`Please correct ${Object.keys(errors).length} highlighted field${Object.keys(errors).length === 1 ? '' : 's'} before admission.`);
      window.setTimeout(() => document.getElementById(`${config.key}-${firstField}`)?.focus(), 0);
      return false;
    }
    return true;
  };
  const submit = async () => {
    if (!validate()) return;
    setParentMessage({ type: '', text: '' });
    setBusy(true);
    try {
      const created = await config.api.createAdmission({ patientId: Number(form.patientId), admissionType: form.admissionType, admissionDate: form.admissionDate, admissionTime: form.admissionTime, consultantId: Number(form.consultantId), ward: form.ward, bedNumber: form.bedNumber, provisionalDiagnosis: form.provisionalDiagnosis, attendant: { name: form.attendantName, mobile: form.attendantMobile.replace(/\D/g, '') } });
      onCreated(created);
      setParentMessage({ type: 'success', text: `${config.shortName} admission ${created.ipdNumber} completed.` });
    } catch (requestError) { setParentMessage({ type: 'error', text: requestError.message }); }
    finally { setBusy(false); }
  };
  const inputState = field => ({ id: `${config.key}-${field}`, className: fieldErrors[field] ? 'invalid' : '', 'aria-invalid': Boolean(fieldErrors[field]), 'aria-describedby': fieldErrors[field] ? `${config.key}-${field}-error` : undefined });
  const errorFor = field => fieldErrors[field] && <small id={`${config.key}-${field}-error`} className="field-error">{fieldErrors[field]}</small>;
  return <form className="card form-card ipd-registration" onSubmit={event => { event.preventDefault(); submit(); }} noValidate>
    <SectionTitle step="01" title={config.registrationTitle} description={config.registrationDescription}/>
    <div className={`patient-lookup ${fieldErrors.patientId ? 'invalid' : ''}`}><Icon name="search"/><input aria-label={`Find patient for ${config.shortName} registration`} value={query} onChange={event => { setQuery(event.target.value); setFieldErrors(current => ({ ...current, patientId: '' })); }} placeholder={patient ? `${patient.name} · ${patient.uhid}` : 'Find registered patient...'}/>{query && <div className="patient-results">{loading ? <p>Searching…</p> : error ? <p>{error}</p> : patients.map(item => <button type="button" key={item.id} onClick={() => choosePatient(item)}><span><b>{item.name}</b><small>{item.uhid} · {item.mobile}</small></span></button>)}</div>}</div>
    <p className="lookup-hint">Patients must be registered before {config.shortName} admission.</p>
    <div className="form-grid">
      <FormField label="Selected patient" required><input {...inputState('patientId')} value={patient?.name || ''} readOnly/>{errorFor('patientId')}</FormField>
      <FormField label="Admission type" required><select value={form.admissionType} onChange={event => update('admissionType', event.target.value)}><option>PLANNED</option><option>EMERGENCY</option><option>TRANSFER</option></select></FormField>
      <FormField label="Admission date" required><input {...inputState('admissionDate')} type="date" value={form.admissionDate} onChange={event => update('admissionDate', event.target.value)}/>{errorFor('admissionDate')}</FormField>
      <FormField label="Admission time" required><input {...inputState('admissionTime')} type="time" value={form.admissionTime} onChange={event => update('admissionTime', event.target.value)}/>{errorFor('admissionTime')}</FormField>
      <FormField label="Consulting doctor" required wide><select {...inputState('consultantId')} value={form.consultantId} onChange={event => update('consultantId', event.target.value)}><option value="">Select doctor</option>{doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select>{errorFor('consultantId')}</FormField>
      <FormField label={config.wardLabel} required><select {...inputState('ward')} value={form.ward} onChange={event => update('ward', event.target.value)}>{config.wards.map(ward => <option key={ward}>{ward}</option>)}</select>{errorFor('ward')}</FormField>
      <FormField label={config.bedLabel} required><input {...inputState('bedNumber')} value={form.bedNumber} onChange={event => update('bedNumber', event.target.value)}/>{errorFor('bedNumber')}</FormField>
      <FormField label="Provisional diagnosis" required wide><textarea {...inputState('provisionalDiagnosis')} rows="3" value={form.provisionalDiagnosis} onChange={event => update('provisionalDiagnosis', event.target.value)}/>{errorFor('provisionalDiagnosis')}</FormField>
      <FormField label="Attendant name" required><input {...inputState('attendantName')} value={form.attendantName} onChange={event => update('attendantName', event.target.value)}/>{errorFor('attendantName')}</FormField>
      <FormField label="Attendant mobile" required hint="Enter 10 to 15 digits"><input {...inputState('attendantMobile')} inputMode="numeric" autoComplete="tel" value={form.attendantMobile} onChange={event => update('attendantMobile', event.target.value)} placeholder="Example: 9876543210"/>{errorFor('attendantMobile')}</FormField>
    </div>
    {validationMessage && <div className="validation-summary" role="alert"><Icon name="info" size={16}/>{validationMessage}</div>}
    <div className="form-actions"><button type="submit" className="primary" disabled={busy}><Icon name="bed"/> {busy ? 'Admitting…' : `Complete ${config.shortName} admission`}</button></div>
  </form>;
}

export function AddChargeDialog({ catalog, onClose, onAdd, busy, config }) {
  const firstCategory = catalog[0];
  const firstService = firstCategory?.services?.[0];
  const [charge, setCharge] = useState({ category: firstCategory?.category || 'OTHER', department: firstService?.department || 'Inpatient Services', description: firstService?.name || '', quantity: 1, rate: firstService?.defaultRate ?? '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const changeCategory = category => { const item = catalog.find(entry => entry.category === category); const service = item?.services?.[0]; setCharge(current => ({ ...current, category, department: service?.department || '', description: service?.name || '', rate: service?.defaultRate ?? '' })); };
  const services = catalog.find(item => item.category === charge.category)?.services || [];
  const changeService = index => { const service = services[Number(index)]; if (service) setCharge(current => ({ ...current, description: service.name, department: service.department, rate: service.defaultRate })); };
  const update = (field, value) => { setCharge(current => ({ ...current, [field]: value })); setFieldErrors(current => ({ ...current, [field]: '' })); };
  const submit = () => {
    const errors = {};
    if (!charge.description) errors.description = 'Select a configured service.';
    if (!(Number(charge.quantity) > 0)) errors.quantity = 'Quantity must be greater than zero.';
    if (Number(charge.rate) < 0 || charge.rate === '') errors.rate = 'The configured amount is unavailable.';
    setFieldErrors(errors);
    const firstField = Object.keys(errors)[0];
    if (firstField) { window.setTimeout(() => document.getElementById(`charge-${firstField}`)?.focus(), 0); return; }
    onAdd({ category: charge.category, department: charge.department, description: charge.description, quantity: Number(charge.quantity) });
  };
  const errorFor = field => fieldErrors[field] && <small className="field-error">{fieldErrors[field]}</small>;
  return <div className="dialog-backdrop"><div className="charge-dialog" role="dialog" aria-modal="true" aria-labelledby="add-charge-title">
    <div className="dialog-header"><div><h2 id="add-charge-title">Add billing charge</h2><p>Charges are saved to the selected {config.shortName} admission</p></div><button onClick={onClose}>×</button></div>
    <div className="dialog-body"><div className="form-grid">
      <FormField label="Category" required><select value={charge.category} onChange={event => changeCategory(event.target.value)}>{catalog.map(item => <option key={item.category} value={item.category}>{item.label}</option>)}</select></FormField>
      <FormField label="Service" required><select id="charge-description" className={fieldErrors.description ? 'invalid' : ''} value={services.findIndex(service => service.name === charge.description && service.department === charge.department)} onChange={event => changeService(event.target.value)}>{services.map((service, index) => <option key={index} value={index}>{service.name}</option>)}</select>{errorFor('description')}</FormField>
      <FormField label="Quantity" required><input id="charge-quantity" className={fieldErrors.quantity ? 'invalid' : ''} type="number" min="0.01" value={charge.quantity} onChange={event => update('quantity', event.target.value)}/>{errorFor('quantity')}</FormField>
      <FormField label="Unit amount (configured by Admin)" required><input id="charge-rate" className={fieldErrors.rate ? 'invalid' : ''} value={formatMoney(charge.rate || 0)} readOnly/>{errorFor('rate')}</FormField>
      <FormField label="Total amount"><input value={formatMoney(Number(charge.quantity || 0) * Number(charge.rate || 0))} readOnly/></FormField>
    </div></div>
    <div className="dialog-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy} onClick={submit}>Add to bill</button></div>
  </div></div>;
}

function PatientBanner({ admission, config }) { return <div className="patient-banner card"><div className="avatar patient-photo">{admission.patient.name.split(' ').map(word => word[0]).slice(0, 2).join('')}</div><div className="patient-primary"><span>{config.patientLabel}</span><h2>{admission.patient.name} <Status>{admission.status}</Status></h2><p>{admission.patient.uhid} · {admission.patient.gender} · <b>{admission.ipdNumber}</b></p></div><div className="patient-stat"><small>Discharge date</small><strong>{admission.dischargeDateTime ? printDateTime(admission.dischargeDateTime) : 'Not recorded'}</strong></div><div className="patient-stat"><small>Consultant</small><strong>{admission.consultant.name}</strong></div></div>; }

export function DischargeSummary({ admission, currentUser, admissionApi, config, onChangePatient, onPrint, onSaved }) {
  const [form, setForm] = useState({ dischargeDateTime: admission.dischargeDateTime || `${currentDate()}T${currentSystemTime()}:00+05:30`, dischargeType: admission.dischargeType || 'ROUTINE', finalDiagnosis: admission.finalDiagnosis ?? admission.provisionalDiagnosis ?? '', clinicalSummary: admission.clinicalSummary || '', advice: admission.advice || '', followUpDate: admission.followUpDate || '', followUpDoctorId: admission.followUpDoctor?.id || admission.consultant.id, medications: admission.medications || [] });
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
  const save = async finalize => { if (!validate()) return; setBusy(true); try { const saved = await admissionApi.saveDischarge(admission.id, { ...form, followUpDate: form.followUpDate || null }); onSaved?.(saved); if (finalize) { const completed = await admissionApi.finalizeDischarge(admission.id, currentUser.id); onSaved?.(completed); } setMessage({ type: 'success', text: finalize ? `${config.shortName} visit completed successfully.` : `${config.completionTitle} draft saved.` }); } catch (error) { setMessage({ type: 'error', text: error.message }); } finally { setBusy(false); } };
  const print = () => { if (validate()) onPrint(form); };
  return <section className="card form-card discharge">
    <div className="selected-toolbar"><button onClick={onChangePatient}><Icon name="search"/> Select another admission</button></div>
    <SectionTitle step="02" title={config.completionTitle} description={`Complete the clinical summary for ${admission.patient.name}`}/>
    <div className="form-grid">
      <FormField label="Discharge type" required><select value={form.dischargeType} onChange={event => update('dischargeType', event.target.value)}><option>ROUTINE</option><option>LAMA</option><option>TRANSFER</option><option>DEATH</option></select></FormField>
      <FormField label="Follow-up date"><input type="date" value={form.followUpDate} onChange={event => update('followUpDate', event.target.value)}/></FormField>
      <FormField label="Final diagnosis" required wide><textarea id="discharge-finalDiagnosis" className={fieldErrors.finalDiagnosis ? 'invalid' : ''} rows="2" value={form.finalDiagnosis} onChange={event => update('finalDiagnosis', event.target.value)}/>{fieldErrors.finalDiagnosis && <small className="field-error">{fieldErrors.finalDiagnosis}</small>}</FormField>
      <FormField label="Clinical summary" required wide><textarea id="discharge-clinicalSummary" className={fieldErrors.clinicalSummary ? 'invalid' : ''} rows="5" value={form.clinicalSummary} onChange={event => update('clinicalSummary', event.target.value)}/>{fieldErrors.clinicalSummary && <small className="field-error">{fieldErrors.clinicalSummary}</small>}</FormField>
      <FormField label="Advice & follow-up" wide><textarea rows="4" value={form.advice} onChange={event => update('advice', event.target.value)}/></FormField>
    </div>
    {message.text && <div className={`api-message ${message.type}`}>{message.text}</div>}
    <div className="form-actions"><button className="secondary" disabled={busy} onClick={() => save(false)}>Save draft</button><button className="primary" disabled={busy} onClick={() => save(true)}><Icon name="check"/> {config.completionAction}</button><button className="secondary" onClick={print}><Icon name="print"/> Print formatted summary</button></div>
  </section>;
}

export function IPDFinalBillPrint({ admission, bill, charges, config }) {
  const items = bill?.charges?.length ? bill.charges : (charges || []);
  const lineAmount = charge => Number(charge.amount ?? Number(charge.quantity) * Number(charge.rate));
  const sections = [
    { title: 'Hospital services', items: items.filter(charge => charge.category !== 'LAB_TESTS' && charge.category !== 'PHARMACY') },
    { title: 'Lab tests', items: items.filter(charge => charge.category === 'LAB_TESTS') },
    { title: 'Pharmacy', items: items.filter(charge => charge.category === 'PHARMACY') },
  ].filter(section => section.items.length);
  const paidAmount = Number(bill?.paidAmount || 0);
  const balancePayable = Number(bill?.balancePayable || 0);
  return <article className="print-receipt ipd-final-print">
    <HospitalPrintHeader/>
    <div className="receipt-title">{paidAmount > 0 ? `${config.shortName.toUpperCase()} FINAL BILL & PAYMENT RECEIPT` : `${config.shortName.toUpperCase()} FINAL BILL`}</div>
    <section className="receipt-details"><div><p><b>Patient:</b> {admission?.patient?.name || '—'}</p><p><b>UHID:</b> {admission?.patient?.uhid || '—'}</p><p><b>{config.shortName} No.:</b> {admission?.ipdNumber || '—'}</p><p><b>Age / Gender:</b> {admission?.patient?.age ?? '—'} / {admission?.patient?.gender || '—'}</p><p><b>Mobile:</b> {admission?.patient?.mobile ? `+91 ${admission.patient.mobile}` : '—'}</p></div><div><p><b>Invoice No.:</b> {bill?.invoiceNumber || 'Pending'}</p><p><b>Invoice Date:</b> {printDateTime(bill?.settledAt || new Date())}</p><p><b>Admission Date:</b> {printDateTime(admission?.admissionDateTime)}</p><p><b>Discharge Date:</b> {admission?.dischargeDateTime ? printDateTime(admission.dischargeDateTime) : 'Not recorded'}</p><p><b>Admission Type:</b> {admission?.admissionType || '—'}</p><p><b>Consultant:</b> {admission?.consultant?.name || '—'}</p></div></section>
    <div className="ipd-bill-sections">{sections.map(section => <section className="ipd-bill-section" key={section.title} aria-label={section.title}>
      <h3>{section.title}<span>{formatMoney(section.items.reduce((sum, charge) => sum + lineAmount(charge), 0))}</span></h3>
      <ul>{section.items.map((charge, index) => <li key={charge.id || index}>
        <span className="ipd-bill-item-name">{charge.description}</span>
        <span className="ipd-bill-item-calculation">{Number(charge.quantity)} × {formatMoney(charge.rate)}</span>
        <strong>{formatMoney(lineAmount(charge))}</strong>
      </li>)}</ul>
    </section>)}</div>
    <dl className="ipd-bill-summary" aria-label="Payment summary">
      <div><dt>Gross charges</dt><dd>{formatMoney(bill?.grossCharges || 0)}</dd></div>
      {Number(bill?.advanceReceived || 0) > 0 && <div><dt>Advance received</dt><dd>− {formatMoney(bill.advanceReceived)}</dd></div>}
      {Number(bill?.hospitalDiscount || 0) > 0 && <div><dt>Hospital services discount</dt><dd>- {formatMoney(bill.hospitalDiscount)}</dd></div>}
      {Number(bill?.laboratoryDiscount || 0) > 0 && <div><dt>Laboratory discount</dt><dd>- {formatMoney(bill.laboratoryDiscount)}</dd></div>}
      {Number(bill?.pharmacyDiscount || 0) > 0 && <div><dt>Pharmacy discount</dt><dd>- {formatMoney(bill.pharmacyDiscount)}</dd></div>}
      {Number(bill?.discount || 0) > 0 && <div><dt>Discount (total)</dt><dd>− {formatMoney(bill.discount)}</dd></div>}
      {paidAmount > 0 && <div><dt>Paid amount</dt><dd>{formatMoney(paidAmount)}</dd></div>}
      <div className="ipd-bill-balance"><dt>Balance payable</dt><dd>{formatMoney(balancePayable)}</dd></div>
    </dl>
    <div className={`receipt-paid-note ${paidAmount > 0 ? '' : 'payment-pending-note'}`}>{paidAmount > 0 ? <>Received with thanks <b>{formatMoney(paidAmount)}</b> from <b>{admission?.patient?.name || 'the patient'}</b>.</> : <>Payment pending. Balance payable: <b>{formatMoney(balancePayable)}</b>.</>}</div>
  </article>;
}

export function IPDDischargePrint({ admission, form, config }) {
  return <article className="print-receipt ipd-discharge-print">
    <HospitalPrintHeader/>
    <div className="receipt-title">{admission?.status !== 'DISCHARGED' ? 'DRAFT - ' : ''}{config.shortName.toUpperCase()} {config.key === 'daycare' ? 'COMPLETION' : 'DISCHARGE'} SUMMARY</div>
    <section className="receipt-details"><div><p><b>Patient:</b> {admission?.patient?.name || '—'}</p><p><b>UHID:</b> {admission?.patient?.uhid || '—'}</p><p><b>{config.shortName} No.:</b> {admission?.ipdNumber || '—'}</p><p><b>Age / Gender:</b> {admission?.patient?.age ?? '—'} / {admission?.patient?.gender || '—'}</p></div><div><p><b>Consultant:</b> {admission?.consultant?.name || '—'}</p><p><b>Admission Date:</b> {printDateTime(admission?.admissionDateTime)}</p><p><b>Discharge Date:</b> {printDateTime(form?.dischargeDateTime)}</p><p><b>Discharge Type:</b> {form?.dischargeType || '—'}</p><p><b>Follow-up Date:</b> {form?.followUpDate ? new Date(`${form.followUpDate}T00:00:00`).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'As advised'}</p></div></section>
    <section className="discharge-print-section"><h3>Provisional diagnosis</h3><p>{admission?.provisionalDiagnosis || '—'}</p></section>
    <section className="discharge-print-section"><h3>Final diagnosis</h3><p>{form?.finalDiagnosis || '—'}</p></section>
    <section className="discharge-print-section"><h3>Clinical summary</h3><p>{form?.clinicalSummary || '—'}</p></section>
    {form?.medications?.length > 0 && <section className="discharge-print-section"><h3>Discharge medications</h3><table className="receipt-table"><thead><tr><th>Medicine</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>{form.medications.map((item, index) => <tr key={index}><td>{item.medicine}</td><td>{item.dose || '—'}</td><td>{item.frequency || '—'}</td><td>{item.duration || '—'}</td><td>{item.instructions || '—'}</td></tr>)}</tbody></table></section>}
    <section className="discharge-print-section"><h3>Advice and follow-up</h3><p>{form?.advice || 'Follow treating consultant instructions.'}</p></section>
    <IPDPrintFooter text="Seek immediate medical attention if symptoms worsen." signature="Consultant Signature"/>
  </article>;
}

function IPDPrintFooter({ text, signature = 'Authorized Signature' }) {
  return <footer className="receipt-footer"><div><p>This is a computer-generated hospital document.</p><p>{text}</p></div><div className="signature">{signature}</div></footer>;
}
