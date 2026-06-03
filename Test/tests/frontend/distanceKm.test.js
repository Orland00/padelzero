import { describe, it, expect } from 'vitest'
import { distanceKm } from '@/lib/distance'

describe('distanceKm (Haversine formula)', () => {
  it('same point returns 0 km', () => {
    expect(distanceKm(20.97, -89.62, 20.97, -89.62)).toBe(0)
  })

  it('Demo City to Cancún is approximately 297 km (±10 km)', () => {
    const d = distanceKm(20.97, -89.62, 21.16, -86.85)
    expect(d).toBeGreaterThan(287)
    expect(d).toBeLessThan(307)
  })

  it('Demo City to CDMX is approximately 1050 km (±50 km)', () => {
    const d = distanceKm(20.97, -89.62, 19.43, -99.13)
    expect(d).toBeGreaterThan(1000)
    expect(d).toBeLessThan(1100)
  })

  it('New York to London is approximately 5570 km (±50 km)', () => {
    const d = distanceKm(40.71, -74.01, 51.51, -0.13)
    expect(d).toBeGreaterThan(5520)
    expect(d).toBeLessThan(5620)
  })

  it('equator point to north pole is approximately 10008 km (±20 km)', () => {
    const d = distanceKm(0, 0, 90, 0)
    expect(d).toBeGreaterThan(9988)
    expect(d).toBeLessThan(10028)
  })

  it('is symmetric: distanceKm(a,b,c,d) === distanceKm(c,d,a,b)', () => {
    const forward = distanceKm(20.97, -89.62, 21.16, -86.85)
    const reverse = distanceKm(21.16, -86.85, 20.97, -89.62)
    expect(forward).toBeCloseTo(reverse, 10)
  })

  it('short distance: two points 0.01 degrees apart is approximately 1.1 km', () => {
    const d = distanceKm(20.00, -89.62, 20.01, -89.62)
    expect(d).toBeGreaterThan(1.0)
    expect(d).toBeLessThan(1.2)
  })
})
