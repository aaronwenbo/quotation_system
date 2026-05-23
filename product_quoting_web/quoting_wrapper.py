#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Web应用包装层 - 直接引用统一核心库
所有核心逻辑在 product_quoting_core 中维护，此处仅作导入
逻辑更新只需修改 product_quoting_core，web应用自动生效
"""

# 直接从统一核心库导入所有类
import sys
from pathlib import Path

# 添加父目录到路径，便于导入统一核心
CORE_PARENT_PATH = str(Path(__file__).parent.parent)
if CORE_PARENT_PATH not in sys.path:
    sys.path.insert(0, CORE_PARENT_PATH)

from product_quoting_core import (
    StandardLibrary,
    MatchingRules,
    CodeMatcher,
    QuotingService
)

__all__ = ['StandardLibrary', 'MatchingRules', 'CodeMatcher', 'QuotingService']
