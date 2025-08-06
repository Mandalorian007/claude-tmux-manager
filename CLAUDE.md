# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Essential Commands
- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build production version
- `pnpm lint` - Run ESLint checks
- `pnpm type-check` - Run TypeScript type checking
- `pnpm test` - Run Jest unit tests
- `pnpm integration` - Run Playwright e2e tests

### Test Structure
- Unit tests in `testing/` directory, organized by component/lib structure
- Jest configuration excludes e2e tests automatically
- E2E tests in `testing/e2e/` use Playwright with Chromium
- Tests use mock data by default via `NEXT_PUBLIC_USE_MOCK_DATA=true`

## Architecture Overview

### Core Concept
A Next.js 15 application for managing tmux sessions and Git worktrees with a terminal-inspired UI. The app bridges command-line workflows with web interfaces, targeting developers who use tmux for session management.

### Key Architecture Patterns

**WorkspaceWindow Model**: Central data structure representing a tmux session tied to a Git worktree
- Maps to `projectName:featureName` tmux window naming convention
- Tracks Git statistics (staged, unstaged, ahead/behind counts) 
- Integrates with worktree paths in `.worktrees/` directory structure

**Manager Pattern**: Business logic encapsulated in manager classes
- `SessionManager` - Enhanced session lifecycle with caching, health checks, search
- `WindowManager` - Core window operations (create, delete, list)
- Adapters for `tmux` and `git` command execution

**Mock Data Strategy**: Development uses comprehensive mock data
- `useMockData` flag toggles between real and mock backends
- Mock sessions simulate realistic tmux/git scenarios
- Enables frontend development without tmux setup

### Directory Structure
- `app/` - Next.js app router with API routes for window management
- `components/` - React components following terminal UI patterns
- `lib/` - Business logic, adapters, and utilities
- `lib/managers/` - Core business logic with detailed documentation
- `testing/` - Comprehensive test suite with separate unit/e2e structure

### API Design
REST endpoints follow `/api/windows` pattern:
- `GET /api/windows` - List all workspace windows
- `POST /api/windows` - Create new window with worktree
- `DELETE /api/windows/[project]/[feature]` - Cleanup window and worktree

### State Management
- React state with custom hooks for complex UI interactions
- Terminal notifications system for command feedback
- Keyboard shortcuts for power-user workflows
- Local storage for UI preferences (sidebar, view modes)

## Development Workflow

### Adding New Features
1. Start with types in `types.ts` - the application is heavily typed
2. Consider if the feature needs mock data updates in `lib/mockData.ts`
3. Business logic goes in `lib/managers/` with comprehensive documentation
4. UI components follow terminal aesthetic patterns in existing components
5. Add tests in corresponding `testing/` subdirectory

### Working with Sessions/Windows
- "Session" and "Window" terminology is used interchangeably (legacy transition)
- All operations assume `projectName:featureName` naming convention
- Git worktrees expected in `.worktrees/` subdirectory structure
- Enhanced SessionManager provides caching, health checks, and advanced operations

### UI Patterns
- Terminal-inspired design with green accent colors and monospace fonts
- Keyboard shortcuts are essential - use `useKeyboardShortcuts` hook
- Loading states use terminal-style animations and notifications
- Error boundaries wrap major components for graceful degradation