import { useMemo } from 'react'
import { useStore } from './store'

export default function Inspector() {
  const nodes = useStore((s) => s.nodes)
  const selected = useStore((s) => s.selectedNodeId)
  const updateNode = useStore((s) => s.updateNode)

  const node = useMemo(() => nodes.find((n) => n.id === selected) ?? null, [nodes, selected])

  if (!node) {
    return (
      <div className="inspector">
        <h3 style={{ marginTop: 0 }}>Inspector</h3>
        <p>No node selected</p>
      </div>
    )
  }

  return (
    <div className="inspector">
      <h3 style={{ marginTop: 0 }}>Inspector</h3>
      <div style={{ display: 'grid', gap: '8px' }}>
        <label>
          <div style={{ fontSize: 12, color: '#555' }}>ID</div>
          <input value={node.id} disabled style={{ width: '100%' }} />
        </label>
        <label>
          <div style={{ fontSize: 12, color: '#555' }}>Title</div>
          <input
            value={node.title}
            onChange={(e) => updateNode(node.id, { title: e.target.value })}
            style={{ width: '100%' }}
          />
        </label>
        <label>
          <div style={{ fontSize: 12, color: '#555' }}>Description</div>
          <textarea
            value={node.description ?? ''}
            onChange={(e) => updateNode(node.id, { description: e.target.value })}
            rows={3}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#555' }}>X</div>
            <input
              type="number"
              value={node.x}
              onChange={(e) => updateNode(node.id, { x: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
          <label style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#555' }}>Y</div>
            <input
              type="number"
              value={node.y}
              onChange={(e) => updateNode(node.id, { y: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </label>
        </div>
      </div>
    </div>
  )
}
