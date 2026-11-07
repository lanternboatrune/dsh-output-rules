# dsh-output-rules（对话人设）

给 DeepSeek Harness 的会话系统提示词追加一段人设文本。共 9 档：原版（不注入）+ Claude / GPT / Gemini / Grok / Kimi / Qwen / MiMo / DeepSeek。

人设按**会话**生效，不存在全局档：新对话默认原版，想换就在该对话头部下拉里选，只影响这个对话。

## 它怎么生效

- 注册一个 `systemPrompt` section（名 `user:persona-mode`，默认 order `10160`，落在 `WEB_SURFACE`(10100) 之后、人设后缀(10200) 之前）。
- 这段的文本不是写死的，而是组装系统提示词时才求值：`text(assembly)` 从 `assembly.agent.id` 拿当前会话的 sessionId，再查该会话的人设。
- 只用**一个全局段**，不靠「按 agent 作用域注册遮蔽段」。旧实现依赖 cordis 的作用域链，链一断就静默退回全局档，表现为「选了 A 却按 B 说话」；单段实现没有这条退化路径。
- 每个模型步骤都会重新组装，所以 compaction 不会把它摘要掉；子代理各有自己的 `agent.id`，不会串味。
- 选「原版」时不贡献任何内容，等于没装。纯提示词约束：不改会话数据、不拦截输出。

## 界面

| 位置 | 插槽 | 行为 |
|---|---|---|
| 新对话首屏，工作区与预设控件右侧 | `conversation.hero.options` | 只读小标，显示这个对话当前会用的人设，点不了 |
| 对话头部，标题右侧 | `conversation.session.header.actions` | 下拉选择，只对当前 `sessionId` 生效 |

写进 `state.json` 的 `sessions[sessionId]`；没有条目就是原版。选「原版」等于删掉该会话的覆盖项。

设置页里**没有**人设页：全局档已经移除，选人设只在这个对话的下拉里做。

## 安装

```powershell
git clone https://github.com/nonomint/dsh-output-rules.git
# 由会话内的 plugin_manager 完成，不要把本目录写进 profile
plugin_manager install_bundle <clone 目录>\dsh-output-rules
```

## 两部分

| 文件 | 角色 |
|---|---|
| `index.js` | 宿主半：注册 `systemPrompt` section + `/api/dsh-output-rules` bridge |
| `client.js` | 客户端半：首屏只读小标 + 头部下拉 |

客户端通过同源 `POST /api/dsh-output-rules` 读写：

- `{ "action": "get", "sessionId"?: string }` → `{ ok, mode, text, order, sessions, sessionMode, sessionId, modes: [{ id, label }] }`
- `{ "action": "setSession", "sessionId": "...", "mode": "grok" }`；`mode` 传 `""` 或 `"global"` 清除该会话覆盖
- `{ "action": "set", "mode": "..." }` / `{ "action": "set", "text": "..." }` 仍保留，用于脚本或预设改默认值，界面不再调用

`state.json` 落在插件目录，存 `{ mode, text, sessions: { [sessionId]: mode } }`；删除即回到默认值（`DEFAULT_MODE = "off"`）。bridge 只接受 `Host: 127.0.0.1 / localhost / [::1]` 且方法为 POST 的请求。

## 配置（cordis 层，可选）

本包不声明 `Config`。`apply` 会读 `cordis.patch.yml` 里的初值，优先级低于 `state.json`：

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `mode` | string | `off` | 没有会话覆盖时的兜底档；界面里不再可改 |
| `text` | string | `""` | 自定义追加文本；非空时覆盖所选档的正文 |
| `order` | number | `10160` | 插入位置，数字越小越靠前 |

人设正文都在 `personas.json`（key = 模式 id），**热读取**：按 mtime 缓存，改完存盘下一轮就生效，不用重启。改结构（增删档位、改选项名）才要改 `index.js` 的 `MODE_LABELS` 并重启。

## 依赖

零运行时依赖：只用 Node 内置模块（`node:fs` / `node:path` / `node:url`）和 DSH 插件接口，不内置 `node_modules`。

## 局限

- 系统提示词是建议性的，模型仍可能偏离人设，长任务尤其明显。
- 人设只影响语气，每段末尾都带「不改变事实准确性」的约束，但模型仍可能为了演角色而耍贫嘴。
- 换人设不影响已经生成的回答，只影响之后的回合。
- 首屏小标是只读展示，不提供选择入口。

## 卸载

从 profile 移除 bundle（`dsh plugin remove` 或 plugin_manager `remove_bundle`），依赖与 bundles 条目会一并清掉。
