import { describe, expect, it } from 'vitest'
import { defaultMessageForStatus, extractErrorMessage } from './errors'

describe('extractErrorMessage', () => {
  it('usa el detalle en texto del contrato', () => {
    expect(extractErrorMessage({ detail: 'La ruleta no está abierta' }, 'x')).toBe(
      'La ruleta no está abierta',
    )
  })

  it('une los mensajes de validación de FastAPI (422)', () => {
    const payload = {
      detail: [
        { loc: ['body', 'number'], msg: 'el número debe estar entre 0 y 36', type: 'value_error' },
        { loc: ['body', 'amount'], msg: 'el monto debe ser positivo', type: 'value_error' },
      ],
    }
    expect(extractErrorMessage(payload, 'x')).toBe(
      'el número debe estar entre 0 y 36. el monto debe ser positivo',
    )
  })

  it('lee el detalle como objeto, como en el 409 con success:false', () => {
    const payload = { detail: { success: false, message: 'La ruleta ya está abierta' } }
    expect(extractErrorMessage(payload, 'x')).toBe('La ruleta ya está abierta')
  })

  it('cae al mensaje por defecto cuando no hay nada legible', () => {
    expect(extractErrorMessage({ detail: [] }, 'por defecto')).toBe('por defecto')
    expect(extractErrorMessage(null, 'por defecto')).toBe('por defecto')
    expect(extractErrorMessage({ detail: '   ' }, 'por defecto')).toBe('por defecto')
  })
})

describe('defaultMessageForStatus', () => {
  it('cubre los códigos del contrato', () => {
    expect(defaultMessageForStatus(400)).toMatch(/usuario/i)
    expect(defaultMessageForStatus(404)).toMatch(/no existe/i)
    expect(defaultMessageForStatus(409)).toMatch(/estado/i)
    expect(defaultMessageForStatus(422)).toMatch(/válidos/i)
    expect(defaultMessageForStatus(500)).toContain('500')
  })
})
