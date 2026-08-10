import { useEffect, useRef, useState } from 'react';
import 'quill/dist/quill.snow.css';
import { Icon } from './Icon';

const safe = value => String(value ?? '').replace(/[&<>'"]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));

const displayDate = value => value
  ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  : '—';

const normalizeTemplateLabels = html => String(html || '')
  .replace(/BIOLOGICAL REFERENCE INTERVAL/gi, 'NORMAL INTERVAL');

const normalizeTemplateLayout = html => {
  const labeledHtml = normalizeTemplateLabels(html);
  if (typeof DOMParser === 'undefined') return labeledHtml;
  const document = new DOMParser().parseFromString(labeledHtml, 'text/html');
  document.body.querySelectorAll('table').forEach((table, tableIndex) => {
    const rows = [...table.querySelectorAll('tr')];
    const headerCells = rows[0]?.querySelectorAll(':scope > td');
    if (!headerCells?.length || headerCells[0].textContent.trim().toUpperCase() !== 'INVESTIGATION') return;
    const alreadyHasColonColumn = headerCells.length >= 5
      && headerCells[2].textContent.trim().toUpperCase() === 'RESULT';
    rows.forEach((row, index) => {
      let cells = row.querySelectorAll(':scope > td');
      if (!cells.length) return;
      const rowId = cells[0].getAttribute('data-row') || `report-${tableIndex}-${index}`;
      if (!alreadyHasColonColumn) {
        const colonCell = document.createElement('td');
        const allText = [...cells].map(cell => cell.textContent.trim()).join('');
        const remainingText = [...cells].slice(1).map(cell => cell.textContent.trim()).join('');
        const sectionHeading = index > 0 && cells[0].querySelector('strong') && !remainingText;
        colonCell.textContent = index === 0 || sectionHeading || !allText ? '' : ':';
        colonCell.setAttribute('data-row', rowId);
        row.insertBefore(colonCell, cells[1] || null);
        cells = row.querySelectorAll(':scope > td');
      }
      cells.forEach(cell => cell.setAttribute('data-row', rowId));
    });
  });
  return document.body.innerHTML;
};

const renderSavedTestSection = (test, results) => {
  if (!test?.reportTemplateHtml || typeof DOMParser === 'undefined') return '';
  const document = new DOMParser().parseFromString(normalizeTemplateLayout(test.reportTemplateHtml), 'text/html');
  const start = [...document.body.querySelectorAll('h3')]
    .find(heading => heading.textContent.trim().toUpperCase().startsWith('DEPARTMENT'));
  if (!start) return '';

  const container = document.createElement('div');
  let node = start;
  while (node && node.tagName !== 'BLOCKQUOTE') {
    container.appendChild(node.cloneNode(true));
    node = node.nextElementSibling;
  }

  const parameters = (test.results || test.parameters || [])
    .filter(parameter => parameter.parameterType !== 'HEADING');
  const headingNames = new Set((test.results || test.parameters || [])
    .filter(parameter => parameter.parameterType === 'HEADING')
    .map(parameter => parameter.name?.trim().toLowerCase()));
  let nextParameter = 0;
  container.querySelectorAll('table tr').forEach(row => {
    const cells = row.querySelectorAll(':scope > td');
    const label = cells[0].textContent.trim().toLowerCase();
    if (cells.length < 2 || !label || label === 'investigation' || headingNames.has(label)) return;
    const parameter = parameters.find(item => item.name?.trim().toLowerCase() === label)
      || parameters[nextParameter];
    nextParameter += 1;
    if (!parameter) return;
    const entered = results[parameter.parameterId] || {};
    const value = entered.result || parameter.result || '—';
    const abnormal = entered.abnormal ?? parameter.abnormal;
    const resultCell = cells[1]?.textContent.trim() === ':' ? cells[2] : cells[1];
    resultCell.innerHTML = abnormal
      ? `<span style="color: rgb(166, 29, 29);"><strong>${safe(value)} *</strong></span>`
      : `<strong>${safe(value)}</strong>`;
  });
  return container.innerHTML;
};

const resultTable = (test, results) => {
  const savedSection = renderSavedTestSection(test, results);
  if (savedSection) return savedSection;
  const tableHeader = '<tr><td><strong>INVESTIGATION</strong></td><td></td><td><strong>RESULT</strong></td><td><strong>UNIT</strong></td><td><strong>NORMAL INTERVAL</strong></td></tr>';
  let rows = '';

  (test.results || []).forEach(item => {
    if (item.parameterType === 'HEADING') {
      rows += `<tr class="report-section-row"><td><strong>${safe(item.name).toUpperCase()}</strong></td><td></td><td></td><td></td><td></td></tr>`;
      return;
    }
    const entered = results[item.parameterId] || {};
    const result = entered.result || item.result || '—';
    const abnormal = entered.abnormal ?? item.abnormal;
    if (item.parameterType === 'TEXT') {
      rows += `<tr class="report-text-row"><td>${safe(item.name)}</td><td><strong>:</strong></td><td><p style="text-align: left;">${safe(result)}</p></td><td></td><td></td></tr>`;
      return;
    }
    rows += `<tr>
      <td>${safe(item.name)}</td>
      <td><strong>:</strong></td>
      <td>${abnormal ? `<span style="color: rgb(166, 29, 29);"><strong>${safe(result)} *</strong></span>` : `<strong>${safe(result)}</strong>`}</td>
      <td>${safe(item.unit || '—')}</td>
      <td>${safe(item.referenceRange || '—')}</td>
    </tr>`;
  });
  const parameterNotes = (test.results || []).map(item => {
    const note = results[item.parameterId]?.remarks || item.remarks;
    return note ? `${safe(item.name)}: ${safe(note)}` : '';
  }).filter(Boolean).join(' · ');

  return `<h3 style="text-align: center;">DEPARTMENT OF ${safe(test.department || 'LABORATORY').toUpperCase()}</h3>
    <h2 style="text-align: center;">${safe(test.name).toUpperCase()}</h2>
    <p style="text-align: center;"><em>${safe(test.code)} · ${safe(test.specimenType || 'SPECIMEN')}</em></p>
    <table><tbody>${tableHeader}${rows || '<tr><td>General Result</td><td><strong>:</strong></td><td>—</td><td>—</td><td>—</td></tr>'}</tbody></table>
    ${parameterNotes ? `<p><strong>Parameter notes:</strong> ${parameterNotes}</p>` : ''}
    `;
};

export function buildLabReportHtml({ order, results = {}, remarks = '' }) {
  const patient = order?.patient || {};
  const collectedAt = order?.specimens?.[0]?.createdAt || order?.createdAt;
  const reportSections = (order?.tests || []).map(test => resultTable(test, results)).join('');

  return `<h1 style="text-align: center;">LABORATORY INVESTIGATION REPORT</h1>
    <table><tbody>
      <tr><td><strong>Patient Name</strong></td><td>${safe(patient.name || '—')}</td><td><strong>Lab No.</strong></td><td>${safe(order?.orderNumber || '—')}</td></tr>
      <tr><td><strong>Age / Sex</strong></td><td>${safe(patient.age ?? '—')} Years / ${safe(patient.gender || '—')}</td><td><strong>UHID</strong></td><td>${safe(patient.uhid || '—')}</td></tr>
      <tr><td><strong>Referred By</strong></td><td>${safe(order?.referringDoctor?.name || 'Self referral')}</td><td><strong>Collected On</strong></td><td>${safe(displayDate(collectedAt))}</td></tr>
      <tr><td><strong>Priority</strong></td><td>${safe(order?.priority || 'ROUTINE')}</td><td><strong>Reported On</strong></td><td>${safe(displayDate(new Date()))}</td></tr>
    </tbody></table>
    ${reportSections}
    <blockquote><strong>PATHOLOGIST REMARKS</strong><br>${safe(remarks || 'No additional remarks.')}</blockquote>
    <p style="text-align: center;"><strong>— End of Report —</strong></p>
    <p><br></p><p><br></p>
    <p style="text-align: right;"><strong>Consultant Pathologist</strong><br>Authorized Signatory</p>`;
}

export function buildLabTestTemplatePreviewHtml(test) {
  if (test?.reportTemplateHtml) return normalizeTemplateLayout(test.reportTemplateHtml);
  const parameters = (test?.parameters || []).map((parameter, index) => ({
    ...parameter,
    parameterId: parameter.parameterId || `sample-${index}`,
    parameterType: parameter.parameterType || 'NUMERIC',
    displayOrder: parameter.displayOrder ?? index,
  })).sort((left, right) => left.displayOrder - right.displayOrder);
  const results = Object.fromEntries(parameters
    .filter(parameter => parameter.parameterType !== 'HEADING')
    .map(parameter => [parameter.parameterId, {
      result: parameter.parameterType === 'TEXT' ? 'Sample observation' : '00.0',
      remarks: '',
      abnormal: false,
    }]));

  return buildLabReportHtml({
    order: {
      orderNumber: 'SAMPLE REPORT',
      patient: { name: 'Sample Patient', uhid: 'UHID-XXXX', age: 35, gender: '—' },
      referringDoctor: { name: 'Dr. Referring Consultant' },
      priority: 'ROUTINE',
      createdAt: new Date().toISOString(),
      tests: [{
        testId: test?.id || 'sample',
        code: test?.code || 'TEST',
        name: test?.name || 'New Laboratory Test',
        department: test?.department || 'Laboratory Medicine',
        specimenType: test?.specimenType || 'OTHER',
        results: parameters,
      }],
    },
    results,
    remarks: 'Sample template preview — patient values will replace the placeholders.',
  });
}

const newInvestigationHtml = `<p><br></p>
  <h3 style="text-align: center;">DEPARTMENT OF LABORATORY MEDICINE</h3>
  <h2 style="text-align: center;">NEW INVESTIGATION</h2>
  <table><tbody>
    <tr><td><strong>INVESTIGATION</strong></td><td></td><td><strong>RESULT</strong></td><td><strong>UNIT</strong></td><td><strong>NORMAL INTERVAL</strong></td></tr>
    <tr><td>Test parameter</td><td><strong>:</strong></td><td>Enter result</td><td>Unit</td><td>Reference interval</td></tr>
  </tbody></table><p><br></p>`;

export function LabReportEditorDialog({ initialHtml, resetHtml, onClose, onPrint, onSave, title = 'Review laboratory report', subtitle = 'Edit the exact content that will be printed on hospital letterhead.', saveLabel = 'Save template' }) {
  const editorNode = useRef(null);
  const quill = useRef(null);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState('Click any report cell to edit its text.');

  useEffect(() => {
    const node = editorNode.current;
    let disposed = false;
    import('quill').then(({ default: Quill }) => {
      if (disposed) return;
      const instance = new Quill(node, {
        theme: 'snow',
        modules: {
          table: true,
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline'],
            [{ color: [] }, { background: [] }],
            [{ align: [] }],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['clean'],
          ],
        },
      });
      instance.clipboard.dangerouslyPasteHTML(initialHtml);
      quill.current = instance;
      setReady(true);
    });
    return () => {
      disposed = true;
      quill.current = null;
      if (node) node.innerHTML = '';
    };
  }, [initialHtml]);

  const addInvestigation = () => {
    const instance = quill.current;
    if (!instance) return;
    const range = instance.getSelection(true);
    instance.clipboard.dangerouslyPasteHTML(range?.index ?? instance.getLength(), newInvestigationHtml, 'user');
    setHint('New investigation added. Replace its placeholder text with the required test.');
  };

  const addRow = () => {
    const table = quill.current?.getModule('table');
    const [selectedTable] = table?.getTable() || [];
    if (!selectedTable) {
      setHint('Place the cursor inside a result table first, then click Add result row.');
      return;
    }
    table.insertRowBelow();
    setHint('A blank result row was added below the selected row.');
  };

  const deleteRow = () => {
    const table = quill.current?.getModule('table');
    const [selectedTable] = table?.getTable() || [];
    if (!selectedTable) {
      setHint('Place the cursor inside the row you want to remove first.');
      return;
    }
    table.deleteRow();
    setHint('The selected result row was removed from this print preview.');
  };

  const resetLayout = () => {
    if (!quill.current || !resetHtml) return;
    quill.current.setContents([]);
    quill.current.clipboard.dangerouslyPasteHTML(resetHtml);
    setHint('Template restored from the configured fields. You can now edit any cell and save it.');
  };

  const print = () => {
    if (!quill.current) return;
    onPrint(quill.current.root.innerHTML);
  };

  const saveTemplate = () => {
    if (!quill.current) return;
    onSave(quill.current.root.innerHTML);
  };

  return <div className="report-editor-backdrop" role="presentation">
    <section className="report-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="report-editor-title">
      <header className="report-editor-header">
        <div><span>{onSave ? 'Master report template' : 'Preprint preview'}</span><h2 id="report-editor-title">{title}</h2><p>{subtitle}</p></div>
        <button type="button" onClick={onClose} aria-label="Close report editor">×</button>
      </header>
      <div className="report-editor-tools">
        <button type="button" onClick={addInvestigation}><Icon name="plus" size={15}/> Add investigation</button>
        <button type="button" onClick={addRow}>Add result row</button>
        <button type="button" className="danger-soft" onClick={deleteRow}><Icon name="trash" size={14}/> Remove row</button>
        {resetHtml && <button type="button" onClick={resetLayout}>Reset from fields</button>}
        <span>{hint}</span>
      </div>
      <div className="report-editor-scroll">
        <div className="report-editor-paper"><div ref={editorNode}/></div>
      </div>
      <footer className="report-editor-actions">
        <div><Icon name="info" size={16}/><span>The logo and hospital-address header are intentionally omitted for preprinted paper.</span></div>
        <button type="button" className="secondary" onClick={onClose}>Cancel</button>
        {onPrint && <button type="button" className="primary" disabled={!ready} onClick={print}><Icon name="print" size={16}/> Print this version</button>}
        {onSave && <button type="button" className="primary" disabled={!ready} onClick={saveTemplate}><Icon name="check" size={16}/> {saveLabel}</button>}
      </footer>
    </section>
  </div>;
}
