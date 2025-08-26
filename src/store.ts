// 앱 전역 상태를 관리하는 간단한 Zustand 스토어입니다.
// - nodes: 캔버스에 그려질 노드들의 목록
// - selectedNodeId: 현재 선택된 노드의 ID (없으면 null)
// - ensureCenteredNode: 최초 1회 중앙에 기본 노드 생성
// - selectNode/updateNode/setNodes: 선택/수정/일괄 설정 액션
import { create } from 'zustand'

// Minecraft Dialog 공통 스키마(간략 타입)
export type DialogType =
  | 'minecraft:notice'
  | 'minecraft:confirmation'
  | 'minecraft:multi_action'
  | 'minecraft:server_links'
  | 'minecraft:dialog_list'

export type DialogAfterAction = 'close' | 'none' | 'wait_for_response'

// 텍스트 컴포넌트 형식(Java Edition) - 간단 사용을 위해 optional text를 허용
export type MCClickEvent =
  | { action: 'open_url'; url: string }
  | { action: 'open_file'; path: string }
  | { action: 'run_command'; command: string }
  | { action: 'suggest_command'; command: string }
  | { action: 'change_page'; page: number }
  | { action: 'copy_to_clipboard'; value: string }
  | { action: 'show_dialog'; dialog: string | DialogCommon }
  | { action: 'custom'; id: string; payload?: string }

export type MCHoverEvent =
  | { action: 'show_text'; value: MCText }
  | { action: 'show_item'; id: string; count?: number; components?: Record<string, unknown> }
  | { action: 'show_entity'; name?: MCText; id: string; uuid: string | number[] }

export type MCText = {
  // Content (one of these may be present; 'type' is optional)
  type?: 'text' | 'translatable' | 'score' | 'selector' | 'keybind' | 'nbt' | 'object'
  text?: string
  translate?: string
  fallback?: string
  with?: MCText[]
  score?: { name: string; objective: string }
  selector?: string
  separator?: MCText
  keybind?: string
  nbt?: string
  source?: 'entity' | 'block' | 'storage'
  entity?: string
  block?: string
  storage?: string
  interpret?: boolean
  // Formatting
  color?: string
  font?: string
  bold?: boolean
  italic?: boolean
  underlined?: boolean
  strikethrough?: boolean
  obfuscated?: boolean
  shadow_color?: number | [number, number, number, number]
  insertion?: string
  // Interactivity
  click_event?: MCClickEvent
  hover_event?: MCHoverEvent
  // Children
  extra?: MCText[]
}

// 본문/입력은 상세 스펙이 커질 수 있어 우선 최소 타입으로 둡니다
// Body elements per docs
export type ItemStack = {
  id: string
  count: number
  components?: Record<string, unknown>
}

export type BodyPlainMessage = {
  type: 'minecraft:plain_message'
  contents: MCText
  width?: number // default 200
}

export type BodyDescriptionBlock =
  | MCText
  | {
      contents: MCText
      width?: number // default 200
    }

export type BodyItemElement = {
  type: 'minecraft:item'
  item: ItemStack
  description?: BodyDescriptionBlock
  show_decoration?: boolean // default true
  show_tooltip?: boolean // default true
  width?: number // default 16
  height?: number // default 16
}

export type BodyElement = BodyPlainMessage | BodyItemElement
export type InputControl = Record<string, unknown>

// 액션 정의(버튼이 눌렸을 때 수행되는 동작)
export type ActionDef =
  | { type: 'open_url'; url: string }
  | { type: 'run_command'; command: string }
  | { type: 'suggest_command'; command: string }
  | { type: 'change_page'; page: number }
  | { type: 'copy_to_clipboard'; value: string }
  // 다른 다이얼로그 열기: 문자열 ID 또는 인라인 다이얼로그 정의 허용
  | { type: 'show_dialog'; dialog: string | DialogCommon }
  | { type: 'custom'; id: string; payload?: string }
  // 동적 액션(입력과 함께 동작)
  | { type: 'dynamic/run_command'; template: string }
  | { type: 'dynamic/custom'; id: string; additions?: Record<string, unknown> }

// 클릭 액션 버튼(라벨/툴팁/너비 + 액션)
export type ClickAction = {
  label: MCText
  tooltip?: MCText
  width?: number // 1~1024
  action?: ActionDef
}

export type DialogCommon = {
  type: DialogType
  title: MCText
  external_title?: MCText
  body?: BodyElement | BodyElement[]
  inputs?: InputControl[]
  can_close_with_escape?: boolean
  pause?: boolean
  after_action?: DialogAfterAction
  // type별 전용 필드들
  // notice
  action?: ClickAction
  // confirmation
  yes?: ClickAction
  no?: ClickAction
  // multi_action
  actions?: ClickAction[]
  columns?: number
  exit_action?: ClickAction
  // server_links
  button_width?: number
  // dialog_list
  dialogs?: Array<string | DialogCommon>
}

// 노드 데이터의 기본 형태(타입)
export type NodeData = {
  id: string
  title: string
  description?: string
  x: number
  y: number
  // 이 노드의 실제 주 내용물: Minecraft Dialog 데이터
  dialog: DialogCommon
}

type State = {
  nodes: NodeData[]
  selectedNodeId: string | null
  edges: { id: string; from: string; to: string }[]
}

type Actions = {
  ensureCenteredNode: (canvasWidth: number, canvasHeight: number) => void
  selectNode: (id: string | null) => void
  updateNode: (id: string, patch: Partial<NodeData>) => void
  setNodes: (nodes: NodeData[], selectedId?: string | null) => void
  renameNode: (oldId: string, newId: string) => void
  deleteNode: (id: string) => void
}

export const useStore = create<State & Actions>((set, get) => ({
  nodes: [],
  selectedNodeId: null,
  edges: [],

  ensureCenteredNode: (canvasWidth, canvasHeight) => {
  // 노드가 하나도 없을 때만 기본 노드를 화면 중앙에 배치합니다.
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
      dialog: {
        type: 'minecraft:notice',
        title: { text: 'Start' },
        external_title: { text: 'Start' },
  body: { type: 'minecraft:plain_message', contents: { text: 'Click to select. Drag to move.' }, width: 200 },
        inputs: [],
        can_close_with_escape: true,
        pause: true,
        after_action: 'close',
      },
    }
    set({ nodes: [node], selectedNodeId: node.id })
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  updateNode: (id, patch) =>
    set((state) => {
      // apply patch
      const nodes = state.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n))
      const node = nodes.find((n) => n.id === id)
      if (!node) return { nodes }
      // materialize inline child dialogs and connect with edges
  const childDialogs: DialogCommon[] = []
  const childDialogIds: string[] = []
      const extractAction = (c?: ClickAction): ActionDef | undefined => c?.action
      const pushShowDialog = (a?: ActionDef) => {
        if (a && a.type === 'show_dialog' && typeof a.dialog === 'object') {
          childDialogs.push(a.dialog)
        } else if (a && a.type === 'show_dialog' && typeof a.dialog === 'string') {
          const idStr = a.dialog.trim()
          if (idStr) childDialogIds.push(idStr)
        }
      }
      const d = node.dialog
      if (d) {
        // actions inside dialog
        pushShowDialog(extractAction(d.action))
        pushShowDialog(extractAction(d.yes))
        pushShowDialog(extractAction(d.no))
        pushShowDialog(extractAction(d.exit_action))
        ;(d.actions ?? []).forEach((ac) => pushShowDialog(extractAction(ac)))
        // dialog_list inline dialogs
        if (d.type === 'minecraft:dialog_list') {
          ;(d.dialogs ?? []).forEach((dlg) => {
            if (typeof dlg === 'object') childDialogs.push(dlg)
            else if (typeof dlg === 'string') {
              const idStr = dlg.trim()
              if (idStr) childDialogIds.push(idStr)
            }
          })
        }
      }
      const simpleTitle = (t: MCText): string => {
        if (!t) return 'Dialog'
        if (typeof t === 'string') return String(t)
        if (typeof t === 'object') {
          if ('text' in t && t.text) return String(t.text)
          if ('translate' in t && t.translate) return String(t.translate)
        }
        return 'Dialog'
      }
      const edges = [...state.edges]
      const ensureEdge = (from: string, to: string) => {
        if (!edges.some((e) => e.from === from && e.to === to)) {
          edges.push({ id: `edge-${edges.length + 1}`, from, to })
        }
      }
      const nodesOut = [...nodes]
      const findNodeByDialog = (dlg: DialogCommon) => {
        const key = JSON.stringify(dlg)
        return nodesOut.find((n) => JSON.stringify(n.dialog) === key)
      }
      const makeNode = (dlg: DialogCommon, index: number) => {
        const idBase = nodesOut.length + 1
        const newId = `node-${idBase}`
        const nn: NodeData = {
          id: newId,
          title: simpleTitle(dlg.title),
          x: Math.round((node?.x ?? 0) + 400 + index * 40),
          y: Math.round((node?.y ?? 0) + index * 60),
          dialog: dlg,
        }
        nodesOut.push(nn)
        return nn
      }
      childDialogs.forEach((dlg, i) => {
        const existing = findNodeByDialog(dlg)
        const target = existing ?? makeNode(dlg, i)
        ensureEdge(id, target.id)
      })
      // Create or link by string dialog IDs
      childDialogIds.forEach((targetId, i) => {
        let target = nodesOut.find((n) => n.id === targetId)
        if (!target) {
          const nn: NodeData = {
            id: targetId,
            title: targetId,
            x: Math.round((node?.x ?? 0) + 420 + i * 40),
            y: Math.round((node?.y ?? 0) + 40 + i * 60),
            dialog: {
              type: 'minecraft:notice',
              title: { text: targetId },
              external_title: { text: targetId },
              body: { type: 'minecraft:plain_message', contents: { text: '' }, width: 200 },
              inputs: [],
              can_close_with_escape: true,
              pause: true,
              after_action: 'close',
            },
          }
          nodesOut.push(nn)
          target = nn
        }
        ensureEdge(id, target.id)
      })
      return { nodes: nodesOut, edges }
    }),

  setNodes: (nodes, selectedId) =>
    set(() => ({
      nodes: nodes.map((n, i) => ({
        ...n,
        // dialog이 누락된 외부 데이터에 대해 안전한 기본값을 채웁니다.
        dialog: n.dialog ?? {
          type: 'minecraft:notice',
          title: { text: n.title ?? `Node ${i + 1}` },
          external_title: { text: n.title ?? `Node ${i + 1}` },
          body: { type: 'minecraft:plain_message', contents: { text: n.description ?? '' }, width: 200 },
          inputs: [],
          can_close_with_escape: true,
          pause: true,
          after_action: 'close',
        },
      })),
      selectedNodeId:
        typeof selectedId !== 'undefined'
          ? selectedId
          : nodes.length > 0
            ? nodes[0].id
            : null,
    })),

  // 노드 ID를 원자적으로 변경하고 선택도 함께 갱신합니다.
  renameNode: (oldId, newId) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === oldId ? { ...n, id: newId } : n)),
      selectedNodeId: state.selectedNodeId === oldId ? newId : state.selectedNodeId,
    })),

  // 노드를 삭제하고, 해당 노드로 향하거나 해당 노드에서 나가는 간선도 함께 제거합니다.
  deleteNode: (id) =>
    set((state) => {
      const nodes = state.nodes.filter((n) => n.id !== id)
      const edges = state.edges.filter((e) => e.from !== id && e.to !== id)
      const selectedNodeId = state.selectedNodeId === id ? null : state.selectedNodeId
      return { nodes, edges, selectedNodeId }
    }),
}))

// 현재 선택된 노드를 바로 가져오기 위한 편의 셀렉터
export const useSelectedNode = () =>
  useStore((s) => s.nodes.find((n) => n.id === s.selectedNodeId) ?? null)
