export function FormField({ label, required, children, hint, wide, compact, className = '' }) {
  return <label className={`form-field ${wide ? 'wide' : ''} ${compact ? 'compact' : ''} ${className}`}><span>{label}{required && <i>*</i>}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function SectionTitle({ step, title, description, action }) {
  return <div className="section-title"><div className="step">{step}</div><div><h2>{title}</h2><p>{description}</p></div>{action}</div>;
}

export function Status({ children, tone = 'green' }) { return <span className={`status ${tone}`}><i/>{children}</span>; }
