#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
报价与标准库闭环维护技能模块
功能：标准化报价流程，支持任意格式报价单，自动处理反馈维护

统一核心库架构：本文件仅作为CLI入口，所有核心逻辑由 product_quoting_core 提供
✅ 修改匹配规则：只改 product_quoting_core/matcher.py
✅ 修改数据路径：只改 product_quoting_web/data/

使用方法:
    1. 报价: python quoting_skill.py quote <文件路径> <产品列号> <数量列号>
    2. 反馈维护: python quoting_skill.py update <文件路径> <产品列号> <价格列号> <标注列号>

列号从0开始(A=0, B=1, C=2, D=3, ...)
"""

import logging
import os
import sys
import pandas as pd
from datetime import datetime
from pathlib import Path

# 添加项目根目录到路径，确保能导入核心库
PROJECT_ROOT = str(Path(__file__).resolve().parents[1])
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# 导入统一核心库
from product_quoting_core.service import QuotingService

# 配置日志
os.makedirs('../logs', exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('../logs/quoting_skill.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# 路径配置 - 统一使用 product_quoting_web/data 作为唯一数据目录
BASE_DIR = Path(__file__).resolve().parents[1]
STANDARD_LIB_PATH = str(BASE_DIR / 'product_quoting_web' / 'data' / 'standard_product_library.xlsx')
MATCHING_RULES_PATH = str(BASE_DIR / 'product_quoting_web' / 'data' / 'matching_rules_config.json')
FEEDBACK_DIR = str(BASE_DIR / 'feedback')
OUTPUT_DIR = str(BASE_DIR / 'output')
LOG_DIR = str(BASE_DIR / 'logs')


def quote_order(file_path: str, code_col: int, qty_col: int, markup: float = 0) -> None:
    """
    对订单文件进行报价 - 调用统一核心库

    Args:
        file_path: 订单文件路径
        code_col: 产品编码列号 (0开始, A=0, B=1...)
        qty_col: 数量列号
        markup: 价格上浮百分比，0表示不上浮
    """
    separator = '=' * 60
    logger.info(separator)
    logger.info(f"开始报价处理: {os.path.basename(file_path)}")
    logger.info(separator)
    logger.info(f"产品编码列: 第{code_col}列 ({chr(ord('A')+code_col)})")
    logger.info(f"数量列: 第{qty_col}列 ({chr(ord('A')+qty_col)})")
    if markup > 0:
        logger.info(f"价格上浮: {markup}%")

    service = QuotingService(STANDARD_LIB_PATH, MATCHING_RULES_PATH, LOG_DIR)
    df, stats, no_match_codes = service.process_quote(file_path, code_col, qty_col, markup)

    # 输出统计
    matched = stats['total'] - stats['no_match']
    logger.info(f"处理完成: 共 {stats['total']} 行产品")
    logger.info(f"  直接匹配: {stats['direct_match']} 行")
    logger.info(f"  规则一(1↔2): {stats['rule1_match']} 行")
    logger.info(f"  规则二(去T): {stats['rule2_match']} 行")
    logger.info(f"  规则三(去*): {stats['rule3_match']} 行")
    logger.info(f"  规则四(O→0): {stats['rule4_match']} 行")
    logger.info(f"  规则五(前五位匹配): {stats['rule5_match']} 行")
    logger.info(f"  规则组合: {stats['rule_combination']} 行")
    logger.info(f"  无匹配: {stats['no_match']} 行")
    logger.info(f"  匹配率: {matched}/{stats['total']} ({matched/stats['total']*100:.1f}%)")

    if no_match_codes and len(no_match_codes) <= 20:
        logger.info(f"  无匹配编码: {no_match_codes}")
    elif no_match_codes:
        logger.info(f"  无匹配编码: {len(no_match_codes)} 个 (前20): {no_match_codes[:20]}")

    # 输出数量列警告
    qty_warnings = stats.get('qty_warnings', [])
    if qty_warnings:
        logger.warning(f"  数量列警告 ({len(qty_warnings)} 条):")
        for w in qty_warnings:
            logger.warning(f"    {w}")

    # 保存结果
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    basename = os.path.splitext(os.path.basename(file_path))[0]
    output_path = os.path.join(OUTPUT_DIR, f"{basename}_quoted.xlsx")

    # 调用核心库保存带样式的Excel
    service.save_styled_quote(df, output_path, code_col, qty_col)
    logger.info(f"带样式的报价结果已保存: {output_path}")
    logger.info(separator)

    # 将结果复制到feedback目录，待人工填写价格
    feedback_path = os.path.join(FEEDBACK_DIR, f"{basename}_quoted.xlsx")
    os.makedirs(FEEDBACK_DIR, exist_ok=True)
    service.save_styled_quote(df, feedback_path, code_col, qty_col)
    logger.info(f"反馈待处理文件已复制到: {feedback_path}")
    logger.info("请人工填写无匹配产品的价格后，使用 update 命令维护到标准库")


def update_library_from_feedback(file_path: str, code_col: int,
                                 price_col: int, label_col: int) -> None:
    """
    从反馈文件更新标准产品库 - 调用统一核心库

    Args:
        file_path: 反馈文件路径
        code_col: 产品编码列号
        price_col: 价格列号
        label_col: 匹配标注列号 (用于筛选"无匹配")
    """
    separator = '=' * 60
    logger.info(separator)
    logger.info(f"开始标准库更新: {os.path.basename(file_path)}")
    logger.info(separator)

    service = QuotingService(STANDARD_LIB_PATH, MATCHING_RULES_PATH, LOG_DIR)
    original_count = service.get_library_size()

    added, skipped = service.update_library(file_path, code_col, price_col, label_col)

    # 输出更新详情
    for item in added:
        logger.info(f"  新增: {item['original']} → {item['std']} (价格: {item['price']})")
    for item in skipped:
        logger.warning(f"  已跳过: {item.get('original', '')} → {item.get('std', '')} ({item.get('reason', '编码已存在')})")

    if added:
        logger.info(f"库更新完成: 原有 {original_count} 个，新增 {len(added)} 个，跳过 {len(skipped)} 个已有")
        logger.info(f"现有 {service.get_library_size()} 个产品")
    else:
        logger.info(f"没有新增产品（新增: {len(added)}, 跳过: {len(skipped)}）")

    logger.info(separator)


def print_usage():
    """打印使用说明"""
    print("=" * 60)
    print("报价与标准库闭环维护技能")
    print("✅ 使用统一核心库 product_quoting_core")
    print("=" * 60)
    print()
    print("使用方式:")
    print()
    print("1. 对订单文件进行报价:")
    print("   python quoting_skill.py quote <文件路径> <产品列号> <数量列号>")
    print()
    print("   示例 - 接头询价 (B列=产品, C列=数量):")
    print("   python quoting_skill.py quote ../order/接头询价\\(4.xls 1 2")
    print()
    print("   示例 - 带上浮10%报价 (B列=产品, C列=数量):")
    print("   python quoting_skill.py quote ../order/接头询价\\(4.xls 1 2 --markup 10")
    print()
    print("   示例 - 天一询价单 (B列=产品, D列=数量):")
    print("   python quoting_skill.py quote ../order/天一询价2026.04.22.xlsx 1 3")
    print()
    print("2. 从反馈文件更新标准库:")
    print("   python quoting_skill.py update <文件路径> <产品列号> <价格列号> <标注列号>")
    print()
    print("   示例 - 报价结果 (A列=产品, F列=价格, K列=标注):")
    print("   python quoting_skill.py update ../feedback/接头询价\\(4_quoted.xlsx 0 5 10")
    print()
    print("列号说明: 从0开始计数 (A=0, B=1, C=2, D=3, E=4, F=5, ... K=10)")
    print()
    print("=" * 60)


def main():
    if len(sys.argv) < 2:
        print_usage()
        return

    command = sys.argv[1]

    if command == 'quote':
        if len(sys.argv) < 5:
            print("错误: quote 命令需要 3 个参数: <文件路径> <产品列号> <数量列号> [--markup <百分比>]")
            print_usage()
            return
        file_path = sys.argv[2]
        code_col = int(sys.argv[3])
        qty_col = int(sys.argv[4])
        markup = 0.0
        # 解析可选参数 --markup
        for i, arg in enumerate(sys.argv):
            if arg == '--markup' and i + 1 < len(sys.argv):
                try:
                    markup = float(sys.argv[i + 1])
                except ValueError:
                    print(f"错误: 上浮百分比无效: {sys.argv[i + 1]}")
                    return
        quote_order(file_path, code_col, qty_col, markup)

    elif command == 'update':
        if len(sys.argv) < 6:
            print("错误: update 命令需要 4 个参数: <文件路径> <产品列号> <价格列号> <标注列号>")
            print_usage()
            return
        file_path = sys.argv[2]
        code_col = int(sys.argv[3])
        price_col = int(sys.argv[4])
        label_col = int(sys.argv[5])
        update_library_from_feedback(file_path, code_col, price_col, label_col)

    else:
        print(f"未知命令: {command}")
        print_usage()


if __name__ == '__main__':
    main()
