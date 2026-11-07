window.__ModuleLoader__.load({
  id: 'dsh-output-rules',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const h = React.createElement

    const BRIDGE = '/api/dsh-output-rules'

    /** 只显示模型名，不带任何后缀介绍。 */
    const FULL_LABELS = {
      off: '原版',
      claude: 'Claude',
      gpt: 'GPT',
      gemini: 'Gemini',
      grok: 'Grok',
      kimi: 'Kimi',
      qwen: 'Qwen',
      mimo: 'MiMo',
      deepseek: 'DeepSeek',
    }
    const labelOf = (m) => FULL_LABELS[m.id] || m.label

    /** 头部太窄，下拉里只放短名；完整描述留在设置页。 */
    const SHORT_LABELS = {
      off: '原版',
      claude: 'Claude',
      gpt: 'GPT',
      gemini: 'Gemini',
      grok: 'Grok',
      kimi: 'Kimi',
      qwen: 'Qwen',
      mimo: 'MiMo',
      deepseek: 'DeepSeek',
    }
    const shortLabel = (m) => SHORT_LABELS[m.id] || m.label

    async function bridge(action, payload) {
      const response = await fetch(BRIDGE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...(payload || {}) }),
      })
      return response.json()
    }

    function useState() {
      const [state, setState] = React.useState(null)
      const [error, setError] = React.useState('')
      const [busy, setBusy] = React.useState(false)

      React.useEffect(() => {
        let alive = true
        bridge('get')
          .then((data) => {
            if (!alive) return
            if (data && data.ok) setState(data)
            else setError((data && data.error) || '读取失败')
          })
          .catch((e) => alive && setError(String(e)))
        return () => {
          alive = false
        }
      }, [])

      const save = React.useCallback(async (payload) => {
        setBusy(true)
        setError('')
        try {
          const data = await bridge('set', payload)
          if (data && data.ok) setState(data)
          else setError((data && data.error) || '保存失败')
        } catch (e) {
          setError(String(e))
        } finally {
          setBusy(false)
        }
      }, [])

      return { state, error, busy, save }
    }

    const S = {
      picker: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginLeft: 4,
        fontSize: 12,
      },
      pickerLabel: { opacity: 0.7, whiteSpace: 'nowrap' },
      pickerSelect: {
        fontSize: 12,
        padding: '2px 6px',
        borderRadius: 6,
        border: '1px solid var(--dsw-alias-border-secondary, rgba(128,128,128,.3))',
        background: 'transparent',
        color: 'inherit',
        maxWidth: 132,
        cursor: 'pointer',
      },
      wrap: { display: 'flex', flexDirection: 'column', gap: 10, padding: '2px 0' },
      title: { fontSize: 13, fontWeight: 600 },
      hint: { fontSize: 12, opacity: 0.65, lineHeight: 1.6 },
      list: { display: 'flex', flexDirection: 'column', gap: 6 },
      row: (active) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 13,
        border: `1px solid ${active ? 'var(--dsw-alias-brand-primary, #4D6BFE)' : 'var(--dsw-alias-border-secondary, rgba(128,128,128,.25))'}`,
        background: active ? 'color-mix(in srgb, var(--dsw-alias-brand-primary, #4D6BFE) 12%, transparent)' : 'transparent',
      }),
      dot: (active) => ({
        width: 10,
        height: 10,
        borderRadius: 5,
        flex: '0 0 auto',
        background: active ? 'var(--dsw-alias-brand-primary, #4D6BFE)' : 'transparent',
        border: `1px solid ${active ? 'var(--dsw-alias-brand-primary, #4D6BFE)' : 'var(--dsw-alias-border-secondary, rgba(128,128,128,.45))'}`,
      }),
      area: {
        width: '100%',
        minHeight: 64,
        boxSizing: 'border-box',
        fontSize: 12,
        lineHeight: 1.5,
        padding: 8,
        borderRadius: 8,
        color: 'inherit',
        background: 'transparent',
        border: '1px solid var(--dsw-alias-border-secondary, rgba(128,128,128,.25))',
      },
      btn: {
        alignSelf: 'flex-start',
        fontSize: 12,
        padding: '5px 12px',
        borderRadius: 7,
        cursor: 'pointer',
        color: '#fff',
        border: 'none',
        background: 'var(--dsw-alias-brand-primary, #4D6BFE)',
        opacity: 1,
      },
      err: { fontSize: 12, color: '#e5484d' },
    }

    function ModeRow(props) {
      return h(
        'div',
        {
          style: S.row(props.active),
          role: 'button',
          tabIndex: 0,
          onClick: props.onClick,
          onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && props.onClick(),
        },
        h('span', { style: S.dot(props.active) }),
        h('span', null, props.label),
      )
    }

    function Panel() {
      const { state, error, busy, save } = useState()
      const [draft, setDraft] = React.useState(null)
      const text = draft === null ? (state ? state.text || '' : '') : draft

      if (!state) {
        return h('div', { style: S.wrap }, h('div', { style: S.hint }, error || '读取中…'))
      }

      return h(
        'div',
        { style: S.wrap },
        h('div', { style: S.title }, '回复人设'),
        h(
          'div',
          { style: S.hint },
          '全局人设，下一轮生效。单个对话想换，用它头部的「人设」下拉，不影响别的对话。「原版」= 不加任何人设。',
        ),
        h(
          'div',
          { style: S.list },
          state.modes.map((m) =>
            h(ModeRow, {
              key: m.id,
              label: labelOf(m),
              active: state.mode === m.id,
              onClick: () => !busy && save({ mode: m.id }),
            }),
          ),
        ),
        h('div', { style: { ...S.hint, marginTop: 4 } }, '自定义人设文本（可选，非空时覆盖上面所选人设）：'),
        h('textarea', {
          style: S.area,
          value: text,
          placeholder: '留空 = 使用所选人设',
          onChange: (e) => setDraft(e.target.value),
        }),
        h(
          'button',
          {
            style: { ...S.btn, opacity: busy ? 0.6 : 1 },
            disabled: busy,
            onClick: () => !busy && save({ text }),
          },
          busy ? '保存中…' : '保存自定义文本',
        ),
        error ? h('div', { style: S.err }, error) : null,
      )
    }

    function Icon(props) {
      const size = (props && props.size) || 18
      const active = !!(props && props.active)
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          style: { opacity: active ? 1 : 0.72 },
          'aria-hidden': 'true',
        },
        h('path', { d: 'M20.5 12.4c0 3.7-3.8 6.7-8.5 6.7-1 0-2-.14-2.9-.4L4 20.5l1.2-3.5c-1.1-1.2-1.7-2.7-1.7-4.6 0-3.7 3.8-6.7 8.5-6.7s8.5 3 8.5 6.7Z' }),
        h('path', { d: 'M9 11.4h6' }),
        h('path', { d: 'M9 14.2h3.6' }),
        h('path', { d: 'M17.4 3.2l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7Z', fill: 'currentColor', stroke: 'none' }),
      )
    }

    /** 会话头部的人设选择器：不设置时跟随全局（设置页里的选择）。 */
    function HeaderPicker(props) {
      const sessionId = props && props.sessionId
      const [data, setData] = React.useState(null)
      const [busy, setBusy] = React.useState(false)

      React.useEffect(() => {
        if (!sessionId) return undefined
        let alive = true
        bridge('get', { sessionId })
          .then((next) => {
            if (alive && next && next.ok) setData(next)
          })
          .catch(() => {})
        return () => {
          alive = false
        }
      }, [sessionId])

      const change = React.useCallback(
        async (event) => {
          const mode = event.target.value
          setBusy(true)
          try {
            const next = await bridge('setSession', { sessionId, mode })
            if (next && next.ok) setData(next)
          } finally {
            setBusy(false)
          }
        },
        [sessionId],
      )

      if (!sessionId) return null
      const globalMode = data ? data.mode : 'off'
      const globalName = data
        ? (() => {
            const found = data.modes.find((m) => m.id === globalMode)
            return found ? shortLabel(found) : globalMode
          })()
        : ''
      const current = data ? data.sessionMode || '' : ''
      const options = [
        { value: '', label: globalName ? `跟随全局 · ${globalName}` : '跟随全局' },
      ].concat((data ? data.modes : []).map((m) => ({ value: m.id, label: shortLabel(m) })))

      const currentName = current
        ? shortLabel(data.modes.find((m) => m.id === current) || { id: current, label: current })
        : ''
      const title = data
        ? current
          ? `这个对话单独用 ${currentName}，其他对话不受影响`
          : `没单独设置，跟随全局（现在是 ${globalName}）`
        : '单独指定这个对话的人设'

      return h(
        'label',
        { style: S.picker, title },
        h('span', { style: S.pickerLabel }, '人设'),
        h(
          'select',
          {
            style: { ...S.pickerSelect, opacity: busy ? 0.6 : 1 },
            value: current,
            disabled: busy || !data,
            onChange: change,
            'aria-label': '对话人设',
          },
          options.map((o) => h('option', { key: o.value || 'global', value: o.value }, o.label)),
        ),
      )
    }

    function apply(ctx) {
      const render = (props) => h(Panel, { close: props && props.close })
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: 'persona-mode',
            order: 35,
            label: '对话人设',
          },
          render,
        ),
      )
      ctx.slots.inject('settings.section.icon', () =>
        ctx.slots.register(
          {
            name: 'settings.section.icon',
            id: 'persona-mode',
            order: 35,
          },
          (props) => h(Icon, { size: props && props.size, active: props && props.active }),
        ),
      )
      ctx.slots.inject('conversation.session.header.actions', () =>
        ctx.slots.register(
          {
            name: 'conversation.session.header.actions',
            id: 'persona-mode',
            order: 30,
            label: '人设',
          },
          (props) => h(HeaderPicker, { sessionId: props && props.sessionId }),
        ),
      )
    }

    exports.apply = apply
    exports.inject = ['slots']
    return module.exports
  },
})
