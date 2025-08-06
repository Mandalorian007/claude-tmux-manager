# Claude Code TMux Manager - Implementation Plan

## Overview
Next.js app that manages Claude Code sessions using tmux as the single source of truth. No database needed - everything derived from tmux window names and pane paths.

**Important**: Only scans tmux windows within the `claude-tmux-manager` session. All operations are scoped to this single session.

## Core Conventions
- **Tmux windows**: `{project}:{feature-name}` (e.g., `my-backend:user-auth`)
- **Worktrees**: `{project-path}/.worktrees/{feature-name}`
- **Branches**: `feature/{feature-name}`
- **Feature names**: URL-safe only (spaces → hyphens, lowercase, bad names forbidden in UI)

## How It Works (No Database)
From tmux, we get:
1. **Window name**: `my-backend:user-auth` → project and feature names
2. **Pane path**: `/home/user/projects/my-backend/.worktrees/user-auth`
3. **Derive project path**: Remove `/.worktrees/{feature-name}` → `/home/user/projects/my-backend`

Everything else follows from conventions. No persistence needed.

## Architecture

### Project Structure
```
claude-tmux-manager/
├── app/
│   ├── api/
│   │   ├── sessions/
│   │   │   ├── route.ts              # GET (list), POST (create)
│   │   │   └── [project]/[feature]/
│   │   │       ├── route.ts          # DELETE
│   │   │       └── output/route.ts   # GET terminal output
│   └── page.tsx
├── components/
│   ├── SessionCard.tsx
│   └── NewSessionDialog.tsx
├── lib/
│   ├── adapters/
│   │   ├── tmux.ts    # Tmux command execution
│   │   └── git.ts     # Git command execution
│   └── managers/
│       └── SessionManager.ts # Orchestrator
└── types/
```

### Layer Responsibilities
- **Adapters**: Execute commands, parse output
- **SessionManager**: Orchestrate operations, derive paths
- **No Database**: Everything computed from tmux state

## API Routes
```
GET    /api/sessions                           # List from tmux
POST   /api/sessions                           # Create new
DELETE /api/sessions/[project]/[feature]       # Remove session
GET    /api/sessions/[project]/[feature]/output # Terminal output
```

## Core Workflows

### List Sessions
1. Get tmux windows: `tmux list-windows -t claude-tmux-manager -F "#{window_name}:#{pane_current_path}"`
2. Parse each window:
   - Window `my-backend:user-auth`
   - Path `/home/user/projects/my-backend/.worktrees/user-auth`
   - Derive project path: `/home/user/projects/my-backend`
3. Get git status from worktree path
4. Return enriched session data

### Create Session
1. User provides: project path + feature name
2. Create worktree: `{project-path}/.worktrees/{feature-name}`
3. Create tmux window: `{project-name}:{feature-name}`
4. Start Claude Code in worktree

### Delete Session
1. Get window and pane path from tmux
2. Derive project path from pane path
3. Roll back uncommitted changes
4. Remove worktree and branch
5. Delete any PRs and remote branches
6. Kill tmux window

## Key Implementation Details

### TmuxAdapter
```typescript
interface WindowInfo {
  name: string           // "my-backend:user-auth"
  panePath: string       // "/home/user/projects/my-backend/.worktrees/user-auth"
}

export async function listWindows(): Promise<WindowInfo[]> {
  // tmux list-windows -t claude-tmux-manager -F "#{window_name}:#{pane_current_path}"
}

export async function createWindow(name: string, path: string): Promise<void>
export async function killWindow(name: string): Promise<void>
export async function capturePane(name: string): Promise<string>
```

### SessionManager
```typescript
interface Session {
  projectName: string    // "my-backend"
  featureName: string    // "user-auth"
  projectPath: string    // "/home/user/projects/my-backend"
  worktreePath: string   // "/home/user/projects/my-backend/.worktrees/user-auth"
  branch: string         // "feature/user-auth"
  gitStats: GitStats
  isActive: boolean
}

class SessionManager {
  async listSessions(): Promise<Session[]> {
    const windows = await tmuxAdapter.listWindows()
    
    return windows.map(window => {
      // Parse "my-backend:user-auth" → project, feature
      const [projectName, featureName] = window.name.split(':')
      
      // Derive project path from pane path
      // "/path/to/project/.worktrees/feature" → "/path/to/project"
      const projectPath = window.panePath.replace(`/.worktrees/${featureName}`, '')
      
      // Get git status
      const gitStats = await gitAdapter.getStatus(window.panePath)
      
      return {
        projectName,
        featureName,
        projectPath,
        worktreePath: window.panePath,
        branch: `feature/${featureName}`,
        gitStats,
        isActive: true // It's in tmux, so it's active
      }
    })
  }
}
```

## Setup (in existing claude-tmux-manager directory)
```bash
cd claude-tmux-manager

# No database setup needed!

# Start tmux session (if not already running)
tmux new-session -d -s claude-tmux-manager

# Run development server
pnpm dev
```

## Benefits of This Approach

### Zero Persistence
- No database to corrupt
- No sync issues
- No migrations
- No stale data

### Single Source of Truth
- Tmux IS the state
- Pane paths give us everything
- Works with manual tmux usage
- Survives app crashes

### Simple Recovery
- If tmux session exists, we can derive everything
- If worktree exists but no tmux, can recreate window
- Clean slate on every app start

## Edge Cases

### Worktree Not in `.worktrees`
If someone creates a worktree elsewhere, we won't recognize the pattern. Solution: Show as "unmanaged session" or enforce convention on creation.

### Project Path Changes
If project moves, pane path updates automatically next time they cd into it. No stale data.

### Multiple Projects Same Name
Pane path makes them unique: `/work/frontend` vs `/personal/frontend`

## Implementation Phases

1. **Core Adapters** (1-2 days) - Tmux and Git adapters
2. **Session Manager** (1 day) - Path derivation logic
3. **API & UI** (2 days) - Clean interface

Total: 4-5 days