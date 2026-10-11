import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';

const ok = data => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ success: true, message: 'OK', data }) });

beforeEach(() => {
  sessionStorage.clear();
  global.fetch = jest.fn((url, options = {}) => {
    if (url.includes('/auth/login')) return ok({ accessToken: 'access-token', refreshToken: 'refresh-token', tokenType: 'Bearer', expiresIn: 3600, user: { id: 1, username: 'admin@medora.in', displayName: 'Admin', role: 'ADMINISTRATOR', initials: 'A', permissions: [] } });
    if (url.includes('/overview')) return ok({ newPatients: 0, patientsServed: 0, billed: 0, collected: 0, departments: [] });
    if (url.includes('/auth/logout')) return ok(null);
    if (url.includes('/doctors')) return ok([]);
    if (url.includes('/lab-tests')) return ok([]);
    if (url.includes('/ipd-charge-catalog')) return ok([]);
    if (url.includes('/daycare-admissions/charge-catalog')) return ok([]);
    if (url.includes('/users')) return ok([]);
    if (url.includes('/patients/search')) return ok({ content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 });
    return ok(null);
  });
});

afterEach(() => jest.restoreAllMocks());

test('authenticates against the backend and loads all hospital modules', async () => {
  render(<App/>);
  fireEvent.change(screen.getByLabelText('Email or user ID'), { target: { value: 'admin@medora.in' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'admin123' } });
  fireEvent.click(screen.getByRole('button', { name: /Sign in securely/i }));

  expect(await screen.findByRole('heading', { name: /Hospital Overview/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /OP Billing Registration/i }));
  expect(await screen.findByRole('heading', { name: /OP Billing & Registration/i })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/auth/login'), expect.objectContaining({ method: 'POST' }));
  expect(screen.getByText('Admin')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Lab Services/i }));
  expect(await screen.findByRole('heading', { name: /Lab Billing & Reporting/i })).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/lab-tests'), expect.any(Object)));

  fireEvent.click(screen.getByRole('button', { name: /IPD Billing/i }));
  expect(await screen.findByRole('heading', { name: /IPD Billing & Discharge/i })).toBeInTheDocument();
  expect(screen.getByText(/Patient admission/i)).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/ipd-charge-catalog'), expect.any(Object)));

  fireEvent.click(screen.getByRole('button', { name: /Daycare Admission & billing/i }));
  expect(await screen.findByRole('heading', { name: /Daycare Admission & Billing/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Daycare admission' })).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/daycare-admissions/charge-catalog'), expect.any(Object)));

  fireEvent.click(screen.getByRole('button', { name: /Admin Configuration/i }));
  expect(await screen.findByRole('heading', { name: /Manage doctors/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Add doctor/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Patients Patient records/i }));
  expect(await screen.findByRole('heading', { name: /All patients/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Lab tests Catalog & prices/i }));
  expect(await screen.findByRole('heading', { name: /Manage lab tests/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Users Access & roles/i }));
  expect(await screen.findByRole('heading', { name: /Manage users/i })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Log out/i }));
  expect(await screen.findByRole('heading', { name: 'Sign in to Lakshmi Sreenivaasa' })).toBeInTheDocument();
});

test('re-authenticates in a session-expired modal without unmounting the open page', async () => {
  render(<App/>);
  fireEvent.change(screen.getByLabelText('Email or user ID'), { target: { value: 'admin@medora.in' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'admin123' } });
  fireEvent.click(screen.getByRole('button', { name: /Sign in securely/i }));
  expect(await screen.findByRole('heading', { name: /Hospital Overview/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /OP Billing Registration/i }));
  expect(await screen.findByRole('heading', { name: /OP Billing & Registration/i })).toBeInTheDocument();

  fireEvent(window, new CustomEvent('hms:session-expired', { detail: { message: 'Session refresh failed' } }));

  expect(await screen.findByRole('dialog', { name: 'Session expired' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /OP Billing & Registration/i })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Re-enter password'), { target: { value: 'admin123' } });
  fireEvent.click(screen.getByRole('button', { name: /Sign in and continue/i }));
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Session expired' })).not.toBeInTheDocument());
  expect(screen.getByRole('heading', { name: /OP Billing & Registration/i })).toBeInTheDocument();
});
