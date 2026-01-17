'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { WorkspaceManager } from '@/lib/workspace-manager'

export default function NewWorkspacePage() {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [workspaceName, setWorkspaceName] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [repoOwner, setRepoOwner] = useState('')
  const [repoName, setRepoName] = useState('')
  const [defaultBranch, setDefaultBranch] = useState('main')

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setCreating(true)
      setError(null)

      // Validate required fields
      if (!workspaceName || !repoUrl) {
        throw new Error('Workspace name and repository URL are required')
      }

      // Parse repo info from URL if not provided
      let owner = repoOwner
      let name = repoName

      if (!owner || !name) {
        // Try to parse from GitHub URL (e.g., https://github.com/owner/repo)
        const urlMatch = repoUrl.match(/github\.com[/:]([\w-]+)\/([\w-]+)/)
        if (urlMatch) {
          owner = owner || urlMatch[1]
          name = name || urlMatch[2]
        } else {
          // Use workspace name as fallback
          owner = owner || 'local'
          name = name || workspaceName.toLowerCase().replace(/\s+/g, '-')
        }
      }

      const workspace = await WorkspaceManager.createWorkspace({
        repoUrl: repoUrl,
        repoName: name,
        repoOwner: owner,
        defaultBranch: defaultBranch || 'main',
      })

      // Navigate to the new workspace
      router.push(`/workspaces/${workspace.id}`)
    } catch (err) {
      console.error('Error creating workspace:', err)
      setError(err instanceof Error ? err.message : 'Failed to create workspace')
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/workspaces"
            className="text-blue-500 hover:text-blue-400 mb-4 inline-block"
          >
            ← Back to Workspaces
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">
            Create New Workspace
          </h1>
          <p className="text-gray-400">
            Create a workspace to start chatting with Claude Code
          </p>
        </div>

        {/* Info Box */}
        <div className="mb-6 px-4 py-3 bg-blue-900/20 border border-blue-800 rounded-lg">
          <p className="text-sm text-blue-400">
            💡 <strong>Quick Start Mode:</strong> GitHub OAuth is not configured. You can still create workspaces and chat with Claude Code - just provide any repository URL or use a placeholder.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-900/20 border border-red-800 rounded-lg">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleCreateWorkspace} className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-6">
            {/* Workspace Name */}
            <div>
              <label htmlFor="workspaceName" className="block text-sm font-medium text-gray-300 mb-2">
                Workspace Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="workspaceName"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="My Awesome Project"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                required
              />
              <p className="mt-1 text-xs text-gray-500">A friendly name for your workspace</p>
            </div>

            {/* Repository URL */}
            <div>
              <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-300 mb-2">
                Repository URL <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="repoUrl"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repo or any Git URL"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Any Git repository URL (for testing, you can use: <code className="text-blue-400">https://github.com/example/demo</code>)
              </p>
            </div>

            {/* Advanced Options - Collapsed by default */}
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-gray-400 hover:text-gray-300 flex items-center gap-2">
                <span className="group-open:rotate-90 transition-transform">▶</span>
                Advanced Options (optional)
              </summary>

              <div className="mt-4 space-y-4 pl-6">
                <div className="grid grid-cols-2 gap-4">
                  {/* Repo Owner */}
                  <div>
                    <label htmlFor="repoOwner" className="block text-sm font-medium text-gray-300 mb-2">
                      Repository Owner
                    </label>
                    <input
                      type="text"
                      id="repoOwner"
                      value={repoOwner}
                      onChange={(e) => setRepoOwner(e.target.value)}
                      placeholder="username"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Repo Name */}
                  <div>
                    <label htmlFor="repoName" className="block text-sm font-medium text-gray-300 mb-2">
                      Repository Name
                    </label>
                    <input
                      type="text"
                      id="repoName"
                      value={repoName}
                      onChange={(e) => setRepoName(e.target.value)}
                      placeholder="repository"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Default Branch */}
                <div>
                  <label htmlFor="defaultBranch" className="block text-sm font-medium text-gray-300 mb-2">
                    Default Branch
                  </label>
                  <input
                    type="text"
                    id="defaultBranch"
                    value={defaultBranch}
                    onChange={(e) => setDefaultBranch(e.target.value)}
                    placeholder="main"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Defaults to "main" if not specified</p>
                </div>
              </div>
            </details>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={creating}
              className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {creating ? 'Creating Workspace...' : 'Create Workspace'}
            </button>
            <Link
              href="/workspaces"
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors text-center"
            >
              Cancel
            </Link>
          </div>
        </form>

        {/* Quick Start Examples */}
        <div className="mt-8 p-4 bg-gray-900 border border-gray-800 rounded-lg">
          <h3 className="text-sm font-medium text-gray-300 mb-3">💡 Quick Start Examples</h3>
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <div>
                <strong className="text-gray-300">Test workspace:</strong> Use any name and URL like <code className="text-blue-400">https://github.com/example/test</code>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <div>
                <strong className="text-gray-300">Local project:</strong> Create a workspace to chat about code concepts without cloning
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-500">⚠</span>
              <div>
                <strong className="text-gray-300">Note:</strong> Repository cloning won't work without proper authentication setup
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
