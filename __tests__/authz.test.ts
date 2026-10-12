import { describe, expect, it, jest } from 'bun:test'
import { authorize } from '../src/authz.js'

const allowedAssociations = ['OWNER', 'MEMBER', 'COLLABORATOR']

describe('authorize', () => {
  it('allows listed associations without an API call', async () => {
    const getPermission = jest.fn<(login: string) => Promise<string>>()
    const res = await authorize(
      { login: 'alice', type: 'User', association: 'MEMBER' },
      { allowedAssociations, permissionFallback: true, getPermission }
    )
    expect(res.allowed).toBe(true)
    expect(getPermission).not.toHaveBeenCalled()
  })

  it('allows a private org member with write permission via the fallback', async () => {
    const res = await authorize(
      { login: 'carol', type: 'User', association: 'CONTRIBUTOR' },
      {
        allowedAssociations,
        permissionFallback: true,
        getPermission: async () => 'write'
      }
    )
    expect(res.allowed).toBe(true)
  })

  it('denies outside users', async () => {
    const res = await authorize(
      { login: 'mallory', type: 'User', association: 'NONE' },
      {
        allowedAssociations,
        permissionFallback: true,
        getPermission: async () => 'read'
      }
    )
    expect(res.allowed).toBe(false)
  })

  it('treats permission API errors as no permission', async () => {
    const res = await authorize(
      { login: 'mallory', type: 'User', association: 'NONE' },
      {
        allowedAssociations,
        permissionFallback: true,
        getPermission: async () => {
          throw new Error('Not Found')
        }
      }
    )
    expect(res.allowed).toBe(false)
  })

  it('skips the fallback when disabled', async () => {
    const getPermission = jest.fn<(login: string) => Promise<string>>()
    const res = await authorize(
      { login: 'carol', type: 'User', association: 'CONTRIBUTOR' },
      { allowedAssociations, permissionFallback: false, getPermission }
    )
    expect(res.allowed).toBe(false)
    expect(getPermission).not.toHaveBeenCalled()
  })
})
