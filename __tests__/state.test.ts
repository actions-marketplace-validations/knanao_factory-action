import { describe, expect, it } from 'bun:test'
import {
  findAllTracking,
  findTracking,
  parseState,
  renderTracking
} from '../src/state.js'

const render = (sid: string, lane = 'task', sha?: string) =>
  renderTracking(
    { v: 1, lane, sid, sha },
    { sessionUrl: 'https://x', reused: false, runUrl: 'https://run' }
  )

describe('state', () => {
  it('round-trips the marker', () => {
    expect(parseState(render('s1', 'review', 'abc'))).toEqual({
      v: 1,
      lane: 'review',
      sid: 's1',
      sha: 'abc'
    })
  })

  it('cannot be broken out of the HTML comment', () => {
    const body = render('s--> <img src=x>')
    const marker = body.slice(body.indexOf('<!-- factory-action:state'))
    expect(marker.match(/-->/g)).toHaveLength(1)
    expect(parseState(body)?.sid).toBe('s--> <img src=x>')
  })

  it('ignores malformed markers', () => {
    expect(parseState('<!-- factory-action:state {"v":2} -->')).toBeUndefined()
    expect(parseState('<!-- factory-action:state {oops} -->')).toBeUndefined()
    expect(parseState(null)).toBeUndefined()
  })

  it('lists every lane tracked by the action itself', () => {
    const comments = [
      { id: 1, body: render('forged'), user: { login: 'mallory' } },
      {
        id: 2,
        body: render('r', 'review'),
        user: { login: 'github-actions[bot]' }
      },
      { id: 3, body: 'hello', user: { login: 'github-actions[bot]' } },
      { id: 4, body: render('t'), user: { login: 'github-actions[bot]' } }
    ]
    expect(
      findAllTracking(comments, 'github-actions[bot]').map((c) => c.id)
    ).toEqual([2, 4])
  })

  it('only trusts comments by the action itself and matches the lane', () => {
    const comments = [
      { id: 1, body: render('forged'), user: { login: 'mallory' } },
      {
        id: 2,
        body: render('review-sid', 'review'),
        user: { login: 'github-actions[bot]' }
      },
      {
        id: 3,
        body: render('task-sid'),
        user: { login: 'github-actions[bot]' }
      }
    ]
    expect(findTracking(comments, 'task', 'github-actions[bot]')).toEqual({
      id: 3,
      state: { v: 1, lane: 'task', sid: 'task-sid' }
    })
    expect(findTracking(comments, 'qa', 'github-actions[bot]')).toBeUndefined()
  })
})
