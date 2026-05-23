#!/bin/bash
# 飞书报价机器人 - 快速测试脚本

SKILL_DIR="/Users/aaron/product_data_clean/.claude/skills/product-quoting"
SCRIPTS_DIR="$SKILL_DIR/scripts"
TEST_ORDER="$SKILL_DIR/data/test_order.xlsx"

echo "========================================"
echo "  飞书报价机器人 - 快速测试"
echo "========================================"
echo ""

echo "📋 1. 检查环境..."
which lark-cli > /dev/null && echo "✅ lark-cli 已安装" || echo "❌ lark-cli 未找到"
python -c "import pandas" 2>/dev/null && echo "✅ pandas 已安装" || echo "❌ pandas 未安装"
echo ""

echo "📊 2. 检查标准库..."
cd "$SCRIPTS_DIR" && python main.py check
echo ""

echo "🧪 3. 测试报价功能..."
# 创建测试订单文件
python3 << 'EOF'
import pandas as pd
df = pd.DataFrame([
    ["22611-04-04", 100],
    ["22611-04-04T", 50],
    ["30411-06-06", 20],
])
df.to_excel("/tmp/test_quote_order.xlsx", index=False, header=False)
print("✅ 测试订单已创建")
EOF
echo ""

# 执行测试报价
cd "$SCRIPTS_DIR" && python main.py quote /tmp/test_quote_order.xlsx 0 1
echo ""

echo "📄 4. 查看输出文件..."
OUTPUT_FILE=$(ls -t "$SKILL_DIR/data/output/" | head -1)
echo "最新输出文件: $OUTPUT_FILE"
echo ""

echo "📝 5. 飞书机器人状态..."
echo "网关运行中: $(hermes gateway status | grep -q PID && echo "✅" || echo "❌")"
echo "飞书认证: $(lark-cli auth status | grep -q bot && echo "✅" || echo "❌")"
echo ""

echo "========================================"
echo "  测试完成！"
echo "========================================"
echo ""
echo "💡 使用提示："
echo "  1. 在飞书中给 Bot 发送 Excel 报价单"
echo "  2. 消息格式："
echo "     报价"
echo "     产品列: 1"
echo "     数量列: 3"
echo ""
echo "  3. 填写好价格后发回更新："
echo "     更新标准库"
echo "     产品列: 0"
echo "     价格列: 5"
echo "     标注列: 10"
echo ""
echo "📚 完整指南: $SKILL_DIR/飞书报价机器人使用指南.md"
