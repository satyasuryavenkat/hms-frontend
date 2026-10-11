import { useEffect, useRef, useState } from 'react';
import { API_SUCCESS_EVENT } from '../api/client';
import { Icon } from './Icon';

const DISPLAY_TIME_MS = 4500;

export function SuccessAlert() {
  const [notice, setNotice] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    const show = event => {
      window.clearTimeout(timer.current);
      setNotice(event.detail?.message || 'Saved successfully.');
      timer.current = window.setTimeout(() => setNotice(null), DISPLAY_TIME_MS);
    };
    window.addEventListener(API_SUCCESS_EVENT, show);
    return () => {
      window.removeEventListener(API_SUCCESS_EVENT, show);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!notice) return null;
  return <div className="global-success-alert" role="status" aria-live="polite">
    <span><Icon name="check" size={18}/></span>
    <div><strong>Success</strong><p>{notice}</p></div>
    <button type="button" aria-label="Dismiss success message" onClick={() => setNotice(null)}>×</button>
  </div>;
}
