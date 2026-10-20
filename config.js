/* Public configuration only. Never place access codes or administrator keys here. */
window.FMSTW_CONFIG = Object.freeze({
  mode: 'local', // 'cloud' only after separate test deployment passes
  appsScriptUrl: '',
  kaiFontUrl: '', // authorized TTF URL; required for direct PDF generation
  timesFontUrl: '', // authorized Times New Roman TTF URL
  maxFileBytes: 12 * 1024 * 1024,
  maxRecordBytes: 24 * 1024 * 1024
});
