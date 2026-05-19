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
  
  // Style Header Row (Neobrutalist slate)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1F2937' } // Slate Gray matching EggShell branding
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      top: { style: 'thin', color: { argb: '111827' } },
      left: { style: 'thin', color: { argb: '111827' } },
      bottom: { style: 'medium', color: { argb: '111827' } },
      right: { style: 'thin', color: { argb: '111827' } }
    };
  });

  // Style Data Rows & set Heights
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.height = 20;
      row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10 };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'E5E7EB' } },
          left: { style: 'thin', color: { argb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'E5E7EB' } },
          right: { style: 'thin', color: { argb: 'E5E7EB' } }
        };
      });
    }
  });

  // Autofit Column Widths
  worksheet.columns.forEach((column) => {
    let maxColumnLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      let cellLength = 0;
      if (cell.value !== null && cell.value !== undefined) {
        let valStr = '';
        if (typeof cell.value === 'object') {
          if (cell.value.result !== undefined) {
            valStr = cell.value.result.toString();
          } else if (cell.value.richText) {
            valStr = cell.value.richText.map(t => t.text || '').join('');
          } else {
            valStr = JSON.stringify(cell.value);
          }
        } else {
          valStr = cell.value.toString();
        }
        cellLength = valStr.length;
      }
      if (cellLength > maxColumnLength) {
        maxColumnLength = cellLength;
      }
    });
    // Set padded width between 12 and 50 characters
    column.width = Math.max(12, Math.min(50, maxColumnLength + 4));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
