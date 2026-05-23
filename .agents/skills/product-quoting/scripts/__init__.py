# 产品报价技能 - Python模块
# 可作为模块导入使用：from product_quoting import ProductQuoter, StandardLibrary

from .config import SKILL_ROOT, DATA_DIR, ensure_dirs
from .library import StandardLibrary, MatchingRules
from .matcher import CodeMatcher

__version__ = "2.0.0"
__all__ = [
    'StandardLibrary',
    'MatchingRules',
    'CodeMatcher',
    'ProductQuoter',  # 别名，方便使用
    'SKILL_ROOT',
    'DATA_DIR',
]

# 别名：CodeMatcher 也可以作为 ProductQuoter 使用
ProductQuoter = CodeMatcher
