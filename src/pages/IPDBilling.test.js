import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { createEmptyAdmission, currentSystemTime, IPDFinalBillPrint, AddChargeDialog, DischargeSummary, IPD_CONFIG, DAYCARE_CONFIG } from './IPDBilling';

test('uses the computer local time as the editable IPD admission time default', () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 7, 23, 9, 6, 42));

  expect(currentSystemTime()).toBe('09:06');
  expect(createEmptyAdmission().admissionTime).toBe('09:06');

  jest.useRealTimers();
});

test.each(['IPD', 'Daycare'])('prints %s charges in compact sections with payment totals', shortName => {
  const charges = [
    { id: 1, category: 'ROOM_CHARGES', description: 'General ward', quantity: 2, rate: 1000, amount: 2000 },
    { id: 2, category: 'LAB_TESTS', description: 'Blood count', quantity: 1, rate: 400, amount: 400 },
    { id: 3, category: 'PHARMACY', description: 'Paracetamol', quantity: 3, rate: 10, amount: 30 },
  ];
  const { container } = render(<IPDFinalBillPrint config={{ shortName, locationLabel: 'Ward / Bed' }} charges={charges} bill={{ grossCharges: 2430, advanceReceived: 1000, discount: 30, paidAmount: 1400, balancePayable: 0 }}/>);
  expect(container.querySelector('table')).toBeNull();
  expect(within(screen.getByRole('region', { name: 'Hospital services' })).getByText('General ward')).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Lab tests' })).getByText('Blood count')).toBeInTheDocument();
  const pharmacy = screen.getByRole('region', { name: 'Pharmacy' });
  expect(within(pharmacy).getByText(/3 ×/)).toBeInTheDocument();
  expect(screen.getByText('Advance received')).toBeInTheDocument();
  expect(screen.getByText('Discount (total)')).toBeInTheDocument();
  expect(screen.getByText('Paid amount')).toBeInTheDocument();
  expect(screen.getByText('Balance payable')).toBeInTheDocument();
});

test('omits empty bill sections and retains pending payment text', () => {
  render(<IPDFinalBillPrint config={{ shortName: 'IPD' }} charges={[{ id: 1, category: 'PHARMACY', description: 'Syringe', quantity: 2, rate: 15 }]} bill={{ grossCharges: 30, balancePayable: 30 }}/>);
  expect(screen.queryByRole('region', { name: 'Lab tests' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Hospital services' })).not.toBeInTheDocument();
  expect(screen.getByText(/Payment pending/)).toBeInTheDocument();
});

test.each(['IPD', 'Daycare'])('%s services can be selected without a department field', shortName => {
  const onAdd = jest.fn();
  const catalog = [{ category: 'OTHER', label: 'Other', services: [
    { name: 'Dressing', department: 'Nursing', defaultRate: 100 },
    { name: 'Procedure', department: 'Surgery', defaultRate: 500 },
  ] }];
  const { container } = render(<AddChargeDialog config={{ shortName }} catalog={catalog} onAdd={onAdd} onClose={jest.fn()} busy={false}/>);
  expect(screen.queryByText('Department')).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Procedure' })).toBeInTheDocument();
  fireEvent.change(container.querySelector('#charge-description'), { target: { value: '1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to bill' }));
  expect(onAdd).toHaveBeenCalledWith({ category: 'OTHER', department: 'Surgery', description: 'Procedure', quantity: 1 });
});

test.each(['IPD', 'Daycare'])('%s final receipt shows admission and discharge dates without bed numbers', shortName => {
  render(<IPDFinalBillPrint config={{ shortName, locationLabel: 'Ward / Bed' }} admission={{ bedNumber: 'BED-PRIVATE', admissionDateTime: '2026-09-01T10:00:00', dischargeDateTime: '2026-09-02T12:00:00+05:30' }} charges={[]} bill={{}}/>);
  expect(screen.getByText('Admission Date:')).toBeInTheDocument();
  expect(screen.getByText('Discharge Date:')).toBeInTheDocument();
  expect(screen.getByText('Admission Date:').parentElement).toHaveTextContent('2026');
  expect(screen.getByText('Discharge Date:').parentElement).toHaveTextContent('2026');
  expect(screen.queryByText(/BED-PRIVATE/)).not.toBeInTheDocument();
  expect(screen.queryByText('Ward / Bed:')).not.toBeInTheDocument();
});

 test.each([IPD_CONFIG, DAYCARE_CONFIG])('restores and preserves saved summary fields for $key', async config => {
 const admission = { id: 7, patient: { name: 'Patient' }, consultant: { id: 3 }, dischargeType: 'TRANSFER', finalDiagnosis: 'Saved diagnosis', clinicalSummary: 'Saved course', advice: 'Saved advice', followUpDate: '2026-10-10', followUpDoctor: { id: 4 }, medications: [{ medicine: 'Saved medicine' }], dischargeDateTime: '2026-10-01T12:00:00+05:30' };
 const onSaved = jest.fn();
 const api = { saveDischarge: jest.fn().mockResolvedValue(admission) };
 render(<DischargeSummary admission={admission} config={config} admissionApi={api} onSaved={onSaved}/>);
 expect(screen.getByDisplayValue('Saved diagnosis')).toBeInTheDocument();
 expect(screen.getByDisplayValue('Saved course')).toBeInTheDocument();
 expect(screen.getByDisplayValue('Saved advice')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
 await waitFor(() => expect(onSaved).toHaveBeenCalledWith(admission));
 expect(api.saveDischarge).toHaveBeenCalledWith(7, expect.objectContaining({ finalDiagnosis: 'Saved diagnosis', clinicalSummary: 'Saved course', medications: admission.medications, dischargeType: 'TRANSFER', followUpDoctorId: 4 }));
 });
