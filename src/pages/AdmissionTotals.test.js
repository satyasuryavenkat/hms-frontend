import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IPDBilling, DaycareBilling } from './IPDBilling';
import { ipdApi, daycareApi, labApi, doctorApi } from '../api/services';

jest.setTimeout(15000);

jest.mock('../api/services', () => {
  const api = () => ({ catalog: jest.fn().mockResolvedValue([{ category: 'ROOM', label: 'Room', services: [{ name: 'Bed', department: 'Ward', defaultRate: 100 }] }]), searchAdmissions: jest.fn(), charges: jest.fn(), finalBill: jest.fn(), updateCharge: jest.fn(), addCharge: jest.fn(), deleteCharge: jest.fn(), settle: jest.fn(), saveDischarge: jest.fn(), updateDates: jest.fn() });
  return { ipdApi: api(), daycareApi: api(), labApi: { tests: jest.fn().mockResolvedValue([{ id: 8, name: 'New test', department: 'Lab', price: 300 }]) }, doctorApi: { list: jest.fn().mockResolvedValue([]) }, patientApi: { search: jest.fn().mockResolvedValue({ content: [] }) } };
});

test.each([['IPD', IPDBilling, ipdApi], ['Daycare', DaycareBilling, daycareApi]])('%s recalculates all edited charges and blocks unsaved settlement', async (name, Page, api) => {
  api.catalog.mockResolvedValue([{ category: 'ROOM', label: 'Room', services: [{ name: 'Bed', department: 'Ward', defaultRate: 100 }] }]);
  labApi.tests.mockResolvedValue([{ id: 8, name: 'New test', department: 'Lab', price: 300 }]);
  doctorApi.list.mockResolvedValue([]);
  const charges = [{ id: 1, category: 'ROOM', description: 'Bed', department: 'Ward', quantity: 1, rate: 100, amount: 100 }, { id: 2, category: 'PHARMACY', description: 'Medicine', quantity: 1, rate: 20, amount: 20 }, { id: 3, category: 'LAB_TESTS', description: 'Old test', quantity: 1, rate: 50, amount: 50 }];
  api.searchAdmissions.mockResolvedValue([{ id: 1, admissionDateTime: '2026-09-01T10:00:00', bedNumber: 'HIDDEN-BED', patient: { name: 'Patient', uhid: 'UH-1' }, consultant: { name: 'Doctor' }, status: 'ACTIVE' }]);
  api.charges.mockResolvedValue({ charges });
  api.finalBill.mockResolvedValue({ grossCharges: 170, advanceReceived: 10, discount: 0, paymentStatus: 'PENDING' });
  const { container } = render(<Page/>);
  fireEvent.click(screen.getByRole('button', { name: 'Final billing' }));
  fireEvent.change(screen.getByLabelText(`Search ${name} admission`), { target: { value: 'Patient' } });
  fireEvent.click(await screen.findByText('Patient'));
  await screen.findByLabelText('Charge quantity 1');
  expect(screen.queryByText('HIDDEN-BED')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Discharge date'), { target: { value: '2026-08-31T12:00' } });
  expect(screen.getByRole('button', { name: 'Settle final bill' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Discharge date'), { target: { value: '2026-09-02T12:00' } });
  api.updateDates.mockImplementation(async (id, body) => ({ ...(await api.searchAdmissions())[0], ...body }));
  fireEvent.click(screen.getByRole('button', { name: 'Save dates' }));
  await screen.findByText('Admission and discharge dates saved.');
  const gross = () => container.querySelector('.settlement .summary-line b').textContent;
  expect(gross()).toContain('170');
  api.addCharge.mockResolvedValue({ id: 4, category: 'LAB_TESTS', description: 'New test', labTestId: 8, quantity: 1, rate: 300, amount: 300 });
  fireEvent.click(screen.getByRole('button', { name: 'Add lab tests' }));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Add selected tests' }));
  await waitFor(() => expect(gross()).toContain('470'));
  await waitFor(() => expect(screen.getAllByTitle('Delete charge')[2]).not.toBeDisabled());
  api.deleteCharge.mockResolvedValue(null);
  fireEvent.click(screen.getAllByTitle('Delete charge')[2]);
  await waitFor(() => expect(gross()).toContain('170'));
  await waitFor(() => expect(screen.getAllByTitle('Save charge')[0]).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText('Charge quantity 1'), { target: { value: '2' } });
  expect(gross()).toContain('270');
  fireEvent.change(screen.getByLabelText('Pharmacy quantity 1'), { target: { value: '3' } });
  expect(gross()).toContain('310');
  fireEvent.change(screen.getByLabelText('Pharmacy price 1'), { target: { value: '30' } });
  expect(gross()).toContain('340');
  fireEvent.change(screen.getByLabelText('Lab test 1'), { target: { value: '8' } });
  expect(gross()).toContain('590');
  expect(container.querySelector('.settlement .total-row strong')).toHaveTextContent('580');
  expect(screen.getByRole('button', { name: 'Settle final bill' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Print formatted final bill' })).toBeDisabled();
  api.updateCharge.mockImplementation(async (_, id, body) => ({ ...charges.find(item => item.id === id), ...body, rate: id === 3 ? 300 : (body.rate || 100) }));
  for (const button of screen.getAllByTitle('Save charge')) {
    fireEvent.click(button);
    await waitFor(() => expect(button).not.toBeDisabled());
  }
  expect(screen.getByRole('button', { name: 'Settle final bill' })).toBeEnabled();
  expect(gross()).toContain('590');
  fireEvent.change(screen.getByLabelText('Hospital services discount'), { target: { value: '20' } });
  fireEvent.change(screen.getByLabelText('Laboratory discount'), { target: { value: '30' } });
  fireEvent.change(screen.getByLabelText('Pharmacy discount'), { target: { value: '10' } });
  expect(container.querySelector('.settlement .total-row strong')).toHaveTextContent('520');
  fireEvent.change(screen.getByLabelText('Pharmacy discount'), { target: { value: '100' } });
  expect(screen.getByRole('button', { name: 'Settle final bill' })).toBeDisabled();
  expect(screen.getByRole('alert')).toHaveTextContent('cannot exceed');
  fireEvent.change(screen.getByLabelText('Pharmacy discount'), { target: { value: '10' } });
  api.settle.mockResolvedValue({ grossCharges: 590, advanceReceived: 10, paidAmount: 520, discount: 60, paymentStatus: 'PAID', hospitalDiscount: 20, laboratoryDiscount: 30, pharmacyDiscount: 10 });
  fireEvent.click(screen.getByRole('button', { name: 'Settle final bill' }));
  await waitFor(() => expect(api.settle).toHaveBeenCalledWith(1, expect.objectContaining({ dischargeDateTime: '2026-09-02T12:00:00+05:30', discount: 60, paidAmount: 520, hospitalDiscount: 20, laboratoryDiscount: 30, pharmacyDiscount: 10 })));
});

test.each([['IPD', IPDBilling, ipdApi], ['Daycare', DaycareBilling, daycareApi]])('%s finds saved drafts in final billing and edits them', async (name, Page, api) => {
 api.catalog.mockResolvedValue([]);
 labApi.tests.mockResolvedValue([]);
 doctorApi.list.mockResolvedValue([]);
 let admission = { id: 12, ipdNumber: 'DRAFT-12', admissionDateTime: '2026-09-01T10:00:00', dischargeDateTime: '2026-09-02T12:00:00+05:30', patient: { name: 'Draft Patient' }, consultant: { id: 1, name: 'Doctor' }, status: 'DISCHARGE_PLANNED', dischargeDraft: true, finalDiagnosis: 'Saved diagnosis', clinicalSummary: 'Saved course' };
 api.searchAdmissions.mockImplementation(async (_, status) => status === 'DISCHARGE_PLANNED' ? [admission] : []);
 api.charges.mockResolvedValue({ charges: [] });
 api.finalBill.mockResolvedValue({ paymentStatus: 'PENDING' });
 api.saveDischarge.mockImplementation(async (_, form) => (admission = { ...admission, ...form }));
 render(<Page currentUser={{ id: 1 }}/>);
 fireEvent.click(screen.getByRole('button', { name: 'Final billing' }));
 fireEvent.click(await screen.findByText('Draft Patient'));
 const edit = await screen.findByRole('button', { name: 'Edit saved draft' });
 await waitFor(() => expect(edit).toBeEnabled());
 fireEvent.click(edit);
 fireEvent.change(screen.getByDisplayValue('Saved course'), { target: { value: 'Updated course' } });
 fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
 await waitFor(() => expect(api.saveDischarge).toHaveBeenCalledWith(12, expect.objectContaining({ clinicalSummary: 'Updated course' })));
 await screen.findByText(/draft saved/);
 fireEvent.click(screen.getByRole('button', { name: 'Final billing' }));
 fireEvent.click(screen.getByRole('button', { name: 'Edit saved draft' }));
 expect(screen.getByDisplayValue('Updated course')).toBeInTheDocument();
});
