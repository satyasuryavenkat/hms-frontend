import { useState } from 'react';
import { Icon } from '../components/Icon';
import { HospitalLogo } from '../components/HospitalLogo';

export function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '', role: 'ADMINISTRATOR' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
    setError('');
  };

  const submit = async event => {
    event.preventDefault();
    if (!form.email.trim() || !form.password.trim()) {
      setError('Enter your email and password to continue.');
      return;
    }
    setSubmitting(true);
    try {
      await onLogin({ username: form.email.trim(), password: form.password, role: form.role });
    } catch (loginError) {
      setError(loginError.message || 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="login-page">
    <section className="login-visual">
      <div className="login-brand"><HospitalLogo className="login-logo"/><div><strong>Lakshmi Sreenivaasa</strong><small className="hospital-type">Multi Speciality Hospital</small><small className="hospital-tagline">Healing · Caring · Serving</small></div></div>
      <div className="login-message"><span className="login-kicker">SMARTER HEALTHCARE OPERATIONS</span><h1>Care begins with<br/><em>better coordination.</em></h1><p>A secure, unified workspace for patient registration, diagnostics, billing and inpatient care.</p><div className="login-features"><span><Icon name="check"/> Patient-first workflows</span><span><Icon name="check"/> Secure clinical operations</span><span><Icon name="check"/> Real-time billing</span></div></div>
      <div className="visual-orb orb-one"/><div className="visual-orb orb-two"/>
    </section>
    <section className="login-panel"><form className="login-card" onSubmit={submit} noValidate>
      <div className="mobile-login-brand"><HospitalLogo className="mobile-brand-logo"/><div><strong>Lakshmi Sreenivaasa</strong><small className="hospital-type">Multi Speciality Hospital</small><small className="hospital-tagline">Healing · Caring · Serving</small></div></div>
      <span className="welcome-label">WELCOME BACK</span><h2>Sign in to Lakshmi Sreenivaasa</h2><p>Enter your account details to access the hospital workspace.</p>
      <label className="login-field"><span>Email or user ID</span><div><Icon name="user"/><input aria-label="Email or user ID" value={form.email} onChange={event => update('email', event.target.value)} placeholder="Enter email or user ID" autoComplete="username" autoFocus/></div></label>
      <label className="login-field"><span>Password</span><div><Icon name="lock"/><input aria-label="Password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={event => update('password', event.target.value)} placeholder="Enter your password" autoComplete="current-password"/><button type="button" onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
      <label className="login-field"><span>Sign in as</span><div><Icon name="user"/><select aria-label="Sign in as" value={form.role} onChange={event => update('role', event.target.value)}><option value="ADMINISTRATOR">Administrator</option><option value="RECEPTIONIST">Receptionist</option><option value="LAB_TECHNICIAN">Lab Technician</option><option value="BILLING_EXECUTIVE">Billing Executive</option><option value="DOCTOR">Doctor</option></select></div></label>
      {error && <div className="login-error" role="alert">{error}</div>}
      <div className="login-options"><label><input type="checkbox"/> Remember user ID</label><button type="button">Forgot password?</button></div>
      <button className="login-submit" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in securely'} {!submitting && <Icon name="chevron"/>}</button>
      <div className="login-security"><Icon name="lock" size={14}/> Protected hospital workspace · Authorized users only</div>
    </form><footer>© 2026 Lakshmi Sreenivaasa Multi Speciality Hospital · Privacy · Support</footer></section>
  </main>;
}
