#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude Skill 统一入口 - 薄包装层，直接导入核心库
绝对原则：此处不包含任何匹配逻辑，所有逻辑来自 product_quoting_core
"""
import os
import sys

# 1. 定位项目根目录
#    脚本位置: project/.claude/skills/product-quoting/scripts/main.py
#    向上4级找到 product_data_clean 根目录
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(SCRIPT_DIR)
CLAUDE_DIR = os.path.dirname(os.path.dirname(SKILL_DIR))
PROJECT_ROOT = os.path.dirname(CLAUDE_DIR)

# 2. 确保可以导入核心库
sys.path.insert(0, PROJECT_ROOT)
sys.path.insert(0, os.path.join(PROJECT_ROOT, "src"))

# 3. 导入核心服务
from product_quoting_core.service import QuotingService
from product_quoting_core.library import StandardLibrary

# 4. 数据目录（使用 web/data/ 作为主数据目录）
DATA_DIR = os.path.join(PROJECT_ROOT, "product_quoting_web", "data")
OUTPUT_DIR = os.path.join(PROJECT_ROOT, "output")
FEEDBACK_DIR = os.path.join(PROJECT_ROOT, "feedback")
LOG_DIR = os.path.join(PROJECT_ROOT, "logs")
LIB_PATH = os.path.join(DATA_DIR, "standard_product_library.xlsx")
RULES_PATH = os.path.join(DATA_DIR, "matching_rules_config.json")

# 确保目录存在
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(FEEDBACK_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)


def print_header():
    """打印头部信息"""
    print("=" * 60)
    print("  产品编码统一与自动报价技能 v3.0 (Claude Skill版)")
    print(f"  项目根目录: {PROJECT_ROOT}")
    print(f"  标准库: {LIB_PATH}")
    print("  ✅ 使用核心 product_quoting_core，匹配逻辑100%一致")
    print("=" * 60)
    print()


def cmd_quote(file_path, code_col, qty_col):
    """报价命令"""
    print_header()
    
    # 转换为绝对路径
    if not os.path.isabs(file_path):
        file_path = os.path.join(os.getcwd(), file_path)
    
    service = QuotingService(lib_path=LIB_PATH, rules_path=RULES_PATH)
    
    # 生成输出文件名
    filename = os.path.splitext(os.path.basename(file_path))[0]
    timestamp = __import__('datetime').datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(OUTPUT_DIR, f"{filename}_quoted.xlsx")
    feedback_path = os.path.join(FEEDBACK_DIR, f"{filename}_quoted.xlsx")
    
    # 使用核心库处理报价
    result_df, stats, unmatched_codes = service.process_quote(file_path, code_col, qty_col)
    
    # 保存结果
    result_df.to_excel(output_path, index=False, header=False)
    import shutil
    shutil.copy(output_path, feedback_path)
    
    print()
    print(f"✅ 报价完成")
    print(f"   输出文件: {output_path}")
    print(f"   反馈文件: {feedback_path}")
    
    matched_count = stats['total'] - stats['no_match']
    match_rate = (matched_count / stats['total'] * 100) if stats['total'] > 0 else 0
    
    print(f"   匹配率: {matched_count}/{stats['total']} ({match_rate:.1f}%)")
    
    if unmatched_codes:
        print(f"   ⚠️  未匹配编码 ({len(unmatched_codes)}个):")
        for code in unmatched_codes[:10]:
            print(f"      - {code}")
        if len(unmatched_codes) > 10:
            print(f"      ... 还有 {len(unmatched_codes) - 10} 个")
    
    return {
        "output_path": output_path,
        "feedback_path": feedback_path,
        "matched_count": matched_count,
        "total_count": stats['total'],
        "match_rate": match_rate,
        "unmatched_codes": unmatched_codes
    }


def cmd_update(file_path, code_col, price_col, label_col):
    """更新标准库命令 - 使用 src/quoting_skill.py 的逻辑"""
    print_header()
    
    # 转换为绝对路径
    if not os.path.isabs(file_path):
        file_path = os.path.join(os.getcwd(), file_path)
    
    # 使用 quoting_skill.py 的更新逻辑（核心库的 update_from_feedback 签名不同）
    import subprocess
    quoting_script = os.path.join(PROJECT_ROOT, "src", "quoting_skill.py")
    cmd = f'cd "{PROJECT_ROOT}/src" && python quoting_skill.py update "{file_path}" {code_col} {price_col} {label_col}'
    
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    
    # 重新加载标准库获取最新数量
    lib = StandardLibrary(LIB_PATH)
    print(f"   当前标准库总数: {lib.size()} 个")
    
    return {"total_count": lib.size()}


def cmd_check():
    """检查重复编码"""
    print_header()
    
    lib = StandardLibrary(LIB_PATH)
    
    # 使用核心库的内置检查方法
    duplicates = lib.check_duplicates()
    
    if duplicates:
        print(f"❌ 发现重复编码: {len(duplicates)} 个")
        for code in duplicates:
            print(f"   - {code}")
    else:
        print(f"✅ 所有标准编码唯一，共 {lib.size()} 个")
    
    return duplicates


def main():
    if len(sys.argv) < 2:
        print_header()
        print("使用方法:")
        print()
        print("  1. 报价:")
        print("     python main.py quote <文件路径> <产品列号> <数量列号>")
        print("     示例: python main.py quote ../../order/询价.xlsx 1 3")
        print()
        print("  2. 更新标准库:")
        print("     python main.py update <文件路径> <产品列号> <价格列号> <标注列号>")
        print("     示例: python main.py update ../../feedback/报价结果.xlsx 0 5 10")
        print()
        print("  3. 检查重复编码:")
        print("     python main.py check")
        print()
        print("列号说明: A=0, B=1, C=2, D=3, E=4, F=5...")
        print()
        print("重要: 所有入口共用 product_quoting_core，匹配逻辑100%一致")
        return 1
    
    cmd = sys.argv[1]
    
    if cmd == "quote":
        if len(sys.argv) < 5:
            print("参数不足: quote <文件路径> <产品列号> <数量列号>")
            return 1
        file_path = sys.argv[2]
        code_col = int(sys.argv[3])
        qty_col = int(sys.argv[4])
        cmd_quote(file_path, code_col, qty_col)
    
    elif cmd == "update":
        if len(sys.argv) < 6:
            print("参数不足: update <文件路径> <产品列号> <价格列号> <标注列号>")
            return 1
        file_path = sys.argv[2]
        code_col = int(sys.argv[3])
        price_col = int(sys.argv[4])
        label_col = int(sys.argv[5])
        cmd_update(file_path, code_col, price_col, label_col)
    
    elif cmd == "check":
        cmd_check()
    
    else:
        print(f"未知命令: {cmd}")
        return 1
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
