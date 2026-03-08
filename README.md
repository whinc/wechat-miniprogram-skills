# wechat-miniprogram-skills

这是一个面向微信小程序开发的技能仓库，适用于 [CodeBuddy Code](https://cnb.cool/codebuddy/codebuddy-code) / Claude Code。

## Skills

### [miniprogram-automation](./skills/miniprogram-automation/SKILL.md)

使用 `miniprogram-automator` 为微信小程序生成可复用的自动化脚本模板，覆盖页面跳转、等待策略、元素交互、Mock、截图与回归验证。

**常见触发词：** "小程序自动化"、"automator"、"自动化测试"、"E2E"、"mock wx.request"、"截图并校验"、"waitFor"、"选不到元素"

**能力说明：**
- 检查前置条件（开发者工具实际打开目录、CLI 路径、安全设置）
- 优先生成独立 Node.js 脚本，而不是默认切到 Jest
- 覆盖 `launch` / `connect`、`waitFor`、页面跳转、元素查询、输入与点击
- 强调自定义组件边界、`value()` 与 `data()` 的使用区别
- 优先使用 `mockWxMethod` / `restoreWxMethod` 处理 wx API Mock
- 支持截图、console / exception 监听与 finally 清理流程
- 已基于官方 `miniprogram-demo` 的真实页面结构进行校对与轻量验证

### [miniprogram-ci](./skills/miniprogram-ci/SKILL.md)

使用 `miniprogram-ci` 为微信小程序生成可重复执行的 CI 脚本，覆盖 `pack-npm`、预览和上传流程。

**常见触发词：** "上传小程序"、"预览"、"CI 部署"、"miniprogram-ci"、"自动化上传"、"发布小程序版本"、"生成预览二维码"、"打包 npm"

**能力说明：**
- 检查前置条件（`miniprogram-ci`、`project.config.json`、私钥、IP 白名单）
- 生成可重复执行的 Node.js 脚本，而不是直接代替用户执行部署动作
- 根据用户项目环境生成 `scripts/pack-npm.js`、`scripts/preview.js` 和 `scripts/upload.js` 模板
- 补充 `package.json` scripts 与 CI/CD 使用示例
- 强调 secrets 管理、`.gitignore` 规则以及可重复执行的流水线用法
- 基于官方 `miniprogram-demo` 项目对 `pack-npm`、预览和上传场景进行过评估

## 安装方式

请使用 Skills CLI 安装，并以官方文档作为最新说明来源：

<https://skills.sh/docs/cli>

### 安装本仓库

```bash
npx skills add whinc/wechat-miniprogram-skills
```

本仓库当前包含：
- `miniprogram-automation`
- `miniprogram-ci`

如果 Skills CLI 的使用方式后续发生变化，请以官方文档为准，不再参考旧的手工复制或软链接安装方式。

### 安装单个 Skill

```bash
# 安装整个仓库
npx skills add whinc/wechat-miniprogram-skills

# 只安装自动化相关 skill
npx skills add whinc/wechat-miniprogram-skills --skill miniprogram-automation

# 只安装 CI 相关 skill
npx skills add whinc/wechat-miniprogram-skills --skill miniprogram-ci
```

## 贡献

欢迎提交 PR。如果你有其他适用于微信小程序常见工作流的 skill，也欢迎补充到这个仓库中。

## 许可证

MIT
