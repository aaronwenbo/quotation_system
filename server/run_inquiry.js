
const fs = require('fs');
const { execSync } = require('child_process');

// Read the Excel data that was output earlier
const excelData = JSON.parse(fs.readFileSync('C:\\Users\\艾yalex\\.openclaw\\workspace\\excel_data.json', 'utf8'));

const inquiry = excelData.map(row => ({
  name: row['__EMPTY'] || '',
  code: row.Code || '',
  quantity: row['Кол-во, шт'] || 0
}));

fs.writeFileSync('C:\\tmp\\ai_inquiry.json', JSON.stringify(inquiry, null, 2));
console.log(`Wrote ${inquiry.length} items to C:\\tmp\\ai_inquiry.json`);
