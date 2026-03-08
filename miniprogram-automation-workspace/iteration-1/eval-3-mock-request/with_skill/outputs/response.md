# Mock wx.request 回归脚本：完整骨架与清理流程

## 方案说明

针对官方 demo 的 `packageAPI/pages/network/request/request` 页面，脚本需要完成：

1. 启动开发者工具并打开项目
2. **在跳转页面前**安装 `wx.request` mock，确保首次请求就能被拦截
3. 注册 `console` 和 `exception` 监听器，收集运行时日志与异常
4. 跳转到目标页面，触发请求，验证渲染结果
5. 在 `finally` 块中恢复 mock 并关闭小程序，确保任何情况下都能清理

**关于该页面的断言设计注意事项**：`packageAPI/pages/network/request/request` 是官方网络请求演示页，请求成功后主要反馈是更新 `loading` 状态和打印 console 日志，**不一定会渲染列表**。断言应围绕 `loading` 状态、日志内容或页面 `data()` 来设计，不要凭空假设会出现列表元素。

---

## 前置检查

| 项目 | 说明 |
|---|---|
| `miniprogram-automator` 版本 | 必须 `>= 0.12.0`，旧版会报 code 31 错误 |
| 开发者工具状态 | 执行 `launch()` 前必须**完全退出**（Cmd+Q），不能与已运行实例共存 |
| 服务端口 | 开发者工具 → 设置 → 安全设置 → 开启**服务端口** |
| `projectPath` | 应为开发者工具**实际打开的目录**（含 `project.config.json`），非源码根目录 |
| 首次运行 | 开发者工具界面会弹出「信任项目」确认框，建议 `timeout: 120000` |

---

## 安装依赖

```bash
npm install miniprogram-automator@latest --save-dev
```

---

## 完整脚本骨架

```js
// regression-mock-request.js
const automator = require('miniprogram-automator')
const path = require('node:path')
const fs = require('node:fs/promises')

// ─── 配置 ───────────────────────────────────────────────────────────────────
const CLI_PATH =
  process.env.WECHAT_DEVTOOLS_CLI ||
  '/Applications/wechatwebdevtools.app/Contents/MacOS/cli'

// projectPath 是开发者工具实际打开的目录，含 project.config.json
// 官方 demo 项目通常直接是源码根目录；Taro/uni-app 等需要换成编译产物目录
const PROJECT_PATH =
  process.env.MINIPROGRAM_PROJECT_PATH ||
  '/absolute/path/to/miniprogram-demo'

const TARGET_PAGE = '/packageAPI/pages/network/request/request' // 必须以 / 开头

const OUTPUT_DIR = path.resolve(process.cwd(), 'outputs')

// ─── 主流程 ──────────────────────────────────────────────────────────────────
async function main() {
  let miniProgram
  const consoleEvents = []
  const exceptionEvents = []

  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true })

    // 1. 启动开发者工具（前提：已完全退出）
    miniProgram = await automator.launch({
      cliPath: CLI_PATH,
      projectPath: PROJECT_PATH,
      timeout: 120000, // 首次启动 + 用户确认信任留足时间
    })

    // 2. 注册 console / exception 监听——在任何页面跳转前注册，避免漏事件
    miniProgram.on('console', (payload) => {
      consoleEvents.push(payload)
      // 可选：实时打印，便于调试
      // console.log('[MP console]', JSON.stringify(payload))
    })

    miniProgram.on('exception', (payload) => {
      exceptionEvents.push(payload)
      console.warn('[MP exception]', JSON.stringify(payload))
    })

    // 3. 安装 wx.request mock——必须在页面跳转前安装，确保首次请求就被拦截
    await miniProgram.mockWxMethod('request', (options = {}) => {
      const res = {
        data: {
          code: 0,
          // 根据页面实际使用的数据结构调整
          list: [
            { id: 1, title: 'Mock Item A' },
            { id: 2, title: 'Mock Item B' },
          ],
        },
        statusCode: 200,
        header: { 'content-type': 'application/json' },
        cookies: [],
        errMsg: 'request:ok',
      }

      // 异步调用 success / complete，模拟真实请求的回调时序
      Promise.resolve().then(() => {
        if (typeof options.success === 'function') options.success(res)
        if (typeof options.complete === 'function') options.complete(res)
      })

      // 返回请求任务对象，结构需与真实 wx.request 返回一致
      return {
        abort() {},
        onHeadersReceived() {},
        offHeadersReceived() {},
        onChunkReceived() {},
        offChunkReceived() {},
      }
    })

    // 4. 跳转到目标页面
    const page = await miniProgram.reLaunch(TARGET_PAGE)

    // 等待页面关键元素出现（优先用选择器，比固定 sleep 更可靠）
    await page.waitFor('button')
    await page.waitFor(200) // 短兜底，给渲染留一点时间

    // 5. 触发网络请求（点击页面按钮）
    const button = await page.$('button')
    if (!button) {
      throw new Error('未找到 request 页面按钮，请确认选择器或页面路径')
    }
    await button.tap()

    // 等待请求回调完成（选择器等待 + 短兜底）
    await page.waitFor(async () => {
      const d = await page.data().catch(() => null)
      // 请求完成后 loading 应变为 false；若页面没有 loading 字段可去掉此条件
      return d && d.loading === false
    }).catch(() => page.waitFor(1000)) // 超时兜底

    // 6. 断言：页面数据
    const pageData = await page.data().catch(() => ({}))
    console.log('页面 data():', JSON.stringify(pageData, null, 2))

    // 断言 loading 已结束
    if (pageData.loading !== false) {
      throw new Error(`请求结束后 loading 状态异常: ${JSON.stringify(pageData)}`)
    }

    // 7. 断言：console 日志（该页面请求成功后通常会打印日志）
    console.log('收集到的 console 事件:', JSON.stringify(consoleEvents, null, 2))

    // 按实际页面日志内容调整关键词
    const successLogs = consoleEvents.filter((event) => {
      if (!event || !Array.isArray(event.args)) return false
      return event.args.some((arg) => String(arg).includes('request:ok'))
    })
    if (!successLogs.length) {
      // 如果页面没打印明确日志，可以改为只验证没有 error 日志
      console.warn('未观察到明确的 request success 日志，请检查页面实现')
    }

    // 断言：无 console.error
    const consoleErrors = consoleEvents.filter(
      (e) => e && typeof e === 'object' && e.type === 'error',
    )
    if (consoleErrors.length) {
      throw new Error(`存在 console.error: ${JSON.stringify(consoleErrors)}`)
    }

    // 断言：无 exception
    if (exceptionEvents.length) {
      throw new Error(`存在运行时异常: ${JSON.stringify(exceptionEvents)}`)
    }

    // 8. 可选：截图留档（仅支持开发者工具模拟器，不适用于真机）
    await miniProgram.screenshot({
      path: path.join(OUTPUT_DIR, 'request-page-after-mock.png'),
    })

    console.log('回归验证通过')
  } finally {
    // ─── 清理流程（必须在 finally 中，确保任何情况下都执行）───────────────────
    if (miniProgram) {
      // 9. 恢复 wx.request mock
      await miniProgram.restoreWxMethod('request').catch((err) => {
        console.warn('restoreWxMethod 失败（可忽略）:', err.message)
      })

      // 10. 关闭小程序实例（断开 WebSocket 连接）
      await miniProgram.close().catch((err) => {
        console.warn('miniProgram.close() 失败（可忽略）:', err.message)
      })
    }
  }
}

main().catch((error) => {
  console.error('回归脚本执行失败:', error)
  process.exit(1)
})
```

---

## 清理流程说明

清理动作全部集中在 `finally` 块，执行顺序：

1. **`restoreWxMethod('request')`**：撤销对 `wx.request` 的 mock，恢复为原生实现。用 `.catch(() => {})` 防止脚本因恢复失败而抛出额外错误。
2. **`miniProgram.close()`**：关闭小程序实例，断开与开发者工具的 WebSocket 连接。同样用 `.catch()` 包裹，确保即使关闭失败也不掩盖原始错误。

> `finally` 保证了即便测试断言抛出异常，mock 也一定会被恢复，不会污染后续测试或手动调试环境。

---

## 运行命令

```bash
# 安装依赖（首次）
npm install miniprogram-automator@latest --save-dev

# 运行脚本（使用环境变量传参，推荐）
MINIPROGRAM_PROJECT_PATH=/path/to/your/miniprogram-demo \
  node regression-mock-request.js

# 或直接修改脚本中的 PROJECT_PATH 常量后运行
node regression-mock-request.js
```

---

## 关键注意事项

| 问题 | 说明 |
|---|---|
| Mock 必须在跳转前安装 | `mockWxMethod` 要在 `reLaunch` 之前调用，否则页面首次请求会打到真实网络 |
| 函数体不能引用外部变量 | `mockWxMethod` 传入的函数会被序列化到小程序运行环境执行，不能依赖闭包 |
| 不要在 mock 函数里用 `this.origin` 转发 | 该页面场景不需要，但若需要条件性透传，可在函数内调用 `this.origin(options)` |
| 截图只支持模拟器 | `miniProgram.screenshot()` 不适用于真机调试 |
| `waitFor` 优先选择器 | 固定 `waitFor(毫秒)` 只做短兜底，主同步手段应是选择器或条件函数 |
| 断言围绕实际反馈 | 该 demo 页面不一定渲染列表，优先断言 `loading`、日志、`data()` 而非 DOM 元素 |
