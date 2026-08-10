import { useCallback, useEffect, useMemo, useState } from 'react';
import { doctorApi, labApi, patientApi, pharmacyApi, userApi } from '../api/services';
import { Icon } from '../components/Icon';
import { buildLabTestTemplatePreviewHtml, LabReportEditorDialog } from '../components/LabReportEditor';
import { formatMoney } from '../data/hospitalData';

const roles = ['ADMINISTRATOR', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'BILLING_EXECUTIVE', 'DOCTOR'];
const tabs = [
  { id: 'doctors', label: 'Doctors', description: 'Clinical directory', icon: 'user' },
  { id: 'patients', label: 'Patients', description: 'Patient records', icon: 'file' },
  { id: 'lab', label: 'Lab tests', description: 'Catalog & prices', icon: 'flask' },
  { id: 'medicines', label: 'Medicines', description: 'Pharmacy inventory', icon: 'pill' },
  { id: 'users', label: 'Users', description: 'Access & roles', icon: 'lock' },
];

const roleLabel = value => value?.toLowerCase().split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
const initials = name => name?.split(' ').filter(Boolean).map(word => word[0]).slice(0, 2).join('').toUpperCase() || '--';

function StatusBadge({ active }) {
  return <span className={`admin-status ${active ? 'active' : 'inactive'}`}><i/>{active ? 'Active' : 'Inactive'}</span>;
}

function AdminDialog({ title, subtitle, icon = 'plus', children, onClose, onSubmit, saving, submitLabel = 'Save changes' }) {
  const [validationAttempted, setValidationAttempted] = useState(false);
  const submit = event => {
    if (!event.currentTarget.checkValidity()) {
      event.preventDefault();
      setValidationAttempted(true);
      const invalid = event.currentTarget.querySelector(':invalid');
      invalid?.focus();
      invalid?.reportValidity();
      return;
    }
    onSubmit(event);
  };
  return <div className="dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <form className={`admin-dialog ${validationAttempted ? 'validation-attempted' : ''}`} onSubmit={submit} onInvalid={() => setValidationAttempted(true)}>
      <div className="dialog-header"><div className="dialog-icon"><Icon name={icon}/></div><div><h2>{title}</h2><p>{subtitle}</p></div><button type="button" onClick={onClose} aria-label="Close">×</button></div>
      <div className="admin-dialog-body">{children}</div>
      <div className="dialog-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Saving...' : submitLabel}</button></div>
    </form>
  </div>;
}

function DeleteConfirmDialog({ itemType, itemName, warning, deleting, onCancel, onConfirm }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && !deleting && onCancel()}>
    <div className="admin-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title" aria-describedby="delete-dialog-description">
      <div className="admin-confirm-icon"><Icon name="trash" size={24}/></div>
      <span className="admin-confirm-eyebrow">Permanent action</span>
      <h2 id="delete-dialog-title">Delete {itemType}?</h2>
      <p id="delete-dialog-description">You are about to permanently delete <strong>{itemName}</strong>.</p>
      <div className="admin-confirm-warning"><Icon name="info" size={17}/><span>{warning}</span></div>
      <div className="admin-confirm-actions">
        <button type="button" className="secondary" disabled={deleting} onClick={onCancel}>Keep {itemType}</button>
        <button type="button" className="danger" disabled={deleting} onClick={onConfirm}><Icon name="trash" size={15}/>{deleting ? 'Deleting...' : `Delete ${itemType}`}</button>
      </div>
    </div>
  </div>;
}

function LabTemplatePreviewDialog({ test, onClose, onEdit }) {
  const html = buildLabTestTemplatePreviewHtml(test);
  return <div className="dialog-backdrop lab-template-preview-backdrop" role="presentation">
    <section className="lab-template-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="lab-template-preview-title">
      <header><div><span>Patient-independent master template</span><h2 id="lab-template-preview-title">{test.name || 'New test'} report preview</h2><p>This exact field order and section structure is copied into every new patient order for this test.</p></div><button type="button" onClick={onClose} aria-label="Close template preview">×</button></header>
      <div className="lab-template-preview-scroll"><article className="lab-template-preview-document lab-report-content-print ql-editor" dangerouslySetInnerHTML={{ __html: html }}/></div>
      <footer><div><Icon name="info" size={16}/><span>Displayed values are samples only. Patient values are entered later in Report Entry.</span></div>{onEdit && <button type="button" className="secondary" onClick={onEdit}>Edit this template</button>}<button type="button" className="primary" onClick={onClose}>Done</button></footer>
    </section>
  </div>;
}

function SectionHeader({ eyebrow, title, description, action, actionLabel }) {
  return <div className="admin-section-header"><div><span>{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{action && <button className="primary admin-add" onClick={action}><Icon name="plus" size={16}/>{actionLabel}</button>}</div>;
}

function DoctorsPanel({ notify }) {
  const empty = { doctorCode: '', name: '', department: '', specialization: '', consultationFee: '', active: true };
  const [doctors, setDoctors] = useState([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const load = useCallback(() => doctorApi.list(null).then(setDoctors).catch(error => notify(error.message, 'error')).finally(() => setLoading(false)), [notify]);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => doctors.filter(doctor => `${doctor.name} ${doctor.doctorCode} ${doctor.department} ${doctor.specialization}`.toLowerCase().includes(query.toLowerCase())), [doctors, query]);
  const open = doctor => { setEditing(doctor || null); setForm(doctor ? { ...doctor, consultationFee: doctor.consultationFee ?? '' } : empty); setDialogOpen(true); };
  const submit = async event => {
    event.preventDefault(); setSaving(true);
    try {
      const body = { ...form, consultationFee: Number(form.consultationFee) };
      if (editing) await doctorApi.update(editing.id, body); else await doctorApi.create(body);
      notify(`Doctor ${editing ? 'updated' : 'created'} successfully`, 'success'); setDialogOpen(false); setEditing(null); setForm(empty); await load();
    } catch (error) { notify(error.message, 'error'); } finally { setSaving(false); }
  };
  const removeDoctor = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await doctorApi.delete(deleteTarget.id);
      notify('Doctor deleted successfully', 'success');
      setDeleteTarget(null);
      await load();
    } catch (error) { notify(error.message, 'error'); } finally { setDeleting(false); }
  };
  return <>
    <SectionHeader eyebrow="Clinical directory" title="Manage doctors" description="Maintain doctors, departments, specialties and consultation pricing." action={() => open(null)} actionLabel="Add doctor"/>
    <div className="admin-toolbar"><label><Icon name="search"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search doctor, code or department"/></label><span>{filtered.length} doctors</span></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Doctor</th><th>Department</th><th>Specialization</th><th>Consultation fee</th><th>Status</th><th/></tr></thead><tbody>{loading ? <tr><td colSpan="6" className="admin-empty">Loading doctors...</td></tr> : filtered.length ? filtered.map(doctor => <tr key={doctor.id}><td><div className="admin-person"><span>{initials(doctor.name)}</span><div><b>{doctor.name}</b><small>{doctor.doctorCode}</small></div></div></td><td>{doctor.department}</td><td>{doctor.specialization || '—'}</td><td><strong>{formatMoney(doctor.consultationFee)}</strong></td><td><StatusBadge active={doctor.active}/></td><td><div className="medicine-actions"><button type="button" className="admin-edit" onClick={() => open(doctor)}>Edit</button><button type="button" className="admin-delete" onClick={() => setDeleteTarget(doctor)} aria-label={`Delete ${doctor.name}`}><Icon name="trash" size={14}/></button></div></td></tr>) : <tr><td colSpan="6" className="admin-empty">No doctors found</td></tr>}</tbody></table></div>
    {dialogOpen && <AdminDialog title={editing ? 'Edit doctor' : 'Add doctor'} subtitle="Enter clinical profile and billing information" icon="user" onClose={() => { setDialogOpen(false); setEditing(null); setForm(empty); }} onSubmit={submit} saving={saving} submitLabel={editing ? 'Update doctor' : 'Create doctor'}><div className="admin-form-grid"><label><span>Doctor code *</span><input required value={form.doctorCode} onChange={e => setForm({ ...form, doctorCode: e.target.value })} placeholder="DOC-003"/></label><label><span>Doctor name *</span><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Dr. Full Name"/></label><label><span>Department *</span><input required value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="Cardiology"/></label><label><span>Specialization</span><input value={form.specialization || ''} onChange={e => setForm({ ...form, specialization: e.target.value })} placeholder="Interventional cardiology"/></label><label><span>Consultation fee *</span><input required min="0" type="number" value={form.consultationFee} onChange={e => setForm({ ...form, consultationFee: e.target.value })}/></label><label><span>Status</span><select value={String(form.active)} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}><option value="true">Active</option><option value="false">Inactive</option></select></label></div></AdminDialog>}
    {deleteTarget && <DeleteConfirmDialog itemType="doctor" itemName={deleteTarget.name} warning="Doctors connected to visits, admissions or lab orders cannot be deleted. Mark the doctor inactive when historical records must be preserved." deleting={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={removeDoctor}/>} 
  </>;
}

function PatientsPanel({ notify }) {
  const [patients, setPatients] = useState([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [meta, setMeta] = useState({ totalElements: 0, totalPages: 0 });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => { setLoading(true); patientApi.search(query, page, 20).then(result => { setPatients(result.content || []); setMeta(result); }).catch(error => notify(error.message, 'error')).finally(() => setLoading(false)); }, 250);
    return () => clearTimeout(timer);
  }, [query, page, notify]);
  const view = async patient => { try { setSelected(await patientApi.get(patient.id)); } catch (error) { notify(error.message, 'error'); } };
  return <>
    <SectionHeader eyebrow="Patient directory" title="All patients" description="Search registered patients and open their complete demographic profile."/>
    <div className="admin-toolbar"><label><Icon name="search"/><input value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Search name, UHID or mobile"/></label><span>{meta.totalElements || 0} patients</span></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Patient</th><th>UHID</th><th>Age / Gender</th><th>Mobile</th><th>Registered</th><th/></tr></thead><tbody>{loading ? <tr><td colSpan="6" className="admin-empty">Loading patients...</td></tr> : patients.length ? patients.map(patient => <tr key={patient.id}><td><div className="admin-person patient"><span>{initials(patient.name)}</span><div><b>{patient.name}</b><small>{patient.address || 'Address not provided'}</small></div></div></td><td><span className="admin-code">{patient.uhid}</span></td><td>{patient.age} yrs · {roleLabel(patient.gender)}</td><td>{patient.mobile}</td><td>{patient.createdAt ? new Date(patient.createdAt).toLocaleDateString('en-IN') : '—'}</td><td><button className="admin-edit" onClick={() => view(patient)}>View details</button></td></tr>) : <tr><td colSpan="6" className="admin-empty">No patients found</td></tr>}</tbody></table></div>
    <div className="admin-pagination"><button disabled={page === 0} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page + 1} of {Math.max(meta.totalPages || 1, 1)}</span><button disabled={page + 1 >= meta.totalPages} onClick={() => setPage(value => value + 1)}>Next</button></div>
    {selected && <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && setSelected(null)}><div className="patient-detail-dialog"><div className="patient-detail-hero"><div className="patient-detail-avatar">{initials(selected.name)}</div><div><span>Patient profile</span><h2>{selected.name}</h2><p>{selected.uhid}</p></div><button onClick={() => setSelected(null)}>×</button></div><div className="patient-detail-grid"><div><small>Mobile number</small><strong>{selected.mobile}</strong></div><div><small>Date of birth</small><strong>{selected.dateOfBirth || '—'}</strong></div><div><small>Age</small><strong>{selected.age} years</strong></div><div><small>Gender</small><strong>{roleLabel(selected.gender)}</strong></div><div className="wide"><small>Address</small><strong>{selected.address || 'Not provided'}</strong></div><div className="wide"><small>Registered on</small><strong>{selected.createdAt ? new Date(selected.createdAt).toLocaleString('en-IN') : '—'}</strong></div></div><div className="dialog-actions"><button className="primary" onClick={() => setSelected(null)}>Close profile</button></div></div></div>}
  </>;
}

function LabTestsPanel({ notify }) {
  const empty = { code: '', name: '', department: '', price: '', turnaroundHours: 24, specimenType: 'BLOOD', active: true, parameters: [] };
  const [tests, setTests] = useState([]);
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [previewTest, setPreviewTest] = useState(null);
  const [templateEditor, setTemplateEditor] = useState(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const load = useCallback(() => labApi.tests('', undefined, null).then(setTests).catch(error => notify(error.message, 'error')), [notify]);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => tests.filter(test => `${test.name} ${test.code} ${test.department}`.toLowerCase().includes(query.toLowerCase())), [tests, query]);
  const open = test => { setEditing(test || null); setForm(test ? { ...test, price: test.price ?? '', parameters: (test.parameters || []).map(parameter => ({ ...parameter, parameterType: parameter.parameterType || 'NUMERIC' })) } : empty); setDialogOpen(true); };
  const updateParameter = (index, field, value) => setForm(current => ({ ...current, parameters: current.parameters.map((parameter, itemIndex) => itemIndex === index ? { ...parameter, [field]: value } : parameter) }));
  const addParameter = (parameterType = 'NUMERIC') => setForm(current => ({ ...current, parameters: [...current.parameters, { parameterId: null, name: '', unit: '', referenceRange: '', parameterType }] }));
  const moveParameter = (index, offset) => setForm(current => {
    const target = index + offset;
    if (target < 0 || target >= current.parameters.length) return current;
    const parameters = [...current.parameters];
    [parameters[index], parameters[target]] = [parameters[target], parameters[index]];
    return { ...current, parameters };
  });
  const removeParameter = index => setForm(current => ({ ...current, parameters: current.parameters.filter((_, itemIndex) => itemIndex !== index) }));
  const submit = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      const parameters = (form.parameters || []).filter(parameter => parameter.name.trim()).map(parameter => ({ ...parameter, name: parameter.name.trim(), parameterType: parameter.parameterType || 'NUMERIC', unit: parameter.parameterType === 'NUMERIC' ? parameter.unit : '', referenceRange: parameter.parameterType === 'NUMERIC' ? parameter.referenceRange : '' }));
      const body = { ...form, price: Number(form.price), turnaroundHours: Number(form.turnaroundHours), parameters };
      if (editing) await labApi.updateTest(editing.id, body); else await labApi.createTest(body);
      notify(`Lab test ${editing ? 'updated' : 'created'} successfully`, 'success');
      setDialogOpen(false);
      await load();
    } catch (error) { notify(error.message, 'error'); } finally { setSaving(false); }
  };
  const removeTest = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await labApi.deleteTest(deleteTarget.id);
      notify('Lab test deleted successfully', 'success');
      setDeleteTarget(null);
      await load();
    } catch (error) { notify(error.message, 'error'); } finally { setDeleting(false); }
  };
  const saveReportTemplate = async html => {
    if (!templateEditor?.id) return;
    setSavingTemplate(true);
    try {
      await labApi.updateReportTemplate(templateEditor.id, html);
      notify('Master report template saved successfully', 'success');
      setTemplateEditor(null);
      await load();
    } catch (error) { notify(error.message, 'error'); } finally { setSavingTemplate(false); }
  };
  return <>
    <SectionHeader eyebrow="Diagnostics catalog" title="Manage lab tests" description="Control test availability, report templates, turnaround times and patient prices. Patient result values are entered only by lab staff in Report entry." action={() => open(null)} actionLabel="Add lab test"/>
    <div className="admin-toolbar"><label><Icon name="search"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search test, code or department"/></label><span>{filtered.length} tests</span></div>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Test</th><th>Department</th><th>Specimen</th><th>Turnaround</th><th>Parameters</th><th>Price</th><th>Status</th><th/></tr></thead><tbody>{filtered.length ? filtered.map(test => <tr key={test.id}><td><div className="admin-person lab"><span><Icon name="flask" size={17}/></span><div><b>{test.name}</b><small>{test.code}</small></div></div></td><td>{test.department}</td><td><span className={`specimen-pill ${String(test.specimenType || 'BLOOD').toLowerCase()}`}>{roleLabel(test.specimenType || 'BLOOD')}</span></td><td>{test.turnaroundHours} hours</td><td>{test.parameters?.length || 0}</td><td><strong>{formatMoney(test.price)}</strong></td><td><StatusBadge active={test.active}/></td><td><div className="medicine-actions"><button type="button" className="admin-preview" onClick={() => setPreviewTest(test)}><Icon name="file" size={13}/> Preview</button><button type="button" className="admin-edit" onClick={() => open(test)}>Edit</button><button type="button" className="admin-delete" onClick={() => setDeleteTarget(test)} aria-label={`Delete ${test.name}`}><Icon name="trash" size={14}/></button></div></td></tr>) : <tr><td colSpan="8" className="admin-empty">No lab tests found</td></tr>}</tbody></table></div>
    {dialogOpen && <AdminDialog title={editing ? 'Edit lab test' : 'Add lab test'} subtitle="Configure the test catalog and blank report template" icon="flask" onClose={() => setDialogOpen(false)} onSubmit={submit} saving={saving} submitLabel={editing ? 'Update lab test' : 'Create lab test'}>
      <div className="admin-form-grid"><label><span>Test code *</span><input required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="LFT"/></label><label><span>Test name *</span><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Liver Function Test"/></label><label><span>Department *</span><input required value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="Biochemistry"/></label><label><span>Specimen type *</span><select required value={form.specimenType || 'BLOOD'} onChange={e => setForm({ ...form, specimenType: e.target.value })}>{['BLOOD', 'URINE', 'STOOL', 'SWAB', 'SPUTUM', 'OTHER'].map(type => <option key={type} value={type}>{roleLabel(type)}</option>)}</select></label><label><span>Price *</span><input required type="number" min="0" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}/></label><label><span>Turnaround hours *</span><input required type="number" min="1" value={form.turnaroundHours} onChange={e => setForm({ ...form, turnaroundHours: e.target.value })}/></label><label><span>Status</span><select value={String(form.active)} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}><option value="true">Active</option><option value="false">Inactive</option></select></label></div>
      <div className="lab-parameter-editor"><div className="lab-parameter-heading"><div><b>Blank report template</b><span>Add numeric values, free-text observations, and section headings in the exact order they should appear.</span></div><div className="lab-template-add-actions"><button type="button" className="template-preview-action" onClick={() => setPreviewTest(form)}><Icon name="file" size={14}/> Preview report</button><button type="button" onClick={() => addParameter('NUMERIC')}><Icon name="plus" size={14}/> Add field</button><button type="button" onClick={() => addParameter('HEADING')}>Add heading</button></div></div>{form.parameters.length ? <div className="lab-parameter-list"><div className="lab-parameter-labels"><span>Type</span><span>Field label / heading</span><span>Unit</span><span>Reference range</span><span>Order</span></div>{form.parameters.map((parameter, index) => <div className={`lab-parameter-row ${parameter.parameterType === 'HEADING' ? 'heading' : ''}`} key={parameter.parameterId || index}><select value={parameter.parameterType || 'NUMERIC'} onChange={e => updateParameter(index, 'parameterType', e.target.value)}><option value="NUMERIC">Numeric</option><option value="TEXT">Text</option><option value="HEADING">Heading</option></select><input required value={parameter.name} onChange={e => updateParameter(index, 'name', e.target.value)} placeholder={parameter.parameterType === 'HEADING' ? 'DIFFERENTIAL COUNT' : 'Haemoglobin'}/><input disabled={parameter.parameterType !== 'NUMERIC'} value={parameter.unit || ''} onChange={e => updateParameter(index, 'unit', e.target.value)} placeholder={parameter.parameterType === 'TEXT' ? 'Not used for text' : 'g/dL'}/><input disabled={parameter.parameterType !== 'NUMERIC'} value={parameter.referenceRange || ''} onChange={e => updateParameter(index, 'referenceRange', e.target.value)} placeholder={parameter.parameterType === 'TEXT' ? 'Not used for text' : '12.0 - 16.0'}/><div className="lab-parameter-actions"><button type="button" disabled={index === 0} onClick={() => moveParameter(index, -1)} aria-label={`Move ${parameter.name || 'field'} up`}>↑</button><button type="button" disabled={index === form.parameters.length - 1} onClick={() => moveParameter(index, 1)} aria-label={`Move ${parameter.name || 'field'} down`}>↓</button><button type="button" onClick={() => removeParameter(index)} aria-label={`Remove ${parameter.name || 'field'}`}><Icon name="trash" size={13}/></button></div></div>)}</div> : <p className="admin-form-note">No template fields configured. The system will create one free-text general-result field.</p>}</div>
    </AdminDialog>}
    {deleteTarget && <DeleteConfirmDialog itemType="lab test" itemName={deleteTarget.name} warning="The catalog item and its report template will be removed permanently. Existing completed lab orders and reports are retained." deleting={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={removeTest}/>} 
    {previewTest && <LabTemplatePreviewDialog test={previewTest} onClose={() => setPreviewTest(null)} onEdit={!dialogOpen && previewTest.id ? () => { const selected = previewTest; setPreviewTest(null); setTemplateEditor(selected); } : null}/>} 
    {templateEditor && <LabReportEditorDialog initialHtml={buildLabTestTemplatePreviewHtml(templateEditor)} resetHtml={buildLabTestTemplatePreviewHtml({ ...templateEditor, reportTemplateHtml: null })} onClose={() => !savingTemplate && setTemplateEditor(null)} onSave={saveReportTemplate} title={`Edit ${templateEditor.name} master template`} subtitle="Click inside any cell to edit it. To insert between fields, place the cursor in a row and use Add result row." saveLabel={savingTemplate ? 'Saving...' : 'Save master template'}/>} 
  </>;
}

function MedicinesPanel({ notify }) {
  const empty = { manufacturerCode: '', name: '', genericName: '', type: 'TABLET', manufacturerName: '', batchNumber: '', description: '', imageData: '', quantity: 0, unitPrice: '', taxPercent: 0, expiryDate: '', active: true };
  const [medicines, setMedicines] = useState([]);
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => pharmacyApi.medicines('', null).then(setMedicines).catch(error => notify(error.message, 'error')).finally(() => setLoading(false)), [notify]);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => medicines.filter(item => `${item.name} ${item.genericName} ${item.manufacturerCode} ${item.manufacturerName} ${item.type} ${item.batchNumber}`.toLowerCase().includes(query.toLowerCase())), [medicines, query]);
  const open = medicine => { setEditing(medicine || null); setForm(medicine ? { ...medicine, unitPrice: medicine.unitPrice ?? '', taxPercent: medicine.taxPercent ?? 0 } : empty); setDialogOpen(true); };
  const close = () => { setDialogOpen(false); setEditing(null); setForm(empty); };
  const chooseImage = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return notify('Select a valid image file.', 'error');
    if (file.size > 3 * 1024 * 1024) return notify('Medicine image must be smaller than 3 MB.', 'error');
    const reader = new FileReader();
    reader.onload = () => setForm(current => ({ ...current, imageData: reader.result }));
    reader.readAsDataURL(file);
  };
  const submit = async event => {
    event.preventDefault(); setSaving(true);
    try {
      const body = { ...form, quantity: Number(form.quantity), unitPrice: Number(form.unitPrice), taxPercent: Number(form.taxPercent) };
      if (editing) await pharmacyApi.updateMedicine(editing.id, body); else await pharmacyApi.createMedicine(body);
      notify(`Medicine ${editing ? 'updated' : 'created'} successfully`, 'success'); close(); await load();
    } catch (error) { notify(error.message, 'error'); } finally { setSaving(false); }
  };
  const removeMedicine = async medicine => {
    if (!window.confirm(`Delete ${medicine.name} from pharmacy inventory? Existing invoices will be retained.`)) return;
    try { await pharmacyApi.deleteMedicine(medicine.id); notify('Medicine deleted successfully', 'success'); await load(); }
    catch (error) { notify(error.message, 'error'); }
  };
  return <>
    <SectionHeader eyebrow="Pharmacy inventory" title="Manage medicines" description="Maintain medicine details, images, batches, expiry dates, pricing and available stock." action={() => open(null)} actionLabel="Add medicine"/>
    <div className="admin-toolbar"><label><Icon name="search"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search medicine, code, batch or manufacturer"/></label><span>{filtered.length} medicines</span></div>
    <div className="admin-table-wrap"><table className="admin-table medicine-admin-table"><thead><tr><th>Medicine</th><th>Type / Batch</th><th>Manufacturer code</th><th>Expiry</th><th>Stock</th><th>Price</th><th>Status</th><th/></tr></thead><tbody>{loading ? <tr><td colSpan="8" className="admin-empty">Loading medicines...</td></tr> : filtered.length ? filtered.map(medicine => <tr key={medicine.id}><td><div className="admin-person medicine"><span>{medicine.imageData ? <img src={medicine.imageData} alt=""/> : <Icon name="pill" size={17}/>}</span><div><b>{medicine.name}</b><small>{medicine.genericName || medicine.manufacturerName || 'No generic name'}</small></div></div></td><td>{medicine.type}<small>Batch {medicine.batchNumber || '—'}</small></td><td><span className="admin-code">{medicine.manufacturerCode}</span></td><td className={medicine.expired ? 'expired-stock' : ''}>{medicine.expiryDate}</td><td><strong>{medicine.quantity}</strong><small>units</small></td><td><strong>{formatMoney(medicine.unitPrice)}</strong><small>{medicine.taxPercent}% tax</small></td><td><StatusBadge active={medicine.active && !medicine.expired}/></td><td><div className="medicine-actions"><button className="admin-edit" onClick={() => open(medicine)}>Edit</button><button className="admin-delete" onClick={() => removeMedicine(medicine)} aria-label={`Delete ${medicine.name}`}><Icon name="trash" size={14}/></button></div></td></tr>) : <tr><td colSpan="8" className="admin-empty">No medicines found</td></tr>}</tbody></table></div>
    {dialogOpen && <AdminDialog title={editing ? 'Edit medicine' : 'Add medicine'} subtitle="Enter inventory, identification, expiry and billing details" icon="pill" onClose={close} onSubmit={submit} saving={saving} submitLabel={editing ? 'Update medicine' : 'Create medicine'}>
      <div className="medicine-image-field"><div className="medicine-image-preview">{form.imageData ? <img src={form.imageData} alt="Medicine preview"/> : <Icon name="pill" size={30}/>}</div><div><b>Medicine image</b><p>JPG, PNG or WebP up to 3 MB.</p><label className="image-upload-button">Choose image<input type="file" accept="image/*" onChange={chooseImage}/></label>{form.imageData && <button type="button" className="remove-image" onClick={() => setForm({ ...form, imageData: '' })}>Remove</button>}</div></div>
      <div className="admin-form-grid">
        <label><span>Medicine name *</span><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Paracetamol 500 mg"/></label>
        <label><span>Generic name</span><input value={form.genericName || ''} onChange={e => setForm({ ...form, genericName: e.target.value })} placeholder="Acetaminophen"/></label>
        <label><span>Type *</span><select required value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{['TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'DROPS', 'CREAM', 'OINTMENT', 'INHALER', 'OTHER'].map(type => <option key={type}>{roleLabel(type)}</option>)}</select></label>
        <label><span>Manufacturer name</span><input value={form.manufacturerName || ''} onChange={e => setForm({ ...form, manufacturerName: e.target.value })} placeholder="Manufacturer"/></label>
        <label><span>Manufacturer code *</span><input required value={form.manufacturerCode} onChange={e => setForm({ ...form, manufacturerCode: e.target.value })} placeholder="MED-PAR-500"/></label>
        <label><span>Batch number</span><input value={form.batchNumber || ''} onChange={e => setForm({ ...form, batchNumber: e.target.value })} placeholder="B2026-07"/></label>
        <label><span>Quantity *</span><input required type="number" min="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })}/></label>
        <label><span>Unit price *</span><input required type="number" min="0" step="0.01" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value })}/></label>
        <label><span>Tax percent *</span><input required type="number" min="0" max="100" step="0.01" value={form.taxPercent} onChange={e => setForm({ ...form, taxPercent: e.target.value })}/></label>
        <label><span>Expiry date *</span><input required type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })}/></label>
        <label><span>Status</span><select value={String(form.active)} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}><option value="true">Active</option><option value="false">Inactive</option></select></label>
        <label className="admin-wide-field"><span>Description</span><textarea rows="3" maxLength="2000" value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Composition, storage instructions and other medicine details"/></label>
      </div>
    </AdminDialog>}
  </>;
}

function UsersPanel({ notify, currentUser }) {
  const empty = { username: '', displayName: '', password: '', role: 'RECEPTIONIST', active: true, permissions: [] };
  const [users, setUsers] = useState([]); const [query, setQuery] = useState(''); const [dialogOpen, setDialogOpen] = useState(false); const [editing, setEditing] = useState(null); const [form, setForm] = useState(empty); const [saving, setSaving] = useState(false);
  const load = useCallback(() => userApi.list().then(setUsers).catch(error => notify(error.message, 'error')), [notify]);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => users.filter(user => `${user.displayName} ${user.username} ${user.role}`.toLowerCase().includes(query.toLowerCase())), [users, query]);
  const open = user => { setEditing(user || null); setForm(user ? { ...user, password: '', permissions: user.permissions || [] } : empty); setDialogOpen(true); };
  const submit = async event => { event.preventDefault(); setSaving(true); try { const body = { ...form, password: form.password || (editing ? null : '') }; if (editing) await userApi.update(editing.id, body); else await userApi.create(body); notify(`User ${editing ? 'updated' : 'created'} successfully`, 'success'); setDialogOpen(false); await load(); } catch (error) { notify(error.message, 'error'); } finally { setSaving(false); } };
  return <><SectionHeader eyebrow="Access control" title="Manage users" description="Create staff accounts, assign application roles and control account status." action={() => open(null)} actionLabel="Add user"/><div className="admin-toolbar"><label><Icon name="search"/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search user, email or role"/></label><span>{filtered.length} users</span></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>User</th><th>Username</th><th>Role</th><th>Permissions</th><th>Status</th><th/></tr></thead><tbody>{filtered.length ? filtered.map(user => <tr key={user.id}><td><div className="admin-person user"><span>{user.initials || initials(user.displayName)}</span><div><b>{user.displayName}</b><small>{user.id === currentUser?.id ? 'Current account' : `User #${user.id}`}</small></div></div></td><td>{user.username}</td><td><span className="role-pill">{roleLabel(user.role)}</span></td><td>{user.permissions?.length || 0} assigned</td><td><StatusBadge active={user.active}/></td><td><button className="admin-edit" onClick={() => open(user)}>Edit</button></td></tr>) : <tr><td colSpan="6" className="admin-empty">No users found</td></tr>}</tbody></table></div>{dialogOpen && <AdminDialog title={editing ? 'Edit user' : 'Add user'} subtitle="Configure secure staff access and application role" icon="lock" onClose={() => setDialogOpen(false)} onSubmit={submit} saving={saving} submitLabel={editing ? 'Update user' : 'Create user'}><div className="admin-form-grid"><label><span>Display name *</span><input required value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} placeholder="Staff member name"/></label><label><span>Username / email *</span><input required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="user@medora.in"/></label><label><span>{editing ? 'New password' : 'Password *'}</span><input required={!editing} minLength="6" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder={editing ? 'Leave blank to keep current' : 'Minimum 6 characters'}/></label><label><span>Role *</span><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>{roles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label><label><span>Status</span><select value={String(form.active)} onChange={e => setForm({ ...form, active: e.target.value === 'true' })}><option value="true">Active</option><option value="false">Inactive</option></select></label></div>{editing?.id === currentUser?.id && <p className="admin-form-note warning">You are editing your currently signed-in administrator account.</p>}</AdminDialog>}</>;
}

export function AdminConfiguration({ currentUser }) {
  const [activeTab, setActiveTab] = useState('doctors');
  const [message, setMessage] = useState(null);
  const notify = useCallback((text, type) => { setMessage({ text, type }); window.clearTimeout(window.__adminMessageTimer); window.__adminMessageTimer = window.setTimeout(() => setMessage(null), 4500); }, []);
  const panelProps = { notify, currentUser };
  return <div className="admin-page"><div className="admin-overview"><div><span>ADMIN CONTROL CENTER</span><h2>Hospital configuration</h2><p>Manage clinical masters, patient records, diagnostics pricing, pharmacy inventory and staff access from one secure workspace.</p></div><div className="admin-security"><Icon name="lock"/><div><b>Administrator access</b><small>Changes are protected and recorded by the backend</small></div></div></div><div className="admin-layout"><aside className="admin-tabs">{tabs.map(tab => <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}><span><Icon name={tab.icon}/></span><div><b>{tab.label}</b><small>{tab.description}</small></div><Icon name="chevron" size={15}/></button>)}</aside><section className="admin-panel">{message && <div className={`api-message ${message.type}`}>{message.text}</div>}{activeTab === 'doctors' && <DoctorsPanel {...panelProps}/>} {activeTab === 'patients' && <PatientsPanel {...panelProps}/>} {activeTab === 'lab' && <LabTestsPanel {...panelProps}/>} {activeTab === 'medicines' && <MedicinesPanel {...panelProps}/>} {activeTab === 'users' && <UsersPanel {...panelProps}/>}</section></div></div>;
}
