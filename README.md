# wechat-miniprogram-skills

A collection of [CodeBuddy Code](https://cnb.cool/codebuddy/codebuddy-code) / Claude Code skills for WeChat mini-program development.

## Skills

### [miniprogram-screenshot](./skills/miniprogram-screenshot/SKILL.md)

Automate screenshots of WeChat mini-program pages using `miniprogram-automator`.

**Triggers when you say:** "截图"、"screenshot"、"截屏"、"页面快照"、"预览页面"

**What it does:**
- Checks prerequisites (dependencies, compiled output, DevTools port)
- Collects page list from project config or user input
- Generates / updates `scripts/screenshot.js`
- Saves timestamped PNG screenshots + `index.json` summary

### [miniprogram-ci](./skills/miniprogram-ci/SKILL.md)

Generate reusable CI scripts for WeChat mini-program `pack-npm`, preview, and upload workflows using `miniprogram-ci`.

**Triggers when you say:** "上传小程序"、"预览"、"CI 部署"、"miniprogram-ci"、"自动化上传"、"发布小程序版本"、"生成预览二维码"、"打包 npm"

**What it does:**
- Checks prerequisites (`miniprogram-ci`, `project.config.json`, private key, IP whitelist)
- Generates reusable Node.js scripts instead of directly completing deployment tasks
- Produces `scripts/pack-npm.js`, `scripts/preview.js`, and `scripts/upload.js` templates based on the user's project environment
- Adds `package.json` scripts and CI/CD usage examples
- Emphasizes secret handling, `.gitignore` rules, and repeatable execution in CI pipelines
- Evaluated against the official `miniprogram-demo` project for `pack-npm`, preview, and upload scenarios

## Installation

### Option A — Copy skill files directly

#### miniprogram-screenshot

```bash
# For CodeBuddy Code
mkdir -p .codebuddy/skills/miniprogram-screenshot
curl -o .codebuddy/skills/miniprogram-screenshot/SKILL.md \
  https://raw.githubusercontent.com/whinc/wechat-miniprogram-skills/main/skills/miniprogram-screenshot/SKILL.md

# For Claude Code
mkdir -p .claude/skills/miniprogram-screenshot
curl -o .claude/skills/miniprogram-screenshot/SKILL.md \
  https://raw.githubusercontent.com/whinc/wechat-miniprogram-skills/main/skills/miniprogram-screenshot/SKILL.md
```

#### miniprogram-ci

```bash
# For CodeBuddy Code
mkdir -p .codebuddy/skills/miniprogram-ci
curl -o .codebuddy/skills/miniprogram-ci/SKILL.md \
  https://raw.githubusercontent.com/whinc/wechat-miniprogram-skills/main/skills/miniprogram-ci/SKILL.md

# For Claude Code
mkdir -p .claude/skills/miniprogram-ci
curl -o .claude/skills/miniprogram-ci/SKILL.md \
  https://raw.githubusercontent.com/whinc/wechat-miniprogram-skills/main/skills/miniprogram-ci/SKILL.md
```

### Option B — Clone and symlink

```bash
git clone https://github.com/whinc/wechat-miniprogram-skills.git

# CodeBuddy Code
ln -s $(pwd)/wechat-miniprogram-skills/skills/miniprogram-screenshot \
      <your-project>/.codebuddy/skills/miniprogram-screenshot
ln -s $(pwd)/wechat-miniprogram-skills/skills/miniprogram-ci \
      <your-project>/.codebuddy/skills/miniprogram-ci

# Claude Code
ln -s $(pwd)/wechat-miniprogram-skills/skills/miniprogram-screenshot \
      <your-project>/.claude/skills/miniprogram-screenshot
ln -s $(pwd)/wechat-miniprogram-skills/skills/miniprogram-ci \
      <your-project>/.claude/skills/miniprogram-ci
```

## Requirements

### miniprogram-screenshot

- [miniprogram-automator](https://www.npmjs.com/package/miniprogram-automator) npm package
- WeChat DevTools with CLI service port enabled (Settings → Security → Enable service port)
- Compiled mini-program output directory (e.g. `dist/`)

### miniprogram-ci

- [miniprogram-ci](https://www.npmjs.com/package/miniprogram-ci) npm package
- A WeChat mini-program project containing `project.config.json`
- Node.js environment for running the generated scripts
- Private key file for preview/upload workflows
- IP whitelist configured in the WeChat platform for CI/CD machines when required

## Contributing

PRs welcome! If you have skills for other common WeChat mini-program workflows, feel free to open a pull request.

## License

MIT
