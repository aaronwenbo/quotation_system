#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
产品编码统一合并工具
功能：合并两份来源不同的报价文件，生成统一产品编码库，更新库存文件
"""

import pandas as pd
import logging
import os
from typing import Dict, List, Tuple, Optional, Any

# 配置日志系统
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('unify_products.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# 确保输出目录存在
OUTPUT_DIR = 'output'
os.makedirs(OUTPUT_DIR, exist_ok=True)


def clean_product_code(code: Optional[Any]) -> str:
    """
    清理产品编码，统一格式：
    - 去除所有空格
    - 去除首尾空白字符

    Args:
        code: 原始产品编码（任意类型）

    Returns:
        清理后的编码字符串
    """
    if pd.isna(code):
        logger.debug(f"输入产品编码为NaN，返回空字符串")
        return ""

    code_str = str(code)
    # 去除所有空格
    code_str = code_str.replace(" ", "").strip()
    # 如果为空，返回空字符串
    if not code_str:
        logger.debug(f"清理后的产品编码为空，输入值: {code}")
        return ""

    return code_str


def read_quote_file(file_path: str) -> Tuple[pd.DataFrame, Dict[str, str]]:
    """
    读取报价文件，提取产品编码和相关信息，同时清理编码

    Args:
        file_path: 报价文件路径

    Returns:
        (DataFrame, original_to_clean_map):
            DataFrame 包含列: original_code, cleaned_code, 产品名称, 规格, 单位, 成本价, 售价, 分类
            original_to_clean_map: 原始编码 -> 清理后编码 的映射字典
    """
    logger.info(f"开始读取报价文件: {file_path}")

    try:
        # 读取Excel，第一个sheet
        df = pd.read_excel(file_path, sheet_name=0, header=0)
        logger.info(f"文件读取完成，共 {len(df)} 行原始数据")

        # 识别各列 - 根据模板，列名是固定的
        # 列名: 产品编码(必填), 产品名称, 英文名称, 分类, 规格, 单位, 成本价, 售价, 安全库存, 当前库存
        result_data = []
        original_to_clean: Dict[str, str] = {}

        product_code_col = '产品编码(必填)'

        for idx, row in df.iterrows():
            original_code = row[product_code_col]
            cleaned_code = clean_product_code(original_code)
            if cleaned_code == "":
                continue  # 跳过空编码

            # 提取其他信息，处理NaN
            product_name = row.get('产品名称', None)
            spec = row.get('规格', None)
            unit = row.get('单位', None)
            cost_price = row.get('成本价', None)
            sale_price = row.get('售价', None)
            category = row.get('分类', None)

            # 如果售价为空，跳过
            if pd.isna(sale_price):
                continue

            result_data.append({
                'original_code': str(original_code) if not pd.isna(original_code) else "",
                'cleaned_code': cleaned_code,
                'product_name': product_name if not pd.isna(product_name) else None,
                'spec': spec if not pd.isna(spec) else None,
                'unit': unit if not pd.isna(unit) else None,
                'cost_price': cost_price,
                'sale_price': sale_price,
                'category': category if not pd.isna(category) else None,
            })

            original_to_clean[str(original_code)] = cleaned_code

        result_df = pd.DataFrame(result_data)
        logger.info(f"过滤后剩余 {len(result_df)} 条有效产品数据")
        return result_df, original_to_clean

    except Exception as e:
        logger.error(f"读取报价文件失败: {str(e)}", exc_info=True)
        raise


def match_and_merge(df1: pd.DataFrame, df2: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    基于清理后的编码自动匹配合并两份数据

    Args:
        df1: 第一份报价文件处理后的数据
        df2: 第二份报价文件处理后的数据

    Returns:
        (auto_merged_df, pending_df):
            auto_merged_df: 自动匹配完成的数据（包括完全一致和单方独有）
            pending_df: 需要人工匹配的数据
    """
    logger.info("开始自动匹配合并...")

    #  deduplicate df1 by cleaned_code
    if df1['cleaned_code'].duplicated().any():
        duplicate_codes_df1 = df1[df1['cleaned_code'].duplicated(keep=False)]['cleaned_code'].value_counts()
        duplicate_count_df1 = len(duplicate_codes_df1)
        duplicate_codes_list_df1 = list(duplicate_codes_df1.index)
        logger.warning(f"文件1中发现 {duplicate_count_df1} 个重复的清理后编码，重复编码: {duplicate_codes_list_df1}")
        logger.warning(f"文件1去重前记录数: {len(df1)}, 去重后记录数: {df1['cleaned_code'].nunique()}")
        df1 = df1.drop_duplicates(subset=['cleaned_code'], keep='first')

    #  deduplicate df2 by cleaned_code
    if df2['cleaned_code'].duplicated().any():
        duplicate_codes_df2 = df2[df2['cleaned_code'].duplicated(keep=False)]['cleaned_code'].value_counts()
        duplicate_count_df2 = len(duplicate_codes_df2)
        duplicate_codes_list_df2 = list(duplicate_codes_df2.index)
        logger.warning(f"文件2中发现 {duplicate_count_df2} 个重复的清理后编码，重复编码: {duplicate_codes_list_df2}")
        logger.warning(f"文件2去重前记录数: {len(df2)}, 去重后记录数: {df2['cleaned_code'].nunique()}")
        df2 = df2.drop_duplicates(subset=['cleaned_code'], keep='first')

    # 获取所有清理后的编码集合
    codes1 = set(df1['cleaned_code'])
    codes2 = set(df2['cleaned_code'])

    # 计算各种情况
    matched_codes = codes1.intersection(codes2)
    df1_only_codes = codes1 - codes2
    df2_only_codes = codes2 - codes1

    logger.info(f"自动匹配统计:")
    logger.info(f"  - 文件1总编码数: {len(codes1)}")
    logger.info(f"  - 文件2总编码数: {len(codes2)}")
    logger.info(f"  - 清理后完全匹配: {len(matched_codes)}")
    logger.info(f"  - 仅文件1独有: {len(df1_only_codes)}")
    logger.info(f"  - 仅文件2独有: {len(df2_only_codes)}")

    # 构建自动合并结果
    merged_data = []
    pending_data = []

    # 处理完全匹配的
    for code in matched_codes:
        row1 = df1[df1['cleaned_code'] == code].iloc[0]
        row2 = df2[df2['cleaned_code'] == code].iloc[0]

        # 合并信息：优先取非空值
        merged_data.append({
            'cleaned_code': code,
            'original_code_1': row1['original_code'],
            'original_code_2': row2['original_code'],
            'product_name': row1['product_name'] if pd.notna(row1['product_name']) else row2['product_name'],
            'spec': row1['spec'] if pd.notna(row1['spec']) else row2['spec'],
            'unit': row1['unit'] if pd.notna(row1['unit']) else row2['unit'],
            'cost_price': row1['cost_price'] if pd.notna(row1['cost_price']) else row2['cost_price'],
            'sale_price_1': row1['sale_price'],
            'sale_price_2': row2['sale_price'],
            'category': row1['category'] if pd.notna(row1['category']) else row2['category'],
            'source': 'both',
            'needs_mapping': False,
        })

    # 处理仅文件1独有的
    for code in df1_only_codes:
        row1 = df1[df1['cleaned_code'] == code].iloc[0]
        merged_data.append({
            'cleaned_code': code,
            'original_code_1': row1['original_code'],
            'original_code_2': None,
            'product_name': row1['product_name'],
            'spec': row1['spec'],
            'unit': row1['unit'],
            'cost_price': row1['cost_price'],
            'sale_price_1': row1['sale_price'],
            'sale_price_2': None,
            'category': row1['category'],
            'source': 'file1_only',
            'needs_mapping': False,
        })

    # 处理仅文件2独有的
    for code in df2_only_codes:
        row2 = df2[df2['cleaned_code'] == code].iloc[0]
        merged_data.append({
            'cleaned_code': code,
            'original_code_1': None,
            'original_code_2': row2['original_code'],
            'product_name': row2['product_name'],
            'spec': row2['spec'],
            'unit': row2['unit'],
            'cost_price': row2['cost_price'],
            'sale_price_1': None,
            'sale_price_2': row2['sale_price'],
            'category': row2['category'],
            'source': 'file2_only',
            'needs_mapping': False,
        })

    # 创建DataFrame
    merged_df = pd.DataFrame(merged_data)

    logger.info(f"自动合并完成，共 {len(merged_df)} 条记录")
    logger.info(f"需要人工映射: {len(pending_data)} 条")

    # TODO: 后续版本添加基于规格名称模糊匹配发现潜在需要合并的项
    # 当前版本：只有清理后编码不同就是需要人工匹配，暂不自动探测
    pending_df = pd.DataFrame(pending_data)

    return merged_df, pending_df


def export_pending_mapping(pending_df: pd.DataFrame, output_path: str) -> None:
    """
    导出需要人工匹配的模板

    Args:
        pending_df: 需要人工匹配的数据
        output_path: 输出路径
    """
    if len(pending_df) == 0:
        logger.info("没有需要人工匹配的项，跳过导出")
        return

    logger.info(f"导出 {len(pending_df)} 条待人工匹配记录到: {output_path}")

    # 创建模板：用户需要填写 final_unified_code
    template_data = []
    for idx, row in pending_df.iterrows():
        template_data.append({
            'original_code_1': row['original_code_1'],
            'original_code_2': row['original_code_2'],
            'spec_1': row['spec_1'] if 'spec_1' in row else None,
            'spec_2': row['spec_2'] if 'spec_2' in row else None,
            'final_unified_code': "",  # 用户填写
            'note': "",  # 用户备注
        })

    template_df = pd.DataFrame(template_data)
    template_df.to_excel(output_path, index=False)
    logger.info("映射模板导出完成，请填写后重新运行程序")


def read_user_mapping(mapping_file: str) -> Dict[str, str]:
    """
    读取用户填写完成的映射表

    Args:
        mapping_file: 映射表文件路径

    Returns:
        原始编码 -> 最终统一编码 的字典
    """
    if not os.path.exists(mapping_file):
        logger.info(f"映射文件不存在: {mapping_file}，返回空映射")
        return {}

    logger.info(f"读取用户映射文件: {mapping_file}")
    df = pd.read_excel(mapping_file, header=0)

    mapping: Dict[str, str] = {}
    filled_count = 0

    for idx, row in df.iterrows():
        final_code = clean_product_code(row.get('final_unified_code', ""))
        if final_code == "":
            continue

        # 处理原始编码1
        if pd.notna(row.get('original_code_1', None)):
            orig = str(row['original_code_1'])
            mapping[orig] = final_code
            filled_count += 1

        # 处理原始编码2
        if pd.notna(row.get('original_code_2', None)):
            orig = str(row['original_code_2'])
            mapping[orig] = final_code
            filled_count += 1

    logger.info(f"读取到 {filled_count} 条有效映射")
    return mapping


if __name__ == '__main__':
    # 这里后续放主逻辑
    pass
