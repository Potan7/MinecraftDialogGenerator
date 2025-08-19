import { useStore, type NodeData } from './store'

// Browser fallback import: input[type=file] + FileReader
export async function importNodesFromFile(): Promise<void> {
  if (window.electronAPI?.openJson) {
    // Electron path
    const json = await window.electronAPI.openJson()
    applyImported(json)
    return
  }

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  return new Promise((resolve) => {
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return resolve()
      const text = await file.text()
      applyImported(text)
      resolve()
    }
    input.click()
  })
}

export function exportNodesToFile(): void {
  const state = useStore.getState()
  const payload = JSON.stringify({ nodes: state.nodes }, null, 2)

  if (window.electronAPI?.saveJson) {
    window.electronAPI.saveJson(payload)
    return
  }

  // Browser: trigger download
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'dialog-nodes.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function applyImported(text: string) {
  try {
    const data = JSON.parse(text) as { nodes?: NodeData[] }
    if (!data.nodes || !Array.isArray(data.nodes)) throw new Error('Invalid format')
    // Basic validation
    const nodes: NodeData[] = data.nodes.map((n, i) => ({
      id: n.id ?? `node-${i + 1}`,
      title: n.title ?? 'Untitled',
      description: n.description ?? '',
      x: Number.isFinite(n.x as number) ? (n.x as number) : 0,
      y: Number.isFinite(n.y as number) ? (n.y as number) : 0,
    }))
    useStore.getState().setNodes(nodes)
  } catch (e) {
    alert('Failed to import JSON: ' + (e as Error).message)
  }
}

// Type for Electron preload exposure
declare global {
  interface Window {
    electronAPI?: {
      openJson: () => Promise<string>
      saveJson: (content: string) => Promise<void>
    }
  }
}
