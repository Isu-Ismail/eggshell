import ExcelJS from 'exceljs';
import { sanitizeColumnName } from '../utils/helpers';

export const parseExcelFile = async (file) => {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);
  
  const worksheet = workbook.worksheets[0]; // Assuming first sheet
  if (!worksheet) throw new Error("No worksheet found");

  const headers = [];
  const rows = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const original = cell.value?.toString() || `Col${colNumber}`;
        headers.push({
          id: `col_${colNumber}`, // for React Flow handles
          original,
          sanitized: sanitizeColumnName(original)
        });
      });
    } else {
      const rowData = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
           rowData[header.sanitized] = cell.value;
        }
      });
      rowData['__row_id'] = rowNumber - 1; // Preserve order for basic mapping
      rows.push(rowData);
    }
  });

  return {
    id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    fileName: file.name,
    headers,
    rows
  };
};

export const generateExcelBlob = async (columns, dataRows) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Stitched Data');
  
  worksheet.columns = columns.map(col => ({ header: col, key: col }));
  
  dataRows.forEach(row => {
    worksheet.addRow(row);
  });
  
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
