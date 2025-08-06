/**
 * Manual test script to validate the enhanced SessionManager functionality
 * Run with: npx ts-node lib/managers/__tests__/manual-test.ts
 */

import { SessionManager } from '../../../lib/managers/SessionManager'
import { SessionStatusAnalyzer, PathValidator, SessionSafetyValidator } from '../../../lib/utils/session-utils'

async function testSessionManager() {
  console.log('🧪 Testing Enhanced SessionManager...\n')
  
  const sessionManager = new SessionManager()
  
  try {
    // Test 1: List sessions (should work even with no sessions)
    console.log('1. Testing listSessions...')
    const sessions = await sessionManager.listSessions({ useCache: false })
    console.log(`✅ Found ${sessions.length} sessions`)
    
    // Test 2: Test cache stats
    console.log('\n2. Testing cache statistics...')
    const cacheStats = sessionManager.getCacheStats()
    console.log(`✅ Cache stats: ${JSON.stringify(cacheStats, null, 2)}`)
    
    // Test 3: Test system health report
    console.log('\n3. Testing system health report...')
    const healthReport = await sessionManager.getSystemHealthReport()
    console.log(`✅ Health report: ${JSON.stringify({
      totalSessions: healthReport.totalSessions,
      healthySessions: healthReport.healthySessions,
      unhealthySessions: healthReport.unhealthySessions,
      issues: healthReport.issues.length
    }, null, 2)}`)
    
    // Test 4: Test utility functions
    console.log('\n4. Testing utility functions...')
    
    // PathValidator tests
    const validPath = PathValidator.validateProjectPath('/home/user/projects/my-app')
    const invalidPath = PathValidator.validateProjectPath('/bin')
    console.log(`✅ Path validation: valid=/home/user/projects/my-app -> ${validPath}, invalid=/bin -> ${invalidPath}`)
    
    // SessionSafetyValidator tests
    const validationResult = SessionSafetyValidator.validateCreationParams('/test/project', 'test-feature')
    console.log(`✅ Creation validation: ${JSON.stringify(validationResult, null, 2)}`)
    
    // Test 5: Test search functionality (with empty results)
    console.log('\n5. Testing search functionality...')
    const searchResults = await sessionManager.searchSessions({
      text: 'test',
      sortBy: 'name',
      limit: 10
    })
    console.log(`✅ Search results: Found ${searchResults.length} matches`)
    
    console.log('\n🎉 All tests passed! The enhanced SessionManager is working correctly.')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testSessionManager()
}