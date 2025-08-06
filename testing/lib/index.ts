/**
 * Library Tests Index
 * 
 * Tests for core library functionality including:
 * - Command execution and error handling
 * - Tmux and Git adapters
 * - Session management
 * - Utility functions
 */

// Core library tests
import './command-executor.test'
import './errors.test'
import './utils.test'

// Adapter tests
import './adapters/tmux.test'
import './adapters/git.test'

// Manager tests
import './managers/SessionManager.test'
import './managers/SessionManager.basic.test'

export {}