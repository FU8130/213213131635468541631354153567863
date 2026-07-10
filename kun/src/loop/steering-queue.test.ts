import { describe, expect, it } from 'vitest'
import { SteeringQueue } from './steering-queue.js'

describe('SteeringQueue', () => {
  it('keeps concurrent turn buffers isolated', () => {
    const queue = new SteeringQueue()
    queue.enqueue('turn_a', { text: 'private instruction for A' })
    queue.enqueue('turn_b', { text: 'private instruction for B' })

    expect(queue.drain('turn_b')).toEqual([{ text: 'private instruction for B' }])
    expect(queue.drain('turn_a')).toEqual([{ text: 'private instruction for A' }])
  })

  it('clearing one turn does not discard another turn steering', () => {
    const queue = new SteeringQueue()
    queue.enqueue('turn_a', { text: 'A' })
    queue.enqueue('turn_b', { text: 'B' })

    queue.clear('turn_a')

    expect(queue.drain('turn_a')).toEqual([])
    expect(queue.drain('turn_b')).toEqual([{ text: 'B' }])
  })
})
