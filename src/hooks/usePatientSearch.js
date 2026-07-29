import { useEffect, useState } from 'react';
import { patientApi } from '../api/services';

export function usePatientSearch(query, enabled = true) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const value = query.trim();
    if (!enabled || !value) {
      setPatients([]);
      setLoading(false);
      setError('');
      return undefined;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const result = await patientApi.search(value);
        if (active) setPatients(result.content || []);
      } catch (requestError) {
        if (active) { setPatients([]); setError(requestError.message); }
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, enabled]);

  return { patients, loading, error };
}
