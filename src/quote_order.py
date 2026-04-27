#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
订单报价工具
功能：基于标准产品库对订单文件进行自动报价，支持0/O字符混淆容错匹配
"""

import pandas as pd
import logging
import os
from typing import Dict, Tuple, Optional

# 配置日志系统
os.makedirs('../logs', exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('../logs/quote_order.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# 确保输出目录存在
OUTPUT_DIR = '../output'
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 文件路径配置
STANDARD_LIB_PATH = '../data/standard_product_library.xlsx'
ORDER_20260420_PATH = '../order/20260420.xlsx'
ORDER_HT_PATH = '../order/HT.xlsx'


def load_standard_library() -> Dict[str, Dict]:
    """
    加载标准产品库，构建编码→产品信息的映射字典

    Returns:
        Dict: {标准编码: {'价格': float, '原规格编码': str, '规格': str}}
    """
    logger.info("正在加载标准产品库...")
    df = pd.read_excel(STANDARD_LIB_PATH)

    lib = {}
    for _, row in df.iterrows():
        code = str(row['标准编码']).strip()
        lib[code] = {
            '价格': row['价格'],
            '原规格编码': str(row['原规格编码']).strip(),
            '规格': str(row['规格']).strip()
        }

    logger.info(f"标准产品库加载完成，共 {len(lib)} 个产品")
    return lib


def clean_code(code: Optional[str]) -> str:
    """清理产品编码：按空格取前半部分，然后去除空格"""
    if pd.isna(code) or code is None:
        return ''
    # 先按空格分割取前半部分（处理 HT 格式如 "22612-06-08 S22"）
    code_str = str(code).strip().split(' ')[0]
    return code_str.replace(' ', '').strip()


def match_code(code: str, standard_lib: Dict[str, Dict]) -> Tuple[Optional[Dict], str]:
    """
    匹配产品编码，按优先级应用四条规则：
    1. 直接匹配
    2. 规则一：第五位是2时改为1匹配
    3. 规则二：末尾带T时去掉T匹配
    4. 规则四：O→0转换匹配

    Args:
        code: 待匹配的产品编码
        standard_lib: 标准产品库字典

    Returns:
        (产品信息字典, 匹配类型标注)
    """
    code_clean = clean_code(code)

    if not code_clean:
        return None, ''

    # ========== 工具函数：第五位1↔2转换 ==========
    def apply_rule1(c):
        code_no_dash = c.replace('-', '')
        if len(code_no_dash) < 5 or code_no_dash[4] not in ('1', '2'):
            return None, None
        fifth_char = code_no_dash[4]
        code_list = list(c)
        non_dash_count = 0
        fifth_pos = -1
        for i, ch in enumerate(code_list):
            if ch != '-':
                non_dash_count += 1
                if non_dash_count == 5:
                    fifth_pos = i
                    break
        if fifth_pos >= 0:
            target_char = '2' if fifth_char == '1' else '1'
            code_list[fifth_pos] = target_char
            return ''.join(code_list), f"{fifth_char}→{target_char}"
        return None, None

    # ========== 第一步：生成所有预处理变体（规则二、规则三） ==========
    # 格式: (变体编码, 预处理标记)
    variants = []

    # 变体1：原始编码（无预处理）
    variants.append((code_clean, ""))

    # 变体2：去T后（规则二）
    code_no_t = None
    if code_clean.endswith('T'):
        code_no_t = code_clean[:-1]
        variants.append((code_no_t, "去T"))

    # 变体3：去*后（规则三）
    code_no_star = None
    if '*' in code_clean:
        star_pos = code_clean.find('*')
        next_dash_pos = code_clean.find('-', star_pos)
        if next_dash_pos > star_pos:
            code_no_star = code_clean[:star_pos] + code_clean[next_dash_pos:]
        else:
            code_no_star = code_clean[:star_pos]
        variants.append((code_no_star, "去*"))

    # 变体4：去T后再去*（规则二+规则三）
    if code_no_t and '*' in code_no_t:
        star_pos = code_no_t.find('*')
        next_dash_pos = code_no_t.find('-', star_pos)
        if next_dash_pos > star_pos:
            code_no_t_star = code_no_t[:star_pos] + code_no_t[next_dash_pos:]
        else:
            code_no_t_star = code_no_t[:star_pos]
        variants.append((code_no_t_star, "去T+去*"))

    # 变体5：去*后再去T（规则三+规则二）
    if code_no_star and code_no_star.endswith('T'):
        code_no_star_t = code_no_star[:-1]
        variants.append((code_no_star_t, "去*+去T"))

    # ========== 第二步：对每个变体尝试各种匹配策略 ==========
    for variant_code, preprocess in variants:
        # 策略1：直接匹配
        if variant_code in standard_lib:
            if preprocess:
                return standard_lib[variant_code], f"{preprocess}匹配"
            else:
                return standard_lib[variant_code], "直接匹配"

        # 策略2：规则一（1↔2）
        c, direction = apply_rule1(variant_code)
        if c and c in standard_lib:
            if preprocess:
                return standard_lib[c], f"{preprocess}+1↔2({direction})匹配"
            else:
                return standard_lib[c], f"规则一({direction})匹配"

        # 策略3：规则四（O→0）
        code_o0 = variant_code.replace('O', '0').replace('o', '0')
        if code_o0 != variant_code and code_o0 in standard_lib:
            if preprocess:
                return standard_lib[code_o0], f"{preprocess}+O→0匹配"
            else:
                return standard_lib[code_o0], "规则四(O→0)匹配"

    return None, "无匹配"


def is_product_code(code: str) -> bool:
    """判断是否为产品编码（非标题行）"""
    code_clean = clean_code(code)
    if not code_clean:
        return False
    # 排除标题关键词
    exclude_keywords = ['FERRULE', 'PART', 'NO', 'HOSE', 'BSP', 'JIC', 'METRIC',
                        'SAE', 'FLANGE', 'CONNECTOR', 'BANJO', 'JIS', 'ORFS', 'ITEM',
                        'FOR', 'EN', 'ISO', 'DIN', 'GB/T', 'L.T.', 'H.T.', 'SEAT']
    for kw in exclude_keywords:
        if kw.upper() in code_clean.upper():
            return False
    # 产品编码通常包含'-'且长度在5-20之间
    return '-' in code_clean and 5 <= len(code_clean) <= 20


def process_main_order(standard_lib: Dict[str, Dict]) -> pd.DataFrame:
    """
    处理20260420.xlsx主订单文件

    Returns:
        处理后的DataFrame
    """
    logger.info("正在处理主订单文件 20260420.xlsx...")
    df = pd.read_excel(ORDER_20260420_PATH, header=None)

    # 确保有足够的列（扩展到K列，索引10）
    while len(df.columns) < 11:
        df[len(df.columns)] = None

    # 统计变量
    total_rows = 0
    stats = {
        "直接匹配": 0,
        "规则一": 0,
        "规则二": 0,
        "规则三": 0,
        "规则四": 0,
        "规则组合": 0,
        "无匹配": 0
    }
    no_match_codes = []

    for idx, row in df.iterrows():
        code = row.iloc[0]

        if not is_product_code(code):
            continue

        total_rows += 1
        product_info, match_label = match_code(code, standard_lib)

        if product_info:
            # G列 = 价格
            df.iloc[idx, 6] = product_info['价格']
            # I列 = 标准编码（从匹配结果中获取）
            df.iloc[idx, 8] = product_info['规格']
            # J列 = 原规格编码
            df.iloc[idx, 9] = product_info['原规格编码']
            # K列 = 匹配标注
            df.iloc[idx, 10] = match_label

            # 统计分类
            if "直接匹配" == match_label:
                stats["直接匹配"] += 1
            elif "+" in match_label:
                stats["规则组合"] += 1
            elif "规则一" in match_label:
                stats["规则一"] += 1
            elif "去T" == match_label or "去T匹配" == match_label:
                stats["规则二"] += 1
            elif "去*" == match_label or "去*匹配" == match_label:
                stats["规则三"] += 1
            elif "规则四" in match_label:
                stats["规则四"] += 1
        else:
            df.iloc[idx, 10] = match_label
            stats["无匹配"] += 1
            no_match_codes.append(clean_code(code))

        # H列 = 总价 = F列数量 × G列单价
        quantity = row.iloc[5]
        price = df.iloc[idx, 6]
        if pd.notna(quantity) and pd.notna(price):
            try:
                df.iloc[idx, 7] = float(quantity) * float(price)
            except (ValueError, TypeError):
                pass

    logger.info(f"主订单处理完成: 共 {total_rows} 行产品")
    logger.info(f"  直接匹配: {stats['直接匹配']} 行")
    logger.info(f"  规则一(1↔2): {stats['规则一']} 行")
    logger.info(f"  规则二(去T): {stats['规则二']} 行")
    logger.info(f"  规则三(去*): {stats['规则三']} 行")
    logger.info(f"  规则四(O→0): {stats['规则四']} 行")
    logger.info(f"  规则组合: {stats['规则组合']} 行")
    logger.info(f"  无匹配: {stats['无匹配']} 行")
    if no_match_codes:
        logger.info(f"  无匹配编码列表: {no_match_codes}")

    return df


def process_ht_order(standard_lib: Dict[str, Dict]) -> pd.DataFrame:
    """
    处理HT.xlsx订单文件

    Returns:
        处理后的DataFrame
    """
    logger.info("正在处理HT订单文件 HT.xlsx...")
    df = pd.read_excel(ORDER_HT_PATH, header=None)

    # 确保有足够的列（扩展到F列，索引5）
    while len(df.columns) < 6:
        df[len(df.columns)] = None

    # 统计变量
    total_rows = 0
    stats = {
        "直接匹配": 0,
        "规则一": 0,
        "规则二": 0,
        "规则三": 0,
        "规则四": 0,
        "规则组合": 0,
        "无匹配": 0
    }
    no_match_codes = []

    for idx, row in df.iterrows():
        code = row.iloc[0]

        if not is_product_code(code):
            continue

        total_rows += 1
        product_info, match_label = match_code(code, standard_lib)

        if product_info:
            # C列 = 价格
            df.iloc[idx, 2] = product_info['价格']
            # D列 = 标准编码（从匹配结果中获取）
            df.iloc[idx, 3] = product_info['规格']
            # E列 = 原规格编码
            df.iloc[idx, 4] = product_info['原规格编码']
            # F列 = 匹配标注
            df.iloc[idx, 5] = match_label

            # 统计分类
            if "直接匹配" == match_label:
                stats["直接匹配"] += 1
            elif "+" in match_label:
                stats["规则组合"] += 1
            elif "规则一" in match_label:
                stats["规则一"] += 1
            elif "去T" == match_label or "去T匹配" == match_label:
                stats["规则二"] += 1
            elif "去*" == match_label or "去*匹配" == match_label:
                stats["规则三"] += 1
            elif "规则四" in match_label:
                stats["规则四"] += 1
        else:
            df.iloc[idx, 5] = match_label
            stats["无匹配"] += 1
            no_match_codes.append(clean_code(code))

    logger.info(f"HT订单处理完成: 共 {total_rows} 行产品")
    logger.info(f"  直接匹配: {stats['直接匹配']} 行")
    logger.info(f"  规则一(1↔2): {stats['规则一']} 行")
    logger.info(f"  规则二(去T): {stats['规则二']} 行")
    logger.info(f"  规则三(去*): {stats['规则三']} 行")
    logger.info(f"  规则四(O→0): {stats['规则四']} 行")
    logger.info(f"  规则组合: {stats['规则组合']} 行")
    logger.info(f"  无匹配: {stats['无匹配']} 行")
    if no_match_codes:
        logger.info(f"  无匹配编码列表: {no_match_codes}")

    return df


def main():
    """主函数：处理所有订单文件"""
    logger.info("=" * 50)
    logger.info("开始订单报价处理")
    logger.info("=" * 50)

    # 加载标准产品库
    standard_lib = load_standard_library()

    # 处理主订单
    df_main = process_main_order(standard_lib)
    output_main = os.path.join(OUTPUT_DIR, '20260420_quoted.xlsx')
    df_main.to_excel(output_main, index=False, header=False)
    logger.info(f"主订单结果已保存到: {output_main}")

    # 处理HT订单
    df_ht = process_ht_order(standard_lib)
    output_ht = os.path.join(OUTPUT_DIR, 'HT_quoted.xlsx')
    df_ht.to_excel(output_ht, index=False, header=False)
    logger.info(f"HT订单结果已保存到: {output_ht}")

    logger.info("=" * 50)
    logger.info("所有订单报价处理完成")
    logger.info("=" * 50)

if __name__ == '__main__':
    main()
