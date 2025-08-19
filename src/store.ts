import { create } from 'zustand'

export type NodeData = {
  id: string
  title: string
  description?: string
  x: number
  y: number
}

type State = {
  nodes: NodeData[]
  selectedNodeId: string | null
}

type Actions = {
  ensureCenteredNode: (canvasWidth: number, canvasHeight: number) => void
  selectNode: (id: string | null) => void
  updateNode: (id: string, patch: Partial<NodeData>) => void
  setNodes: (nodes: NodeData[], selectedId?: string | null) => void
}

export const useStore = create<State & Actions>((set, get) => ({
  nodes: [],
  selectedNodeId: null,

  ensureCenteredNode: (canvasWidth, canvasHeight) => {
    const { nodes } = get()
    if (nodes.length > 0) return
    const DEFAULT_WIDTH = 160
    const DEFAULT_HEIGHT = 80
    const node: NodeData = {
      id: 'node-1',
      title: 'Start',
      description: 'Click to select. Drag to move.',
      x: Math.round(canvasWidth / 2 - DEFAULT_WIDTH / 2),
      y: Math.round(canvasHeight / 2 - DEFAULT_HEIGHT / 2),
    }
    set({ nodes: [node], selectedNodeId: node.id })
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  updateNode: (id, patch) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    })),

  setNodes: (nodes, selectedId) =>
    set(() => ({
      nodes,
      selectedNodeId:
        typeof selectedId !== 'undefined'
          ? selectedId
          : nodes.length > 0
            ? nodes[0].id
            : null,
    })),
}))

// Convenience selector to read the currently selected node
export const useSelectedNode = () =>
  useStore((s) => s.nodes.find((n) => n.id === s.selectedNodeId) ?? null)
