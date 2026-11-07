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
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginLeft: 4,
        fontSize: 12,
        color: 'var(--dsw-alias-label-primary, inherit)',
      },
      pickerLabel: {
        opacity: 0.7,
        whiteSpace: 'nowrap',
        color: 'var(--dsw-alias-label-secondary, inherit)',
      },
      trigger: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 24,
        padding: '0 8px',
        borderRadius: 12,
        fontSize: 12,
        lineHeight: 1,
        border: '0.5px solid var(--dsw-alias-border-l1, rgba(128,128,128,.35))',
        background: 'var(--dsw-alias-bg-layer-1, transparent)',
        color: 'var(--dsw-alias-label-primary, inherit)',
        cursor: 'pointer',
        maxWidth: 150,
      },
      chevron: {
        width: 9,
        height: 9,
        flex: '0 0 auto',
        opacity: 0.6,
      },
      backdrop: {
        position: 'fixed',
        inset: 0,
        zIndex: 40,
      },
      menu: {
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        zIndex: 41,
        minWidth: 148,
        padding: 4,
        borderRadius: 10,
        border: '0.5px solid var(--dsw-alias-border-l1, rgba(128,128,128,.35))',
        background: 'var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1, #2b2b2b))',
        boxShadow: '0 10px 28px rgba(0,0,0,.22)',
      },
      item: (active, hover) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 9px',
        borderRadius: 6,
        fontSize: 12,
        lineHeight: 1.35,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
        color: active
          ? 'var(--dsw-alias-brand-primary, #4D6BFE)'
          : 'var(--dsw-alias-label-primary, inherit)',
        background: hover ? 'var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,.14))' : 'transparent',
      }),
      itemDot: (active) => ({
        width: 5,
        height: 5,
        borderRadius: 3,
        flex: '0 0 auto',
        background: active ? 'var(--dsw-alias-brand-primary, #4D6BFE)' : 'transparent',
      }),
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
      const [open, setOpen] = React.useState(false)
      const [hover, setHover] = React.useState('')

      const choose = React.useCallback(
        async (mode) => {
          setOpen(false)
          if (mode === (data ? data.sessionMode || '' : '')) return
          setBusy(true)
          try {
            const next = await bridge('setSession', { sessionId, mode })
            if (next && next.ok) setData(next)
          } finally {
            setBusy(false)
          }
        },
        [sessionId, setData, data],
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
      const currentLabel = currentNameOf(data) || '原版'

      return h(
        'div',
        { style: S.picker, title: '这个对话用哪个人设，只影响这个对话；聊起来之后就不能改了' },
        h('span', { style: S.pickerLabel }, '人设'),
        h(
          'div',
          {
            role: 'button',
            tabIndex: 0,
            'aria-haspopup': 'listbox',
            'aria-expanded': open,
            'aria-label': `对话人设：${currentLabel}`,
            style: { ...S.trigger, opacity: busy ? 0.6 : 1 },
            onClick: () => !busy && data && setOpen(!open),
            onKeyDown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                if (!busy && data) setOpen(!open)
              } else if (e.key === 'Escape') {
                setOpen(false)
              }
            },
          },
          h('span', null, currentLabel),
          h(
            'svg',
            {
              viewBox: '0 0 10 6',
              style: { ...S.chevron, transform: open ? 'rotate(180deg)' : 'none' },
              'aria-hidden': 'true',
            },
            h('path', {
              d: 'M1 1l4 4 4-4',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 1.4,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
            }),
          ),
        ),
        open
          ? h('div', { style: S.backdrop, onClick: () => setOpen(false) })
          : null,
        open
          ? h(
              'div',
              {
                role: 'listbox',
                style: S.menu,
              },
              options.map((o) =>
                h(
                  'div',
                  {
                    key: o.value || 'off',
                    role: 'option',
                    'aria-selected': current === o.value,
                    style: S.item(current === o.value, hover === (o.value || 'off')),
                    onMouseEnter: () => setHover(o.value || 'off'),
                    onMouseLeave: () => setHover(''),
                    onClick: () => choose(o.value),
                  },
                  h('span', { style: S.itemDot(current === o.value) }),
                  o.label,
                ),
              ),
            )
          : null,
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
