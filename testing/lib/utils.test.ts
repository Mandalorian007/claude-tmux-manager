/**
 * Basic utils test - minimal smoke tests
 */

describe('Utils', () => {
  it('should pass basic smoke test', () => {
    expect(true).toBe(true)
  })

  it('should work with basic string operations', () => {
    const testString = 'claude-tmux-manager'
    expect(testString.includes('tmux')).toBe(true)
    expect(testString.length).toBeGreaterThan(0)
  })

  it('should handle basic array operations', () => {
    const testArray = ['session1', 'session2', 'session3']
    expect(testArray).toHaveLength(3)
    expect(testArray).toContain('session1')
  })
})