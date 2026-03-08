# 微信小程序上传脚本 — 使用说明

## 前置条件

### 1. 安装 miniprogram-ci

`miniprogram-demo` 项目的 `package.json` 已包含 `miniprogram-ci` 依赖（`^1.3.13`），确保已执行：

```bash
cd miniprogram-demo/
npm install
```

若未安装，手动添加：

```bash
npm install miniprogram-ci --save
```

### 2. 获取上传密钥

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 进入：**开发管理 → 开发设置 → 小程序代码上传**
3. 点击「生成」下载密钥文件（`private.<appid>.key`）
4. 将密钥文件放置到安全位置，通过 `MP_PRIVATE_KEY_PATH` 环境变量指定路径

### 3. 配置 IP 白名单

- 微信公众平台 → 开发设置 → 小程序代码上传 → **IP 白名单**
- 添加执行脚本的机器出口 IP
- 本地开发可临时关闭白名单，但**生产环境强烈建议开启**

### 4. 确认项目结构

`miniprogram-demo` 是原生小程序项目，`project.config.json` 位于 `miniprogram-demo/` 根目录，`miniprogramRoot` 为 `miniprogram/`。因此 `MP_PROJECT_PATH` 应指向 `miniprogram-demo/` 目录。

---

## 安全注意事项

- **密钥文件绝不能提交到代码仓库**，在 `.gitignore` 中添加：
  ```
  *.key
  private.*.key
  ```
- **`.env` 文件不要提交**，在 `.gitignore` 中添加 `.env`
- **`ci-artifacts/` 目录建议添加到 `.gitignore`**（可能包含敏感的上传日志）：
  ```
  ci-artifacts/
  ```
- **CI/CD 环境中**，密钥内容应通过 secrets 管理（如 GitHub Secrets），运行时写入临时文件，用完即删
- **上传脚本包含超时重试逻辑**（最多 3 次），应对 CI 环境下跨境网络不稳定

---

## 环境变量说明

| 环境变量 | 必填 | 说明 | 示例值 |
|---------|------|------|--------|
| `MP_APPID` | 是 | 小程序 AppID | `wxe5f52902cf4de896` |
| `MP_PRIVATE_KEY_PATH` | 是 | 上传密钥文件路径 | `./private.wxe5f52902cf4de896.key` |
| `MP_PROJECT_PATH` | 是 | 小程序项目目录（含 project.config.json） | `./miniprogram-demo` |
| `MP_ROBOT` | 否 | 机器人编号 1-30，默认 1 | `1` |

## 命令行参数说明

| 参数 | 必填 | 说明 |
|------|------|------|
| `--version <版本号>` | 是 | 上传版本号，如 `1.0.0` |
| `--desc <描述>` | 是 | 版本描述 |
| `--pack-npm` | 否 | 上传前执行 npm 依赖构建 |
| `--help` / `-h` | 否 | 显示帮助信息 |

---

## 使用示例

### 本地执行

```bash
# 基本上传
MP_APPID=wxe5f52902cf4de896 \
MP_PRIVATE_KEY_PATH=./private.wxe5f52902cf4de896.key \
MP_PROJECT_PATH=./miniprogram-demo \
MP_ROBOT=1 \
node upload.js --version 1.0.0 --desc "修复登录问题"

# 上传前执行 npm 构建
MP_APPID=wxe5f52902cf4de896 \
MP_PRIVATE_KEY_PATH=./private.wxe5f52902cf4de896.key \
MP_PROJECT_PATH=./miniprogram-demo \
MP_ROBOT=2 \
node upload.js --version 1.1.0 --desc "新增功能" --pack-npm
```

### 使用 .env 文件（需配合 shell source）

创建 `.env` 文件：

```env
export MP_APPID=wxe5f52902cf4de896
export MP_PRIVATE_KEY_PATH=./private.wxe5f52902cf4de896.key
export MP_PROJECT_PATH=./miniprogram-demo
export MP_ROBOT=1
```

执行：

```bash
source .env && node upload.js --version 1.0.0 --desc "版本描述"
```

---

## package.json scripts 示例

在 `miniprogram-demo/package.json` 的 `scripts` 中添加：

```json
{
  "scripts": {
    "ci:upload": "node upload.js",
    "ci:upload:npm": "node upload.js --pack-npm"
  }
}
```

使用方式：

```bash
# 仅上传
MP_APPID=wxe5f52902cf4de896 \
MP_PRIVATE_KEY_PATH=./private.wxe5f52902cf4de896.key \
MP_PROJECT_PATH=./miniprogram-demo \
npm run ci:upload -- --version 1.0.0 --desc "修复问题"

# 先构建 npm 依赖再上传
MP_APPID=wxe5f52902cf4de896 \
MP_PRIVATE_KEY_PATH=./private.wxe5f52902cf4de896.key \
MP_PROJECT_PATH=./miniprogram-demo \
npm run ci:upload:npm -- --version 1.0.0 --desc "新功能上线"
```

> **注意**：使用 `npm run` 时，`--` 后面的参数才会传递给脚本。

---

## 上传结果

脚本执行后，上传结果会自动保存到 `ci-artifacts/uploads/` 目录，文件格式为 JSON：

```
ci-artifacts/uploads/upload-v1.0.0-2026-03-08T10-30-00.json
```

文件内容示例：

```json
{
  "timestamp": "2026-03-08T10:30:00.000Z",
  "version": "1.0.0",
  "desc": "修复登录问题",
  "robot": 1,
  "appid": "wxe5f52902cf4de896",
  "projectPath": "/absolute/path/to/miniprogram-demo",
  "result": {
    "success": true,
    "subPackageInfo": [
      { "name": "__APP__", "size": 1048576 }
    ]
  }
}
```

---

## 常见错误排查

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `invalid ip` | 当前 IP 不在白名单 | 在微信后台添加 IP 或临时关闭白名单 |
| `permission denied` | 密钥无效或无权限 | 重新生成密钥；检查账号是否有上传权限 |
| `project.config.json not found` | `MP_PROJECT_PATH` 指向错误 | 确认路径指向包含 `project.config.json` 的目录 |
| `Error: getaddrinfo ENOTFOUND` | 网络问题 | 检查网络连接和代理设置 |
| 上传后版本未出现 | robot 编号冲突 | 不同 CI 任务使用不同 robot 编号（1-30） |
| 上传超时 `timeout` / `undefined` | CI 环境网络不稳定 | 脚本已内置重试逻辑（最多 3 次） |
