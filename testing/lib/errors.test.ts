/**
 * Basic errors test - minimal smoke tests
 */

import { SessionError, ValidationError } from '@/lib/errors'

describe('Errors', () => {
  it('should create SessionError with message', () => {
    const error = new SessionError('Test session error')
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Test session error')
    expect(error.name).toBe('SessionError')
  })

  it('should create ValidationError with message', () => {
    const error = new ValidationError('Test validation error')
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Test validation error')
    expect(error.name).toBe('ValidationError')
  })
})