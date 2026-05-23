#!/bin/bash
# 飞书报价快捷命令 - 手动触发版
# v3.0 核心库版

CHAT_ID="oc_af677b42686cb33271f07e05979e18fe"
PROJECT_ROOT="/Users/aaron/product_data_clean"
SCRIPTS_DIR="$PROJECT_ROOT/.claude/skills/product-quoting/scripts"

echo "========================================"
echo "  飞书报价快捷工具 v3.0 (核心库版)"
echo "  Chat ID: $CHAT_ID"
echo "========================================"
echo ""

case "$1" in
    "quote")
        # 报价: ./quote.sh quote /path/to/order.xlsx 1 3
        FILE="$2"
        CODE_COL="${3:-0}"
        QTY_COL="${4:-1}"
        
        echo "📊 开始报价..."
        echo "   文件: $FILE"
        echo "   产品列: $CODE_COL"
        echo "   数量列: $QTY_COL"
        echo ""
        
        python "$SCRIPTS_DIR/feishu_quote_bot.py" quote --file "$FILE" --code-col "$CODE_COL" --qty-col "$QTY_COL"
        ;;
    
    "update")
        # 更新标准库: ./quote.sh update /path/to/feedback.xlsx 0 5 10
        FILE="$2"
        CODE_COL="${3:-0}"
        PRICE_COL="${4:-5}"
        LABEL_COL="${5:-10}"
        
        echo "🔄 开始更新标准库..."
        echo "   文件: $FILE"
        echo "   产品列: $CODE_COL"
        echo "   价格列: $PRICE_COL"
        echo "   标注列: $LABEL_COL"
        echo ""
        
        python "$SCRIPTS_DIR/feishu_quote_bot.py" update --file "$FILE" --code-col "$CODE_COL" --price-col "$PRICE_COL" --label-col "$LABEL_COL"
        ;;
    
    "check")
        echo "🔍 检查标准库重复编码..."
        python "$SCRIPTS_DIR/feishu_quote_bot.py" check
        ;;
    
    "msg")
        # 发送文本消息: ./quote.sh msg "你好，报价请求已收到"
        TEXT="$2"
        echo "💬 发送消息: $TEXT"
        python "$SCRIPTS_DIR/feishu_quote_bot.py" msg "$TEXT"
        ;;
    
    *)
        echo "使用方法:"
        echo ""
        echo "  报价:"
        echo "    ./quote.sh quote /path/to/order.xlsx <产品列号> <数量列号>"
        echo "    示例: ./quote.sh quote ~/Downloads/询价.xlsx 1 3"
        echo ""
        echo "  更新标准库:"
        echo "    ./quote.sh update /path/to/feedback.xlsx <产品列号> <价格列号> <标注列号>"
        echo "    示例: ./quote.sh update ~/Downloads/反馈.xlsx 0 5 10"
        echo ""
        echo "  检查重复编码:"
        echo "    ./quote.sh check"
        echo ""
        echo "  发送消息:"
        echo "    ./quote.sh msg \"消息内容\""
        echo ""
        echo "列号说明: A=0, B=1, C=2, D=3, E=4, F=5..."
        echo ""
        echo "✅ 使用核心 product_quoting_core，匹配逻辑100%一致"
        ;;
esac
