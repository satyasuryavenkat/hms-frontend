import { accessiblePageIds, effectiveModulePermissions, permissionsForSubmission } from './moduleAccess';

test('overview is available only to administrators', () => {
  expect(accessiblePageIds({ role: 'ADMINISTRATOR', permissions: [] })[0]).toBe('overview');
  expect(accessiblePageIds({ role: 'BILLING_EXECUTIVE', permissions: [] })).not.toContain('overview');
});

test('uses role defaults for legacy users without module permissions', () => {
  expect(accessiblePageIds({ role: 'LAB_TECHNICIAN', permissions: [] })).toEqual(['lab']);
  expect(accessiblePageIds({ role: 'RECEPTIONIST', permissions: ['OP_REGISTER'] })).toEqual(['op', 'followups']);
});

test('uses only explicitly allocated modules', () => {
  const user = { role: 'RECEPTIONIST', permissions: ['MODULE_PHARMACY'] };
  expect(effectiveModulePermissions(user)).toEqual(['MODULE_PHARMACY']);
  expect(accessiblePageIds(user)).toEqual(['pharmacy']);
});

test('includes Daycare in the billing executive default workspace', () => {
  expect(accessiblePageIds({ role: 'BILLING_EXECUTIVE', permissions: [] })).toContain('daycare');
});

test('represents an explicit empty allocation without falling back to role defaults', () => {
  expect(permissionsForSubmission([])).toEqual(['MODULE_NONE']);
  expect(accessiblePageIds({ role: 'DOCTOR', permissions: ['MODULE_NONE'] })).toEqual([]);
});
