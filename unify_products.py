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

    # 确保输出目录存在
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # 创建模板：用户需要填写 final_unified_code
    template_data = []
    for idx, row in pending_df.iterrows():
        template_data.append({
            'original_code_1': row['original_code_1'],
            'original_code_2': row['original_code_2'],
            'spec_1': row['spec'] if 'spec' in row else None,
            'spec_2': None,
            'final_unified_code': "",  # 用户填写
            'note': "",  # 用户备注
        })

    template_df = pd.DataFrame(template_data)
    try:
        template_df.to_excel(output_path, index=False)
        logger.info("映射模板导出完成，请填写后重新运行程序")
    except Exception as e:
        logger.error(f"导出待匹配模板失败: {str(e)}", exc_info=True)
        raise


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
    try:
        df = pd.read_excel(mapping_file, header=0)
    except Exception as e:
        logger.error(f"读取用户映射文件失败: {str(e)}", exc_info=True)
        return {}

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


def build_final_products(
    auto_merged_df: pd.DataFrame,
    user_mapping: Dict[str, str],
    df1_original: pd.DataFrame,  # 保留参数供未来扩展使用
    df2_original: pd.DataFrame   # 保留参数供未来扩展使用
) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    应用用户映射，构建最终统一产品库和完整映射表

    Args:
        auto_merged_df: 自动合并结果
        user_mapping: 用户提供的原始编码 -> 最终编码映射
        df1_original: 文件1原始数据
        df2_original: 文件2原始数据

    Returns:
        (final_products_df, full_mapping_df):
            final_products_df: 最终统一产品库
            full_mapping_df: 完整映射表
    """
    logger.info("开始构建最终产品库...")

    # 存储最终产品和完整映射
    final_products: Dict[str, dict] = {}
    full_mapping: List[dict] = []

    # 第一步：处理自动合并的项，确定最终编码
    for idx, row in auto_merged_df.iterrows():
        # 自动合并的项使用cleaned_code作为最终编码
        # 如果存在用户映射则使用用户指定的编码
        if row['source'] == 'both':
            # 两边都有，用cleaned_code作为最终编码
            final_code = row['cleaned_code']
            # 检查是否有用户映射覆盖
            if row['original_code_1'] in user_mapping:
                final_code = user_mapping[row['original_code_1']]
            elif row['original_code_2'] in user_mapping:
                final_code = user_mapping[row['original_code_2']]

            product = {
                'unified_code': final_code,
                'product_name': row['product_name'],
                'spec': row['spec'],
                'unit': row['unit'],
                'cost_price': row['cost_price'],
                'sale_price': row['sale_price_1'] if pd.notna(row['sale_price_1']) else row['sale_price_2'],
                'category': row['category'],
                'source': row['source'],
            }
            # 检查是否覆盖已存在的最终编码
            if final_code in final_products:
                logger.info(f"覆盖已存在的最终编码 '{final_code}'，原始编码: file1={row['original_code_1']}, file2={row['original_code_2']}")
            final_products[final_code] = product

            # 添加映射记录
            full_mapping.append({
                'source_file': 'file1',
                'original_code': row['original_code_1'],
                'unified_code': final_code,
                'needs_manual_mapping': row['original_code_1'] in user_mapping,
            })
            full_mapping.append({
                'source_file': 'file2',
                'original_code': row['original_code_2'],
                'unified_code': final_code,
                'needs_manual_mapping': row['original_code_2'] in user_mapping,
            })

        elif row['source'] == 'file1_only':
            orig_code = row['original_code_1']
            final_code = row['cleaned_code']
            # 检查用户映射
            if orig_code in user_mapping:
                final_code = user_mapping[orig_code]

            product = {
                'unified_code': final_code,
                'product_name': row['product_name'],
                'spec': row['spec'],
                'unit': row['unit'],
                'cost_price': row['cost_price'],
                'sale_price': row['sale_price_1'],
                'category': row['category'],
                'source': row['source'],
            }
            # 检查是否覆盖已存在的最终编码
            if final_code in final_products:
                logger.info(f"覆盖已存在的最终编码 '{final_code}'，原始编码: file1={orig_code}")
            final_products[final_code] = product

            full_mapping.append({
                'source_file': 'file1',
                'original_code': orig_code,
                'unified_code': final_code,
                'needs_manual_mapping': orig_code != final_code,
            })

        elif row['source'] == 'file2_only':
            orig_code = row['original_code_2']
            final_code = row['cleaned_code']
            # 检查用户映射
            if orig_code in user_mapping:
                final_code = user_mapping[orig_code]

            product = {
                'unified_code': final_code,
                'product_name': row['product_name'],
                'spec': row['spec'],
                'unit': row['unit'],
                'cost_price': row['cost_price'],
                'sale_price': row['sale_price_2'],
                'category': row['category'],
                'source': row['source'],
            }
            # 检查是否覆盖已存在的最终编码
            if final_code in final_products:
                logger.info(f"覆盖已存在的最终编码 '{final_code}'，原始编码: file2={orig_code}")
            final_products[final_code] = product

            full_mapping.append({
                'source_file': 'file2',
                'original_code': orig_code,
                'unified_code': final_code,
                'needs_manual_mapping': orig_code != final_code,
            })

    # 处理用户映射中可能新增的合并（两个不同编码合并到一个新编码）
    # 这里已经通过映射字典处理了，上面的逻辑会正确应用

    # 转换为DataFrame
    final_df = pd.DataFrame(list(final_products.values()))
    mapping_df = pd.DataFrame(full_mapping)

    logger.info(f"最终产品库构建完成，共 {len(final_df)} 个唯一产品")
    logger.info(f"完整映射表共 {len(mapping_df)} 条记录")

    return final_df, mapping_df


def update_stock_codes(
    stock_file_path: str,
    full_mapping: pd.DataFrame
) -> pd.DataFrame:
    """
    使用统一编码更新库存文件中的产品编码

    Args:
        stock_file_path: 原始库存文件路径
        full_mapping: 完整映射表

    Returns:
        更新后的库存DataFrame
    """
    logger.info(f"读取原始库存文件: {stock_file_path}")

    try:
        # 读取库存文件
        df_stock = pd.read_excel(stock_file_path, sheet_name=0, header=0)
        logger.info(f"原始库存共 {len(df_stock)} 行")
    except Exception as e:
        logger.error(f"读取库存文件失败: {str(e)}", exc_info=True)
        raise

    # 检查产品编码*列是否存在
    product_code_col = '产品编码*'
    if product_code_col not in df_stock.columns:
        logger.error(f"库存文件中缺少必要的 '{product_code_col}' 列。"
                     f"文件中的列名包括: {list(df_stock.columns)}")
        raise ValueError(f"库存文件缺少必要的 '{product_code_col}' 列")

    # 构建映射字典 original_code -> unified_code (使用 pandas zip 优化)
    mapping_dict: Dict[str, str] = dict(zip(
        full_mapping['original_code'].astype(str),
        full_mapping['unified_code'].astype(str)
    ))

    logger.info(f"构建了 {len(mapping_dict)} 条编码映射关系")

    # 更新产品编码列
    # 库存列名是 "产品编码*"
    product_code_col = '产品编码*'
    updated_count = 0
    not_found_count = 0
    not_found_codes: List[str] = []

    def map_code(original_code) -> str:
        nonlocal updated_count, not_found_count, not_found_codes
        original_str = str(original_code)
        # 先清理原始编码
        cleaned_original = clean_product_code(original_str)
        # 在映射中查找
        # 先尝试原始字符串
        if original_str in mapping_dict:
            updated_count += 1
            return mapping_dict[original_str]
        # 再尝试清理后的编码
        elif cleaned_original in mapping_dict:
            updated_count += 1
            return mapping_dict[cleaned_original]
        else:
            not_found_count += 1
            not_found_codes.append(original_str)
            return original_str  # 保留原始编码

    # 应用映射
    df_stock['统一产品编码'] = df_stock[product_code_col].apply(map_code)

    logger.info(f"库存更新完成:")
    logger.info(f"  - 成功更新编码: {updated_count} 行")
    logger.info(f"  - 未找到映射，保留原始编码: {not_found_count} 行")

    if not_found_count > 0:
        logger.warning(f"未找到映射的编码: {not_found_codes[:20]}")
        if len(not_found_codes) > 20:
            logger.warning(f"... 共 {len(not_found_codes)} 个未找到")

    return df_stock


def save_outputs(
    final_products: pd.DataFrame,
    full_mapping: pd.DataFrame,
    updated_stock: pd.DataFrame,
    pending_template: pd.DataFrame = None
) -> None:
    """
    保存所有输出文件

    Args:
        final_products: 最终统一产品库
        full_mapping: 完整映射表
        updated_stock: 更新后的库存
        pending_template: 待人工匹配模板，如果有的话
    """
    logger.info("开始保存输出文件...")

    # 保存统一产品库
    products_xlsx = os.path.join(OUTPUT_DIR, 'product_unified.xlsx')
    products_csv = os.path.join(OUTPUT_DIR, 'product_unified.csv')
    final_products.to_excel(products_xlsx, index=False)
    final_products.to_csv(products_csv, index=False, encoding='utf-8-sig')
    logger.info(f"统一产品库已保存: {products_xlsx}, {products_csv}")

    # 保存完整映射表
    mapping_xlsx = os.path.join(OUTPUT_DIR, 'code_mapping.xlsx')
    full_mapping.to_excel(mapping_xlsx, index=False)
    logger.info(f"完整映射表已保存: {mapping_xlsx}")

    # 保存更新后的库存
    stock_xlsx = os.path.join(OUTPUT_DIR, 'initial_stock_updated.xlsx')
    updated_stock.to_excel(stock_xlsx, index=False)
    logger.info(f"更新后库存已保存: {stock_xlsx}")

    # 如果有待匹配模板，保存它
    if pending_template is not None and len(pending_template) > 0:
        template_xlsx = os.path.join(OUTPUT_DIR, 'mapping_template.xlsx')
        pending_template.to_excel(template_xlsx, index=False)
        logger.info(f"待人工匹配模板已保存: {template_xlsx}")


def main():
    """
    主流程：
    1. 读取两份报价文件
    2. 自动清理编码
    3. 自动匹配合并
    4. 如果有待匹配，导出模板供用户填写
    5. 读取用户映射（如果存在）
    6. 构建最终产品库
    7. 更新库存文件
    8. 保存所有输出
    """
    logger.info("=" * 60)
    logger.info("产品编码统一合并工具 开始运行")
    logger.info("=" * 60)

    # 配置文件路径
    file1_path = 'data/product_import_template.xlsx'
    file2_path = 'data/product_import_template_neixian.xlsx'
    stock_file_path = 'data/initial-bin-stock-template.xlsx'
    user_mapping_path = os.path.join(OUTPUT_DIR, 'mapping_template.xlsx')

    try:
        # 步骤1: 读取两份文件
        df1, map1 = read_quote_file(file1_path)
        df2, map2 = read_quote_file(file2_path)

        # 步骤2: 自动匹配合并
        auto_merged, pending = match_and_merge(df1, df2)

        # 步骤3: 如果有待匹配，导出模板
        if len(pending) > 0:
            export_pending_mapping(pending, os.path.join(OUTPUT_DIR, 'mapping_template.xlsx'))
            logger.info("请填写 output/mapping_template.xlsx 后重新运行程序完成合并")
            logger.info("当前仅保存已自动完成的部分")
        else:
            logger.info("所有产品都已自动匹配，无需人工干预")

        # 步骤4: 读取用户映射（如果文件存在且有内容）
        user_mapping = read_user_mapping(user_mapping_path)

        # 步骤5: 构建最终产品库和完整映射
        final_products, full_mapping = build_final_products(auto_merged, user_mapping, df1, df2)

        # 步骤6: 更新库存
        updated_stock = update_stock_codes(stock_file_path, full_mapping)

        # 步骤7: 保存所有输出
        save_outputs(final_products, full_mapping, updated_stock, pending)

        # 输出最终统计
        logger.info("=" * 60)
        logger.info("处理完成！最终统计:")
        logger.info(f"  - 文件1原始有效产品: {len(df1)}")
        logger.info(f"  - 文件2原始有效产品: {len(df2)}")
        logger.info(f"  - 自动匹配一致: {len(auto_merged[auto_merged['source'] == 'both'])}")
        logger.info(f"  - 仅文件1独有: {len(auto_merged[auto_merged['source'] == 'file1_only'])}")
        logger.info(f"  - 仅文件2独有: {len(auto_merged[auto_merged['source'] == 'file2_only'])}")
        logger.info(f"  - 需要人工映射: {len(pending)}")
        logger.info(f"  - 应用用户映射后最终产品数: {len(final_products)}")
        logger.info(f"  - 输出文件保存在: {OUTPUT_DIR}/")
        logger.info("=" * 60)

    except Exception as e:
        logger.error(f"处理过程发生错误: {str(e)}", exc_info=True)
        raise


if __name__ == '__main__':
    main()
