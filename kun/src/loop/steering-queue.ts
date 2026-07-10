import type { UserMessageSource } from '../contracts/items.js'

/**
 * Mid-turn steering queue. The renderer posts steering text while a
 * turn is running; the queue collects those messages and injects them
 * as user inputs at the next safe loop boundary. The queue is cleared
 * on turn completion or interruption.
 */
export type SteeringEntry = {
  text: string
  displayText?: string
  messageSource?: UserMessageSource
}

export class SteeringQueue {
  private readonly buffers = new Map<string, SteeringEntry[]>()

  enqueue(turnId: string, entry: SteeringEntry): void {
    const text = entry.text.trim()
    if (!text) return
    const buffer = this.buffers.get(turnId) ?? []
    buffer.push({
      text,
      ...(entry.displayText?.trim() ? { displayText: entry.displayText.trim() } : {}),
      ...(entry.messageSource ? { messageSource: entry.messageSource } : {})
    })
    this.buffers.set(turnId, buffer)
  }

  /**
   * Drain queued steering messages and return them. The loop calls
   * this at safe boundaries (after a model response, before the next
   * model request). Returns an empty array when nothing is pending.
   */
  drain(turnId: string): SteeringEntry[] {
    const buffer = this.buffers.get(turnId)
    if (!buffer?.length) return []
    const out = [...buffer]
    this.buffers.delete(turnId)
    return out
  }

  /**
   * Peek at the queued text without removing it. Used by the UI to
   * show pending steering in a "pending injection" indicator.
   */
  peek(turnId: string): SteeringEntry[] {
    return [...(this.buffers.get(turnId) ?? [])]
  }

  clear(turnId: string): void {
    this.buffers.delete(turnId)
  }
}
