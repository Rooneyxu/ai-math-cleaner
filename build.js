/**
 * 构建自包含单文件公网版工具 index.html（内联 cleaner.js、SVG 品牌图标、全套矢量控件图标与亮暗主题系统）
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const cleanerCode = fs.readFileSync(path.join(dir, 'cleaner.js'), 'utf8');

// 浏览器标签页 Favicon（内联 SVG Data URI：靛蓝渐变底 + 白色 ẑ 与四芒净化星）
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#4f46e5"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="url(#g)"/>
  <path d="M20 22 L32 13 L44 22" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M20 30 H42 L20 50 H43" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M50 11 L51.8 16.2 L57 18 L51.8 19.8 L50 25 L48.2 19.8 L43 18 L48.2 16.2 Z" fill="#fde047"/>
</svg>`;

const faviconDataUri = 'data:image/svg+xml,' + encodeURIComponent(faviconSvg.replace(/\s+/g, ' ').trim());

const htmlTemplate = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MathClean · AI 网页公式乱码清洗与纯文本 Unicode 转换器</title>
  <meta name="description" content="一键消除从 ChatGPT、Claude、Gemini、DeepSeek 网页框选复制数学公式产生的双倍重影、碎换行与零宽乱码，同时支持原始 LaTeX 转高可读性纯文本 Unicode。100% 浏览器本地离线运行。" />
  <meta property="og:title" content="MathClean · AI 网页公式乱码清洗与 Unicode 转换工具" />
  <meta property="og:description" content="专治 AI 网页复制公式重影、断行碎裂、修饰符脱落与零宽字符，一键转为可直接粘贴进 Word / PPT / 微信的干净纯文本。" />
  <meta property="og:type" content="website" />
  <meta name="theme-color" content="#2563eb" />
  <link rel="icon" type="image/svg+xml" href="${faviconDataUri}" />
  <script>
    (function () {
      try {
        var saved = JSON.parse(localStorage.getItem('ai_math_cleaner_prefs') || '{}');
        var theme = saved.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', theme);
      } catch (_) {}
    })();
  </script>
  <style>
    :root, html[data-theme="light"] {
      --bg: #f8fafc;
      --bg-glow-1: rgba(37, 99, 235, 0.08);
      --bg-glow-2: rgba(99, 102, 241, 0.07);
      --surface: #ffffff;
      --surface-glass: rgba(255, 255, 255, 0.86);
      --surface-subtle: #f1f5f9;
      --surface-hover: #e2e8f0;
      --border: #e2e8f0;
      --border-strong: #cbd5e1;
      --border-focus: #3b82f6;
      --focus-ring: rgba(59, 130, 246, 0.16);
      --text: #0f172a;
      --text-secondary: #334155;
      --text-muted: #64748b;
      --primary: #2563eb;
      --primary-hover: #1d4ed8;
      --primary-grad: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
      --primary-soft: #eff6ff;
      --primary-soft-border: #bfdbfe;
      --success: #059669;
      --success-bg: #ecfdf5;
      --success-border: #a7f3d0;
      --badge-bg: #eef2ff;
      --badge-text: #4338ca;
      --demo-bg: #f1f5f9;
      --demo-code: #475569;
      --shadow-sm: 0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02);
      --shadow-md: 0 10px 30px -10px rgba(15, 23, 42, 0.07), 0 4px 12px -4px rgba(15, 23, 42, 0.03);
      --shadow-btn: 0 4px 12px rgba(37, 99, 235, 0.22);
      --radius-lg: 16px;
      --radius-md: 12px;
      --radius-sm: 9px;
      --font-sans: "Inter", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, -apple-system, sans-serif;
      --font-math-text: "Segoe UI", "Cambria Math", "STIX Two Math", "PingFang SC", "Microsoft YaHei", sans-serif;
      --font-mono: "JetBrains Mono", "Cascadia Code", "Consolas", monospace;
    }

    html[data-theme="dark"] {
      --bg: #090d16;
      --bg-glow-1: rgba(59, 130, 246, 0.14);
      --bg-glow-2: rgba(129, 140, 248, 0.10);
      --surface: #111827;
      --surface-glass: rgba(17, 24, 39, 0.85);
      --surface-subtle: #1e293b;
      --surface-hover: #334155;
      --border: #1f2937;
      --border-strong: #334155;
      --border-focus: #60a5fa;
      --focus-ring: rgba(96, 165, 250, 0.18);
      --text: #f8fafc;
      --text-secondary: #cbd5e1;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-hover: #60a5fa;
      --primary-grad: linear-gradient(135deg, #2563eb 0%, #6366f1 100%);
      --primary-soft: rgba(59, 130, 246, 0.14);
      --primary-soft-border: rgba(96, 165, 250, 0.3);
      --success: #34d399;
      --success-bg: rgba(16, 185, 129, 0.14);
      --success-border: rgba(52, 211, 153, 0.35);
      --badge-bg: rgba(99, 102, 241, 0.18);
      --badge-text: #c7d2fe;
      --demo-bg: #1e293b;
      --demo-code: #cbd5e1;
      --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
      --shadow-md: 0 14px 34px -10px rgba(0, 0, 0, 0.5);
      --shadow-btn: 0 4px 14px rgba(37, 99, 235, 0.35);
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-sans);
      background-color: var(--bg);
      background-image:
        radial-gradient(ellipse 60% 38% at 18% 0%, var(--bg-glow-1), transparent),
        radial-gradient(ellipse 55% 35% at 82% 0%, var(--bg-glow-2), transparent);
      background-attachment: fixed;
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 20px 24px;
      gap: 16px;
      transition: background-color 0.2s ease, color 0.2s ease;
    }

    .icon {
      width: 17px;
      height: 17px;
      flex-shrink: 0;
      stroke: currentColor;
      stroke-width: 1.85;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    .icon-sm {
      width: 14px;
      height: 14px;
    }

    /* 顶栏品牌区 */
    header {
      max-width: 1440px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }

    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand-logo {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.25);
      flex-shrink: 0;
      display: block;
    }

    .brand-text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .brand-title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }

    .brand-text h1 {
      font-size: 1.24rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 0.74rem;
      font-weight: 600;
      padding: 3px 9px;
      border-radius: 999px;
      background: var(--badge-bg);
      color: var(--badge-text);
    }

    .brand-sub {
      font-size: 0.84rem;
      color: var(--text-muted);
      line-height: 1.45;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .demo-Showcase {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 999px;
      background: var(--surface);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .demo-Showcase code {
      font-family: var(--font-math-text);
      padding: 1px 6px;
      border-radius: 5px;
      background: var(--demo-bg);
      color: var(--demo-code);
      font-size: 0.8rem;
    }

    .demo-Showcase .demo-clean {
      background: var(--primary-soft);
      color: var(--primary);
      font-weight: 600;
    }

    @media (max-width: 1024px) {
      .demo-Showcase { display: none; }
    }

    .icon-btn {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-secondary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: all 0.16s ease;
    }

    .icon-btn:hover {
      background: var(--surface-subtle);
      border-color: var(--border-strong);
      color: var(--text);
      transform: translateY(-1px);
    }

    html[data-theme="dark"] .icon-sun { display: block; }
    html[data-theme="dark"] .icon-moon { display: none; }
    html:not([data-theme="dark"]) .icon-sun { display: none; }
    html:not([data-theme="dark"]) .icon-moon { display: block; }

    /* 操作工具栏 */
    .toolbar {
      max-width: 1440px;
      width: 100%;
      margin: 0 auto;
      background: var(--surface-glass);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 12px 16px;
      box-shadow: var(--shadow-md);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .btn-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 9px;
    }

    button, select {
      font-family: inherit;
      font-size: 0.86rem;
      border-radius: var(--radius-sm);
      transition: all 0.16s ease;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 14px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--border-strong);
      background: var(--surface);
      color: var(--text-secondary);
      box-shadow: var(--shadow-sm);
    }

    .btn:hover {
      background: var(--surface-subtle);
      color: var(--text);
      transform: translateY(-1px);
    }

    .btn:active {
      transform: translateY(0);
    }

    .btn-primary {
      background: var(--primary-grad);
      border-color: transparent;
      color: #ffffff;
      box-shadow: var(--shadow-btn);
    }

    .btn-primary:hover {
      filter: brightness(1.06);
      color: #ffffff;
    }

    .btn-accent {
      background: var(--primary-soft);
      border-color: var(--primary-soft-border);
      color: var(--primary);
      box-shadow: none;
    }

    .btn-accent:hover {
      background: var(--primary-soft);
      border-color: var(--primary);
      color: var(--primary);
    }

    .btn-accent.copied {
      background: var(--success-bg);
      border-color: var(--success-border);
      color: var(--success);
    }

    .select-wrap {
      position: relative;
      display: inline-flex;
      align-items: center;
    }

    .select-wrap .select-icon {
      position: absolute;
      left: 11px;
      pointer-events: none;
      color: var(--text-muted);
    }

    .select-with-icon {
      padding: 8px 12px 8px 33px;
      border: 1px solid var(--border-strong);
      background: var(--surface);
      color: var(--text-secondary);
      font-weight: 500;
      outline: none;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
    }

    .select-with-icon:hover {
      background: var(--surface-subtle);
      color: var(--text);
    }

    .options-group {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 14px;
      font-size: 0.83rem;
      color: var(--text-secondary);
    }

    .opt-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      user-select: none;
    }

    .opt-item input[type="checkbox"] {
      width: 15px;
      height: 15px;
      accent-color: var(--primary);
      cursor: pointer;
      border-radius: 4px;
    }

    .opt-select {
      padding: 5px 10px;
      border: 1px solid var(--border);
      background: var(--surface-subtle);
      color: var(--text);
      font-size: 0.82rem;
      outline: none;
      cursor: pointer;
    }

    .opt-select:focus, .select-with-icon:focus {
      border-color: var(--border-focus);
      box-shadow: 0 0 0 3px var(--focus-ring);
    }

    /* 双栏主编辑工作台 */
    main {
      max-width: 1440px;
      width: 100%;
      margin: 0 auto;
      flex: 1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      min-height: 470px;
    }

    @media (max-width: 920px) {
      body { padding: 14px; }
      main { grid-template-columns: 1fr; min-height: auto; }
      textarea { min-height: 240px; }
    }

    .pane {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: border-color 0.16s ease, box-shadow 0.16s ease;
    }

    .pane:focus-within {
      border-color: var(--border-focus);
      box-shadow: var(--shadow-md), 0 0 0 3px var(--focus-ring);
    }

    .pane-header {
      padding: 11px 16px;
      background: var(--surface-subtle);
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font-size: 0.84rem;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .pane-title {
      display: inline-flex;
      align-items: center;
      gap: 7px;
    }

    .pane-title .icon {
      color: var(--primary);
    }

    .pane-meta {
      font-weight: 500;
      font-size: 0.77rem;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .channel-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 9px;
      border-radius: 999px;
      font-size: 0.73rem;
      font-weight: 600;
      background: var(--primary-soft);
      color: var(--primary);
      border: 1px solid var(--primary-soft-border);
    }

    textarea {
      flex: 1;
      width: 100%;
      border: none;
      outline: none;
      resize: none;
      padding: 18px;
      background: transparent;
      color: var(--text);
      font-family: var(--font-math-text);
      font-size: 0.98rem;
      line-height: 1.76;
      letter-spacing: 0.01em;
    }

    textarea::placeholder {
      color: var(--text-muted);
      opacity: 0.72;
    }

    textarea::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    textarea::-webkit-scrollbar-thumb {
      background: var(--border-strong);
      border-radius: 999px;
    }
    textarea::-webkit-scrollbar-track {
      background: transparent;
    }

    /* 页脚统计与隐私标识 */
    footer {
      max-width: 1440px;
      width: 100%;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      font-size: 0.8rem;
      color: var(--text-muted);
      padding: 2px 4px;
    }

    .stats-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .stat-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 10px;
      border-radius: 999px;
      background: var(--surface);
      border: 1px solid var(--border);
      font-size: 0.77rem;
    }

    .stat-chip strong {
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 0.78rem;
    }

    .privacy-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--text-secondary);
      font-weight: 500;
    }

    .privacy-pill .icon {
      color: var(--success);
    }

    kbd {
      font-family: var(--font-mono);
      font-size: 0.73rem;
      padding: 1px 6px;
      border-radius: 5px;
      border: 1px solid var(--border-strong);
      background: var(--surface);
      color: var(--text-secondary);
      box-shadow: 0 1px 0 var(--border-strong);
    }

    /* 悬浮通知 Toast */
    .toast {
      position: fixed;
      top: 22px;
      left: 50%;
      transform: translateX(-50%) translateY(-24px);
      background: var(--surface);
      color: var(--success);
      border: 1px solid var(--success-border);
      padding: 9px 18px;
      border-radius: 999px;
      font-size: 0.86rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: var(--shadow-md);
      opacity: 0;
      pointer-events: none;
      transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 1000;
    }

    .toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  </style>
</head>
<body>

  <!-- 顶部提示气泡 -->
  <div id="toast" class="toast" role="status" aria-live="polite">
    <svg class="icon" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
    <span id="toastText">已转换为干净 Unicode 并复制到剪贴板</span>
  </div>

  <!-- 网站头部 -->
  <header>
    <div class="brand-wrap">
      <svg class="brand-logo" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2563eb"/>
            <stop offset="100%" stop-color="#4f46e5"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="16" fill="url(#logoGrad)"/>
        <path d="M20 22 L32 13 L44 22" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M20 30 H42 L20 50 H43" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M50 11 L51.8 16.2 L57 18 L51.8 19.8 L50 25 L48.2 19.8 L43 18 L48.2 16.2 Z" fill="#fde047"/>
      </svg>

      <div class="brand-text">
        <div class="brand-title-row">
          <h1>MathClean · AI 网页公式复制乱码清洗工具</h1>
          <span class="badge">
            <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
            双层去重影 + LaTeX 转纯文本
          </span>
        </div>
        <p class="brand-sub">一键修复从 ChatGPT、Claude、Gemini、DeepSeek 网页框选复制产生的双倍公式重影、断行碎裂与修饰符脱落</p>
      </div>
    </div>

    <div class="header-right">
      <div class="demo-Showcase" title="清洗前后效果直观对比">
        <code>𝑢u · z↵^ · μ↵B</code>
        <svg class="icon icon-sm" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        <code class="demo-clean">u · ẑ · μ_B</code>
      </div>

      <button id="btnTheme" class="icon-btn" title="切换亮色 / 暗色外观" aria-label="切换亮色或暗色主题">
        <svg class="icon icon-sun" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
        </svg>
        <svg class="icon icon-moon" viewBox="0 0 24 24">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
        </svg>
      </button>
    </div>
  </header>

  <!-- 快捷操作与偏好栏 -->
  <section class="toolbar">
    <div class="btn-group">
      <button id="btnPasteClean" class="btn btn-primary" title="读取系统剪贴板、自动清洗并立即写回剪贴板">
        <svg class="icon" viewBox="0 0 24 24">
          <rect width="8" height="4" x="8" y="2" rx="1" ry="1"/>
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
          <path d="M13 10 9 15h5l-1 5 4-5h-5l1-5z"/>
        </svg>
        一键粘贴并清洗复制
      </button>

      <button id="btnCopy" class="btn btn-accent" title="复制右侧清洗后的纯文本">
        <svg id="iconCopyDefault" class="icon" viewBox="0 0 24 24">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
        <svg id="iconCopyDone" class="icon" viewBox="0 0 24 24" style="display:none;">
          <path d="M20 6 9 17l-5-5"/>
        </svg>
        <span id="btnCopyLabel">复制清洗结果</span>
      </button>

      <div class="select-wrap">
        <svg class="icon icon-sm select-icon" viewBox="0 0 24 24">
          <path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/>
        </svg>
        <select id="sampleSelector" class="select-with-icon" aria-label="载入示例">
          <option value="">载入演示样例...</option>
          <option value="benchmark">样例 1：真实网页复制重影与断行</option>
          <option value="latex">样例 2：原始 LaTeX 混排 ($...$ / \\[...\\])</option>
          <option value="advanced">样例 3：分式、上下标、求和与根式</option>
        </select>
      </div>

      <button id="btnClear" class="btn" title="清空输入与输出">
        <svg class="icon" viewBox="0 0 24 24">
          <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
        </svg>
        清空
      </button>
    </div>

    <div class="options-group">
      <label class="opt-item" title="在页面任意位置按 Ctrl+V 粘贴后，自动把清洗结果写回剪贴板，可直接切回 Word/PPT/微信粘贴">
        <input type="checkbox" id="optAutoCopy" checked />
        粘贴后自动复制
      </label>
      <label class="opt-item" title="直接从浏览器网页复制粘贴时，若剪贴板带有原始 KaTeX/MathJax DOM，优先无损提取公式结构">
        <input type="checkbox" id="optPreferHtml" checked />
        网页富文本无损优先
      </label>
      <label class="opt-item">
        下标：
        <select id="optSubscript" class="opt-select">
          <option value="smart">智能一致 (z_ctx, μ_B / x₁)</option>
          <option value="underscore">全用下划线 (x_1, z_ctx)</option>
        </select>
      </label>
      <label class="opt-item">
        间距：
        <select id="optSpacing" class="opt-select">
          <option value="spaced">标准单空格 (a = b − c)</option>
          <option value="compact">紧凑无空格 (a=b−c)</option>
        </select>
      </label>
    </div>
  </section>

  <!-- 双栏输入输出主体 -->
  <main>
    <div class="pane">
      <div class="pane-header">
        <span class="pane-title">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          原始输入（网页框选复制文本 / 原始 LaTeX）
        </span>
        <span id="inputMeta" class="pane-meta">0 行 · 0 字符</span>
      </div>
      <textarea
        id="inputArea"
        spellcheck="false"
        placeholder="直接按 Ctrl+V 粘贴从 ChatGPT、Claude、Gemini、DeepSeek 等网页框选复制的文字，或包含 $...$ 的 LaTeX 源码...&#10;&#10;小贴士：无需先点击输入框，在页面任意位置按 Ctrl+V 即可一键完成清洗并自动复制回剪贴板！"
      ></textarea>
    </div>

    <div class="pane">
      <div class="pane-header">
        <span class="pane-title">
          <svg class="icon" viewBox="0 0 24 24">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/>
          </svg>
          干净纯文本 Unicode（可直接粘贴至 Word / PPT / 微信）
        </span>
        <div class="pane-meta">
          <span id="channelBadge" class="channel-pill">等待输入</span>
          <span id="outputMeta">0 行 · 0 字符</span>
        </div>
      </div>
      <textarea
        id="outputArea"
        readonly
        spellcheck="false"
        placeholder="清洗后的高可读性纯文本结果将实时呈现在这里..."
      ></textarea>
    </div>
  </main>

  <!-- 页脚统计与隐私说明 -->
  <footer>
    <div id="statsBar" class="stats-bar">
      <span class="stat-chip">已清理隐藏字符 <strong id="statInvisible">0</strong></span>
      <span class="stat-chip">已还原数学斜体 <strong id="statMathItalic">0</strong></span>
      <span class="stat-chip">已缝合碎断行 <strong id="statMergedLines">0</strong></span>
    </div>

    <div class="privacy-pill">
      <svg class="icon icon-sm" viewBox="0 0 24 24">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
      </svg>
      <span>100% 浏览器本地实时计算 · 零网络上传 · 支持全局 <kbd>Ctrl</kbd> + <kbd>V</kbd></span>
    </div>
  </footer>

  <script>
${cleanerCode}
  </script>

  <script>
    (function () {
      'use strict';

      const SAMPLES = {
        benchmark: [
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
          '\u200B',
          ' −z ',
          'base',
          '\u200B',
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
          '\u200B',
          ' −μ ',
          'A',
          '\u200B',
          ' 。'
        ].join('\\n'),

        latex: [
          '1. 状态投影公式：将上下文预测 $\\\\hat{z}$ 投影到方向轴 $u$ 得到标量得分 $s = \\\\hat{z}^\\\\top u$，其中 $u \\\\propto \\\\mu_B - \\\\mu_A$。',
          '2. 高斯核密度估计：对于任意 $x \\\\in \\\\mathbb{R}^d$，定义归一化分布 \\\\(\\\\tilde{p}(x) = \\\\frac{1}{\\\\sqrt{2\\\\pi}\\\\sigma} \\\\exp\\\\left(-\\\\frac{(x - \\\\bar{\\\\mu})^2}{2\\\\sigma^2}\\\\right)\\\\)。',
          '3. 渐近收敛性：',
          '\\\\[\\\\lim_{t \\\\to \\\\infty} \\\\sum_{i=1}^n \\\\|x_i - \\\\hat{x}_i\\\\|_2^2 = 0\\\\]'
        ].join('\\n'),

        advanced: [
          '损失函数定义为样本加权和 ',
          '∑',
          '𝑖',
          '=',
          '1',
          '𝑛',
          '𝑥',
          '𝑖',
          '2',
          'i=1',
          '∑',
          'n',
          ' x ',
          'i',
          '2',
          '',
          ' ，其中归一化系数为 ',
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
          ' ，速度向量记作 ',
          '𝑣',
          '→',
          'v，距离满足 ',
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
        ].join('\\n')
      };

      const inputArea = document.getElementById('inputArea');
      const outputArea = document.getElementById('outputArea');
      const btnPasteClean = document.getElementById('btnPasteClean');
      const btnCopy = document.getElementById('btnCopy');
      const btnCopyLabel = document.getElementById('btnCopyLabel');
      const iconCopyDefault = document.getElementById('iconCopyDefault');
      const iconCopyDone = document.getElementById('iconCopyDone');
      const btnClear = document.getElementById('btnClear');
      const btnTheme = document.getElementById('btnTheme');
      const sampleSelector = document.getElementById('sampleSelector');
      const optAutoCopy = document.getElementById('optAutoCopy');
      const optPreferHtml = document.getElementById('optPreferHtml');
      const optSubscript = document.getElementById('optSubscript');
      const optSpacing = document.getElementById('optSpacing');
      const inputMeta = document.getElementById('inputMeta');
      const outputMeta = document.getElementById('outputMeta');
      const channelBadge = document.getElementById('channelBadge');
      const statInvisible = document.getElementById('statInvisible');
      const statMathItalic = document.getElementById('statMathItalic');
      const statMergedLines = document.getElementById('statMergedLines');
      const toast = document.getElementById('toast');
      const toastText = document.getElementById('toastText');

      let lastHtmlClipboard = '';
      let lastPlainForHtml = '';
      let toastTimer = null;
      let copyBtnTimer = null;

      // 读取持久化偏好
      try {
        const saved = JSON.parse(localStorage.getItem('ai_math_cleaner_prefs') || '{}');
        if (typeof saved.autoCopy === 'boolean') optAutoCopy.checked = saved.autoCopy;
        if (typeof saved.preferHtml === 'boolean') optPreferHtml.checked = saved.preferHtml;
        if (saved.subscript) optSubscript.value = saved.subscript;
        if (saved.spacing) optSpacing.value = saved.spacing;
      } catch (_) {}

      function savePrefs(extra) {
        try {
          const prev = JSON.parse(localStorage.getItem('ai_math_cleaner_prefs') || '{}');
          localStorage.setItem('ai_math_cleaner_prefs', JSON.stringify(Object.assign({}, prev, {
            autoCopy: optAutoCopy.checked,
            preferHtml: optPreferHtml.checked,
            subscript: optSubscript.value,
            spacing: optSpacing.value
          }, extra || {})));
        } catch (_) {}
      }

      btnTheme.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme') || 'light';
        const next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        savePrefs({ theme: next });
      });

      function getOptions() {
        return {
          subscriptMode: optSubscript.value,
          compactOperators: optSpacing.value === 'compact'
        };
      }

      function showToast(msg) {
        toastText.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
      }

      function triggerCopyButtonFeedback() {
        btnCopy.classList.add('copied');
        iconCopyDefault.style.display = 'none';
        iconCopyDone.style.display = 'block';
        btnCopyLabel.textContent = '已复制';
        clearTimeout(copyBtnTimer);
        copyBtnTimer = setTimeout(() => {
          btnCopy.classList.remove('copied');
          iconCopyDefault.style.display = 'block';
          iconCopyDone.style.display = 'none';
          btnCopyLabel.textContent = '复制清洗结果';
        }, 1600);
      }

      async function copyTextToClipboard(text, customMsg) {
        if (!text) return false;
        try {
          await navigator.clipboard.writeText(text);
          triggerCopyButtonFeedback();
          showToast(customMsg || '已复制干净结果到剪贴板');
          return true;
        } catch (_) {
          outputArea.select();
          const ok = document.execCommand('copy');
          if (ok) {
            triggerCopyButtonFeedback();
            showToast(customMsg || '已复制干净结果到剪贴板');
          }
          return ok;
        }
      }

      function countDiagnostics(raw, cleaned) {
        const invMatches = raw.match(/[\\u00A0\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2069\\uFEFF]/g);
        let mathItalics = 0;
        for (const ch of raw) {
          const cp = ch.codePointAt(0);
          if ((cp >= 0x1D400 && cp <= 0x1D7FF) || cp === 0x210E) mathItalics++;
        }
        const inLines = raw ? raw.replace(/\\r\\n?/g, '\\n').split('\\n').length : 0;
        const outLines = cleaned ? cleaned.split('\\n').length : 0;
        return {
          inLines,
          outLines,
          invisible: invMatches ? invMatches.length : 0,
          mathItalics,
          mergedLines: Math.max(0, inLines - outLines)
        };
      }

      function runTransform(triggerAutoCopy = false) {
        const raw = inputArea.value;
        if (!raw) {
          outputArea.value = '';
          inputMeta.textContent = '0 行 · 0 字符';
          outputMeta.textContent = '0 行 · 0 字符';
          channelBadge.textContent = '等待输入';
          statInvisible.textContent = '0';
          statMathItalic.textContent = '0';
          statMergedLines.textContent = '0';
          return;
        }

        const opts = getOptions();
        let cleaned = '';
        let usedChannel = 'plain';

        if (optPreferHtml.checked && lastHtmlClipboard && raw === lastPlainForHtml) {
          const res = AIMathCleaner.cleanMathHtml(lastHtmlClipboard, raw, opts);
          cleaned = res.text;
          usedChannel = res.channel;
        } else {
          cleaned = AIMathCleaner.cleanMathText(raw, opts);
        }

        outputArea.value = cleaned;

        const diag = countDiagnostics(raw, cleaned);
        inputMeta.textContent = \`\${diag.inLines} 行 · \${[...raw].length} 字符\`;
        outputMeta.textContent = \`\${diag.outLines} 行 · \${[...cleaned].length} 字符\`;
        channelBadge.textContent = usedChannel === 'html-dom'
          ? '网页 DOM 无损通道'
          : (/(^|[^\\\\])(\\\$|\\\\\\(|\\\\\\[)/.test(raw) ? 'LaTeX + 纯文本引擎' : '双层重影清洗引擎');

        statInvisible.textContent = String(diag.invisible);
        statMathItalic.textContent = String(diag.mathItalics);
        statMergedLines.textContent = String(diag.mergedLines);

        if (triggerAutoCopy && optAutoCopy.checked && cleaned) {
          copyTextToClipboard(cleaned, \`已清洗并自动复制到剪贴板（缝合 \${diag.mergedLines} 行断行）\`);
        }
      }

      inputArea.addEventListener('paste', (e) => {
        if (!e.clipboardData) return;
        const html = e.clipboardData.getData('text/html');
        const plain = e.clipboardData.getData('text/plain');
        if (html && plain) {
          e.preventDefault();
          lastHtmlClipboard = html;
          lastPlainForHtml = plain;
          inputArea.value = plain;
          runTransform(true);
        } else {
          lastHtmlClipboard = '';
          lastPlainForHtml = '';
          setTimeout(() => runTransform(true), 0);
        }
      });

      document.addEventListener('paste', (e) => {
        if (document.activeElement === inputArea) return;
        if (!e.clipboardData) return;
        e.preventDefault();
        const html = e.clipboardData.getData('text/html') || '';
        const plain = e.clipboardData.getData('text/plain') || '';
        lastHtmlClipboard = html;
        lastPlainForHtml = plain;
        inputArea.value = plain;
        runTransform(true);
      });

      inputArea.addEventListener('input', () => {
        if (inputArea.value !== lastPlainForHtml) {
          lastHtmlClipboard = '';
          lastPlainForHtml = '';
        }
        runTransform(false);
      });

      btnPasteClean.addEventListener('click', async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.read) {
            const items = await navigator.clipboard.read();
            let html = '';
            let plain = '';
            for (const item of items) {
              if (item.types.includes('text/html')) {
                const blob = await item.getType('text/html');
                html = await blob.text();
              }
              if (item.types.includes('text/plain')) {
                const blob = await item.getType('text/plain');
                plain = await blob.text();
              }
            }
            if (plain || html) {
              lastHtmlClipboard = html;
              lastPlainForHtml = plain;
              inputArea.value = plain;
              runTransform(false);
              if (outputArea.value) {
                await copyTextToClipboard(outputArea.value, '已读取剪贴板、完成清洗并写回剪贴板！');
              }
              return;
            }
          }
          const text = await navigator.clipboard.readText();
          lastHtmlClipboard = '';
          lastPlainForHtml = '';
          inputArea.value = text;
          runTransform(false);
          if (outputArea.value) {
            await copyTextToClipboard(outputArea.value, '已读取剪贴板、完成清洗并写回剪贴板！');
          }
        } catch (_) {
          inputArea.focus();
          showToast('请直接按 Ctrl + V 粘贴剪贴板内容');
        }
      });

      btnCopy.addEventListener('click', () => {
        if (!outputArea.value) {
          showToast('当前没有可复制的内容');
          return;
        }
        copyTextToClipboard(outputArea.value);
      });

      btnClear.addEventListener('click', () => {
        lastHtmlClipboard = '';
        lastPlainForHtml = '';
        sampleSelector.value = '';
        inputArea.value = '';
        runTransform(false);
        inputArea.focus();
      });

      sampleSelector.addEventListener('change', () => {
        const key = sampleSelector.value;
        if (!key || !SAMPLES[key]) return;
        lastHtmlClipboard = '';
        lastPlainForHtml = '';
        inputArea.value = SAMPLES[key];
        runTransform(false);
        showToast('已载入演示样例，右侧为实时转换结果');
      });

      [optAutoCopy, optPreferHtml, optSubscript, optSpacing].forEach(el => {
        el.addEventListener('change', () => {
          savePrefs();
          runTransform(false);
        });
      });
    })();
  </script>
</body>
</html>
`;

const outPath = path.join(dir, 'index.html');
fs.writeFileSync(outPath, htmlTemplate, 'utf8');
console.log('Successfully built upgraded public site:', outPath);
