#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
产品编码匹配核心 - 五条匹配规则实现（统一核心版本）
"""

import logging
from typing import Optional, Tuple, List, Dict

from .library import StandardLibrary, MatchingRules

logger = logging.getLogger(__name__)


class CodeMatcher:
    """编码匹配器 - 完整的五条规则实现"""

    def __init__(self, library: StandardLibrary, rules: MatchingRules):
        self.library = library
        self.rules = rules

    def clean_code(self, code) -> str:
        """清理编码格式"""
        if code is None or str(code).strip() == '':
            return ''
        return str(code).strip().split(' ')[0].replace(' ', '')

    def apply_rule1(self, code: str) -> List[Tuple[str, str]]:
        """规则一：第五位1↔2双向互换"""
        results = []
        code_no_dash = code.replace('-', '')
        if len(code_no_dash) < 5 or code_no_dash[4] not in ('1', '2'):
            return results

        char_map = {'1': '2', '2': '1'}
        code_list = list(code)
        non_dash_count = 0
        for i, ch in enumerate(code_list):
            if ch != '-':
                non_dash_count += 1
                if non_dash_count == 5:
                    if ch in char_map:
                        code_list[i] = char_map[ch]
                        transformed = ''.join(code_list)
                        results.append((transformed, f"规则一({ch}→{char_map[ch]})"))
                    break
        return results

    def apply_rule5(self, code: str) -> List[Tuple[str, str]]:
        """规则五：前五位编码映射"""
        results = []
        code_no_dash = code.replace('-', '')
        if len(code_no_dash) < 5:
            return results

        prefix = code_no_dash[:5]
        mapping = self.rules.get_rule5_mapping(prefix)
        if mapping:
            target_prefix, direction = mapping
            # 按原位置保留'-'，只替换前五位内容
            result_chars = []
            non_dash_count = 0
            for ch in code:
                if ch == '-':
                    result_chars.append(ch)
                else:
                    non_dash_count += 1
                    if non_dash_count <= 5:
                        result_chars.append(target_prefix[non_dash_count - 1])
                    else:
                        result_chars.append(ch)
            results.append((''.join(result_chars), f"规则五({direction})"))
        return results

    def apply_rule4(self, code: str) -> List[Tuple[str, str]]:
        """规则四：O→0字符容错"""
        if 'O' in code or 'o' in code:
            transformed = code.replace('O', '0').replace('o', '0')
            if transformed != code:
                return [(transformed, "规则四(O→0)")]
        return []

    def generate_variants(self, code: str) -> List[Tuple[str, str]]:
        """生成所有预处理变体（规则二、规则三及其组合）"""
        variants = [(code, "")]

        # 规则二：去T
        if code.endswith('T'):
            code_no_t = code[:-1]
            variants.append((code_no_t, "去T"))

            # 规则二+三：去T后再去*
            if '*' in code_no_t:
                star_pos = code_no_t.find('*')
                next_dash_pos = code_no_t.find('-', star_pos)
                if next_dash_pos > star_pos:
                    code_no_t_star = code_no_t[:star_pos] + code_no_t[next_dash_pos:]
                else:
                    code_no_t_star = code_no_t[:star_pos]
                variants.append((code_no_t_star, "去T+去*"))

        # 规则三：去*
        if '*' in code:
            star_pos = code.find('*')
            next_dash_pos = code.find('-', star_pos)
            if next_dash_pos > star_pos:
                code_no_star = code[:star_pos] + code[next_dash_pos:]
            else:
                code_no_star = code[:star_pos]
            variants.append((code_no_star, "去*"))

            # 规则三+二：去*后再去T
            if code_no_star.endswith('T'):
                code_no_star_t = code_no_star[:-1]
                variants.append((code_no_star_t, "去*+去T"))

        return variants

    def match(self, raw_code) -> Tuple[Optional[str], Optional[Dict], str]:
        """
        匹配产品编码 - 完整的五条规则实现

        Returns:
            (匹配到的标准编码, 产品信息, 匹配类型标注)
        """
        code_clean = self.clean_code(raw_code)
        if not code_clean:
            return None, None, ''

        # 生成所有预处理变体
        variants = self.generate_variants(code_clean)

        # 对每个变体尝试各种匹配策略
        for variant_code, preprocess in variants:
            # 直接匹配
            if self.library.has(variant_code):
                label = f"{preprocess}匹配" if preprocess else "直接匹配"
                return variant_code, self.library.get(variant_code), label

            # 规则一
            for transformed, r1_label in self.apply_rule1(variant_code):
                if self.library.has(transformed):
                    if preprocess:
                        label = f"{preprocess}+{r1_label}"
                    else:
                        label = r1_label
                    return transformed, self.library.get(transformed), label

            # 规则五
            for transformed, r5_label in self.apply_rule5(variant_code):
                if self.library.has(transformed):
                    if preprocess:
                        label = f"{preprocess}+{r5_label}"
                    else:
                        label = r5_label
                    return transformed, self.library.get(transformed), label

            # 规则四
            for transformed, r4_label in self.apply_rule4(variant_code):
                if self.library.has(transformed):
                    if preprocess:
                        label = f"{preprocess}+{r4_label}"
                    else:
                        label = r4_label
                    return transformed, self.library.get(transformed), label

        return None, None, "无匹配"

    def clean_for_library(self, code: str) -> Tuple[str, List[str]]:
        """按规则清理编码，用于加入标准库"""
        std_code = str(code).strip()
        applied_rules = []

        # 规则三：去*
        if '*' in std_code:
            star_pos = std_code.find('*')
            next_dash_pos = std_code.find('-', star_pos)
            if next_dash_pos > star_pos:
                std_code = std_code[:star_pos] + std_code[next_dash_pos:]
            else:
                std_code = std_code[:star_pos]
            applied_rules.append('规则三(去*)')

        # 规则二：去T
        if std_code.endswith('T'):
            std_code = std_code[:-1]
            applied_rules.append('规则二(去T)')

        return std_code, applied_rules
