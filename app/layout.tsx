import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Claude TMux Manager',
  description: 'Manage Claude Code sessions with tmux and git worktrees',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased min-h-screen bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  )
}