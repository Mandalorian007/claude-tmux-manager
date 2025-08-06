# ⚡ Claude TMux Manager

A powerful, terminal-inspired web application for managing tmux sessions and Git worktrees with style and efficiency. Built for developers who love the command line but appreciate a polished interface.

![Claude TMux Manager](./concept-mockup.png)

## ✨ Features

### 🎯 Core Functionality
- **Session Management**: Create, monitor, and clean up tmux sessions with Git worktree integration
- **Real-time Status**: Live monitoring of tmux sessions with visual indicators for active/idle states
- **Git Integration**: Automatic Git statistics tracking (staged, unstaged, ahead/behind counts)
- **Project Organization**: Organize sessions by project with intelligent filtering and search
- **Keyboard Shortcuts**: Full keyboard navigation for power users
- **Terminal-Inspired UI**: Beautiful, retro terminal aesthetic with modern UX patterns

### 🚀 Advanced Features
- **Smart Search**: Search across project names, feature branches, and file paths
- **Multiple View Modes**: Switch between grid and list views for different workflows
- **Easter Eggs**: Hidden features for the curious (try the Konami code!)
- **Welcome Tour**: Interactive onboarding for new users
- **Error Boundaries**: Robust error handling with helpful recovery options
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## 🏗️ Architecture

### Tech Stack
- **Framework**: Next.js 14 with React 18
- **Styling**: Tailwind CSS with custom terminal-inspired theme
- **TypeScript**: Full type safety throughout the application
- **Testing**: Jest with React Testing Library
- **Icons**: Lucide React for consistent iconography

### Project Structure
```
claude-tmux-manager/
├── app/                     # Next.js app directory
│   ├── layout.tsx          # Root layout with theming
│   ├── page.tsx            # Main dashboard page
│   └── api/                # API routes (placeholder for future)
├── components/             # React components
│   ├── SessionCard.tsx     # Session display component
│   ├── NewSessionDialog.tsx # Session creation modal
│   ├── ProjectSidebar.tsx  # Project filtering sidebar
│   ├── EmptyState.tsx      # Empty state with ASCII art
│   ├── WelcomeMessage.tsx  # Onboarding component
│   ├── KeyboardShortcuts.tsx # Hotkey management
│   └── __tests__/          # Component tests
├── lib/                    # Utilities and business logic
│   ├── utils.ts            # Common utilities
│   ├── mockData.ts         # Development mock data
│   └── managers/           # Future session management
├── styles/                 # Global styles
│   └── globals.css         # Tailwind and custom CSS
├── types.ts               # TypeScript type definitions
└── tailwind.config.ts     # Tailwind configuration
```

## 🚀 Quick Start

### Prerequisites
- **Node.js**: Version 18.x or higher
- **pnpm**: Version 8.x or higher
- **tmux**: Version 3.0 or higher (for production use)
- **Git**: Version 2.30 or higher

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/claude-tmux-manager.git
   cd claude-tmux-manager
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables** (optional)
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your preferences
   ```

4. **Start the development server**
   ```bash
   pnpm dev
   ```

5. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Development Mode
The application includes mock data for development, allowing you to explore features without setting up tmux sessions:

```bash
# Enable mock data (default in development)
export NEXT_PUBLIC_USE_MOCK_DATA=true
pnpm dev
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + N` | Create new session |
| `Cmd/Ctrl + K` | Focus search bar |
| `Cmd/Ctrl + R` | Refresh sessions |
| `Escape` | Close modals/clear focus |
| `↑↑↓↓←→←→BA` | Konami code surprise! |

## 🎨 Customization

### Theme Configuration
The application uses a terminal-inspired theme defined in `tailwind.config.ts`:

```typescript
export default {
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',      // Deep black background
        foreground: '#e0e0e0',      // Light text
        accent: '#00ff88',          // Terminal green
        success: '#00ff88',         // Success messages
        warning: '#ffaa00',         // Warning states
        error: '#ff4444',           // Error states
        muted: '#666666',           // Secondary text
      },
      animation: {
        'terminal-glow': 'glow 2s ease-in-out infinite alternate',
        'scan-line': 'scan 2s linear infinite',
        'bounce-subtle': 'bounce-subtle 3s ease-in-out infinite',
      }
    }
  }
}
```

### Custom Animations
- **Terminal Glow**: Subtle pulsing effect for active elements
- **Scan Lines**: Retro CRT monitor effect
- **Matrix Rain**: Easter egg background animation
- **Typing Effects**: Simulated terminal text input

## 🧪 Testing

### Run Tests
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run tests in CI mode
pnpm test:ci
```

### Test Structure
- **Unit Tests**: Component behavior and utilities
- **Integration Tests**: Feature workflows and interactions
- **Snapshot Tests**: UI consistency checks
- **Mock Services**: Simulated tmux and git operations

### Example Test
```typescript
describe('SessionCard', () => {
  it('displays session information correctly', () => {
    const mockSession = {
      projectName: 'test-project',
      featureName: 'test-feature',
      isActive: true,
      gitStats: {
        branch: 'feature/test-feature',
        staged: 2,
        unstaged: 1,
        hasUncommittedChanges: true
      }
    }

    render(<SessionCard session={mockSession} />)
    
    expect(screen.getByText('test-project')).toBeInTheDocument()
    expect(screen.getByText('test-feature')).toBeInTheDocument()
    expect(screen.getByTitle('Active session')).toBeInTheDocument()
  })
})
```

## 🏗️ Building the Project

### Development Build
```bash
# Create development build
pnpm build

# Start development server
pnpm dev
```

### Environment Variables
```bash
# .env.local (for development)
NEXT_PUBLIC_USE_MOCK_DATA=true
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
```

## 🔧 Configuration

### TMux Integration
For development, ensure tmux is properly configured:

```bash
# ~/.tmux.conf
set -g default-terminal "screen-256color"
set -g status-position top
set -g mouse on

# Enable session naming
set -g automatic-rename off
set -g allow-rename off
```

### Git Worktree Setup
The application expects Git worktrees in a specific structure:

```
project-root/
├── .git/
├── main-branch-files/
└── .worktrees/
    ├── feature-branch-1/
    ├── feature-branch-2/
    └── ...
```

## 🐛 Troubleshooting

### Common Issues

**Sessions not appearing**
- Verify tmux is running: `tmux list-sessions`
- Check tmux socket permissions
- Ensure proper Git worktree setup

**Git statistics not updating**
- Verify Git repository is initialized
- Check file permissions in worktree directories
- Ensure Git status commands work in terminal

**Performance issues**
- Check for large numbers of tmux sessions
- Monitor memory usage with `ps aux | grep tmux`
- Consider session cleanup for old branches

**UI not loading**
- Clear browser cache and localStorage
- Check browser console for JavaScript errors
- Verify all dependencies are installed

### Debug Mode
Enable debug logging:

```bash
export DEBUG=claude-tmux:*
export NODE_ENV=development
pnpm dev
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork and clone the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Install dependencies: `pnpm install`
4. Run tests: `pnpm test`
5. Start development: `pnpm dev`
6. Make your changes and add tests
7. Commit with conventional commit format
8. Push and create a pull request

### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: Airbnb configuration with Next.js rules
- **Prettier**: Consistent code formatting
- **Husky**: Pre-commit hooks for quality checks

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **tmux**: The terminal multiplexer that inspired this project
- **Next.js**: For the amazing React framework
- **Tailwind CSS**: For making styling enjoyable
- **Lucide**: For the beautiful icon set
- **The Terminal Community**: For inspiring the retro aesthetic

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/claude-tmux-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/claude-tmux-manager/discussions)
- **Email**: support@claude-tmux-manager.dev

---

<div align="center">

**Built with ❤️ for terminal enthusiasts**

[⚡ Getting Started](#-quick-start) • [📚 Documentation](#-architecture) • [🤝 Contributing](#-contributing) • [🐛 Issues](https://github.com/yourusername/claude-tmux-manager/issues)

</div>