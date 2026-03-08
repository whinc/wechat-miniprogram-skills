# 微信小程序 GitHub Actions 自动上传 — 配置说明

## 文件概览

| 文件 | 说明 |
|------|------|
| `deploy.yml` | GitHub Actions workflow 配置，放到 `.github/workflows/deploy.yml` |
| `upload.js` | 上传脚本，放到 `scripts/upload.js` |

---

## 一、GitHub Secrets 配置（必须）

在仓库 **Settings → Secrets and variables → Actions** 中添加：

| Secret 名称 | 说明 | 获取方式 |
|-------------|------|---------|
| `MP_APPID` | 小程序 AppID | 微信公众平台 → 开发管理 → 开发设置 |
| `MP_PRIVATE_KEY` | 上传密钥文件**完整内容** | 微信公众平台 → 开发管理 → 开发设置 → 小程序代码上传 → 生成密钥，下载后复制文件全部内容 |

> `GITHUB_TOKEN` 由 GitHub 自动提供，无需手动配置。workflow 中已声明 `permissions: contents: write` 以获得创建 Release 和 Tag 的权限。

---

## 二、IP 白名单配置

微信公众平台要求上传代码的 IP 在白名单内。

### GitHub Actions 出口 IP

GitHub Actions 使用动态 IP，有两种处理方式：

1. **临时关闭白名单**（简单但安全性较低）
   - 微信公众平台 → 开发设置 → 小程序代码上传 → 关闭 IP 白名单

2. **使用固定 IP 代理**（推荐生产环境使用）
   - 使用 `haythem/public-ip@v1` Action 获取当前 runner IP
   - 通过微信 API 动态添加白名单
   - 或使用 GitHub Enterprise 的固定 IP runner

---

## 三、触发方式

### 3.1 自动触发

Push 到 `main` 分支时自动执行：
- 版本号自动生成，格式 `YYYYMMDD.HHMMSS-<短SHA>`
- 版本描述取最近一次 commit message

### 3.2 手动触发

在 GitHub 仓库页面：**Actions → Deploy Mini Program → Run workflow**

可自定义：
- **version**：版本号（如 `1.2.0`），留空则自动生成
- **desc**：版本描述，默认为 "CI 自动上传"

---

## 四、工作流执行步骤

1. **检出代码** — 完整 git 历史（用于生成 changelog）
2. **安装 pnpm** — 使用 `pnpm/action-setup@v4`
3. **安装 Node.js** — v18，自动缓存 pnpm 依赖
4. **安装依赖** — `pnpm install --frozen-lockfile`
5. **构建 Taro** — `pnpm run build:weapp`
6. **生成版本号** — 手动指定或自动生成
7. **生成版本描述** — 手动指定或从 commit message 提取
8. **写入密钥** — 从 secrets 写入临时文件
9. **上传小程序** — 执行 `upload.js`（含重试机制）
10. **清理密钥** — `always()` 确保执行
11. **创建 Release** — 自动创建 tag 和 GitHub Release

---

## 五、pnpm 缓存处理

workflow 通过 `actions/setup-node@v4` 内置的 pnpm 缓存功能实现：

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '18'
    cache: 'pnpm'
    cache-dependency-path: miniprogram-demo/pnpm-lock.yaml
```

首次运行后，后续运行会自动命中缓存，显著加速 `pnpm install` 步骤。

---

## 六、网络超时处理

`upload.js` 内置了指数退避重试机制：

| 配置 | 值 | 说明 |
|------|-----|------|
| 最大重试次数 | 3 | 首次失败后最多重试 2 次 |
| 首次重试延迟 | 5s | 第一次失败后等待 5 秒 |
| 退避倍数 | 2x | 第二次等待 10s，第三次等待 20s |
| 可重试错误 | ENOTFOUND, ECONNRESET, ETIMEDOUT 等 | 仅网络类错误触发重试 |
| 超时时间 | 120000ms | 可通过 `CI_TIMEOUT` 环境变量调整 |

非网络类错误（如权限错误、配置错误）不会触发重试，直接失败退出。

---

## 七、GitHub Release 说明

上传成功后自动创建 GitHub Release，包含：
- Tag 名称：`v<版本号>`
- Release 标题：版本号
- Release body：版本描述、上传时间、触发方式、commit SHA、变更记录
- 变更记录从上一个 tag 到当前 HEAD 的 commit log 自动生成

---

## 八、并发控制

workflow 使用 `concurrency` 配置，同一分支同时只运行一个部署任务：

```yaml
concurrency:
  group: deploy-miniprogram-${{ github.ref }}
  cancel-in-progress: true
```

当新的 push 触发时，会自动取消正在运行的旧部署。

---

## 九、安全检查清单

- [ ] `MP_APPID` 和 `MP_PRIVATE_KEY` 已配置到 GitHub Secrets
- [ ] 密钥文件（`*.key`）已添加到 `.gitignore`
- [ ] `.env` 已添加到 `.gitignore`
- [ ] IP 白名单已处理（关闭或添加 runner IP）
- [ ] `ci-artifacts/` 目录已添加到 `.gitignore`

---

## 十、Taro 构建命令说明

workflow 中使用 `pnpm run build:weapp` 作为 Taro 构建命令。如果项目中实际的构建脚本名称不同，请修改 `deploy.yml` 中对应步骤：

```yaml
- name: Build Taro project
  working-directory: miniprogram-demo
  run: pnpm run build:weapp  # ← 修改为实际的构建命令
```

常见 Taro 构建命令：
- `pnpm run build:weapp` — Taro 默认微信小程序构建
- `pnpm run build` — 自定义构建脚本
- `npx taro build --type weapp` — 直接调用 Taro CLI

---

## 十一、常见问题排查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `invalid ip` | CI 服务器 IP 不在白名单 | 关闭白名单或添加 runner IP |
| `permission denied` | 密钥无效 | 重新生成密钥，更新 Secret |
| `project.config.json not found` | 编译产物目录不正确 | 确认 Taro 输出到 `dist/` 目录 |
| `ENOTFOUND` / `ETIMEDOUT` | 网络超时 | 脚本会自动重试，如持续失败检查 GitHub 网络状况 |
| Release 创建失败 | 权限不足 | 确认 workflow 中 `permissions: contents: write` |
| pnpm 缓存未命中 | lockfile 路径不对 | 确认 `cache-dependency-path` 指向正确的 `pnpm-lock.yaml` |
