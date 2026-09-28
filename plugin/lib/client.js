/**
 * Browser half of dsh-plugin-session-purge — v3, settings page only.
 *
 * One additive registration on `settings.section` (replaceRisk: none).
 * No conversation-header button: deleting the session you are currently viewing
 * is bounded by `dsh-session`'s fiber-owned lifetime and can never make its own
 * row disappear, so that entry point is deliberately not offered.
 *
 * The page is a list of destructive actions, so the layout has one job: make it
 * obvious WHICH session a row is, and make the delete itself hard to trigger by
 * accident. Hence
 *
 *  - every row carries the title plus a second line with the session id, its size
 *    and how long ago its directory was touched (the host returns `mtimeMs`), and
 *    chips for 打开中 / 已归档 / 子会话 N / 无工作区;
 *  - rows are grouped per workspace into cards with a count and a total, sorted
 *    biggest first, and a filter box narrows by title / id / workspace;
 *  - 删除 is a quiet outline button, and confirming does NOT reuse its slot: a
 *    red-tinted block appears *below* the row spelling out what goes (session,
 *    id, size, age, N child sessions, live warning) with 取消 as the
 *    primary-looking button and 删除 as the only red one;
 *  - 删除全部已归档 lives in its own danger card instead of beside 刷新.
 *
 * Defensive rules kept from v2: an error boundary so a render failure cannot take
 * the settings panel down with it, official primitives for the ordinary buttons,
 * no window.confirm/alert (a native dialog in this shell is one more thing that
 * can go wrong), and no full-page reload.
 *
 * Hand-written in the DSH client-module format: plain JS, no build step, and the
 * `id` must equal the package name.
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-session-purge',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports

    const React = require('react')
    const primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    const Button = primitives.Button
    const h = React.createElement
    const API = '/x-session-purge'
    /** The section label, used both by the slot and by the nav-glyph claimer. */
    const SECTION_LABEL = '会话管理'

    function fmt(bytes) {
      const n = typeof bytes === 'number' ? bytes : 0
      if (n < 1024) return n + ' B'
      if (n < 1048576) return (n / 1024).toFixed(1) + ' KB'
      if (n < 1073741824) return (n / 1048576).toFixed(2) + ' MB'
      return (n / 1073741824).toFixed(2) + ' GB'
    }

    /** "3 天前" reads faster than a timestamp when scanning a list. */
    function rel(ms) {
      if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return ''
      const delta = Date.now() - ms
      if (delta < 60000) return '刚刚'
      if (delta < 3600000) return Math.round(delta / 60000) + ' 分钟前'
      if (delta < 86400000) return Math.round(delta / 3600000) + ' 小时前'
      if (delta < 2592000000) return Math.round(delta / 86400000) + ' 天前'
      const date = new Date(ms)
      return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
    }

    /** The first 8 characters are enough to match a row against other surfaces. */
    function shortId(id) {
      const text = String(id || '')
      return text.length <= 12 ? text : text.slice(0, 8) + '…'
    }

    async function api(pathname, init) {
      const res = await fetch(API + pathname, Object.assign(
        { headers: { 'content-type': 'application/json' } },
        init,
      ))
      let data = null
      try { data = await res.json() } catch (e) { data = null }
      if (data === null) throw new Error('HTTP ' + res.status + '（返回不是 JSON）')
      if (!res.ok || data.ok === false) throw new Error(data.error || ('HTTP ' + res.status))
      return data
    }

    /**
     * Roomier than v2 on purpose: a 16px-radius card per workspace, ≥48px rows,
     * 13px titles with a 12px grey second line. The list is scanned, not read, so
     * the identifying bits get their own line instead of being squeezed into one.
     */
    const S = {
      root: { font: 'inherit', color: 'inherit', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '32px' },
      head: { display: 'flex', flexDirection: 'column', gap: '6px', padding: '2px 2px 0' },
      title: { margin: 0, fontSize: '16px', fontWeight: 500, lineHeight: '24px' },
      sub: { margin: 0, fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary, #8b93a1)' },
      card: {
        display: 'flex',
        flexDirection: 'column',
        padding: '14px 16px 10px',
        borderRadius: '16px',
        border: '0.5px solid var(--dsw-alias-border-l1, rgba(127,127,127,.22))',
        background: 'var(--dsw-alias-bg-layer-1, rgba(127,127,127,.035))',
      },
      bar: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
      search: {
        marginLeft: 'auto',
        width: '190px',
        height: '30px',
        boxSizing: 'border-box',
        padding: '0 10px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l1, rgba(127,127,127,.3))',
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        fontSize: '13px',
      },
      groupHead: { display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap', padding: '0 2px 8px' },
      groupTitle: { fontSize: '13px', fontWeight: 600, lineHeight: '20px', color: 'var(--dsw-alias-label-secondary, #6b7280)' },
      groupMeta: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary, #8b93a1)', fontVariantNumeric: 'tabular-nums' },
      row: {
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        minHeight: '48px',
        padding: '8px 2px',
        borderTop: '0.5px solid var(--dsw-alias-border-l1, rgba(127,127,127,.16))',
      },
      main: { display: 'flex', flexDirection: 'column', gap: '2px', flex: '1 1 auto', minWidth: 0 },
      titleLine: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 },
      rowTitle: { fontSize: '13px', lineHeight: '20px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      rowSub: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary, #8b93a1)', fontVariantNumeric: 'tabular-nums' },
      rowId: { fontFamily: 'var(--ds-font-family-code, ui-monospace, Consolas, monospace)' },
      chips: { display: 'flex', gap: '4px', flex: '0 0 auto' },
      chip: {
        flex: '0 0 auto',
        fontSize: '11px',
        lineHeight: '18px',
        padding: '0 7px',
        borderRadius: '9px',
        border: '0.5px solid var(--dsw-alias-border-l2, rgba(127,127,127,.35))',
        color: 'var(--dsw-alias-label-tertiary, #8b93a1)',
      },
      chipLive: { color: 'var(--dsw-alias-state-business-primary, #4176e6)', borderColor: 'var(--dsw-alias-state-business-primary, #4176e6)' },
      actions: { flex: '0 0 auto', display: 'flex', gap: '6px', alignItems: 'center' },
      select: { flex: '0 0 auto', display: 'flex', alignItems: 'center' },
      checkbox: { width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--dsw-alias-state-error-primary, #e5534b)' },
      // The confirming row keeps its place (the cancel button lands under the pointer,
      // not the delete one) and turns red so it cannot be mistaken for a normal row.
      rowAsk: {
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        minHeight: '48px',
        padding: '8px 2px',
        borderTop: '0.5px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 40%, transparent)',
        background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 8%, transparent)',
      },
      selBar: {
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '10px 12px',
        borderRadius: '12px',
        border: '0.5px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 35%, transparent)',
        background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 6%, transparent)',
      },
      selText: { flex: '0 1 auto', minWidth: 0, fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, #6b7280)', fontVariantNumeric: 'tabular-nums' },
      // 把"取消选择"和红色删除按钮隔开的一整段空白：误点要跨过它才会发生。
      selGrow: { flex: '1 1 auto', minWidth: '16px' },
      // 取消选择是"文字链接"，不是按钮：跟旁边那个红色删除按钮在形状和颜色上都不同类。
      selClear: {
        flex: '0 0 auto',
        height: '24px',
        padding: '0 2px',
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-tertiary, #8b93a1)',
        font: 'inherit',
        fontSize: '12px',
        cursor: 'pointer',
        textDecoration: 'underline',
        textUnderlineOffset: '3px',
      },
      confirm: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        margin: '6px 0 10px',
        padding: '14px 16px',
        borderRadius: '12px',
        border: '1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 45%, transparent)',
        background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5534b) 8%, transparent)',
      },
      confirmLine: { margin: 0, fontSize: '13px', lineHeight: '20px' },
      confirmMeta: { margin: 0, fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-secondary, #6b7280)' },
      confirmActions: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
      dangerButton: {
        display: 'inline-flex',
        alignItems: 'center',
        height: '28px',
        padding: '0 12px',
        borderRadius: '8px',
        border: 'none',
        background: 'var(--dsw-alias-state-error-primary, #e5534b)',
        color: '#fff',
        font: 'inherit',
        fontSize: '13px',
        cursor: 'pointer',
      },
      dangerCard: {
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        padding: '14px 16px',
        borderRadius: '16px',
        border: '0.5px solid var(--dsw-alias-border-l1, rgba(127,127,127,.22))',
        background: 'var(--dsw-alias-bg-layer-1, rgba(127,127,127,.035))',
      },
      dangerMain: { display: 'flex', flexDirection: 'column', gap: '2px', flex: '1 1 auto', minWidth: 0 },
      dangerTitle: { fontSize: '13px', lineHeight: '20px', fontWeight: 500 },
      dangerSub: { fontSize: '12px', lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary, #8b93a1)' },
      note: { margin: 0, fontSize: '12px', lineHeight: '18px', whiteSpace: 'pre-wrap', color: 'var(--dsw-alias-label-secondary, #6b7280)' },
      empty: { margin: 0, fontSize: '13px', lineHeight: '20px', color: 'var(--dsw-alias-label-tertiary, #8b93a1)' },
    }

    function chip(text, key, extra) {
      return h('span', { key, style: Object.assign({}, S.chip, extra || null) }, text)
    }

    /** Same rule the host uses for a session's children (unclaimed sessions in its folder). */
    function childrenOfRaw(sessions, parent) {
      return sessions.filter((x) => x.folder === parent.folder && x.id !== parent.id && !x.known)
    }

    function Panel() {
      const [state, setState] = React.useState({ loading: true, error: '', sessions: [] })
      const [note, setNote] = React.useState('')
      const [busy, setBusy] = React.useState('')
      const [ask, setAsk] = React.useState('')
      const [askBatch, setAskBatch] = React.useState(false)
      const [picked, setPicked] = React.useState({})
      const [query, setQuery] = React.useState('')

      const load = React.useCallback(() => {
        setState((s) => Object.assign({}, s, { loading: true, error: '' }))
        api('/list').then(
          (d) => setState({ loading: false, error: '', sessions: Array.isArray(d.sessions) ? d.sessions : [] }),
          (e) => setState({ loading: false, error: String((e && e.message) || e), sessions: [] }),
        )
      }, [])

      React.useEffect(() => { load() }, [load])
      // A filter change invalidates whatever confirmation was open.
      React.useEffect(() => { setAsk('') }, [query])

      const run = (body) => {
        setAsk('')
        setBusy(body && body.id ? body.id : '__all')
        setNote('')
        api('/delete', { method: 'POST', body: JSON.stringify(body) }).then(
          (d) => {
            const pending = Array.isArray(d.pending) ? d.pending : []
            const deleted = Array.isArray(d.deleted) ? d.deleted : []
            setNote(
              '已删除 ' + deleted.length + ' 项，释放 ' + fmt(d.freed) + '。' +
              (pending.length
                ? '\n\n其中 ' + pending.length + ' 个会话此刻正打开着（host 内存里活着）。' +
                  '\n文件已经删掉了；它们的列表项要等 DSH 重启后才会消失。' +
                  '\n（没有解除它们的工作区归属，否则它们会变成「未分组」。）'
                : ''),
            )
            setBusy('')
            load()
          },
          (e) => { setNote('删除失败：' + String((e && e.message) || e)); setBusy('') },
        )
      }

      /**
       * Batch delete. The Host route takes one session at a time, so this walks the
       * selection sequentially and aggregates exactly the fields the single delete
       * reports. One failure must not abort the rest of the list.
       */
      const runMany = (ids) => {
        setAskBatch(false)
        setAsk('')
        setBusy('__batch')
        setNote('')
        let freed = 0
        let deleted = 0
        let liveCount = 0
        const failed = []
        const step = (index) => {
          if (index >= ids.length) {
            setNote('已删除 ' + deleted + ' 个，释放 ' + fmt(freed) + '。' +
              (liveCount > 0 ? '\n\n其中 ' + liveCount + ' 个此刻正打开着：文件已删除，列表项要等 DSH 重启后才消失。' : '') +
              (failed.length > 0 ? '\n\n失败 ' + failed.length + ' 个：' + failed.join('、') : ''))
            setBusy('')
            setPicked({})
            load()
            return
          }
          api('/delete', { method: 'POST', body: JSON.stringify({ id: ids[index], children: true }) }).then(
            (d) => {
              deleted += Array.isArray(d.deleted) ? d.deleted.length : 0
              freed += typeof d.freed === 'number' ? d.freed : 0
              liveCount += Array.isArray(d.pending) ? d.pending.length : 0
              setNote('删除中… ' + (index + 1) + ' / ' + ids.length)
              step(index + 1)
            },
            (e) => {
              failed.push(shortId(ids[index]) + '（' + String((e && e.message) || e) + '）')
              step(index + 1)
            },
          )
        }
        step(0)
      }

      const needle = query.trim().toLowerCase()
      const all = state.sessions
      const visible = needle === ''
        ? all
        : all.filter((s) => (String(s.title || '') + ' ' + String(s.id || '') + ' ' + String(s.ws || '')).toLowerCase().indexOf(needle) >= 0)

      const toggle = (id) => setPicked((current) => {
        const next = Object.assign({}, current)
        if (next[id]) delete next[id]
        else next[id] = true
        return next
      })

      const pickAll = (list) => {
        const next = {}
        for (const s of list) next[s.id] = true
        return next
      }

      const pickedIds = Object.keys(picked)
      const pickedSessions = all.filter((s) => picked[s.id] === true)
      const pickedBytes = pickedSessions.reduce((sum, s) => sum + (typeof s.bytes === 'number' ? s.bytes : 0), 0)
      const pickedLive = pickedSessions.filter((s) => s.live).length
      const pickedKids = pickedSessions.reduce((sum, s) => sum + childrenOfRaw(all, s).length, 0)

      const groups = []
      const byWs = new Map()
      for (const s of visible) {
        const key = s && s.ws ? s.ws : '（未知工作区）'
        if (!byWs.has(key)) { byWs.set(key, []); groups.push(key) }
        byWs.get(key).push(s)
      }
      // Biggest first: the disk hogs are what this page is for.
      for (const key of groups) byWs.get(key).sort((a, b) => (b.bytes || 0) - (a.bytes || 0))

      const childrenOf = (s) => childrenOfRaw(all, s)

      const archived = all.filter((s) => s.archived)
      const archivedBytes = archived.reduce((sum, s) => sum + (typeof s.bytes === 'number' ? s.bytes : 0), 0)

      const blocks = []

      blocks.push(h('div', { key: 'head', style: S.head }, [
        h('p', { key: 't', style: S.title }, '会话管理'),
        h('p', { key: 's', style: S.sub },
          '永久删除会话：连同它在 ~/.dsh/sessions 下的日志、投影缓存与子会话（子代理）。归档只是隐藏、不删文件——这里删的是文件。'),
      ]))

      blocks.push(h('div', { key: 'bar', style: S.bar }, [
        h(Button, { key: 'refresh', size: 'sm', onClick: load, disabled: state.loading },
          state.loading ? '读取中…' : '刷新'),
        h('span', { key: 'count', style: S.groupMeta },
          all.length + ' 个会话 / ' + fmt(all.reduce((sum, s) => sum + (s.bytes || 0), 0))),
        h(Button, {
          key: 'pickAll',
          size: 'sm',
          variant: 'outline',
          disabled: visible.length === 0,
          onClick: () => setPicked(pickAll(visible)),
        }, needle === '' ? '全选' : '全选筛选结果'),
        h('input', {
          key: 'search',
          style: S.search,
          type: 'search',
          value: query,
          placeholder: '按标题 / ID / 工作区筛选',
          onChange: (event) => { setQuery(event.target.value) },
        }),
      ]))

      if (note) blocks.push(h('p', { key: 'note', style: S.note }, note))
      if (state.error) blocks.push(h('p', { key: 'error', style: S.note }, state.error))

      // Multi-select: the bar appears only while something is picked, so the page
      // looks unchanged until the user starts selecting.
      if (pickedIds.length > 0) {
        if (askBatch) {
          // 选择条本身留在原地，只把右边那个红色按钮换成白色「取消」：指针不用移动，
          // 手底下就是取消。真正执行删除的红按钮在下面单独一块里。
          blocks.push(h('div', { key: 'batch', style: S.selBar }, [
            h('span', { key: 't', style: S.selText },
              '已选 ' + pickedIds.length + ' 个 · 合计 ' + fmt(pickedBytes) +
              (pickedLive > 0 ? ' · ' + pickedLive + ' 个正在打开' : '')),
            h('span', { key: 'gap', style: S.selGrow }),
            h(Button, { key: 'cancel', size: 'sm', variant: 'primary', onClick: () => setAskBatch(false) }, '取消'),
          ]))
          blocks.push(h('div', { key: 'batch-confirm', style: S.confirm }, [
            h('p', { key: 'q', style: S.confirmLine }, '确认永久删除这 ' + pickedIds.length + ' 个会话？'),
            h('p', { key: 'm', style: S.confirmMeta },
              '合计 ' + fmt(pickedBytes) +
              (pickedKids > 0 ? ' · 连同 ' + pickedKids + ' 个子会话' : '') + ' · 不可撤销' +
              (pickedLive > 0 ? ' · 其中 ' + pickedLive + ' 个正在打开' : '')),
            h('div', { key: 'a', style: S.confirmActions },
              h('button', {
                key: 'go',
                type: 'button',
                style: S.dangerButton,
                disabled: busy === '__batch',
                onClick: () => runMany(pickedIds),
              }, busy === '__batch' ? '删除中…' : '永久删除 ' + pickedIds.length + ' 个')),
          ]))
        } else {
          blocks.push(h('div', { key: 'batch', style: S.selBar }, [
            h('span', { key: 't', style: S.selText },
              '已选 ' + pickedIds.length + ' 个 · 合计 ' + fmt(pickedBytes) +
              (pickedLive > 0 ? ' · ' + pickedLive + ' 个正在打开' : '')),
            h('button', {
              key: 'clear',
              type: 'button',
              style: S.selClear,
              title: '取消选择（不删除任何东西）',
              onClick: () => setPicked({}),
            }, '取消选择'),
            // 一大段空白把"取消选择"和红色按钮隔开：这一步只是打开确认，不删任何东西。
            h('span', { key: 'gap', style: S.selGrow }),
            h('button', {
              key: 'go',
              type: 'button',
              style: S.dangerButton,
              disabled: busy !== '',
              onClick: () => { setAsk(''); setAskBatch(true) },
            }, '永久删除这 ' + pickedIds.length + ' 个…'),
          ]))
        }
      }

      // The bulk action gets its own card, away from 刷新, and its own confirm step.
      if (archived.length > 0) {
        if (ask === '__all') {
          // 同样的手法：卡片留在原位、槽位换成白色「取消」，红按钮在下面单独一块。
          blocks.push(h('div', { key: 'danger', style: S.dangerCard }, [
            h('span', { key: 'main', style: S.dangerMain }, [
              h('span', { key: 't', style: S.dangerTitle }, '删除全部已归档会话'),
              h('span', { key: 's', style: S.dangerSub }, archived.length + ' 个 · 合计 ' + fmt(archivedBytes) + ' · 不可撤销'),
            ]),
            h('span', { key: 'a', style: S.actions },
              h(Button, { size: 'sm', variant: 'primary', onClick: () => setAsk('') }, '取消')),
          ]))
          blocks.push(h('div', { key: 'danger-confirm', style: S.confirm }, [
            h('p', { key: 'q', style: S.confirmLine }, '确认永久删除全部 ' + archived.length + ' 个已归档会话？'),
            h('p', { key: 'm', style: S.confirmMeta },
              '合计 ' + fmt(archivedBytes) + '，连同它们的子会话一起删除；不可撤销。' +
              (archived.some((s) => s.live) ? '其中 ' + archived.filter((s) => s.live).length + ' 个此刻正打开着。' : '')),
            h('div', { key: 'a', style: S.confirmActions },
              h('button', {
                key: 'go',
                type: 'button',
                style: S.dangerButton,
                disabled: busy === '__all',
                onClick: () => run({ allArchived: true }),
              }, busy === '__all' ? '删除中…' : '永久删除这 ' + archived.length + ' 个')),
          ]))
        } else {
          blocks.push(h('div', { key: 'danger', style: S.dangerCard }, [
            h('span', { key: 'main', style: S.dangerMain }, [
              h('span', { key: 't', style: S.dangerTitle }, '删除全部已归档会话'),
              h('span', { key: 's', style: S.dangerSub }, archived.length + ' 个 · 合计 ' + fmt(archivedBytes) + ' · 不可撤销'),
            ]),
            h('span', { key: 'a', style: S.actions },
              h(Button, { size: 'sm', variant: 'outline', onClick: () => setAsk('__all') }, '永久删除…')),
          ]))
        }
      }

      if (state.loading && all.length === 0 && state.error === '') {
        blocks.push(h('p', { key: 'loading', style: S.empty }, '正在读取会话列表…'))
      } else if (!state.loading && visible.length === 0) {
        blocks.push(h('p', { key: 'empty', style: S.empty },
          all.length === 0 ? '没有找到任何会话。' : '没有匹配「' + query + '」的会话。'))
      }

      for (const wsName of groups) {
        const list = byWs.get(wsName)
        const total = list.reduce((sum, s) => sum + (typeof s.bytes === 'number' ? s.bytes : 0), 0)
        const rows = []
        for (const s of list) {
          const kids = childrenOf(s)
          const age = rel(s.mtimeMs)
          const asking = ask === s.id
          const facts = [
            h('span', { key: 'id', style: S.rowId }, shortId(s.id)),
            ' · ' + fmt(s.bytes),
            age === '' ? '' : ' · ' + age,
            asking && kids.length ? ' · 连同 ' + kids.length + ' 个子会话' : '',
            asking ? ' · 不可撤销' : '',
          ]
          rows.push(h('div', { key: s.id, style: asking ? S.rowAsk : S.row }, [
            h('span', { key: 'pick', style: S.select },
              h('input', {
                type: 'checkbox',
                style: S.checkbox,
                checked: picked[s.id] === true,
                'aria-label': '选择这个会话',
                onChange: () => { toggle(s.id) },
              })),
            h('span', { key: 'main', style: S.main }, [
              h('span', { key: 't', style: S.titleLine }, asking
                ? h('span', { key: 'q', style: S.rowTitle }, '确认删除「' + (s.title || shortId(s.id)) + '」？')
                : [
                    h('span', { key: 'name', style: S.rowTitle, title: s.title || s.id }, s.title || '(无标题会话)'),
                    s.live ? chip('打开中', 'live', S.chipLive) : null,
                    s.archived ? chip('已归档', 'arch') : null,
                    kids.length ? chip('子会话 ' + kids.length, 'kids') : null,
                    !s.known ? chip('无工作区', 'ws') : null,
                  ]),
              h('span', { key: 's', style: S.rowSub }, facts),
              asking && s.live
                ? h('span', { key: 'live', style: S.rowSub }, '正在打开：文件会被删除，它的列表项要等 DSH 重启后才消失')
                : null,
            ]),
            // 确认与取消就留在原来那个按钮位置上：取消占住指针刚停过的那一格，删除在它左边，
            // 所以既不用把鼠标挪到别处，也不会点到刚变过意义的那个按钮。
            h('span', { key: 'a', style: S.actions }, asking
              ? [
                  h('button', {
                    key: 'go',
                    type: 'button',
                    style: S.dangerButton,
                    disabled: busy === s.id,
                    onClick: () => run({ id: s.id, children: true }),
                  }, busy === s.id ? '删除中…' : '永久删除'),
                  h(Button, { key: 'cancel', size: 'sm', variant: 'primary', onClick: () => setAsk('') }, '取消'),
                ]
              : h(Button, {
                  size: 'sm',
                  variant: 'outline',
                  disabled: busy === s.id,
                  onClick: () => { setAskBatch(false); setAsk(s.id) },
                }, '删除')),
          ]))
        }
        blocks.push(h('div', { key: 'g:' + wsName, style: S.card }, [
          h('div', { key: 'h', style: S.groupHead }, [
            h('span', { key: 'ws', style: S.groupTitle }, wsName),
            h('span', { key: 'meta', style: S.groupMeta }, list.length + ' 个 · ' + fmt(total)),
          ]),
          ...rows,
        ]))
      }

      return h('div', { style: S.root }, blocks)
    }

    /** A render failure inside this panel must not reach the settings shell. */
    class Boundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: '' }
      }
      static getDerivedStateFromError(error) {
        return { error: String((error && error.message) || error) }
      }
      render() {
        if (this.state.error) {
          return h('p', { style: { font: 'inherit', opacity: 0.8 } },
            '「会话管理」面板渲染出错（不影响其他设置）：' + this.state.error)
        }
        return this.props.children
      }
    }

    function Section() {
      return h(Boundary, null, h(Panel, null))
    }

    /* ── 设置页导航里的标识 ───────────────────────────────────────────────── */

    /**
     * The settings shell picks nav glyphs from a closed list of section ids
     * (`models`, `agent-presets`, `plugins`) and falls back to its own gear for every
     * other id: `settings.section` projects only `id` / `order` / `label`, so a
     * registrant has no icon to pass. Every third-party section therefore wears the
     * gear — `dshmarket`, `dsh-better-sidebar` and `dsh-skill-mcp-panel` claim their
     * own row once the dialog is mounted and swap the gear for their mark.
     *
     * This is that same trick with a bin: the nav row whose visible text equals our
     * label gets a marker, and an injected stylesheet hides the shell's gear and
     * paints our SVG through a `mask-image` in `currentColor` — so the glyph follows
     * the theme for free. The marker and the stylesheet belong to a `ctx.effect`, so
     * they disappear with the fiber.
     */
    const NAV_ICON_MARKER = 'data-dsh-session-purge-nav-icon'
    const NAV_ROW_SELECTOR = '[role="dialog"] nav button'
    /** A bin: this page exists to throw sessions away. */
    const NAV_MARK_SVG = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">',
      '<path d="M2.6 4.4h10.8"/>',
      '<path d="M6.1 4.4V3.1a1 1 0 0 1 1-1h1.8a1 1 0 0 1 1 1v1.3"/>',
      '<path d="M4.1 4.4l.7 8.1a1.3 1.3 0 0 0 1.3 1.2h3.8a1.3 1.3 0 0 0 1.3-1.2l.7-8.1"/>',
      '<path d="M6.9 7.1v3.7M9.1 7.1v3.7"/>',
      '</svg>',
    ].join('')

    function navIconCss(maskUrl) {
      return [
        `[${NAV_ICON_MARKER}] > svg { display: none; }`,
        `[${NAV_ICON_MARKER}]::before {`,
        `  content: '';`,
        `  flex: none;`,
        `  width: 16px;`,
        `  height: 16px;`,
        `  background-color: currentColor;`,
        `  -webkit-mask-image: url("${maskUrl}");`,
        `  mask-image: url("${maskUrl}");`,
        `  -webkit-mask-repeat: no-repeat;`,
        `  mask-repeat: no-repeat;`,
        `  -webkit-mask-position: center;`,
        `  mask-position: center;`,
        `  -webkit-mask-size: 16px 16px;`,
        `  mask-size: 16px 16px;`,
        `}`,
      ].join('\n')
    }

    /** Mark the one nav row this section owns; removed with the fiber. */
    function installSettingsNavIcon(ctx) {
      if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
      ctx.effect(() => {
        const tag = document.createElement('style')
        tag.dataset.plugin = 'dsh-plugin-session-purge'
        tag.dataset.pluginCss = 'dsh-plugin-session-purge/settings-nav-icon'
        tag.textContent = navIconCss(`data:image/svg+xml,${encodeURIComponent(NAV_MARK_SVG)}`)
        document.head.appendChild(tag)
        let disposed = false
        let scheduled = false
        const sync = () => {
          scheduled = false
          if (disposed) return
          for (const row of document.querySelectorAll(NAV_ROW_SELECTOR)) {
            if (String(row.textContent ?? '').trim() === SECTION_LABEL) row.setAttribute(NAV_ICON_MARKER, '')
            else row.removeAttribute(NAV_ICON_MARKER)
          }
        }
        const schedule = () => {
          if (scheduled || disposed) return
          scheduled = true
          queueMicrotask(sync)
        }
        sync()
        const observer = new MutationObserver(schedule)
        observer.observe(document.body, { childList: true, subtree: true, characterData: true })
        return () => {
          disposed = true
          observer.disconnect()
          for (const row of document.querySelectorAll(`[${NAV_ICON_MARKER}]`)) row.removeAttribute(NAV_ICON_MARKER)
          tag.remove()
        }
      }, 'dsh-plugin-session-purge: settings nav icon')
    }

    const inject = ['slots']

    function apply(ctx) {
      installSettingsNavIcon(ctx)
      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          { name: 'settings.section', id: 'session-purge', order: 90, label: SECTION_LABEL },
          Section,
        ))
    }

    exports.apply = apply
    exports.inject = inject
    return module.exports
  },
})
