# miniprogram-automator 自动化测试：首页截图与标题读取

## 前置检查

在运行自动化测试脚本之前，请确认以下几点：

### 1. 环境依赖
- **Node.js**：版本 >= 12.x（推荐 LTS 版本）
- **miniprogram-automator**：通过 `npm install miniprogram-automator --save-dev` 安装
- **微信开发者工具**：已安装并开启「服务端口」（设置 → 安全设置 → 开启服务端口）

### 2. 微信开发者工具配置
- 确认开发者工具路径正确，默认路径：
  - macOS：`/Applications/wechatwebdevtools.app/Contents/MacOS/cli`
  - Windows：`C:/Program Files (x86)/Tencent/微信web开发者工具/cli.bat`
- 开发者工具需要已登录账号
- 服务端口开启后，默认监听 `http://127.0.0.1:9420`（端口可能因版本不同而有差异）

### 3. 项目路径确认
- 小程序项目根目录：`/Users/whincwu/WeChatProjects/wechat-miniprogram-skills/miniprogram-demo/miniprogram`
- 该目录下需包含 `app.json`、`app.js` 等文件
- 首页路径确认为 `page/component/index`（需与 `app.json` 中 `pages` 配置一致）

### 4. outputs 目录
- 确保脚本运行前 `outputs` 目录存在，或在脚本中自动创建

---

## 完整脚本

```javascript
// test-homepage-screenshot.js
const automator = require('miniprogram-automator');
const path = require('path');
const fs = require('fs');

// 输出目录（相对于脚本所在目录）
const outputsDir = path.join(__dirname, 'outputs');
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}

async function run() {
  let miniProgram;

  try {
    // 启动微信开发者工具并连接到小程序
    miniProgram = await automator.launch({
      projectPath: '/Users/whincwu/WeChatProjects/wechat-miniprogram-skills/miniprogram-demo/miniprogram',
      // macOS 默认路径，若不同请修改
      cliPath: '/Applications/wechatwebdevtools.app/Contents/MacOS/cli',
    });

    console.log('成功连接到小程序');

    // reLaunch 到首页
    await miniProgram.reLaunch('/page/component/index');
    console.log('已 reLaunch 到首页');

    // 等待页面稳定（等待 1 秒）
    await miniProgram.waitFor(1000);

    // 获取当前页面
    const page = await miniProgram.currentPage();
    console.log('当前页面路径:', page.path);

    // 读取导航栏标题（尝试常见选择器）
    let titleText = null;

    // 方式1：尝试 .title 选择器
    try {
      const titleEl = await page.$('.title');
      if (titleEl) {
        titleText = await titleEl.text();
        console.log('通过 .title 获取到标题:', titleText);
      }
    } catch (e) {
      console.log('.title 选择器未找到，尝试其他选择器');
    }

    // 方式2：尝试 .nav-title 选择器
    if (!titleText) {
      try {
        const navTitleEl = await page.$('.nav-title');
        if (navTitleEl) {
          titleText = await navTitleEl.text();
          console.log('通过 .nav-title 获取到标题:', titleText);
        }
      } catch (e) {
        console.log('.nav-title 选择器未找到');
      }
    }

    // 方式3：尝试 page-meta 或 navigation-bar 组件
    if (!titleText) {
      try {
        const navBar = await page.$('navigation-bar');
        if (navBar) {
          const titleAttr = await navBar.attribute('title');
          titleText = titleAttr;
          console.log('通过 navigation-bar 获取到标题:', titleText);
        }
      } catch (e) {
        console.log('navigation-bar 组件未找到');
      }
    }

    if (titleText) {
      console.log('最终读取到的页面标题:', titleText);
    } else {
      console.log('未能通过选择器读取到标题，请检查页面 DOM 结构');
    }

    // 截图并保存到 outputs 目录
    const screenshotPath = path.join(outputsDir, 'homepage.png');
    await miniProgram.screenshot({
      path: screenshotPath,
    });
    console.log('截图已保存到:', screenshotPath);

  } catch (err) {
    console.error('测试过程中出现错误:', err);
  } finally {
    // 关闭连接
    if (miniProgram) {
      await miniProgram.close();
      console.log('已关闭连接');
    }
  }
}

run();
```

---

## 运行方式

```bash
# 进入脚本所在目录
cd /path/to/your/test/scripts

# 安装依赖（如未安装）
npm install miniprogram-automator

# 运行脚本
node test-homepage-screenshot.js
```

---

## 注意事项

1. **`reLaunch` 路径格式**：路径需以 `/` 开头，如 `/page/component/index`，不要写相对路径。
2. **等待时间**：`waitFor(1000)` 表示等待 1000 毫秒，如页面加载较慢可适当增加。
3. **标题选择器**：微信官方 demo 的导航栏标题通常由 `app.json` 的 `navigationBarTitleText` 配置，并非 DOM 元素，无法通过 `$()` 直接获取。若要获取配置项中的标题，可通过 `page.data` 查询页面数据，或直接读取 `app.json`。
4. **截图 API**：`miniProgram.screenshot()` 会截取整个模拟器画面；部分版本 API 可能有差异，请参考 [miniprogram-automator 官方文档](https://developers.weixin.qq.com/miniprogram/dev/devtools/auto/)。
5. **连接方式**：如开发者工具已打开，也可使用 `automator.connect()` 代替 `automator.launch()` 来连接已运行的实例，避免重复启动。
