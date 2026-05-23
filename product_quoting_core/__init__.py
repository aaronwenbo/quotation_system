#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
产品报价统一核心库
所有Web应用和CLI技能共享此核心逻辑，确保一致的匹配结果
"""

from .library import StandardLibrary, MatchingRules
from .matcher import CodeMatcher
from .service import QuotingService

__version__ = "2.0.0"
__all__ = ['StandardLibrary', 'MatchingRules', 'CodeMatcher', 'QuotingService']
