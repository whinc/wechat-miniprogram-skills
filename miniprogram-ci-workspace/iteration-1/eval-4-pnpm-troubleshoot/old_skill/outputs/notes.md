# miniprogram-ci 上传配置排查指南（Taro + pnpm）

## 问题描述

在 pnpm 管理的 Taro 项目中执行 miniprogram-ci 相关命令时，报错：

```
Cannot find module 'picocolors'
```

## 根因分析

### pnpm 的严格依赖隔离机制

pnpm 默认使用**严格模式**（`strict`），与 npm/yarn 的扁平化 `node_modules` 结构不同：

- **npm/yarn**：将所有依赖（包括子依赖）扁平化到 `node_modules/` 根目录，任何包都能访问任何其他包（"幽灵依赖"）。
- **pnpm**：只有在 `package.json` 中显式声明的依赖才会出现在 `node_modules/` 根目录；子依赖通过符号链接和 `.pnpm` 目录管理，不会暴露给未声明依赖关系的包。

`picocolors` 是 `miniprogram-ci` 的间接依赖（子依赖的子依赖），在 pnpm 环境下不会被提升到项目 `node_modules` 根目录。当 `miniprogram-ci` 内部某些代码路径通过非标准方式（如动态 `require`）引用 `picocolors` 时，就会在 pnpm 的严格模式下找不到该模块。

### 触发场景

- 使用 `pnpm add miniprogram-ci --save-dev` 安装后，直接运行 `ci.upload()` 或 `ci.preview()` 等操作
- 在 CI/CD 环境中使用 `pnpm install --frozen-lockfile` 后执行上传脚本

## 解决方案

### 方案一：配置 .npmrc 提升 picocolors（推荐）

在项目根目录的 `.npmrc` 文件中添加：

```ini
# 将 miniprogram-ci 的间接依赖 picocolors 提升到 node_modules 根目录
public-hoist-pattern[]=picocolors
```

然后重新安装依赖：

```bash
pnpm install
```

**验证：**

```bash
ls node_modules/picocolors/package.json && echo "picocolors 已正确提升"
```

### 方案二：直接安装 picocolors 为项目依赖

将 `picocolors` 显式添加为项目的 devDependency：

```bash
pnpm add picocolors --save-dev
```

这种方式简单直接，但本质上是在绕过问题——`picocolors` 并非项目直接使用的依赖。

### 方案三：使用 pnpm 的 shamefully-hoist 模式（不推荐）

在 `.npmrc` 中设置：

```ini
shamefully-hoist=true
```

然后重新安装：

```bash
pnpm install
```

这会让 pnpm 的行为类似 npm 的扁平化模式，解决所有幽灵依赖问题，但同时也失去了 pnpm 严格隔离带来的安全性优势。**不推荐用于生产项目。**

### 方案四：配置 packageExtensions 声明缺失依赖

在 `package.json` 中添加：

```json
{
  "pnpm": {
    "packageExtensions": {
      "miniprogram-ci": {
        "dependencies": {
          "picocolors": "*"
        }
      }
    }
  }
}
```

然后重新安装：

```bash
pnpm install
```

这是 pnpm 官方推荐的修复方式，本质上是为 `miniprogram-ci` 补充声明它缺失的依赖。

## 推荐操作步骤

1. **修复 picocolors 依赖问题**（选择上述方案一或方案四）
2. **确认 Taro 编译产物**已生成到 `dist/` 目录：
   ```bash
   pnpm build:weapp
   ls dist/project.config.json
   ```
3. **获取上传密钥**：
   - 登录 [微信公众平台](https://mp.weixin.qq.com)
   - 进入：开发管理 → 开发设置 → 小程序代码上传
   - 点击「生成」下载密钥文件
4. **配置环境变量**（创建 `.env` 文件或直接导出）：
   ```bash
   export MP_APPID=你的小程序AppID
   export MP_PRIVATE_KEY_PATH=./private.wxXXXX.key
   export MP_PROJECT_PATH=./dist
   ```
5. **运行上传脚本**：
   ```bash
   node scripts/upload.js --version 1.0.0 --desc "首次 CI 上传"
   ```

## 安全检查清单

- [ ] `*.key` 和 `.env` 已添加到 `.gitignore`
- [ ] 生产环境已开启 IP 白名单
- [ ] CI/CD 中密钥通过 secrets 管理，而非明文
- [ ] `ci-artifacts/` 目录已添加到 `.gitignore`

## 其他常见问题

| 错误现象 | 原因 | 解决方案 |
|---------|------|---------|
| `Cannot find module 'picocolors'` | pnpm 幽灵依赖问题 | 见上述方案一～四 |
| `invalid ip` | IP 不在白名单 | 微信后台添加 IP 或临时关闭白名单 |
| `permission denied` | 密钥无效或无权限 | 重新生成密钥；检查上传权限 |
| `project.config.json not found` | 项目路径错误 | 确认 `MP_PROJECT_PATH` 指向 `dist/` |
| `Error: getaddrinfo ENOTFOUND` | 网络问题 | 检查代理设置或网络连接 |
| 上传后版本未出现 | robot 编号冲突 | 不同任务使用不同 robot 编号（1-30） |
