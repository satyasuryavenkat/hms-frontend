import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminConfiguration } from './AdminConfiguration';
import { doctorApi, ipdApi, pharmacyApi } from '../api/services';

jest.mock('../components/LabReportEditor', () => ({ LabReportEditorDialog: () => null }));
jest.mock('../api/services', () => ({
  doctorApi: { list: jest.fn() },
  pharmacyApi: { medicines: jest.fn(), createMedicine: jest.fn() },
  ipdApi: { catalogItems: jest.fn(), createCatalogItem: jest.fn(), updateCatalogItem: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  doctorApi.list.mockResolvedValue([]);
  pharmacyApi.medicines.mockResolvedValue([]);
  pharmacyApi.createMedicine.mockResolvedValue({});
  ipdApi.catalogItems.mockResolvedValue([]);
  ipdApi.createCatalogItem.mockResolvedValue({});
  ipdApi.updateCatalogItem.mockResolvedValue({});
});

test('creates an IPD service without asking for a department', async () => {
  render(<AdminConfiguration/>);
  fireEvent.click(screen.getByRole('button', { name: /IPD charges/i }));
  await screen.findByText('No IPD charge configurations found');
  expect(screen.queryByRole('columnheader', { name: 'Department' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add IPD charge' }));
  expect(screen.queryByLabelText(/Department/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Category *'), { target: { value: 'Room Charges' } });
  fireEvent.change(screen.getByLabelText('Service name *'), { target: { value: 'General ward' } });
  fireEvent.change(screen.getByLabelText('Charges *'), { target: { value: '900' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create charge' }));
  await waitFor(() => expect(ipdApi.createCatalogItem).toHaveBeenCalledWith({ category: 'Room Charges', serviceName: 'General ward', department: 'Inpatient Services', defaultRate: 900, active: true }));
});

test('editing retains the existing service department internally', async () => {
  ipdApi.catalogItems.mockResolvedValue([{ id: 1, category: 'Procedure', serviceName: 'Dressing', department: 'Surgery', defaultRate: 300, active: true }]);
  render(<AdminConfiguration/>);
  fireEvent.click(screen.getByRole('button', { name: /IPD charges/i }));
  fireEvent.click(await screen.findByRole('button', { name: 'Edit' }));
  expect(screen.queryByLabelText(/Department/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Charges *'), { target: { value: '350' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update charge' }));
  await waitFor(() => expect(ipdApi.updateCatalogItem).toHaveBeenCalledWith(1, expect.objectContaining({ department: 'Surgery', defaultRate: 350 })));
});

test('medicine creation asks only for name, type, unit price and status', async () => {
  const { container } = render(<AdminConfiguration/>);
  fireEvent.click(screen.getByRole('button', { name: /Medicines Pharmacy inventory/i }));
  await screen.findByText('No medicines found');
  fireEvent.click(screen.getByRole('button', { name: 'Add medicine' }));
  expect(container.querySelectorAll('.admin-dialog input, .admin-dialog select, .admin-dialog textarea')).toHaveLength(4);
  fireEvent.change(screen.getByLabelText('Medicine name *'), { target: { value: 'Paracetamol' } });
  fireEvent.change(screen.getByLabelText('Type *'), { target: { value: 'SYRUP' } });
  fireEvent.change(screen.getByLabelText('Unit price *'), { target: { value: '25' } });
  fireEvent.click(screen.getByRole('button', { name: 'Create medicine' }));
  await waitFor(() => expect(pharmacyApi.createMedicine).toHaveBeenCalledWith({ name: 'Paracetamol', type: 'SYRUP', unitPrice: 25, active: true }));
});
