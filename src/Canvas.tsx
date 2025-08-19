import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Stage, Layer, Rect, Text, Group } from 'react-konva'
import { useStore } from './store'

const CANVAS_BG = '#f6f7fb'
const GRID_COLOR = '#e5e7eb'
const NODE_WIDTH = 160
const NODE_HEIGHT = 80

export default function Canvas() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const nodes = useStore((s) => s.nodes)
  const selectedNodeId = useStore((s) => s.selectedNodeId)
  const ensureCenteredNode = useStore((s) => s.ensureCenteredNode)
  const selectNode = useStore((s) => s.selectNode)
  const updateNode = useStore((s) => s.updateNode)

  // Resize observer for responsive canvas
  useEffect(() => {
    const update = () => {
      const el = containerRef.current
      if (!el) return
      const { clientWidth, clientHeight } = el
      setSize({ width: clientWidth, height: clientHeight })
    }
    update()
    const ro = new ResizeObserver(update)
    if (containerRef.current) ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (size.width && size.height) {
      ensureCenteredNode(size.width, size.height)
    }
  }, [size.width, size.height, ensureCenteredNode])

  // Precompute grid lines
  const gridLines = useMemo(() => {
    const gap = 24
    const lines: ReactNode[] = []
    for (let x = 0; x < size.width; x += gap) {
      lines.push(
        <Rect key={`v-${x}`} x={x} y={0} width={1} height={size.height} fill={GRID_COLOR} />
      )
    }
    for (let y = 0; y < size.height; y += gap) {
      lines.push(
        <Rect key={`h-${y}`} x={0} y={y} width={size.width} height={1} fill={GRID_COLOR} />
      )
    }
    return lines
  }, [size.width, size.height])

  return (
    <div ref={containerRef} className="canvas">
      <Stage width={size.width} height={size.height} style={{ background: CANVAS_BG }}>
        <Layer listening={false}>{gridLines}</Layer>
        <Layer>
          {nodes.map((n) => (
            <Group
              key={n.id}
              x={n.x}
              y={n.y}
              draggable
              onDragMove={(e) => {
                const node = e.target
                updateNode(n.id, { x: Math.round(node.x()), y: Math.round(node.y()) })
              }}
              onMouseDown={(e) => {
                e.cancelBubble = true
                selectNode(n.id)
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
                text={n.title}
                fontSize={16}
                fontStyle="bold"
                fill="#111827"
                x={12}
                y={10}
              />
              {n.description && (
                <Text
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
        </Layer>
      </Stage>
    </div>
  )
}
