# 自动化脚本：导航到 input 页面并验证输入框行为

## 准备工作

在运行脚本前，请先确认以下前置条件：

1. **miniprogram-automator 版本**：必须使用 `0.12.0` 及以上版本，旧版（0.5.x）会报 `code 31` 错误。

   ```bash
   npm install miniprogram-automator@latest --save-dev
   ```

2. **开发者工具安全设置**：微信开发者工具 → 设置 → 安全设置 → 开启「服务端口」。

3. **启动前退出开发者工具**：如果你打算用 `automator.launch()`，必须先确保开发者工具已**完全退出（Cmd+Q）**，不能与已运行实例共存。

4. **项目路径**：`projectPath` 应填写**微信开发者工具实际打开的目录**（包含 `project.config.json` 的目录）。

---

## 完整脚本

```js
const automator = require('miniprogram-automator')
const path = require('node:path')
const fs = require('node:fs/promises')

const CLI_PATH =
  process.env.WECHAT_DEVTOOLS_CLI ||
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'

// 填写开发者工具实际打开的目录（含 project.config.json）
const PROJECT_PATH =
  process.env.MINIPROGRAM_PROJECT_PATH || '/absolute/path/to/devtools-project'

const TARGET_PAGE = '/packageComponent/pages/form/input/input'
const TEST_TEXT = 'Hello miniprogram-automator'
const OUTPUT_DIR = path.resolve(process.cwd(), 'outputs')

async function main() {
  let miniProgram
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true })

    // 首次运行时开发者工具会弹出「信任项目」确认框，需手动点击确认
    // 因此设置 timeout: 120000（2 分钟）留足时间
    miniProgram = await automator.launch({
      cliPath: CLI_PATH,
      projectPath: PROJECT_PATH,
      timeout: 120000,
    })

    // 导航到 input 示例页面（路径必须以 / 开头）
    const page = await miniProgram.reLaunch(TARGET_PAGE)

    // 等待页面稳定：优先用稳定选择器，固定等待只做兜底
    await page.waitFor('input')
    await page.waitFor(100)

    // ----------------------------------------------------------------
    // 情形 A：input 是页面直接子节点（非自定义组件内部）
    // ----------------------------------------------------------------
    const input = await page.$('input')
    if (!input) throw new Error('未找到 input 元素')

    await input.tap()
    await input.input(TEST_TEXT)
    await page.waitFor(100)

    // 读取原生 input 的值，优先用 value() 或 property('value')
    const value = await input.value()
    console.log('读取到的 value：', value)

    if (value !== TEST_TEXT) {
      throw new Error(`输入框值不符合预期。期望: "${TEST_TEXT}"，实际: "${value}"`)
    }

    console.log('验证通过：input.value() === TEST_TEXT')

    // 截图留证（仅适用于开发者工具模拟器，不适用于真机）
    await miniProgram.screenshot({
      path: path.join(OUTPUT_DIR, 'input-page.png'),
    })
    console.log('截图已保存到 outputs/input-page.png')

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
# 安装依赖（如果尚未安装）
npm install miniprogram-automator@latest --save-dev

# 运行脚本
node test-input.js

# 也可通过环境变量覆盖路径
MINIPROGRAM_PROJECT_PATH=/path/to/your/project node test-input.js
```

---

## 为什么不能用 `page.$('custom-comp input')` 穿透自定义组件？

这是使用 `miniprogram-automator` 时最常见的陷阱，原因如下：

### 根本原因：选择器作用域不能跨越组件边界

`page.$()` / `page.$$()` 的查询作用域是**页面根节点**。

在微信小程序中，自定义组件拥有独立的组件作用域（Shadow DOM 概念类似）。即使你写的是后代选择器 `custom-comp input`，这个查询也无法穿透自定义组件边界，到达组件内部的 `input` 节点。

**错误写法（无法找到组件内部 input）：**

```js
// 这行代码会返回 null，即使页面上存在 input
const input = await page.$('custom-comp input')
```

**正确写法（先拿组件宿主，再在组件作用域内查找）：**

```js
// 第一步：在页面作用域找到自定义组件宿主元素
const comp = await page.$('custom-comp')
if (!comp) throw new Error('未找到自定义组件 custom-comp')

// 第二步：在组件作用域内继续查找 input
const input = await comp.$('input')
if (!input) throw new Error('未找到组件内 input')

// 第三步：操作和读值
await input.tap()
await input.input('test value')
const value = await input.value()
```

### 如果 input 嵌套在多层自定义组件内

需要逐层穿透：

```js
const outerComp = await page.$('outer-comp')
const innerComp = await outerComp.$('inner-comp')
const input = await innerComp.$('input')
```

---

## 读取输入框值的正确方式

| 场景 | 推荐方法 |
|---|---|
| 原生 `<input>` / `<textarea>` 元素 | `await input.value()` 或 `await input.property('value')` |
| 自定义组件的内部数据状态 | `await comp.data()` （拿到组件实例的 data 对象） |

> 不要混用：`data()` 是针对**自定义组件实例**读取其内部数据的，不能作为通用的输入框读值方法。原生 input 读值请始终用 `value()` 或 `property('value')`。

---

## 验证点与注意事项

| 注意项 | 说明 |
|---|---|
| 等待策略 | 优先 `waitFor(selector/condition)`，固定 `waitFor(毫秒)` 只做兜底 |
| 选择器稳定性 | 避免依赖动态生成的 class 或 id，优先用语义化标签选择器 |
| 清理资源 | `miniProgram.close()` 放进 `finally`，确保连接被关闭 |
| 截图限制 | 截图仅适用于开发者工具模拟器，不适用于真机调试 |
| launch() 前提 | 必须确保开发者工具已完全退出，否则报 `Failed to launch` 错误 |
| timeout 设置 | 首次运行建议 `timeout: 120000`，避免「信任项目」确认框等待超时 |
