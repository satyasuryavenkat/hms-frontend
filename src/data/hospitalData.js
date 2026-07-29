export const formatMoney = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
