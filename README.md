# Quick Reply for X

Chrome 浏览器插件：在 X (Twitter) 上为帖子生成 AI 建议回复，点击即可填入回复框。

## 功能

- 每条推文操作栏新增 ✨ 按钮
- 点击后自动打开回复框，调用 LLM 生成 4 条建议回复
- 选择其中一条，自动填入回复输入框

## 安装

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本项目目录

## 配置

1. 在扩展卡片点击「详细信息」→「扩展程序选项」，或右键扩展图标进入设置
2. 填入 API Key（参考 [docs/API_REF.md](docs/API_REF.md)）
3. 默认 API URL 与 Model 已预填，一般无需修改

| 配置项 | 默认值 |
|--------|--------|
| API URL | `https://ark.cn-beijing.volces.com/api/v3/responses` |
| Model | `deepseek-v3-2-251201` |

## 使用

1. 打开 [x.com](https://x.com)
2. 找到想回复的帖子，点击操作栏中的 ✨ 按钮
3. 等待生成完成后，点击一条建议回复
4. 内容会自动填入回复框，确认后发送

## 项目结构

```
quick-reply/
├── manifest.json      # 扩展清单
├── background.js      # 后台服务：调用 LLM API
├── content.js         # 内容脚本：X 页面 UI 与交互
├── content.css        # 建议回复面板样式
├── options.html       # 设置页
├── options.js
├── icons/
└── docs/API_REF.md    # API 参考
```

## 注意事项

- API Key 保存在 Chrome 同步存储中，请勿将 Key 提交到公开仓库
- 插件仅在 x.com / twitter.com 页面注入脚本
- 若 X 页面结构更新导致按钮或输入框失效，可能需要更新选择器
