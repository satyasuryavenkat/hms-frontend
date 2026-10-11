import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BillHistory, BillingWorkspace, loadPreviousBills, hospitalDate } from './BillHistory';
import { opApi, labApi, pharmacyApi, ipdApi, daycareApi, billingHistoryApi } from '../api/services';

jest.mock('../api/services', () => ({
  billingHistoryApi: { list: jest.fn() },
  opApi: { search: jest.fn(), receipt: jest.fn() },
  labApi: { orders: jest.fn(), getOrder: jest.fn() },
  pharmacyApi: { sales: jest.fn(), sale: jest.fn() },
  ipdApi: { searchAdmissions: jest.fn(), getAdmission: jest.fn(), finalBill: jest.fn() },
  daycareApi: { searchAdmissions: jest.fn(), getAdmission: jest.fn(), finalBill: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  billingHistoryApi.list.mockImplementation(async (section, { query, page, size }) => {
    if (section === 'ipd' || section === 'daycare') {
      const rows = await (section === 'ipd' ? ipdApi : daycareApi).searchAdmissions(query, '');
      return { content: rows.map(record => ({ record })), totalPages: 1 };
    }
    const response = await ({ op: opApi.search, lab: labApi.orders, pharmacy: pharmacyApi.sales })[section]({ query, page, size });
    return { ...response, content: response.content.map(record => ({ record })) };
  });
});

test('opens the preview as a focused modal and restores focus on Escape', async () => {
  const order = { id: 1, orderNumber: 'LAB-MODAL', patient: { name: 'Patient' }, paymentStatus: 'PAID', paidAmount: 20, tests: [] };
  labApi.orders.mockResolvedValue({ content: [order], totalPages: 1 });
  labApi.getOrder.mockResolvedValue(order);
  render(<BillHistory section="lab"/>);
  const trigger = await screen.findByRole('button', { name: 'View bill' });
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog', { name: 'Saved document preview' });
  expect(dialog).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: 'Close preview' })).toHaveFocus();
  fireEvent.keyDown(document.activeElement, { key: 'Tab' });
  expect(screen.getByRole('button', { name: 'Print bill' })).toHaveFocus();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe('');
  expect(trigger).toHaveFocus();
});

test.each(['ipd', 'daycare'])('%s prints the saved final summary separately from the final bill', async section => {
  const api = section === 'ipd' ? ipdApi : daycareApi;
  const admission = { id: 9, ipdNumber: 'ADM-9', patient: { name: 'Saved Patient' }, settledAt: '2026-01-01', status: 'DISCHARGED', dischargeDraft: true, finalDiagnosis: 'Saved diagnosis', clinicalSummary: 'Saved clinical course', advice: 'Saved advice', medications: [{ medicine: 'Saved medicine', dose: 'One', frequency: 'Daily' }] };
  api.searchAdmissions.mockResolvedValue([admission]);
  api.getAdmission.mockResolvedValue(admission);
  api.finalBill.mockResolvedValue({ invoiceNumber: 'INV-9', settledAt: '2026-01-01', paymentStatus: 'PAID', paidAmount: 100, charges: [] });
  window.print = jest.fn();
  render(<BillHistory section={section}/>);
  fireEvent.click(await screen.findByText('View bill'));
  fireEvent.click(await screen.findByRole('button', { name: 'Final summary' }));
  expect(screen.getByText('Saved diagnosis')).toBeInTheDocument();
  expect(screen.getByText('Saved clinical course')).toBeInTheDocument();
  expect(screen.getByText('Saved medicine')).toBeInTheDocument();
  expect(document.querySelectorAll('.bill-history-preview .print-receipt')).toHaveLength(1);
  expect(document.querySelector('.bill-history-preview .ipd-final-print')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Print final summary' }));
  expect(window.print).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Final bill', exact: true }));
  expect(document.querySelector('.bill-history-preview .ipd-discharge-print')).toBeNull();
  expect(screen.getByRole('button', { name: 'Print bill' })).toBeInTheDocument();
});

test.each(['ipd', 'daycare'])('%s rejects an unsettled draft from a stale history list', async section => {
  const api = section === 'ipd' ? ipdApi : daycareApi;
  const admission = { id: 10, patient: { name: 'Active Patient' }, dischargeDraftSavedAt: '2026-01-01', status: 'DISCHARGE_PLANNED', finalDiagnosis: 'Draft diagnosis', clinicalSummary: 'Draft notes', dischargeDraft: true };
  api.searchAdmissions.mockResolvedValue([admission]);
  api.getAdmission.mockResolvedValue(admission);
  api.finalBill.mockResolvedValue({ paymentStatus: 'PENDING', charges: [] });
  window.print = jest.fn();
  render(<BillHistory section={section}/>);
  fireEvent.click(await screen.findByText('View bill'));
  expect(await screen.findByRole('alert')).toHaveTextContent('no longer settled');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test.each(['op', 'lab', 'pharmacy', 'ipd', 'daycare'])('%s search sends the entered query and can clear it', async section => {
  const admission = section === 'ipd' || section === 'daycare';
  const search = { op: opApi.search, lab: labApi.orders, pharmacy: pharmacyApi.sales, ipd: ipdApi.searchAdmissions, daycare: daycareApi.searchAdmissions }[section];
  search.mockResolvedValue(admission ? [] : { content: [], totalPages: 1 });
  render(<BillHistory section={section}/>);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search previous bills' }), { target: { value: 'UHID-123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
  await waitFor(() => expect(search).toHaveBeenLastCalledWith(...(admission ? ['UHID-123', ''] : [{ query: 'UHID-123', page: 0, size: 20 }])));
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }));
  await waitFor(() => expect(search).toHaveBeenLastCalledWith(...(admission ? ['', ''] : [{ query: '', page: 0, size: 20 }])));
  expect(screen.getByRole('searchbox')).toHaveValue('');
});

test('opens saved lab amounts and prints without creating a new bill', async () => {
  const order = { id: 1, orderNumber: 'LAB-OLD', patient: { name: 'Previous patient', age: 30 }, paymentStatus: 'PAID', paidAmount: 125, createdAt: '2026-01-01', tests: [{ testId: 8, name: 'Saved test', amount: 125 }] };
  labApi.orders.mockResolvedValue({ content: [order], totalPages: 1 });
  labApi.getOrder.mockResolvedValue(order);
  window.print = jest.fn();
  render(<BillHistory section="lab"/>);
  fireEvent.click(await screen.findByText('View bill'));
  fireEvent.click(await screen.findByText('Print bill'));
  expect(labApi.getOrder).toHaveBeenCalledWith(1);
  expect(screen.getByText('Saved test')).toBeInTheDocument();
  expect(screen.getByText('125.00')).toBeInTheDocument();
  expect(window.print).toHaveBeenCalledTimes(1);
});

test('preserves current draft while browsing history and shows request failures', async () => {
  opApi.search.mockRejectedValue(new Error('Unable to load bills'));
  render(<BillingWorkspace section="op"><input aria-label="Draft" defaultValue="Unsaved patient"/></BillingWorkspace>);
  fireEvent.click(screen.getByText('Previous bills'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Unable to load bills'));
  expect(screen.getByLabelText('Draft').parentElement).toHaveClass('billing-workspace-hidden');
  fireEvent.click(screen.getByText('Current billing'));
  expect(screen.getByLabelText('Draft')).toHaveValue('Unsaved patient');
});

test('history sends date ranges to the backend before pagination', async () => {
  billingHistoryApi.list.mockResolvedValue({ content: [{ record: { id: 4 } }], totalPages: 3 });
  expect(await loadPreviousBills('lab', 'patient', 2, { startDate: '2026-01-01', endDate: '2026-01-31' })).toEqual({ content: [{ id: 4 }], totalPages: 3 });
  expect(billingHistoryApi.list).toHaveBeenCalledWith('lab', { query: 'patient', page: 2, size: 20, startDate: '2026-01-01', endDate: '2026-01-31' });
});
test.each(['op', 'ipd', 'daycare', 'lab', 'pharmacy'])('%s supports today, yesterday and inclusive custom dates', async section => {
  billingHistoryApi.list.mockResolvedValue({ content: [], totalPages: 0 });
  render(<BillHistory section={section}/>);
  fireEvent.click(screen.getByRole('button', { name: 'Today', exact: true }));
  await waitFor(() => expect(billingHistoryApi.list).toHaveBeenLastCalledWith(section, expect.objectContaining({ startDate: hospitalDate(), endDate: hospitalDate(), page: 0 })));
  fireEvent.click(screen.getByRole('button', { name: 'Yesterday' }));
  await waitFor(() => expect(billingHistoryApi.list).toHaveBeenLastCalledWith(section, expect.objectContaining({ startDate: hospitalDate(-1), endDate: hospitalDate(-1) })));
  fireEvent.change(screen.getByLabelText('Bill start date'), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText('Bill end date'), { target: { value: '2026-01-31' } });
  await waitFor(() => expect(billingHistoryApi.list).toHaveBeenLastCalledWith(section, expect.objectContaining({ startDate: '2026-01-01', endDate: '2026-01-31' })));
  fireEvent.change(screen.getByLabelText('Bill start date'), { target: { value: '2026-02-01' } });
  expect(screen.getByRole('alert')).toHaveTextContent('Select both dates');
  fireEvent.click(screen.getByRole('button', { name: 'All dates' }));
  await waitFor(() => expect(billingHistoryApi.list).toHaveBeenLastCalledWith(section, expect.objectContaining({ startDate: '', endDate: '' })));
});
