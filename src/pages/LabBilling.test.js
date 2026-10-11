import { buildPreviousReportHtml, reportResultValues, selectedReportTest } from './LabBilling';
import { buildLabTestTemplatePreviewHtml, restoreTextResultRows, separateTextResultRows } from '../components/LabReportEditor';

test('rebuilds saved result values for printing a previous lab report', () => {
  const values = reportResultValues({
    tests: [
      { results: [{ parameterId: '11', result: '13.5', abnormal: false }] },
      { results: [{ parameterId: '12', result: 'Positive', abnormal: true }] },
    ],
  });

  expect(values).toEqual({
    11: { result: '13.5', abnormal: false },
    12: { result: 'Positive', abnormal: true },
  });
});

test('selects one test from a previous multi-test report', () => {
  const report = { tests: [
    { testId: 41, code: 'CBP', name: 'Complete Blood Picture' },
    { testId: 42, code: 'CUE', name: 'Complete Urine Examination' },
  ] };

  expect(selectedReportTest(report, '42')).toEqual(report.tests[1]);
  expect(selectedReportTest(report, '')).toEqual(report.tests[0]);
});

test('renders a previous report from its saved test template', () => {
  const report = {
    orderNumber: 'LAB-001',
    patient: { name: 'Test Patient', age: 40, gender: 'FEMALE', uhid: 'UHID-1' },
    tests: [{
      testId: 42,
      code: 'CUE',
      name: 'Urine Examination',
      reportTemplateHtml: '<h3>DEPARTMENT OF PATHOLOGY</h3><h2>CUSTOM SAVED TEMPLATE</h2><table><tbody><tr><td><strong>INVESTIGATION</strong></td><td></td><td><strong>RESULT</strong></td><td><strong>UNIT</strong></td><td><strong>NORMAL INTERVAL</strong></td></tr><tr><td>Colour</td><td>:</td><td>placeholder</td><td></td><td></td></tr></tbody></table><blockquote>Remarks</blockquote>',
      results: [{ parameterId: 9, name: 'Colour', parameterType: 'TEXT', result: 'Pale yellow', abnormal: false }],
    }],
  };

  const html = buildPreviousReportHtml(report, 42);

  expect(html).toContain('CUSTOM SAVED TEMPLATE');
  expect(html).toContain('Pale yellow');
  expect(html).toContain('report-text-observation-line');
  expect(html).not.toContain('Urine Examination</h2>');
});

test('separates text observations from the numeric five-column table', () => {
  const html = separateTextResultRows('<table><tbody><tr><td>Numeric</td><td>:</td><td>1</td><td>mg</td><td>0-2</td></tr><tr class="report-text-row"><td>RBC Morphology</td><td>:</td><td colspan="3">Normocytic normochromic</td></tr><tr><td>Numeric 2</td><td>:</td><td>2</td><td>mg</td><td>1-3</td></tr></tbody></table>');
  const document = new DOMParser().parseFromString(html, 'text/html');
  const textLine = document.querySelector('p.report-text-observation-line');

  expect(document.querySelectorAll('table')).toHaveLength(2);
  expect(textLine.querySelectorAll(':scope > *')).toHaveLength(3);
  expect(textLine.textContent).toContain('RBC Morphology:Normocytic normochromic');
});

test('restores text-table styling after Quill loads the document', () => {
  const root = document.createElement('div');
  root.innerHTML = '<p><strong>RBC Morphology</strong><code>:</code><strong>Normocytic normochromic</strong></p>';
  const source = '<p class="report-text-observation-line"><strong>RBC Morphology</strong><code>:</code><strong>Normocytic normochromic</strong></p>';

  restoreTextResultRows(root, source);

  expect(root.querySelector('p')).toHaveClass('report-text-observation-line');
});

test('removes pathologist remarks from an older saved lab template', () => {
  const html = buildLabTestTemplatePreviewHtml({
    reportTemplateHtml: '<h3>DEPARTMENT OF PATHOLOGY</h3><blockquote><strong>PATHOLOGIST REMARKS</strong><br>No additional remarks.</blockquote>',
  });

  expect(html).not.toContain('PATHOLOGIST REMARKS');
  expect(html).not.toContain('No additional remarks.');
});
