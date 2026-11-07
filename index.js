import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'persona-mode'

export const inject = ['systemPrompt']

/** 默认插入位置：WEB_SURFACE(10100) 之后、persona suffix(10200) 之前。 */
export const DEFAULT_ORDER = 10160

const HERE = path.dirname(fileURLToPath(import.meta.url))
const STATE_FILE = path.join(HERE, 'state.json')
const PERSONAS_FILE = path.join(HERE, 'personas.json')
const SECTION_NAME = 'user:persona-mode'
const BRIDGE_PREFIX = '/api/dsh-output-rules'
const MAX_JSON_BODY_BYTES = 64 * 1024

const MODE_LABELS = [
  ['off', '原版（不注入任何内容）'],
  ['claude', 'Claude · 腹黑傲娇大小姐'],
  ['gpt', 'GPT · 高冷全能女王'],
  ['gemini', 'Gemini · 摸鱼财阀千金'],
  ['grok', 'Grok · 疯批乐子人'],
  ['kimi', 'Kimi · 星空指挥家学姐'],
  ['qwen', 'Qwen · 势利国风大小姐'],
  ['mimo', 'MiMo · 智能语音助手'],
  ['deepseek', 'DeepSeek · 吃白饭卷王'],
]

const MODE_IDS = new Set(MODE_LABELS.map(([id]) => id))

/** 首次启动（还没有 state.json 时）的默认人设；之后一律以设置页里的选择为准。 */
export const DEFAULT_MODE = 'off'

/** personas.json 热读取：按 mtime 缓存，改完文本下一轮就生效，不用重启 DSH。 */
const personaCache = { mtime: 0, data: null }

function readPersonas() {
  try {
    const stat = fs.statSync(PERSONAS_FILE)
    if (personaCache.data && stat.mtimeMs === personaCache.mtime) return personaCache.data
    const data = JSON.parse(fs.readFileSync(PERSONAS_FILE, 'utf8'))
    personaCache.mtime = stat.mtimeMs
    personaCache.data = data && typeof data === 'object' ? data : {}
    return personaCache.data
  } catch {
    return personaCache.data || {}
  }
}

function readState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** 只保留合法的「会话 id → 人设」覆盖项。 */
function sanitizeSessions(value) {
  if (!value || typeof value !== 'object') return {}
  const out = {}
  for (const [id, mode] of Object.entries(value)) {
    if (typeof id === 'string' && id && typeof mode === 'string' && MODE_IDS.has(mode)) out[id] = mode
  }
  return out
}

function writeState(next) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2) + '\n', 'utf8')
  } catch {
    // 只读安装目录等场景：内存里仍然生效，下次启动回退到 config。
  }
}

function normalize(input) {
  const mode = typeof input.mode === 'string' && MODE_IDS.has(input.mode) ? input.mode : 'off'
  const text = typeof input.text === 'string' ? input.text.trim() : ''
  const order = Number.isFinite(input.order) ? input.order : DEFAULT_ORDER
  return { mode, text, order, sessions: sanitizeSessions(input.sessions) }
}

function isLocalRequest(req) {
  const host = String(req.headers?.host ?? '').toLowerCase()
  return host.startsWith('127.0.0.1') || host.startsWith('localhost') || host.startsWith('[::1]')
}

function writeJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'referrer-policy': 'no-referrer',
  })
  res.end(payload)
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_JSON_BODY_BYTES) return undefined
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return undefined
  }
}

export function apply(ctx, config = {}) {
  const state = normalize({ mode: DEFAULT_MODE, text: '', order: DEFAULT_ORDER, ...config, ...readState() })

  const PROBE_FILE = path.join(HERE, 'probe.log')
  const probe = (line) => {
    try {
      fs.appendFileSync(PROBE_FILE, `${new Date().toISOString()} ${line}\n`)
    } catch {}
  }

  const personaText = (mode) => readPersonas()[mode] || ''
  const globalText = () => (state.text ? state.text : personaText(state.mode))
  const sessionOverride = (sessionId) =>
    typeof sessionId === 'string' && sessionId ? state.sessions[sessionId] : undefined
  const resolveText = (sessionId) => {
    const override = sessionOverride(sessionId)
    const resolved = override || state.mode
    probe(`resolve sid=${sessionId} override=${override || '-'} mode=${state.mode} -> ${resolved}`)
    return override ? personaText(override) : globalText()
  }

  const snapshot = (sessionId) => {
    const override = sessionOverride(sessionId)
    return {
      mode: state.mode,
      text: state.text,
      order: state.order,
      sessions: { ...state.sessions },
      sessionId: typeof sessionId === 'string' ? sessionId : null,
      sessionMode: override || '',
      modes: MODE_LABELS.map(([id, label]) => ({ id, label })),
    }
  }

  const persist = () => writeState({ mode: state.mode, text: state.text, sessions: state.sessions })

  // 单一段：文本在组装时求值，context.agent 就是当前会话的 agent，按它查会话覆盖。
  // 不再按 agent 作用域注册遮蔽段——作用域链一旦对不上就静默退回全局，正是旧实现的坑。
  ctx.effect(() => ctx.systemPrompt.section({
    name: SECTION_NAME,
    order: state.order,
    text: (assembly) => {
      const agent = assembly && assembly.agent
      const sessionId = agent && agent.id ? String(agent.id) : ''
      return resolveText(sessionId)
    },
  }), 'output-rules.section()')

  ctx.inject(['webServer'], (sctx) => {
    sctx.effect(() => sctx.webServer.register({
      kind: 'exact',
      path: BRIDGE_PREFIX,
      handler: async (req, res) => {
        if (!isLocalRequest(req)) {
          writeJson(res, 403, { ok: false, error: 'local requests only' })
          return
        }
        if (req.method !== 'POST') {
          writeJson(res, 405, { ok: false, error: 'POST only' })
          return
        }
        const body = await readJsonBody(req)
        if (!body || typeof body !== 'object') {
          writeJson(res, 400, { ok: false, error: 'malformed JSON body' })
          return
        }
        if (body.action === 'set') {
          if (body.mode !== undefined) {
            if (typeof body.mode !== 'string' || !MODE_IDS.has(body.mode)) {
              writeJson(res, 400, { ok: false, error: `unknown mode "${String(body.mode)}"` })
              return
            }
            state.mode = body.mode
          }
          if (body.text !== undefined) {
            if (typeof body.text !== 'string') {
              writeJson(res, 400, { ok: false, error: 'text must be a string' })
              return
            }
            state.text = body.text.trim()
          }
          persist()
          probe(`set global mode=${state.mode} textLen=${state.text.length}`)
          writeJson(res, 200, { ok: true, ...snapshot(body.sessionId) })
          return
        }
        if (body.action === 'setSession') {
          const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
          if (!sessionId) {
            writeJson(res, 400, { ok: false, error: 'sessionId is required' })
            return
          }
          const mode = typeof body.mode === 'string' ? body.mode : ''
          if (mode === '' || mode === 'global') {
            delete state.sessions[sessionId]
          } else if (MODE_IDS.has(mode)) {
            state.sessions[sessionId] = mode
          } else {
            writeJson(res, 400, { ok: false, error: `unknown mode "${mode}"` })
            return
          }
          persist()
          probe(`setSession sid=${sessionId} -> ${mode === '' || mode === 'global' ? 'global' : mode}`)
          writeJson(res, 200, { ok: true, ...snapshot(sessionId) })
          return
        }
        writeJson(res, 200, { ok: true, ...snapshot(body.sessionId) })
      },
    }), 'output-rules.bridge')
  })
}
