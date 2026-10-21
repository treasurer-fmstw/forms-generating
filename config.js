/* Public configuration only. Never place access codes or administrator keys here. */
window.FMSTW_CONFIG = Object.freeze({
  mode: 'cloud', // Requires Apps Script deployment access for anyone
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycby_Za7TUhQ0viQQEvcX0I1dn4QdnzysXRntM_z8qHIMt0-csSizsjKtd5zM92YkysvUWg/exec',
  kaiFontUrl: '', // authorized TTF URL; required for direct PDF generation
  timesFontUrl: '', // authorized Times New Roman TTF URL
  maxFileBytes: 12 * 1024 * 1024,
  maxRecordBytes: 24 * 1024 * 1024
});
