#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
整理生成标准产品库
输出包含四列：标准编码、规格、价格、别名集合
处理逻辑：
1. 读取内线表所有编码
2. 按规格分组，两两比较，使用三条规则识别别名
3. 将识别出的别名合并到别名集合，生成最终标准产品库
"""

import pandas as pd
import logging
from typing import Dict, List, Tuple, Optional

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('../logs/build_standard_product_library.log', encoding='utf-8'),
        logging.StreamHandler()
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
        规则：第五位是'2'的作为别名
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
        # 确定哪个是别名：第五位是'2'的作为别名
        which = 'code1' if c1[4] == '2' else 'code2'
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


def clean_product_code(code) -> str:
    """
    清理产品编码，去除所有空格

    参数:
        code: 原始产品编码（任意类型）

    返回:
        清理后的编码字符串
    """
    if pd.isna(code):
        return ""

    code_str = str(code)
    # 去除所有空格
    code_str = code_str.replace(" ", "").strip()

    return code_str


def find_internal_aliases(neixian_df: pd.DataFrame) -> Tuple[List[Tuple[str, str]], int]:
    """
    在内线表内部按三条规则识别别名

    返回:
        [(alias_code, standard_code), ...] - 别名列表
        int - 识别出的别名数量
    """
    logger.info("开始在内线表内部识别别名...")

    # 预处理：提取编码、规格
    processed_data = []
    for _, row in neixian_df.iterrows():
        code = clean_product_code(row['产品编码(必填)'])
        if not code:
            continue
        spec = row['规格'] if not pd.isna(row['规格']) else ''
        # 如果规格为空，从编码提取前三位（和跨文件处理保持一致）
        if not spec:
            code_no_dash = code.replace('-', '')
            if len(code_no_dash) >= 3:
                spec = code_no_dash[:3]
            else:
                spec = code_no_dash
        processed_data.append({
            'code': code,
            'spec': spec
        })

    df = pd.DataFrame(processed_data)
    logger.info(f"共 {len(df)} 个有效编码，按规格分组...")

    # 按规格分组
    spec_groups = df.groupby('spec')

    internal_aliases = []
    alias_codes = set()

    # 统计各规则识别数
    rule_counts = {1: 0, 2: 0, 3: 0}

    for spec_name, group in spec_groups:
        if len(group) <= 1:
            continue  # 同规格只有一个产品，不可能有别名

        codes = list(group['code'])
        logger.debug(f"规格 '{spec_name}' 有 {len(codes)} 个产品，检查别名...")

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
                    alias_code = code1 if alias_side == 'code1' else code2
                    standard_code = code2 if alias_side == 'code1' else code1
                    internal_aliases.append((alias_code, standard_code))
                    alias_codes.add(alias_code)
                    rule_counts[1] += 1
                    logger.debug(f"规则一匹配: {alias_code} -> {standard_code}")
                    continue

                # 规则二
                is_match, alias_side = check_rule2(code1, code2)
                if is_match:
                    alias_code = code1 if alias_side == 'code1' else code2
                    standard_code = code2 if alias_side == 'code1' else code1
                    internal_aliases.append((alias_code, standard_code))
                    alias_codes.add(alias_code)
                    rule_counts[2] += 1
                    logger.debug(f"规则二匹配: {alias_code} -> {standard_code}")
                    continue

                # 规则三
                is_match, alias_side = check_rule3(code1, code2)
                if is_match:
                    alias_code = code1 if alias_side == 'code1' else code2
                    standard_code = code2 if alias_side == 'code1' else code1
                    internal_aliases.append((alias_code, standard_code))
                    alias_codes.add(alias_code)
                    rule_counts[3] += 1
                    logger.debug(f"规则三匹配: {alias_code} -> {standard_code}")
                    continue

    logger.info(f"内线内部别名识别完成:")
    logger.info(f"  两两匹配找到: 规则一 {rule_counts[1]} 个, 规则二 {rule_counts[2]} 个, 规则三 {rule_counts[3]} 个, 总计 {len(internal_aliases)} 个")

    # 处理单独存在的编码：如果自身带*或结尾带T，自动生成干净版本作为标准
    # 用户要求：即使干净版本不存在于原始数据中，也自动生成
    # 递归处理：同时包含*和T的情况，需要多次处理直到完全干净
    auto_generated_count = 0
    all_codes_set = set(c['code'] for c in processed_data)

    def process_with_wildcard(c: str) -> str:
        """处理包含*的代码，移除*及之后到下一个-的内容"""
        parts = c.split('*', 1)
        prefix = parts[0]
        rest = parts[1]
        dash_index = rest.find('-')
        if dash_index == -1:
            return prefix
        else:
            return prefix + rest[dash_index:]

    def generate_clean_code(code: str) -> str:
        """递归生成干净编码，移除所有*和结尾T"""
        current = code
        changed = True
        while changed:
            changed = False
            # 先移除结尾T
            if current.endswith('T') and len(current) > 1:
                current = current[:-1]
                changed = True
            # 再移除*部分
            if '*' in current:
                current = process_with_wildcard(current)
                changed = True
        return current

    for item in processed_data:
        code = item['code']
        if code in alias_codes:
            continue  # 已经是别名，跳过

        # 生成完全干净的编码
        clean_code = generate_clean_code(code)

        # 如果干净编码不等于原编码，且干净编码不在原始数据中，就将原编码作为别名
        if clean_code != code and clean_code not in all_codes_set:
            internal_aliases.append((code, clean_code))
            alias_codes.add(code)
            auto_generated_count += 1
            # 统计：只要原编码包含*就算规则三，只有结尾T不算规则三
            if '*' in code:
                rule_counts[3] += 1
            else:
                rule_counts[2] += 1
            logger.debug(f"自动生成干净版本: {code} -> {clean_code}")
            continue

    logger.info(f"自动生成干净版本: {auto_generated_count} 个")
    logger.info(f"内线内部识别总计: 规则一 {rule_counts[1]} 个, 规则二 {rule_counts[2]} 个, 规则三 {rule_counts[3]} 个, 总计 {len(internal_aliases)} 个")

    return internal_aliases, len(internal_aliases)


def build_standard_product_library(neixian_path, cross_file_alias_path, output_path):
    """
    构建标准产品库

    Args:
        neixian_path: 内线报价文件路径
        cross_file_alias_path: 跨文件（蘑菇 vs 内线）别名映射文件路径
        output_path: 输出文件路径
    """
    logger.info("开始构建标准产品库")

    # 1. 读取内线原始数据
    logger.info(f"读取内线报价文件: {neixian_path}")
    neixian_df = pd.read_excel(neixian_path)
    logger.info(f"内线报价共 {len(neixian_df)} 条记录")

    # 2. 读取跨文件别名映射（蘑菇→内线）
    logger.info(f"读取跨文件别名映射: {cross_file_alias_path}")
    cross_alias_df = pd.read_excel(cross_file_alias_path)
    logger.info(f"跨文件别名共 {len(cross_alias_df)} 条记录")

    # 3. 在内线内部识别别名
    internal_aliases, internal_count = find_internal_aliases(neixian_df)

    # 4. 构建标准编码到别名列表的映射
    logger.info("构建标准编码到别名列表的映射...")
    standard_to_aliases: Dict[str, List[str]] = {}

    # 4.1 加入跨文件别名（蘑菇→内线）
    for _, row in cross_alias_df.iterrows():
        alias_code = clean_product_code(row['别名'])
        standard_code = clean_product_code(row['统一编码'])
        if alias_code and standard_code:
            if standard_code not in standard_to_aliases:
                standard_to_aliases[standard_code] = []
            if alias_code not in standard_to_aliases[standard_code]:
                standard_to_aliases[standard_code].append(alias_code)

    # 4.2 加入内线内部识别出的别名
    for alias_code, standard_code in internal_aliases:
        if alias_code and standard_code:
            if standard_code not in standard_to_aliases:
                standard_to_aliases[standard_code] = []
            if alias_code not in standard_to_aliases[standard_code]:
                standard_to_aliases[standard_code].append(alias_code)

    # 5. 收集所有编码，递归处理传递关系，确定最终标准编码
    # 建立反向映射：alias -> standard
    alias_to_standard: Dict[str, str] = {}
    for standard, aliases in standard_to_aliases.items():
        for alias in aliases:
            alias_to_standard[alias] = standard

    # 递归查找最终标准编码（处理传递别名：A是B别名，B是C别名 → A→C）
    def find_final_standard(code: str) -> str:
        if code in alias_to_standard:
            return find_final_standard(alias_to_standard[code])
        return code

    # 6. 收集原始内线所有编码，得到每个编码的最终标准编码
    # 创建编码到(规格, 价格)的映射
    code_to_spec_price: Dict[str, Tuple[str, float]] = {}
    all_codes = []
    for _, row in neixian_df.iterrows():
        code = clean_product_code(row['产品编码(必填)'])
        if not code:
            continue
        all_codes.append(code)
        spec = row['规格'] if not pd.isna(row['规格']) else ''
        price = row['售价'] if not pd.isna(row['售价']) else ''
        code_to_spec_price[code] = (spec, price)

    # 为每个编码找到最终标准编码（递归处理传递关系）
    code_to_final_standard: Dict[str, str] = {}
    for code in all_codes:
        final_standard = find_final_standard(code)
        code_to_final_standard[code] = final_standard

    # 7. 按最终标准编码分组，汇总所有别名
    final_standard_to_aliases: Dict[str, List[str]] = {}
    final_standard_to_spec_price: Dict[str, Tuple[str, float]] = {}

    # 先处理所有原始编码
    for code, final_standard in code_to_final_standard.items():
        if code == final_standard:
            # 这是标准编码本身，获取规格价格
            if final_standard not in final_standard_to_spec_price:
                final_standard_to_spec_price[final_standard] = code_to_spec_price[code]
            continue
        else:
            # 这是别名，添加到标准编码的别名集合中
            if final_standard not in final_standard_to_aliases:
                final_standard_to_aliases[final_standard] = []
            if code not in final_standard_to_aliases[final_standard]:
                final_standard_to_aliases[final_standard].append(code)
            # 如果标准编码还没有规格价格，从这个别名获取
            if final_standard not in final_standard_to_spec_price and code in code_to_spec_price:
                final_standard_to_spec_price[final_standard] = code_to_spec_price[code]

    # 处理自动生成的标准编码（它们不在原始数据中，但别名在）
    # 确保每个标准都有规格价格
    for standard_code in final_standard_to_aliases:
        if standard_code not in final_standard_to_spec_price:
            # 从第一个别名获取规格价格
            first_alias = final_standard_to_aliases[standard_code][0]
            if first_alias in code_to_spec_price:
                final_standard_to_spec_price[standard_code] = code_to_spec_price[first_alias]
                logger.debug(f"自动生成标准编码 {standard_code} 从别名 {first_alias} 获取规格价格")

    # 还需要加上之前从跨文件映射中已经得到的别名（蘑菇→内线）
    # 这些别名原本就来自蘑菇，它们的标准编码已经是内线编码
    # 需要把它们也加进去
    for standard_code, aliases in standard_to_aliases.items():
        final_standard = find_final_standard(standard_code)
        if final_standard not in final_standard_to_aliases:
            final_standard_to_aliases[final_standard] = []
        for alias in aliases:
            if alias not in final_standard_to_aliases[final_standard]:
                # 检查这个别名本身是不是也需要指向最终标准
                # 如果别名本身是另一个标准的别名，跳过，因为它已经被处理了
                if alias not in code_to_final_standard or code_to_final_standard[alias] == alias:
                    final_standard_to_aliases[final_standard].append(alias)

    # 8. 构建输出数据
    output_data = []
    missing_count = 0

    for standard_code in sorted(final_standard_to_spec_price.keys()):
        spec, price = final_standard_to_spec_price[standard_code]
        aliases = final_standard_to_aliases.get(standard_code, [])
        # 别名排序，多个用逗号分隔
        aliases_sorted = sorted(aliases)
        alias_str = ','.join(aliases_sorted) if aliases else ''

        output_data.append({
            '标准编码': standard_code,
            '规格': spec,
            '价格': price,
            '别名集合': alias_str
        })

    # 9. 创建DataFrame并保存
    result_df = pd.DataFrame(output_data)
    # 按标准编码排序
    result_df = result_df.sort_values('标准编码').reset_index(drop=True)
    # 将所有NaN替换为空字符串，避免Excel中显示NaN
    result_df = result_df.fillna('')

    # 检查标准编码唯一性
    codes = result_df['标准编码'].tolist()
    seen = set()
    duplicate_codes = []
    for code in codes:
        if code in seen:
            duplicate_codes.append(code)
        seen.add(code)

    if duplicate_codes:
        logger.warning(f"\n⚠️  发现 {len(duplicate_codes)} 个重复的标准编码！")
        logger.warning(f"重复编码: {duplicate_codes}")
        print(f"\n{'='*60}")
        print(f"⚠️  警告：发现 {len(duplicate_codes)} 个重复的标准编码！")
        print(f"重复编码: {duplicate_codes}")
        print(f"请检查输入数据，修正重复后重新生成")
        print(f"{'='*60}\n")
    else:
        logger.info(f"✅ 标准编码唯一性检查通过，无重复")

    # 统计
    total_standards = len(result_df)
    has_alias = len([r for r in output_data if r['别名集合']])
    no_alias = total_standards - has_alias

    logger.info(f"\n生成完成:")
    logger.info(f"  总标准产品数: {total_standards}")
    logger.info(f"  有别名的标准产品: {has_alias}")
    logger.info(f"  无别名的标准产品: {no_alias}")
    logger.info(f"  其中内线内部识别出 {internal_count} 个别名")

    # 保存到Excel
    result_df.to_excel(output_path, index=False)
    logger.info(f"标准产品库已保存到: {output_path}")

    return result_df


def main():
    # 文件路径
    base_dir = '/Users/aaron/product_data_clean'
    neixian_path = f"{base_dir}/data/product_import_template_neixian.xlsx"
    cross_alias_path = f"{base_dir}/data/alias_mapping.xlsx"
    output_path = f"{base_dir}/data/standard_product_library.xlsx"

    try:
        result_df = build_standard_product_library(neixian_path, cross_alias_path, output_path)
        print(f"\n完成！标准产品库已生成: {output_path}")
        print(f"总标准产品数: {len(result_df)}")
        print(f"其中 {len([r for _, r in result_df.iterrows() if r['别名集合'] != ''])} 个有别名")
    except Exception as e:
        logger.error(f"构建标准产品库失败: {str(e)}", exc_info=True)
        raise


if __name__ == '__main__':
    main()
