import { useEffect, useState } from 'react';
import { Icon } from './Icon';

export function SessionExpiredModal({ user, message, onRelogin, onLogout }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.getElementById('session-password')?.focus();
  }, []);

  const submit = async event => {
    event.preventDefault();
    if (!password) {
      setError('Enter your password to continue.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onRelogin({ username: user.username, password, role: user.role });
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in. Check your password and try again.');
      setPassword('');
      window.setTimeout(() => document.getElementById('session-password')?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="session-expired-backdrop" role="presentation">
    <form className="session-expired-modal" role="dialog" aria-modal="true" aria-labelledby="session-expired-title" onSubmit={submit}>
      <div className="session-expired-icon"><Icon name="lock" size={26}/></div>
      <span>SECURE SESSION</span>
      <h2 id="session-expired-title">Session expired</h2>
      <p>{message || 'For your security, your session timed out. Sign in again to continue without losing the information already entered in this form.'}</p>
      <label><span>User</span><div><Icon name="user" size={16}/><input aria-label="Session user" value={user?.username || ''} readOnly/></div></label>
      <label><span>Password</span><div><Icon name="lock" size={16}/><input id="session-password" aria-label="Re-enter password" type="password" value={password} onChange={event => { setPassword(event.target.value); setError(''); }} autoComplete="current-password" placeholder="Enter your password"/></div></label>
      {error && <div className="session-expired-error" role="alert">{error}</div>}
      <button className="primary session-continue" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in and continue'} {!submitting && <Icon name="chevron" size={16}/>}</button>
      <button className="session-logout" type="button" onClick={onLogout}>Return to sign-in page</button>
      <small><Icon name="info" size={13}/> Your open page and entered form values will be preserved.</small>
    </form>
  </div>;
}
