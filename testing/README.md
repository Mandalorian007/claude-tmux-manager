# Testing Directory Structure

This directory contains all tests for the Claude TMux Manager project, organized in a clean, discoverable structure that mirrors the main project layout.

## Directory Structure

```
testing/
├── README.md                         # This file
├── index.ts                          # Main testing index
├── lib/                              # Core library tests
│   ├── index.ts                      # Library tests index
│   ├── command-executor.test.ts      # Command execution tests
│   ├── errors.test.ts               # Error handling tests
│   ├── utils.test.ts                # Utility function tests
│   ├── adapters/                     # Adapter tests
│   │   ├── git.test.ts              # Git adapter tests
│   │   └── tmux.test.ts             # Tmux adapter tests
│   └── managers/                     # Manager tests
│       ├── SessionManager.test.ts    # Main SessionManager tests
│       ├── SessionManager.basic.test.ts # Basic SessionManager tests
│       ├── SessionManager.test.ts.backup # Backup test file
│       └── manual-test.ts            # Manual testing script (excluded from Jest)
├── components/                       # React component tests
│   ├── index.ts                      # Component tests index
│   └── SessionCard.test.tsx          # SessionCard component tests
└── app/                              # Next.js app tests
    ├── index.ts                      # App tests index
    └── api/                          # API route tests
        └── sessions/                 # Session API tests
            └── route.test.ts         # Session API route tests
```

## Benefits of This Structure

### 1. **Easy Discovery**
- Tests are no longer scattered throughout the codebase
- All tests are in one place under `/testing/`
- Directory structure mirrors the actual project structure

### 2. **Better Organization**
- Clear separation between different types of tests:
  - Library/core functionality tests in `lib/`
  - React component tests in `components/`
  - API and app-specific tests in `app/`

### 3. **Improved Maintenance**
- Index files in each directory provide overview and documentation
- Consistent import patterns using relative paths from project root
- Easy to find related tests when modifying source code

### 4. **Enhanced Development Experience**
- IDE can easily navigate between tests and source files
- Clear relationship between test files and source files
- Reduced cognitive overhead when working with tests

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Categories
```bash
# Library tests only
npx jest testing/lib/

# Component tests only
npx jest testing/components/

# API tests only
npx jest testing/app/

# Specific test file
npx jest testing/lib/errors.test.ts
```

### Test Scripts
- `npm test` - Run all tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:ci` - Run tests in CI mode

## Test Configuration

The Jest configuration has been updated to:
- Look for tests only in the `/testing/` directory
- Exclude manual test files from automated runs
- Maintain proper module resolution with `@/` aliases
- Generate coverage reports for source files only

## Import Patterns

Tests now use relative paths to reference source files:

```typescript
// From testing/lib/errors.test.ts
import { SessionError } from '../../lib/errors'

// From testing/components/SessionCard.test.tsx
import { SessionCard } from '../../components/SessionCard'

// From testing/app/api/sessions/route.test.ts
import { GET, POST } from '../../../../app/api/sessions/route'
```

## Files Moved

This reorganization moved the following test files:

**From scattered `__tests__` directories:**
- `lib/__tests__/*` → `testing/lib/`
- `lib/managers/__tests__/*` → `testing/lib/managers/`
- `lib/adapters/__tests__/*` → `testing/lib/adapters/`
- `components/__tests__/*` → `testing/components/`
- `app/api/sessions/__tests__/*` → `testing/app/api/sessions/`

**Total files moved:** 10 test files + 1 manual test script

All import paths and Jest mock paths have been updated to work with the new structure.