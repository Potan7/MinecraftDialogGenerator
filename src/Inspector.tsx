// 인스펙터 패널: 선택된 노드의 정보를 표시/수정하고, 파일 입출력을 제공합니다.
// - useSelectedNode()로 선택된 노드를 읽습니다.
// - 입력값을 변경하면 즉시 store.updateNode로 반영되어 캔버스와 동기화됩니다.
// - Import/Export 버튼으로 JSON 파일로 상태를 불러오거나 저장합니다.
import { useEffect, useRef, useState } from 'react'
import { useSelectedNode, useStore } from './store'
import { cleanDialog } from './serialize'
import type { DialogType, DialogAfterAction, BodyElement, ClickAction, ActionDef, BodyPlainMessage, BodyItemElement, MCText } from './store'
import { importNodesFromFile, exportNodesToFile } from './fileService'

export default function Inspector() {
  const node = useSelectedNode() // 선택된 노드(없으면 null)
  const updateNode = useStore((s) => s.updateNode)
  const renameNode = useStore((s) => s.renameNode)

  // 인스펙터 가변 너비 상태(로컬 스토리지에 저장)
  const MIN_W = 240
  const MAX_W = 720
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem('inspectorWidth')
    const n = saved ? Number(saved) : NaN
    return Number.isFinite(n) ? Math.min(MAX_W, Math.max(MIN_W, n)) : 300
  })
  useEffect(() => {
    localStorage.setItem('inspectorWidth', String(width))
  }, [width])
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)
  const onResizeDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = { startX: e.clientX, startW: width }
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = dragRef.current.startX - ev.clientX // 왼쪽으로 당기면 +폭
      const next = Math.min(MAX_W, Math.max(MIN_W, Math.round(dragRef.current.startW + dx)))
      setWidth(next)
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // no-op

  // 공통 유틸: MCText 편집기 (간단 버전)
  const MCTextEditor = ({ value, onChange, label }: { value: MCText; onChange: (t: MCText) => void; label: string }) => {
    const [draft, setDraft] = useState<MCText>(value ?? { text: '' })
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const debounceRef = useRef<number | null>(null)
    useEffect(() => {
      // 동기화: 주요 필드 변화만 반영
      setDraft((prev) => ({ ...prev, ...value }))
    }, [value])
    useEffect(() => {
      // 편집 중에는 리렌더 후에도 포커스를 유지합니다.
      if (isTyping && inputRef.current) {
        inputRef.current.focus()
      }
    }, [isTyping, draft.text, draft.translate])

    const scheduleCommit = (next: MCText) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        onChange(next)
        debounceRef.current = null
      }, 200)
    }
    const flushCommit = () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      onChange(draft)
    }
  const commit = () => onChange(draft)
  const set = (patch: Partial<MCText>) => setDraft((d) => ({ ...d, ...patch }))
    return (
      <div style={{ border: '1px solid #e5e5e5', borderRadius: 6, padding: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
        <div style={{ display: 'grid', gap: 6 }}>
          <label>
            <div style={{ fontSize: 12, color: '#555' }}>Content Type</div>
            <select
              value={draft.type ?? (draft.translate ? 'translatable' : 'text')}
              onChange={(e) => {
                const t = e.target.value as MCText['type']
                if (t === 'translatable') {
                  const next = { ...draft, type: 'translatable' as const, translate: draft.translate ?? '', text: undefined }
                  setDraft(next)
                  onChange(next)
                } else {
                  const next = { ...draft, type: 'text' as const, text: draft.text ?? '', translate: undefined, with: undefined }
                  setDraft(next)
                  onChange(next)
                }
              }}
            >
              <option value="text">text</option>
              <option value="translatable">translatable</option>
            </select>
          </label>

          {(draft.type === 'translatable' || (!draft.type && draft.translate)) ? (
            <>
              <label>
                <div style={{ fontSize: 12, color: '#555' }}>translate</div>
                <input
                  ref={inputRef}
                  value={draft.translate ?? ''}
                  onChange={(e) => {
                    const next = { ...draft, translate: e.target.value }
                    setDraft(next)
                    scheduleCommit(next)
                  }}
                  onFocus={() => setIsTyping(true)}
                    onBlur={() => { setIsTyping(false); flushCommit() }}
                  onKeyDown={(e) => e.stopPropagation()}
                  onKeyUp={(e) => e.stopPropagation()}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, color: '#555' }}>fallback</div>
                <input
                  value={draft.fallback ?? ''}
                  onChange={(e) => {
                    const v = e.target.value || undefined
                    const next = { ...draft, fallback: v }
                    setDraft(next)
                    scheduleCommit(next)
                  }}
                />
              </label>
            </>
          ) : (
            <label>
              <div style={{ fontSize: 12, color: '#555' }}>text</div>
              <input
                ref={inputRef}
                value={draft.text ?? ''}
                onChange={(e) => {
                  const next = { ...draft, text: e.target.value }
                  setDraft(next)
                  scheduleCommit(next)
                }}
                onFocus={() => setIsTyping(true)}
                  onBlur={() => { setIsTyping(false); flushCommit() }}
                onKeyDown={(e) => e.stopPropagation()}
                onKeyUp={(e) => e.stopPropagation()}
              />
            </label>
          )}

          {/* Formatting */}
          <label>
            <div style={{ fontSize: 12, color: '#555' }}>color</div>
            <input
              value={draft.color ?? ''}
              onChange={(e) => {
                const v = e.target.value || undefined
                const next = { ...draft, color: v }
                setDraft(next)
                scheduleCommit(next)
              }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['bold', 'italic', 'underlined', 'strikethrough', 'obfuscated'] as const).map((k) => (
              <label key={k} className="checkbox-row" style={{ gap: 4 }}>
                <input
                  type="checkbox"
                  checked={!!draft[k]}
                  onChange={(e) => {
                    const next = { ...draft, [k]: e.target.checked } as MCText
                    setDraft(next)
                    onChange(next)
                  }}
                />
                <span>{k}</span>
              </label>
            ))}
          </div>

          {/* Hover text (show_text) */}
          <div className="checkbox-row">
            <input
              id={`${label}-hover-enabled`}
              type="checkbox"
              checked={draft.hover_event?.action === 'show_text'}
              onChange={(e) => {
                if (e.target.checked) {
                  const next = { ...draft, hover_event: { action: 'show_text', value: { text: '' } } as MCText['hover_event'] }
                  setDraft(next)
                  onChange(next)
                } else {
                  const next: MCText = { ...draft, hover_event: undefined }
                  setDraft(next)
                  onChange(next)
                }
              }}
            />
            <label htmlFor={`${label}-hover-enabled`}>hover_event: show_text</label>
          </div>
          {draft.hover_event?.action === 'show_text' && (
            <label>
              <div style={{ fontSize: 12, color: '#555' }}>hover text</div>
              <input
                value={(draft.hover_event.action === 'show_text' ? draft.hover_event.value.text : '') ?? ''}
                onChange={(e) => {
                  if (draft.hover_event?.action === 'show_text') {
                    const hv = { action: 'show_text', value: { ...draft.hover_event.value, text: e.target.value } } as Extract<NonNullable<MCText['hover_event']>, { action: 'show_text' }>
                    const next = { ...draft, hover_event: hv }
                    setDraft(next)
                    scheduleCommit(next)
                  }
                }}
              />
            </label>
          )}

          {/* Click event (subset) */}
          <label>
            <div style={{ fontSize: 12, color: '#555' }}>click_event</div>
            <select
              value={draft.click_event?.action ?? ''}
        onChange={(e) => {
                const t = e.target.value as NonNullable<MCText['click_event']>['action']
                if (!t) {
          const next: MCText = { ...draft, click_event: undefined }
          setDraft(next)
          onChange(next)
                  return
                }
                const empty = (): NonNullable<MCText['click_event']> => {
                  switch (t) {
                    case 'open_url': return { action: t, url: '' }
                    case 'open_file': return { action: t, path: '' }
                    case 'run_command': return { action: t, command: '' }
                    case 'suggest_command': return { action: t, command: '' }
                    case 'change_page': return { action: t, page: 1 }
                    case 'copy_to_clipboard': return { action: t, value: '' }
                    case 'show_dialog': return { action: t, dialog: '' }
                    case 'custom': return { action: t, id: '', payload: '' }
                  }
                }
                const next = { ...draft, click_event: empty() }
                setDraft(next)
                onChange(next)
              }}
            >
              <option value="">(none)</option>
              <option value="open_url">open_url</option>
              <option value="run_command">run_command</option>
              <option value="suggest_command">suggest_command</option>
              <option value="change_page">change_page</option>
              <option value="copy_to_clipboard">copy_to_clipboard</option>
              <option value="show_dialog">show_dialog</option>
              <option value="custom">custom</option>
            </select>
          </label>
          {draft.click_event?.action === 'open_url' && (
            <label>
              <div style={{ fontSize: 12, color: '#555' }}>url</div>
              <input
                value={(draft.click_event && draft.click_event.action === 'open_url') ? draft.click_event.url : ''}
                onChange={(e) => set({ click_event: { action: 'open_url', url: e.target.value } })}
                onBlur={commit}
              />
            </label>
          )}
          {draft.click_event?.action === 'run_command' && (
            <label>
              <div style={{ fontSize: 12, color: '#555' }}>command</div>
              <input
                value={(draft.click_event && draft.click_event.action === 'run_command') ? draft.click_event.command : ''}
                onChange={(e) => set({ click_event: { action: 'run_command', command: e.target.value } })}
                onBlur={commit}
              />
            </label>
          )}
          {draft.click_event?.action === 'suggest_command' && (
            <label>
              <div style={{ fontSize: 12, color: '#555' }}>command</div>
              <input
                value={(draft.click_event && draft.click_event.action === 'suggest_command') ? draft.click_event.command : ''}
                onChange={(e) => set({ click_event: { action: 'suggest_command', command: e.target.value } })}
                onBlur={commit}
              />
            </label>
          )}
          {draft.click_event?.action === 'change_page' && (
            <label>
              <div style={{ fontSize: 12, color: '#555' }}>page</div>
              <input
                type="number"
                value={(draft.click_event && draft.click_event.action === 'change_page') ? draft.click_event.page : 1}
                onChange={(e) => set({ click_event: { action: 'change_page', page: Number(e.target.value) || 1 } })}
                onBlur={commit}
              />
            </label>
          )}
          {draft.click_event?.action === 'copy_to_clipboard' && (
            <label>
              <div style={{ fontSize: 12, color: '#555' }}>value</div>
              <input
                value={(draft.click_event && draft.click_event.action === 'copy_to_clipboard') ? draft.click_event.value : ''}
                onChange={(e) => set({ click_event: { action: 'copy_to_clipboard', value: e.target.value } })}
                onBlur={commit}
              />
            </label>
          )}
          {draft.click_event?.action === 'show_dialog' && (
            <label>
              <div style={{ fontSize: 12, color: '#555' }}>dialog id</div>
              <input
                value={(draft.click_event && draft.click_event.action === 'show_dialog' && typeof draft.click_event.dialog === 'string') ? draft.click_event.dialog : ''}
                onChange={(e) => set({ click_event: { action: 'show_dialog', dialog: e.target.value } })}
                onBlur={commit}
              />
            </label>
          )}
          {draft.click_event?.action === 'custom' && (
            <div style={{ display: 'flex', gap: 6 }}>
              <label style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#555' }}>id</div>
                <input
                  value={(draft.click_event && draft.click_event.action === 'custom') ? draft.click_event.id : ''}
                  onChange={(e) => set({ click_event: { action: 'custom', id: e.target.value, payload: (draft.click_event && draft.click_event.action === 'custom') ? draft.click_event.payload : '' } })}
                  onBlur={commit}
                />
              </label>
              <label style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#555' }}>payload</div>
                <input
                  value={(draft.click_event && draft.click_event.action === 'custom') ? (draft.click_event.payload ?? '') : ''}
                  onChange={(e) => set({ click_event: { action: 'custom', id: (draft.click_event && draft.click_event.action === 'custom') ? (draft.click_event.id ?? '') : '', payload: e.target.value } })}
                  onBlur={commit}
                />
              </label>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 공통 유틸: ClickAction 편집 UI
  const ClickActionEditor = ({ value, onChange, label }: {
    value: ClickAction | undefined
    onChange: (next: ClickAction | undefined) => void
    label: string
  }) => {
    // 로컬 버퍼 상태로 편집 중 선택 해제 플리커를 방지하고, blur 시 커밋합니다.
    const [draft, setDraft] = useState<ClickAction>(value ?? { label: { text: '' } })
    // 값 변경(외부에서 바뀐 경우)에 동기화하되, 기본적인 동작은 현재 draft 유지
    useEffect(() => {
      // 외부 값이 비었으면 초기화
      if (!value) {
        setDraft({ label: { text: '' } })
      } else {
        // 얕은 동기화: 주요 필드가 변경되었을 때만 반영
        setDraft((prev) => ({
          label: value.label ?? prev.label,
          tooltip: value.tooltip,
          width: value.width,
          action: value.action,
        }))
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value?.label?.text, value?.tooltip?.text, value?.width, value?.action && JSON.stringify(value.action)])

    const commit = () => {
      onChange(draft)
    }
    const set = (patch: Partial<ClickAction>) => setDraft((v) => ({ ...v, ...patch }))
    const setAction = (patch: ActionDef | undefined) => set({ action: patch })
    return (
      <div style={{ border: '1px solid #e5e5e5', borderRadius: 6, padding: 8 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
        <div style={{ display: 'grid', gap: 6 }}>
          <MCTextEditor
            label="Label"
            value={draft.label ?? { text: '' }}
            onChange={(t) => {
              setDraft((prev) => {
                const next = { ...prev, label: t }
                onChange(next)
                return next
              })
            }}
          />
          <MCTextEditor
            label="Tooltip"
            value={draft.tooltip ?? { text: '' }}
            onChange={(t) => {
              setDraft((prev) => {
                const next = { ...prev, tooltip: t }
                onChange(next)
                return next
              })
            }}
          />
          <label>
            <div style={{ fontSize: 12, color: '#555' }}>Width (1~1024)</div>
            <input
              type="number"
              min={1}
              max={1024}
              value={draft.width ?? ''}
              onChange={(e) => {
                const w = e.target.value ? Number(e.target.value) : undefined
                setDraft((prev) => ({ ...prev, width: w }))
              }}
              onBlur={() => onChange(draft)}
            />
          </label>
          {/* ActionDef 선택 */}
          <div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Action</div>
            <select
              value={draft.action?.type ?? ''}
              onChange={(e) => {
                const t = e.target.value
                const buildEmpty = (type: ActionDef['type']): ActionDef => {
                  switch (type) {
                    case 'open_url': return { type, url: '' }
                    case 'run_command': return { type, command: '' }
                    case 'suggest_command': return { type, command: '' }
                    case 'change_page': return { type, page: 1 }
                    case 'copy_to_clipboard': return { type, value: '' }
                    case 'show_dialog': return { type, dialog: '' }
                    case 'custom': return { type, id: '', payload: '' }
                    case 'dynamic/run_command': return { type, template: '' }
                    case 'dynamic/custom': return { type, id: '', additions: {} }
                    default: return { type: 'run_command', command: '' }
                  }
                }
                if (!t) {
                  const next = { ...draft, action: undefined as ActionDef | undefined }
                  setDraft(next)
                  onChange(next)
                  return
                }
                const next = { ...draft, action: buildEmpty(t as ActionDef['type']) }
                setDraft(next)
                onChange(next)
              }}
            >
              <option value="">(none)</option>
              <option value="open_url">open_url</option>
              <option value="run_command">run_command</option>
              <option value="suggest_command">suggest_command</option>
              <option value="change_page">change_page</option>
              <option value="copy_to_clipboard">copy_to_clipboard</option>
              <option value="show_dialog">show_dialog</option>
              <option value="custom">custom</option>
              <option value="dynamic/run_command">dynamic/run_command</option>
              <option value="dynamic/custom">dynamic/custom</option>
            </select>
      {draft.action?.type === 'open_url' && (
              <label style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12, color: '#555' }}>url</div>
        <input value={draft.action.url ?? ''} onChange={(e) => setAction({ type: 'open_url', url: e.target.value })} onBlur={commit} />
              </label>
            )}
      {draft.action?.type === 'run_command' && (
              <label style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12, color: '#555' }}>command</div>
        <input value={draft.action.command ?? ''} onChange={(e) => setAction({ type: 'run_command', command: e.target.value })} onBlur={commit} />
              </label>
            )}
      {draft.action?.type === 'suggest_command' && (
              <label style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12, color: '#555' }}>command</div>
        <input value={draft.action.command ?? ''} onChange={(e) => setAction({ type: 'suggest_command', command: e.target.value })} onBlur={commit} />
              </label>
            )}
      {draft.action?.type === 'change_page' && (
              <label style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12, color: '#555' }}>page</div>
        <input type="number" value={(draft.action as Extract<ActionDef,{type:'change_page'}>).page ?? 1} onChange={(e) => setAction({ type: 'change_page', page: Number(e.target.value) || 1 })} onBlur={commit} />
              </label>
            )}
      {draft.action?.type === 'copy_to_clipboard' && (
              <label style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12, color: '#555' }}>value</div>
        <input value={(draft.action as Extract<ActionDef,{type:'copy_to_clipboard'}>).value ?? ''} onChange={(e) => setAction({ type: 'copy_to_clipboard', value: e.target.value })} onBlur={commit} />
              </label>
            )}
      {draft.action?.type === 'show_dialog' && (
              <label style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12, color: '#555' }}>dialog ID</div>
        <input value={typeof draft.action.dialog === 'string' ? draft.action.dialog : ''}
          onChange={(e) => setAction({ type: 'show_dialog', dialog: e.target.value })} onBlur={commit} />
              </label>
            )}
            {draft.action?.type === 'custom' && (() => {
              const a = draft.action as Extract<ActionDef, { type: 'custom' }>
              return (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <label style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#555' }}>id</div>
                  <input value={a.id ?? ''} onChange={(e) => setAction({ type: 'custom', id: e.target.value, payload: a.payload })} onBlur={commit} />
                </label>
                <label style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#555' }}>payload</div>
                  <input value={a.payload ?? ''} onChange={(e) => setAction({ type: 'custom', id: a.id ?? '', payload: e.target.value })} onBlur={commit} />
                </label>
              </div>
              )
            })()}
      {draft.action?.type === 'dynamic/run_command' && (
              <label style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12, color: '#555' }}>template</div>
        <input value={(draft.action as Extract<ActionDef,{type:'dynamic/run_command'}>).template ?? ''} onChange={(e) => setAction({ type: 'dynamic/run_command', template: e.target.value })} onBlur={commit} />
              </label>
            )}
            {draft.action?.type === 'dynamic/custom' && (() => {
              const a = draft.action as Extract<ActionDef, { type: 'dynamic/custom' }>
              return (
              <label style={{ marginTop: 6 }}>
                <div style={{ fontSize: 12, color: '#555' }}>id</div>
                <input value={a.id ?? ''} onChange={(e) => setAction({ type: 'dynamic/custom', id: e.target.value, additions: a.additions })} onBlur={commit} />
              </label>
              )
            })()}
          </div>
        </div>
        <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setDraft({ label: { text: '' } })
              onChange(undefined)
            }}
          >
            Clear
          </button>
        </div>
      </div>
    )
  }

  if (!node) {
    return (
      <div className="inspector">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Inspector</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={importNodesFromFile}>Import</button>
            <button onClick={exportNodesToFile}>Export</button>
          </div>
        </div>
        <p>No node selected</p>
      </div>
    )
  }

  return (
    <div className="inspector" style={{ width }}>
      {/* 리사이저 핸들: 인스펙터 왼쪽 가장자리에서 드래그로 폭 조절 */}
      <div
        onMouseDown={onResizeDown}
        title="Drag to resize"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 6,
          height: '100%',
          cursor: 'ew-resize',
          // 시각적 가이드(얇은 선) + 넓은 히트영역(투명)
          background: 'transparent',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: 1,
            height: '100%',
            background: '#cfcfcf',
          }}
        />
      </div>
      {/* 패널 헤더: 파일 Import/Export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>Inspector</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={importNodesFromFile}>Import</button>
          <button onClick={exportNodesToFile}>Export</button>
          <button onClick={() => useStore.getState().deleteNode(useStore.getState().selectedNodeId!)} style={{ color: '#b00' }}>Delete</button>
        </div>
      </div>
      {/* 필드 편집 폼 */}
      <div style={{ display: 'grid', gap: '8px' }}>
        <label>
          <div style={{ fontSize: 12, color: '#555' }}>ID</div>
          <input
            value={node.id}
            onChange={(e) => {
              const newId = e.target.value
              if (!newId) return
              // ID 변경을 원자적으로 처리하여 selection이 풀리지 않도록 함
              renameNode(node.id, newId)
            }}
          />
        </label>
        {/* Dialog(JSON) 편집 */}
        <div style={{ marginTop: 8, borderTop: '1px solid #eee', paddingTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Dialog</div>

          {/* type */}
          <label>
            <div style={{ fontSize: 12, color: '#555' }}>Type</div>
            <select
              value={node.dialog?.type ?? 'minecraft:notice'}
              onChange={(e) =>
                updateNode(node.id, { dialog: { ...node.dialog, type: e.target.value as DialogType } })
              }
              style={{ width: '100%' }}
            >
              <option value="minecraft:notice">minecraft:notice</option>
              <option value="minecraft:confirmation">minecraft:confirmation</option>
              <option value="minecraft:multi_action">minecraft:multi_action</option>
              <option value="minecraft:server_links">minecraft:server_links</option>
              <option value="minecraft:dialog_list">minecraft:dialog_list</option>
            </select>
          </label>

          {/* title: MCText editor */}
          <MCTextEditor
            label="Title"
            value={node.dialog?.title ?? { text: '' }}
            onChange={(t) => updateNode(node.id, { dialog: { ...node.dialog, title: t } })}
          />

          {/* external_title enable + text */}
          <div className="checkbox-row">
            <input
              id="ext-title-enabled"
              type="checkbox"
              checked={!!node.dialog?.external_title}
              onChange={(e) =>
                updateNode(node.id, {
                  dialog: {
                    ...node.dialog,
                    external_title: e.target.checked
                      ? node.dialog?.external_title ?? { text: '' }
                      : undefined,
                  },
                })
              }
            />
            <label htmlFor="ext-title-enabled">Use External Title</label>
          </div>
          {node.dialog?.external_title && (
            <MCTextEditor
              label="External Title"
              value={node.dialog.external_title}
              onChange={(t) => updateNode(node.id, { dialog: { ...node.dialog, external_title: t } })}
            />
          )}

          {/* body: 리스트 에디터 (노드 기반) */}
          <div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>Body</div>
            <div className="list">
              {(() => {
                const b = node.dialog?.body
                const arr: BodyElement[] = Array.isArray(b) ? b : b ? [b] : []

                const setArr = (next: BodyElement[]) => {
                  const nextBody: BodyElement | BodyElement[] | undefined =
                    next.length <= 1 ? next[0] : next
                  updateNode(node.id, { dialog: { ...node.dialog, body: nextBody } })
                }

                const updateAt = (i: number, nextItem: BodyElement) => {
                  const next = [...arr]
                  next[i] = nextItem
                  setArr(next)
                }

                const hasContents = (
                  d: BodyItemElement['description']
                ): d is { contents: MCText; width?: number } =>
                  typeof d === 'object' && d !== null && 'contents' in d

                const renderPlain = (it: BodyPlainMessage, i: number) => (
                  <div key={i} style={{ border: '1px solid #e5e5e5', borderRadius: 6, padding: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>minecraft:plain_message</strong>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="icon-btn" onClick={() => {
                          const next = [...arr]
                          next.splice(i, 1)
                          setArr(next)
                        }}>Remove</button>
                      </div>
                    </div>
                    <MCTextEditor
                      label="contents"
                      value={it.contents ?? { text: '' }}
                      onChange={(t) => updateAt(i, { ...it, contents: t })}
                    />
                    <label>
                      <div style={{ fontSize: 12, color: '#555' }}>width</div>
                      <input type="number" min={1} max={1024}
                        value={it.width ?? 200}
                        onChange={(e) => updateAt(i, { ...it, width: Number(e.target.value) || undefined })}
                      />
                    </label>
                  </div>
                )

                const renderItem = (it: BodyItemElement, i: number) => (
                  <div key={i} style={{ border: '1px solid #e5e5e5', borderRadius: 6, padding: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>minecraft:item</strong>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" className="icon-btn" onClick={() => {
                          const next = [...arr]
                          next.splice(i, 1)
                          setArr(next)
                        }}>Remove</button>
                      </div>
                    </div>
                    {/* item stack */}
                    <div style={{ display: 'grid', gap: 6 }}>
                      <label>
                        <div style={{ fontSize: 12, color: '#555' }}>item.id</div>
                        <input value={it.item?.id ?? ''} onChange={(e) => updateAt(i, { ...it, item: { ...(it.item ?? { id: '', count: 1 }), id: e.target.value } })} />
                      </label>
                      <label>
                        <div style={{ fontSize: 12, color: '#555' }}>item.count</div>
                        <input type="number" min={1} value={it.item?.count ?? 1} onChange={(e) => updateAt(i, { ...it, item: { ...(it.item ?? { id: '', count: 1 }), count: Math.max(1, Number(e.target.value) || 1) } })} />
                      </label>
                    </div>
                    {/* description */}
                    <div style={{ marginTop: 6 }}>
                      <div className="checkbox-row">
                        <input id={`desc-${i}`} type="checkbox" checked={!!it.description}
                          onChange={(e) => updateAt(i, { ...it, description: e.target.checked ? (it.description ?? { contents: { text: '' } }) : undefined })}
                        />
                        <label htmlFor={`desc-${i}`}>Use description</label>
                      </div>
                      {it.description && (
                        <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
                          <MCTextEditor
                            label="description.contents"
                            value={!it.description ? { text: '' } : hasContents(it.description) ? it.description.contents : it.description}
                            onChange={(t) => {
                              let nextDesc: BodyItemElement['description']
                              if (!it.description) {
                                nextDesc = { contents: t }
                              } else if (hasContents(it.description)) {
                                nextDesc = { ...it.description, contents: t }
                              } else {
                                // it.description is MCText
                                nextDesc = t
                              }
                              updateAt(i, { ...it, description: nextDesc })
                            }}
                          />
                          <label>
                            <div style={{ fontSize: 12, color: '#555' }}>description.width</div>
                            <input
                              type="number"
                              min={1}
                              max={1024}
                              value={it.description && hasContents(it.description) ? (it.description.width ?? 200) : 200}
                              onChange={(e) => {
                                const w = Number(e.target.value) || undefined
                                let nextDesc: BodyItemElement['description']
                                if (!it.description) {
                                  nextDesc = { contents: { text: '' }, width: w }
                                } else if (hasContents(it.description)) {
                                  nextDesc = { ...it.description, width: w }
                                } else {
                                  // it.description is MCText
                                  nextDesc = { contents: it.description, width: w }
                                }
                                updateAt(i, { ...it, description: nextDesc })
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                    {/* flags and size */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <label className="checkbox-row">
                        <input type="checkbox" checked={it.show_decoration !== false}
                          onChange={(e) => updateAt(i, { ...it, show_decoration: e.target.checked ? true : false })}
                        />
                        <span>show_decoration</span>
                      </label>
                      <label className="checkbox-row">
                        <input type="checkbox" checked={it.show_tooltip !== false}
                          onChange={(e) => updateAt(i, { ...it, show_tooltip: e.target.checked ? true : false })}
                        />
                        <span>show_tooltip</span>
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <label style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#555' }}>width</div>
                        <input type="number" min={1} max={256}
                          value={it.width ?? 16}
                          onChange={(e) => updateAt(i, { ...it, width: Math.max(1, Math.min(256, Number(e.target.value) || 16)) })}
                        />
                      </label>
                      <label style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: '#555' }}>height</div>
                        <input type="number" min={1} max={256}
                          value={it.height ?? 16}
                          onChange={(e) => updateAt(i, { ...it, height: Math.max(1, Math.min(256, Number(e.target.value) || 16)) })}
                        />
                      </label>
                    </div>
                  </div>
                )

                return (
                  <>
                    {arr.map((item, idx) => item.type === 'minecraft:plain_message'
                      ? renderPlain(item as BodyPlainMessage, idx)
                      : renderItem(item as BodyItemElement, idx))}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="icon-btn" onClick={() => setArr([...arr, { type: 'minecraft:plain_message', contents: { text: '' }, width: 200 }])}>+ Add plain_message</button>
                      <button type="button" className="icon-btn" onClick={() => setArr([...arr, { type: 'minecraft:item', item: { id: '', count: 1 } }])}>+ Add item</button>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>

          {/* flags */}
          <div style={{ display: 'flex', gap: 8 }}>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={!!node.dialog?.can_close_with_escape}
                onChange={(e) =>
                  updateNode(node.id, {
                    dialog: { ...node.dialog, can_close_with_escape: e.target.checked },
                  })
                }
              />
              <span>can_close_with_escape</span>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={!!node.dialog?.pause}
                onChange={(e) =>
                  updateNode(node.id, { dialog: { ...node.dialog, pause: e.target.checked } })
                }
              />
              <span>pause</span>
            </label>
          </div>

          {/* after_action */}
          <label style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: '#555' }}>after_action</div>
            <select
              value={node.dialog?.after_action ?? 'close'}
              onChange={(e) =>
                updateNode(node.id, { dialog: { ...node.dialog, after_action: e.target.value as DialogAfterAction } })
              }
            >
              <option value="close">close</option>
              <option value="none">none</option>
              <option value="wait_for_response">wait_for_response</option>
            </select>
          </label>

          {/* Type-specific sections */}
          {node.dialog?.type === 'minecraft:notice' && (
            <div style={{ marginTop: 12 }}>
              <ClickActionEditor
                label="Action"
                value={node.dialog.action}
                onChange={(next) => updateNode(node.id, { dialog: { ...node.dialog, action: next } })}
              />
            </div>
          )}

          {node.dialog?.type === 'minecraft:confirmation' && (
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <ClickActionEditor
                label="Yes"
                value={node.dialog.yes}
                onChange={(next) => updateNode(node.id, { dialog: { ...node.dialog, yes: next } })}
              />
              <ClickActionEditor
                label="No"
                value={node.dialog.no}
                onChange={(next) => updateNode(node.id, { dialog: { ...node.dialog, no: next } })}
              />
            </div>
          )}

          {node.dialog?.type === 'minecraft:multi_action' && (
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <label>
                <div style={{ fontSize: 12, color: '#555' }}>columns</div>
                <input
                  type="number"
                  min={1}
                  value={node.dialog.columns ?? 2}
                  onChange={(e) => updateNode(node.id, { dialog: { ...node.dialog, columns: Math.max(1, Number(e.target.value) || 1) } })}
                />
              </label>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Actions</div>
                {(node.dialog.actions ?? []).map((ca, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <ClickActionEditor
                      label={`Action #${i + 1}`}
                      value={ca}
                      onChange={(next) => {
                        const list = [...(node.dialog.actions ?? [])]
                        list[i] = next ?? { label: { text: '' } }
                        updateNode(node.id, { dialog: { ...node.dialog, actions: list } })
                      }}
                    />
                    <div style={{ marginTop: 6 }}>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          const list = (node.dialog.actions ?? []).filter((_, idx) => idx !== i)
                          updateNode(node.id, { dialog: { ...node.dialog, actions: list } })
                        }}
                      >
                        Remove action
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    const list = [...(node.dialog.actions ?? []), { label: { text: '' } }]
                    updateNode(node.id, { dialog: { ...node.dialog, actions: list } })
                  }}
                >
                  + Add action
                </button>
              </div>
              <ClickActionEditor
                label="Exit Action"
                value={node.dialog.exit_action}
                onChange={(next) => updateNode(node.id, { dialog: { ...node.dialog, exit_action: next } })}
              />
            </div>
          )}

          {node.dialog?.type === 'minecraft:server_links' && (
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <label>
                <div style={{ fontSize: 12, color: '#555' }}>columns</div>
                <input
                  type="number"
                  min={1}
                  value={node.dialog.columns ?? 2}
                  onChange={(e) => updateNode(node.id, { dialog: { ...node.dialog, columns: Math.max(1, Number(e.target.value) || 1) } })}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, color: '#555' }}>button_width</div>
                <input
                  type="number"
                  min={1}
                  max={1024}
                  value={node.dialog.button_width ?? 150}
                  onChange={(e) => updateNode(node.id, { dialog: { ...node.dialog, button_width: Math.min(1024, Math.max(1, Number(e.target.value) || 150)) } })}
                />
              </label>
              <ClickActionEditor
                label="Exit Action"
                value={node.dialog.exit_action}
                onChange={(next) => updateNode(node.id, { dialog: { ...node.dialog, exit_action: next } })}
              />
            </div>
          )}

          {node.dialog?.type === 'minecraft:dialog_list' && (
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <label>
                <div style={{ fontSize: 12, color: '#555' }}>columns</div>
                <input
                  type="number"
                  min={1}
                  value={node.dialog.columns ?? 2}
                  onChange={(e) => updateNode(node.id, { dialog: { ...node.dialog, columns: Math.max(1, Number(e.target.value) || 1) } })}
                />
              </label>
              <label>
                <div style={{ fontSize: 12, color: '#555' }}>button_width</div>
                <input
                  type="number"
                  min={1}
                  max={1024}
                  value={node.dialog.button_width ?? 150}
                  onChange={(e) => updateNode(node.id, { dialog: { ...node.dialog, button_width: Math.min(1024, Math.max(1, Number(e.target.value) || 150)) } })}
                />
              </label>

              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Dialogs (IDs)</div>
                {(node.dialog.dialogs ?? []).map((d, i) => {
                  const DialogIdInput = ({ initial, onCommit }: { initial: string; onCommit: (v: string) => void }) => {
                    const [v, setV] = useState(initial)
                    useEffect(() => setV(initial), [initial])
                    return (
                      <input
                        type="text"
                        value={v}
                        onChange={(e) => setV(e.target.value)}
                        onBlur={() => onCommit(v)}
                      />
                    )
                  }
                  return (
                    <div key={i} className="list-item" style={{ marginBottom: 6 }}>
                      <DialogIdInput
                        initial={typeof d === 'string' ? d : ''}
                        onCommit={(newVal) => {
                          const list = [...(node.dialog.dialogs ?? [])]
                          list[i] = newVal
                          updateNode(node.id, { dialog: { ...node.dialog, dialogs: list } })
                        }}
                      />
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => {
                          const list = (node.dialog.dialogs ?? []).filter((_, idx) => idx !== i)
                          updateNode(node.id, { dialog: { ...node.dialog, dialogs: list } })
                        }}
                      >
                        −
                      </button>
                    </div>
                  )
                })}
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    const list = [...(node.dialog.dialogs ?? []), '']
                    updateNode(node.id, { dialog: { ...node.dialog, dialogs: list } })
                  }}
                >
                  + Add dialog id
                </button>
              </div>

              <ClickActionEditor
                label="Exit Action"
                value={node.dialog.exit_action}
                onChange={(next) => updateNode(node.id, { dialog: { ...node.dialog, exit_action: next } })}
              />
            </div>
          )}

          {/* Advanced: Result JSON (read-only) */}
          <div style={{ marginTop: 8 }}>
            <details>
              <summary style={{ cursor: 'pointer' }}>Advanced: Result JSON</summary>
              <div style={{ marginTop: 8 }}>
                <pre
                  style={{
                    maxHeight: 300,
                    overflow: 'auto',
                    background: '#f7f7f7',
                    border: '1px solid #eee',
                    borderRadius: 4,
                    padding: 8,
                    fontSize: 12,
                    lineHeight: 1.4,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(cleanDialog(node.dialog), null, 2)}
                </pre>
                <div style={{ fontSize: 12, color: '#888' }}>Read-only</div>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  )
}
