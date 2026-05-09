// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { getLanIp } from './mdns'

describe('getLanIp', () => {
  it('returns a non-empty string', () => {
    const ip = getLanIp()
    expect(typeof ip).toBe('string')
    expect(ip.length).toBeGreaterThan(0)
  })

  it('returns either localhost or an IPv4 dotted-quad', () => {
    const ip = getLanIp()
    const isLocalhost = ip === 'localhost'
    const isIPv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)
    expect(isLocalhost || isIPv4).toBe(true)
  })
})
