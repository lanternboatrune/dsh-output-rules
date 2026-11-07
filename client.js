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

    function usePersona(sessionId) {
      const [data, setData] = React.useState(null)

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

      return [data, setData]
    }

    const currentNameOf = (data) => {
      if (!data) return ''
      const mode = data.sessionMode || 'off'
      const found = data.modes.find((m) => m.id === mode)
      return found ? shortLabel(found) : mode
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
        height: 24,
        padding: '0 6px',
        borderRadius: 12,
        border: '1px solid var(--dsw-alias-border-secondary, rgba(128,128,128,.3))',
        background: 'transparent',
        color: 'inherit',
        maxWidth: 132,
        cursor: 'pointer',
      },
      tag: {
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
      tagDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        background: 'var(--dsw-alias-brand-primary, #4D6BFE)',
      },
    }

    /** 首屏可选：这个对话还没开始，选完写进会话覆盖，只影响这个对话。 */
    function HeroPersonaPicker(props) {
      const sessionId = props && props.sessionId
      const [data, setData] = usePersona(sessionId)
      const [busy, setBusy] = React.useState(false)

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
        [sessionId, setData],
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

      return h(
        'label',
        { style: S.picker, title: '这个对话用哪个人设，只影响这个对话；聊起来之后就不能改了' },
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

    /** 对话内只读：人设已经定下，这里只展示，不给改。 */
    function HeaderPersonaTag(props) {
      const sessionId = props && props.sessionId
      const [data] = usePersona(sessionId)
      const name = currentNameOf(data)
      if (!sessionId || !name) return null

      return h(
        'span',
        {
          style: S.tag,
          title: `这个对话的人设是「${name}」，已固定；要换，开新对话时选。`,
          'aria-label': `当前人设 ${name}`,
        },
        h('span', { style: S.tagDot }),
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
          (props) => h(HeroPersonaPicker, { sessionId: props && props.sessionId }),
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
          (props) => h(HeaderPersonaTag, { sessionId: props && props.sessionId }),
        ),
      )
    }

    exports.apply = apply
    exports.inject = ['slots']
    return module.exports
  },
})
