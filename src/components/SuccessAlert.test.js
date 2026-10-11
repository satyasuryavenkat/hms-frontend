import { fireEvent, render, screen } from '@testing-library/react';
import { API_SUCCESS_EVENT } from '../api/client';
import { SuccessAlert } from './SuccessAlert';

test('shows and dismisses a global success alert', () => {
  render(<SuccessAlert/>);

  fireEvent(window, new CustomEvent(API_SUCCESS_EVENT, {
    detail: { message: 'Admission saved successfully.' },
  }));

  expect(screen.getByRole('status')).toHaveTextContent('Admission saved successfully.');
  fireEvent.click(screen.getByRole('button', { name: /dismiss success message/i }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
