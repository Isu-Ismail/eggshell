export const sanitizeColumnName = (name) => {
  if (!name) return 'unknown_col';
  // Replace non-alphanumeric Unicode characters (excluding letters and numbers) with underscores
  let sanitized = name.replace(/[^\p{L}\p{N}]/gu, '_').toLowerCase();
  
  // Remove leading/trailing underscores and multiple consecutive underscores
  sanitized = sanitized.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  
  if (!sanitized) {
    sanitized = 'col_' + Math.random().toString(36).substr(2, 5);
  }
  
  // Ensure it doesn't start with a number
  if (/^[0-9\p{N}]/u.test(sanitized)) {
    sanitized = 'col_' + sanitized;
  }
  
  return sanitized;
};
