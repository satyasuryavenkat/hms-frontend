import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Overview } from './Overview';
import { overviewApi } from '../api/services';
jest.mock('../api/services', () => ({ overviewApi: { get: jest.fn(), records: jest.fn(), currentBeds: jest.fn() } }));

const empty = { newPatients: 0, patientsServed: 0, billed: 0, collected: 0,
  departments: ['op', 'ipd', 'daycare', 'lab'].map(id => ({ id, count: 0, records: 0, billed: 0, collected: 0 })) };
beforeEach(() => { jest.clearAllMocks(); overviewApi.get.mockResolvedValue(empty); overviewApi.currentBeds.mockResolvedValue([]); });

test('applies selected dates and shows the empty state', async () => {
  render(<Overview/>);
  await screen.findByText(/No visits, admissions or lab orders/);
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-01-31' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
  await waitFor(() => expect(overviewApi.get).toHaveBeenLastCalledWith('2026-01-01', '2026-01-31'));
  await screen.findByText(/No visits, admissions or lab orders/);
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-02-01' } });
  expect(screen.getByRole('button', { name: 'Apply dates' }).disabled).toBe(true);
});

test('shows errors and retries instead of showing invented zero totals', async () => {
  overviewApi.get.mockRejectedValueOnce(new Error('Cannot load overview'));
  render(<Overview/>);
  await screen.findByRole('alert');
  expect(screen.queryByText('Total billed')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Total billed');
});

const bedPatients = [
  { admissionId: 1, admissionNumber: 'IPD-001', careType: 'IPD', status: 'ACTIVE', ward: 'General', bedNumber: 'G-01', patientName: 'Anita Rao', uhid: 'HMS-001', age: 42, gender: 'FEMALE', mobile: '9000000001', consultantName: 'Dr. Kumar', admissionDateTime: '2025-01-01T10:30:00', diagnosis: 'Observation', attendantName: 'Ravi', attendantMobile: '9000000002' },
  { admissionId: 2, admissionNumber: 'DC-002', careType: 'DAYCARE', status: 'DISCHARGE_PLANNED', ward: 'Observation', bedNumber: 'D-02', patientName: 'Vijay Singh', consultantName: 'Dr. Meera' },
];
test('opens current bed patients and searches details independently of reporting dates', async () => {
  overviewApi.currentBeds.mockResolvedValue(bedPatients);
  render(<Overview/>);
  await screen.findByText('Total billed');
  fireEvent.click(screen.getByRole('button', { name: /Current bed patients/ }));
  await screen.findByText('Anita Rao');
  expect(screen.getByText('Vijay Singh')).toBeInTheDocument();
  expect(screen.getByText('Awaiting discharge')).toBeInTheDocument();
  expect(screen.getByText('Dr. Kumar')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search current bed patients'), { target: { value: 'g-01 kumar' } });
  expect(screen.getByText('Anita Rao')).toBeInTheDocument();
  expect(screen.queryByText('Vijay Singh')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search current bed patients'), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Bed patient care type'), { target: { value: 'DAYCARE' } });
  expect(screen.getByText('Vijay Singh')).toBeInTheDocument();
  expect(screen.queryByText('Anita Rao')).not.toBeInTheDocument();
  overviewApi.currentBeds.mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh patients' }));
  await screen.findByText('No patients currently occupy an IPD bed or day care chair / bed.');
});

test('shows a bed occupancy error and can refresh it', async () => {
  overviewApi.currentBeds.mockRejectedValue(new Error('Bed list unavailable'));
  render(<Overview/>);
  await screen.findByText(/Bed list unavailable/);
  fireEvent.click(screen.getByRole('button', { name: /Current bed patients/ }));
  await screen.findByText(/Use Refresh patients/);
  overviewApi.currentBeds.mockResolvedValue(bedPatients);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh patients' }));
  await screen.findByText('Anita Rao');
});

test.each([['op','Outpatient'], ['ipd','IPD'], ['daycare','Day Care'], ['lab','Laboratory']])('opens %s details for the selected overview dates', async (section, name) => {
  overviewApi.records.mockResolvedValue({ content: [{ record: { id: 1, patient: { name: 'Detail Patient', uhid: 'UH-DETAIL', mobile: '9876543210' }, totalPayable: 100, paidAmount: 90, paymentStatus: 'PAID' } }], totalElements: 1, totalPages: 1 });
  render(<Overview/>);
  const card = await screen.findByRole('button', { name: 'View ' + name + ' details' });
  fireEvent.click(card);
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  await screen.findByText('Detail Patient');
  expect(overviewApi.records).toHaveBeenCalledWith(section, expect.objectContaining({ startDate: screen.getByLabelText('Start date').value, endDate: screen.getByLabelText('End date').value, page: 0 }));
  fireEvent.click(screen.getByText('Detail Patient'));
  expect(screen.getByText('9876543210')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
