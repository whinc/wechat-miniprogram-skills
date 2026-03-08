---
name: miniprogram-ci
description: Use when the user wants to automate WeChat mini-program upload or preview via CI/CD, generate deployment scripts, set up miniprogram-ci workflows, or create preview QR codes automatically. Trigger whenever the user mentions "上传小程序", "预览", "CI 部署", "miniprogram-ci", "自动化上传", "发布小程序版本", "生成预览二维码", or asks to integrate WeChat mini-program with continuous integration pipelines.
---

# 微信小程序 CI 自动化

## 概述

本 skill 帮助生成可直接运行的 Node.js 脚本，用于实现小程序代码的自动预览、打包依赖、上传等操作。脚本基于用户项目配置参数化生成，支持 CI/CD 流水线集成（GitHub Actions、GitLab CI 等）。

**核心职责**：根据用户项目信息生成可重复执行的命令行脚本，用户执行生成的脚本完成实际的部署任务。

---

## Step 1：收集必要信息

执行前先确认以下信息（如用户未提供则逐项询问）：

### 1.1 操作类型

**询问用户：** "你需要哪种能力？"

| 操作 | 说明 | 适用场景 |
|------|------|----------|
| **打包依赖（pack-npm）** | 构建 npm 依赖至 miniprogram_npm 目录 | 项目使用 npm 模块时需先执行 |
| **预览（preview）** | 生成预览二维码，供开发/测试扫码体验 | 开发阶段快速验证 |
| **上传（upload）** | 上传代码至微信后台版本管理 | 提测、发布新版本 |
| **多个组合** | 同时生成多个脚本 | 完整 CI 流程（先 pack-npm，再 preview/upload） |

### 1.2 编译产物目录

小程序编译后的输出目录路径，`miniprogram-ci` 需要指向该目录。

**常见路径：**
- Taro 项目：`dist/`
- 原生项目：项目根目录或 `miniprogram/`
- uni-app：`dist/build/mp-weixin/`

**询问用户：** "请确认小程序编译产物目录（默认 `dist/`）："

检查目录是否存在：
```bash
ls <编译产物目录>/project.config.json 2>/dev/null || echo "目录不存在或缺少 project.config.json"
```

### 1.3 包管理器

**询问用户（若无法判断）：** "项目使用哪个包管理器？"

也可通过以下方式自动判断：
```bash
[ -f pnpm-lock.yaml ] && echo "pnpm" || \
[ -f yarn.lock ]      && echo "yarn" || \
echo "npm"
```

### 1.4 现有脚本检查

检查 `scripts/` 目录下是否已存在相关脚本：
```bash
ls scripts/preview.js scripts/upload.js scripts/ci-*.js 2>/dev/null || echo "需要创建"
```

---

## Step 2：前置条件检查

### 2.1 安装 miniprogram-ci

```bash
ls node_modules/miniprogram-ci 2>/dev/null && echo "已安装" || echo "未安装"
```

若未安装，根据包管理器安装：
```bash
# pnpm
pnpm add miniprogram-ci --save-dev
# npm
npm install miniprogram-ci --save-dev
# yarn
yarn add miniprogram-ci --dev
```

### 2.2 获取上传密钥

**告知用户获取路径：**
1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 进入：开发管理 → 开发设置 → 小程序代码上传
3. 点击「生成」下载密钥文件（`private.*.key`）

**安全提醒：**
- ❌ 密钥文件**绝对不能**提交到代码仓库
- ✅ 在 `.gitignore` 中添加 `*.key` 和 `private.*.key`
- ✅ 在 CI/CD 中使用 secrets 管理密钥内容

### 2.3 配置 IP 白名单

**告知用户：**
- 微信公众平台 → 开发设置 → 小程序代码上传 → IP 白名单
- 添加 CI 服务器的出口 IP
- 本地开发可临时关闭白名单，但生产环境**强烈建议开启**

---

## Step 3：创建脚本

根据用户选择的操作类型，创建对应脚本。以下模板使用环境变量读取敏感配置，支持 CI/CD 集成。

### 3.1 打包依赖脚本模板

若项目使用 npm 模块且用户需要**打包依赖**能力，创建 `scripts/pack-npm.js`：

```js
#!/usr/bin/env node

/**
 * 微信小程序 NPM 打包脚本
 * 使用 miniprogram-ci 构建 npm 依赖至 miniprogram_npm 目录
 *
 * 环境变量：
 *   MP_APPID        - 小程序 AppID（必填）
 *   MP_PROJECT_PATH - 编译产物目录（必填）
 *
 * 用法：
 *   node scripts/pack-npm.js
 */

const ci = require('miniprogram-ci');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  appid: process.env.MP_APPID,
  projectPath: process.env.MP_PROJECT_PATH,
};

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────────

function validateConfig() {
  const required = { MP_APPID: CONFIG.appid, MP_PROJECT_PATH: CONFIG.projectPath };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`❌ 缺少环境变量: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (!fs.existsSync(path.resolve(CONFIG.projectPath))) {
    console.error(`❌ 项目路径不存在: ${CONFIG.projectPath}`);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 校验配置...');
  validateConfig();

  console.log('\n📋 NPM 打包配置:');
  console.log(`   AppID:       ${CONFIG.appid}`);
  console.log(`   项目路径:    ${path.resolve(CONFIG.projectPath)}`);

  const project = new ci.Project({
    appid: CONFIG.appid,
    type: 'miniProgram',
    projectPath: path.resolve(CONFIG.projectPath),
    ignores: ['node_modules/**/*'],
  });

  console.log('\n🚀 打包依赖...');
  try {
    const result = await ci.packNpm(project, {
      reporter: (msg) => console.log(`   ${msg}`),
    });

    console.log('\n✅ NPM 打包完成！');
    console.log(`📦 结果: ${JSON.stringify(result)}`);
  } catch (err) {
    console.error(`\n❌ NPM 打包失败: ${err.message}`);
    process.exit(1);
  }
}

main();
```

### 3.2 预览脚本模板

若用户需要**预览**能力，创建 `scripts/preview.js`：

```js
#!/usr/bin/env node

/**
 * 微信小程序预览脚本
 * 使用 miniprogram-ci 生成预览二维码
 *
 * 环境变量：
 *   MP_APPID            - 小程序 AppID（必填）
 *   MP_PRIVATE_KEY_PATH - 上传密钥路径（必填）
 *   MP_PROJECT_PATH     - 编译产物目录（必填）
 *   MP_ROBOT            - 机器人编号 1-30（默认 1）
 *
 * 可选环境变量：
 *   MP_PAGE_PATH        - 预览打开的页面路径
 *   MP_SEARCH_QUERY     - 页面查询参数
 *
 * 用法：
 *   node scripts/preview.js
 *   MP_PAGE_PATH=pages/detail/index MP_SEARCH_QUERY="id=123" node scripts/preview.js
 */

const ci = require('miniprogram-ci');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  appid: process.env.MP_APPID,
  privateKeyPath: process.env.MP_PRIVATE_KEY_PATH,
  projectPath: process.env.MP_PROJECT_PATH,
  robot: parseInt(process.env.MP_ROBOT, 10) || 1,
  pagePath: process.env.MP_PAGE_PATH || '',
  searchQuery: process.env.MP_SEARCH_QUERY || '',
  outputDir: path.resolve(process.cwd(), 'ci-artifacts/previews'),
};

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────────

function validateConfig() {
  const required = { MP_APPID: CONFIG.appid, MP_PRIVATE_KEY_PATH: CONFIG.privateKeyPath, MP_PROJECT_PATH: CONFIG.projectPath };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`❌ 缺少环境变量: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (CONFIG.robot < 1 || CONFIG.robot > 30) {
    console.error('❌ MP_ROBOT 必须在 1-30 之间');
    process.exit(1);
  }
  if (!fs.existsSync(path.resolve(CONFIG.privateKeyPath))) {
    console.error(`❌ 密钥文件不存在: ${CONFIG.privateKeyPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(path.resolve(CONFIG.projectPath))) {
    console.error(`❌ 项目路径不存在: ${CONFIG.projectPath}`);
    process.exit(1);
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ─────────────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 校验配置...');
  validateConfig();

  ensureDir(CONFIG.outputDir);
  const qrcodePath = path.join(CONFIG.outputDir, `preview-${timestamp()}.png`);

  console.log('\n📋 预览配置:');
  console.log(`   AppID:       ${CONFIG.appid}`);
  console.log(`   项目路径:    ${path.resolve(CONFIG.projectPath)}`);
  console.log(`   机器人编号:  ${CONFIG.robot}`);
  if (CONFIG.pagePath) console.log(`   页面路径:    ${CONFIG.pagePath}`);
  if (CONFIG.searchQuery) console.log(`   查询参数:    ${CONFIG.searchQuery}`);
  console.log(`   二维码输出:  ${qrcodePath}`);

  const project = new ci.Project({
    appid: CONFIG.appid,
    type: 'miniProgram',
    projectPath: path.resolve(CONFIG.projectPath),
    privateKeyPath: path.resolve(CONFIG.privateKeyPath),
    ignores: ['node_modules/**/*'],
  });

  console.log('\n🚀 生成预览...');
  try {
    const result = await ci.preview({
      project,
      desc: `Preview by robot ${CONFIG.robot} at ${new Date().toLocaleString()}`,
      setting: { es6: true, es7: true, minify: true, autoPrefixWXSS: true },
      qrcodeFormat: 'image',
      qrcodeOutputDest: qrcodePath,
      robot: CONFIG.robot,
      ...(CONFIG.pagePath && { pagePath: CONFIG.pagePath }),
      ...(CONFIG.searchQuery && { searchQuery: CONFIG.searchQuery }),
    });

    console.log('\n✅ 预览成功！');
    console.log(`📱 二维码: ${qrcodePath}`);
    if (result?.subPackageInfo) {
      console.log('\n📦 包大小:');
      result.subPackageInfo.forEach(p => console.log(`   ${p.name || '主包'}: ${(p.size / 1024 / 1024).toFixed(2)} MB`));
    }
  } catch (err) {
    console.error(`\n❌ 预览失败: ${err.message}`);
    if (err.message.includes('invalid ip')) console.error('💡 请将当前 IP 添加到微信后台白名单');
    process.exit(1);
  }
}

main();
```

### 3.2 上传脚本模板

若用户需要**上传**能力，创建 `scripts/upload.js`：

```js
#!/usr/bin/env node

/**
 * 微信小程序上传脚本
 * 使用 miniprogram-ci 上传代码至微信后台
 *
 * 环境变量：
 *   MP_APPID            - 小程序 AppID（必填）
 *   MP_PRIVATE_KEY_PATH - 上传密钥路径（必填）
 *   MP_PROJECT_PATH     - 编译产物目录（必填）
 *   MP_ROBOT            - 机器人编号 1-30（默认 1）
 *
 * 命令行参数：
 *   --version <版本号>  必填
 *   --desc <描述>       必填
 *   --pack-npm          可选，上传前执行 npm 构建
 *
 * 用法：
 *   node scripts/upload.js --version 1.0.0 --desc "修复登录问题"
 *   node scripts/upload.js --version 1.0.0 --desc "新功能" --pack-npm
 */

const ci = require('miniprogram-ci');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// 配置
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  appid: process.env.MP_APPID,
  privateKeyPath: process.env.MP_PRIVATE_KEY_PATH,
  projectPath: process.env.MP_PROJECT_PATH,
  robot: parseInt(process.env.MP_ROBOT, 10) || 1,
  outputDir: path.resolve(process.cwd(), 'ci-artifacts/uploads'),
};

// ─────────────────────────────────────────────────────────────────────────────
// 命令行解析
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { version: null, desc: null, packNpm: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version' && args[i + 1]) result.version = args[++i];
    else if (args[i] === '--desc' && args[i + 1]) result.desc = args[++i];
    else if (args[i] === '--pack-npm') result.packNpm = true;
    else if (args[i] === '--help' || args[i] === '-h') { printHelp(); process.exit(0); }
  }
  return result;
}

function printHelp() {
  console.log(`
用法: node scripts/upload.js [选项]

选项:
  --version <版本号>   必填，如 1.0.0
  --desc <描述>        必填，版本描述
  --pack-npm           上传前执行 npm 构建
  --help               显示帮助
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────────

function validateConfig() {
  const required = { MP_APPID: CONFIG.appid, MP_PRIVATE_KEY_PATH: CONFIG.privateKeyPath, MP_PROJECT_PATH: CONFIG.projectPath };
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`❌ 缺少环境变量: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (CONFIG.robot < 1 || CONFIG.robot > 30) {
    console.error('❌ MP_ROBOT 必须在 1-30 之间');
    process.exit(1);
  }
  if (!fs.existsSync(path.resolve(CONFIG.privateKeyPath))) {
    console.error(`❌ 密钥文件不存在: ${CONFIG.privateKeyPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(path.resolve(CONFIG.projectPath))) {
    console.error(`❌ 项目路径不存在: ${CONFIG.projectPath}`);
    process.exit(1);
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function saveResult(result, args) {
  ensureDir(CONFIG.outputDir);
  const filename = `upload-${args.version}-${timestamp()}.json`;
  const filepath = path.join(CONFIG.outputDir, filename);
  const data = {
    timestamp: new Date().toISOString(),
    version: args.version,
    desc: args.desc,
    robot: CONFIG.robot,
    result,
  };
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`📄 结果已保存: ${filepath}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  if (!args.version) { console.error('❌ 必须指定 --version'); process.exit(1); }
  if (!args.desc) { console.error('❌ 必须指定 --desc'); process.exit(1); }

  console.log('🔍 校验配置...');
  validateConfig();

  console.log('\n📋 上传配置:');
  console.log(`   AppID:       ${CONFIG.appid}`);
  console.log(`   项目路径:    ${path.resolve(CONFIG.projectPath)}`);
  console.log(`   机器人编号:  ${CONFIG.robot}`);
  console.log(`   版本号:      ${args.version}`);
  console.log(`   版本描述:    ${args.desc}`);
  console.log(`   packNpm:     ${args.packNpm ? '是' : '否'}`);

  const project = new ci.Project({
    appid: CONFIG.appid,
    type: 'miniProgram',
    projectPath: path.resolve(CONFIG.projectPath),
    privateKeyPath: path.resolve(CONFIG.privateKeyPath),
    ignores: ['node_modules/**/*'],
  });

  if (args.packNpm) {
    console.log('\n📦 执行 npm 构建...');
    try {
      await ci.packNpm(project, { reporter: console.log });
      console.log('✅ npm 构建完成');
    } catch (err) {
      console.error(`❌ npm 构建失败: ${err.message}`);
      process.exit(1);
    }
  }

  console.log('\n🚀 上传代码...');
  try {
    const result = await ci.upload({
      project,
      version: args.version,
      desc: args.desc,
      robot: CONFIG.robot,
      setting: { es6: true, es7: true, minify: true, autoPrefixWXSS: true },
      onProgressUpdate: console.log,
    });

    console.log('\n✅ 上传成功！');
    if (result?.subPackageInfo) {
      console.log('\n📦 包大小:');
      result.subPackageInfo.forEach(p => console.log(`   ${p.name || '主包'}: ${(p.size / 1024 / 1024).toFixed(2)} MB`));
    }
    saveResult({ success: true, ...result }, args);
  } catch (err) {
    console.error(`\n❌ 上传失败: ${err.message}`);
    if (err.message.includes('invalid ip')) console.error('💡 请将当前 IP 添加到微信后台白名单');
    saveResult({ success: false, error: err.message }, args);
    process.exit(1);
  }
}

main();
```

---

## Step 4：注册 npm scripts

在 `package.json` 的 `scripts` 中添加（根据用户选择的操作）：

```json
{
  "scripts": {
    "ci:pack-npm": "node scripts/pack-npm.js",
    "ci:preview": "node scripts/preview.js",
    "ci:upload": "node scripts/upload.js",
    "ci:upload:npm": "node scripts/upload.js --pack-npm"
  }
}
```

---

## Step 5：环境变量配置指引

### 本地开发

创建 `.env` 文件（需配合 `dotenv` 或 shell `source`）：

```env
MP_APPID=wx1234567890abcdef
MP_PRIVATE_KEY_PATH=./private.wxXXXX.key
MP_PROJECT_PATH=./dist
MP_ROBOT=1
```

**提醒用户：** 将 `.env` 和 `*.key` 添加到 `.gitignore`。

### CI/CD 配置（GitHub Actions 示例）

```yaml
name: Deploy Mini Program

on:
  push:
    tags:
      - 'v*'

jobs:
  upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Write private key
        run: echo "${{ secrets.MP_PRIVATE_KEY }}" > private.key

      - name: Upload to WeChat
        env:
          MP_APPID: ${{ secrets.MP_APPID }}
          MP_PRIVATE_KEY_PATH: ./private.key
          MP_PROJECT_PATH: ./dist
          MP_ROBOT: 1
        run: |
          VERSION=${GITHUB_REF_NAME#v}
          npm run ci:upload -- --version "$VERSION" --desc "CI 自动上传"

      - name: Cleanup
        if: always()
        run: rm -f private.key
```

---

## 常见错误处理

| 错误现象 | 原因 | 解决方案 |
|---------|------|---------|
| `invalid ip` | IP 不在白名单 | 微信后台添加 IP 或临时关闭白名单 |
| `permission denied` | 密钥无效或无权限 | 重新生成密钥；检查是否有上传权限 |
| `project.config.json not found` | 项目路径错误 | 确认 `MP_PROJECT_PATH` 指向编译产物目录 |
| `Error: getaddrinfo ENOTFOUND` | 网络问题 | 检查代理设置或网络连接 |
| 上传后版本未出现 | robot 编号冲突 | 不同任务使用不同 robot 编号 |

---

## 脚本参数速查

### preview.js

| 环境变量 | 必填 | 说明 |
|---------|------|------|
| `MP_APPID` | ✅ | 小程序 AppID |
| `MP_PRIVATE_KEY_PATH` | ✅ | 密钥文件路径 |
| `MP_PROJECT_PATH` | ✅ | 编译产物目录 |
| `MP_ROBOT` | ❌ | 机器人编号（默认 1） |
| `MP_PAGE_PATH` | ❌ | 预览打开的页面 |
| `MP_SEARCH_QUERY` | ❌ | 页面查询参数 |

### upload.js

| 参数 | 必填 | 说明 |
|------|------|------|
| `--version <v>` | ✅ | 版本号 |
| `--desc <d>` | ✅ | 版本描述 |
| `--pack-npm` | ❌ | 上传前执行 npm 构建 |

---

## 安全检查清单

在交付脚本前，提醒用户确认：

- [ ] `*.key` 和 `.env` 已添加到 `.gitignore`
- [ ] 生产环境已开启 IP 白名单
- [ ] CI/CD 中密钥通过 secrets 管理，而非明文
- [ ] `ci-artifacts/` 目录已添加到 `.gitignore`（如包含敏感日志）
