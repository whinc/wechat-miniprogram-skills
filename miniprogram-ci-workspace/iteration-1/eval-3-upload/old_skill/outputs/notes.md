# 微信小程序上传脚本 — 使用说明

## 前置条件

### 1. 安装 miniprogram-ci

`miniprogram-demo/` 项目的 `package.json` 已包含 `miniprogram-ci` 依赖，确保已安装：

```bash
cd miniprogram-demo/
npm install
```

若在项目根目录独立使用脚本，也可单独安装：

```bash
npm install miniprogram-ci --save-dev
```

### 2. 获取上传密钥

1. 登录 [微信公众平台](https://mp.weixin.qq.com)
2. 进入：**开发管理 → 开发设置 → 小程序代码上传**
3. 点击「生成」下载密钥文件（格式为 `private.wxXXXXXX.key`）
4. 将密钥文件保存到项目本地安全位置

### 3. 配置 IP 白名单

- 微信公众平台 → **开发设置 → 小程序代码上传 → IP 白名单**
- 添加执行脚本的机器出口 IP（本地开发 IP 或 CI 服务器 IP）
- 本地开发可临时关闭白名单，但**生产环境强烈建议开启**

### 4. 项目路径说明

`miniprogram-demo/` 是原生小程序项目，其 `project.config.json` 中配置：
- `miniprogramRoot`: `miniprogram/`
- `appid`: `wxe5f52902cf4de896`

使用 miniprogram-ci 时，`MP_PROJECT_PATH` 应指向项目根目录（即 `miniprogram-demo/`），miniprogram-ci 会自动读取 `project.config.json` 中的 `miniprogramRoot` 配置。

---

## 安全注意事项

- **密钥文件绝对不能提交到代码仓库**，确保 `.gitignore` 中包含：
  ```
  *.key
  private.*.key
  .env
  ```
- CI/CD 中密钥应通过 secrets/环境变量注入，**不要明文写在配置文件中**
- `ci-artifacts/` 目录可能包含版本信息，建议也加入 `.gitignore`：
  ```
  ci-artifacts/
  ```
- 不同开发者/CI 任务应使用不同的 `MP_ROBOT` 编号（1-30），避免版本覆盖冲突

---

## 环境变量配置

### 本地开发

可以创建 `.env` 文件（配合 shell `source` 或 `dotenv` 使用）：

```env
MP_APPID=wxe5f52902cf4de896
MP_PRIVATE_KEY_PATH=./private.wxe5f52902cf4de896.key
MP_PROJECT_PATH=./miniprogram-demo
MP_ROBOT=1
```

或者直接在命令行中指定：

```bash
MP_APPID=wxe5f52902cf4de896 \
MP_PRIVATE_KEY_PATH=./private.wxe5f52902cf4de896.key \
MP_PROJECT_PATH=./miniprogram-demo \
MP_ROBOT=1 \
node upload.js --version 1.0.0 --desc "首次上传"
```

### CI/CD 环境（GitHub Actions 示例）

```yaml
- name: Upload to WeChat
  env:
    MP_APPID: ${{ secrets.MP_APPID }}
    MP_PRIVATE_KEY_PATH: ./private.key
    MP_PROJECT_PATH: ./miniprogram-demo
    MP_ROBOT: 1
  run: |
    VERSION=${GITHUB_REF_NAME#v}
    node upload.js --version "$VERSION" --desc "CI 自动上传 $VERSION"
```

---

## package.json scripts 示例

在项目根目录 `package.json` 中添加以下 scripts，方便快捷调用：

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
npm run ci:upload -- --version 1.0.0 --desc "修复登录问题"

# 先 packNpm 再上传
npm run ci:upload:npm -- --version 1.2.0 --desc "新增用户中心功能"
```

如果脚本放在 `scripts/` 子目录下，则路径需要调整：

```json
{
  "scripts": {
    "ci:upload": "node scripts/upload.js",
    "ci:upload:npm": "node scripts/upload.js --pack-npm"
  }
}
```

---

## 上传结果落盘

每次上传（无论成功或失败）的结果会自动保存到 `ci-artifacts/uploads/` 目录，文件名格式：

```
upload-v{version}-{timestamp}.json
```

示例内容：

```json
{
  "timestamp": "2026-03-08T10:30:00.000Z",
  "version": "1.0.0",
  "desc": "首次上传",
  "robot": 1,
  "appid": "wxe5f52902cf4de896",
  "result": {
    "success": true,
    "subPackageInfo": [
      { "name": "__FULL__", "size": 1048576 },
      { "name": "__APP__", "size": 524288 }
    ]
  }
}
```

---

## 常见错误排查

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `invalid ip` | IP 不在白名单 | 微信后台添加 IP 或临时关闭白名单 |
| `permission denied` | 密钥无效或无权限 | 重新生成密钥；确认有上传权限 |
| `project.config.json not found` | 项目路径错误 | 确认 `MP_PROJECT_PATH` 指向包含 `project.config.json` 的目录 |
| `Error: getaddrinfo ENOTFOUND` | 网络问题 | 检查代理设置或网络连接 |
| 上传后版本未出现 | robot 编号冲突 | 不同任务使用不同 robot 编号 |

---

## 命令行参数速查

| 参数 | 必填 | 说明 |
|------|------|------|
| `--version <版本号>` | 是 | 语义化版本号，如 `1.0.0` |
| `--desc <描述>` | 是 | 版本描述信息 |
| `--pack-npm` | 否 | 上传前先执行 npm 构建 |
| `--help` / `-h` | 否 | 显示帮助信息 |

## 环境变量速查

| 环境变量 | 必填 | 说明 |
|---------|------|------|
| `MP_APPID` | 是 | 小程序 AppID |
| `MP_PRIVATE_KEY_PATH` | 是 | 上传密钥文件路径 |
| `MP_PROJECT_PATH` | 是 | 小程序项目路径 |
| `MP_ROBOT` | 否 | 机器人编号 1-30（默认 1） |
