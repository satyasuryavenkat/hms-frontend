import { useEffect, useMemo, useRef, useState } from 'react';
import { pharmacyApi } from '../api/services';
import { Icon } from './Icon';
import { formatMoney } from '../data/hospitalData';

function ChargeActions({ charge, busy, onSave, onDelete }) {
  return <div className="row-actions">
    <button type="button" title="Save charge" disabled={busy} onClick={() => onSave(charge)}><Icon name="check" size={15}/></button>
    <button type="button" className="delete-charge" title="Delete charge" disabled={busy} onClick={() => onDelete(charge.id)}><Icon name="trash" size={15}/></button>
  </div>;
}

function ChargeGroup({ title, description, actionLabel, onAdd, children, empty }) {
  return <section className="ipd-charge-group">
    <header><div><h3>{title}</h3><p>{description}</p></div><button type="button" className="secondary small" onClick={onAdd}><Icon name="plus" size={14}/>{actionLabel}</button></header>
    {children}
    {empty && <p className="empty-inline">No {title.toLowerCase()} added.</p>}
  </section>;
}

export function ServiceChargesSection({ catalog, charges, busy, onAdd, onChange, onCategoryChange, onServiceChange, onSave, onDelete }) {
  return <ChargeGroup title="Hospital Services" description="Room, nursing, procedure and other configured services" actionLabel="Add service" onAdd={onAdd} empty={!charges.length}>
    {!!charges.length && <div className="table-wrap"><table className="billing-table editable-billing-table"><thead><tr><th>Category / Service</th><th>Qty</th><th>Configured rate</th><th>Amount</th><th>Actions</th></tr></thead><tbody>{charges.map((charge, index) => {
      const category = catalog.find(item => item.category === charge.category);
      const services = category?.services || [];
      const selectedService = services.findIndex(service => service.name === charge.description && service.department === charge.department);
      return <tr key={charge.id}><td><select aria-label={`Charge category ${index + 1}`} value={charge.category} onChange={event => onCategoryChange(charge.id, event.target.value)}><option value={charge.category}>{category?.label || charge.category}</option>{catalog.filter(item => item.category !== charge.category).map(item => <option key={item.category} value={item.category}>{item.label}</option>)}</select><select className="charge-detail-input" aria-label={`Charge service ${index + 1}`} value={selectedService} onChange={event => onServiceChange(charge.id, charge.category, event.target.value)}>{selectedService < 0 && <option value={-1}>{charge.description}</option>}{services.map((service, serviceIndex) => <option key={serviceIndex} value={serviceIndex}>{service.name}</option>)}</select></td><td><input aria-label={`Charge quantity ${index + 1}`} type="number" min="0.01" value={charge.quantity} onChange={event => onChange(charge.id, 'quantity', event.target.value)}/></td><td><span className="configured-charge-rate">{formatMoney(charge.rate)}</span></td><td><b>{formatMoney(Number(charge.quantity) * Number(charge.rate))}</b></td><td><ChargeActions charge={charge} busy={busy} onSave={onSave} onDelete={onDelete}/></td></tr>;
    })}</tbody></table></div>}
    {!catalog.length && <div className="api-message error">No active IPD services are configured. Add them under Admin Configuration → IPD charges.</div>}
  </ChargeGroup>;
}

export function LabChargesSection({ tests, charges, busy, onAdd, onChange, onSave, onDelete }) {
  const selectedTestId = charge => charge.labTestId || tests.find(test => test.name === charge.description && test.department === charge.department)?.id || '';
  return <ChargeGroup title="Lab Tests" description="Tests are billed as single units at their configured laboratory price" actionLabel="Add lab tests" onAdd={onAdd} empty={!charges.length}>
    {!!charges.length && <div className="table-wrap"><table className="billing-table editable-billing-table ipd-special-charge-table"><thead><tr><th>Lab test</th><th>Unit</th><th>Price</th><th>Actions</th></tr></thead><tbody>{charges.map((charge, index) => <tr key={charge.id}><td><select aria-label={`Lab test ${index + 1}`} value={selectedTestId(charge)} onChange={event => { const test = tests.find(item => item.id === Number(event.target.value)); if (test) onChange(charge.id, test); }}><option value="">Select lab test</option>{tests.map(test => <option key={test.id} value={test.id}>{test.name}</option>)}</select></td><td><b>1</b></td><td><b>{formatMoney(charge.rate)}</b></td><td><ChargeActions charge={charge} busy={busy} onSave={onSave} onDelete={onDelete}/></td></tr>)}</tbody></table></div>}
  </ChargeGroup>;
}

export function PharmacyChargesSection({ charges, busy, onAdd, onChange, onSave, onDelete }) {
  return <ChargeGroup title="Pharmacy" description="Medicines and consumables entered for this admission" actionLabel="Add pharmacy items" onAdd={onAdd} empty={!charges.length}>
    {!!charges.length && <div className="table-wrap"><table className="billing-table editable-billing-table ipd-special-charge-table"><thead><tr><th>Item name</th><th>Qty</th><th>Unit price</th><th>Amount</th><th>Actions</th></tr></thead><tbody>{charges.map((charge, index) => <tr key={charge.id}><td><input aria-label={`Pharmacy item ${index + 1}`} value={charge.description} onChange={event => onChange(charge.id, 'description', event.target.value)}/></td><td><input aria-label={`Pharmacy quantity ${index + 1}`} type="number" min="0.01" step="0.01" value={charge.quantity} onChange={event => onChange(charge.id, 'quantity', event.target.value)}/></td><td><input aria-label={`Pharmacy price ${index + 1}`} type="number" min="0" step="0.01" value={charge.rate} onChange={event => onChange(charge.id, 'rate', event.target.value)}/></td><td><b>{formatMoney(Number(charge.quantity) * Number(charge.rate))}</b></td><td><ChargeActions charge={charge} busy={busy} onSave={onSave} onDelete={onDelete}/></td></tr>)}</tbody></table></div>}
  </ChargeGroup>;
}

export function LabTestsDialog({ tests, busy, onClose, onAdd }) {
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => tests.filter(test => `${test.name}`.toLowerCase().includes(query.toLowerCase())), [tests, query]);
  const toggle = id => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}><div className="charge-dialog ipd-special-dialog" role="dialog" aria-modal="true" aria-labelledby="lab-charge-title">
    <div className="dialog-header"><div><h2 id="lab-charge-title">Add Lab Tests</h2><p>Select one or more available tests. Each test is added as one unit.</p></div><button type="button" onClick={onClose}>×</button></div>
    <div className="dialog-body"><label className="ipd-dialog-search"><Icon name="search"/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Search lab tests"/></label><div className="ipd-test-picker">{filtered.length ? filtered.map(test => <label key={test.id} className={selected.includes(test.id) ? 'selected' : ''}><input type="checkbox" checked={selected.includes(test.id)} onChange={() => toggle(test.id)}/><span><b>{test.name}</b><small>{formatMoney(test.price)}</small></span></label>) : <p>No available lab tests found.</p>}</div></div>
    <div className="dialog-actions"><span className="ipd-dialog-selection">{selected.length} selected</span><button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="button" className="primary" disabled={busy || !selected.length} onClick={() => onAdd(tests.filter(test => selected.includes(test.id)))}>{busy ? 'Adding…' : 'Add selected tests'}</button></div>
  </div></div>;
}


export function PharmacyItemsDialog({ busy, onClose, onAdd }) {
  const [medicines, setMedicines] = useState([]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [catalogError, setCatalogError] = useState('');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [attempted, setAttempted] = useState(false);
  const nextId = useRef(1);
  const searchInput = useRef(null);
  const filtered = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return medicines.filter(medicine => words.every(word =>
      [medicine.name, medicine.type, medicine.genericName].filter(Boolean).join(' ').toLowerCase().includes(word)));
  }, [medicines, query]);

  useEffect(() => {
    let active = true;
    pharmacyApi.medicines('', true).then(data => { if (active) setMedicines(data); })
      .catch(() => { if (active) setCatalogError('Unable to load medicines. You can still add an unlisted item.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const choose = medicine => {
    if (!rows.some(row => row.medicineId === medicine.id)) {
      setRows(current => [...current, { id: nextId.current++, medicineId: medicine.id,
        description: medicine.name, type: medicine.type, quantity: 1, rate: medicine.unitPrice ?? '' }]);
    }
    setQuery('');
    setExpanded(false);
    setHighlighted(0);
    searchInput.current?.focus();
  };
  const addManual = () => {
    setRows(current => [...current, { id: nextId.current++, description: query.trim(), quantity: 1, rate: '' }]);
    setQuery('');
    setExpanded(false);
  };
  const update = (id, field, value) => setRows(current => current.map(row => row.id === id ? { ...row, [field]: value } : row));
  const validQuantity = row => Number.isFinite(Number(row.quantity)) && Number(row.quantity) > 0;
  const validPrice = row => row.rate !== '' && Number.isFinite(Number(row.rate)) && Number(row.rate) >= 0;
  const valid = rows.length > 0 && rows.every(row => row.description.trim() && validQuantity(row) && validPrice(row));
  const total = rows.reduce((sum, row) => sum + (validQuantity(row) && validPrice(row) ? Number(row.quantity) * Number(row.rate) : 0), 0);
  const submit = () => {
    setAttempted(true);
    if (valid) onAdd(rows.map(row => ({ description: row.description.trim(), quantity: Number(row.quantity), rate: Number(row.rate) })));
  };
  const handleSearchKey = event => {
    if (event.key === 'Escape') { setExpanded(false); event.stopPropagation(); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setExpanded(true);
      setHighlighted(current => !expanded ? 0 : Math.max(0, Math.min(filtered.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1))));
    }
    if (event.key === 'Enter' && expanded && filtered[highlighted]) {
      event.preventDefault();
      choose(filtered[highlighted]);
    }
  };
  useEffect(() => {
    if (expanded) document.getElementById('pharmacy-result-' + highlighted)?.scrollIntoView?.({ block: 'nearest' });
  }, [expanded, highlighted]);

  return <div className="dialog-backdrop" onMouseDown={event => event.target === event.currentTarget && !busy && onClose()}>
    <div className="charge-dialog pharmacy-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="pharmacy-charge-title">
      <div className="dialog-header">
        <div className="dialog-icon"><Icon name="pill"/></div>
        <div><h2 id="pharmacy-charge-title">Add pharmacy items</h2><p>Find a medicine, then enter the quantity to bill.</p></div>
        <button type="button" aria-label="Close pharmacy dialog" disabled={busy} onClick={onClose}>&times;</button>
      </div>
      <div className="dialog-body">
        <div className="pharmacy-catalog-search" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false); }}>
          <label htmlFor="pharmacy-medicine-search">Search medicines</label>
          <div className="pharmacy-catalog-search-input"><Icon name="search"/>
            <input id="pharmacy-medicine-search" ref={searchInput} autoFocus role="combobox"
              aria-label="Search pharmacy medicines" aria-autocomplete="list" aria-expanded={expanded}
              aria-controls="pharmacy-search-results" aria-activedescendant={expanded && filtered[highlighted] ? 'pharmacy-result-' + highlighted : undefined}
              autoComplete="off" disabled={busy} value={query}
              onFocus={() => setExpanded(true)} onClick={() => setExpanded(true)}
              onChange={event => { setQuery(event.target.value); setExpanded(true); setHighlighted(0); }}
              onKeyDown={handleSearchKey} placeholder="Search by medicine name or type"/>
            {query && <button type="button" aria-label="Clear medicine search" onClick={() => { setQuery(''); setHighlighted(0); setExpanded(true); searchInput.current?.focus(); }}>&times;</button>}
          </div>
          {expanded && <div className="pharmacy-catalog-search-dropdown">
            {loading ? <p role="status">Loading medicines...</p> : catalogError ? <p role="alert">{catalogError}</p> : !filtered.length ? <p role="status">No matching medicines. Add an unlisted item below.</p> : <div className="pharmacy-result-count">{filtered.length} medicine{filtered.length === 1 ? '' : 's'} found</div>}
            <ul id="pharmacy-search-results" role="listbox" aria-label="Matching medicines">
              {!loading && filtered.map((medicine, index) => {
                const selected = rows.some(row => row.medicineId === medicine.id);
                return <li id={'pharmacy-result-' + index} key={medicine.id} role="option" aria-selected={highlighted === index}
                  className={highlighted === index ? 'highlighted' : ''} onMouseDown={event => event.preventDefault()} onClick={() => choose(medicine)}>
                  <span className="pharmacy-result-icon"><Icon name={selected ? 'check' : 'pill'} size={17}/></span>
                  <span className="pharmacy-result-name"><b>{medicine.name}</b><small>{medicine.type || 'Medicine'}{selected ? ' / Added' : ''}</small></span>
                  <strong>{formatMoney(medicine.unitPrice)}</strong><Icon name={selected ? 'check' : 'plus'} size={15}/>
                </li>;
              })}
            </ul>
          </div>}
        </div>
        <div className="pharmacy-selected-heading"><h3>Items to bill <span>{rows.length}</span></h3><button type="button" disabled={busy} onClick={addManual}><Icon name="plus" size={14}/> Add unlisted item</button></div>
        {!rows.length && <div className="pharmacy-selection-empty"><Icon name="pill" size={25}/><b>No items selected</b><p>Search above to select a medicine, or add an unlisted item.</p></div>}
        <div className="pharmacy-selected-items">{rows.map((row, index) => <div className="pharmacy-selected-item" key={row.id}>
          <div className="pharmacy-item-heading">
            <div>{row.medicineId ? <><b>{row.description}</b><small>{row.type || 'Medicine'}</small></> :
              <label>Medicine name<input autoFocus aria-label={'Pharmacy item ' + (index + 1)} disabled={busy}
                className={attempted && !row.description.trim() ? 'invalid' : ''} value={row.description}
                onChange={event => update(row.id, 'description', event.target.value)} placeholder="Enter medicine or consumable name"/></label>}</div>
            <button type="button" className="pharmacy-remove-item" aria-label={'Remove item ' + (index + 1)} disabled={busy}
              onClick={() => setRows(current => current.filter(item => item.id !== row.id))}><Icon name="trash" size={16}/></button>
          </div>
          <div className="pharmacy-item-values">
            <label>Quantity<input aria-label={'Pharmacy item quantity ' + (index + 1)} disabled={busy}
              className={attempted && !validQuantity(row) ? 'invalid' : ''} type="number" min="0.01" step="0.01"
              value={row.quantity} onChange={event => update(row.id, 'quantity', event.target.value)}/></label>
            <label>Unit price<input aria-label={'Pharmacy item price ' + (index + 1)} disabled={busy}
              className={attempted && !validPrice(row) ? 'invalid' : ''} type="number" min="0" step="0.01"
              value={row.rate} onChange={event => update(row.id, 'rate', event.target.value)} placeholder="0.00"/></label>
            <div><span>Amount</span><strong aria-label={'Pharmacy item amount ' + (index + 1)}>{formatMoney(validQuantity(row) && validPrice(row) ? Number(row.quantity) * Number(row.rate) : 0)}</strong></div>
          </div>
        </div>)}</div>
        {attempted && !valid && <div className="validation-summary" role="alert">Enter an item name, quantity greater than zero, and valid unit price for every item.</div>}
      </div>
      <div className="dialog-actions"><div className="pharmacy-picker-total"><span>Total amount</span><strong>{formatMoney(total)}</strong></div>
        <button type="button" className="secondary" disabled={busy} onClick={onClose}>Cancel</button>
        <button type="button" className="primary" disabled={busy || !rows.length} onClick={submit}>{busy ? 'Adding...' : 'Add ' + rows.length + (rows.length === 1 ? ' item' : ' items') + ' to bill'}</button>
      </div>
    </div>
  </div>;
}
