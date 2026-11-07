// CSV and Excel-compatible (SpreadsheetML 2003 XML) exports.
import { downloadText } from '../core/utils.js';

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** rows: array of plain objects (keys = headers) or {headers, rows:[[...]]}. UTF-8 BOM so Excel opens accents/² correctly. */
export function toCSV(rows, headers = null) {
  const h = headers || (rows[0] ? Object.keys(rows[0]) : []);
  const lines = [h.map(csvCell).join(',')];
  for (const r of rows) lines.push(h.map((k) => csvCell(Array.isArray(r) ? r[h.indexOf(k)] : r[k])).join(','));
  return '﻿' + lines.join('\r\n');
}
export function downloadCSV(rows, filename, headers = null) {
  downloadText(toCSV(rows, headers), filename, 'text/csv;charset=utf-8');
}

const x = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * sheets: [{ name, title, headers:[...], rows:[[...]], totals:[[...]] }]
 * Numbers are written as Number cells so Excel can sum them.
 */
export function toXLS(sheets) {
  const cell = (v, style = '') => {
    const isNum = typeof v === 'number' && Number.isFinite(v);
    return `<Cell${style ? ` ss:StyleID="${style}"` : ''}><Data ss:Type="${isNum ? 'Number' : 'String'}">${x(v)}</Data></Cell>`;
  };
  const ws = sheets.map((s) => `
  <Worksheet ss:Name="${x(String(s.name).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31))}">
    <Table>
      ${s.title ? `<Row>${cell(s.title, 'title')}</Row><Row></Row>` : ''}
      <Row>${s.headers.map((h) => cell(h, 'head')).join('')}</Row>
      ${s.rows.map((r) => `<Row>${r.map((v) => cell(v)).join('')}</Row>`).join('')}
      ${(s.totals || []).map((r) => `<Row>${r.map((v) => cell(v, 'total')).join('')}</Row>`).join('')}
    </Table>
  </Worksheet>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="title"><Font ss:Bold="1" ss:Size="14"/></Style>
    <Style ss:ID="head"><Font ss:Bold="1"/><Interior ss:Color="#EEEAE2" ss:Pattern="Solid"/></Style>
    <Style ss:ID="total"><Font ss:Bold="1"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  </Styles>${ws}
</Workbook>`;
}
export function downloadXLS(sheets, filename) {
  downloadText(toXLS(sheets), filename, 'application/vnd.ms-excel');
}
