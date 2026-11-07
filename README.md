# dsh-output-rules（对话人设）

给 DeepSeek Harness 里**所有会话**的系统提示词追加一段人设文本。设置页里切换 9 档：原版（不注入）+ Claude / GPT / Gemini / Grok / Kimi / Qwen / MiMo / DeepSeek。

## 它怎么生效

- 注册一个 `systemPrompt` section（名 `user:persona-mode`，默认 order `10160`，位于 `WEB_SURFACE`(10100) 之后、人设后缀(10200) 之前）。
- 每个模型步骤都会重新组装系统提示词，所以压缩（compaction）不会把它摘要掉；子代理同样继承。
- 所选模式为「原版」且未填自定义文本时不贡献任何内容 —— 等于没装。
- 纯提示词约束：不改会话数据、不拦截输出。

## 两级人设：全局 + 按会话

- **全局**：设置页「对话人设」里的选择，写进 `state.json` 的 `mode`。
- **按会话**：每个对话的头部工具栏（标题右侧「…」左边、`conversation.session.header.actions` 插槽）有一个「人设」下拉，只对当前 `sessionId` 生效，写进 `state.json` 的 `sessions[sessionId]`。
- 会话没设过 → 跟随全局；设过 → 用会话自己的；选「跟随全局」即删掉该会话的覆盖项。
- 宿主实现：全局 section 打底；每个 agent 在 `agent/created` 时于**自己作用域**注册同名 section，遮住全局那段，文本按 `agent.id`（即 sessionId）实时解析。自定义文本（`text`）对全局档生效，会话覆盖优先于它。
- 作用域注册有一条硬性写法：必须用 `agent.ctx.systemPrompt` 这种**属性访问**，不能写 `agent.ctx.get('systemPrompt')`。后者是 cordis 的 reflect 混入方法，内部把 `this` 绑回根 `ReflectService`，追踪到的上下文是根 ctx，section 会落进 global 层并与全局段撞名抛错，异常若被静默吞掉，表现就是「按会话设置完全没反应」。
- 所以按会话切换不需要重启，下一轮组装就生效；增删人设档位、改 `index.js` 结构才需要重启。

## 安装

```powershell
# 由会话内的 plugin_manager 完成，不要把本目录写进 profile
plugin_manager install_bundle <工作区>\develop-plugins\dsh-output-rules
```

## 设置页（client 半）

DSH 没有通用的 schema 表单：一个插件想在设置面板里加一页，必须自己带客户端半。本包因此有两部分：

| 文件 | 角色 |
|---|---|
| `index.js` | 宿主半：注册 `systemPrompt` section + `/api/dsh-output-rules` bridge |
| `client.js` | 客户端半：往 `settings.section` 注册一页 `id: persona-mode`、`order: 35`、label「对话人设」 |

设置面板里它的位置：`设置 → 对话人设`（在「外观」之后、「市场」之前）。

导航行图标通过 `settings.section.icon`（`id` 必须与 section 的 `id` 相同，本例 `persona-mode`）注册：白色描边的对话气泡 + 右上角星芒，跟随 `currentColor`，选中时透明度 1、未选中 0.72。包自带的 `icon.svg` 是同一图形的蓝底版本。

客户端通过同源 `POST /api/dsh-output-rules` 读写：

- `{ "action": "get", "sessionId"?: string }` → `{ ok, mode, text, order, sessions, sessionMode, sessionId, modes: [{ id, label }] }`
- `{ "action": "set", "mode": "grok" }` / `{ "action": "set", "text": "..." }` → 改全局，写入 `state.json`
- `{ "action": "setSession", "sessionId": "...", "mode": "grok" }`，`mode` 传 `""` 或 `"global"` 表示清除该会话覆盖

`state.json` 落在插件目录，存 `{ mode, text, sessions: { [sessionId]: mode } }`；删除它即回到默认值（`DEFAULT_MODE = "off"`，不注入任何内容）。bridge 只接受 `Host: 127.0.0.1 / localhost / [::1]` 且方法为 POST 的请求。

## 配置（cordis 层，可选）

本包**不声明** `Config`（没有 Schemastery schema，也就没有宿主投影出来的表单）。设置页是自绘的，读写走上面的 bridge。如果确实想在 `cordis.patch.yml` 里写死初值，`apply` 仍会读这些字段，优先级低于 `state.json`：

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `mode` | string | `off` | 首次启动的默认人设；之后以设置页写入的 `state.json` 为准 |
| `text` | string | `""` | 自定义追加文本；非空时**覆盖**所选模式的正文 |
| `order` | number | `10160` | 插入位置，数字越小越靠前 |

人设正文都在 `personas.json`（key = 模式 id）。它是**热读取**的：按 mtime 缓存，改完存盘下一轮对话就生效，不用重启 DSH。改结构（模式增删、选项改名）才需要改 `index.js` 里的 `MODE_LABELS` 并重启。

## 依赖

零运行时依赖：只用 Node 内置模块（`node:fs` / `node:path` / `node:url`）和 DSH 自己的插件接口，不内置任何 `node_modules`，可直接 `git init` 发布。

## 局限

- 系统提示词是**建议性**的，模型仍可能偏离人设（长任务尤其明显）。
- 人设只影响语气：`index.js` 每段末尾都带了「不改变事实准确性」的约束，但模型仍可能为了演角色而耍贫嘴。
- 换人设不影响已经生成的回答，只影响之后的回合。

## 卸载

从 profile 移除 bundle（`dsh plugin remove` 或 plugin_manager `remove_bundle`），依赖与 bundles 条目会一并清掉。
