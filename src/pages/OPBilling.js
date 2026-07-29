import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { HospitalLogo } from '../components/HospitalLogo';
import { FormField, SectionTitle } from '../components/ui/FormField';
import { doctorApi, opApi, patientApi } from '../api/services';
import { usePatientSearch } from '../hooks/usePatientSearch';
import { formatMoney } from '../data/hospitalData';

const emptyPatient = { id: null, uhid: '', name: '', mobile: '', dateOfBirth: '', gender: '', address: '' };
const today = () => new Date().toLocaleDateString('en-CA');

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return '';
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1;
  return age >= 0 ? age : '';
}

export function OPBilling({ selectedPatient }) {
  const [patient, setPatient] = useState(emptyPatient);
  const [patientQuery, setPatientQuery] = useState('');
  const [lookupOpen, setLookupOpen] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [visitType, setVisitType] = useState('NEW_CONSULTATION');
  const [appointmentDate, setAppointmentDate] = useState(today());
  const [appointmentTime, setAppointmentTime] = useState('10:30');
  const [symptoms, setSymptoms] = useState('');
  const [consultation, setConsultation] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [visit, setVisit] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const { patients: matchingPatients, loading: searchLoading, error: searchError } = usePatientSearch(patientQuery);

  useEffect(() => {
    doctorApi.list(true).then(result => {
      setDoctors(result);
      if (result.length) {
        setDoctorId(String(result[0].id));
        setConsultation(Number(result[0].consultationFee));
      }
    }).catch(error => setMessage({ type: 'error', text: error.message }));
  }, []);

  useEffect(() => {
    if (selectedPatient) {
      setPatient(selectedPatient);
      setVisit(null);
    }
  }, [selectedPatient]);

  const total = useMemo(() => Math.max(0, Number(consultation || 0) - Number(discount || 0)), [consultation, discount]);
  const age = useMemo(() => calculateAge(patient.dateOfBirth), [patient.dateOfBirth]);
  const clearFieldError = field => setFieldErrors(current => {
    if (!current[field]) return current;
    const next = { ...current };
    delete next[field];
    return next;
  });
  const updatePatient = (field, value) => { setPatient(current => ({ ...current, [field]: value })); clearFieldError(field); setVisit(null); };
  const selectPatient = item => { setPatient(item); setPatientQuery(''); setLookupOpen(false); setVisit(null); };
  const selectedDoctor = doctors.find(doctor => String(doctor.id) === String(doctorId));
  const initials = patient.name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'NP';

  const changeDoctor = value => {
    setDoctorId(value);
    clearFieldError('doctorId');
    const doctor = doctors.find(item => String(item.id) === value);
    if (doctor) setConsultation(Number(doctor.consultationFee));
  };

  const registerVisit = async () => {
    const mobile = patient.mobile.replace(/\D/g, '');
    const errors = {};
    if (!patient.name.trim()) errors.name = 'Enter the patient name.';
    if (!mobile) errors.mobile = 'Enter the mobile number.';
    else if (!/^\d{10,15}$/.test(mobile)) errors.mobile = 'Enter a valid 10 to 15 digit mobile number.';
    if (!patient.dateOfBirth) errors.dateOfBirth = 'Select the date of birth.';
    if (!patient.gender) errors.gender = 'Select the patient gender.';
    if (!doctorId) errors.doctorId = 'Select a consulting doctor.';
    if (!visitType) errors.visitType = 'Select a visit type.';
    if (!appointmentDate) errors.appointmentDate = 'Select the appointment date.';
    if (!appointmentTime) errors.appointmentTime = 'Select the appointment time.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      const firstField = Object.keys(errors)[0];
      setMessage({ type: 'error', text: errors[firstField] });
      requestAnimationFrame(() => {
        const field = document.getElementById(`op-${firstField}`);
        field?.focus();
        field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const patientBody = { name: patient.name.trim(), mobile, dateOfBirth: patient.dateOfBirth, gender: patient.gender, address: patient.address };
      const persistedPatient = patient.id ? await patientApi.update(patient.id, patientBody) : await patientApi.create(patientBody);
      setPatient(persistedPatient);
      const createdVisit = await opApi.create({ patientId: persistedPatient.id, doctorId: Number(doctorId), visitType, appointmentDate, appointmentTime, symptoms, consultationFee: Number(consultation), discount: Number(discount), paymentMode });
      setVisit(createdVisit);
      setMessage({ type: 'success', text: `Registration completed. Receipt ${createdVisit.receiptNumber} generated.` });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const printReceipt = () => {
    if (!visit) return;
    window.print();
  };

  return <><div className="page-grid op-screen">
    <section className="card form-card">
      <SectionTitle step="01" title="Patient registration" description="Enter patient and visit information" action={<span className="required-note"><i>*</i> Required fields</span>}/>
      <div className="patient-lookup" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setLookupOpen(false); }}><Icon name="search"/><input role="combobox" aria-label="Search existing patient" aria-controls="op-patient-results" value={patientQuery} onFocus={() => setLookupOpen(true)} onChange={event => { setPatientQuery(event.target.value); setLookupOpen(true); }} onKeyDown={event => { if (event.key === 'Enter' && matchingPatients.length) { event.preventDefault(); selectPatient(matchingPatients[0]); } }} placeholder="Search existing patient by name, UHID or mobile number..." autoComplete="off" aria-expanded={lookupOpen}/>{lookupOpen && patientQuery.trim() && <div className="patient-results" id="op-patient-results">{searchLoading ? <p>Searching patients…</p> : searchError ? <p>{searchError}</p> : matchingPatients.length ? matchingPatients.map((item, index) => <button type="button" key={item.id} onClick={() => selectPatient(item)}><span className="avatar soft">{item.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><span><b>{item.name}</b><small>{item.uhid} · +91 {item.mobile}</small></span>{index === 0 ? <kbd>Enter</kbd> : <Icon name="chevron" size={15}/>}</button>) : <p>No matching patient found</p>}</div>}</div>
      <p className="lookup-hint">Select an existing patient or enter a new patient below.</p>
      <div className="form-grid">
        <FormField label="Mobile number" required><div className={`input-prefix ${fieldErrors.mobile ? 'invalid' : ''}`}><span>+91</span><input id="op-mobile" aria-label="Mobile number" aria-invalid={Boolean(fieldErrors.mobile)} value={patient.mobile} onChange={event => updatePatient('mobile', event.target.value)}/></div>{fieldErrors.mobile && <small className="field-error">{fieldErrors.mobile}</small>}</FormField>
        <FormField label="UHID"><input aria-label="UHID" value={patient.uhid || ''} readOnly placeholder="Generated for a new patient"/></FormField>
        <FormField label="Patient full name" required wide><input id="op-name" className={fieldErrors.name ? 'invalid' : ''} aria-label="Patient full name" aria-invalid={Boolean(fieldErrors.name)} value={patient.name} onChange={event => updatePatient('name', event.target.value)}/>{fieldErrors.name && <small className="field-error">{fieldErrors.name}</small>}</FormField>
        <FormField label="Date of birth" required compact><input id="op-dateOfBirth" className={fieldErrors.dateOfBirth ? 'invalid' : ''} aria-label="Date of birth" aria-invalid={Boolean(fieldErrors.dateOfBirth)} type="date" value={patient.dateOfBirth} max={today()} onChange={event => updatePatient('dateOfBirth', event.target.value)}/>{fieldErrors.dateOfBirth && <small className="field-error">{fieldErrors.dateOfBirth}</small>}</FormField>
        <FormField label="Age / Gender" required compact><div className={`split-input ${fieldErrors.gender ? 'invalid' : ''}`}><input aria-label="Age" value={age} readOnly/><select id="op-gender" aria-label="Gender" aria-invalid={Boolean(fieldErrors.gender)} value={patient.gender} onChange={event => updatePatient('gender', event.target.value)}><option value="" disabled>Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></div>{fieldErrors.gender && <small className="field-error">{fieldErrors.gender}</small>}</FormField>
        <FormField label="Address" wide><input aria-label="Address" value={patient.address || ''} onChange={event => updatePatient('address', event.target.value)}/></FormField>
      </div>
      <div className="divider"/><SectionTitle step="02" title="Visit details" description="Assign doctor and consultation type"/>
      <div className="form-grid">
        <FormField label="Consulting doctor" required wide><select id="op-doctorId" className={fieldErrors.doctorId ? 'invalid' : ''} aria-label="Consulting doctor" aria-invalid={Boolean(fieldErrors.doctorId)} value={doctorId} onChange={event => changeDoctor(event.target.value)}><option value="">Select doctor</option>{doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.name} — {doctor.department}</option>)}</select>{fieldErrors.doctorId && <small className="field-error">{fieldErrors.doctorId}</small>}</FormField>
        <div className="visit-schedule">
          <FormField label="Visit type" required compact className="visit-type-field"><select id="op-visitType" className={fieldErrors.visitType ? 'invalid' : ''} aria-invalid={Boolean(fieldErrors.visitType)} value={visitType} onChange={event => { setVisitType(event.target.value); clearFieldError('visitType'); }}><option value="NEW_CONSULTATION">New Consultation</option><option value="FOLLOW_UP">Follow-up</option></select>{fieldErrors.visitType && <small className="field-error">{fieldErrors.visitType}</small>}</FormField>
          <FormField label="Appointment date" required compact><input id="op-appointmentDate" className={fieldErrors.appointmentDate ? 'invalid' : ''} aria-label="Appointment date" aria-invalid={Boolean(fieldErrors.appointmentDate)} type="date" value={appointmentDate} onChange={event => { setAppointmentDate(event.target.value); clearFieldError('appointmentDate'); }}/>{fieldErrors.appointmentDate && <small className="field-error">{fieldErrors.appointmentDate}</small>}</FormField>
          <FormField label="Appointment time" required compact className="time-field"><input id="op-appointmentTime" className={fieldErrors.appointmentTime ? 'invalid' : ''} aria-label="Appointment time" aria-invalid={Boolean(fieldErrors.appointmentTime)} type="time" value={appointmentTime} onChange={event => { setAppointmentTime(event.target.value); clearFieldError('appointmentTime'); }}/>{fieldErrors.appointmentTime && <small className="field-error">{fieldErrors.appointmentTime}</small>}</FormField>
        </div>
        <FormField label="Symptoms / Notes" wide><textarea rows="3" value={symptoms} onChange={event => setSymptoms(event.target.value)} placeholder="Add chief complaints or notes..."/></FormField>
      </div>
      {message.text && <div className={`api-message ${message.type}`}>{message.text}</div>}
    </section>
    <aside className="card bill-card"><div className="bill-header"><div><span>OP INVOICE</span><strong>#{visit?.opNumber || 'Pending'}</strong></div><HospitalLogo className="logo-mini"/></div><div className="patient-mini"><div className="avatar soft">{initials}</div><div><strong>{patient.name || 'New patient'}</strong><span>{patient.uhid || 'UHID will be generated'}</span></div></div><h3>Payment summary</h3><div className="charge-row"><span>Consultation fee</span><label>₹ <input type="number" min="0" value={consultation} onChange={event => setConsultation(event.target.value)}/></label></div><div className="charge-row discount"><span>Discount</span><label>− ₹ <input type="number" min="0" value={discount} onChange={event => setDiscount(event.target.value)}/></label></div><div className="total-row"><span>Total payable</span><strong>{formatMoney(total)}</strong></div><FormField label="Payment mode"><div className="payment-modes" role="group" aria-label="Payment mode">{['CASH', 'UPI', 'CARD'].map(mode => <button type="button" key={mode} className={paymentMode === mode ? 'selected' : ''} onClick={() => setPaymentMode(mode)}>{mode}</button>)}</div></FormField><button className="primary full" disabled={submitting} onClick={registerVisit}><Icon name="check"/> {submitting ? 'Registering…' : `Register & collect ${formatMoney(total)}`}</button><button className="secondary full" disabled={!visit} onClick={printReceipt}><Icon name="print"/> Print formatted receipt</button><p className="secure-note"><Icon name="check" size={14}/> UHID and receipt numbers are generated by the backend</p></aside>
  </div><OPPrintReceipt patient={patient} age={age} visit={visit} doctor={selectedDoctor} consultation={consultation} discount={discount} total={total} paymentMode={paymentMode}/></>;
}

function OPPrintReceipt({ patient, age, visit, doctor, consultation, discount, total, paymentMode }) {
  const displayGender = patient.gender ? patient.gender[0] + patient.gender.slice(1).toLowerCase() : '—';
  const receiptDate = visit?.createdAt ? new Date(visit.createdAt).toLocaleString('en-IN') : new Date().toLocaleString('en-IN');
  const appointment = visit?.appointmentDate || visit?.appointmentTime
    ? `${visit?.appointmentDate || '—'} ${visit?.appointmentTime ? `at ${visit.appointmentTime}` : ''}`
    : '—';
  return <article className="print-receipt op-print-receipt">
    <header className="receipt-hospital-header">
      <div className="receipt-brand"><HospitalLogo className="receipt-logo"/><div><h1><span>Lakshmi Sreenivaasa</span><span>Multi Speciality Hospital</span></h1><p>Healing · Caring · Serving</p></div></div>
      <address><strong>OPD Billing & Registration</strong><br/>Generated securely by Lakshmi Sreenivaasa HMS<br/>Authorized hospital use</address>
    </header>
    <div className="receipt-title">OPD REGISTRATION & PAYMENT RECEIPT</div>
    <section className="receipt-details">
      <div>
        <p><b>Receipt No.:</b> {visit?.receiptNumber || 'Pending'}</p>
        <p><b>OPD No.:</b> {visit?.opNumber || 'Pending'}</p>
        <p><b>UHID:</b> {patient.uhid || 'Pending'}</p>
        <p><b>Patient:</b> {patient.name || '—'}</p>
        <p><b>Age / Gender:</b> {age || '—'} years / {displayGender}</p>
        <p><b>Mobile:</b> {patient.mobile ? `+91 ${patient.mobile}` : '—'}</p>
        <p><b>Address:</b> {patient.address || '—'}</p>
      </div>
      <div>
        <p><b>Receipt Date:</b> {receiptDate}</p>
        <p><b>Doctor:</b> {visit?.doctor?.name || doctor?.name || '—'}</p>
        <p><b>Department:</b> {visit?.doctor?.department || doctor?.department || '—'}</p>
        <p><b>Visit Type:</b> {(visit?.visitType || '').replaceAll('_', ' ') || '—'}</p>
        <p><b>Appointment:</b> {appointment}</p>
        <p><b>Payment Mode:</b> {visit?.paymentMode || paymentMode}</p>
        <p><b>Payment Status:</b> {(visit?.paymentStatus || 'PAID').replaceAll('_', ' ')}</p>
      </div>
    </section>
    <table className="receipt-table"><thead><tr><th>S.No.</th><th>Particular</th><th>Mode</th><th>Amount (₹)</th></tr></thead><tbody>
      <tr><td>1</td><td>OPD Consultation Fee</td><td>{visit?.paymentMode || paymentMode}</td><td>{Number(visit?.consultationFee ?? consultation).toFixed(2)}</td></tr>
      {Number(visit?.discount ?? discount) > 0 && <tr><td>2</td><td>Discount</td><td>—</td><td>− {Number(visit?.discount ?? discount).toFixed(2)}</td></tr>}
      <tr className="receipt-total"><td colSpan="3">Paid Amount</td><td>₹{Number(visit?.paidAmount ?? total).toFixed(2)}</td></tr>
    </tbody></table>
    <div className="receipt-paid-note">Received with thanks <b>{formatMoney(visit?.paidAmount ?? total)}</b> from <b>{patient.name || 'the patient'}</b>.</div>
    <footer className="receipt-footer"><div><p>This is a computer-generated OPD payment receipt.</p><p>Please retain it for future hospital visits.</p></div><div className="signature">Authorized Signature</div></footer>
  </article>;
}
