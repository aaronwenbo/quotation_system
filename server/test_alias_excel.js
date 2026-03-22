import XLSX from 'xlsx';

const data = [
  // L1: Exact Match
  { '编码': '22611', '名称': 'M12防水连接器', '规格': '5芯', '数量': 100 },
  // L2: Structural Match
  { '编码': '', '名称': '22612连接器', '规格': '4芯', '数量': 200 },
  // L3: Alias Match (Will be L4 first, then we confirm, then L3)
  { '编码': 'TEST-ALIAS', '名称': '测试别名产品', '规格': '测试规格', '数量': 300 },
  // L4: Unmatched / Manual Queue
  { '编码': 'UNKNOWN-999', '名称': '未知奇怪产品', '规格': '未知', '数量': 400 },
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "测试单");

XLSX.writeFile(wb, "test_alias_import.xlsx");
console.log("test_alias_import.xlsx generated.");
