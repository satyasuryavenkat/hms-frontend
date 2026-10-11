import { fireEvent, render, screen } from '@testing-library/react';
import { AdmissionDates } from './AdmissionDates';

test.each(['ACTIVE', 'DISCHARGED'])('saves date corrections for a settled %s visit without changing payments', async status => {
  const admission = { id: 1, status, settledAt: '2026-09-02T12:00:00+05:30', admissionDateTime: '2026-09-01T10:00:00', dischargeDateTime: '2026-09-02T12:00:00+05:30' };
  const api = { updateDates: jest.fn().mockResolvedValue({ ...admission, admissionDateTime: '2026-09-01T09:00:00', dischargeDateTime: '2026-09-03T13:00:00+05:30' }) };
  const onSaved = jest.fn();
  render(<AdmissionDates admission={admission} api={api} onSaved={onSaved}/>);
  expect(screen.getByLabelText('Admission date')).toBeEnabled();
  expect(screen.getByLabelText('Discharge date')).toBeEnabled();
  fireEvent.change(screen.getByLabelText('Admission date'), { target: { value: '2026-09-01T09:00' } });
  fireEvent.change(screen.getByLabelText('Discharge date'), { target: { value: '2026-09-03T13:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save dates' }));
  await screen.findByText('Admission and discharge dates saved.');
  expect(api.updateDates).toHaveBeenCalledWith(1, { admissionDateTime: '2026-09-01T09:00:00', dischargeDateTime: '2026-09-03T13:00:00+05:30' });
  expect(onSaved).toHaveBeenCalled();
});

test('rejects reversed dates and preserves entered dates after a failed save', async () => {
  const api = { updateDates: jest.fn().mockRejectedValue(new Error('Unable to save dates')) };
  render(<AdmissionDates admission={{ id: 1, admissionDateTime: '2026-09-01T10:00:00' }} api={api} onSaved={jest.fn()}/>);
  fireEvent.change(screen.getByLabelText('Discharge date'), { target: { value: '2026-08-31T12:00' } });
  expect(screen.getByRole('button', { name: 'Save dates' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Discharge date'), { target: { value: '2026-09-02T12:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save dates' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to save dates');
  expect(screen.getByLabelText('Discharge date')).toHaveValue('2026-09-02T12:00');
});
