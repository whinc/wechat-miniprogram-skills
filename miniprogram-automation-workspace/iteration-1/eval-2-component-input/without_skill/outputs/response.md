# 微信小程序自动化测试：input 组件定位与验证

## 自动化脚本：导航到输入框页面并验证 input

以下脚本使用 `miniprogram-automator` 实现导航到 `packageComponent/pages/form/input/input` 页面，定位 input 组件，输入测试文本，并读取 value 进行验证。

```javascript
const automator = require('miniprogram-automator');

async function testInput() {
  const miniProgram = await automator.launch({
    projectPath: '/path/to/your/miniprogram-demo', // 替换为实际项目路径
    devToolsCliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
  });

  try {
    // 导航到 input 页面（子包页面需要使用完整路径）
    const page = await miniProgram.navigateTo('packageComponent/pages/form/input/input');

    // 等待页面加载完成
    await miniProgram.waitFor(500);

    // 定位页面上的 input 组件
    const inputElement = await page.$('input');

    // 输入测试文本
    await inputElement.input('Hello, World!');

    // 触发 blur 事件（某些情况下需要）
    await inputElement.trigger('blur');

    // 读取 input 的 value 属性
    const properties = await inputElement.properties();
    const value = properties.value;

    console.log('Input value:', value);

    // 验证 value 是否正确
    if (value === 'Hello, World!') {
      console.log('✓ 测试通过：input value 验证成功');
    } else {
      console.error('✗ 测试失败：期望值 "Hello, World!"，实际值 "' + value + '"');
    }

  } catch (error) {
    console.error('测试出错:', error);
  } finally {
    await miniProgram.close();
  }
}

testInput();
```

---

## 为什么不能用 `page.$('custom-comp input')` 穿透自定义组件

### 根本原因：Shadow DOM 隔离

微信小程序的自定义组件基于 **Shadow DOM** 机制实现了样式和结构的封装隔离。每个自定义组件都有自己独立的节点树（shadow tree），与页面的主节点树（light tree）是相互隔离的。

CSS 选择器（如 `custom-comp input`）在常规 DOM 中是通过层级关系来查找元素的，但 **Shadow DOM 边界会阻止选择器穿透**：

- `page.$('custom-comp input')` 会尝试在页面的 light tree 中查找 `custom-comp` 内部的 `input`
- 由于 Shadow DOM 隔离，选择器无法跨越 shadow boundary 进入组件内部
- 因此这种写法会返回 `null` 或抛出"未找到元素"的错误

### 正确的定位方式

#### 方式一：通过自定义组件实例的 `$` 方法

```javascript
// 先获取自定义组件元素
const customComp = await page.$('custom-comp');

// 再在组件内部查找 input（这会在组件的 shadow tree 中查找）
const inputInComp = await customComp.$('input');

// 输入文本
await inputInComp.input('test text');
```

#### 方式二：使用 `$$` 配合索引

如果页面上有多个同名组件，可以用 `$$` 获取所有实例：

```javascript
const allComps = await page.$$('custom-comp');
const firstComp = allComps[0];
const inputEl = await firstComp.$('input');
await inputEl.input('test text');
```

#### 方式三：通过组件的 `querySelector` 进入 shadow tree

```javascript
// miniprogram-automator 的组件实例支持在其内部查询
const comp = await page.$('custom-comp');
// 在组件的内部 DOM 树中查找
const input = await comp.$('input');
```

### 总结对比

| 方式 | 代码 | 能否穿透 Shadow DOM | 说明 |
|------|------|-------------------|------|
| 错误方式 | `page.$('custom-comp input')` | 不能 | 选择器无法跨越 shadow boundary |
| 正确方式 1 | `(await page.$('custom-comp')).$('input')` | 能 | 先获取组件实例，再在其内部查询 |
| 正确方式 2 | 先获取组件引用，再调用 `$` | 能 | 同上，适合多组件场景 |

### 关键点

- `miniprogram-automator` 中，**自定义组件实例的 `$` 方法**会在该组件的 shadow tree 中进行查询，因此可以找到组件内部的元素
- **页面级别的 `$` 方法**只能查询 light tree，无法穿透进入自定义组件的 shadow tree
- 这与 Web 标准的 Shadow DOM 行为一致，是组件化封装的核心机制
