window.__ModuleLoader__.load({
  id: 'dsh-output-rules',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const h = React.createElement

    const BRIDGE = '/api/dsh-output-rules'

    /** 下拉和标签都只用短名，完整描述留在 personas.json。 */
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
    const shortLabel = (m) => SHORT_LABELS[m.id] || m.label || m.id

    async function bridge(action, payload) {
      const response = await fetch(BRIDGE, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...(payload || {}) }),
      })
      return response.json()
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
      badge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 24,
        padding: '0 9px',
        borderRadius: 12,
        fontSize: 12,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        color: 'inherit',
        opacity: 0.75,
        border: '1px solid var(--dsw-alias-border-secondary, rgba(128,128,128,.3))',
        userSelect: 'none',
        cursor: 'default',
      },
      badgeDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        background: 'var(--dsw-alias-brand-primary, #4D6BFE)',
      },
    }

    /** 头部的人设选择器：只影响当前对话，不设置即原版。 */
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
      const current = data ? data.sessionMode || '' : ''
      const options = [
        { value: '', label: '原版' },
      ].concat(
        (data ? data.modes : [])
          .filter((m) => m.id !== 'off')
          .map((m) => ({ value: m.id, label: shortLabel(m) })),
      )
      const currentName = current
        ? shortLabel((data.modes.find((m) => m.id === current)) || { id: current })
        : '原版'
      const title = `这个对话用「${currentName}」，只影响这个对话`

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
          options.map((o) => h('option', { key: o.value || 'off', value: o.value }, o.label)),
        ),
      )
    }

    /** 首屏只读小标：显示当前对话会用的人设，点它没有反应。 */
    function HeroPersona(props) {
      const sessionId = props && props.sessionId
      const [name, setName] = React.useState('')

      React.useEffect(() => {
        if (!sessionId) return undefined
        let alive = true
        bridge('get', { sessionId })
          .then((next) => {
            if (!alive || !next || !next.ok) return
            const mode = next.sessionMode || 'off'
            const found = next.modes.find((m) => m.id === mode)
            setName(found ? shortLabel(found) : mode)
          })
          .catch(() => {})
        return () => {
          alive = false
        }
      }, [sessionId])

      if (!sessionId || !name) return null
      return h(
        'span',
        {
          style: S.badge,
          title: `当前人设：${name}。要换人设，在对话开始后用它头部的下拉。`,
          'aria-label': `当前人设 ${name}`,
        },
        h('span', { style: S.badgeDot }),
        name,
      )
    }

    function apply(ctx) {
      ctx.slots.inject('conversation.hero.options', () =>
        ctx.slots.register(
          {
            name: 'conversation.hero.options',
            id: 'persona-badge',
            order: 10,
            label: '人设',
          },
          (props) => h(HeroPersona, { sessionId: props && props.sessionId }),
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
