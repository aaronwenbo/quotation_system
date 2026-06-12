#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
标准产品库和匹配规则配置 - 统一核心版本
"""

import logging
import json
import pandas as pd
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List, Tuple

logger = logging.getLogger(__name__)


class MatchingRules:
    """匹配规则配置"""

    def __init__(self, rules_path: Optional[str] = None):
        self.config = {}
        if rules_path and Path(rules_path).exists():
            with open(rules_path, 'r', encoding='utf-8') as f:
                self.config = json.load(f)

    def get_rule5_mapping(self, prefix: str) -> Optional[List[str]]:
        """获取前五位编码映射"""
        mappings = self.config.get('rule5_prefix_mapping', {}).get('mappings', {})
        if prefix in mappings:
            return mappings[prefix]
        return None


class StandardLibrary:
    """标准产品库"""

    def __init__(self, lib_path: Optional[str] = None):
        self.lib_path = Path(lib_path) if lib_path else None
        self.library: Dict[str, Dict] = {}
        if self.lib_path and self.lib_path.exists():
            df = pd.read_excel(self.lib_path)
            for _, row in df.iterrows():
                code = str(row['标准编码']).strip()
                self.library[code] = {
                    '价格': float(row['价格']) if pd.notna(row['价格']) else 0,
                    '原规格编码': str(row['原规格编码']).strip() if pd.notna(row['原规格编码']) else '',
                    '规格': str(row['规格']).strip() if pd.notna(row['规格']) else ''
                }

    def has(self, code: str) -> bool:
        return code.strip() in self.library

    def get(self, code: str) -> Optional[Dict]:
        return self.library.get(code.strip())

    def add(self, code: str, price: float, spec: str = '', original_code: str = '') -> bool:
        code = code.strip()
        if code not in self.library:
            self.library[code] = {
                '价格': float(price),
                '规格': spec,
                '原规格编码': original_code or code
            }
            return True
        return False

    def update(self, code: str, price: float, spec: str = '',
               original_code: str = '') -> bool:
        """
        更新已有产品编码的价格和规格

        Args:
            code: 标准编码
            price: 新价格
            spec: 新规格
            original_code: 原始编码

        Returns:
            True 表示更新成功，False 表示编码不存在
        """
        code = code.strip()
        if code not in self.library:
            return False
        self.library[code]['价格'] = float(price)
        if spec:
            self.library[code]['规格'] = spec
        if original_code:
            self.library[code]['原规格编码'] = original_code
        return True

    def save(self) -> None:
        data = []
        for code, info in self.library.items():
            data.append({
                '标准编码': code,
                '价格': info['价格'],
                '规格': info['规格'],
                '原规格编码': info['原规格编码']
            })
        df = pd.DataFrame(data)
        df.to_excel(self.lib_path, index=False)

    def size(self) -> int:
        return len(self.library)

    def all_codes(self) -> List[str]:
        return list(self.library.keys())

    def check_duplicates(self) -> List[str]:
        seen = set()
        duplicates = []
        for code in self.library:
            if code in seen:
                duplicates.append(code)
            seen.add(code)
        return duplicates

    def backup(self, backup_dir: str) -> Optional[Path]:
        """备份标准库，保留最近5个版本"""
        if not self.lib_path or not self.lib_path.exists():
            return None

        backup_dir = Path(backup_dir)
        backup_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        backup_name = f"standard_library_backup_{timestamp}.xlsx"
        backup_path = backup_dir / backup_name

        shutil.copy2(str(self.lib_path), str(backup_path))

        # 清理旧备份
        backups = sorted(backup_dir.glob("standard_library_backup_*.xlsx"))
        if len(backups) > 5:
            for old_backup in backups[:-5]:
                old_backup.unlink()

        return backup_path
