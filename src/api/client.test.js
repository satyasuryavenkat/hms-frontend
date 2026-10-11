import { apiRequest, API_SUCCESS_EVENT, SESSION_EXPIRED_EVENT, tokenStore } from './client';

const response = payload => Promise.resolve({
  ok: true,
  status: 200,
  json: () => Promise.resolve(payload),
});

beforeEach(() => {
  tokenStore.clear();
  global.fetch = jest.fn();
});

test('announces the server success message after a form mutation', async () => {
  const listener = jest.fn();
  window.addEventListener(API_SUCCESS_EVENT, listener);
  global.fetch.mockReturnValue(response({ success: true, message: 'IPD admission completed', data: { id: 7 } }));

  await apiRequest('/ipd-admissions', { method: 'POST', body: { patientId: 1 } });

  expect(listener).toHaveBeenCalledTimes(1);
  expect(listener.mock.calls[0][0].detail.message).toBe('IPD admission completed');
  window.removeEventListener(API_SUCCESS_EVENT, listener);
});

test('does not announce read-only requests', async () => {
  const listener = jest.fn();
  window.addEventListener(API_SUCCESS_EVENT, listener);
  global.fetch.mockReturnValue(response({ success: true, message: 'Loaded', data: [] }));

  await apiRequest('/patients');

  expect(listener).not.toHaveBeenCalled();
  window.removeEventListener(API_SUCCESS_EVENT, listener);
});

test('opens the session-expired flow when token refresh fails', async () => {
  const listener = jest.fn();
  let expired;
  const expiredEvent = new Promise(resolve => { expired = resolve; });
  const handleExpired = event => { listener(event); expired(); };
  window.addEventListener(SESSION_EXPIRED_EVENT, handleExpired);
  tokenStore.set({ accessToken: 'expired-access', refreshToken: 'expired-refresh' });
  global.fetch
    .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({ success: false, message: 'Unauthorized' }) })
    .mockResolvedValueOnce({ ok: false, status: 400, json: () => Promise.resolve({ success: false, message: 'Refresh token expired' }) })
    .mockResolvedValueOnce(response({ success: true, message: 'Loaded', data: [{ id: 1 }] }));

  const pendingRequest = apiRequest('/patients');
  await expiredEvent;

  expect(listener).toHaveBeenCalledTimes(1);
  expect(tokenStore.getAccess()).toBeNull();
  expect(tokenStore.getRefresh()).toBeNull();
  tokenStore.set({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  await expect(pendingRequest).resolves.toEqual([{ id: 1 }]);
  expect(global.fetch).toHaveBeenCalledTimes(3);
  window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpired);
});
