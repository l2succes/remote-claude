'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { WorkspaceManager } from '@/lib/workspace-manager'
import type { Workspace } from '@/lib/supabase/client'

export default function WorkspacesPage() {
  const router = useRouter()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()

    // Check authentication
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/')
        return
      }
      setUser(user)
      loadWorkspaces()
    })

    // Subscribe to workspace updates
    const channel = supabase
      .channel('workspaces')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspaces',
        },
        () => {
          loadWorkspaces()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [router])

  const loadWorkspaces = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setWorkspaces(data || [])
    } catch (error) {
      console.error('Error loading workspaces:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'text-green-500'
      case 'cloning':
        return 'text-yellow-500'
      case 'error':
        return 'text-red-500'
      default:
        return 'text-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ready':
        return 'Ready'
      case 'cloning':
        return 'Cloning...'
      case 'error':
        return 'Error'
      default:
        return 'Pending'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading workspaces...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Workspaces</h1>
            <p className="text-gray-400">
              Manage your GitHub repositories and agent tasks
            </p>
          </div>
          <Link
            href="/workspaces/new"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            + New Workspace
          </Link>
        </div>

        {/* User info */}
        {user && (
          <div className="mb-6 px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg">
            <p className="text-sm text-gray-400">
              Signed in as <span className="text-white">{user.user_metadata?.user_name || user.email}</span>
            </p>
          </div>
        )}

        {/* Workspaces Grid */}
        {workspaces.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📁</div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              No workspaces yet
            </h2>
            <p className="text-gray-400 mb-6">
              Create your first workspace by connecting a GitHub repository
            </p>
            <Link
              href="/workspaces/new"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Connect Repository
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces.map((workspace) => (
              <Link
                key={workspace.id}
                href={`/workspaces/${workspace.id}`}
                className="block p-6 bg-gray-900 border border-gray-800 rounded-lg hover:border-blue-500 transition-all hover:shadow-lg hover:shadow-blue-500/10"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {workspace.name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {workspace.repo_owner}/{workspace.repo_name}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(
                      workspace.clone_status
                    )}`}
                  >
                    {getStatusText(workspace.clone_status)}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>🌿 {workspace.default_branch}</span>
                  <span>
                    📅{' '}
                    {new Date(workspace.created_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
