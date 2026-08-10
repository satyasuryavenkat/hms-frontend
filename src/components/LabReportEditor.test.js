import { buildLabReportHtml, buildLabTestTemplatePreviewHtml } from './LabReportEditor';

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

  expect(html).toContain('LABORATORY INVESTIGATION REPORT');
  expect(html).toContain('DEPARTMENT OF HEMATOLOGY');
  expect(html).toContain('NORMAL INTERVAL');
  expect(html).not.toContain('BIOLOGICAL REFERENCE INTERVAL');
  expect(html).toContain('DIFFERENTIAL COUNT');
  expect(html).toContain('13.5');
  expect(html).toContain('<td>RBC Morphology</td><td><strong>:</strong></td><td><p style="text-align: left;">');
  expect(html).not.toContain('must-not-render');
  expect(html.match(/<strong>INVESTIGATION<\/strong>/g)).toHaveLength(1);
  expect(html).toContain('Consultant Pathologist');
  expect(html).not.toContain('Lakshmi Sreenivaasa');
  expect(html).not.toContain('receipt-hospital-header');
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
