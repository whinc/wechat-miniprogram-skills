#!/usr/bin/env node

/**
 * 微信小程序上传脚本
 * 基于 miniprogram-ci 将小程序代码上传至微信后台版本管理
 *
 * 环境变量（必填）：
 *   MP_APPID            - 小程序 AppID
 *   MP_PRIVATE_KEY_PATH - 上传密钥文件路径
 *   MP_PROJECT_PATH     - 小程序项目目录（包含 project.config.json 的目录）
 *
 * 环境变量（可选）：
 *   MP_ROBOT            - 机器人编号 1-30（默认 1）
 *
 * 命令行参数：
 *   --version <版本号>  必填，如 1.0.0
 *   --desc <描述>       必填，版本描述
 *   --pack-npm          可选，上传前执行 npm 构建
 *
 * 用法：
 *   node upload.js --version 1.0.0 --desc "修复登录问题"
 *   node upload.js --version 1.2.0 --desc "新增功能" --pack-npm
 *
 * 示例（miniprogram-demo 项目）：
 *   MP_APPID=wxe5f52902cf4de896 \
 *   MP_PRIVATE_KEY_PATH=./private.wxe5f52902cf4de896.key \
 *   MP_PROJECT_PATH=./miniprogram-demo \
 *   MP_ROBOT=1 \
 *   node upload.js --version 1.0.0 --desc "首次上传"
 */

const ci = require('miniprogram-ci');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// 配置（从环境变量读取）
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  appid: process.env.MP_APPID,
  privateKeyPath: process.env.MP_PRIVATE_KEY_PATH,
  projectPath: process.env.MP_PROJECT_PATH,
  robot: parseInt(process.env.MP_ROBOT, 10) || 1,
  outputDir: path.resolve(process.cwd(), 'ci-artifacts/uploads'),
};

// ─────────────────────────────────────────────────────────────────────────────
// 命令行参数解析
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { version: null, desc: null, packNpm: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--version' && args[i + 1]) {
      result.version = args[++i];
    } else if (args[i] === '--desc' && args[i + 1]) {
      result.desc = args[++i];
    } else if (args[i] === '--pack-npm') {
      result.packNpm = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return result;
}

function printHelp() {
  console.log(`
用法: node upload.js [选项]

选项:
  --version <版本号>   必填，如 1.0.0
  --desc <描述>        必填，版本描述
  --pack-npm           上传前执行 npm 构建
  --help, -h           显示帮助

环境变量:
  MP_APPID             小程序 AppID（必填）
  MP_PRIVATE_KEY_PATH  上传密钥路径（必填）
  MP_PROJECT_PATH      小程序项目目录（必填）
  MP_ROBOT             机器人编号 1-30（默认 1）
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 校验
// ─────────────────────────────────────────────────────────────────────────────

function validateEnvConfig() {
  const required = {
    MP_APPID: CONFIG.appid,
    MP_PRIVATE_KEY_PATH: CONFIG.privateKeyPath,
    MP_PROJECT_PATH: CONFIG.projectPath,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    console.error(`❌ 缺少环境变量: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (CONFIG.robot < 1 || CONFIG.robot > 30) {
    console.error('❌ MP_ROBOT 必须在 1-30 之间');
    process.exit(1);
  }

  const resolvedKeyPath = path.resolve(CONFIG.privateKeyPath);
  if (!fs.existsSync(resolvedKeyPath)) {
    console.error(`❌ 密钥文件不存在: ${resolvedKeyPath}`);
    process.exit(1);
  }

  const resolvedProjectPath = path.resolve(CONFIG.projectPath);
  if (!fs.existsSync(resolvedProjectPath)) {
    console.error(`❌ 项目路径不存在: ${resolvedProjectPath}`);
    process.exit(1);
  }

  const configJsonPath = path.join(resolvedProjectPath, 'project.config.json');
  if (!fs.existsSync(configJsonPath)) {
    console.error(`❌ 项目路径下缺少 project.config.json: ${configJsonPath}`);
    process.exit(1);
  }
}

function validateArgs(args) {
  if (!args.version) {
    console.error('❌ 必须指定 --version <版本号>');
    process.exit(1);
  }
  if (!args.desc) {
    console.error('❌ 必须指定 --desc <描述>');
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// ─────────────────────────────────────────────────────────────────────────────
// 上传（含超时重试）
// ─────────────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 上传并在超时时自动重试
 *
 * 微信上传服务器在 CI 环境下可能因网络波动超时，
 * err.message 可能为 "timeout"、"undefined" 或空字符串。
 */
async function uploadWithRetry(project, args) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`\n🔄 第 ${attempt}/${MAX_RETRIES} 次重试上传...`);
        await sleep(RETRY_DELAY_MS);
      }

      return await ci.upload({
        project,
        version: args.version,
        desc: args.desc,
        robot: CONFIG.robot,
        setting: {
          es6: true,
          es7: true,
          minify: true,
          autoPrefixWXSS: true,
        },
        onProgressUpdate: (info) => {
          if (typeof info === 'string') console.log(`   ${info}`);
        },
      });
    } catch (err) {
      const errMsg = err.message || String(err);
      const isTimeout =
        errMsg === 'timeout' || errMsg === 'undefined' || !errMsg;

      if (isTimeout && attempt < MAX_RETRIES) {
        console.warn(
          `\n⚠️  上传超时（第 ${attempt}/${MAX_RETRIES} 次），${RETRY_DELAY_MS / 1000}s 后重试...`
        );
        continue;
      }
      throw err;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 结果落盘
// ─────────────────────────────────────────────────────────────────────────────

function saveResult(result, args) {
  ensureDir(CONFIG.outputDir);
  const filename = `upload-v${args.version}-${timestamp()}.json`;
  const filepath = path.join(CONFIG.outputDir, filename);
  const data = {
    timestamp: new Date().toISOString(),
    version: args.version,
    desc: args.desc,
    robot: CONFIG.robot,
    appid: CONFIG.appid,
    projectPath: path.resolve(CONFIG.projectPath),
    result,
  };
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`📄 上传结果已保存: ${filepath}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 主流程
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  // 校验命令行参数
  validateArgs(args);

  // 校验环境变量和路径
  console.log('🔍 校验配置...');
  validateEnvConfig();

  console.log('\n📋 上传配置:');
  console.log(`   AppID:        ${CONFIG.appid}`);
  console.log(`   项目路径:     ${path.resolve(CONFIG.projectPath)}`);
  console.log(`   密钥路径:     ${path.resolve(CONFIG.privateKeyPath)}`);
  console.log(`   机器人编号:   ${CONFIG.robot}`);
  console.log(`   版本号:       ${args.version}`);
  console.log(`   版本描述:     ${args.desc}`);
  console.log(`   packNpm:      ${args.packNpm ? '是' : '否'}`);
  console.log(`   结果输出目录: ${CONFIG.outputDir}`);

  // 创建 Project 实例
  const project = new ci.Project({
    appid: CONFIG.appid,
    type: 'miniProgram',
    projectPath: path.resolve(CONFIG.projectPath),
    privateKeyPath: path.resolve(CONFIG.privateKeyPath),
    ignores: ['node_modules/**/*'],
  });

  // 按需执行 packNpm
  if (args.packNpm) {
    console.log('\n📦 执行 npm 构建...');
    try {
      const packResult = await ci.packNpm(project, {
        reporter: (msg) => console.log(`   ${msg}`),
      });
      console.log('✅ npm 构建完成');
      if (packResult) {
        console.log(`   构建结果: ${JSON.stringify(packResult)}`);
      }
    } catch (err) {
      console.error(`❌ npm 构建失败: ${err.message}`);
      process.exit(1);
    }
  }

  // 执行上传
  console.log('\n🚀 上传代码...');
  try {
    const result = await uploadWithRetry(project, args);

    console.log('\n✅ 上传成功！');

    // 输出包大小信息
    if (result?.subPackageInfo) {
      console.log('\n📦 包大小:');
      result.subPackageInfo.forEach((p) =>
        console.log(
          `   ${p.name || '主包'}: ${(p.size / 1024 / 1024).toFixed(2)} MB`
        )
      );
    }

    // 落盘上传结果
    saveResult({ success: true, ...result }, args);
  } catch (err) {
    console.error(`\n❌ 上传失败: ${err.message}`);
    if (err.message.includes('invalid ip')) {
      console.error('💡 请将当前 IP 添加到微信公众平台后台的 IP 白名单中');
    }
    // 即使失败也落盘记录
    saveResult({ success: false, error: err.message }, args);
    process.exit(1);
  }
}

main();
