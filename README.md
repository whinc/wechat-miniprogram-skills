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

## Installation

### Option A — Copy skill file directly

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

### Option B — Clone and symlink

```bash
git clone https://github.com/whinc/wechat-miniprogram-skills.git

# CodeBuddy Code
ln -s $(pwd)/wechat-miniprogram-skills/skills/miniprogram-screenshot \
      <your-project>/.codebuddy/skills/miniprogram-screenshot

# Claude Code
ln -s $(pwd)/wechat-miniprogram-skills/skills/miniprogram-screenshot \
      <your-project>/.claude/skills/miniprogram-screenshot
```

## Requirements

- [miniprogram-automator](https://www.npmjs.com/package/miniprogram-automator) npm package
- WeChat DevTools with CLI service port enabled (Settings → Security → Enable service port)
- Compiled mini-program output directory (e.g. `dist/`)

## Contributing

PRs welcome! If you have skills for other common WeChat mini-program workflows, feel free to open a pull request.

## License

MIT
