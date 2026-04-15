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


def find_aliases_by_rules(df: pd.DataFrame) -> Tuple[List[dict], set]:
    """
    按规则找出所有别名
    返回：
    - alias_records: [(alias_code, standard_code, rule_name, spec), ...]
    - alias_codes_set: 所有被标记为别名的编码集合
    """
    alias_records = []
    alias_codes = set()

    # 按规格分组
    spec_groups = df.groupby('spec')

    for spec_name, group in spec_groups:
        if len(group) <= 1:
            continue  # 同规格只有一个产品，不可能有别名

        logger.info(f"规格 '{spec_name}' 有 {len(group)} 个产品，检查别名...")
        codes = list(group['unified_code'])

        # 两两比较
        for i in range(len(codes)):
            code1 = codes[i]
            if code1 in alias_codes:
                continue  # 已经是别名，跳过

            for j in range(i + 1, len(codes)):
                code2 = codes[j]
                if code2 in alias_codes:
                    continue  # 已经是别名，跳过

                # 依次检查三条规则
                # 规则一
                is_match, alias_side = check_rule1(code1, code2)
                if is_match:
                    if alias_side == 'code1':
                        alias_records.append((code1, code2, '规则一', str(spec_name)))
                        alias_codes.add(code1)
                    else:
                        alias_records.append((code2, code1, '规则一', str(spec_name)))
                        alias_codes.add(code2)
                    continue

                # 规则二
                is_match, alias_side = check_rule2(code1, code2)
                if is_match:
                    if alias_side == 'code1':
                        alias_records.append((code1, code2, '规则二', str(spec_name)))
                        alias_codes.add(code1)
                    else:
                        alias_records.append((code2, code1, '规则二', str(spec_name)))
                        alias_codes.add(code2)
                    continue

                # 规则三
                is_match, alias_side = check_rule3(code1, code2)
                if is_match:
                    if alias_side == 'code1':
                        alias_records.append((code1, code2, '规则三', str(spec_name)))
                        alias_codes.add(code1)
                    else:
                        alias_records.append((code2, code1, '规则三', str(spec_name)))
                        alias_codes.add(code2)
                    continue

    logger.info(f"检测完成，共发现 {len(alias_records)} 个别名")
    return alias_records, alias_codes


def main():
    logger.info("=" * 60)
    logger.info("产品别名整理工具 开始运行")
    logger.info("=" * 60)

    # 读取输入
    input_file = os.path.join(OUTPUT_DIR, 'product_unified.xlsx')
    df = pd.read_excel(input_file)
    logger.info(f"读取统一产品库完成，共 {len(df)} 个产品")

    # 检测所有别名
    alias_records, alias_codes = find_aliases_by_rules(df)
    logger.info(f"共发现 {len(alias_records)} 个别名，涉及 {len(alias_codes)} 个唯一编码")

    # 构建标准产品库：过滤掉被标记为别名的行
    df_standard = df[~df['unified_code'].isin(alias_codes)].copy()
    logger.info(f"标准产品库生成完成，共 {len(df_standard)} 个标准产品")

    # 构建别名映射表
    alias_mapping_data = []
    current_date = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    for alias_code, standard_code, rule_name, spec_name in alias_records:
        alias_mapping_data.append({
            '别名': alias_code,
            '统一编码': standard_code,
            '别名类型': rule_name,
            '来源': '自动发现',
            '创建时间': current_date,
            '备注': spec_name
        })

    # 如果原有文件存在，读取并追加
    alias_mapping_file = os.path.join(DATA_DIR, 'alias_mapping.xlsx')
    if os.path.exists(alias_mapping_file) and os.path.getsize(alias_mapping_file) > 0:
        try:
            existing_df = pd.read_excel(alias_mapping_file)
            logger.info(f"读取已有别名映射，现有 {len(existing_df)} 条")
            new_df = pd.DataFrame(alias_mapping_data)
            # 去重：避免重复添加同一个别名
            combined_df = pd.concat([existing_df, new_df], ignore_index=True)
            combined_df = combined_df.drop_duplicates(subset=['别名', '统一编码'], keep='last')
            alias_mapping_df = combined_df
        except Exception as e:
            logger.warning(f"读取现有文件失败，创建新文件: {e}")
            alias_mapping_df = pd.DataFrame(alias_mapping_data)
    else:
        alias_mapping_df = pd.DataFrame(alias_mapping_data)

    logger.info(f"别名映射表共 {len(alias_mapping_df)} 条记录")

    # 构建标准产品带别名汇总表
    # 先构建：标准编码 -> [(别名, 规则), ...]
    standard_to_aliases: Dict[str, List[Tuple[str, str]]] = {}
    for alias_code, standard_code, rule_name, _ in alias_records:
        if standard_code not in standard_to_aliases:
            standard_to_aliases[standard_code] = []
        standard_to_aliases[standard_code].append((alias_code, rule_name))

    # 构建汇总数据
    summary_data = []
    for _, row in df_standard.iterrows():
        code = row['unified_code']
        aliases = standard_to_aliases.get(code, [])
        alias_list_str = ','.join([a[0] for a in aliases]) if aliases else ''
        rule_list_str = ','.join([a[1] for a in aliases]) if aliases else ''

        summary_data.append({
            'unified_code': row['unified_code'],
            'product_name': row['product_name'],
            'spec': row['spec'],
            'sale_price': row['sale_price'],
            '别名列表': alias_list_str,
            '别名规则': rule_list_str
        })

    summary_df = pd.DataFrame(summary_data)
    logger.info(f"汇总表生成完成，共 {len(summary_df)} 行")

    # 保存标准产品库
    standard_file = os.path.join(OUTPUT_DIR, 'product_standard.xlsx')
    df_standard.to_excel(standard_file, index=False)
    logger.info(f"标准产品库已保存: {standard_file}")

    # 保存别名映射表
    alias_mapping_file = os.path.join(DATA_DIR, 'alias_mapping.xlsx')
    alias_mapping_df.to_excel(alias_mapping_file, index=False)
    logger.info(f"别名映射表已保存: {alias_mapping_file}")

    # 保存汇总表
    summary_file = os.path.join(OUTPUT_DIR, 'standard_with_aliases.xlsx')
    summary_df.to_excel(summary_file, index=False)
    logger.info(f"标准带别名汇总表已保存: {summary_file}")

    # 输出最终统计
    logger.info("=" * 60)
    logger.info("处理完成！最终统计:")
    logger.info(f"  - 原统一产品库总数: {len(df)}")
    logger.info(f"  - 自动发现别名数量: {len(alias_records)}")
    logger.info(f"  - 标准产品库剩余: {len(df_standard)}")
    logger.info(f"  - 输出文件:")
    logger.info(f"    - {standard_file}")
    logger.info(f"    - {alias_mapping_file}")
    logger.info(f"    - {summary_file}")
    logger.info("=" * 60)

if __name__ == '__main__':
    main()