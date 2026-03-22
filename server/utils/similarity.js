/**
 * 字符串相似度计算工具
 * 综合 Levenshtein 编辑距离 + 字符集重合率，返回 0~1 的评分（1=完全相同）
 */

/**
 * 计算两个字符串的 Levenshtein 编辑距离
 */
function levenshtein(a, b) {
    if (!a || !b) return Math.max((a || '').length, (b || '').length);
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }
    return dp[m][n];
}

/**
 * 计算字符集重合率（Jaccard 相似度）
 */
function jaccardSimilarity(a, b) {
    if (!a || !b) return 0;
    const setA = new Set(a.toLowerCase().split(''));
    const setB = new Set(b.toLowerCase().split(''));
    const intersection = new Set([...setA].filter(c => setB.has(c)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * 综合相似度评分（0~1，越高越接近）
 * @param {string} a 
 * @param {string} b 
 * @returns {number}
 */
export function similarity(a, b) {
    if (!a || !b) return 0;
    const strA = a.toString().toLowerCase().trim();
    const strB = b.toString().toLowerCase().trim();
    if (strA === strB) return 1;

    const maxLen = Math.max(strA.length, strB.length);
    if (maxLen === 0) return 1;

    const editDist = levenshtein(strA, strB);
    const editScore = 1 - editDist / maxLen;
    const jaccard = jaccardSimilarity(strA, strB);

    // 加权平均：编辑距离权重 0.6，字符重合权重 0.4
    return editScore * 0.6 + jaccard * 0.4;
}

/**
 * 从产品列表中找出与给定字符串最相似的 Top N 个产品
 * @param {string} input - 客户输入的编码或名称
 * @param {Array} products - 产品列表
 * @param {number} topN - 返回数量
 * @returns {Array} - 带 score 的产品列表
 */
export function findTopSimilar(input, products, topN = 3) {
    if (!input || !products?.length) return [];

    const scored = products.map(p => {
        const codeScore = similarity(input, p.product_code || '');
        const nameScore = similarity(input, p.name_cn || '');
        const nameEnScore = similarity(input, p.name_en || '');
        const score = Math.max(codeScore, nameScore, nameEnScore);
        return { ...p, score: Math.round(score * 100) };
    });

    return scored
        .filter(p => p.score > 20) // 过滤明显不相关的
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);
}

export default { similarity, findTopSimilar };
