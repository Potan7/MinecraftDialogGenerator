// 화면(Canvas)과 노드(Node) 렌더링, 패닝(드래그로 맵 이동) 로직이 담긴 컴포넌트입니다.
// 주요 아이디어 요약:
// - Stage(루트 캔버스)는 고정 크기입니다. 빈 공간 드래그 시 pan(x,y) 상태만 바꾸고,
//   실제 노드들은 pan만큼 이동한 Group 안에 그려서 '맵이 움직이는 것처럼' 보이게 합니다.
// - 배경 그리드는 pan 오프셋을 활용해 항상 화면을 가득 채우도록 선의 시작 위치를 보정합니다.
// - 노드 드래그는 개별 Group에 draggable을 주고, 드래그가 끝났을 때만 좌표를 저장합니다.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Konva from 'konva'
import type { Layer as KonvaLayer } from 'konva/lib/Layer'
import { Stage, Layer, Rect, Text, Group, Image as KonvaImage, RegularPolygon, Line } from 'react-konva'
import { useStore, type MCText } from './store'

// 스타일/레이아웃 관련 상수들
const CANVAS_BG = '#f6f7fb'
const GRID_COLOR = '#e5e7eb'
// 맵 노드용 폰트(영문 우선 Minecraftia, 그 외 Unifont로 폴백)
const NODE_FONT = 'Minecraftia, Unifont, sans-serif'
// 기본 노드 크기(내용에 따라 동적으로 늘릴 수 있음)
const MIN_NODE_WIDTH = 640
const MIN_NODE_HEIGHT = 300

// public/dialog 내 에셋 경로
const DIALOG_ASSETS = {
  button: '/dialog/button.png',
  button_highlighted: '/dialog/button_highlighted.png',
  warning_button: '/dialog/warning_button.png',
  warning_button_highlighted: '/dialog/warning_button_highlighted.png',
  warning_button_highlight: '/dialog/warning_button_highlight.png',
  warning_icon: '/dialog/warning_icon.png',
  warning_icon_alt: '/dialog/warning.png',
  checkbox: '/dialog/checkbox.png',
  checkbox_selected: '/dialog/checkbox_selected.png',
  slider: '/dialog/slider.png',
  slider_handle: '/dialog/slider_handle.png',
  text_field: '/dialog/text_field.png',
} as const

function useHTMLImage(url: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!url) {
      setImg(null)
      return
    }
    const image = new window.Image()
    image.crossOrigin = 'anonymous'
    image.src = url
    const onLoad = () => setImg(image)
    image.addEventListener('load', onLoad)
    return () => image.removeEventListener('load', onLoad)
  }, [url])
  return img
}

function toPlainText(t: string | MCText | null | undefined): string {
  if (!t) return ''
  if (typeof t === 'string') return t
  if (typeof t === 'object') {
    if ('text' in t && t.text) return String(t.text)
    if ('translate' in t && t.translate) return String(t.translate)
  }
  try {
    return JSON.stringify(t)
  } catch {
    return ''
  }
}

// Measure text width using a shared canvas 2D context
const __measureCanvas: { ctx: CanvasRenderingContext2D | null } = { ctx: null }
function measureTextWidth(text: string, fontCss: string): number {
  if (!__measureCanvas.ctx) {
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    __measureCanvas.ctx = ctx
  }
  const ctx = __measureCanvas.ctx
  if (!ctx) return 0
  ctx.font = fontCss
  const m = ctx.measureText(text || '')
  return m.width
}

// 아주 작은 커서 이동은 드래그로 인식하지 않도록 임계값을 설정합니다.
Konva.dragDistance = 6

export default function Canvas() {
  // DOM 참조: 캔버스 컨테이너와 노드가 그려지는 Layer
  const containerRef = useRef<HTMLDivElement | null>(null)
  const nodesLayerRef = useRef<KonvaLayer | null>(null)

  // 캔버스 크기(반응형)
  const [size, setSize] = useState({ width: 0, height: 0 })

  // 패닝 상태: 사용자가 빈 공간을 드래그하는 중인지 여부
  const [isPanning, setIsPanning] = useState(false)

  // 현재 맵의 오프셋(패닝 결과). 노드들은 이만큼 이동한 Group 안에서 렌더됩니다.
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  // 확대/축소 배율
  const [scale, setScale] = useState(1)

  // 패닝 시작 시점의 값들(기준 좌표와 포인터 시작 좌표)을 기억해 상대 이동량을 계산합니다.
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const selectedNodeId = useStore((s) => s.selectedNodeId)
  const ensureCenteredNode = useStore((s) => s.ensureCenteredNode)
  const selectNode = useStore((s) => s.selectNode)
  const updateNode = useStore((s) => s.updateNode)

  // Load UI assets (currently using button only; extend as needed)
  const buttonImg = useHTMLImage(DIALOG_ASSETS.button)
  // Try multiple possible filenames supplied by the user; pick the first that loads
  const warningIcon1 = useHTMLImage(DIALOG_ASSETS.warning_icon)
  const warningIcon2 = useHTMLImage(DIALOG_ASSETS.warning_button)
  const warningIcon3 = useHTMLImage(DIALOG_ASSETS.warning_button_highlight)
  const warningIcon4 = useHTMLImage(DIALOG_ASSETS.warning_icon_alt)
  const warningIcon5 = useHTMLImage(DIALOG_ASSETS.warning_button_highlighted)
  const warningIconImg = warningIcon1 || warningIcon2 || warningIcon3 || warningIcon4 || warningIcon5

  const isEditingInInspector = () => {
    const ae = (document.activeElement as HTMLElement | null)
    if (!ae) return false
    if (ae.isContentEditable) return true
    const tag = ae.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    return !!ae.closest('.inspector')
  }

  const isPointerInInspector = (clientX: number, clientY: number) => {
    const el = document.querySelector('.inspector') as HTMLElement | null
    if (!el) return false
    const rect = el.getBoundingClientRect()
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
  }

  // 컨테이너 크기가 변하면 Stage 크기도 함께 갱신합니다.
  useEffect(() => {
    const update = () => {
      const el = containerRef.current
      if (!el) return
      setSize({ width: el.clientWidth, height: el.clientHeight })
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // 첫 노드를 화면 중앙에 배치합니다(최초 1회 생성).
  useEffect(() => {
    if (size.width && size.height) {
      ensureCenteredNode(size.width, size.height)
    }
  }, [size.width, size.height, ensureCenteredNode])

  // 선택 상태가 바뀌면 레이어를 강제로 다시 그려 미세한 잔상을 줄입니다.
  useEffect(() => {
    const l = nodesLayerRef.current
    if (!l) return
    requestAnimationFrame(() => l.batchDraw())
  }, [selectedNodeId, nodes])

  // 배경 그리드: pan 오프셋을 반영해 선의 시작점을 보정하여 항상 화면을 가득 채웁니다.
  // gap 간격으로 수직/수평 선을 그리고, 음수 시작점(-ox, -oy)에서 시작해 빈칸이 없도록 합니다.
  const gridLines = useMemo(() => {
    const gap = 24
    const lines: ReactNode[] = []
    const ox = ((-pan.x) % gap + gap) % gap
    const oy = ((-pan.y) % gap + gap) % gap
    for (let x = -ox; x <= size.width; x += gap) {
      lines.push(
        <Rect key={`v-${x}`} x={x} y={0} width={1} height={size.height} fill={GRID_COLOR} />
      )
    }
    for (let y = -oy; y <= size.height; y += gap) {
      lines.push(
        <Rect key={`h-${y}`} x={0} y={y} width={size.width} height={1} fill={GRID_COLOR} />
      )
    }
    return lines
  }, [size.width, size.height, pan.x, pan.y])

  return (
    <div ref={containerRef} className="canvas">
      {/* Stage: 최상위 캔버스 컨테이너. 여기서는 고정된 캔버스이며, 실제 '맵 이동'은 아래 Group의 x/y로 구현합니다. */}
      <Stage
        width={size.width}
        height={size.height}
        style={{ position: 'absolute', inset: 0, background: CANVAS_BG, cursor: isPanning ? 'grabbing' : 'grab' }}
        onWheel={(e) => {
          const we = e.evt as WheelEvent
          if (isPointerInInspector(we.clientX, we.clientY) || isEditingInInspector()) return
          const stage = e.target.getStage()
          const pointer = stage?.getPointerPosition()
          if (!pointer) return
          we.preventDefault()
          const scaleBy = 1.05
          const oldScale = scale
          const direction = we.deltaY > 0 ? 1 : -1
          const unclamped = direction > 0 ? oldScale / scaleBy : oldScale * scaleBy
          const newScale = Math.max(0.3, Math.min(3, unclamped))
          if (newScale === oldScale) return
          // Keep the point under cursor stationary while zooming
          const worldPos = {
            x: (pointer.x - pan.x) / oldScale,
            y: (pointer.y - pan.y) / oldScale,
          }
          const newPan = {
            x: pointer.x - worldPos.x * newScale,
            y: pointer.y - worldPos.y * newScale,
          }
          setPan(newPan)
          setScale(newScale)
        }}
        onMouseDown={(e) => {
          // 인스펙터 영역 클릭은 배경 선택 해제를 막습니다(포커스 이전 단계 포함).
          const me = e.evt as MouseEvent
          if (isPointerInInspector(me.clientX, me.clientY) || isEditingInInspector()) return
          const stage = e.target.getStage()
          if (stage && e.target === stage) {
            selectNode(null)
            const p = stage.getPointerPosition()
            if (p) {
              panStartRef.current = pan
              pointerStartRef.current = { x: p.x, y: p.y }
              setIsPanning(true)
            }
          }
        }}
        onMouseMove={(e) => {
          if (!isPanning) return
          const stage = e.target.getStage()
          if (!stage) return
          const p = stage.getPointerPosition()
          if (!p || !pointerStartRef.current) return
          const dx = p.x - pointerStartRef.current.x
          const dy = p.y - pointerStartRef.current.y
          setPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy })
        }}
        onMouseUp={() => {
          if (isPanning) setIsPanning(false)
          pointerStartRef.current = null
        }}
        onMouseLeave={() => {
          if (isPanning) setIsPanning(false)
          pointerStartRef.current = null
        }}
        onTouchStart={(e) => {
          const te = e.evt as TouchEvent
          const t = te.touches && te.touches[0]
          if ((t && isPointerInInspector(t.clientX, t.clientY)) || isEditingInInspector()) return
          const stage = e.target.getStage()
          if (!stage) return
          const p = stage.getPointerPosition()
          if (p) {
            panStartRef.current = pan
            pointerStartRef.current = { x: p.x, y: p.y }
            setIsPanning(true)
          }
        }}
        onTouchMove={(e) => {
          if (!isPanning) return
          const stage = e.target.getStage()
          if (!stage) return
          const p = stage.getPointerPosition()
          if (!p || !pointerStartRef.current) return
          const dx = p.x - pointerStartRef.current.x
          const dy = p.y - pointerStartRef.current.y
          setPan({ x: panStartRef.current.x + dx, y: panStartRef.current.y + dy })
        }}
        onTouchEnd={() => {
          if (isPanning) setIsPanning(false)
          pointerStartRef.current = null
        }}
      >
        {/* 배경 그리드는 이벤트를 받지 않아도 되므로 listening=false로 설정합니다. */}
        <Layer listening={false}>{gridLines}</Layer>

        {/* 노드 레이어: pan(x,y)만큼 이동한 Group 내부에 모든 노드를 렌더링합니다. */}
        <Layer ref={nodesLayerRef}>
          <Group x={pan.x} y={pan.y} scaleX={scale} scaleY={scale}>
            {/* edges behind nodes */}
            {edges.map((e) => {
              const from = nodes.find((n) => n.id === e.from)
              const to = nodes.find((n) => n.id === e.to)
              if (!from || !to) return null
              const x1 = from.x + 80
              const y1 = from.y + 40
              const x2 = to.x + 80
              const y2 = to.y + 40
              return (
                <Line
                  key={e.id}
                  points={[x1, y1, x2, y2]}
                  stroke="#9ca3af"
                  strokeWidth={2}
                  listening={false}
                />
              )
            })}
            {nodes.map((n) => (
              <Group
                key={n.id}
                x={n.x}
                y={n.y}
                draggable
                onClick={(e) => {
                  e.cancelBubble = true
                  selectNode(n.id)
                }}
                onDragEnd={(e) => {
                  const node = e.target
                  updateNode(n.id, { x: Math.round(node.x()), y: Math.round(node.y()) })
                }}
                onMouseDown={(e) => {
                  e.cancelBubble = true
                }}
              >
                {
                  // Layout computation per node
                }
                {(() => {
                  const P = 16 // padding
                  const TITLE_H = 28
                  const TITLE_OFFSET_Y = 10 // move title text a bit down within the title area
                  const GAP = 10
                  const BTN_W = 220
                  const BTN_H = 40
                  const contentWidth = Math.max(MIN_NODE_WIDTH - P * 2, BTN_W * 2 + GAP)
                  // Body height (rough estimate)
                  let bodyH = 80
                  const bodyY = P + TITLE_H + GAP

                  // Compute actions area size by dialog type
                  const d = n.dialog
                  const displayTitle = toPlainText(d?.title) || n.title
                  const bodyList = Array.isArray(d?.body) ? d?.body : d?.body ? [d.body] : []
                  type BodyPlainMsg = { type: 'minecraft:plain_message'; contents: MCText }
                  const displayBody = bodyList
                    .map((el) => (el && (el as BodyPlainMsg).type === 'minecraft:plain_message' ? toPlainText((el as BodyPlainMsg).contents) : ''))
                    .filter(Boolean)
                    .join('\n')
                  if (displayBody) {
                    const bodyLines = displayBody.split('\n').length
                    bodyH = Math.max(90, bodyLines * 24 + 12)
                  }
                  let actionsH = 0
                  let actionsLayout: React.ReactNode = null

                  if (d?.type === 'minecraft:notice') {
                    if (d.action) {
                      actionsH = BTN_H
                      const bw = Math.max(BTN_W, Math.min(contentWidth, Number(d.action.width) || contentWidth))
                      actionsLayout = (
                        <Group x={P + (contentWidth - bw) / 2} y={P + TITLE_H + GAP + bodyH + GAP}>
                          {buttonImg && (
                            <KonvaImage image={buttonImg} width={bw} height={BTN_H} />
                          )}
                          <Text
                            text={toPlainText(d.action.label)}
                            fontSize={16}
                            fill="#111827"
                            align="center"
                            width={bw}
                            y={10}
                            fontFamily={NODE_FONT}
                          />
                        </Group>
                      )
                    }
                  } else if (d?.type === 'minecraft:confirmation') {
                    const btnCount = (d.yes ? 1 : 0) + (d.no ? 1 : 0)
                    if (btnCount > 0) {
                      actionsH = BTN_H
                      const totalW = btnCount * BTN_W + (btnCount - 1) * GAP
                      let curX = P + (contentWidth - totalW) / 2
                      actionsLayout = (
                        <Group y={P + TITLE_H + GAP + bodyH + GAP}>
                          {d.yes && (
                            <Group x={curX}>
                              {buttonImg && <KonvaImage image={buttonImg} width={BTN_W} height={BTN_H} />}
                              <Text text={toPlainText(d.yes.label)} fontSize={16} fill="#111827" align="center" width={BTN_W} y={10} fontFamily={NODE_FONT} />
                            </Group>
                          )}
                          {(() => { curX += BTN_W + GAP; return null })()}
                          {d.no && (
                            <Group x={curX}>
                              {buttonImg && <KonvaImage image={buttonImg} width={BTN_W} height={BTN_H} />}
                              <Text text={toPlainText(d.no.label)} fontSize={16} fill="#111827" align="center" width={BTN_W} y={10} fontFamily={NODE_FONT} />
                            </Group>
                          )}
                        </Group>
                      )
                    }
                  } else if (d?.type === 'minecraft:multi_action') {
                    const cols = Math.max(1, Math.min(4, Number(d.columns) || 2))
                    const count = d.actions?.length ?? 0
                    const rows = Math.ceil(count / cols)
                    actionsH = rows * BTN_H + Math.max(0, rows - 1) * GAP
                    const visibleCols = Math.min(count, cols)
                    const totalW = visibleCols * BTN_W + (visibleCols - 1) * GAP
                    const startX = P + (contentWidth - totalW) / 2
                    actionsLayout = (
                      <Group y={P + TITLE_H + GAP + bodyH + GAP}>
                        {(d.actions ?? []).map((a, i) => {
                          const r = Math.floor(i / cols)
                          const c = i % cols
                          const x = startX + c * (BTN_W + GAP)
                          const y = r * (BTN_H + GAP)
                          return (
                            <Group key={i} x={x} y={y}>
                              {buttonImg && <KonvaImage image={buttonImg} width={BTN_W} height={BTN_H} />}
                              <Text text={toPlainText(a.label)} fontSize={16} fill="#111827" align="center" width={BTN_W} y={10} fontFamily={NODE_FONT} />
                            </Group>
                          )
                        })}
                      </Group>
                    )
                  } else if (d?.type === 'minecraft:server_links' || d?.type === 'minecraft:dialog_list') {
                    const bw = Math.max(120, Number(d.button_width) || BTN_W)
                    const list = d.type === 'minecraft:server_links' ? (d.actions ?? []) : (d.dialogs ?? [])
                    const count = list.length
                    actionsH = count * BTN_H + Math.max(0, count - 1) * GAP
                    const startX = P + (contentWidth - bw) / 2
                    actionsLayout = (
                      <Group y={P + TITLE_H + GAP + bodyH + GAP}>
                        {d.type === 'minecraft:server_links'
                          ? (d.actions ?? []).map((a, i) => (
                              <Group key={i} x={startX} y={i * (BTN_H + GAP)}>
                                {buttonImg && <KonvaImage image={buttonImg} width={bw} height={BTN_H} />}
                                <Text text={toPlainText(a.label)} fontSize={16} fill="#111827" align="center" width={bw} y={10} fontFamily={NODE_FONT} />
                              </Group>
                            ))
                          : (d.dialogs ?? []).map((item, i) => (
                              <Group key={i} x={startX} y={i * (BTN_H + GAP)}>
                                {buttonImg && <KonvaImage image={buttonImg} width={bw} height={BTN_H} />}
                                <Text text={typeof item === 'string' ? item : toPlainText(item.title)} fontSize={16} fill="#111827" align="center" width={bw} y={10} fontFamily={NODE_FONT} />
                              </Group>
                            ))}
                      </Group>
                    )
                  }

                  // Compute minimum size required by content
                  const baseWidthMin = Math.max(MIN_NODE_WIDTH, P * 2 + contentWidth)
                  const baseHeightMin = Math.max(
                    MIN_NODE_HEIGHT,
                    P * 2 + TITLE_H + GAP + bodyH + (actionsH ? GAP + actionsH : 0)
                  )
                  // Enforce 16:9 aspect ratio while satisfying minimums.
                  // Choose minimal width that can cover baseHeightMin at 16:9,
                  // and derive height from it to get exact ratio.
                  const width = Math.max(baseWidthMin, Math.ceil((baseHeightMin * 16) / 9))
                  const height = Math.ceil((width * 9) / 16)

                  return (
                    <>
                      <Rect
                        width={width}
                        height={height}
                        cornerRadius={10}
                        fill={n.id === selectedNodeId ? '#f3f4f6' : '#f5f5f5'}
                        stroke={n.id === selectedNodeId ? '#6366f1' : '#d1d5db'}
                        strokeWidth={n.id === selectedNodeId ? 2 : 1}
                        shadowColor="#000"
                        shadowOpacity={0.08}
                        shadowBlur={8}
                        shadowOffset={{ x: 0, y: 2 }}
                      />
                      <Text
                        key={`title-${n.id}-${n.title}`}
                        text={displayTitle}
                        fontSize={18}
                        fontStyle="bold"
                        fill="#111827"
                        x={P}
                        y={P + TITLE_OFFSET_Y}
                        width={width - P * 2}
                        align="center"
                        fontFamily={NODE_FONT}
                      />
                      {d?.type === 'minecraft:notice' && (() => {
                        const titleAreaW = width - P * 2
                        const titleFontSize = 18
                        const titleFontCss = `bold ${titleFontSize}px ${NODE_FONT}`
                        const tw = measureTextWidth(displayTitle, titleFontCss)
                        const centerX = P + titleAreaW / 2
                        const rightEdge = centerX + tw / 2
                        // Size scales with font, while relative position is based on title width (not size ratio)
                        const ICON_SCALE = 1.2 // make icon slightly larger relative to title font size
                        const H_POS_RATIO = 0.1 // place icon at 10% of title width to the right of text end
                        const VERTICAL_NUDGE_SCALE = -0.5 // reduce upward offset so the icon sits a bit lower
                        const horizontalOffset = Math.round(tw * H_POS_RATIO)
                        const verticalNudge = Math.round(titleFontSize * VERTICAL_NUDGE_SCALE)
                        const titleTopY = P + TITLE_OFFSET_Y
                        if (warningIconImg) {
                          const iconH = Math.max(12, Math.round(titleFontSize * ICON_SCALE))
                          const iconW = iconH
                          const maxX = P + titleAreaW - iconW
                          const x = Math.min(rightEdge + horizontalOffset, maxX)
                          const centerY = titleTopY + titleFontSize / 2 + verticalNudge
                          const y = centerY - iconH / 2
                          return (
                            <KonvaImage image={warningIconImg} x={x} y={y} width={iconW} height={iconH} />
                          )
                        } else {
                          const iconH = Math.max(12, Math.round(titleFontSize * ICON_SCALE))
                          const radius = Math.max(6, Math.round(iconH / 1.5))
                          const maxCX = P + titleAreaW - radius
                          const cx = Math.min(rightEdge + horizontalOffset + radius, maxCX)
                          const cy = titleTopY + titleFontSize / 2 + verticalNudge
                          return (
                            <RegularPolygon
                              x={cx}
                              y={cy}
                              sides={3}
                              radius={radius}
                              rotation={0}
                              fill="#facc15"
                              stroke="#111827"
                              strokeWidth={1}
                            />
                          )
                        }
                      })()}
                      {displayBody && (
                        <Text
                          key={`desc-${n.id}`}
                          text={displayBody}
                          fontSize={16}
                          lineHeight={1.4}
                          fill="#6b7280"
                          x={P}
                          y={bodyY}
                          width={contentWidth}
                          align="center"
                          fontFamily={NODE_FONT}
                        />
                      )}
                      {actionsLayout}
                    </>
                  )
                })()}
              </Group>
            ))}
          </Group>
        </Layer>
      </Stage>
    </div>
  )
}
