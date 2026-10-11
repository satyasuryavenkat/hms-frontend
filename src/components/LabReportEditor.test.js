import { buildLabReportHtml, buildLabTestTemplatePreviewHtml } from './LabReportEditor';

test.each([false, true])('saved report templates keep one footer after repeated draft previews (Quill: %s)', quillFormat => {
  const test = { code: 'HB', name: 'Haemoglobin', department: 'Hematology',
    results: [{ parameterId: '1', name: 'Haemoglobin', parameterType: 'NUMERIC', result: '12.4' }] };
  let template = buildLabReportHtml({ order: { tests: [test] } });
  if (quillFormat) template = template.replace('<div class="lab-report-signature" style="text-align: right;">', '<p class="ql-align-right">').replace('</div>', '</p>');
  for (let save = 0; save < 3; save += 1) {
    template = buildLabReportHtml({
      order: { tests: [{ ...test, reportTemplateHtml: template }] },
      results: { 1: { result: '14.2' } }, signatureDesignation: 'CONSULTANT_PATHOLOGIST',
    });
    expect(template.match(/End of Report/g)).toHaveLength(1);
    expect(template.match(/Consultant Pathologist/g)).toHaveLength(1);
    expect(template).not.toContain('Lab Incharge');
    expect(template).toContain('14.2');
  }
});

test('combining saved test templates adds only one report footer and preserves clinical notes', () => {
  const template = '<h3>DEPARTMENT OF LABORATORY</h3><p>Clinical note: discuss with consultant pathologist.</p><p><strong>— End of Report —</strong></p><p>Lab Incharge</p><p>— End of Report —</p><p>Lab Incharge</p>';
  const html = buildLabReportHtml({ order: { tests: [{ reportTemplateHtml: template }, { reportTemplateHtml: template }] } });
  expect(html.match(/End of Report/g)).toHaveLength(1);
  expect(html.match(/Lab Incharge/g)).toHaveLength(1);
  expect(html.match(/Clinical note:/g)).toHaveLength(2);
});

test('builds a content-only professional lab report for preprinted stationery', () => {
  const html = buildLabReportHtml({
    order: {
      orderNumber: 'LAB-001',
      patient: { name: 'Test Patient', uhid: 'UHID-01', age: 36, gender: 'FEMALE' },
      referringDoctor: { name: 'Dr. Test' },
      priority: 'ROUTINE',
      createdAt: '2026-08-09T10:00:00+05:30',
      tests: [{
        testId: 1,
        code: 'CBP',
        name: 'Complete Blood Picture',
        department: 'Hematology',
        specimenType: 'BLOOD',
        results: [
          { parameterId: '100', name: 'DIFFERENTIAL COUNT', parameterType: 'HEADING' },
          { parameterId: '101', name: 'Hemoglobin', unit: 'g/dL', referenceRange: '12 - 16', parameterType: 'NUMERIC' },
          { parameterId: '102', name: 'RBC Morphology', unit: 'must-not-render', referenceRange: 'must-not-render', parameterType: 'TEXT' },
        ],
      }],
    },
    results: { 101: { result: '13.5', abnormal: false } },
    remarks: 'Within normal limits.',
  });

  expect(html).not.toContain('LABORATORY INVESTIGATION REPORT');
  expect(html).toContain('DEPARTMENT OF HEMATOLOGY');
  expect(html).toContain('NORMAL INTERVAL');
  expect(html).not.toContain('BIOLOGICAL REFERENCE INTERVAL');
  expect(html).toContain('DIFFERENTIAL COUNT');
  expect(html).toContain('13.5');
  expect(html).toContain('<p class="report-text-observation-line"><strong>RBC Morphology</strong><code>:</code><strong>—</strong></p>');
  expect(html).not.toContain('must-not-render');
  expect(html.match(/<strong>INVESTIGATION<\/strong>/g)).toHaveLength(1);
  expect(html).not.toContain('Digitally signed');
  expect(html).toContain('<strong>Lab Incharge</strong>');
  expect(html).not.toContain('Lakshmi Sreenivaasa');
  expect(html).not.toContain('receipt-hospital-header');
});

test('uses the selected consultant pathologist signature designation', () => {
  const html = buildLabReportHtml({
    order: { patient: {}, tests: [] },
    signatureDesignation: 'CONSULTANT_PATHOLOGIST',
  });

  expect(html).toContain('<strong>Consultant Pathologist</strong>');
  expect(html).not.toContain('<strong>Lab Incharge</strong>');
});

test('builds a reusable sample preview from an admin lab-test template', () => {
  const html = buildLabTestTemplatePreviewHtml({
    code: 'CBP',
    name: 'Complete Blood Picture',
    department: 'Hematology',
    specimenType: 'BLOOD',
    parameters: [
      { name: 'DIFFERENTIAL COUNT', parameterType: 'HEADING', displayOrder: 0 },
      { name: 'Neutrophils', parameterType: 'NUMERIC', unit: '%', referenceRange: '40 - 70', displayOrder: 1 },
      { name: 'RBC Morphology', parameterType: 'TEXT', displayOrder: 2 },
    ],
  });

  expect(html).toContain('Sample Patient');
  expect(html).toContain('DIFFERENTIAL COUNT');
  expect(html).toContain('00.0');
  expect(html).toContain('Sample observation');
});

test('uses a saved Quill master template with the current patient result', () => {
  const html = buildLabReportHtml({
    order: {
      orderNumber: 'LAB-002',
      patient: { name: 'Current Patient', uhid: 'UHID-02', age: 40, gender: 'MALE' },
      tests: [{
        code: 'HB',
        name: 'Haemoglobin',
        department: 'Hematology',
        reportTemplateHtml: '<h1>LABORATORY INVESTIGATION REPORT</h1><table><tbody><tr><td>Patient Name</td><td>Sample Patient</td></tr></tbody></table><h3>DEPARTMENT OF HEMATOLOGY</h3><h2>CUSTOM HAEMOGLOBIN FORMAT</h2><table><tbody><tr><td><strong>INVESTIGATION</strong></td><td><strong>RESULT</strong></td><td><strong>UNIT</strong></td><td><strong>BIOLOGICAL REFERENCE INTERVAL</strong></td></tr><tr><td>Haemoglobin</td><td><strong>00.0</strong></td><td>g/dL</td><td>12 - 16</td></tr></tbody></table><blockquote>Sample remarks</blockquote>',
        results: [{ parameterId: '201', name: 'Haemoglobin', parameterType: 'NUMERIC' }],
      }],
    },
    results: { 201: { result: '14.2', abnormal: false } },
  });

  expect(html).toContain('CUSTOM HAEMOGLOBIN FORMAT');
  expect(html).toContain('<strong>14.2</strong>');
  expect(html).toContain('>:</td>');
  expect(html).toContain('data-row="report-1-1"');
  expect(html).not.toContain('<strong>00.0</strong>');
  expect(html).toContain('NORMAL INTERVAL');
  expect(html).not.toContain('BIOLOGICAL REFERENCE INTERVAL');
});

test('keeps Quill colon cells in the same row when a saved template is reopened', () => {
  const legacy = '<table><tbody><tr><td>Patient Name</td><td>Sample Patient</td></tr></tbody></table><h3>DEPARTMENT OF LABORATORY</h3><table><tbody><tr><td data-row="header"><strong>INVESTIGATION</strong></td><td data-row="header"><strong>RESULT</strong></td><td data-row="header"><strong>UNIT</strong></td><td data-row="header"><strong>NORMAL INTERVAL</strong></td></tr><tr><td data-row="value">Test Value</td><td data-row="value">00.0</td><td data-row="value">mg</td><td data-row="value">1 - 2</td></tr></tbody></table><blockquote>Remarks</blockquote>';
  const upgraded = buildLabTestTemplatePreviewHtml({ reportTemplateHtml: legacy });
  const reopened = buildLabTestTemplatePreviewHtml({ reportTemplateHtml: upgraded });

  expect((reopened.match(/data-row="value"/g) || [])).toHaveLength(5);
  expect((reopened.match(/<td data-row="value">:<\/td>/g) || [])).toHaveLength(1);
});

test('uses the remaining report width for text observations in saved templates', () => {
  const html = buildLabReportHtml({
    order: {
      patient: { name: 'Text Patient', uhid: 'UHID-03', age: 28, gender: 'FEMALE' },
      tests: [{
        code: 'SMEAR',
        name: 'Peripheral Smear',
        department: 'Hematology',
        reportTemplateHtml: '<h3>DEPARTMENT OF HEMATOLOGY</h3><table><tbody><tr><td><strong>INVESTIGATION</strong></td><td><strong>RESULT</strong></td><td><strong>UNIT</strong></td><td><strong>NORMAL INTERVAL</strong></td></tr><tr><td>RBC Morphology</td><td>Sample observation</td><td></td><td></td></tr></tbody></table><blockquote>Remarks</blockquote>',
        results: [{ parameterId: '301', name: 'RBC Morphology', parameterType: 'TEXT' }],
      }],
    },
    results: { 301: { result: 'Normocytic normochromic cells with no abnormal morphology seen.' } },
  });

  expect(html).toContain('class="report-text-observation-line"');
  expect(html).toContain('Normocytic normochromic cells with no abnormal morphology seen.');
});
