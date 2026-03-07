---
name: miniprogram-screenshot
description: Use when the user wants to take screenshots of WeChat mini-program pages, capture page visuals, do automated UI snapshots, preview all pages, or verify the visual appearance of the app. Trigger whenever the user mentions "截图", "screenshot", "截屏", "页面快照", "预览页面", or asks to capture the visual state of any mini-program pages.
---

# 微信小程序自动化截图

## 概述

使用 `miniprogram-automator` 对小程序各页面进行自动截图，输出 PNG 文件和索引清单。截图仅支持**开发者工具模拟器**（不支持真机）。

---

## Step 1：收集必要信息

执行截图前，先确认以下信息（如用户未提供则逐项询问）：

### 1.1 编译产物目录

小程序编译后的输出目录路径，`miniprogram-automator` 需要指向该目录。

**常见路径：**
- Taro 项目：`dist/`
- 其他框架：`build/`、`miniprogram/` 等

**询问用户：** "请确认小程序编译产物目录（默认 `dist/`）："

检查目录是否存在：
```bash
ls <编译产物目录>/ 2>/dev/null || echo "目录不存在，请先编译项目"
```

### 1.2 包管理器

**询问用户（若无法判断）：** "项目使用哪个包管理器？"

也可通过以下方式自动判断：
```bash
# 检测项目使用的包管理器
[ -f pnpm-lock.yaml ] && echo "pnpm" || \
[ -f yarn.lock ]      && echo "yarn" || \
echo "npm"
```

### 1.3 截图页面列表

需要截图的页面列表，每个页面包含：
- `id`：文件名前缀（如 `home`）
- `name`：页面中文名
- `path`：小程序页面路径（如 `/pages/home/index`）
- `query`：可选的 query 参数（如 `id=foo`，没有则留空）

**获取方式：**
1. 若项目有 `src/app.config.ts` / `app.json`，读取 `pages` 字段自动推导
2. 若项目有 `project.private.config.json`，读取 `condition.miniprogram.list` 获取调试配置
3. 否则询问用户提供页面列表

### 1.4 截图脚本是否已存在

检查 `scripts/screenshot.js` 是否已存在：
```bash
ls scripts/screenshot.js 2>/dev/null && echo "已存在" || echo "需要创建"
```

---

## Step 2：前置条件检查

### 检查 miniprogram-automator

```bash
ls node_modules/miniprogram-automator 2>/dev/null && echo "已安装" || echo "未安装"
```

若未安装，根据包管理器安装：
```bash
# pnpm
pnpm add miniprogram-automator --save-dev
# npm
npm install miniprogram-automator --save-dev
# yarn
yarn add miniprogram-automator --dev
```

### 检查开发者工具 CLI 路径

macOS 默认路径：`/Applications/wechatwebdevtools.app/Contents/MacOS/cli`

**若路径不同，询问用户确认：** "微信开发者工具的 CLI 路径是否为默认路径？"

```bash
ls "/Applications/wechatwebdevtools.app/Contents/MacOS/cli" 2>/dev/null && echo "存在" || echo "路径不同，需确认"
```

### 确认开发者工具服务端口已开启

提醒用户检查：**开发者工具 → 设置 → 安全设置 → 开启服务端口**

---

## Step 3：创建或更新截图脚本

若 `scripts/screenshot.js` 不存在，创建它；若已存在，根据收集到的页面列表更新 `PAGES` 数组。

脚本模板如下，将 `PAGES`、`cliPath`、`projectPath` 替换为实际值：

```js
#!/usr/bin/env node

/**
 * 微信小程序自动化截图脚本
 * 使用 miniprogram-automator 对小程序各页面进行自动截图
 *
 * 用法:
 *   node scripts/screenshot.js
 *   node scripts/screenshot.js --output screenshots/custom
 *   node scripts/screenshot.js --pages home,detail
 *   node scripts/screenshot.js --delay 2000
 */

import automator from 'miniprogram-automator';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

const CONFIG = {
  cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  projectPath: path.join(PROJECT_ROOT, '<编译产物目录>'),
  outputDir: path.join(PROJECT_ROOT, 'screenshots'),
  pageDelay: 1500,
  launchDelay: 2000,
};

// ← 根据项目实际页面填写
const PAGES = [
  { id: 'home', name: '首页', path: '/pages/home/index', query: '' },
  // 继续添加其他页面...
];

// ── 以下为通用逻辑，无需修改 ────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' && args[i + 1]) options.outputDir = path.resolve(args[++i]);
    else if (args[i] === '--pages' && args[i + 1]) options.pageFilter = args[++i].split(',').map(s => s.trim());
    else if (args[i] === '--delay' && args[i + 1]) options.pageDelay = parseInt(args[++i], 10);
    else if (args[i] === '--help' || args[i] === '-h') { printHelp(); process.exit(0); }
  }
  return options;
}

function printHelp() {
  console.log(`
用法: node scripts/screenshot.js [选项]
  --output <dir>    截图输出目录（默认: screenshots/）
  --pages <ids>     只截指定页面，逗号分隔（可用: ${PAGES.map(p => p.id).join(', ')}）
  --delay <ms>      每页等待时间（默认: 1500）
  --help            显示帮助
`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildUrl(page) { return page.query ? `${page.path}?${page.query}` : page.path; }

function formatTimestamp() {
  return new Date().toISOString().replace('T', '_').replace(/:/g, '-').replace(/\.\d{3}Z$/, '');
}

async function screenshotPage(miniProgram, page, outputDir) {
  const url = buildUrl(page);
  console.log(`\n📸 [${page.id}] ${page.name}  →  ${url}`);
  try {
    await miniProgram.reLaunch(url);
    await sleep(CONFIG.pageDelay);
    const filepath = path.join(outputDir, `${page.id}.png`);
    await miniProgram.screenshot({ path: filepath });
    const sizeKB = (fs.statSync(filepath).size / 1024).toFixed(1);
    console.log(`   ✅ ${page.id}.png (${sizeKB} KB)`);
    return { id: page.id, name: page.name, success: true, path: filepath };
  } catch (error) {
    console.error(`   ❌ ${error.message}`);
    return { id: page.id, name: page.name, success: false, error: error.message };
  }
}

async function main() {
  const opts = parseArgs();
  const outputDir = opts.outputDir || CONFIG.outputDir;
  if (opts.pageDelay) CONFIG.pageDelay = opts.pageDelay;

  let targetPages = PAGES;
  if (opts.pageFilter) {
    targetPages = PAGES.filter(p => opts.pageFilter.includes(p.id));
    if (!targetPages.length) {
      console.error(`❌ 未找到页面: ${opts.pageFilter.join(', ')}`);
      process.exit(1);
    }
  }

  const sessionDir = path.join(outputDir, formatTimestamp());
  fs.mkdirSync(sessionDir, { recursive: true });

  console.log('🚀 微信小程序自动化截图');
  console.log(`📁 输出: ${sessionDir}  |  📋 页面: ${targetPages.length} 个  |  ⏱ 等待: ${CONFIG.pageDelay}ms`);

  if (!fs.existsSync(CONFIG.projectPath)) {
    console.error(`\n❌ 编译产物不存在: ${CONFIG.projectPath}\n   请先编译项目`);
    process.exit(1);
  }

  let miniProgram;
  try {
    console.log('\n⚙️  连接开发者工具...');
    miniProgram = await automator.launch({ cliPath: CONFIG.cliPath, projectPath: CONFIG.projectPath });
    console.log('✅ 连接成功');
    await sleep(CONFIG.launchDelay);

    const results = [];
    for (const page of targetPages) {
      results.push(await screenshotPage(miniProgram, page, sessionDir));
    }

    try { await miniProgram.reLaunch(PAGES[0].path); } catch { /* ignore */ }

    const ok = results.filter(r => r.success).length;
    const fail = results.length - ok;
    console.log(`\n📊 完成：成功 ${ok}/${results.length}`);
    if (fail) results.filter(r => !r.success).forEach(r => console.log(`   ✗ [${r.id}] ${r.error}`));

    fs.writeFileSync(
      path.join(sessionDir, 'index.json'),
      JSON.stringify({ total: results.length, success: ok, failed: fail, pages: results }, null, 2)
    );
    console.log(`📁 截图已保存至: ${sessionDir}\n`);
    if (fail) process.exit(1);
  } catch (error) {
    console.error(`\n❌ 执行失败: ${error.message}`);
    if (error.message.includes('cli')) {
      console.error('💡 请确认开发者工具已启动，且"安全设置"中已开启服务端口');
    }
    process.exit(1);
  } finally {
    if (miniProgram) await miniProgram.close();
  }
}

main();
```

---

## Step 4：（可选）注册 npm script

如用户希望通过 `npm run screenshot` 运行，在 `package.json` 的 `scripts` 中添加：

```json
"screenshot": "node scripts/screenshot.js"
```

---

## 输出结构

```
screenshots/
└── 2026-03-07_11-45-00/
    ├── <page-id>.png     ← 每个页面一张 PNG
    ├── ...
    └── index.json        ← 摘要（成功/失败状态）
```

---

## 常见错误处理

| 错误现象 | 原因 | 解决方案 |
|---------|------|---------|
| `cli` 相关错误 | 开发者工具未启动或服务端口未开启 | 安全设置 → 开启服务端口 |
| 编译产物目录不存在 | 项目未编译 | 先编译项目再运行截图 |
| 截图全黑 / 空白 | 页面渲染未完成 | 增加 `--delay`，如 `--delay 3000` |
| 部分页面截图失败 | 页面路径或 query 参数有误 | 检查 `PAGES` 中的 `path` 和 `query` |
| `Cannot find package 'miniprogram-automator'` | 包未安装 | 按包管理器安装依赖 |

---

## 脚本参数速查

| 参数 | 说明 | 默认值 |
|------|------|-------|
| `--output <dir>` | 截图保存根目录 | `screenshots/` |
| `--pages <ids>` | 只截指定页面（逗号分隔） | 全部页面 |
| `--delay <ms>` | 每页截图前等待时间 | `1500` |
| `--help` | 显示帮助 | — |
