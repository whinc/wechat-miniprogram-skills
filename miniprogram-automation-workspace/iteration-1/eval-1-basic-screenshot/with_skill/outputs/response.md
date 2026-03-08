# miniprogram-automator 自动化测试：reLaunch 首页 + 读取标题 + 截图

## 前置检查

在运行脚本之前，请逐项确认以下事项：

### 1. miniprogram-automator 版本

必须使用 `0.12.0` 及以上版本。旧版（`0.5.x` 等）使用已废弃的 CLI 语法，当前微信开发者工具（3.x）不再支持，会出现：

```
[error] { code: 31, message: "Error: Missing param 'project / appid'" }
```

升级命令：

```bash
npm install miniprogram-automator@latest --save-dev
```

### 2. projectPath 填写规则

本项目的 `project.config.json` 位于 `miniprogram-demo/` 根目录，且配置了 `"miniprogramRoot": "miniprogram/"`，因此开发者工具实际打开的目录是 **`miniprogram-demo/`**（包含 `project.config.json` 的那一层），不是 `miniprogram-demo/miniprogram/`。

```
projectPath: '/Users/whincwu/WeChatProjects/wechat-miniprogram-skills/miniprogram-demo'
```

### 3. 微信开发者工具安全设置

打开开发者工具 → **设置 → 安全设置 → 开启「服务端口」**。

没有这一步，脚本会出现 launch 失败、连接超时、WebSocket 建不起来等问题。

### 4. 启动前必须完全退出开发者工具

`automator.launch()` 会自己启动开发者工具，**不能与已运行的实例共存**。运行脚本前先 `Cmd+Q` 完全退出开发者工具。

如果开发者工具已在运行，会报错：

```
Failed to launch wechat web devTools, please make sure http port is open
```

### 5. 首次启动需手动确认信任

第一次用 `automator.launch()` 打开某个项目，开发者工具界面会弹出"信任项目"确认框，需要用户手动点击确认。因此 `timeout` 建议设置为 `120000`（2 分钟）。

### 6. 目标页面和导航栏标题选择器说明

- 目标页面：`/page/component/index`（以 `/` 开头，这是必须的）
- 查看 `page/component/index.json`，该页面配置了 `"navigationStyle": "custom"` 和 `"renderer": "skyline"`，使用了自定义导航栏组件 `<mp-navigation-bar>`。
- 页面 WXML 中，标题由自定义组件 `<mp-navigation-bar title="小程序官方组件展示">` 渲染，没有标准的 `.title` class 节点暴露在页面根节点上。
- 因为 `page.$` 无法穿透自定义组件边界，直接用 `page.$('.title')` 会失败。正确做法是先取到 `mp-navigation-bar` 组件宿主元素，再在其内部查找 `.title` 节点；或者直接读组件的 `data()` 属性。
- 由于首页是内容丰富的列表页，建议用 `waitFor(2000)` 做固定等待兜底，而不是等待一个可能不存在的选择器。

---

## 完整脚本

新建文件 `miniprogram-demo/test/basic-screenshot.js`，内容如下：

```js
const automator = require('miniprogram-automator')
const path = require('node:path')
const fs = require('node:fs/promises')

// ──────────────────────────────
// 配置区（按实际环境修改）
// ──────────────────────────────
const CLI_PATH =
  process.env.WECHAT_DEVTOOLS_CLI ||
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'

// projectPath 是包含 project.config.json 的目录，不是 miniprogram/ 子目录
const PROJECT_PATH =
  process.env.MINIPROGRAM_PROJECT_PATH ||
  path.resolve(__dirname, '..')

// 目标页面路径必须以 / 开头
const TARGET_PAGE = '/page/component/index'

// 截图输出目录
const OUTPUT_DIR = path.resolve(__dirname, '..', 'outputs')

// ──────────────────────────────
// 主流程
// ──────────────────────────────
async function main() {
  let miniProgram

  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true })

    // 前提：开发者工具已完全退出（Cmd+Q）；首次运行需在界面确认信任项目
    miniProgram = await automator.launch({
      cliPath: CLI_PATH,
      projectPath: PROJECT_PATH,
      timeout: 120000, // 给首次启动 + 用户确认信任留足时间
    })

    // reLaunch 到首页，返回页面对象
    const page = await miniProgram.reLaunch(TARGET_PAGE)

    // 首页是复杂列表页，用固定等待兜底，等待渲染稳定
    await page.waitFor(2000)

    // ── 读取导航栏标题 ──────────────────────────────
    // page/component/index 使用自定义导航栏 <mp-navigation-bar>
    // page.$() 不能穿透自定义组件边界，需先取宿主元素再向内查询
    let titleText = '（未读取到标题）'

    const navBar = await page.$('mp-navigation-bar')
    if (navBar) {
      // 方式一：尝试在组件内部查找 .title 节点
      const titleEl = await navBar.$('.title').catch(() => null)
      if (titleEl) {
        titleText = await titleEl.text()
      } else {
        // 方式二：读组件实例的 data 属性（拿 title prop）
        const navData = await navBar.data().catch(() => ({}))
        titleText = navData.title || '（data 中无 title 字段）'
      }
    } else {
      console.warn('未找到 mp-navigation-bar，尝试读取页面 data')
      // 兜底：直接读页面 data
      const pageData = await page.data().catch(() => ({}))
      titleText = JSON.stringify(pageData)
    }

    console.log('导航栏标题：', titleText)

    // ── 截图 ──────────────────────────────────────
    // 截图仅支持开发者工具模拟器，不适用于真机调试
    const screenshotPath = path.join(OUTPUT_DIR, 'component-index.png')
    await miniProgram.screenshot({ path: screenshotPath })
    console.log('截图已保存至：', screenshotPath)

  } finally {
    if (miniProgram) {
      await miniProgram.close().catch(() => {})
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
```

---

## 运行命令

```bash
# 进入 demo 项目根目录
cd miniprogram-demo

# 如果还没有安装 miniprogram-automator，先安装（必须 >= 0.12.0）
npm install miniprogram-automator@latest --save-dev

# 运行脚本
node test/basic-screenshot.js

# 也可以通过环境变量覆盖路径，无需修改脚本：
# MINIPROGRAM_PROJECT_PATH=/path/to/your/project node test/basic-screenshot.js
```

---

## 验证点与注意事项

| 验证点 | 说明 |
|---|---|
| 控制台输出"导航栏标题：小程序官方组件展示" | 说明 `mp-navigation-bar` 的 `title` 已正确读取 |
| `outputs/component-index.png` 文件存在且非空 | 截图保存成功 |
| 脚本正常退出（exit code 0） | `finally` 中 `miniProgram.close()` 执行完毕 |

**注意事项：**

1. **自定义组件穿透**：`mp-navigation-bar` 是自定义组件，`page.$('.title')` 必然失败，必须先 `page.$('mp-navigation-bar')` 再在组件内部查找。
2. **导航栏样式**：该页面使用 `"navigationStyle": "custom"`，系统原生导航栏不会渲染，标题完全由 `mp-navigation-bar` 组件控制。
3. **截图仅限模拟器**：`miniProgram.screenshot()` 不适用于真机调试画面。
4. **等待策略**：首页是复杂列表，不适合用选择器等待（列表渲染后选择器不一定稳定），用 `waitFor(2000)` 固定等待更可靠。
5. **开发者工具必须提前完全退出**：每次运行前确保 `Cmd+Q` 退出，否则 `launch()` 会报端口冲突错误。
