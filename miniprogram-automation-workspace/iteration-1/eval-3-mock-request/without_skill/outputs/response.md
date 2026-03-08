# 小程序回归测试脚本骨架：mock wx.request + 网络请求页面验证

## 完整脚本骨架

```javascript
const automator = require('miniprogram-automator');

async function runRegressionTest() {
  let miniProgram;

  try {
    // 1. 启动小程序
    miniProgram = await automator.launch({
      projectPath: '/path/to/your/miniprogram', // 替换为实际项目路径
      devToolsInstallPath: '/Applications/wechatwebdevtools.app',
    });

    // 2. Mock wx.request — 在全局 wx 对象上拦截
    await miniProgram.mockWxMethod('request', (options) => {
      // 根据 url 返回不同的固定数据
      if (options.url && options.url.includes('network/request')) {
        options.success &&
          options.success({
            statusCode: 200,
            data: {
              message: 'mocked response',
              list: [
                { id: 1, name: 'Item A' },
                { id: 2, name: 'Item B' },
              ],
            },
            header: { 'Content-Type': 'application/json' },
          });
      } else {
        options.success &&
          options.success({
            statusCode: 200,
            data: {},
          });
      }
    });

    // 3. 监听 console 日志
    miniProgram.on('console', (msg) => {
      console.log('[miniprogram console]', msg.type, msg.args);
    });

    // 4. 监听异常（JS 错误）
    miniProgram.on('error', (err) => {
      console.error('[miniprogram error]', err.message || err);
    });

    // 5. 导航到目标页面
    await miniProgram.navigateTo('packageAPI/pages/network/request/request');

    // 等待页面加载完成
    const page = await miniProgram.currentPage();
    await page.waitFor(1500); // 等待数据渲染

    // 6. 验证渲染结果
    // 获取页面数据，检查是否使用了 mock 数据
    const pageData = await page.data();
    console.log('[test] page data:', JSON.stringify(pageData, null, 2));

    // 断言示例（根据实际页面结构调整选择器和预期值）
    const resultEl = await page.$('.response-data'); // 替换为实际选择器
    if (resultEl) {
      const text = await resultEl.text();
      console.log('[test] response element text:', text);
      // 简单断言
      if (!text.includes('mocked') && !text.includes('Item')) {
        throw new Error('渲染结果未包含预期的 mock 数据');
      }
    }

    console.log('[test] PASS: 页面正确渲染了 mock 数据');
  } catch (err) {
    console.error('[test] FAIL:', err.message || err);
    process.exitCode = 1;
  } finally {
    // 7. 清理流程：恢复 mock 并关闭小程序
    await cleanup(miniProgram);
  }
}

async function cleanup(miniProgram) {
  if (!miniProgram) return;

  try {
    // 恢复 wx.request 原始实现
    await miniProgram.restoreWxMethod('request');
    console.log('[cleanup] wx.request mock 已恢复');
  } catch (err) {
    console.warn('[cleanup] 恢复 mock 失败:', err.message || err);
  }

  try {
    // 关闭小程序
    await miniProgram.close();
    console.log('[cleanup] 小程序已关闭');
  } catch (err) {
    console.warn('[cleanup] 关闭小程序失败:', err.message || err);
  }
}

// 运行测试
runRegressionTest();
```

---

## 清理流程说明

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1 | `restoreWxMethod('request')` | 恢复 `wx.request` 原生实现，避免影响后续测试 |
| 2 | `miniProgram.close()` | 关闭开发者工具中的小程序实例，释放端口和资源 |
| 3 | `process.exitCode = 1`（失败时）| 确保 CI 流程能识别失败状态 |

> **关键点**：清理逻辑放在 `finally` 块中，无论测试成功或失败都会执行，防止 mock 状态残留。

---

## 关键 API 说明

### `miniProgram.mockWxMethod(method, implementation)`
- 拦截指定的 `wx.*` 方法，替换为自定义实现
- `implementation` 接收 `options` 对象，手动调用 `options.success` / `options.fail` / `options.complete`

### `miniProgram.restoreWxMethod(method)`
- 恢复被 mock 的 `wx.*` 方法到原始实现

### `miniProgram.on('console', callback)`
- 监听小程序内部的 `console.log` / `console.error` 等输出

### `miniProgram.on('error', callback)`
- 监听小程序运行时 JS 异常

### `miniProgram.navigateTo(path)`
- 跳转到指定页面路径（相对路径，不含 `/`）

### `page.waitFor(ms | selector)`
- 等待指定毫秒数，或等待某个选择器出现

---

## 运行方式

```bash
# 安装依赖
npm install miniprogram-automator

# 运行脚本
node regression-test.js
```

---

## 注意事项

1. **路径配置**：`projectPath` 需指向小程序项目根目录（含 `project.config.json`）
2. **DevTools 版本**：需要微信开发者工具 >= 1.02.1907232，并开启自动化端口
3. **Mock 时机**：`mockWxMethod` 需在导航到页面前调用，确保页面加载时就使用 mock
4. **页面路径**：`navigateTo` 的路径需与 `app.json` 中的 `pages` 配置一致，官方 demo 使用了分包，路径为 `packageAPI/pages/network/request/request`
5. **选择器**：实际断言时需根据目标页面的真实 WXML 结构调整 CSS 选择器
