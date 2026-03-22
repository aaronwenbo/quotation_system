
import XLSX from 'xlsx';
import fs from 'fs';

// Read the Excel file
const workbook = XLSX.readFile('C:\\Users\\艾洋\\.openclaw\\media\\inbound\\quotation_1---0cf2cc8c-149c-4237-8c03-bea0db613d4a.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

// Convert to inquiry format
const inquiry = data.map(row => ({
  name: row['__EMPTY'] || '',
  code: row['Code'] || '',
  quantity: row['Кол-во, шт'] || 0
}));

// Write to temp file
const outputPath = 'C:\\tmp\\ai_inquiry.json';
fs.writeFileSync(outputPath, JSON.stringify(inquiry, null, 2));
console.log(`Successfully generated ${outputPath} with ${inquiry.length} items`);
console.log('First 5 items:', inquiry.slice(0, 5));
console.log('Last 5 items:', inquiry.slice(-5));
