#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
产品别名整理工具
功能：从统一产品库中按规则识别别名，生成标准产品库和别名映射表
"""

import pandas as pd
import logging
import os
from datetime import datetime
from typing import Dict, List, Tuple, Optional

# 获取项目根目录
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 定义目录路径
LOG_DIR = os.path.join(PROJECT_ROOT, 'logs')
OUTPUT_DIR = os.path.join(PROJECT_ROOT, 'output')
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')

# 确保目录存在
os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

# 配置日志系统
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(LOG_DIR, 'build_standard_alias.log'), encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)


def check_rule1(code1: str, code2: str) -> Tuple[bool, Optional[str]]:
    """
    规则1检测：移除'-'后长度相同，仅第5位（索引4）不同且分别为'1'和'2'，其余位相同

    参数:
        code1: 第一个产品代码
        code2: 第二个产品代码

    返回:
        (是否匹配, 哪个是别名) -> 'code1'、'code2'或None
    """
    # 移除所有'-'字符
    c1 = code1.replace('-', '')
    c2 = code2.replace('-', '')

    # 检查长度是否相同
    if len(c1) != len(c2):
        return False, None

    # 检查长度是否至少为5位（因为要比较第5位）
    if len(c1) < 5:
        return False, None

    # 检查除第5位外的所有字符是否相同
    for i in range(len(c1)):
        if i == 4:
            continue
        if c1[i] != c2[i]:
            return False, None

    # 检查第5位是否分别为'1'和'2'（顺序不限）
    if (c1[4] == '1' and c2[4] == '2') or (c1[4] == '2' and c2[4] == '1'):
        # 确定哪个是别名
        which = 'code2' if c1[4] == '1' else 'code1'
        return True, which

    return False, None


def check_rule2(code1: str, code2: str) -> Tuple[bool, Optional[str]]:
    """
    规则2检测：一个以'T'结尾，移除尾部'T'后与另一个完全相等

    参数:
        code1: 第一个产品代码
        code2: 第二个产品代码

    返回:
        (是否匹配, 哪个是别名) -> 带'T'的那个是别名
    """
    # 检查哪个以'T'结尾
    if code1.endswith('T'):
        # 移除尾部'T'后比较
        c1 = code1[:-1]
        if c1 == code2:
            return True, 'code1'
    elif code2.endswith('T'):
        # 移除尾部'T'后比较
        c2 = code2[:-1]
        if c2 == code1:
            return True, 'code2'

    return False, None


def check_rule3(code1: str, code2: str) -> Tuple[bool, Optional[str]]:
    """
    规则3检测：一个包含'*'，移除'*'及之后到下一个'-'的内容后与另一个相等

    参数:
        code1: 第一个产品代码
        code2: 第二个产品代码

    返回:
        (是否匹配, 哪个是别名) -> 带'*'的那个是别名
    """
    def process_with_wildcard(code: str) -> Optional[str]:
        """处理包含'*'的代码，移除'*'及之后到下一个'-'的内容"""
        if '*' not in code:
            return None

        parts = code.split('*', 1)
        prefix = parts[0]
        rest = parts[1]

        # 找到下一个'-'的位置
        dash_index = rest.find('-')
        if dash_index == -1:
            # 如果没有更多'-'，则只保留前缀
            return prefix
        else:
            # 保留前缀 + 剩余部分从'-'开始的内容
            return prefix + rest[dash_index:]

    # 检查哪个代码包含'*'
    processed1 = process_with_wildcard(code1)
    processed2 = process_with_wildcard(code2)

    if processed1 is not None and processed1 == code2:
        return True, 'code1'
    elif processed2 is not None and processed2 == code1:
        return True, 'code2'

    return False, None


def main():
    logger.info("=" * 60)
    logger.info("产品别名整理工具 开始运行")
    logger.info("=" * 60)

    # 读取输入
    input_file = os.path.join(OUTPUT_DIR, 'product_unified.xlsx')
    df = pd.read_excel(input_file)
    logger.info(f"读取统一产品库完成，共 {len(df)} 个产品")

    # TODO: 后续步骤

if __name__ == '__main__':
    main()