import { currentSystemTime, opValidityDate } from './OPBilling';

test('uses the computer local time as the default appointment time', () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 7, 22, 14, 7, 31));

  expect(currentSystemTime()).toBe('14:07');

  jest.useRealTimers();
});

test('shows OP validity through five days after the appointment date', () => {
  expect(opValidityDate('2026-08-23')).toBe('28 Aug 2026');
});
