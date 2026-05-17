import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { db } from './db';
import { sanitizeColumnName } from '../utils/helpers';

export const importFileToDB = async (file, onProgress) => {
  const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  if (file.name.toLowerCase().endsWith('.csv')) {
    return await importCSV(file, fileId, onProgress);
  } else if (file.name.toLowerCase().endsWith('.xlsx')) {
    return await importXLSX(file, fileId, onProgress);
  } else {
    throw new Error('Unsupported file type. Please use .csv or .xlsx');
  }
};

const importCSV = (file, fileId, onProgress) => {
  return new Promise((resolve, reject) => {
    let headers = [];
    let isFirstChunk = true;
    let rowCount = 0;
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      chunk: async (results, parser) => {
        parser.pause();
        
        try {
          if (isFirstChunk) {
            headers = results.meta.fields.map((f, i) => ({
              id: `col_${i}`,
              original: f || `Column${i}`,
              sanitized: sanitizeColumnName(f || `Column${i}`)
            }));
            
            const colDefs = headers.map(h => `${h.sanitized} TEXT`).join(", ");
            await db.sql(`CREATE TABLE ${fileId} (__row_id INTEGER PRIMARY KEY AUTOINCREMENT, ${colDefs});`);
            isFirstChunk = false;
          }

          if (results.data.length > 0) {
            const colNames = headers.map(h => h.sanitized).join(", ");
            const valuesArr = results.data.map(row => {
               const vals = headers.map(h => {
                 const val = row[h.original] || "";
                 return `'${String(val).replace(/'/g, "''")}'`;
               });
               return `(${vals.join(', ')})`;
            });
            
            const query = `INSERT INTO ${fileId} (${colNames}) VALUES ${valuesArr.join(', ')};`;
            await db.sql(query);
          }

          rowCount += results.data.length;
          onProgress?.(rowCount);
          parser.resume();
        } catch(err) {
          console.error("CSV Import Error:", err);
          parser.abort();
          reject(err);
        }
      },
      complete: () => resolve({ id: fileId, fileName: file.name, headers, rowCount }),
      error: reject
    });
  });
};

const importXLSX = async (file, fileId, onProgress) => {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();
  await workbook.xlsx.load(arrayBuffer);
  
  const worksheet = workbook.worksheets[0]; 
  if (!worksheet) throw new Error("No worksheet found");

  let headers = [];
  let dataRows = [];
  let rowCount = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const original = cell.value?.toString() || `Col${colNumber}`;
        headers.push({
          id: `col_${colNumber}`, 
          original,
          sanitized: sanitizeColumnName(original)
        });
      });
      return;
    }

    const values = headers.map((h, i) => {
       const cell = row.getCell(i + 1);
       return cell.value?.toString() || "";
    });
    dataRows.push(values);
    rowCount++;
  });

  const colDefs = headers.map(h => `${h.sanitized} TEXT`).join(", ");
  await db.sql(`CREATE TABLE ${fileId} (__row_id INTEGER PRIMARY KEY AUTOINCREMENT, ${colDefs});`);

  const batchSize = 500;
  for (let i = 0; i < dataRows.length; i += batchSize) {
    const batch = dataRows.slice(i, i + batchSize);
    const colNames = headers.map(h => h.sanitized).join(", ");
    
    const valuesArr = batch.map(row => {
       const vals = row.map(v => `'${String(v).replace(/'/g, "''")}'`);
       return `(${vals.join(', ')})`;
    });
    
    const query = `INSERT INTO ${fileId} (${colNames}) VALUES ${valuesArr.join(', ')};`;
    await db.sql(query);
    onProgress?.(Math.min(rowCount, i + batchSize));
  }

  return { id: fileId, fileName: file.name, headers, rowCount };
};
