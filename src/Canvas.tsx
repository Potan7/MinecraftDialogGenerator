// 화면(Canvas)과 노드(Node) 렌더링, 패닝(드래그로 맵 이동) 로직이 담긴 컴포넌트입니다.
// 주요 아이디어 요약:
// - Stage(루트 캔버스)는 고정 크기입니다. 빈 공간 드래그 시 pan(x,y) 상태만 바꾸고,
//   실제 노드들은 pan만큼 이동한 Group 안에 그려서 '맵이 움직이는 것처럼' 보이게 합니다.
// - 배경 그리드는 pan 오프셋을 활용해 항상 화면을 가득 채우도록 선의 시작 위치를 보정합니다.
// - 노드 드래그는 개별 Group에 draggable을 주고, 드래그가 끝났을 때만 좌표를 저장합니다.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Konva from 'konva'
import type { Layer as KonvaLayer } from 'konva/lib/Layer'
import { Stage, Layer, Rect, Text, Group } from 'react-konva'
import { useStore } from './store'

// 스타일/레이아웃 관련 상수들
const CANVAS_BG = '#f6f7fb'
const GRID_COLOR = '#e5e7eb'
const NODE_WIDTH = 160
const NODE_HEIGHT = 80

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

  // 패닝 시작 시점의 값들(기준 좌표와 포인터 시작 좌표)을 기억해 상대 이동량을 계산합니다.
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null)

  const nodes = useStore((s) => s.nodes)
  const selectedNodeId = useStore((s) => s.selectedNodeId)
  const ensureCenteredNode = useStore((s) => s.ensureCenteredNode)
  const selectNode = useStore((s) => s.selectNode)
  const updateNode = useStore((s) => s.updateNode)

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
        onMouseDown={(e) => {
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
          <Group x={pan.x} y={pan.y}>
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
                // 드래그가 끝났을 때만 위치를 저장합니다(클릭 중 미세 이동 저장 방지).
                onDragEnd={(e) => {
                  const node = e.target
                  updateNode(n.id, { x: Math.round(node.x()), y: Math.round(node.y()) })
                }}
                onMouseDown={(e) => {
                  e.cancelBubble = true
                }}
              >
                <Rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  cornerRadius={10}
                  fill={n.id === selectedNodeId ? '#ffffff' : '#fafafa'}
                  stroke={n.id === selectedNodeId ? '#6366f1' : '#d1d5db'}
                  strokeWidth={n.id === selectedNodeId ? 2 : 1}
                  shadowColor="#000"
                  shadowOpacity={0.08}
                  shadowBlur={8}
                  shadowOffset={{ x: 0, y: 2 }}
                />
                <Text
                  key={`title-${n.id}-${n.title}`}
                  text={n.title}
                  fontSize={16}
                  fontStyle="bold"
                  fill="#111827"
                  x={12}
                  y={10}
                />
                {n.description && (
                  <Text
                    key={`desc-${n.id}-${n.description}`}
                    text={n.description}
                    fontSize={12}
                    fill="#374151"
                    x={12}
                    y={34}
                    width={NODE_WIDTH - 24}
                  />
                )}
              </Group>
            ))}
          </Group>
        </Layer>
      </Stage>
    </div>
  )
}
