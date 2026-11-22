/**
 * AI 网页公式复制乱码清洗与纯文本 Unicode 转换工具 —— 自动化测试套件
 * 运行方式：node cleaner.test.js
 */
'use strict';

const assert = require('node:assert/strict');
const { cleanMathText, convertLatexFormula } = require('./cleaner.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Expected: ${JSON.stringify(err.expected)}`);
    console.error(`     Actual  : ${JSON.stringify(err.actual)}`);
    if (err.message && err.expected === undefined) {
      console.error(`     Error   : ${err.message}`);
    }
    failed++;
  }
}

console.log('\n============================================================');
console.log(' AI 网页公式乱码清洗与 Unicode 转换引擎 —— 自动化验收测试');
console.log('============================================================\n');

// ----------------------------------------------------------------------------
// 1. 真实测试基准样例（严格按用户提供的字符与换行结构构造）
// ----------------------------------------------------------------------------
const BENCHMARK_INPUT = [
  'C1： 标题由 "Unmeasured gene imputation" 改为 "Held-out gene localization"；括注 "(held-out gene)" 改为 "(expression kept)"，明确主设定只遮住空间信息，表达量仍然输入。',
  'C3： 标题由 "State relocalization" 改为 "Within-gene state shift"。',
  '示意图由 Δz 双箭头改为投影：两种状态的 z_base 点云之间画一条状态轴 ',
  '𝑢',
  'u，把只用上下文预测的 ',
  '𝑧',
  '^',
  'z',
  '^',
  '  投到轴上得到 ',
  '𝑠',
  's。',
  '底部公式由 ',
  'Δ',
  '𝑧',
  '=',
  '𝑧',
  'ctx',
  '−',
  '𝑧',
  'base',
  'Δz=z ',
  'ctx',
  '',
  ' −z ',
  'base',
  '',
  '  改为 ',
  '𝑠',
  '=',
  '𝑧',
  '^',
  '⊤',
  '𝑢',
  ',',
  ' ',
  '𝑢',
  '∝',
  '𝜇',
  '𝐵',
  '−',
  '𝜇',
  '𝐴',
  's= ',
  'z',
  '^',
  '  ',
  '⊤',
  ' u, u∝μ ',
  'B',
  '',
  ' −μ ',
  'A',
  '',
  ' 。'
].join('\n');

const BENCHMARK_EXPECTED = [
  'C1： 标题由 "Unmeasured gene imputation" 改为 "Held-out gene localization"；括注 "(held-out gene)" 改为 "(expression kept)"，明确主设定只遮住空间信息，表达量仍然输入。',
  'C3： 标题由 "State relocalization" 改为 "Within-gene state shift"。',
  '示意图由 Δz 双箭头改为投影：两种状态的 z_base 点云之间画一条状态轴 u，把只用上下文预测的 ẑ 投到轴上得到 s。',
  '底部公式由 Δz = z_ctx − z_base 改为 s = ẑ⊤u, u ∝ μ_B − μ_A。'
].join('\n');

test('1. 真实基准样例：完整精确还原（消除重影、缝合碎换行、保留真分段、合成 ẑ、识别下标与转置）', () => {
  const actual = cleanMathText(BENCHMARK_INPUT);
  assert.equal(actual, BENCHMARK_EXPECTED);
});

test('2. 真实基准样例（高压脏字符版）：混入 U+200B 零宽空格、U+2062 隐形乘号、U+00A0 不换行空格与 CRLF', () => {
  const dirtyInput = BENCHMARK_INPUT
    .replace(/\n\n/g, '\n\u200B\n') // KaTeX .vlist-s 真实零宽空格行
    .replace('Δz=z ', 'Δ\u200Bz=z\u00A0')
    .replace('u∝μ ', 'u\u2062∝\u200Bμ\u00A0')
    .replace(/\n/g, '\r\n');
  const actual = cleanMathText(dirtyInput);
  assert.equal(actual, BENCHMARK_EXPECTED);
});

// ----------------------------------------------------------------------------
// 2. 双层重影泛化结构测试（上下标并存、分式、巨型算符、根式、SVG 顶标、分段大括号）
// ----------------------------------------------------------------------------

test('3. 上下标同时存在（KaTeX supsub 双层：x_i^2 + y_j^3）', () => {
  const input = [
    '能量项定义为 ',
    '𝑥',
    '𝑖',
    '2',
    '+',
    '𝑦',
    '𝑗',
    '3',
    'x ',
    'i',
    '2',
    '',
    ' +y ',
    'j',
    '3',
    '',
    ' ，满足非负性。'
  ].join('\n');
  assert.equal(cleanMathText(input), '能量项定义为 x_i² + y_j³，满足非负性。');
});

test('4. 下标防割裂一致性：独立纯数字下标转 x₁, x₂；与字母下标同处一式时统一用 _1 防割裂', () => {
  const pureDigits = '设 $x_1 + x_2 = 1$，而对比项为 $z_1 - z_{\\text{base}}$。';
  assert.equal(cleanMathText(pureDigits), '设 x₁ + x₂ = 1，而对比项为 z_1 − z_base。');
  assert.equal(
    cleanMathText(pureDigits, { subscriptMode: 'underscore' }),
    '设 x_1 + x_2 = 1，而对比项为 z_1 − z_base。'
  );
});

test('5. 分式双层复制（正序 .frac-line 空行结构）：\\frac{a+b}{c}', () => {
  const input = [
    '比值为 ',
    '𝑎',
    '+',
    '𝑏',
    '𝑐',
    'a+b',
    '',
    'c',
    '',
    ' 。'
  ].join('\n');
  assert.equal(cleanMathText(input), '比值为 (a + b)/c。');
});

test('6. 分式双层复制（视觉层分子分母反序 [denom, numer]）：严格按 MathML 层保持分子在前', () => {
  const input = [
    '归一化权重 ',
    '𝑤',
    '=',
    '𝛼',
    '𝛼',
    '+',
    '𝛽',
    'w= ',
    'α+β',
    'α',
    '',
    ' 。'
  ].join('\n');
  assert.equal(cleanMathText(input), '归一化权重 w = α/(α + β)。');
});

test('7. 块级巨型算符上下限（HTML 视觉层 [sub, ∑, sup] 顺序反转）：\\sum_{i=1}^n x_i', () => {
  const input = [
    '样本均值可写为 ',
    '∑',
    '𝑖',
    '=',
    '1',
    '𝑛',
    '𝑥',
    '𝑖',
    'i=1',
    '∑',
    'n',
    ' x ',
    'i',
    '',
    ' 。'
  ].join('\n');
  assert.equal(cleanMathText(input), '样本均值可写为 ∑_(i=1)ⁿ x_i。');
});

test('8. 根号非对称双层配对（MathML <msqrt> 无 √ 文本，HTML 层带 √ 字符）', () => {
  const input = [
    '欧氏距离为 ',
    '𝑑',
    '=',
    '𝑥',
    '2',
    '+',
    '𝑦',
    '2',
    'd= √x ',
    '2',
    ' +y ',
    '2',
    ' 。'
  ].join('\n');
  // 验证完整还原根式与平方项
  const out = cleanMathText(input);
  assert.equal(out, '欧氏距离为 d = √(x² + y²)。');
});

test('9. SVG 省略顶标双层配对（MathML 含 → 或 ¯，KaTeX HTML 层用 SVG/border 无对应字符）', () => {
  const input = [
    '速度向量 ',
    '𝑣',
    '→',
    'v 与均值 ',
    '𝑥',
    '¯',
    'x 满足关系。'
  ].join('\n');
  assert.equal(cleanMathText(input), '速度向量 v⃗ 与均值 x̄ 满足关系。');
});

test('10. 多行可伸展大括号符号（⎛⎜⎝ ... ⎞⎟⎠）自动收敛为标准括号', () => {
  const input = [
    '矩阵映射 ',
    '𝑓',
    '(',
    '𝑥',
    ')',
    'f⎛⎜⎝x⎞⎟⎠ 保持不变。'
  ].join('\n');
  assert.equal(cleanMathText(input), '矩阵映射 f(x) 保持不变。');
});

// ----------------------------------------------------------------------------
// 3. 原始 LaTeX 输入解析与转换测试
// ----------------------------------------------------------------------------

test('11. 原始 LaTeX 转换：题目提及的全部典型公式 ($u$, $\\hat{z}$, $\\Delta z = z_{\\text{ctx}} - z_{\\text{base}}$)', () => {
  const input = '轴 $u$，预测 $\\hat{z}$，底部由 $\\Delta z = z_{\\text{ctx}} - z_{\\text{base}}$ 改为 $s = \\hat{z}^\\top u, \\quad u \\propto \\mu_B - \\mu_A$。';
  const expected = '轴 u，预测 ẑ，底部由 Δz = z_ctx − z_base 改为 s = ẑ⊤u, u ∝ μ_B − μ_A。';
  assert.equal(cleanMathText(input), expected);
});

test('12. 原始 LaTeX 复杂表达式：分式、根号、求和积分、双线体、多种顶标与集合关系', () => {
  const tex = '\\forall x \\in \\mathbb{R}^d, \\quad \\tilde{p}(x) = \\frac{1}{\\sqrt{2\\pi}\\sigma} \\exp\\left(-\\frac{(x - \\bar{\\mu})^2}{2\\sigma^2}\\right)';
  assert.equal(
    convertLatexFormula(tex),
    '∀ x ∈ ℝ^d, p̃(x) = 1/(√(2π)σ) exp(−(x − μ̄)²/(2σ²))'
  );
});

test('13. 原始 LaTeX 定界符兼容：$$...$$, \\(...\\), \\[...\\] 以及货币金额 $100 防误伤', () => {
  const input = [
    '预算从 $100 提升到 $200 per GPU。',
    '损失函数 \\(\\mathcal{L}(\\theta) \\leq \\epsilon\\) 收敛到：',
    '\\[\\lim_{t \\to \\infty} \\dot{x}_t = 0\\]'
  ].join('\n');
  const expected = [
    '预算从 $100 提升到 $200 per GPU。',
    '损失函数 L(θ) ≤ ε 收敛到：',
    'lim_(t → ∞) ẋ_t = 0'
  ].join('\n');
  assert.equal(cleanMathText(input), expected);
});

// ----------------------------------------------------------------------------
// 4. 段落结构保护、一元负号、紧凑模式与残缺框选兜底测试
// ----------------------------------------------------------------------------

test('14. 正常段落换行、空行与编号列表严格保留（不误合并）', () => {
  const input = [
    '1. 第一条结论保持独立。',
    '2. 第二条含公式 ',
    '𝛼',
    'α。',
    '',
    '第三段隔着空行，开头即为公式：',
    '𝛽',
    '=',
    '−',
    '1',
    'β=−1'
  ].join('\n');
  const expected = [
    '1. 第一条结论保持独立。',
    '2. 第二条含公式 α。',
    '',
    '第三段隔着空行，开头即为公式：',
    'β = −1'
  ].join('\n');
  assert.equal(cleanMathText(input), expected);
});

test('15. 一元负号与二元减号间距精确区分（s = −x vs a − b vs f(−x)）', () => {
  assert.equal(convertLatexFormula('s = -x + (-y) - z'), 's = −x + (−y) − z');
});

test('16. 紧凑运算符开关（compactOperators: true）', () => {
  const actual = cleanMathText(BENCHMARK_INPUT, { compactOperators: true });
  const expectedCompact = [
    'C1： 标题由 "Unmeasured gene imputation" 改为 "Held-out gene localization"；括注 "(held-out gene)" 改为 "(expression kept)"，明确主设定只遮住空间信息，表达量仍然输入。',
    'C3： 标题由 "State relocalization" 改为 "Within-gene state shift"。',
    '示意图由 Δz 双箭头改为投影：两种状态的 z_base 点云之间画一条状态轴 u，把只用上下文预测的 ẑ 投到轴上得到 s。',
    '底部公式由 Δz=z_ctx−z_base 改为 s=ẑ⊤u, u∝μ_B−μ_A。'
  ].join('\n');
  assert.equal(actual, expectedCompact);
});

test('17. 残缺局部框选兜底：仅复制到单层数学斜体或散落顶标时仍能干净还原', () => {
  const halfSelected = '局部选中了 𝜇 和 𝑧 以及散落的 \nz\n^\n 也能平滑恢复。';
  assert.equal(cleanMathText(halfSelected), '局部选中了 μ 和 z 以及散落的 ẑ 也能平滑恢复。');
});

test('18. 同行紧邻双倍重影消除（MathJax inline assistive-mml 模式：𝑢u, 𝑧^z^, 𝑓(𝑥)=𝑥+1f(x)=x+1）', () => {
  const inlineGhost = '画一条状态轴 𝑢u，预测 𝑧^z^，满足 𝑓(𝑥)=𝑥+1f(x)=x+1。';
  assert.equal(cleanMathText(inlineGhost), '画一条状态轴 u，预测 ẑ，满足 f(x) = x + 1。');
});

test('19. 定积分、显式间距宏 \\, 与复合希腊顶标下标（\\int_0^1 f(x) \\, \\mathrm{d}x 与 \\hat{\\mu}_B）', () => {
  const tex = '积分 $\\int_0^1 f(x) \\, \\mathrm{d}x$ 与估计量 $\\hat{\\mu}_B - \\ddot{x}_t$。';
  assert.equal(cleanMathText(tex), '积分 ∫₀¹ f(x) dx 与估计量 μ̂_B − ẍ_t。');
});

test('20. 复杂括号嵌套、二项式系数与范数符号（\\binom{n}{k}, \\|x - y\\|_2^2）', () => {
  const tex = '组合数 $\\binom{n}{k}$ 与距离 $\\|x - y\\|_2^2 \\geq 0$。';
  assert.equal(cleanMathText(tex), '组合数 C(n, k) 与距离 ‖x − y‖₂² ≥ 0。');
});

console.log(`\n------------------------------------------------------------`);
console.log(` 测试汇总：通过 ${passed} 项，失败 ${failed} 项`);
console.log(`------------------------------------------------------------\n`);

if (failed > 0) {
  process.exit(1);
}
