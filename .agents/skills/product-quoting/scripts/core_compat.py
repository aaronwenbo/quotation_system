#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
技能兼容层 - 引用统一核心库
所有核心逻辑在 product_quoting_core 中维护，此处仅作导入
逻辑更新只需修改 product_quoting_core，技能自动生效
"""

import sys
from pathlib import Path

# 查找统一核心库的位置
# .claude/skills/product-quoting/scripts/core_compat.py -> 向上5层到 product_data_clean
SKILL_DIR = Path(__file__).resolve().parents[4]
CORE_PARENT = str(SKILL_DIR)
if CORE_PARENT not in sys.path:
    sys.path.insert(0, CORE_PARENT)

from product_quoting_core import (
    StandardLibrary,
    MatchingRules,
    CodeMatcher,
    QuotingService
)

__all__ = ['StandardLibrary', 'MatchingRules', 'CodeMatcher', 'QuotingService']
