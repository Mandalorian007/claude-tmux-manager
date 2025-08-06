import { NextResponse } from 'next/server'

// GET /api/docs - API Documentation
export async function GET() {
  const apiDocs = {
    title: 'Claude TMux Manager API',
    version: '1.0.0',
    description: 'Production-ready API for managing tmux sessions with git worktrees',
    baseUrl: '/api',
    
    endpoints: {
      sessions: {
        'GET /sessions': {
          description: 'List all sessions with advanced filtering and pagination',
          parameters: {
            limit: { 
              type: 'number', 
              default: 50, 
              max: 1000, 
              description: 'Number of sessions to return' 
            },
            offset: { 
              type: 'number', 
              default: 0, 
              description: 'Number of sessions to skip' 
            },
            projectName: { 
              type: 'string', 
              description: 'Filter by project name' 
            },
            featureName: { 
              type: 'string', 
              description: 'Filter by feature name' 
            },
            hasUncommittedChanges: { 
              type: 'boolean', 
              description: 'Filter by uncommitted changes status' 
            },
            isActive: { 
              type: 'boolean', 
              description: 'Filter by active status' 
            },
            status: { 
              type: 'string', 
              enum: ['active', 'idle', 'ready-for-pr', 'unhealthy'], 
              description: 'Filter by session status' 
            },
            branchPattern: { 
              type: 'string', 
              description: 'RegExp pattern to match branch names' 
            },
            search: { 
              type: 'string', 
              description: 'Full-text search across session data' 
            },
            sortBy: { 
              type: 'string', 
              enum: ['name', 'activity', 'score'], 
              default: 'name' 
            },
            includeMetadata: { 
              type: 'boolean', 
              default: false, 
              description: 'Include session metadata' 
            }
          }
        }
      }
    },
    
    schemas: {
      Session: {
        projectName: 'string',
        featureName: 'string',
        projectPath: 'string',
        worktreePath: 'string',
        branch: 'string',
        gitStats: 'GitStats',
        isActive: 'boolean'
      },
      
      GitStats: {
        branch: 'string',
        ahead: 'number',
        behind: 'number',
        staged: 'number',
        unstaged: 'number',
        untracked: 'number',
        hasUncommittedChanges: 'boolean'
      }
    },
    
    examples: {
      basicUsage: {
        listSessions: '/api/sessions',
        createSession: {
          method: 'POST',
          url: '/api/sessions',
          body: {
            projectPath: '/path/to/project',
            featureName: 'feature-name'
          }
        },
        deleteSession: {
          method: 'DELETE',
          url: '/api/sessions/project-name/feature-name'
        }
      }
    }
  }
  
  return NextResponse.json(apiDocs, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  })
}