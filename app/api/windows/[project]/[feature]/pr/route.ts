import { NextRequest, NextResponse } from 'next/server'
import { CommandExecutor } from '@/lib/command-executor'
import { logger } from '@/lib/logger'

/**
 * GET /api/windows/[project]/[feature]/pr
 * Check for existing PR for this branch using GitHub CLI
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ project: string; feature: string }> }
): Promise<NextResponse> {
  const requestId = crypto.randomUUID()
  const resolvedParams = await params

  logger.info('GET /api/windows/[project]/[feature]/pr', {
    component: 'PRCheckAPI',
    requestId,
    projectName: resolvedParams.project,
    featureName: resolvedParams.feature
  })

  try {
    // Decode URL parameters
    const projectName = decodeURIComponent(resolvedParams.project)
    const featureName = decodeURIComponent(resolvedParams.feature)

    // Validate project and feature names
    if (!projectName || !featureName) {
      return NextResponse.json(
        {
          error: 'Project name and feature name are required',
          code: 'INVALID_PARAMETERS'
        },
        { status: 400 }
      )
    }

    // Construct branch name (assuming feature/ prefix)
    const branchName = `feature/${featureName}`

    try {
      // Use GitHub CLI to check for PRs on this branch
      const command = `gh pr list --head ${CommandExecutor.escapeShellArg(branchName)} --json number,url,title,state --limit 1`
      
      const result = await CommandExecutor.execute(command, {
        timeout: 10000,
        suppressErrors: true
      })

      if (result.exitCode === 0 && result.stdout) {
        const prs = JSON.parse(result.stdout.trim())
        
        if (prs.length > 0) {
          const pr = prs[0]
          logger.info('Found existing PR', {
            component: 'PRCheckAPI',
            requestId,
            projectName,
            featureName,
            prNumber: pr.number,
            prUrl: pr.url
          })

          return NextResponse.json({
            found: true,
            pr: {
              number: pr.number,
              url: pr.url,
              title: pr.title,
              state: pr.state
            }
          })
        }
      }

      // No PR found
      logger.info('No PR found for branch', {
        component: 'PRCheckAPI',
        requestId,
        projectName,
        featureName,
        branchName
      })

      return NextResponse.json({
        found: false,
        branchName,
        createUrl: `https://github.com/${projectName}/${projectName}/compare/main...${branchName}?expand=1`
      })

    } catch (ghError) {
      // GitHub CLI might not be authenticated or repo doesn't exist
      logger.warn('GitHub CLI command failed', {
        component: 'PRCheckAPI',
        requestId,
        error: ghError,
        projectName,
        featureName
      })

      // Fallback to GitHub web search
      return NextResponse.json({
        found: false,
        branchName,
        fallback: true,
        searchUrl: `https://github.com/${projectName}/${projectName}/pulls?q=is%3Apr+head%3A${encodeURIComponent(branchName)}`
      })
    }

  } catch (error) {
    logger.error('Failed to check PR status', error, {
      component: 'PRCheckAPI',
      requestId,
      projectName: resolvedParams.project,
      featureName: resolvedParams.feature
    })

    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}