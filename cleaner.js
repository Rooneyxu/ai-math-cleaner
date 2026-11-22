/**
 * AI 网页公式复制乱码清洗与纯文本 Unicode 转换核心引擎
 * 零外部依赖，同时兼容浏览器端（含 DOM/剪贴板 HTML 通道）与 Node.js 环境（自动化测试）
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.AIMathCleaner = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ============================================================================
  // 1. 常量与符号映射表
  // ============================================================================

  // 隐形控制字符（不含换行，用于清洗；\u200b 在切行初期先用于标记 .vlist-s 空行）
  const INVISIBLE_CHARS_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;

  // 大尺寸分段括号（KaTeX/MathJax 多行定界符）映射到标准括号
  const EXTENSIBLE_BRACKET_MAP = {
    '⎛': '(', '⎜': '', '⎝': '',
    '⎞': ')', '⎟': '', '⎠': '',
    '⎡': '[', '⎢': '', '⎣': '',
    '⎤': ']', '⎥': '', '⎦': '',
    '⎧': '{', '⎨': '', '⎩': '', '⎪': '',
    '⎫': '}', '⎬': '', '⎭': '',
    '⟨': '⟨', '⟩': '⟩', '⟪': '⟨', '⟫': '⟩'
  };

  // Unicode Letterlike 区块中属于普通数学变量变体的码点（保留 ℝℤℕℚℂ 等标准数集双线体）
  const LETTERLIKE_MATH_VAR_SET = new Set([
    0x210E, // ℎ -> h (Planck constant / math italic h)
    0x210A, // ℊ -> g
    0x210B, // ℋ -> H
    0x210C, // ℌ -> H
    0x2110, // ℐ -> I
    0x2111, // ℑ -> I
    0x2112, // ℒ -> L
    0x2113, // ℓ -> l (在规范对比时视为 l；可读输出中也转为 l 或按需保留)
    0x211B, // ℛ -> R
    0x211C, // ℜ -> R
    0x212C, // ℬ -> B
    0x212D, // ℭ -> C
    0x212F, // ℯ -> e
    0x2130, // ℰ -> E
    0x2131, // ℱ -> F
    0x2133, // ℳ -> M
    0x2134  // ℴ -> o
  ]);

  // 双线体数集符号（配对比较时可等价到基础字母，但输出时保留高可读性 ℝ, ℤ, ℕ, ℚ, ℂ, 𝔼, ℙ）
  const BLACKBOARD_KEEP_MAP = {
    0x1D53C: '𝔼', // \mathbb{E}
    0x1D543: '𝕃',
    0x2115: 'ℕ',
    0x2119: 'ℙ',
    0x211A: 'ℚ',
    0x211D: 'ℝ',
    0x2124: 'ℤ',
    0x2102: 'ℂ'
  };

  // 希腊变体字符统一为标准希腊字母
  const GREEK_VARIANT_MAP = {
    'ϵ': 'ε',
    'ϕ': 'φ',
    'ϑ': 'θ',
    'ϱ': 'ρ',
    'ϰ': 'κ',
    'ϖ': 'π',
    'ς': 'σ'
  };

  // 顶部修饰符（独立字符 -> Unicode Combining Diacritical Mark）
  const ACCENT_COMBINING_MAP = {
    '^': '\u0302',  // hat
    'ˆ': '\u0302',  // modifier circumflex
    '\u02C6': '\u0302',
    '\u0302': '\u0302',
    '¯': '\u0304',  // macron / bar
    'ˉ': '\u0304',  // modifier macron
    '‾': '\u0304',  // overline
    '\u0304': '\u0304',
    '\u0305': '\u0304',
    '~': '\u0303',  // tilde
    '∼': '\u0303',  // tilde operator (when used as over-accent)
    '˜': '\u0303',  // small tilde
    '\u0303': '\u0303',
    '→': '\u20D7',  // vec right arrow above
    '⇀': '\u20D1',  // harpoon above
    '\u20D7': '\u20D7',
    '˙': '\u0307',  // dot
    '\u0307': '\u0307',
    '¨': '\u0308',  // ddot
    '\u0308': '\u0308',
    'ˇ': '\u030C',  // check
    '˘': '\u0306'   // breve
  };

  // 在 KaTeX HTML 层可能由 SVG 或 CSS border 绘制而不产生文本字符的修饰符
  const SVG_DROPPABLE_ACCENTS = new Set(['^', 'ˆ', '¯', 'ˉ', '‾', '~', '∼', '˜', '→', '⇀', 'ˇ', '˘']);

  // Unicode 上标字符映射（简单单字符/纯数字正负号场景）
  const SUPERSCRIPT_CHAR_MAP = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'i': 'ⁱ'
  };

  // Unicode 数字下标映射
  const SUBSCRIPT_DIGIT_MAP = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
  };

  // 巨型算符集合（可带上下限）
  const BIG_OPERATORS = new Set([
    '∑', '∏', '∐', '∫', '∬', '∭', '∮', '⋃', '⋂', '⨁', '⨂', '⋁', '⋀',
    'lim', 'max', 'min', 'sup', 'inf', 'argmax', 'argmin'
  ]);

  // 二元关系与二元运算符（规范化时两侧加单空格）
  const BINARY_REL_OPS = new Set([
    '=', '≠', '≈', '≃', '≅', '≡', '∼', '∝',
    '<', '>', '≤', '≥', '≪', '≫', '≺', '≻', '≼', '≽',
    '∈', '∉', '∋', '⊂', '⊃', '⊆', '⊇', '⊊', '⊋',
    '→', '←', '↔', '⇒', '⇐', '⇔', '↦', '⟶', '⟹', '⟺',
    '≔', '≕', '≜'
  ]);

  const BINARY_ARITH_OPS = new Set([
    '+', '−', '±', '∓', '×', '÷', '·', '⊕', '⊗', '⊙', '∪', '∩', '∖', '∧', '∨'
  ]);

  // LaTeX 命令映射表
  const LATEX_SYMBOLS = {
    // 小写希腊字母
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ',
    epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η',
    theta: 'θ', vartheta: 'θ', iota: 'ι', kappa: 'κ', varkappa: 'κ',
    lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'π',
    rho: 'ρ', varrho: 'ρ', sigma: 'σ', varsigma: 'ς', tau: 'τ',
    upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
    // 大写希腊字母
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ',
    Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
    // 运算符与关系符
    pm: '±', mp: '∓', times: '×', div: '÷', cdot: '·', centerdot: '·',
    ast: '∗', star: '⋆', circ: '∘', bullet: '∙',
    oplus: '⊕', ominus: '⊖', otimes: '⊗', odot: '⊙',
    propto: '∝', varpropto: '∝',
    top: '⊤', bot: '⊥', perp: '⊥', parallel: '∥', mid: '|', nmid: '∤',
    sim: '∼', backsim: '∽', simeq: '≃', approx: '≈', cong: '≅', equiv: '≡',
    neq: '≠', ne: '≠', leq: '≤', le: '≤', geq: '≥', ge: '≥',
    ll: '≪', gg: '≫', prec: '≺', succ: '≻', preceq: '≼', succeq: '≽',
    in: '∈', notin: '∉', ni: '∋', owns: '∋',
    subset: '⊂', supset: '⊃', subseteq: '⊆', supseteq: '⊇', subsetneq: '⊊', supsetneq: '⊋',
    cup: '∪', cap: '∩', setminus: '∖', smallsetminus: '∖',
    emptyset: '∅', varnothing: '∅',
    forall: '∀', exists: '∃', nexists: '∄', neg: '¬', lnot: '¬',
    land: '∧', wedge: '∧', lor: '∨', vee: '∨',
    // 箭头
    to: '→', rightarrow: '→', gets: '←', leftarrow: '←', leftrightarrow: '↔',
    longrightarrow: '→', longleftarrow: '←', longleftrightarrow: '↔',
    Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔',
    Longrightarrow: '⇒', Longleftarrow: '⇐', Longleftrightarrow: '⇔',
    iff: '⇔', implies: '⇒', impliedby: '⇐',
    mapsto: '↦', longmapsto: '↦',
    uparrow: '↑', downarrow: '↓', updownarrow: '↕',
    nearrow: '↗', searrow: '↘', swarrow: '↙', nwarrow: '↖',
    // 巨型算符与微积分
    sum: '∑', prod: '∏', coprod: '∐',
    int: '∫', iint: '∬', iiint: '∭', oint: '∮',
    bigcup: '⋃', bigcap: 'bigcap' === 'bigcap' ? '⋂' : '⋂',
    bigoplus: '⨁', bigotimes: '⨂',
    partial: '∂', nabla: '∇', infty: '∞',
    ell: 'ℓ', hbar: 'ℏ', Re: 'Re', Im: 'Im', wp: '℘', aleph: 'ℵ',
    triangle: '△', triangledown: '▽', square: '□', diamond: '◇',
    angle: '∠', degree: '°', prime: '′',
    dots: '...', ldots: '...', cdots: '⋯', vdots: '⋮', ddots: '⋱',
    colon: ':',
    // 括号别名
    langle: '⟨', rangle: '⟩',
    lceil: '⌈', rceil: '⌉', lfloor: '⌊', rfloor: '⌋',
    Vert: '‖', lVert: '‖', rVert: '‖', vert: '|', lvert: '|', rvert: '|',
    // 知名算子与函数名
    sin: 'sin', cos: 'cos', tan: 'tan', cot: 'cot', sec: 'sec', csc: 'csc',
    arcsin: 'arcsin', arccos: 'arccos', arctan: 'arctan',
    sinh: 'sinh', cosh: 'cosh', tanh: 'tanh',
    exp: 'exp', log: 'log', ln: 'ln', lg: 'lg',
    lim: 'lim', limsup: 'lim sup', liminf: 'lim inf',
    sup: 'sup', inf: 'inf', max: 'max', min: 'min',
    argmax: 'argmax', argmin: 'argmin', arg: 'arg',
    det: 'det', dim: 'dim', ker: 'ker', hom: 'hom', deg: 'deg', gcd: 'gcd',
    Pr: 'Pr', cov: 'cov', Var: 'Var', tr: 'tr', diag: 'diag', rank: 'rank', softmax: 'softmax'
  };

  const LATEX_ACCENT_MACROS = {
    hat: '^', widehat: '^',
    bar: '¯', overline: '¯',
    tilde: '~', widetilde: '~',
    vec: '→', overrightarrow: '→',
    dot: '˙', ddot: '¨',
    check: 'ˇ', breve: '˘'
  };

  const LATEX_FONT_WRAPPERS = new Set([
    'text', 'textbf', 'textit', 'textrm', 'textsf', 'texttt', 'textup', 'textnormal',
    'mathrm', 'mathbf', 'mathit', 'mathsf', 'mathtt', 'mathcal', 'mathscr', 'mathfrak',
    'boldsymbol', 'bm', 'pmb', 'operatorname', 'mbox', 'hbox'
  ]);

  const LATEX_IGNORE_MODIFIERS = new Set([
    'left', 'right', 'middle', 'big', 'Big', 'bigg', 'Bigg',
    'bigl', 'bigr', 'Bigl', 'Bigr', 'biggl', 'biggr', 'Biggl', 'Biggr',
    'displaystyle', 'textstyle', 'scriptstyle', 'scriptscriptstyle',
    'limits', 'nolimits', 'relax', '!'
  ]);

  const LATEX_SPACE_MACROS = new Set([',', ';', ':', ' ', 'quad', 'qquad', 'enspace', 'thinspace', 'medspace', 'thickspace']);

  const BLACKBOARD_ASCII_MAP = {
    R: 'ℝ', Z: 'ℤ', N: 'ℕ', Q: 'ℚ', C: 'ℂ', E: '𝔼', P: 'ℙ', I: '𝕀', F: '𝔽', H: 'ℍ', S: '𝕊'
  };

  // ============================================================================
  // 2. 基础字符工具函数
  // ============================================================================

  /**
   * 判断单个码点是否为 Mathematical Alphanumeric Symbols 或 Letterlike 数学变量符号
   */
  function isMathAlphanumericCodePoint(cp) {
    return (cp >= 0x1D400 && cp <= 0x1D7FF) || LETTERLIKE_MATH_VAR_SET.has(cp);
  }

  /**
   * 判断字符串是否包含数学斜体/粗体/花体 Unicode 字符
   */
  function hasMathAlphanumeric(str) {
    for (const ch of str) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x1D400 && cp <= 0x1D7FF && !BLACKBOARD_KEEP_MAP[cp]) return true;
      if (cp === 0x210E) return true;
    }
    return false;
  }

  /**
   * 将字符串中的数学斜体/变体符号还原为标准可读 Unicode 字符
   */
  function normalizeMathChars(str) {
    let out = '';
    for (const ch of str) {
      const cp = ch.codePointAt(0);
      if (BLACKBOARD_KEEP_MAP[cp]) {
        out += BLACKBOARD_KEEP_MAP[cp];
      } else if ((cp >= 0x1D400 && cp <= 0x1D7FF) || LETTERLIKE_MATH_VAR_SET.has(cp)) {
        const norm = ch.normalize('NFKD');
        out += GREEK_VARIANT_MAP[norm] || norm;
      } else if (EXTENSIBLE_BRACKET_MAP[ch] !== undefined) {
        out += EXTENSIBLE_BRACKET_MAP[ch];
      } else if (GREEK_VARIANT_MAP[ch]) {
        out += GREEK_VARIANT_MAP[ch];
      } else {
        out += ch;
      }
    }
    return out;
  }

  /**
   * 用于 MathML 层与 HTML 视觉层配对校验的字符级规范化
   */
  function canonicalizeCharForMatch(ch) {
    const cp = ch.codePointAt(0);
    if ((cp >= 0x1D400 && cp <= 0x1D7FF) || LETTERLIKE_MATH_VAR_SET.has(cp) || BLACKBOARD_KEEP_MAP[cp]) {
      ch = ch.normalize('NFKD');
    }
    if (EXTENSIBLE_BRACKET_MAP[ch] !== undefined) {
      ch = EXTENSIBLE_BRACKET_MAP[ch];
      if (!ch) return '';
    }
    if (GREEK_VARIANT_MAP[ch]) ch = GREEK_VARIANT_MAP[ch];
    if (ch === '-' || ch === '−' || ch === '–') return '-';
    if (ch === 'ˆ' || ch === '\u0302') return '^';
    if (ch === '¯' || ch === 'ˉ' || ch === '‾' || ch === '\u0304' || ch === '\u0305') return '¯';
    if (ch === '~' || ch === '∼' || ch === '˜' || ch === '\u0303') return '~';
    if (ch === '\'' || ch === '′' || ch === '’') return '\'';
    if (ch === '∗') return '*';
    if (ch === '∣') return '|';
    return ch;
  }

  function extractCanonicalChars(str) {
    const arr = [];
    for (const ch of str) {
      if (/\s/.test(ch)) continue;
      const c = canonicalizeCharForMatch(ch);
      if (c) {
        for (const sub of c) {
          if (!/\s/.test(sub)) arr.push(sub);
        }
      }
    }
    return arr;
  }

  /**
   * 为基础文本添加顶部组合变音符号（如 z + ^ -> ẑ）
   */
  function applyAccent(baseStr, accentSym) {
    const comb = ACCENT_COMBINING_MAP[accentSym];
    if (!comb) return baseStr + accentSym;
    const trimmed = baseStr.trim();
    if (!trimmed) return accentSym;
    // 统计可见基字符个数（允许原字符本身已带其它组合符）
    const chars = [...trimmed];
    const baseCount = chars.filter(c => {
      const code = c.codePointAt(0);
      return !(code >= 0x0300 && code <= 0x036F) && !(code >= 0x20D0 && code <= 0x20FF);
    }).length;
    if (baseCount === 1) {
      return trimmed + comb;
    }
    // 多字符被整体加帽（如 \widehat{xy}）
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      return trimmed + comb;
    }
    return `(${trimmed})${comb}`;
  }

  // ============================================================================
  // 3. 结构化公式 AST 渲染器（统一服务于双层重影还原、LaTeX 与 HTML MathML）
  // ============================================================================

  /**
   * AST 节点类型：
   * - { type: 'tok', val: string }               普通符号/标识符/数字/运算符
   * - { type: 'accent', base: Node, acc: string } 顶部修饰
   * - { type: 'supsub', base: Node, sub: Node[]|null, sup: Node[]|null } 上下标
   * - { type: 'frac', num: Node[], den: Node[] } 分式
   * - { type: 'sqrt', deg: Node[]|null, body: Node[] } 根式
   * - { type: 'group', open: string, close: string, body: Node[] } 显式括号组
   */

  function isSimpleIdentifierOrNum(str) {
    return /^[A-Za-z0-9α-ωΑ-Ωℝℤℕℚℂ𝔼ℙℓℏ]+[\u0300-\u036F\u20D0-\u20FF]*$/.test(str);
  }

  function needsParensForScript(str) {
    if (!str) return false;
    if (isSimpleIdentifierOrNum(str)) return false;
    if (str.startsWith('(') && str.endsWith(')')) return false;
    return str.length > 1;
  }

  function isSimpleSingleAtom(str) {
    const chars = [...str].filter(c => {
      const code = c.codePointAt(0);
      return !(code >= 0x0300 && code <= 0x036F) && !(code >= 0x20D0 && code <= 0x20FF);
    });
    return chars.length === 1 && /^[A-Za-z0-9α-ωΑ-Ωℝℤℕℚℂ𝔼ℙℓℏ∞]$/.test(chars[0]);
  }

  function hasTopLevelBinaryOp(str) {
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);
      else if (depth === 0 && (ch === '+' || ch === '−' || ch === '-' || ch === '±' || ch === '∓' || ch === '=' || ch === ',' || ch === ' ')) {
        // 忽略开头的单目负号
        if (i === 0 && (ch === '−' || ch === '-')) continue;
        return true;
      }
    }
    return false;
  }

  function needsParensForFracNumerator(nodes, rendered) {
    const t = rendered.trim();
    if (!t) return false;
    if (isBalancedOuterParens(t)) return false;
    if (nodes.length === 1 && (nodes[0].type === 'supsub' || nodes[0].type === 'accent' || nodes[0].type === 'sqrt')) {
      return false;
    }
    return hasTopLevelBinaryOp(t);
  }

  function needsParensForFracDenominator(nodes, rendered) {
    const t = rendered.trim();
    if (!t) return false;
    if (isBalancedOuterParens(t)) return false;
    if (nodes.length >= 2) return true;
    return hasTopLevelBinaryOp(t);
  }

  function isBalancedOuterParens(str) {
    if (!str.startsWith('(') || !str.endsWith(')')) return false;
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') {
        depth--;
        if (depth === 0 && i < str.length - 1) return false;
      }
    }
    return depth === 0;
  }

  /**
   * 检测整棵 AST 中是否存在需要 `_` 表达的下标（用于智能防割裂模式）
   */
  function astHasUnderscoreSubscript(nodes) {
    for (const n of nodes) {
      if (!n) continue;
      if (n.type === 'supsub') {
        if (n.sub && n.sub.length > 0) {
          const subRaw = renderAstTokensRaw(n.sub);
          if (!/^[0-9]$/.test(subRaw)) return true;
        }
        if (n.base && astHasUnderscoreSubscript([n.base])) return true;
        if (n.sub && astHasUnderscoreSubscript(n.sub)) return true;
        if (n.sup && astHasUnderscoreSubscript(n.sup)) return true;
      } else if (n.type === 'accent') {
        if (astHasUnderscoreSubscript([n.base])) return true;
      } else if (n.type === 'frac') {
        if (astHasUnderscoreSubscript(n.num) || astHasUnderscoreSubscript(n.den)) return true;
      } else if (n.type === 'sqrt' || n.type === 'group') {
        if (n.deg && astHasUnderscoreSubscript(n.deg)) return true;
        if (astHasUnderscoreSubscript(n.body)) return true;
      }
    }
    return false;
  }

  function renderAstTokensRaw(nodes) {
    return nodes.map(n => {
      if (n.type === 'tok') return n.val;
      return renderAst( [n], { subscriptMode: 'underscore', compactOperators: true, _forceNoSpace: true });
    }).join('');
  }

  function formatSuperscript(supStr) {
    const s = supStr.trim();
    if (!s) return '';
    if (s === '⊤' || s === '⊥' || s === '′' || s === '′′' || s === '*' || s === '∗') {
      return s === '∗' ? '*' : s;
    }
    if (/^\'+$/.test(s)) {
      return '′'.repeat(s.length);
    }
    // 纯数字、简单正负号数字（如 2, -1, −1, +2）或单个 n / i（仅当单字符）
    if (/^[0-9+\-−]+$/.test(s) || s === 'n') {
      let mapped = '';
      let ok = true;
      for (const ch of s) {
        if (SUPERSCRIPT_CHAR_MAP[ch]) mapped += SUPERSCRIPT_CHAR_MAP[ch];
        else { ok = false; break; }
      }
      if (ok) return mapped;
    }
    if (needsParensForScript(s)) return `^(${s})`;
    return `^${s}`;
  }

  function formatSubscript(subStr, forceUnderscore) {
    const s = subStr.trim();
    if (!s) return '';
    if (!forceUnderscore && /^[0-9]$/.test(s)) {
      return SUBSCRIPT_DIGIT_MAP[s];
    }
    if (needsParensForScript(s)) return `_(${s})`;
    return `_${s}`;
  }

  /**
   * 将公式 AST 节点数组渲染为干净的纯文本 Unicode 字符串
   */
  function renderAst(nodes, options = {}) {
    const subscriptMode = options.subscriptMode || 'smart'; // 'smart' | 'underscore'
    const compactOps = !!options.compactOperators;
    const forceUnderscore = subscriptMode === 'underscore' || astHasUnderscoreSubscript(nodes);

    function renderNode(node) {
      if (!node) return '';
      switch (node.type) {
        case 'tok':
          return node.val;
        case 'accent': {
          const b = renderNode(node.base);
          return applyAccent(b, node.acc);
        }
        case 'supsub': {
          const b = renderNode(node.base);
          const subPart = (node.sub && node.sub.length)
            ? formatSubscript(renderNodeList(node.sub, true), forceUnderscore)
            : '';
          const supPart = (node.sup && node.sup.length)
            ? formatSuperscript(renderNodeList(node.sup, true))
            : '';
          return `${b}${subPart}${supPart}`;
        }
        case 'frac': {
          const numStr = renderNodeList(node.num, false);
          const denStr = renderNodeList(node.den, false);
          const left = needsParensForFracNumerator(node.num, numStr) ? `(${numStr})` : numStr;
          const right = needsParensForFracDenominator(node.den, denStr) ? `(${denStr})` : denStr;
          return `${left}/${right}`;
        }
        case 'sqrt': {
          const bodyStr = renderNodeList(node.body, false);
          const degStr = node.deg && node.deg.length ? renderNodeList(node.deg, true).trim() : '';
          let rad = '√';
          if (degStr === '3') rad = '∛';
          else if (degStr === '4') rad = '∜';
          else if (degStr) rad = `${formatSuperscript(degStr)}√`;
          const wrapped = isSimpleSingleAtom(bodyStr) ? bodyStr : (isBalancedOuterParens(bodyStr) ? bodyStr : `(${bodyStr})`);
          return `${rad}${wrapped}`;
        }
        case 'group': {
          const inner = renderNodeList(node.body, false);
          return `${node.open}${inner}${node.close}`;
        }
        default:
          return '';
      }
    }

    function renderNodeList(list, tight) {
      const parts = [];
      let prevRenderedNode = null;
      let prevIndexInEffective = -1;
      const effectiveList = [];
      let pendingExplicitSpace = false;

      for (let rawIdx = 0; rawIdx < list.length; rawIdx++) {
        const item = list[rawIdx];
        if (!item) continue;
        if (item.type === 'space') {
          pendingExplicitSpace = true;
          continue;
        }
        effectiveList.push({ node: item, explicitSpaceBefore: pendingExplicitSpace });
        pendingExplicitSpace = false;
      }

      for (let i = 0; i < effectiveList.length; i++) {
        const cur = effectiveList[i].node;
        const explicitSpaceBefore = effectiveList[i].explicitSpaceBefore;
        const prev = i > 0 ? effectiveList[i - 1].node : null;
        const text = renderNode(cur);
        if (!text) continue;

        const curIsTok = cur.type === 'tok';
        const prevIsTok = prev && prev.type === 'tok';
        const curVal = curIsTok ? cur.val : text;
        const prevVal = prev ? (prevIsTok ? prev.val : parts[parts.length - 1] || '') : '';

        // 决定 prev 与 cur 之间是否插入空格
        let needSpace = false;

        if (!tight && !compactOps && parts.length > 0) {
          const isUnarySignContext = !prev || (
            prevIsTok && (
              BINARY_REL_OPS.has(prevVal) ||
              BINARY_ARITH_OPS.has(prevVal) ||
              prevVal === '(' || prevVal === '[' || prevVal === '{' || prevVal === '⟨' ||
              prevVal === ',' || prevVal === ';' || prevVal === ':'
            )
          );

          if (curIsTok && BINARY_REL_OPS.has(curVal)) {
            needSpace = true;
          } else if (prevIsTok && BINARY_REL_OPS.has(prevVal)) {
            needSpace = true;
          } else if (curIsTok && BINARY_ARITH_OPS.has(curVal)) {
            if ((curVal === '−' || curVal === '+' || curVal === '±' || curVal === '∓') && isUnarySignContext) {
              needSpace = false;
            } else {
              needSpace = true;
            }
          } else if (prevIsTok && BINARY_ARITH_OPS.has(prevVal)) {
            const prevPrev = i >= 2 ? effectiveList[i - 2].node : null;
            const prevWasUnary = (prevVal === '−' || prevVal === '+' || prevVal === '±' || prevVal === '∓') && (
              !prevPrev || (
                prevPrev.type === 'tok' && (
                  BINARY_REL_OPS.has(prevPrev.val) ||
                  BINARY_ARITH_OPS.has(prevPrev.val) ||
                  prevPrev.val === '(' || prevPrev.val === '[' || prevPrev.val === '{' || prevPrev.val === '⟨' ||
                  prevPrev.val === ',' || prevPrev.val === ';' || prevPrev.val === ':'
                )
              )
            );
            needSpace = !prevWasUnary;
          } else if (prevIsTok && (prevVal === ',' || prevVal === ';')) {
            needSpace = true;
          } else if (prevIsTok && (prevVal === '∀' || prevVal === '∃' || prevVal === '∄') && !isPunctuationClose(curVal)) {
            needSpace = true;
          } else if (prev && BIG_OPERATORS.has(getBaseOpName(prev)) && !isPunctuationClose(curVal)) {
            if (!curVal.startsWith('(') && !curVal.startsWith('[')) {
              needSpace = true;
            }
          } else if (prevIsTok && KNOWN_FUNC_NAMES.has(prevVal) && !curVal.startsWith('(') && !curVal.startsWith('[') && !isPunctuationClose(curVal)) {
            needSpace = true;
          } else if (curIsTok && KNOWN_FUNC_NAMES.has(curVal) && prev && !isOpenBracket(prevVal)) {
            needSpace = true;
          } else if (isMultiLetterWord(prevVal) && isAlphaNumStart(curVal)) {
            needSpace = true;
          } else if (explicitSpaceBefore && !isPunctuationClose(curVal) && !isOpenBracket(prevVal)) {
            needSpace = true;
          }
        } else if (tight && !compactOps && parts.length > 0) {
          if ((curIsTok && ARROW_OPS.has(curVal)) || (prevIsTok && ARROW_OPS.has(prevVal))) {
            needSpace = true;
          }
        } else if (!tight && compactOps && parts.length > 0) {
          if (prevIsTok && (prevVal === ',' || prevVal === ';')) {
            needSpace = true;
          } else if (prevIsTok && KNOWN_FUNC_NAMES.has(prevVal) && isAlphaNumStart(curVal)) {
            needSpace = true;
          }
        }

        if (needSpace) parts.push(' ');
        parts.push(text);
      }
      return parts.join('');
    }

    return renderNodeList(nodes, !!options._forceNoSpace);
  }

  const ARROW_OPS = new Set(['→', '←', '↔', '⇒', '⇐', '⇔', '↦', '⟶', '⟹', '⟺']);

  const KNOWN_FUNC_NAMES = new Set([
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan',
    'sinh', 'cosh', 'tanh', 'exp', 'log', 'ln', 'lg',
    'lim', 'sup', 'inf', 'max', 'min', 'argmax', 'argmin', 'arg',
    'det', 'dim', 'ker', 'hom', 'deg', 'gcd', 'Pr', 'cov', 'Var', 'tr', 'diag', 'rank', 'softmax'
  ]);

  function getBaseOpName(node) {
    if (node.type === 'tok') return node.val;
    if (node.type === 'supsub' && node.base && node.base.type === 'tok') return node.base.val;
    return '';
  }

  function isPunctuationClose(s) {
    return s === ')' || s === ']' || s === '}' || s === '⟩' || s === ',' || s === ';' || s === '.';
  }

  function isOpenBracket(s) {
    return s === '(' || s === '[' || s === '{' || s === '⟨';
  }

  function isMultiLetterWord(s) {
    return /^[A-Za-z]{2,}$/.test(s);
  }

  function isAlphaNumStart(s) {
    return /^[A-Za-z0-9α-ωΑ-Ω]/.test(s);
  }

  // ============================================================================
  // 4. 纯文本双层重影识别与结构重建引擎（Core Plain-Text Ghosting Resolver）
  // ============================================================================

  /**
   * 判断某一行是否可作为 MathML 无障碍层的单行碎片节点
   */
  function isPlausibleMathMLLine(line) {
    const trimmed = line.trim();
    // MathML 中的 <mspace> 会产生仅含空格的非空行（如 ' '）
    if (trimmed === '') {
      return line.length > 0; // 纯空格行可作为 MathML 内部间隔，但不能作为起点或终点
    }
    // 含中文句读或汉字通常不是 MathML 碎片（除非极罕见 \text{中文}，此处保持保守避免吞掉正文）
    if (/[\u4E00-\u9FFF\u3001\u3002\uFF01-\uFF5E]/.test(trimmed)) {
      return false;
    }
    // 若包含数学斜体 Unicode 字符，且整行较短（MathML 单 token 或短 mtext）
    if (hasMathAlphanumeric(trimmed) && [...trimmed].length <= 16) {
      return true;
    }
    // 单字符数学符号、字母、数字、运算符、括号、顶标符
    if ([...trimmed].length === 1) {
      return /[A-Za-z0-9α-ωΑ-Ω+\-−±∓×÷·=≠≈≃≅≡∼∝<>≤≥≪≫∈∉⊂⊃⊆⊇∪∩∀∃¬∧∨→←↔⇒⇐⇔↦∑∏∫∬∭∮∂∇∞√⊤⊥∥|‖()\[\]{}⟨⟩⌈⌉⌊⌋,.:;!\'^ˆ¯ˉ‾~˜˙¨ˇ˘ℓℏℝℤℕℚℂ𝔼ℙ]/.test(trimmed);
    }
    // 短纯英文/数字标识符（如 ctx, base, sin, cos, max, 100, i=1 等）
    if (/^[A-Za-z0-9.+\-−=()′,]+$/.test(trimmed) && trimmed.length <= 16) {
      return true;
    }
    return false;
  }

  /**
   * 检查候选 MathML 行切片是否具有足够的“数学特征锚点”，避免把普通两行英文单词误判为重影
   */
  function hasStrongMathAnchor(mathLines) {
    for (const l of mathLines) {
      if (hasMathAlphanumeric(l)) return true;
      const t = l.trim();
      if (/[−±∓×÷≠≈≃≅≡∝≤≥≪≫∈∉⊂⊃⊆⊇∀∃⇒⇔↦∑∏∫∂∇∞√⊤⊥α-ωΑ-Ωℝℤℕℚℂ]/.test(t)) {
        return true;
      }
      if (t === '^' || t === 'ˆ' || t === '¯') return true;
    }
    // 若全为普通字符（如分式 1 \n 2），至少需要 2 行单 token
    return mathLines.length >= 2 && mathLines.every(l => l.trim().length > 0 && l.trim().length <= 6);
  }

  /**
   * 尝试从 lines[startIdx] 开始匹配一个完整的“MathML 层 + HTML 视觉层”重影块
   * 成功则返回：{ nextLineIdx, mathLines, htmlLines, trailingInlineText, endedInVlist }
   */
  function tryMatchDualLayerBlock(lines, lineMeta, startIdx) {
    const firstTrim = lines[startIdx].trim();
    if (!firstTrim || !isPlausibleMathMLLine(lines[startIdx])) return null;

    // 收集从 startIdx 开始的最大可能 MathML 候选窗口
    let maxMEnd = startIdx;
    const maxScan = Math.min(lines.length - 2, startIdx + 80);
    for (let k = startIdx + 1; k <= maxScan; k++) {
      if (isPlausibleMathMLLine(lines[k])) {
        maxMEnd = k;
      } else {
        break;
      }
    }

    // 从最长候选窗口向短回退，优先寻找最长有效双层配对
    for (let mEnd = maxMEnd; mEnd >= startIdx; mEnd--) {
      // MathML 窗口首尾不能是纯空格行
      if (lines[mEnd].trim() === '') continue;
      const mathSlice = lines.slice(startIdx, mEnd + 1);
      if (!hasStrongMathAnchor(mathSlice)) continue;

      const matchResult = matchHtmlLayerAgainstMath(lines, lineMeta, mEnd + 1, mathSlice);
      if (matchResult) {
        return {
          mathStart: startIdx,
          mathEnd: mEnd,
          mathLines: mathSlice,
          ...matchResult
        };
      }
    }
    return null;
  }

  /**
   * 给定 MathML 行数组 mathSlice，从 htmlStart 行开始验证并切分紧随其后的 HTML 视觉层
   */
  function matchHtmlLayerAgainstMath(lines, lineMeta, htmlStart, mathSlice) {
    if (htmlStart >= lines.length) return null;

    // 统计 MathML 层归一化可见字符多重集
    const mathCounts = new Map();
    const droppableCounts = new Map();
    let totalMathChars = 0;

    for (const ml of mathSlice) {
      const cChars = extractCanonicalChars(ml);
      // 若整行是单独的可被 SVG 省略的顶标符，记录其可省略配额
      const rawTrim = ml.trim();
      const isSingleDroppable = cChars.length === 1 && SVG_DROPPABLE_ACCENTS.has(rawTrim);
      for (const c of cChars) {
        mathCounts.set(c, (mathCounts.get(c) || 0) + 1);
        totalMathChars++;
        if (isSingleDroppable) {
          droppableCounts.set(c, (droppableCounts.get(c) || 0) + 1);
        }
      }
    }
    if (totalMathChars === 0) return null;

    const htmlCounts = new Map();
    let matchedChars = 0;
    let extraSqrtCount = 0;
    const htmlSegments = []; // { rawLine, usedSlice, isEmpty, hadZwsp }

    const maxHScan = Math.min(lines.length - 1, htmlStart + mathSlice.length * 3 + 6);

    // 紧接 MathML 后的第一行不能是纯空行（KaTeX 的 katex-html 紧挨着 katex-mathml，除非第一个元素是特殊 vlist 产生前导空格行）
    if (lines[htmlStart].trim() === '' && !lineMeta[htmlStart].hadZwsp) {
      // 允许至多跳过 0 行纯空行（若第一行就是真段落空行则拒绝）
      return null;
    }

    for (let hIdx = htmlStart; hIdx <= maxHScan; hIdx++) {
      const rawLine = lines[hIdx];

      // 定律：HTML 视觉层绝不包含 U+1D400..U+1D7FF 数学斜体字符！若遇到说明仍在 MathML 层
      if (hasMathAlphanumeric(rawLine)) {
        return null;
      }

      if (rawLine.trim() === '') {
        htmlSegments.push({
          lineIdx: hIdx,
          rawLine,
          usedSlice: rawLine,
          isEmpty: true,
          hadZwsp: lineMeta[hIdx].hadZwsp
        });
        continue;
      }

      // 逐字符消费当前行
      let pos = 0;
      const chars = [...rawLine];
      while (pos < chars.length) {
        const ch = chars[pos];
        if (/\s/.test(ch)) {
          // 如果已经凑齐（或仅差可省略 SVG 顶标），不要吞掉同一行后面的空白+正文，留给结束判定检查
          if (isMultisetSatisfied(mathCounts, htmlCounts, droppableCounts, totalMathChars, matchedChars)) {
            break;
          }
          pos++;
          continue;
        }

        const cStr = canonicalizeCharForMatch(ch);
        if (!cStr) {
          pos++;
          continue;
        }

        const cArr = [...cStr].filter(x => !/\s/.test(x));
        // 特判：HTML 视觉层中的根号 '√' 在 MathML <msqrt> 中无对应文本节点
        if (cArr.length === 1 && cArr[0] === '√' && (htmlCounts.get('√') || 0) >= (mathCounts.get('√') || 0)) {
          extraSqrtCount++;
          pos++;
          continue;
        }

        // 检查加入 cArr 是否会超出 mathCounts
        let wouldOverflow = false;
        const tempAdd = new Map();
        for (const c of cArr) {
          const nextCnt = (htmlCounts.get(c) || 0) + (tempAdd.get(c) || 0) + 1;
          if (nextCnt > (mathCounts.get(c) || 0)) {
            wouldOverflow = true;
            break;
          }
          tempAdd.set(c, (tempAdd.get(c) || 0) + 1);
        }

        if (wouldOverflow) {
          // 一旦即将溢出，检查当前是否恰好满足多重集守恒！
          if (isMultisetSatisfied(mathCounts, htmlCounts, droppableCounts, totalMathChars, matchedChars)) {
            const usedSlice = chars.slice(0, pos).join('');
            const restSlice = chars.slice(pos).join('');
            if (usedSlice.trim().length > 0) {
              htmlSegments.push({
                lineIdx: hIdx,
                rawLine,
                usedSlice,
                isEmpty: false,
                hadZwsp: lineMeta[hIdx].hadZwsp
              });
            }
            return finalizeHtmlMatch(lines, lineMeta, hIdx, restSlice, htmlSegments, extraSqrtCount);
          }
          return null;
        }

        for (const [c, cnt] of tempAdd.entries()) {
          htmlCounts.set(c, (htmlCounts.get(c) || 0) + cnt);
          matchedChars += cnt;
        }
        pos++;
      }

      const usedSlice = chars.slice(0, pos).join('');
      const restSlice = chars.slice(pos).join('');
      htmlSegments.push({
        lineIdx: hIdx,
        rawLine,
        usedSlice,
        isEmpty: usedSlice.trim() === '',
        hadZwsp: lineMeta[hIdx].hadZwsp
      });

      // 行尾或提前退出循环时检查是否已满足多重集守恒
      if (isMultisetSatisfied(mathCounts, htmlCounts, droppableCounts, totalMathChars, matchedChars)) {
        // 特判：如果 mathCounts 里还有尚未匹配的 droppable 字符（如 '^'），但下一行正好就是 '^'，继续读下一行把它消费掉！
        if (matchedChars < totalMathChars && hIdx + 1 <= maxHScan) {
          const nextTrim = lines[hIdx + 1].trim();
          const nextCanon = extractCanonicalChars(nextTrim);
          if (nextCanon.length === 1 && (htmlCounts.get(nextCanon[0]) || 0) < (mathCounts.get(nextCanon[0]) || 0)) {
            continue;
          }
        }
        return finalizeHtmlMatch(lines, lineMeta, hIdx, restSlice, htmlSegments, extraSqrtCount);
      }
    }

    return null;
  }

  function isMultisetSatisfied(mathCounts, htmlCounts, droppableCounts, totalMathChars, matchedChars) {
    if (matchedChars <= 0) return false;
    if (matchedChars === totalMathChars) return true;
    if (matchedChars > totalMathChars) return false;
    for (const [ch, reqCnt] of mathCounts.entries()) {
      const gotCnt = htmlCounts.get(ch) || 0;
      if (gotCnt > reqCnt) return false;
      if (gotCnt < reqCnt) {
        const diff = reqCnt - gotCnt;
        if ((droppableCounts.get(ch) || 0) < diff) return false;
      }
    }
    return true;
  }

  /**
   * 处理 HTML 视觉层结束位置：吸收可能紧跟的 .vlist-s 尾随空行，并判断是否在 vlist 断行中结束
   */
  function finalizeHtmlMatch(lines, lineMeta, endLineIdx, restInSameLine, htmlSegments, extraSqrtCount) {
    let nextIdx = endLineIdx + 1;
    let endedInVlist = false;
    let trailingEmptyAfterLast = false;

    if (restInSameLine.trim() === '') {
      // 当前行已被公式完全消费完：检查下一行是否为 .vlist-s 空行（空串或原含 \u200b）
      if (nextIdx < lines.length && lines[nextIdx].trim() === '') {
        trailingEmptyAfterLast = true;
        endedInVlist = true;
        htmlSegments.push({
          lineIdx: nextIdx,
          rawLine: lines[nextIdx],
          usedSlice: lines[nextIdx],
          isEmpty: true,
          hadZwsp: lineMeta[nextIdx].hadZwsp
        });
        nextIdx++;
      } else if (htmlSegments.length > 1) {
        // 多行 HTML 块（如 z \n ^），最后一个元素在独立 vlist 行结束
        endedInVlist = true;
      }
    }

    return {
      htmlEndLineIdx: nextIdx - 1,
      nextLineIdx: nextIdx,
      trailingInlineText: restInSameLine,
      endedInVlist,
      trailingEmptyAfterLast,
      htmlSegments,
      extraSqrtCount
    };
  }

  /**
   * 将单个字符串片段切分为细粒度数学原子（例如 "Δz=z" -> ["Δ", "z", "=", "z"]，"ctx" -> ["ctx"]）
   */
  function tokenizeMathFragment(rawStr) {
    const str = normalizeMathChars(rawStr).trim();
    if (!str) return [];
    // 若整串是一个纯英文字母序列且长度 >= 2（如 ctx, base, sin, lim, max）：
    // 在 MathML 层，<mtext>ctx</mtext> 或 <mi>sin</mi> 作为单个节点存在！
    if (/^[A-Za-z]{2,}$/.test(str)) {
      return [str];
    }
    // 纯数字（含小数点）
    if (/^[0-9]+(\.[0-9]+)?$/.test(str)) {
      return [str];
    }

    const tokens = [];
    const chars = [...str];
    let i = 0;
    while (i < chars.length) {
      const ch = chars[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (/[0-9]/.test(ch)) {
        let num = ch;
        while (i + 1 < chars.length && /[0-9.]/.test(chars[i + 1])) {
          num += chars[++i];
        }
        tokens.push(num);
        i++;
        continue;
      }
      // 在 HTML 混合行中（如 "Δz=z" 或 "u, u∝μ" 或 "sin x"），谨慎切分单字母变量与知名函数名
      if (/[A-Za-z]/.test(ch)) {
        let word = ch;
        let j = i + 1;
        while (j < chars.length && /[A-Za-z]/.test(chars[j])) {
          word += chars[j++];
        }
        if (KNOWN_FUNC_NAMES.has(word)) {
          tokens.push(word);
          i = j;
          continue;
        }
        // 单字母数学变量拆开（使 "uv" 在数学基线中成为 ["u", "v"]，而多字母下标已在入口整串返回）
        tokens.push(ch);
        i++;
        continue;
      }
      // 数学模式中普通连字符 '-' 统一为标准数学减号 '−'
      if (ch === '-') {
        tokens.push('−');
      } else {
        tokens.push(ch);
      }
      i++;
    }
    return tokens;
  }

  /**
   * 核心结构重建器：结合 MathML 语义层顺序与 HTML 视觉层垂直换行/空行签名，重建公式 AST
   */
  function reconstructFormulaAst(mathLines, htmlSegments, extraSqrtCount) {
    // 1. 解析 MathML 节点流（过滤掉纯空格 mspace 行，保留真实语义 token）
    const mTokens = [];
    for (const ml of mathLines) {
      const norm = normalizeMathChars(ml).trim();
      if (!norm) continue;
      // MathML 每行就是一个语义叶子节点（<mi>, <mo>, <mn>, <mtext>）
      if (/^[A-Za-z]{2,}$/.test(norm) || /^[0-9]+(\.[0-9]+)?$/.test(norm) || [...norm].length === 1) {
        mTokens.push(norm === '-' ? '−' : norm);
      } else {
        mTokens.push(...tokenizeMathFragment(norm));
      }
    }

    if (mTokens.length === 0) return [];

    // 2. 将 HTML 视觉层整理为非空视觉行列表，并记录每行前后的空行（.vlist-s / .frac-line）与前导空格特征
    const vRows = [];
    for (let i = 0; i < htmlSegments.length; i++) {
      const seg = htmlSegments[i];
      if (seg.isEmpty) continue;
      const prevEmpty = i > 0 && htmlSegments[i - 1].isEmpty;
      let emptyCountAfter = 0;
      let k = i + 1;
      while (k < htmlSegments.length && htmlSegments[k].isEmpty) {
        emptyCountAfter++;
        k++;
      }
      const hadPureSpacesBefore = i > 0 && htmlSegments[i - 1].isEmpty && htmlSegments[i - 1].usedSlice.length > 0 && !htmlSegments[i - 1].hadZwsp;
      const hasLeadingSpace = /^\s/.test(seg.usedSlice);
      const hasTrailingSpace = /\s$/.test(seg.usedSlice);
      vRows.push({
        raw: seg.usedSlice,
        trimmed: normalizeMathChars(seg.usedSlice).trim(),
        canonChars: extractCanonicalChars(seg.usedSlice),
        prevEmpty,
        emptyAfter: emptyCountAfter > 0,
        hadPureSpacesBefore,
        hasLeadingSpace,
        hasTrailingSpace
      });
    }

    // 若只有单行视觉层（无任何上下标/顶标/分式垂直堆叠），直接线性构建（处理可能由 SVG 省略的顶标及根号）
    if (vRows.length <= 1) {
      return buildLinearAstWithAccentsAndSqrt(mTokens, vRows[0] ? vRows[0].raw : '');
    }

    // 3. 将 mTokens 映射到各个视觉行 vRows（支持局部顺序反转检测：如分式 [num, den] vs [den, num] 或巨型算符 [op, sub, sup] vs [sub, op, sup]）
    const alignedGroups = alignMathTokensToVisualRows(mTokens, vRows);

    // 4. 根据视觉行关系组装层次化 AST
    return assembleAstFromAlignedGroups(alignedGroups);
  }

  /**
   * 处理单行 HTML 下的线性序列（兼容 SVG 省略顶标如 \vec{v}, \overline{x} 及根号 √）
   */
  function buildLinearAstWithAccentsAndSqrt(mTokens, rawHtmlLine) {
    const hasSqrt = rawHtmlLine.includes('√') && !mTokens.includes('√');
    const nodes = [];
    for (let i = 0; i < mTokens.length; i++) {
      const t = mTokens[i];
      if (ACCENT_COMBINING_MAP[t] && nodes.length > 0 && canTakeAccent(nodes[nodes.length - 1])) {
        const base = nodes.pop();
        nodes.push({ type: 'accent', base, acc: t });
      } else {
        nodes.push({ type: 'tok', val: t });
      }
    }
    if (hasSqrt && nodes.length > 0) {
      return [{ type: 'sqrt', deg: null, body: nodes }];
    }
    return nodes;
  }

  function canTakeAccent(node) {
    if (!node) return false;
    if (node.type === 'accent') return true;
    if (node.type === 'tok') {
      return /^[A-Za-zα-ωΑ-Ωℓℏ]$/.test(node.val);
    }
    return false;
  }

  function canTakeSubSup(node) {
    if (!node) return false;
    if (node.type === 'accent' || node.type === 'supsub' || node.type === 'group') return true;
    if (node.type === 'tok') {
      const v = node.val;
      if (BIG_OPERATORS.has(v)) return true;
      if (v === ')' || v === ']' || v === '}' || v === '⟩' || v === '|') return true;
      if (BINARY_REL_OPS.has(v) || BINARY_ARITH_OPS.has(v)) return false;
      if (v === '(' || v === '[' || v === '{' || v === '⟨' || v === ',' || v === ';' || v === ':') return false;
      return true;
    }
    return false;
  }

  /**
   * 将 mTokens 精确切分并对齐到每个视觉行 vRows
   * 返回数组项：
   * - { kind: 'row', tokens: string[], vRow }
   * - { kind: 'frac_pair', numTokens: string[], denTokens: string[] }
   * - { kind: 'bigop_limits', opToken: string, subTokens: string[], supTokens: string[] }
   */
  function alignMathTokensToVisualRows(mTokens, vRows) {
    const result = [];
    let mIdx = 0;
    let rIdx = 0;

    while (rIdx < vRows.length && mIdx < mTokens.length) {
      // 检测块级巨型算符上下限反转：MathML 为 [OP, sub..., sup...]，HTML 为 [subRow, opRow, supRow]
      if (
        BIG_OPERATORS.has(mTokens[mIdx]) &&
        rIdx + 2 < vRows.length &&
        vRows[rIdx + 1].trimmed === mTokens[mIdx]
      ) {
        const opTok = mTokens[mIdx];
        const subMatch = consumeTokensMatchingRow(mTokens, mIdx + 1, vRows[rIdx]);
        if (subMatch) {
          const supMatch = consumeTokensMatchingRow(mTokens, subMatch.nextMIdx, vRows[rIdx + 2]);
          if (supMatch) {
            result.push({
              kind: 'bigop_limits',
              opToken: opTok,
              subTokens: subMatch.tokens,
              supTokens: supMatch.tokens
            });
            mIdx = supMatch.nextMIdx;
            rIdx += 3;
            continue;
          }
        }
      }

      // 常规顺序对齐当前视觉行 vRows[rIdx]
      const directMatch = consumeTokensMatchingRow(mTokens, mIdx, vRows[rIdx]);
      if (directMatch) {
        result.push({
          kind: 'row',
          tokens: directMatch.tokens,
          vRow: vRows[rIdx],
          hasInlineSqrt: false
        });
        mIdx = directMatch.nextMIdx;
        rIdx++;
        continue;
      }

      // 检测分式分子分母反转：MathML 为 [num..., den...]，HTML 为 [denRow, numRow]
      if (rIdx + 1 < vRows.length) {
        const swappedMatch = tryMatchSwappedTwoRows(mTokens, mIdx, vRows[rIdx], vRows[rIdx + 1]);
        if (swappedMatch) {
          result.push({
            kind: 'frac_pair',
            numTokens: swappedMatch.firstMathTokens,
            denTokens: swappedMatch.secondMathTokens
          });
          mIdx = swappedMatch.nextMIdx;
          rIdx += 2;
          continue;
        }
      }

      // 安全兜底：若出现特殊对齐偏差，按全部剩余 mTokens 线性返回，绝不丢字符
      const restTokens = mTokens.slice(mIdx);
      result.push({
        kind: 'row',
        tokens: restTokens,
        vRow: vRows[rIdx],
        hasInlineSqrt: false
      });
      mIdx = mTokens.length;
      break;
    }

    // 吸收尾部可能剩余的 SVG 省略顶标
    while (mIdx < mTokens.length) {
      const rem = mTokens[mIdx++];
      if (result.length > 0 && result[result.length - 1].kind === 'row') {
        result[result.length - 1].tokens.push(rem);
      } else {
        result.push({ kind: 'row', tokens: [rem], vRow: vRows[vRows.length - 1], hasInlineSqrt: false });
      }
    }

    return result;
  }

  const SQRT_SENTINEL = '\x00SQRT';

  /**
   * 从 mTokens[startMIdx] 顺序消费若干 token，使其可见字符恰好覆盖 vRow.canonChars（支持中间含 SVG 省略顶标及额外 √）
   */
  function consumeTokensMatchingRow(mTokens, startMIdx, vRow) {
    const targetChars = [...vRow.canonChars];
    const collected = [];
    let tPos = 0;
    let mPos = startMIdx;

    while (tPos < targetChars.length && mPos < mTokens.length) {
      // 记录 HTML 视觉层中额外的 '√' 起始位置
      if (targetChars[tPos] === '√' && canonicalizeCharForMatch(mTokens[mPos]) !== '√') {
        collected.push(SQRT_SENTINEL);
        tPos++;
        continue;
      }

      const tok = mTokens[mPos];
      const tokChars = extractCanonicalChars(tok);

      // 检查 tokChars 是否匹配 targetChars[tPos...]
      let matches = tokChars.length > 0 && tPos + tokChars.length <= targetChars.length;
      if (matches) {
        for (let k = 0; k < tokChars.length; k++) {
          if (targetChars[tPos + k] !== tokChars[k]) {
            matches = false;
            break;
          }
        }
      }

      if (matches) {
        collected.push(tok);
        tPos += tokChars.length;
        mPos++;
        // 若紧随其后是 HTML 中被 SVG 省略的顶标（如 \vec 的 '→'），且与下一行无关，一并吸收
        if (mPos < mTokens.length && SVG_DROPPABLE_ACCENTS.has(mTokens[mPos])) {
          const nextCanon = extractCanonicalChars(mTokens[mPos]);
          const matchesRemainingInRow = nextCanon.length === 1 && tPos < targetChars.length && targetChars[tPos] === nextCanon[0];
          if (!matchesRemainingInRow && tPos < targetChars.length) {
            collected.push(mTokens[mPos]);
            mPos++;
          }
        }
      } else if (tokChars.length === 1 && SVG_DROPPABLE_ACCENTS.has(tok) && collected.length > 0) {
        // SVG 省略顶标不消耗 targetChars
        collected.push(tok);
        mPos++;
      } else {
        return null;
      }
    }

    // 跳过行末多余的额外 √
    while (tPos < targetChars.length && targetChars[tPos] === '√') {
      tPos++;
    }

    if (tPos !== targetChars.length) return null;
    return { tokens: collected, nextMIdx: mPos };
  }

  /**
   * 尝试匹配两行反转（MathML: A, B；HTML: row1=B, row2=A）
   */
  function tryMatchSwappedTwoRows(mTokens, startMIdx, row1, row2) {
    for (let split = startMIdx + 1; split < mTokens.length; split++) {
      const sliceA = mTokens.slice(startMIdx, split);
      const m1 = consumeTokensMatchingRow(sliceA, 0, row2);
      if (m1 && m1.nextMIdx === sliceA.length) {
        const m2 = consumeTokensMatchingRow(mTokens, split, row1);
        if (m2) {
          return {
            firstMathTokens: m1.tokens,
            secondMathTokens: m2.tokens,
            nextMIdx: m2.nextMIdx
          };
        }
      }
    }
    return null;
  }

  /**
   * 判断一个视觉行是否为回归主基线的行（如 ' −z '、' u, u∝μ '、' x '、'Δz=z '）
   */
  function isMainBaselineRow(group, groupIdx, prevNode) {
    if (group.kind !== 'row') return false;
    if (groupIdx === 0 && group.tokens.length >= 1) {
      return true;
    }
    // 若前一个节点已挂满上下标（如 ∑_(i=1)ⁿ 或 x_i²），后续元素必然回归主基线
    if (prevNode && prevNode.type === 'supsub' && prevNode.sub && prevNode.sup) {
      return true;
    }
    const t = group.tokens.filter(x => x !== SQRT_SENTINEL);
    // KaTeX .vlist 内部上下标行从不带前导空格；带前导空格（如 ' x ', ' u, u∝μ ', ' −z '）必为退出 vlist 回归主基线
    if (group.vRow.hasLeadingSpace) {
      return true;
    }
    // 以二元算符/关系符/逗号开头且后接其它项（如 '−z', '= x', ', u'）必为主基线回归
    if (t.length >= 2 && (BINARY_ARITH_OPS.has(t[0]) || BINARY_REL_OPS.has(t[0]) || t[0] === ',' || t[0] === ';')) {
      return true;
    }
    if (t.some(x => x === ',' || x === ';' || x === '∝' || x === '≈' || x === '≡')) {
      return true;
    }
    return false;
  }

  function tokensToSimpleAst(tokens, wrapSqrt) {
    const nodes = [];
    for (const tok of tokens) {
      if (ACCENT_COMBINING_MAP[tok] && nodes.length > 0 && canTakeAccent(nodes[nodes.length - 1])) {
        const base = nodes.pop();
        nodes.push({ type: 'accent', base, acc: tok });
      } else {
        nodes.push({ type: 'tok', val: tok });
      }
    }
    const folded = foldSqrtSentinels(nodes);
    if (wrapSqrt && folded.length > 0) {
      return [{ type: 'sqrt', deg: null, body: folded }];
    }
    return folded;
  }

  /**
   * 将流中的 SQRT_SENTINEL 折叠为结构化 sqrt 节点
   */
  function foldSqrtSentinels(nodes) {
    if (!nodes.some(n => n.type === 'tok' && n.val === SQRT_SENTINEL)) {
      return nodes;
    }
    const out = [];
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].type === 'tok' && nodes[i].val === SQRT_SENTINEL) {
        const body = [];
        let j = i + 1;
        while (j < nodes.length) {
          const cur = nodes[j];
          if (cur.type === 'tok' && (BINARY_REL_OPS.has(cur.val) || cur.val === ',' || cur.val === ';')) {
            break;
          }
          body.push(cur);
          j++;
        }
        out.push({ type: 'sqrt', deg: null, body: foldSqrtSentinels(body) });
        i = j - 1;
      } else {
        out.push(nodes[i]);
      }
    }
    return out;
  }

  /**
   * 从对齐后的视觉行组序列组装最终公式 AST
   */
  function assembleAstFromAlignedGroups(groups) {
    const ast = [];
    let i = 0;

    while (i < groups.length) {
      const g = groups[i];

      if (g.kind === 'frac_pair') {
        ast.push({
          type: 'frac',
          num: tokensToSimpleAst(g.numTokens, false),
          den: tokensToSimpleAst(g.denTokens, false)
        });
        i++;
        continue;
      }

      if (g.kind === 'bigop_limits') {
        ast.push({
          type: 'supsub',
          base: { type: 'tok', val: g.opToken },
          sub: tokensToSimpleAst(g.subTokens, false),
          sup: tokensToSimpleAst(g.supTokens, false)
        });
        i++;
        continue;
      }

      // g.kind === 'row'
      const prevNode = ast.length > 0 ? ast[ast.length - 1] : null;
      const cleanTokens = g.tokens.filter(x => x !== SQRT_SENTINEL);

      // 情形 1：单字符顶标修饰符独立成行（如 z \n ^）
      if (
        cleanTokens.length === 1 &&
        ACCENT_COMBINING_MAP[cleanTokens[0]] &&
        prevNode &&
        canTakeAccent(prevNode) &&
        !g.vRow.prevEmpty
      ) {
        const base = ast.pop();
        ast.push({ type: 'accent', base, acc: cleanTokens[0] });
        i++;
        continue;
      }

      // 情形 2：正序分式 \frac{row1}{row2}
      // 物理充要条件：前面无可挂上下标的底元素，分子不含顶层等号关系符，分子与分母之间存在 .frac-line 空行（g.vRow.emptyAfter），且下一行非顶标
      if (
        (!prevNode || !canTakeSubSup(prevNode)) &&
        i + 1 < groups.length &&
        groups[i + 1].kind === 'row' &&
        !groups[i + 1].vRow.hasLeadingSpace &&
        !(groups[i + 1].tokens.length === 1 && ACCENT_COMBINING_MAP[groups[i + 1].tokens[0]]) &&
        cleanTokens.every(t => !BINARY_REL_OPS.has(t)) &&
        g.vRow.emptyAfter &&
        groups[i + 1].vRow.emptyAfter
      ) {
        ast.push({
          type: 'frac',
          num: tokensToSimpleAst(g.tokens, g.hasInlineSqrt),
          den: tokensToSimpleAst(groups[i + 1].tokens, groups[i + 1].hasInlineSqrt)
        });
        i += 2;
        continue;
      }

      // 情形 3：当前行有可挂载底元素 prevNode，且当前行不是回归主基线行 -> 判定为上下标垂直附属层！
      if (prevNode && canTakeSubSup(prevNode) && i > 0 && !isMainBaselineRow(g, i, prevNode)) {
        // 3a: 检查是否为同时含上下标 supsub（连续两个非主基线附属行：[subRow, supRow]）
        if (
          i + 1 < groups.length &&
          groups[i + 1].kind === 'row' &&
          !isMainBaselineRow(groups[i + 1], i + 1, null) &&
          !(groups[i + 1].tokens.length === 1 && ACCENT_COMBINING_MAP[groups[i + 1].tokens[0]]) &&
          !g.vRow.emptyAfter // supsub 中 sub 与 sup 同在一个 vlist 内，中间无 .vlist-s 空行，空行在 sup 之后
        ) {
          const base = ast.pop();
          const subAst = tokensToSimpleAst(g.tokens, g.hasInlineSqrt);
          const supAst = tokensToSimpleAst(groups[i + 1].tokens, groups[i + 1].hasInlineSqrt);
          if (base.type === 'supsub' && !base.sub && !base.sup) {
            base.sub = subAst;
            base.sup = supAst;
            ast.push(base);
          } else {
            ast.push({ type: 'supsub', base, sub: subAst, sup: supAst });
          }
          i += 2;
          continue;
        }

        // 3b / 3c: 单独下标 vs 单独上标
        const subOrSupAst = tokensToSimpleAst(g.tokens, g.hasInlineSqrt);
        const isSub = decideIsSubscript(g, prevNode);
        const base = ast.pop();

        if (base.type === 'supsub') {
          if (isSub && !base.sub) {
            base.sub = subOrSupAst;
            ast.push(base);
          } else if (!isSub && !base.sup) {
            base.sup = subOrSupAst;
            ast.push(base);
          } else {
            ast.push({
              type: 'supsub',
              base,
              sub: isSub ? subOrSupAst : null,
              sup: isSub ? null : subOrSupAst
            });
          }
        } else {
          ast.push({
            type: 'supsub',
            base,
            sub: isSub ? subOrSupAst : null,
            sup: isSub ? null : subOrSupAst
          });
        }
        i++;
        continue;
      }

      // 情形 4：主基线行，暂存推入节点（包含可能存在的 SQRT_SENTINEL，待整树结束后统一折叠根式）
      for (const tok of g.tokens) {
        if (tok === SQRT_SENTINEL) {
          ast.push({ type: 'tok', val: SQRT_SENTINEL });
        } else if (ACCENT_COMBINING_MAP[tok] && ast.length > 0 && canTakeAccent(ast[ast.length - 1])) {
          const base = ast.pop();
          ast.push({ type: 'accent', base, acc: tok });
        } else {
          ast.push({ type: 'tok', val: tok });
        }
      }
      i++;
    }

    return foldSqrtSentinels(ast);
  }

  /**
   * 判定单个垂直附属行是下标（true）还是上标（false）
   */
  function decideIsSubscript(group, prevNode) {
    const toks = group.tokens;
    // 典型专有上标符号（转置 ⊤、垂直 ⊥、导数 ′）永远为上标
    if (toks.length === 1 && (toks[0] === '⊤' || toks[0] === '⊥' || toks[0] === '′' || toks[0] === '*')) {
      return false;
    }
    // 物理签名 1：后跟 .vlist-s 空行 -> 100% 是下标（覆盖 z_ctx, z_base, μ_B, μ_A 等全部 KaTeX 下标）
    if (group.vRow.emptyAfter) {
      return true;
    }
    // 物理签名 2：前面紧邻纯空格行（如 z\n^\n  \n⊤）且无尾随空行 -> 上标
    if (group.vRow.hadPureSpacesBefore) {
      return false;
    }
    // 语义兜底（应对用户提前删掉空行的极端文本）：多字母标签词（如 ctx, base, min, max, out, in）紧跟变量时为下标
    if (toks.length === 1 && /^[a-zA-Z]{2,}$/.test(toks[0]) && !KNOWN_FUNC_NAMES.has(toks[0])) {
      return true;
    }
    // 巨型算符如 lim_(x→0) 单附属行必为下标
    const baseOp = getBaseOpName(prevNode);
    if (baseOp === 'lim' || baseOp === 'max' || baseOp === 'min' || baseOp === 'argmax' || baseOp === 'argmin' || baseOp === 'sup' || baseOp === 'inf') {
      return true;
    }
    // 默认无尾随空行为上标（如 x^2）
    return false;
  }

  // ============================================================================
  // 5. 段落缝合与纯文本主流程编排
  // ============================================================================

  /**
   * 判断公式块前一行是否为“被行内公式硬生生打断的未完结半句话”
   */
  function shouldJoinWithPreviousLine(prevLine) {
    if (prevLine === undefined || prevLine === null) return false;
    const trimmed = prevLine.trim();
    if (!trimmed) return false;
    // 若上一行以完整句子终结标点收尾（如 。！？；." 等），说明上一段已独立结束，绝不跨段合并
    if (/[。！？；.!?]["'”’）)\]]*$/.test(trimmed)) {
      return false;
    }
    // 若上一行无尾随空格且以冒号收尾（如“开头即为公式：”），说明用于引出下一行独立块级公式
    if (!/[ \t]$/.test(prevLine) && /[：:]$/.test(trimmed)) {
      return false;
    }
    return true;
  }

  /**
   * 判断公式块（以 vlist 换行结束）之后的一行是否为同一句的后半部分
   */
  function shouldJoinWithNextLine(nextLine, joinedPrev) {
    if (nextLine === undefined || nextLine === null) return false;
    if (nextLine.trim() === '') return false;
    const trimmed = nextLine.trim();
    // 新条目/列表项标题（如 "C1：", "1. ", "- ", "* ", "## "）绝不并入上一句
    if (/^([A-Za-z]?\d+[：:.、)]|[-*•]\s+|#{1,6}\s+)/.test(trimmed)) {
      return false;
    }
    // 如果下一行以句内标点开头（如 "。"、"，"、"、"、"；"、")"）必为行内延续
    if (/^[，。、；：？！,.;:?!）)\]]/.test(trimmed)) {
      return true;
    }
    // 典型 KaTeX .vlist 退出特征：下一行带有前导空格（如 "  投到轴上得到 ", "  改为 "）
    if (/^\s+/.test(nextLine)) {
      return true;
    }
    // 若进入公式前就是未完结的行内半句话，后续紧邻文本默认接回原句
    if (joinedPrev) {
      return true;
    }
    return false;
  }

  /**
   * 拼接两段行内片段，处理中英文与数学公式边界的单空格规则
   */
  function joinInlinePieces(left, right) {
    if (!left) return right;
    if (!right) return left;

    const lTrim = left.replace(/[ \t]+$/, '');
    const rTrim = right.replace(/^[ \t]+/, '');
    if (!lTrim) return rTrim;
    if (!rTrim) return lTrim;

    const lastCh = [...lTrim].pop();
    const firstCh = [...rTrim][0];

    // 中文全角标点前后不留空格（但保留普通英文引号前等合理空格，以及尊重用户原有的 "C1： 标题" 内部文本，此处仅处理拼接点！）
    if (isCjkPunctuation(firstCh) || firstCh === ')' || firstCh === ']' || firstCh === '}') {
      return lTrim + rTrim;
    }
    if (isCjkOpenOrPunctuationNoRightSpace(lastCh) || lastCh === '(' || lastCh === '[' || lastCh === '{') {
      return lTrim + rTrim;
    }

    // 汉字与拉丁/希腊/数学符号拼接：保持 1 个清爽单空格（与期望输出 "状态轴 u"、"预测的 ẑ 投到"、"公式由 Δz ... 改为 s = ..." 一致）
    if ((isCjkIdeograph(lastCh) && !isCjkIdeograph(firstCh)) || (!isCjkIdeograph(lastCh) && isCjkIdeograph(firstCh))) {
      return `${lTrim} ${rTrim}`;
    }

    // 两侧原本至少有一侧带空格时保留单空格
    if (/[ \t]$/.test(left) || /^[ \t]/.test(right)) {
      return `${lTrim} ${rTrim}`;
    }
    return lTrim + rTrim;
  }

  function isCjkIdeograph(ch) {
    if (!ch) return false;
    const cp = ch.codePointAt(0);
    return (cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF);
  }

  function isCjkPunctuation(ch) {
    return /^[，。、；：？！）》】”’〉》〕〗〙〛]$/.test(ch);
  }

  function isCjkOpenOrPunctuationNoRightSpace(ch) {
    return /^[（《【“‘〈《〔〖〘〚、，。]$/.test(ch);
  }

  // ============================================================================
  // 6. 原始 LaTeX 解析器（支持 $...$, $$...$$, \(...\), \[...\]）
  // ============================================================================

  function parseLatexToAst(tex) {
    let pos = 0;
    const len = tex.length;

    function skipSpaces() {
      while (pos < len && /\s/.test(tex[pos])) pos++;
    }

    function parseSequence(stopAtCloseBrace, stopChar) {
      const nodes = [];
      while (pos < len) {
        skipSpaces();
        if (pos >= len) break;
        const ch = tex[pos];
        if (stopAtCloseBrace && ch === '}') break;
        if (stopChar && ch === stopChar) break;

        if (ch === '^' || ch === '_') {
          pos++;
          const scriptNodes = parseAtomAsList();
          const prev = nodes.length > 0 ? nodes.pop() : { type: 'tok', val: '' };
          if (prev.type === 'supsub') {
            if (ch === '_' && !prev.sub) prev.sub = scriptNodes;
            else if (ch === '^' && !prev.sup) prev.sup = scriptNodes;
            else {
              nodes.push({
                type: 'supsub',
                base: prev,
                sub: ch === '_' ? scriptNodes : null,
                sup: ch === '^' ? scriptNodes : null
              });
              continue;
            }
            nodes.push(prev);
          } else {
            nodes.push({
              type: 'supsub',
              base: prev,
              sub: ch === '_' ? scriptNodes : null,
              sup: ch === '^' ? scriptNodes : null
            });
          }
          continue;
        }

        const atom = parseAtom();
        if (atom !== null) {
          if (Array.isArray(atom)) nodes.push(...atom);
          else nodes.push(atom);
        }
      }
      return nodes;
    }

    function parseAtomAsList() {
      skipSpaces();
      if (pos < len && tex[pos] === '{') {
        pos++;
        const inner = parseSequence(true, null);
        if (pos < len && tex[pos] === '}') pos++;
        return inner;
      }
      const single = parseAtom();
      if (single === null) return [];
      return Array.isArray(single) ? single : [single];
    }

    function readRawBraceText() {
      skipSpaces();
      if (pos < len && tex[pos] === '{') {
        pos++;
        let depth = 1;
        let out = '';
        while (pos < len && depth > 0) {
          if (tex[pos] === '{') { depth++; out += tex[pos++]; }
          else if (tex[pos] === '}') {
            depth--;
            if (depth > 0) out += tex[pos];
            pos++;
          } else if (tex[pos] === '\\' && pos + 1 < len) {
            // 处理 \text{\_} 等转义
            const next = tex[pos + 1];
            if (next === '_' || next === '%' || next === '&' || next === '#' || next === '{' || next === '}' || next === '$') {
              out += next;
              pos += 2;
            } else {
              out += tex[pos++];
            }
          } else {
            out += tex[pos++];
          }
        }
        return out;
      }
      return pos < len ? tex[pos++] : '';
    }

    function parseAtom() {
      skipSpaces();
      if (pos >= len) return null;
      const ch = tex[pos];

      if (ch === '{') {
        pos++;
        const inner = parseSequence(true, null);
        if (pos < len && tex[pos] === '}') pos++;
        return inner;
      }

      if (ch === '}') {
        pos++;
        return null;
      }

      if (ch === '\\') {
        pos++;
        if (pos >= len) return null;
        // 单字符非字母控制符（如 \{, \}, \_, \, , \; , \|, \$）
        if (!/[A-Za-z]/.test(tex[pos])) {
          const sym = tex[pos++];
          if (LATEX_SPACE_MACROS.has(sym)) return { type: 'space' };
          if (sym === '!') return null;
          if (sym === '{' || sym === '}' || sym === '_' || sym === '%' || sym === '&' || sym === '#' || sym === '$') {
            return { type: 'tok', val: sym };
          }
          if (sym === '|') return { type: 'tok', val: '‖' };
          if (sym === '\\') return { type: 'tok', val: ' ' };
          return { type: 'tok', val: sym };
        }

        let cmd = '';
        while (pos < len && /[A-Za-z]/.test(tex[pos])) {
          cmd += tex[pos++];
        }

        if (LATEX_SPACE_MACROS.has(cmd)) {
          return { type: 'space' };
        }

        if (LATEX_IGNORE_MODIFIERS.has(cmd)) {
          // 若 \left. 或 \right. 带有空定界符 '.'，一并消费掉该点号
          if (cmd === 'left' || cmd === 'right' || cmd === 'middle') {
            skipSpaces();
            if (pos < len && tex[pos] === '.') pos++;
          }
          return null;
        }

        if (LATEX_ACCENT_MACROS[cmd]) {
          const baseList = parseAtomAsList();
          const baseNode = baseList.length === 1
            ? baseList[0]
            : { type: 'group', open: '', close: '', body: baseList };
          return { type: 'accent', base: baseNode, acc: LATEX_ACCENT_MACROS[cmd] };
        }

        if (cmd === 'frac' || cmd === 'dfrac' || cmd === 'tfrac' || cmd === 'cfrac') {
          const num = parseAtomAsList();
          const den = parseAtomAsList();
          return { type: 'frac', num, den };
        }

        if (cmd === 'binom' || cmd === 'tbinom' || cmd === 'dbinom') {
          const nPart = parseAtomAsList();
          const kPart = parseAtomAsList();
          return {
            type: 'group',
            open: 'C(',
            close: ')',
            body: [...nPart, { type: 'tok', val: ',' }, ...kPart]
          };
        }

        if (cmd === 'sqrt') {
          skipSpaces();
          let deg = null;
          if (pos < len && tex[pos] === '[') {
            pos++;
            deg = parseSequence(false, ']');
            if (pos < len && tex[pos] === ']') pos++;
          }
          const body = parseAtomAsList();
          return { type: 'sqrt', deg, body };
        }

        if (cmd === 'mathbb') {
          const txt = readRawBraceText().trim();
          const mapped = [...txt].map(c => BLACKBOARD_ASCII_MAP[c] || c).join('');
          return { type: 'tok', val: mapped };
        }

        if (LATEX_FONT_WRAPPERS.has(cmd)) {
          if (cmd.startsWith('text') || cmd === 'mbox' || cmd === 'hbox' || cmd === 'mathrm' || cmd === 'operatorname') {
            const raw = readRawBraceText().trim();
            return raw ? { type: 'tok', val: raw } : null;
          }
          return parseAtomAsList();
        }

        if (LATEX_SYMBOLS[cmd] !== undefined) {
          return { type: 'tok', val: LATEX_SYMBOLS[cmd] };
        }

        // 未知宏：优雅保留宏名本身
        return { type: 'tok', val: cmd };
      }

      // 数字（含小数）
      if (/[0-9]/.test(ch)) {
        let num = '';
        while (pos < len && /[0-9.]/.test(tex[pos])) {
          num += tex[pos++];
        }
        return { type: 'tok', val: num };
      }

      // 普通运算符与符号规范化
      pos++;
      if (ch === '-') return { type: 'tok', val: '−' };
      if (ch === '\'') {
        let cnt = 1;
        while (pos < len && tex[pos] === '\'') { cnt++; pos++; }
        return { type: 'tok', val: '′'.repeat(cnt) };
      }
      return { type: 'tok', val: normalizeMathChars(ch) };
    }

    return parseSequence(false, null);
  }

  function convertLatexFormula(tex, options) {
    const ast = parseLatexToAst(tex);
    return renderAst(ast, options);
  }

  /**
   * 扫描并替换文本中所有的 $...$, $$...$$, \(...\), \[...\] 原始 LaTeX 片段
   */
  function replaceInlineAndDisplayLatex(text, options) {
    // 1. 替换 $$...$$ 与 \[...\]
    let out = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, inner) => {
      return convertLatexFormula(inner.trim(), options);
    });
    out = out.replace(/\\\[([\s\S]+?)\\\]/g, (_, inner) => {
      return convertLatexFormula(inner.trim(), options);
    });
    // 2. 替换 \(...\)
    out = out.replace(/\\\(([\s\S]+?)\\\)/g, (_, inner) => {
      return convertLatexFormula(inner.trim(), options);
    });
    // 3. 替换行内 $...$（避开转义 \$ 以及明显货币金额如 "$100 and $200"）
    out = out.replace(/(^|[^\\$])\$(?!\s)([^\n$]+?)(?<!\s)\$/g, (match, prefix, inner) => {
      // 货币启发式排除：以纯数字金额开头且含普通英文单词空格（如 "$100 to $200"）
      if (/^\d+([.,]\d+)?\s+[a-zA-Z]/.test(inner)) {
        return match;
      }
      return prefix + convertLatexFormula(inner, options);
    });
    return out;
  }

  // ============================================================================
  // 7. 残缺碎片兜底清洗（应对仅框选半截公式或单层残留的数学斜体/散落顶标）
  // ============================================================================

  /**
   * 消除同一行内紧邻出现的双层重影（如 MathJax inline MathML 产生的 "𝑢u"、"𝑧^z^"、"𝑓(𝑥)=𝑥+1f(x)=x+1"）
   */
  function dedupeSameLineGhosting(line, options) {
    if (!hasMathAlphanumeric(line)) return line;
    const chars = [...line];
    let out = '';
    let i = 0;

    function isInlineMathClusterChar(ch) {
      if (!ch || /\s/.test(ch)) return false;
      if (isCjkIdeograph(ch) || isCjkPunctuation(ch) || isCjkOpenOrPunctuationNoRightSpace(ch)) return false;
      return true;
    }

    while (i < chars.length) {
      // 寻找含数学斜体字符的候选起点
      if (!isInlineMathClusterChar(chars[i])) {
        out += chars[i++];
        continue;
      }

      let matched = null;
      // 枚举 MathML 子串终点 mEnd（最长优先，最大扫描 60 字符）
      const maxMEnd = Math.min(chars.length - 2, i + 60);
      for (let mEnd = maxMEnd; mEnd >= i; mEnd--) {
        const mSlice = chars.slice(i, mEnd + 1).join('');
        // MathML 候选段内不能跨汉字/中文标点，且必须包含数学斜体 Unicode
        if ([...mSlice].some(c => isCjkIdeograph(c) || isCjkPunctuation(c) || isCjkOpenOrPunctuationNoRightSpace(c))) {
          continue;
        }
        if (!hasMathAlphanumeric(mSlice)) continue;

        const mCanon = extractCanonicalChars(mSlice);
        if (mCanon.length === 0) continue;

        // 紧接其后（允许至多 1 个空格）扫描不含数学斜体的 HTML 视觉层副本
        let hStart = mEnd + 1;
        while (hStart < chars.length && chars[hStart] === ' ' && hStart - (mEnd + 1) < 1) {
          hStart++;
        }
        let hPos = hStart;
        let cIdx = 0;
        let validHtml = true;

        while (hPos < chars.length && cIdx < mCanon.length) {
          const hc = chars[hPos];
          if (hc === ' ') { hPos++; continue; }
          if (hasMathAlphanumeric(hc) || isCjkIdeograph(hc) || isCjkPunctuation(hc)) {
            validHtml = false;
            break;
          }
          const hCanon = extractCanonicalChars(hc);
          if (hCanon.length === 0) { hPos++; continue; }
          if (cIdx + hCanon.length > mCanon.length) { validHtml = false; break; }
          for (let k = 0; k < hCanon.length; k++) {
            if (mCanon[cIdx + k] !== hCanon[k]) { validHtml = false; break; }
          }
          if (!validHtml) break;
          cIdx += hCanon.length;
          hPos++;
        }

        if (validHtml && cIdx === mCanon.length) {
          const ast = tokensToSimpleAst(tokenizeMathFragment(mSlice), false);
          matched = {
            rendered: renderAst(ast, options),
            nextIdx: hPos
          };
          break;
        }
      }

      if (matched) {
        out += matched.rendered;
        i = matched.nextIdx;
      } else {
        out += chars[i++];
      }
    }

    return out;
  }

  function cleanupResidualFragments(lines, options) {
    // 合并孤立散落的 "单字母 \n ^" 顶标（例如用户只框选了半截视觉层），并消除同行紧邻重影
    const merged = [];
    let i = 0;
    while (i < lines.length) {
      const cur = dedupeSameLineGhosting(lines[i], options);
      if (
        i + 1 < lines.length &&
        /^[A-Za-zα-ωΑ-Ω]$/.test(normalizeMathChars(cur).trim()) &&
        ACCENT_COMBINING_MAP[lines[i + 1].trim()]
      ) {
        const accented = applyAccent(normalizeMathChars(cur).trim(), lines[i + 1].trim());
        // 若上一行是未结束句子，接回上一行
        if (merged.length > 0 && shouldJoinWithPreviousLine(merged[merged.length - 1])) {
          merged[merged.length - 1] = joinInlinePieces(merged[merged.length - 1], accented);
        } else {
          merged.push(accented);
        }
        i += 2;
        if (i < lines.length && shouldJoinWithNextLine(lines[i], true)) {
          merged[merged.length - 1] = joinInlinePieces(merged[merged.length - 1], normalizeMathChars(dedupeSameLineGhosting(lines[i], options)));
          i++;
        }
        continue;
      }
      merged.push(normalizeMathChars(cur));
      i++;
    }
    return merged;
  }

  // ============================================================================
  // 8. 纯文本总入口 cleanMathText(text, options)
  // ============================================================================

  function cleanMathText(input, options = {}) {
    if (!input || typeof input !== 'string') return '';

    // Stage 1: 统一换行符与 NBSP，记录哪些行原本含零宽字符（.vlist-s 线索），随后剥离隐藏控制字符
    const normalizedNewlines = input.replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ');
    const rawLines = normalizedNewlines.split('\n');
    const lineMeta = rawLines.map(l => ({
      hadZwsp: /[\u200B\u2060-\u2064\uFEFF]/.test(l)
    }));
    const lines = rawLines.map(l => l.replace(INVISIBLE_CHARS_RE, ''));

    // Stage 2: 扫描双层重影块（MathML 层 + HTML 视觉层），精确重建公式并缝合回原句
    const outputParagraphs = [];
    let idx = 0;

    while (idx < lines.length) {
      const match = tryMatchDualLayerBlock(lines, lineMeta, idx);
      if (!match) {
        outputParagraphs.push(lines[idx]);
        idx++;
        continue;
      }

      // 构建当前公式 AST 并渲染为 Unicode 纯文本
      const ast = reconstructFormulaAst(match.mathLines, match.htmlSegments, match.extraSqrtCount);
      const renderedFormula = renderAst(ast, options);

      // 与前文缝合判定
      let joinedPrev = false;
      let currentLine = renderedFormula;
      if (outputParagraphs.length > 0 && shouldJoinWithPreviousLine(outputParagraphs[outputParagraphs.length - 1])) {
        const prev = outputParagraphs.pop();
        currentLine = joinInlinePieces(prev, renderedFormula);
        joinedPrev = true;
      }

      idx = match.nextLineIdx;

      // 与后文缝合：
      // 情形 A：同一 HTML 结束行末尾粘连了后续行内正文（如 "u，把只用上下文预测的 " 或 "s。"）
      if (match.trailingInlineText && match.trailingInlineText.length > 0) {
        // 注意保留 match.trailingInlineText 尾部空格（因为它可能紧接着开启下一个行内公式！）
        const trailTrailingSpace = /[ \t]+$/.exec(match.trailingInlineText);
        currentLine = joinInlinePieces(currentLine, match.trailingInlineText) + (trailTrailingSpace ? ' ' : '');
        outputParagraphs.push(currentLine);
      } else if (match.endedInVlist && idx < lines.length && shouldJoinWithNextLine(lines[idx], joinedPrev)) {
        // 情形 B：公式以 .vlist 垂直盒结束，导致紧随其后的同一句正文被挤到了下一行（如 "  投到轴上得到 ", "  改为 ", " 。"）
        const nextRaw = lines[idx];
        const nextTrailSpace = /[ \t]+$/.exec(nextRaw);
        currentLine = joinInlinePieces(currentLine, nextRaw) + (nextTrailSpace ? ' ' : '');
        outputParagraphs.push(currentLine);
        idx++;
      } else {
        outputParagraphs.push(currentLine);
      }
    }

    // Stage 3: 残余孤立数学斜体还原、同行紧邻重影消除与散落顶标归并
    const cleanedLines = cleanupResidualFragments(outputParagraphs, options);

    // Stage 4: 原始 LaTeX（$...$, $$...$$, \(...\), \[...\]）解析转换与行尾空白收口
    const finalLines = cleanedLines.map(line => {
      const withLatex = replaceInlineAndDisplayLatex(line, options);
      return withLatex.replace(/[ \t]+$/g, '');
    });

    return finalLines.join('\n');
  }

  // ============================================================================
  // 9. 剪贴板富文本 HTML 无损解析通道 cleanMathHtml(html, plainFallback, options)
  // ============================================================================

  /**
   * 当直接从 ChatGPT / Claude / Gemini / DeepSeek 网页复制并在浏览器中粘贴时，
   * 若存在 DOMParser 且 HTML 含有 .katex / mjx-container / <math>，直接从语义节点无损提取！
   */
  function cleanMathHtml(html, plainFallback = '', options = {}) {
    if (!html || typeof html !== 'string' || typeof DOMParser === 'undefined') {
      return { text: cleanMathText(plainFallback, options), channel: 'plain' };
    }
    if (!/(katex|mjx-container|<math[\s>])/i.test(html)) {
      return { text: cleanMathText(plainFallback, options), channel: 'plain' };
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // 1. 处理 KaTeX 容器
      const katexNodes = Array.from(doc.querySelectorAll('.katex-display, .katex'));
      for (const node of katexNodes) {
        if (!doc.body.contains(node)) continue;
        const isDisplay = node.classList.contains('katex-display');
        const annot = node.querySelector('annotation[encoding*="tex"]');
        let replaced = '';
        if (annot && annot.textContent) {
          replaced = convertLatexFormula(annot.textContent.trim(), options);
        } else {
          const mathEl = node.querySelector('math');
          if (mathEl) {
            const ast = mathmlElementToAst(mathEl);
            replaced = renderAst(ast, options);
          }
        }
        if (replaced) {
          const repNode = doc.createTextNode(isDisplay ? `\n${replaced}\n` : replaced);
          node.parentNode.replaceChild(repNode, node);
        }
      }

      // 2. 处理 MathJax v3 / v2 容器
      const mjxNodes = Array.from(doc.querySelectorAll('mjx-container, span.MathJax_Preview + span.MathJax'));
      for (const node of mjxNodes) {
        if (!doc.body.contains(node)) continue;
        const isDisplay = node.getAttribute('display') === 'true';
        const dataLatex = node.getAttribute('data-latex') || node.getAttribute('aria-label');
        const mathEl = node.querySelector('math');
        let replaced = '';
        if (dataLatex && !mathEl) {
          replaced = convertLatexFormula(dataLatex.trim(), options);
        } else if (mathEl) {
          const annot = mathEl.querySelector('annotation[encoding*="tex"]');
          if (annot && annot.textContent) {
            replaced = convertLatexFormula(annot.textContent.trim(), options);
          } else {
            replaced = renderAst(mathmlElementToAst(mathEl), options);
          }
        }
        if (replaced) {
          const repNode = doc.createTextNode(isDisplay ? `\n${replaced}\n` : replaced);
          node.parentNode.replaceChild(repNode, node);
        }
      }

      // 3. 处理裸 <math> 节点
      const bareMathNodes = Array.from(doc.querySelectorAll('math'));
      for (const mathEl of bareMathNodes) {
        if (!doc.body.contains(mathEl)) continue;
        const isDisplay = mathEl.getAttribute('display') === 'block';
        const annot = mathEl.querySelector('annotation[encoding*="tex"]');
        const replaced = (annot && annot.textContent)
          ? convertLatexFormula(annot.textContent.trim(), options)
          : renderAst(mathmlElementToAst(mathEl), options);
        const repNode = doc.createTextNode(isDisplay ? `\n${replaced}\n` : replaced);
        mathEl.parentNode.replaceChild(repNode, mathEl);
      }

      // 剔除所有剩余 aria-hidden 视觉辅助残留
      doc.querySelectorAll('.katex-html, mjx-assistive-mml, script, style').forEach(el => el.remove());

      const extracted = extractStructuredTextFromDom(doc.body);
      // 再过一遍 cleanMathText 以清理零宽字符与可能残存的 $...$ 原始 LaTeX
      const finalClean = cleanMathText(extracted, options);
      return { text: finalClean, channel: 'html-dom' };
    } catch (_) {
      return { text: cleanMathText(plainFallback, options), channel: 'plain' };
    }
  }

  /**
   * 递归将标准 MathML DOM 元素转换为统一公式 AST
   */
  function mathmlElementToAst(el) {
    if (!el) return [];
    const tag = (el.localName || el.tagName || '').toLowerCase();

    if (tag === 'annotation' || tag === 'annotation-xml') return [];

    if (tag === 'math' || tag === 'semantics' || tag === 'mrow' || tag === 'mstyle' || tag === 'mpadded') {
      const out = [];
      for (const child of Array.from(el.children)) {
        const cTag = (child.localName || child.tagName || '').toLowerCase();
        if (cTag === 'annotation' || cTag === 'annotation-xml') continue;
        out.push(...mathmlElementToAst(child));
      }
      return out;
    }

    if (tag === 'mi' || tag === 'mn' || tag === 'mo' || tag === 'mtext' || tag === 'ms') {
      const txt = normalizeMathChars((el.textContent || '').replace(INVISIBLE_CHARS_RE, '')).trim();
      if (!txt) return [];
      return [{ type: 'tok', val: txt === '-' && tag === 'mo' ? '−' : txt }];
    }

    if (tag === 'mfrac') {
      const ch = Array.from(el.children);
      if (ch.length >= 2) {
        return [{
          type: 'frac',
          num: mathmlElementToAst(ch[0]),
          den: mathmlElementToAst(ch[1])
        }];
      }
    }

    if (tag === 'msub' || tag === 'munder') {
      const ch = Array.from(el.children);
      if (ch.length >= 2) {
        const b = wrapSingleNode(mathmlElementToAst(ch[0]));
        return [{ type: 'supsub', base: b, sub: mathmlElementToAst(ch[1]), sup: null }];
      }
    }

    if (tag === 'msup') {
      const ch = Array.from(el.children);
      if (ch.length >= 2) {
        const b = wrapSingleNode(mathmlElementToAst(ch[0]));
        return [{ type: 'supsub', base: b, sub: null, sup: mathmlElementToAst(ch[1]) }];
      }
    }

    if (tag === 'mover') {
      const ch = Array.from(el.children);
      if (ch.length >= 2) {
        const b = wrapSingleNode(mathmlElementToAst(ch[0]));
        const overTxt = normalizeMathChars(ch[1].textContent || '').trim();
        if (ACCENT_COMBINING_MAP[overTxt]) {
          return [{ type: 'accent', base: b, acc: overTxt }];
        }
        return [{ type: 'supsub', base: b, sub: null, sup: mathmlElementToAst(ch[1]) }];
      }
    }

    if (tag === 'msubsup' || tag === 'munderover') {
      const ch = Array.from(el.children);
      if (ch.length >= 3) {
        const b = wrapSingleNode(mathmlElementToAst(ch[0]));
        return [{
          type: 'supsub',
          base: b,
          sub: mathmlElementToAst(ch[1]),
          sup: mathmlElementToAst(ch[2])
        }];
      }
    }

    if (tag === 'msqrt') {
      const body = [];
      for (const child of Array.from(el.children)) body.push(...mathmlElementToAst(child));
      return [{ type: 'sqrt', deg: null, body }];
    }

    if (tag === 'mroot') {
      const ch = Array.from(el.children);
      if (ch.length >= 2) {
        return [{
          type: 'sqrt',
          body: mathmlElementToAst(ch[0]),
          deg: mathmlElementToAst(ch[1])
        }];
      }
    }

    const fallback = [];
    for (const child of Array.from(el.children)) {
      fallback.push(...mathmlElementToAst(child));
    }
    return fallback;
  }

  function wrapSingleNode(list) {
    if (list.length === 0) return { type: 'tok', val: '' };
    if (list.length === 1) return list[0];
    return { type: 'group', open: '', close: '', body: list };
  }

  function extractStructuredTextFromDom(rootEl) {
    const BLOCK_TAGS = new Set(['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'tr', 'section', 'article']);
    const chunks = [];

    function walk(node) {
      if (node.nodeType === 3) {
        chunks.push(node.nodeValue.replace(/\r?\n/g, ' '));
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = (node.localName || node.tagName || '').toLowerCase();
      if (tag === 'br') {
        chunks.push('\n');
        return;
      }
      const isBlock = BLOCK_TAGS.has(tag);
      if (isBlock && chunks.length > 0 && !chunks[chunks.length - 1].endsWith('\n')) {
        chunks.push('\n');
      }
      for (const child of Array.from(node.childNodes)) {
        walk(child);
      }
      if (isBlock && chunks.length > 0 && !chunks[chunks.length - 1].endsWith('\n')) {
        chunks.push('\n');
      }
    }

    walk(rootEl);
    return chunks.join('')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return {
    cleanMathText,
    cleanMathHtml,
    convertLatexFormula,
    normalizeMathChars,
    applyAccent
  };
});
