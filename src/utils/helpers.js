export const sanitizeColumnName = (name) => {
  if (!name) return 'unknown_col';
  // Replace non-alphanumeric with underscores, make lowercase
  let sanitized = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  // Ensure it doesn't start with a number
  if (/^[0-9]/.test(sanitized)) {
    sanitized = 'col_' + sanitized;
  }
  return sanitized;
};
