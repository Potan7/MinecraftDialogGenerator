// 파일 입출력 유틸리티
// - 브라우저 환경: input[type=file] + Blob 다운로드로 동작
// - Electron 환경: preload에서 노출한 window.electronAPI를 사용해 네이티브 다이얼로그 사용
import { useStore, type NodeData, type DialogCommon } from './store'
import { cleanDialog } from './serialize'

// JSON 가져오기(Import)
// 1) Electron이면 electronAPI.openJson()으로 파일을 읽어 문자열을 받습니다.
// 2) 아니면 브라우저 input[type=file]로 선택 후 File.text()로 내용을 읽습니다.
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
  const pruned = state.nodes.map((n) => ({ ...n, dialog: cleanDialog(n.dialog) }))
  const payload = JSON.stringify({ nodes: pruned }, null, 2)

  if (window.electronAPI?.saveJson) {
    window.electronAPI.saveJson(payload)
    return
  }

  // 브라우저 다운로드 트리거: Blob URL을 만들어 <a> 클릭으로 저장합니다.
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

// JSON 파싱 및 기본 검증/보정 후 store에 일괄 반영합니다.
function applyImported(text: string) {
  try {
    const data = JSON.parse(text) as { nodes?: unknown[] }
    if (!data.nodes || !Array.isArray(data.nodes)) throw new Error('Invalid format')

    // 안전한 타입 가드/도우미
    const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
    const asString = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback)
    const asNumber = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
    const isMCText = (v: unknown): v is { text: string } => isRecord(v) && typeof v.text === 'string'
    const isDialogCommon = (d: unknown): d is DialogCommon =>
      isRecord(d) && typeof d.type === 'string' && isMCText(d.title)

    // 누락 시 안전한 기본 Dialog 생성
    const buildDefaultDialog = (title: string, description?: string): DialogCommon => ({
      type: 'minecraft:notice',
      title: { text: title || 'Untitled' },
      external_title: { text: title || 'Untitled' },
      body: { type: 'minecraft:plain_message', contents: { text: description ?? '' }, width: 200 },
      inputs: [],
      can_close_with_escape: true,
      pause: true,
      after_action: 'close',
    })

    // 간단한 값 보정(누락/타입 오류 대비)
    const nodes: NodeData[] = data.nodes.map((raw: unknown, i: number) => {
      const r = isRecord(raw) ? raw : {}
      const title = asString(r.title, 'Untitled')
      const description = asString(r.description, '')
      return {
        id: asString(r.id, `node-${i + 1}`),
        title,
        description,
        x: asNumber(r.x, 0),
        y: asNumber(r.y, 0),
        dialog: isDialogCommon(r.dialog) ? r.dialog : buildDefaultDialog(title, description),
      }
    })
    useStore.getState().setNodes(nodes)
  } catch (e) {
    alert('Failed to import JSON: ' + (e as Error).message)
  }
}

// Electron preload에서 노출할 API 타입(선언만; 실제 구현은 Electron 쪽에서 제공합니다)
declare global {
  interface Window {
    electronAPI?: {
      openJson: () => Promise<string>
      saveJson: (content: string) => Promise<void>
    }
  }
}
