export const modules = [
  { id: 'op', permission: 'MODULE_OP', label: 'OP Billing & Registration' },
  { id: 'lab', permission: 'MODULE_LAB', label: 'Laboratory Billing & Reports' },
  { id: 'ipd', permission: 'MODULE_IPD', label: 'IPD Billing & Discharge' },
  { id: 'daycare', permission: 'MODULE_DAYCARE', label: 'Daycare Admission & Billing' },
  { id: 'pharmacy', permission: 'MODULE_PHARMACY', label: 'Pharmacy Billing & Stock' },
  { id: 'followups', permission: 'MODULE_FOLLOWUPS', label: 'Patient Follow-ups' },
];

export const roleDefaultPermissions = {
  RECEPTIONIST: ['MODULE_OP', 'MODULE_FOLLOWUPS'],
  LAB_TECHNICIAN: ['MODULE_LAB'],
  BILLING_EXECUTIVE: ['MODULE_OP', 'MODULE_LAB', 'MODULE_IPD', 'MODULE_DAYCARE', 'MODULE_PHARMACY'],
  DOCTOR: ['MODULE_OP', 'MODULE_LAB', 'MODULE_IPD', 'MODULE_DAYCARE', 'MODULE_FOLLOWUPS'],
  ADMINISTRATOR: modules.map(module => module.permission),
};

export function effectiveModulePermissions(user) {
  if (!user) return [];
  if (user.role === 'ADMINISTRATOR') return roleDefaultPermissions.ADMINISTRATOR;
  const assigned = user.permissions || [];
  const explicit = assigned.filter(permission => modules.some(module => module.permission === permission));
  if (explicit.length || assigned.includes('MODULE_NONE')) return explicit;
  return roleDefaultPermissions[user.role] || [];
}

export function accessiblePageIds(user) {
  const permissions = effectiveModulePermissions(user);
  const pages = modules.filter(module => permissions.includes(module.permission)).map(module => module.id);
  if (user?.role === 'ADMINISTRATOR') { pages.unshift('overview'); pages.push('admin'); }
  return pages;
}

export function canAccessPage(user, pageId) {
  return accessiblePageIds(user).includes(pageId);
}

export function permissionsForSubmission(permissions) {
  const selected = permissions.filter(permission => modules.some(module => module.permission === permission));
  return selected.length ? selected : ['MODULE_NONE'];
}
