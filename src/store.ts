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
}

type Actions = {
  ensureCenteredNode: (canvasWidth: number, canvasHeight: number) => void
  selectNode: (id: string | null) => void
  updateNode: (id: string, patch: Partial<NodeData>) => void
  setNodes: (nodes: NodeData[], selectedId?: string | null) => void
  renameNode: (oldId: string, newId: string) => void
}

export const useStore = create<State & Actions>((set, get) => ({
  nodes: [],
  selectedNodeId: null,

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
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    })),

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
}))

// 현재 선택된 노드를 바로 가져오기 위한 편의 셀렉터
export const useSelectedNode = () =>
  useStore((s) => s.nodes.find((n) => n.id === s.selectedNodeId) ?? null)
