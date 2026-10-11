// Keep development requests on the frontend origin. Create React App forwards
// /api requests to the Spring Boot server through the proxy in package.json,
// avoiding browser CORS failures during local development.
const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '/api/v1').replace(/\/$/, '');

const ACCESS_TOKEN_KEY = 'medora-access-token';
const REFRESH_TOKEN_KEY = 'medora-refresh-token';
export const API_SUCCESS_EVENT = 'hms:api-success';
export const SESSION_EXPIRED_EVENT = 'hms:session-expired';
let refreshRequest = null;
let sessionExpiredNotified = false;
let sessionRestoreRequest = null;
let restoreSession = null;

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors || {};
  }
}

export const tokenStore = {
  getAccess: () => sessionStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => sessionStorage.getItem(REFRESH_TOKEN_KEY),
  set: ({ accessToken, refreshToken }) => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    sessionExpiredNotified = false;
    if (restoreSession) restoreSession();
    sessionRestoreRequest = null;
    restoreSession = null;
  },
  clear: () => {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

function notifySessionExpired(message = 'For your security, your session has expired. Sign in again to continue without losing the information already entered in this form.') {
  tokenStore.clear();
  if (sessionExpiredNotified) return;
  sessionExpiredNotified = true;
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { message } }));
}

function waitForSessionRestore() {
  if (!sessionRestoreRequest) {
    sessionRestoreRequest = new Promise(resolve => { restoreSession = resolve; });
  }
  return sessionRestoreRequest;
}

function buildUrl(path, query) {
  const endpoint = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const url = new URL(endpoint, window.location.origin);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  return url.toString();
}

async function refreshAccessToken() {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) throw new ApiError('Your session has expired. Please sign in again.', 401);
  if (!refreshRequest) {
    refreshRequest = fetch(buildUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).then(async response => {
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) throw new ApiError(payload?.message || 'Session refresh failed', response.status, payload?.errors);
      tokenStore.set(payload.data);
      return payload.data.accessToken;
    }).finally(() => { refreshRequest = null; });
  }
  return refreshRequest;
}

export async function apiRequest(path, options = {}) {
  const { query, body, auth = true, retry = true, headers = {}, responseType = 'json', notifySuccess = true } = options;
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (auth && tokenStore.getAccess()) requestHeaders.Authorization = `Bearer ${tokenStore.getAccess()}`;
  const response = await fetch(buildUrl(path, query), {
    method: options.method || 'GET',
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => { throw new ApiError(`Cannot connect to the HMS backend through ${API_BASE_URL}`, 0); });

  if (response.status === 401 && auth && retry) {
    if (tokenStore.getRefresh()) {
      try {
        await refreshAccessToken();
        return apiRequest(path, { ...options, retry: false });
      } catch {
        notifySessionExpired();
        await waitForSessionRestore();
        return apiRequest(path, { ...options, retry: false });
      }
    }
    notifySessionExpired();
    await waitForSessionRestore();
    return apiRequest(path, { ...options, retry: false });
  }
  if (responseType === 'blob') {
    if (!response.ok) throw new ApiError('Unable to download document', response.status);
    return response.blob();
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    if (response.status === 401 && auth) notifySessionExpired(payload?.message);
    const validationMessage = payload?.errors ? Object.values(payload.errors)[0] : null;
    throw new ApiError(validationMessage || payload?.message || `Request failed (${response.status})`, response.status, payload?.errors);
  }
  const method = (options.method || 'GET').toUpperCase();
  if (notifySuccess && method !== 'GET' && !path.startsWith('/auth/')) {
    window.dispatchEvent(new CustomEvent(API_SUCCESS_EVENT, {
      detail: { message: payload.message || 'Saved successfully.' },
    }));
  }
  return payload.data;
}

export { API_BASE_URL };
