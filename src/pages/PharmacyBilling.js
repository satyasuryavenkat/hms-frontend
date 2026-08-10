import { useEffect, useMemo, useState } from 'react';
import { pharmacyApi } from '../api/services';
import { Icon } from '../components/Icon';
import { HospitalLogo } from '../components/HospitalLogo';
import { HospitalPrintHeader } from '../components/HospitalPrintHeader';
import { usePatientSearch } from '../hooks/usePatientSearch';
import { formatMoney } from '../data/hospitalData';

export function PharmacyBilling() {
  const [query, setQuery] = useState('');
  const [medicines, setMedicines] = useState([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState([]);
  const [patientQuery, setPatientQuery] = useState('');
  const [patient, setPatient] = useState(null);
  const [customer, setCustomer] = useState({ name: '', mobile: '' });
  const [discount, setDiscount] = useState(0);
  const [paymentMode, setPaymentMode] = useState('CASH');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const { patients } = usePatientSearch(patientQuery);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearching(true);
      pharmacyApi.medicines(query, true)
        .then(items => setMedicines(items.filter(item => !item.expired && item.quantity > 0)))
        .catch(error => setMessage({ type: 'error', text: error.message }))
        .finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const addMedicine = medicine => {
    setInvoice(null);
    setCart(current => {
      const existing = current.find(item => item.id === medicine.id);
      if (existing) return current.map(item => item.id === medicine.id ? { ...item, billQuantity: Math.min(item.quantity, item.billQuantity + 1) } : item);
      return [...current, { ...medicine, billQuantity: 1 }];
    });
  };
  const setQuantity = (id, value) => setCart(current => current.map(item => item.id === id ? { ...item, billQuantity: Math.max(1, Math.min(item.quantity, Number(value) || 1)) } : item));
  const remove = id => { setCart(current => current.filter(item => item.id !== id)); setInvoice(null); };
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + Number(item.unitPrice) * item.billQuantity, 0), [cart]);
  const tax = useMemo(() => cart.reduce((sum, item) => sum + Number(item.unitPrice) * item.billQuantity * Number(item.taxPercent) / 100, 0), [cart]);
  const total = Math.max(0, subtotal + tax - Number(discount || 0));

  const checkout = async () => {
    const name = patient?.name || customer.name.trim();
    const mobile = customer.mobile.replace(/\D/g, '');
    const errors = {};
    if (!patient && !name) errors.name = 'Enter the walk-in customer name or select a registered patient.';
    if (!patient && mobile && !/^\d{10,15}$/.test(mobile)) errors.mobile = 'Enter 10 to 15 digits only, or leave mobile blank.';
    setFieldErrors(errors);
    if (!cart.length) return setMessage({ type: 'error', text: 'Add at least one medicine to the bill.' });
    const firstField = Object.keys(errors)[0];
    if (firstField) {
      setMessage({ type: 'error', text: errors[firstField] });
      window.setTimeout(() => document.getElementById(`pharmacy-${firstField}`)?.focus(), 0);
      return;
    }
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const result = await pharmacyApi.createSale({
        patientId: patient?.id || null,
        customerName: patient ? null : name,
        customerMobile: patient ? null : customer.mobile.replace(/\D/g, ''),
        items: cart.map(item => ({ medicineId: item.id, quantity: item.billQuantity })),
        discount: Number(discount || 0),
        paymentMode,
      });
      setInvoice(result);
      setCart(result.items.map(item => ({ ...item, id: item.medicineId, name: item.medicineName, billQuantity: item.quantity, quantity: item.quantity })));
      setMessage({ type: 'success', text: `Invoice ${result.invoiceNumber} generated and stock updated.` });
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setSubmitting(false); }
  };

  return <><div className="pharmacy-screen page-grid">
    <section className="card form-card">
      <div className="section-title"><span className="step">01</span><div><h2>Medicine selection</h2><p>Search available stock by name, type, code or batch</p></div></div>
      <div className="pharmacy-search"><Icon name="search"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search medicine, manufacturer code, type or batch..."/><span>{searching ? 'Searching…' : `${medicines.length} available`}</span></div>
      <div className="medicine-results">{medicines.map(medicine => <button type="button" key={medicine.id} onClick={() => addMedicine(medicine)} disabled={cart.some(item => item.id === medicine.id && item.billQuantity >= medicine.quantity)}>
        <span className="medicine-thumb">{medicine.imageData ? <img src={medicine.imageData} alt=""/> : <Icon name="pill"/>}</span>
        <span><b>{medicine.name}</b><small>{medicine.genericName || medicine.type} · {medicine.manufacturerCode}</small><em>Batch {medicine.batchNumber || '—'} · Exp {medicine.expiryDate}</em></span>
        <strong>{formatMoney(medicine.unitPrice)}<small>{medicine.quantity} in stock</small></strong><Icon name="plus"/>
      </button>)}</div>
      <div className="section-title pharmacy-cart-title"><span className="step">02</span><div><h2>Billing items</h2><p>Edit quantities or remove an item before checkout</p></div></div>
      <div className="table-wrap"><table className="pharmacy-cart"><thead><tr><th>Medicine</th><th>Price</th><th>Quantity</th><th>Tax</th><th>Total</th><th/></tr></thead><tbody>{cart.length ? cart.map(item => {
        const line = Number(item.unitPrice) * item.billQuantity * (1 + Number(item.taxPercent || 0) / 100);
        return <tr key={item.id}><td><b>{item.name || item.medicineName}</b><small>{item.manufacturerCode}</small></td><td>{formatMoney(item.unitPrice)}</td><td><input aria-label={`${item.name} quantity`} type="number" min="1" max={item.quantity} value={item.billQuantity} disabled={Boolean(invoice)} onChange={event => setQuantity(item.id, event.target.value)}/><small>Max {item.quantity}</small></td><td>{item.taxPercent}%</td><td><strong>{formatMoney(line)}</strong></td><td><button className="delete-charge" disabled={Boolean(invoice)} onClick={() => remove(item.id)} aria-label={`Remove ${item.name}`}><Icon name="trash" size={14}/></button></td></tr>;
      }) : <tr><td colSpan="6" className="empty-charges">Search and add medicines to begin billing.</td></tr>}</tbody></table></div>
      {message.text && <div className={`api-message ${message.type}`}>{message.text}</div>}
    </section>
    <aside className="card bill-card pharmacy-checkout">
      <div className="bill-header"><div><span>PHARMACY INVOICE</span><strong>#{invoice?.invoiceNumber || 'Pending'}</strong></div><HospitalLogo className="logo-mini"/></div>
      <label className="checkout-label">Patient lookup (optional)</label>
      <div className="patient-lookup pharmacy-patient-lookup"><Icon name="search"/><input value={patientQuery} onChange={event => { setPatientQuery(event.target.value); setPatient(null); }} placeholder="Search name, UHID or mobile"/>{patientQuery && !patient && <div className="patient-results">{patients.map(item => <button type="button" key={item.id} onClick={() => { setPatient(item); setPatientQuery(item.name); setFieldErrors({}); }}><span><b>{item.name}</b><small>{item.uhid} · {item.mobile}</small></span></button>)}</div>}</div>
      {!patient && <div className="walkin-fields validation-fields"><div><input id="pharmacy-name" className={fieldErrors.name ? 'invalid' : ''} aria-invalid={Boolean(fieldErrors.name)} value={customer.name} onChange={event => { setCustomer({ ...customer, name: event.target.value }); setFieldErrors(current => ({ ...current, name: '' })); }} placeholder="Walk-in customer name"/>{fieldErrors.name && <small className="field-error">{fieldErrors.name}</small>}</div><div><input id="pharmacy-mobile" className={fieldErrors.mobile ? 'invalid' : ''} aria-invalid={Boolean(fieldErrors.mobile)} inputMode="numeric" value={customer.mobile} onChange={event => { setCustomer({ ...customer, mobile: event.target.value }); setFieldErrors(current => ({ ...current, mobile: '' })); }} placeholder="Mobile number (optional)"/>{fieldErrors.mobile && <small className="field-error">{fieldErrors.mobile}</small>}</div></div>}
      {patient && <div className="selected-pharmacy-patient"><span>{patient.name.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><div><b>{patient.name}</b><small>{patient.uhid} · {patient.mobile}</small></div><button onClick={() => { setPatient(null); setPatientQuery(''); }}>×</button></div>}
      <h3>Payment summary</h3>
      <div className="summary-line"><span>Subtotal</span><b>{formatMoney(invoice?.subtotal ?? subtotal)}</b></div>
      <div className="summary-line"><span>Tax</span><b>{formatMoney(invoice?.taxAmount ?? tax)}</b></div>
      <div className="charge-row discount"><span>Discount</span><label>− ₹ <input type="number" min="0" max={subtotal + tax} disabled={Boolean(invoice)} value={discount} onChange={event => setDiscount(event.target.value)}/></label></div>
      <div className="total-row"><span>Total payable</span><strong>{formatMoney(invoice?.totalPayable ?? total)}</strong></div>
      <div className="payment-modes">{['CASH', 'UPI', 'CARD'].map(mode => <button type="button" key={mode} disabled={Boolean(invoice)} className={paymentMode === mode ? 'selected' : ''} onClick={() => setPaymentMode(mode)}>{mode}</button>)}</div>
      <button className="primary full" disabled={submitting || Boolean(invoice)} onClick={checkout}><Icon name="check"/>{submitting ? 'Generating…' : `Collect ${formatMoney(total)}`}</button>
      <button className="secondary full" disabled={!invoice} onClick={() => window.print()}><Icon name="print"/> Print pharmacy invoice</button>
      {invoice && <button className="secondary full" onClick={() => { setCart([]); setInvoice(null); setPatient(null); setPatientQuery(''); setCustomer({ name: '', mobile: '' }); setDiscount(0); }}>New bill</button>}
    </aside>
  </div><PharmacyReceipt invoice={invoice}/></>;
}

function PharmacyReceipt({ invoice }) {
  if (!invoice) return null;
  return <article className="print-receipt pharmacy-print">
    <HospitalPrintHeader/>
    <div className="receipt-title">PHARMACY TAX INVOICE</div>
    <section className="receipt-details"><div><p><b>Invoice:</b> {invoice.invoiceNumber}</p><p><b>Customer:</b> {invoice.customerName}</p><p><b>UHID:</b> {invoice.patient?.uhid || 'Walk-in'}</p><p><b>Mobile:</b> {invoice.customerMobile || '—'}</p></div><div><p><b>Date:</b> {new Date(invoice.createdAt).toLocaleString('en-IN')}</p><p><b>Payment mode:</b> {invoice.paymentMode}</p><p><b>Payment status:</b> {invoice.paymentStatus}</p></div></section>
    <table className="receipt-table"><thead><tr><th>#</th><th>Medicine / Batch</th><th>Qty × Rate</th><th>Tax</th><th>Amount (₹)</th></tr></thead><tbody>{invoice.items.map((item, index) => <tr key={`${item.medicineId}-${index}`}><td>{index + 1}</td><td><b>{item.medicineName}</b><small>{item.manufacturerCode} · Batch {item.batchNumber || '—'} · Exp {item.expiryDate}</small></td><td>{item.quantity} × {Number(item.unitPrice).toFixed(2)}</td><td>{Number(item.taxAmount).toFixed(2)}</td><td>{Number(item.lineTotal).toFixed(2)}</td></tr>)}<tr><td colSpan="4">Discount</td><td>− {Number(invoice.discount).toFixed(2)}</td></tr><tr className="receipt-total"><td colSpan="4">Paid Amount</td><td>₹{Number(invoice.paidAmount).toFixed(2)}</td></tr></tbody></table>
    <div className="receipt-paid-note">Received with thanks <b>{formatMoney(invoice.paidAmount)}</b> from <b>{invoice.customerName}</b>.</div>
    <footer className="receipt-footer"><div><p>Medicines once sold are subject to the hospital pharmacy return policy.</p><p>Please check batch and expiry before leaving the counter.</p></div><div className="signature">Pharmacist Signature</div></footer>
  </article>;
}
