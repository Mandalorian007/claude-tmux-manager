import type { Metadata } from 'next/types'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

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
      <head />
      <body className={`${inter.className} antialiased min-h-screen bg-background text-foreground`}>
        {children}
      </body>
    </html>
  )
}