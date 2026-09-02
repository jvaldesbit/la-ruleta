import { describe, expect, it } from 'vitest'
import { resolveBaseUrl } from './client'

describe('resolveBaseUrl', () => {
  it('usa rutas relativas por defecto', () => {
    expect(resolveBaseUrl(undefined)).toBe('/api/v1')
    expect(resolveBaseUrl('')).toBe('/api/v1')
    expect(resolveBaseUrl('   ')).toBe('/api/v1')
  })

  it('respeta VITE_API_BASE_URL y le quita la barra final', () => {
    expect(resolveBaseUrl('http://localhost:8000/api/v1')).toBe('http://localhost:8000/api/v1')
    expect(resolveBaseUrl('http://localhost:8000/api/v1/')).toBe('http://localhost:8000/api/v1')
  })
})
