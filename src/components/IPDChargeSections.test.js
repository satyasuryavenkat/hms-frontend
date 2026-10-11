import { fireEvent, render, screen } from '@testing-library/react';
import { pharmacyApi } from '../api/services';
import { LabTestsDialog, PharmacyItemsDialog } from './IPDChargeSections';

jest.mock('../api/services', () => ({ pharmacyApi: { medicines: jest.fn() } }));
beforeEach(() => pharmacyApi.medicines.mockResolvedValue([]));

test('adds selected lab tests as single billing units', () => {
  const onAdd = jest.fn();
  const tests = [
    { id: 1, name: 'Complete Blood Count', department: 'Haematology', price: 450 },
    { id: 2, name: 'Blood Sugar', department: 'Biochemistry', price: 180 },
  ];
  render(<LabTestsDialog tests={tests} busy={false} onClose={jest.fn()} onAdd={onAdd}/>);

  fireEvent.click(screen.getByRole('checkbox', { name: /complete blood count/i }));
  fireEvent.click(screen.getByRole('button', { name: /add selected tests/i }));

  expect(onAdd).toHaveBeenCalledWith([tests[0]]);
});


test('adds manual pharmacy items with quantities', async () => {
  const onAdd = jest.fn();
  render(<PharmacyItemsDialog busy={false} onClose={jest.fn()} onAdd={onAdd}/>);
  await screen.findByText(/No matching medicines/);
  fireEvent.click(screen.getByRole('button', { name: 'Add unlisted item' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Pharmacy item 1' }), { target: { value: 'Injection set' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Pharmacy item quantity 1' }), { target: { value: '3' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Pharmacy item price 1' }), { target: { value: '125' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add unlisted item' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Pharmacy item 2' }), { target: { value: 'Syringe' } });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Pharmacy item price 2' }), { target: { value: '30' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add 2 items to bill' }));
  expect(onAdd).toHaveBeenCalledWith([{ description: 'Injection set', quantity: 3, rate: 125 }, { description: 'Syringe', quantity: 1, rate: 30 }]);
});

test('selects a search result and validates quantity before billing', async () => {
  pharmacyApi.medicines.mockResolvedValue([{ id: 7, name: 'Paracetamol', unitPrice: 12 }]);
  const onAdd = jest.fn();
  render(<PharmacyItemsDialog busy={false} onClose={jest.fn()} onAdd={onAdd}/>);
  fireEvent.click(await screen.findByRole('option', { name: /Paracetamol/ }));
  expect(screen.getByRole('spinbutton', { name: 'Pharmacy item price 1' })).toHaveValue(12);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Pharmacy item quantity 1' }), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add 1 item to bill' }));
  expect(onAdd).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('quantity greater than zero');
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Pharmacy item quantity 1' }), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add 1 item to bill' }));
  expect(onAdd).toHaveBeenCalledWith([{ description: 'Paracetamol', quantity: 4, rate: 12 }]);
  fireEvent.click(screen.getByRole('button', { name: 'Remove item 1' }));
  expect(screen.getByText('No items selected')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add 0 items to bill' })).toBeDisabled();
});

test('filters visible dropdown results by name and type and supports keyboard selection', async () => {
  pharmacyApi.medicines.mockResolvedValue([
    { id: 1, name: 'Paracetamol', type: 'TABLET', unitPrice: 10 },
    { id: 2, name: 'Cough medicine', type: 'SYRUP', unitPrice: 30 },
    { id: 3, name: 'Cough relief', type: 'SYRUP', unitPrice: 40 },
  ]);
  const { container } = render(<PharmacyItemsDialog busy={false} onClose={jest.fn()} onAdd={jest.fn()}/>);
  await screen.findByRole('option', { name: /Paracetamol/ });
  const search = screen.getByRole('combobox', { name: 'Search pharmacy medicines' });
  expect(container.querySelector('select')).toBeNull();
  fireEvent.change(search, { target: { value: '  SYRUP cough  ' } });
  expect(screen.queryByRole('option', { name: /Paracetamol/ })).not.toBeInTheDocument();
  expect(screen.getAllByRole('option')).toHaveLength(2);
  fireEvent.keyDown(search, { key: 'ArrowDown' });
  fireEvent.keyDown(search, { key: 'Enter' });
  expect(screen.getByText('Cough relief')).toBeInTheDocument();
  expect(screen.getByRole('spinbutton', { name: 'Pharmacy item price 1' })).toHaveValue(40);
  fireEvent.change(search, { target: { value: 'unknown' } });
  expect(screen.getByText(/No matching medicines/)).toBeInTheDocument();
  expect(screen.getByRole('spinbutton', { name: 'Pharmacy item price 1' })).toHaveValue(40);
  fireEvent.click(screen.getByRole('button', { name: 'Add unlisted item' }));
  expect(screen.getByRole('textbox', { name: 'Pharmacy item 2' })).toHaveValue('unknown');
});

test('allows manual entry when the medicine catalog fails to load', async () => {
  pharmacyApi.medicines.mockRejectedValue(new Error('Unavailable'));
  render(<PharmacyItemsDialog busy={false} onClose={jest.fn()} onAdd={jest.fn()}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load medicines');
  fireEvent.click(screen.getByRole('button', { name: 'Add unlisted item' }));
  expect(screen.getByRole('textbox', { name: 'Pharmacy item 1' })).toBeInTheDocument();
});
