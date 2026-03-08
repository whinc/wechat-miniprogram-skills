# pnpm + miniprogram-ci 排障指南

## 问题描述

在 pnpm 管理的 Taro 项目中执行 `miniprogram-ci` 相关操作时，报错：

```
Cannot find module 'picocolors'
```

类似的错误还可能表现为：

- `Cannot find module 'nanoid/non-secure'`
- `Cannot find module 'cssnano'`
- 其他 miniprogram-ci 的间接依赖找不到

## 根因分析

**pnpm 的严格依赖隔离机制**是根本原因。

pnpm 默认使用基于内容寻址的存储和符号链接的 `node_modules` 结构，每个包只能访问自己 `package.json` 中声明的直接依赖。与 npm/yarn 不同，pnpm 不会将所有依赖平铺（hoist）到根 `node_modules` 目录。

`miniprogram-ci` 内部依赖了 `picocolors`、`nanoid`、`cssnano` 等包，但这些是 miniprogram-ci 自身依赖树中的间接依赖。在 pnpm 的严格隔离下，miniprogram-ci 的某些内部模块通过非标准方式引用这些包时，就会因为无法在当前 symlink 结构中找到它们而报错。

**关键点**：这不是 `miniprogram-ci` 没有安装这些依赖，而是 pnpm 的隔离策略阻止了 miniprogram-ci 内部的非标准模块解析路径。

## 解决方案

### 方案一：shamefully-hoist（推荐）

在项目根目录的 `.npmrc` 文件中添加：

```ini
shamefully-hoist=true
```

然后**必须重新生成 lockfile** 才能生效（仅修改 `.npmrc` 不够）：

```bash
rm pnpm-lock.yaml
CI=true pnpm install
```

**原理**：`shamefully-hoist=true` 会将所有依赖提升到根 `node_modules`，行为类似 npm/yarn 的 flat 模式，使 miniprogram-ci 的内部依赖能被正确解析。

**注意**：此配置会改变整个项目的 `node_modules` 结构，行为等价于 npm/yarn。若项目中有依赖严格隔离来避免"幽灵依赖"的场景，请评估影响。

### 方案二：public-hoist-pattern（精细控制）

如果不想全局 hoist，可以在 `.npmrc` 中单独提升需要的包：

```ini
public-hoist-pattern[]=picocolors
public-hoist-pattern[]=nanoid
public-hoist-pattern[]=cssnano
public-hoist-pattern[]=*miniprogram*
```

同样需要重新生成 lockfile：

```bash
rm pnpm-lock.yaml
CI=true pnpm install
```

**缺点**：miniprogram-ci 的间接依赖较多，可能需要逐个排查并添加，维护成本较高。实践中推荐直接使用 `shamefully-hoist=true`。

## 完整配置步骤

针对 pnpm + Taro 项目，配置 miniprogram-ci 自动上传的完整步骤：

### 1. 配置 .npmrc

确保项目根目录 `.npmrc` 包含：

```ini
shamefully-hoist=true
```

### 2. 重新安装依赖

```bash
rm pnpm-lock.yaml
CI=true pnpm install
```

### 3. 安装 miniprogram-ci

```bash
pnpm add miniprogram-ci --save-dev
```

### 4. 获取上传密钥

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 进入：开发管理 → 开发设置 → 小程序代码上传
3. 点击「生成」下载密钥文件（`private.*.key`）

### 5. 配置 IP 白名单

- 微信公众平台 → 开发设置 → 小程序代码上传 → IP 白名单
- 添加本地/CI 服务器的出口 IP
- 本地开发可临时关闭白名单，但生产环境**强烈建议开启**

### 6. 放置上传脚本

将 `upload.js` 放到 `scripts/` 目录下。

### 7. 注册 npm scripts

在 `package.json` 的 `scripts` 中添加：

```json
{
  "scripts": {
    "ci:upload": "node scripts/upload.js",
    "ci:upload:npm": "node scripts/upload.js --pack-npm"
  }
}
```

### 8. 配置环境变量

创建 `.env` 文件（本地开发使用）：

```env
MP_APPID=wxYOUR_APPID
MP_PRIVATE_KEY_PATH=./private.wxYOUR_APPID.key
MP_PROJECT_PATH=./dist
MP_ROBOT=1
```

### 9. 执行上传

```bash
# 先构建 Taro 项目
pnpm build:weapp

# 然后执行上传
MP_APPID=wxXXXX MP_PRIVATE_KEY_PATH=./private.wxXXXX.key MP_PROJECT_PATH=./dist \
  node scripts/upload.js --version 1.0.0 --desc "版本描述"
```

## 安全检查清单

- [ ] `*.key` 和 `.env` 已添加到 `.gitignore`
- [ ] `ci-artifacts/` 目录已添加到 `.gitignore`
- [ ] 生产环境已开启 IP 白名单
- [ ] CI/CD 中密钥通过 secrets 管理，而非明文写入
- [ ] `.npmrc` 已添加 `shamefully-hoist=true` 并重新生成 lockfile

## 其他常见错误

| 错误现象 | 原因 | 解决方案 |
|---------|------|---------|
| `invalid ip` | IP 不在白名单 | 微信后台添加 IP 或临时关闭白名单 |
| `permission denied` | 密钥无效或无权限 | 重新生成密钥；检查是否有上传权限 |
| `project.config.json not found` | 项目路径错误 | 确认 `MP_PROJECT_PATH` 指向编译产物目录（Taro 项目为 `dist/`） |
| `Error: getaddrinfo ENOTFOUND` | 网络问题 | 检查代理设置或网络连接 |
| 上传后版本未出现 | robot 编号冲突 | 不同任务使用不同 robot 编号 |
| 上传失败: `undefined` / `timeout` | 网络不稳定（CI 环境尤其常见） | 脚本已内置重试逻辑（最多 3 次，间隔 5 秒） |
