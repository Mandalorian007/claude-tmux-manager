# Enhanced SessionManager

The SessionManager is the intelligent orchestrator for managing development sessions in the claude-tmux-manager project. It provides robust session lifecycle management, advanced search capabilities, performance optimizations, and comprehensive error recovery.

## Key Features

### 🔧 Robust Path Derivation Logic

- **Enhanced Window Name Parsing**: Validates `project:feature-name` format with comprehensive error handling
- **Project Path Derivation**: Handles standard worktree structures, nested paths, symlinks, and edge cases
- **Path Validation**: Ensures paths exist, are accessible, and contain valid project indicators
- **Naming Convention Enforcement**: Validates project and feature names against established patterns

### 🔄 Comprehensive Session Lifecycle Management

- **Enhanced Session Creation**: Multi-stage validation with automatic rollback on failure
- **Health Checks**: Comprehensive validation of tmux windows, git worktrees, and file system paths
- **Graceful Cleanup**: Intelligent session deletion with partial failure recovery
- **Orphan Detection**: Automatically detects and handles orphaned sessions and worktrees

### ⚡ Performance Optimizations

- **Intelligent Caching**: Multi-level caching for sessions, metadata, and git status
- **Concurrent Processing**: Processes multiple sessions in parallel with configurable limits
- **Reduced Command Calls**: Optimizes tmux and git command execution
- **Cache Invalidation**: Smart cache management with time-based expiration

### 🔍 Advanced Features

- **Session Search**: Full-text search across projects, features, and paths with scoring
- **Session Filtering**: Advanced filtering by git status, activity, and custom criteria
- **Session Status Detection**: Automatic status determination (active, idle, ready-for-pr)
- **Metadata Collection**: Tracks last activity, commit information, and output history
- **Output Streaming**: Real-time session output capture with streaming support

### 🛡️ Error Recovery

- **Comprehensive Error Handling**: Detailed error reporting with context and recovery suggestions
- **Graceful Degradation**: Continues operation when individual components fail
- **Rollback Mechanisms**: Automatic cleanup of partially created resources
- **Detailed Logging**: Extensive logging for debugging and monitoring

## API Reference

### Core Methods

#### `listSessions(options?)`
Lists all active sessions with intelligent caching and filtering.

```typescript
const sessions = await sessionManager.listSessions({
  useCache: true,           // Use cached results if available
  includeMetadata: false,   // Include additional metadata
  filter: {                 // Filter criteria
    projectName: 'my-project',
    hasUncommittedChanges: true
  }
})
```

#### `createSession(request)`
Creates a new session with comprehensive validation and rollback.

```typescript
const result = await sessionManager.createSession({
  projectPath: '/path/to/project',
  featureName: 'my-feature'
})

if (result.success) {
  console.log('Session created:', result.data)
} else {
  console.error('Creation failed:', result.error)
  console.log('Warnings:', result.warnings)
}
```

#### `deleteSession(projectName, featureName)`
Deletes a session with enhanced cleanup and partial failure recovery.

```typescript
const result = await sessionManager.deleteSession('project', 'feature')

if (result.success) {
  console.log('Session deleted successfully')
} else {
  console.log('Partial deletion:', result.metadata?.partialSuccess)
}
```

#### `getSession(projectName, featureName, options?)`
Retrieves a specific session with caching support.

```typescript
const session = await sessionManager.getSession('project', 'feature', {
  useCache: true,
  includeMetadata: true
})
```

### Advanced Methods

#### `searchSessions(query)`
Advanced session search with text matching and sorting.

```typescript
const results = await sessionManager.searchSessions({
  text: 'auth',              // Search term
  filter: {                  // Additional filters
    hasUncommittedChanges: false
  },
  includeMetadata: true,     // Include metadata in results
  sortBy: 'activity',        // Sort by: name, activity, created, modified
  sortOrder: 'desc'          // asc or desc
})
```

#### `performSessionHealthCheck(session)`
Performs comprehensive health validation.

```typescript
const healthCheck = await sessionManager.performSessionHealthCheck(session)

console.log('Healthy:', healthCheck.isHealthy)
console.log('Issues:', healthCheck.issues)
console.log('Tmux Window Exists:', healthCheck.tmuxWindowExists)
console.log('Git Worktree Valid:', healthCheck.gitWorktreeValid)
```

#### `getSessionStatus(projectName, featureName)`
Gets detailed session status information.

```typescript
const status = await sessionManager.getSessionStatus('project', 'feature')

console.log('Status:', status.status) // active, idle, ready-for-pr, unhealthy, not-found
console.log('Health Check:', status.healthCheck)
console.log('Metadata:', status.metadata)
```

#### `getSessionOutput(projectName, featureName, options?)`
Captures session terminal output with streaming support.

```typescript
// Get current output
const output = await sessionManager.getSessionOutput('project', 'feature', {
  lines: 1000,
  includeEscapes: false
})

// Stream live output
const stream = await sessionManager.getSessionOutput('project', 'feature', {
  stream: true,
  lines: 100
})

for await (const chunk of stream) {
  console.log('New output:', chunk)
}
```

### Utility Methods

#### `refreshGitStatus(projectName?, featureName?)`
Refreshes git status for sessions, bypassing cache.

```typescript
// Refresh specific session
await sessionManager.refreshGitStatus('project', 'feature')

// Refresh all sessions
await sessionManager.refreshGitStatus()
```

#### `getPerformanceInfo()`
Gets performance and debugging information.

```typescript
const info = sessionManager.getPerformanceInfo()
console.log('Cache sizes:', info.cacheStats)
console.log('Operation queue:', info.operationQueue)
console.log('Configuration:', info.configuration)
```

## Types and Interfaces

### SessionOperationResult<T>
```typescript
interface SessionOperationResult<T = void> {
  success: boolean
  data?: T
  error?: string
  warnings: string[]
  metadata?: Record<string, any>
}
```

### SessionFilter
```typescript
interface SessionFilter {
  projectName?: string
  featureName?: string
  hasUncommittedChanges?: boolean
  isActive?: boolean
  branchPattern?: RegExp
}
```

### SessionHealthCheck
```typescript
interface SessionHealthCheck {
  isHealthy: boolean
  issues: string[]
  tmuxWindowExists: boolean
  gitWorktreeValid: boolean
  pathAccessible: boolean
  branchValid: boolean
}
```

### SessionMetadata
```typescript
interface SessionMetadata {
  lastActivity?: Date
  commitInfo?: {
    hash: string
    message: string
    author: string
    date: Date
  }
  outputHistory?: string[]
}
```

## Configuration

The SessionManager uses several configurable parameters:

- **Cache Timeout**: 30 seconds for session cache
- **Metadata Cache Timeout**: 1 minute for metadata cache
- **Max Concurrent Operations**: 5 parallel operations
- **Command Timeouts**: Varies by operation (5-30 seconds)

## Error Handling

The enhanced SessionManager provides comprehensive error handling:

### Error Types

1. **ValidationError**: Input validation failures
2. **SessionError**: Session-specific operation failures
3. **TmuxError**: Tmux adapter failures
4. **GitError**: Git adapter failures

### Error Recovery Strategies

1. **Automatic Rollback**: Failed operations trigger cleanup of partial changes
2. **Graceful Degradation**: Individual failures don't stop overall operation
3. **Retry Logic**: Automatic retries for transient failures
4. **Orphan Cleanup**: Detection and cleanup of orphaned resources

## Performance Considerations

### Caching Strategy

- **Session Cache**: Caches parsed session objects for quick retrieval
- **Metadata Cache**: Separate cache for expensive metadata operations
- **Git Status Cache**: Integrated with GitAdapter for efficient status retrieval
- **Time-based Expiration**: Automatic cache invalidation based on operation type

### Concurrency Control

- **Operation Queue**: Manages concurrent operations to prevent resource conflicts
- **Parallel Processing**: Processes multiple sessions concurrently where safe
- **Resource Locking**: Prevents concurrent modifications of the same session

## Monitoring and Debugging

### Logging

The SessionManager provides extensive logging at multiple levels:

- **Debug**: Detailed operation traces
- **Info**: Operation success/failure summaries  
- **Warn**: Recoverable issues and degraded states
- **Error**: Critical failures requiring attention

### Performance Metrics

Use `getPerformanceInfo()` to monitor:

- Cache hit rates and sizes
- Operation queue depth
- Active operation counts
- Configuration parameters

## Best Practices

### Session Creation

1. Always check the result's `success` property
2. Handle warnings appropriately
3. Use validation errors to guide user input

### Session Management

1. Use caching for frequent operations
2. Refresh git status when needed
3. Monitor session health for long-running sessions

### Error Handling

1. Check operation results before proceeding
2. Use partial success information for user feedback
3. Log errors appropriately for debugging

### Performance

1. Use filtering to reduce processing overhead
2. Enable caching for repeated operations
3. Monitor performance metrics in production

## Integration Examples

### Next.js API Route

```typescript
import { sessionManager } from '@/lib/managers/SessionManager'

export async function POST(request: Request) {
  try {
    const { projectPath, featureName } = await request.json()
    
    const result = await sessionManager.createSession({
      projectPath,
      featureName
    })
    
    if (result.success) {
      return Response.json({
        success: true,
        session: result.data
      })
    } else {
      return Response.json({
        success: false,
        error: result.error,
        warnings: result.warnings
      }, { status: 400 })
    }
  } catch (error) {
    return Response.json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}
```

### React Component

```tsx
import { useState, useEffect } from 'react'
import { sessionManager } from '@/lib/managers/SessionManager'

function SessionList() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  useEffect(() => {
    async function loadSessions() {
      try {
        const sessions = await sessionManager.listSessions({
          includeMetadata: true
        })
        setSessions(sessions)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    loadSessions()
  }, [])
  
  if (loading) return <div>Loading sessions...</div>
  if (error) return <div>Error: {error}</div>
  
  return (
    <div>
      {sessions.map(session => (
        <SessionCard key={`${session.projectName}:${session.featureName}`} session={session} />
      ))}
    </div>
  )
}
```

This enhanced SessionManager provides a robust, performant, and feature-rich foundation for managing development sessions in the claude-tmux-manager application.