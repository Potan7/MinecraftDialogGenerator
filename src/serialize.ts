import type { ActionDef, ClickAction, DialogCommon, MCText } from './store'


function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function deepPrune(obj: Record<string, unknown>) {
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (v === undefined || v === null) {
      delete obj[k]
      continue
    }
    if (Array.isArray(v)) {
      // prune empty arrays entirely
      if (v.length === 0) {
        delete obj[k]
      }
      continue
    }
    if (isPlainObject(v)) {
      deepPrune(v)
      if (Object.keys(v).length === 0) {
        delete obj[k]
      }
    }
  }
  return obj
}

function equalMCText(a: unknown, b: unknown): boolean {
  if (!isPlainObject(a) || !isPlainObject(b)) return false
  // Our MCText is currently just { text: string }
  return typeof (a as MCText).text === 'string' && (a as MCText).text === (b as MCText).text
}

function cleanAction(action: ActionDef): Record<string, unknown> {
  // Pass-through but prune nested dialog for show_dialog
  if (action.type === 'show_dialog') {
    const dialog = typeof action.dialog === 'string' ? action.dialog : cleanDialog(action.dialog)
    return deepPrune({ ...action, dialog })
  }
  // Remove optional undefined fields in unions
  return deepPrune({ ...action })
}

function cleanClickAction(ca: ClickAction | undefined): Record<string, unknown> | undefined {
  if (!ca) return undefined
  const { label, tooltip, width, action } = ca
  const obj: Record<string, unknown> = { label }
  if (tooltip) obj.tooltip = tooltip
  if (typeof width === 'number') obj.width = width
  if (action) obj.action = cleanAction(action)
  return deepPrune(obj)
}

export function cleanDialog(dialog: DialogCommon): Record<string, unknown> {
  const out: Record<string, unknown> = {
    type: dialog.type,
    title: dialog.title,
  }

  // external_title: drop if equal to title or undefined
  if (dialog.external_title && !equalMCText(dialog.external_title, dialog.title)) {
    out.external_title = dialog.external_title
  }

  // body: drop if empty array or empty text
  if (dialog.body !== undefined) {
    const b = dialog.body as unknown
    if (Array.isArray(b)) {
      if (b.length > 0) out.body = b
    } else if (isPlainObject(b)) {
      const t = (b as { text?: unknown }).text
      if (!(typeof t === 'string' && t.trim() === '')) {
        out.body = b as Record<string, unknown>
      }
    }
  }

  // inputs: drop if empty
  if (dialog.inputs && dialog.inputs.length > 0) {
    out.inputs = dialog.inputs
  }

  // booleans with defaults true
  if (dialog.can_close_with_escape !== undefined && dialog.can_close_with_escape !== true) {
    out.can_close_with_escape = dialog.can_close_with_escape
  }
  if (dialog.pause !== undefined && dialog.pause !== true) {
    out.pause = dialog.pause
  }

  // after_action: default 'close'
  if (dialog.after_action && dialog.after_action !== 'close') {
    out.after_action = dialog.after_action
  }

  // type-specific
  switch (dialog.type) {
    case 'minecraft:notice': {
      const action = cleanClickAction(dialog.action)
      if (action) out.action = action
      break
    }
    case 'minecraft:confirmation': {
      const yes = cleanClickAction(dialog.yes)
      const no = cleanClickAction(dialog.no)
      if (yes) out.yes = yes
      if (no) out.no = no
      break
    }
    case 'minecraft:multi_action': {
      if (dialog.actions && dialog.actions.length > 0) {
        out.actions = dialog.actions.map((a) => cleanClickAction(a))
      }
      // columns: only emit if not default 1
      if (typeof dialog.columns === 'number' && dialog.columns !== 1) {
        out.columns = dialog.columns
      }
      const exitAction = cleanClickAction(dialog.exit_action)
      if (exitAction) out.exit_action = exitAction
      break
    }
    case 'minecraft:server_links': {
      // columns: only emit if not default 1
      if (typeof dialog.columns === 'number' && dialog.columns !== 1) {
        out.columns = dialog.columns
      }
      if (typeof dialog.button_width === 'number') {
        out.button_width = dialog.button_width
      }
      const exitAction = cleanClickAction(dialog.exit_action)
      if (exitAction) out.exit_action = exitAction
      break
    }
    case 'minecraft:dialog_list': {
      // columns: only emit if not default 1
      if (typeof dialog.columns === 'number' && dialog.columns !== 1) {
        out.columns = dialog.columns
      }
      if (typeof dialog.button_width === 'number') {
        out.button_width = dialog.button_width
      }
      if (dialog.dialogs && dialog.dialogs.length > 0) {
        out.dialogs = dialog.dialogs.map((d) => (typeof d === 'string' ? d : cleanDialog(d)))
      }
      const exitAction = cleanClickAction(dialog.exit_action)
      if (exitAction) out.exit_action = exitAction
      break
    }
  }

  // final prune removes any undefined/empty recursively
  return deepPrune(out)
}

// Optional: expose a cleaner for MCText if needed elsewhere
export function cleanText(t: MCText): MCText {
  // Drop empty arrays and undefined in a shallow clone, then deep prune
  return deepPrune({ ...t }) as MCText
}
