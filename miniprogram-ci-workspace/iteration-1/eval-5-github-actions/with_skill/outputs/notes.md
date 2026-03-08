# 微信小程序 GitHub Actions 自动上传 - 配置说明

## 文件说明

| 文件 | 说明 |
|------|------|
| `deploy.yml` | GitHub Actions workflow 配置，放置于 `.github/workflows/deploy.yml` |
| `upload.js` | miniprogram-ci 上传脚本，放置于 `miniprogram-demo/scripts/upload.js` |

## 前置条件

### 1. 安装 miniprogram-ci

项目使用 pnpm，在 `miniprogram-demo/` 目录下执行：

```bash
pnpm add miniprogram-ci --save-dev
```

### 2. pnpm 项目特殊配置

pnpm 默认启用严格依赖隔离，会导致 `miniprogram-ci` 内部依赖（如 `picocolors`、`nanoid/non-secure`）无法正确解析。

在 `miniprogram-demo/` 目录下创建或修改 `.npmrc`，添加：

```ini
shamefully-hoist=true
```

然后重新生成 lockfile：

```bash
rm pnpm-lock.yaml
CI=true pnpm install
```

### 3. 获取上传密钥

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 进入：开发管理 → 开发设置 → 小程序代码上传
3. 点击「生成」下载密钥文件（`private.*.key`）

### 4. 配置 GitHub Secrets

在仓库 Settings → Secrets and variables → Actions 中添加：

| Secret 名称 | 值 | 说明 |
|---|---|---|
| `MP_PRIVATE_KEY` | 密钥文件完整内容 | 执行 `cat private.wxXXXX.key` 获取 |
| `MP_APPID` | `wxXXXXXXXXXXXXXXXX` | 小程序 AppID |

### 5. 配置 IP 白名单

- 微信公众平台 → 开发设置 → 小程序代码上传 → IP 白名单
- GitHub Actions 使用共享 runner，IP 不固定，建议：
  - **方案 A**：临时关闭 IP 白名单（仅适用于测试阶段）
  - **方案 B**：使用 self-hosted runner 并配置固定出口 IP（生产推荐）

### 6. 注册 npm scripts

在 `miniprogram-demo/package.json` 的 `scripts` 中添加：

```json
{
  "scripts": {
    "build:weapp": "taro build --type weapp",
    "ci:upload": "node scripts/upload.js"
  }
}
```

> 注意：`build:weapp` 命令需根据 Taro 项目实际配置调整。

## Workflow 触发方式

### 自动触发

推送代码到 `main` 分支时自动触发构建和上传。

### 手动触发

在 GitHub 仓库 → Actions → WeChat Mini Program CI → Run workflow，可自定义版本描述。留空则自动生成格式为 `CI 自动发布 YYYYMMDD.commit` 的描述。

## 关键设计说明

### pnpm 缓存

workflow 使用 `pnpm/action-setup@v4` + `actions/setup-node@v4` 配合 `cache: 'pnpm'` 实现依赖缓存，通过 `cache-dependency-path` 指向 `miniprogram-demo/pnpm-lock.yaml`，避免每次重新下载全部依赖。

**注意**：pnpm 必须先于 setup-node 安装，否则 `cache: 'pnpm'` 会报错找不到 pnpm。

### 网络超时重试

`upload.js` 内置了超时重试机制（最多 3 次，间隔 5 秒）。GitHub Actions runner 位于海外，连接微信上传服务器可能出现网络超时，`err.message` 可能为 `"timeout"`、`"undefined"` 或空字符串，脚本会自动识别这些情况并重试。

### GitHub Release 自动创建

上传成功后自动创建 GitHub Release，tag 格式为 `vYYYYMMDD.commit`。workflow 中声明了 `permissions: contents: write`，确保 `GITHUB_TOKEN` 有权限创建 Release。

### 密钥安全

- 密钥通过 GitHub Secrets 注入，运行时写入临时文件
- workflow 的 `Cleanup` step 使用 `if: always()` 确保即使上传失败也会删除密钥文件
- 密钥文件权限设置为 `600`（仅当前用户可读写）

## 安全检查清单

- [ ] `*.key` 和 `.env` 已添加到 `.gitignore`
- [ ] CI/CD 中密钥通过 Secrets 管理，而非明文
- [ ] `ci-artifacts/` 目录已添加到 `.gitignore`
- [ ] `.npmrc` 已添加 `shamefully-hoist=true` 并重新生成 lockfile
- [ ] GitHub Actions workflow 已声明 `permissions: contents: write`
- [ ] `upload.js` 包含超时重试逻辑
- [ ] `pnpm-lock.yaml` 已提交到仓库（`--frozen-lockfile` 依赖此文件）

## 常见错误排查

| 错误现象 | 原因 | 解决方案 |
|---------|------|---------|
| `invalid ip` | IP 不在白名单 | 微信后台添加 IP 或临时关闭白名单 |
| `permission denied` | 密钥无效或无权限 | 重新生成密钥；检查是否有上传权限 |
| `project.config.json not found` | 项目路径错误 | 确认 `MP_PROJECT_PATH` 指向编译产物目录（`dist/`） |
| `Cannot find module 'picocolors'` | pnpm 严格依赖隔离 | `.npmrc` 添加 `shamefully-hoist=true` 并重新安装 |
| 上传超时 `timeout` / `undefined` | GitHub runner 跨境网络不稳定 | 脚本已内置重试逻辑，如仍失败考虑 self-hosted runner |
| 创建 Release 失败 HTTP 403 | 缺少 `contents: write` 权限 | workflow 已声明该权限，检查仓库 Settings → Actions → General 中的权限配置 |
| `--frozen-lockfile` 失败 | `pnpm-lock.yaml` 未提交 | 先在本地执行 `pnpm install` 并提交 lockfile |
