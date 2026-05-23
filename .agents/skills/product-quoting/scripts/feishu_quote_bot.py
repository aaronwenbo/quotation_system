#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
飞书报价机器人 - 自动处理飞书消息中的报价单
⚠️  薄包装层：此处不包含任何匹配逻辑，所有逻辑来自 product_quoting_core
"""
import os
import sys
import json
import subprocess
import shutil

# 1. 定位项目根目录
#    脚本位置: project/.claude/skills/product-quoting/scripts/feishu_quote_bot.py
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

# 你的飞书聊天 ID
CHAT_ID = "oc_af677b42686cb33271f07e05979e18fe"


def log(message):
    """记录日志"""
    timestamp = __import__('datetime').datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {message}"
    print(line)
    with open(os.path.join(LOG_DIR, "feishu_bot.log"), "a", encoding="utf-8") as f:
        f.write(line + "\n")


def run_command(cmd):
    """执行shell命令"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.returncode, result.stdout, result.stderr
    except Exception as e:
        return -1, "", str(e)


def quote(file_path, code_col=0, qty_col=1):
    """执行报价（使用核心库）"""
    log(f"开始报价: {file_path}, 产品列: {code_col}, 数量列: {qty_col}")
    
    service = QuotingService(lib_path=LIB_PATH, rules_path=RULES_PATH)
    
    # 生成输出文件名
    filename = os.path.splitext(os.path.basename(file_path))[0]
    output_path = os.path.join(OUTPUT_DIR, f"{filename}_quoted.xlsx")
    feedback_path = os.path.join(FEEDBACK_DIR, f"{filename}_quoted.xlsx")
    
    # 使用核心库处理报价
    result_df, stats, unmatched_codes = service.process_quote(file_path, code_col, qty_col)
    
    # 保存结果
    result_df.to_excel(output_path, index=False, header=False)
    shutil.copy(output_path, feedback_path)
    
    log(f"报价完成: {output_path}")
    
    return {
        "output_path": output_path,
        "feedback_path": feedback_path,
        "matched_count": stats["matched"],
        "total_count": stats["total"],
        "match_rate": stats["match_rate"],
        "unmatched_codes": unmatched_codes
    }


def update_library(file_path, code_col=0, price_col=5, label_col=10):
    """更新标准库（使用 src/quoting_skill.py）"""
    log(f"开始更新标准库: {file_path}")
    
    # 使用 quoting_skill.py 的更新逻辑
    quoting_script = os.path.join(PROJECT_ROOT, "src", "quoting_skill.py")
    cmd = f'cd "{PROJECT_ROOT}/src" && python quoting_skill.py update "{file_path}" {code_col} {price_col} {label_col}'
    
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    if result.returncode != 0:
        log(f"更新失败: {result.stderr}")
        return {"success": False, "error": result.stderr}
    
    # 重新加载标准库获取最新数量
    lib = StandardLibrary(LIB_PATH)
    log(f"更新完成，当前总数: {lib.size()}")
    
    return {"success": True, "total_count": lib.size()}


def check_duplicates():
    """检查重复编码"""
    lib = StandardLibrary(LIB_PATH)
    return lib.check_duplicates()


def send_feishu_message(chat_id, text):
    """发送飞书消息"""
    # 转义文本中的特殊字符
    text_escaped = json.dumps(text)
    cmd = f'lark-cli api POST /open-apis/im/v1/messages --as bot --params \'{{"receive_id_type":"chat_id"}}\' --data \'{{"receive_id":"{chat_id}","msg_type":"text","content":{{"text":{text_escaped}}}}}\''
    
    code, stdout, stderr = run_command(cmd)
    return code == 0, stdout if code == 0 else stderr


def process_quote_command(file_path, code_col=0, qty_col=1):
    """处理报价命令"""
    log(f"收到报价请求: {file_path}")
    
    # 执行报价
    result = quote(file_path, code_col, qty_col)
    
    message = f"""✅ 报价完成！

📊 统计：
  总产品数: {result['total_count']}
  匹配数: {result['matched_count']}
  匹配率: {result['match_rate']:.1f}%
  无匹配: {len(result['unmatched_codes'])} 个

📁 文件位置：
  报价结果: {result['output_path']}
  反馈副本: {result['feedback_path']}

💡 下一步：
  人工填写无匹配产品的价格后，使用"更新标准库"命令
  列号说明：A=0, B=1, C=2, D=3...
"""
    
    if result['unmatched_codes'][:5]:
        message += "\n⚠️  未匹配编码示例:\n"
        for code in result['unmatched_codes'][:5]:
            message += f"  - {code}\n"
        if len(result['unmatched_codes']) > 5:
            message += f"  ... 还有 {len(result['unmatched_codes']) - 5} 个\n"
    
    send_feishu_message(CHAT_ID, message)
    print(message)


def process_update_command(file_path, code_col=0, price_col=5, label_col=10):
    """处理更新标准库命令"""
    log(f"收到更新标准库请求: {file_path}")
    
    # 执行更新
    result = update_library(file_path, code_col, price_col, label_col)
    
    # 检查重复
    duplicates = check_duplicates()
    
    if result["success"]:
        message = f"""✅ 标准库更新完成！

📈 当前标准库总数: {result['total_count']} 个
"""
    else:
        message = f"""❌ 标准库更新失败！

错误: {result.get('error', '未知错误')}
"""
    
    if duplicates:
        message += f"\n⚠️  发现重复编码: {len(duplicates)} 个\n"
        for code in duplicates[:5]:
            message += f"  - {code}\n"
    else:
        message += "\n✅ 所有编码唯一，无重复\n"
    
    send_feishu_message(CHAT_ID, message)
    print(message)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="飞书报价机器人 (核心库版)")
    parser.add_argument("action", choices=["quote", "update", "check"], help="操作类型")
    parser.add_argument("--chat-id", default=CHAT_ID, help="飞书聊天ID")
    parser.add_argument("--file", help="Excel文件路径")
    parser.add_argument("--code-col", type=int, default=0, help="产品编码列号")
    parser.add_argument("--qty-col", type=int, default=1, help="数量列号")
    parser.add_argument("--price-col", type=int, default=5, help="价格列号")
    parser.add_argument("--label-col", type=int, default=10, help="标注列号")
    
    args = parser.parse_args()
    
    if args.action == "quote":
        if not args.file:
            print("错误: 报价需要 --file 参数")
            sys.exit(1)
        process_quote_command(args.file, args.code_col, args.qty_col)
    
    elif args.action == "update":
        if not args.file:
            print("错误: 更新需要 --file 参数")
            sys.exit(1)
        process_update_command(args.file, args.code_col, args.price_col, args.label_col)
    
    elif args.action == "check":
        lib = StandardLibrary(LIB_PATH)
        duplicates = check_duplicates()
        if duplicates:
            print(f"❌ 发现重复编码: {len(duplicates)} 个")
            for code in duplicates:
                print(f"   - {code}")
        else:
            print(f"✅ 所有标准编码唯一，共 {lib.size()} 个")