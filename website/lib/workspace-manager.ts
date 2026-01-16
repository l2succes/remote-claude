import { createClient, Workspace, Task } from './supabase/client'

export class WorkspaceManager {
  /**
   * Get all workspaces for the current user
   */
  static async getUserWorkspaces(): Promise<Workspace[]> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching workspaces:', error)
      throw new Error(error.message)
    }

    return data || []
  }

  /**
   * Get a single workspace by ID
   */
  static async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single()

    if (error) {
      console.error('Error fetching workspace:', error)
      return null
    }

    return data
  }

  /**
   * Create a new workspace from a GitHub repository
   */
  static async createWorkspace(params: {
    repoUrl: string
    repoName: string
    repoOwner: string
    defaultBranch?: string
  }): Promise<Workspace> {
    const supabase = createClient()

    // Get current user (optional for local dev)
    const { data: { user } } = await supabase.auth.getUser()

    // For local dev without auth, use a default user ID
    const userId = user?.id || 'local-dev-user'

    // Generate disk path
    const workspaceId = crypto.randomUUID()
    const diskPath = `/data/workspaces/${userId}/${workspaceId}/${params.repoName}`

    const { data, error } = await supabase
      .from('workspaces')
      .insert({
        name: params.repoName,
        repo_url: params.repoUrl,
        repo_name: params.repoName,
        repo_owner: params.repoOwner,
        default_branch: params.defaultBranch || 'main',
        disk_path: diskPath,
        clone_status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating workspace:', error)
      throw new Error(error.message)
    }

    // Trigger clone operation on agent server (only if authenticated)
    try {
      // Get GitHub token from session
      const { data: { session } } = await supabase.auth.getSession()

      if (session?.provider_token) {
        // Trigger clone on agent server
        const { AgentServerClient } = await import('./agent-server-client')
        await AgentServerClient.triggerClone({
          workspaceId: data.id,
          repoUrl: params.repoUrl,
          diskPath: diskPath,
          githubToken: session.provider_token,
        })

        console.log(`Clone triggered for workspace ${data.id}`)
      } else {
        console.log(`Skipping clone for workspace ${data.id} - no authentication token`)
        // For local dev, mark as ready without cloning
        await supabase
          .from('workspaces')
          .update({ clone_status: 'ready' })
          .eq('id', data.id)
      }
    } catch (cloneError) {
      console.error('Failed to trigger clone:', cloneError)
      // For local dev, still mark as ready to allow chat functionality
      await supabase
        .from('workspaces')
        .update({ clone_status: 'ready' })
        .eq('id', data.id)
    }

    return data
  }

  /**
   * Delete a workspace
   */
  static async deleteWorkspace(workspaceId: string): Promise<void> {
    const supabase = createClient()

    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId)

    if (error) {
      console.error('Error deleting workspace:', error)
      throw new Error(error.message)
    }
  }

  /**
   * Get tasks for a workspace
   */
  static async getWorkspaceTasks(workspaceId: string): Promise<Task[]> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching tasks:', error)
      throw new Error(error.message)
    }

    return data || []
  }

  /**
   * Create a new task
   */
  static async createTask(params: {
    workspaceId: string
    name: string
    description?: string
  }): Promise<Task> {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        workspace_id: params.workspaceId,
        name: params.name,
        description: params.description,
        status: 'queued',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating task:', error)
      throw new Error(error.message)
    }

    return data
  }

  /**
   * Subscribe to workspace updates (realtime)
   */
  static subscribeToWorkspace(
    workspaceId: string,
    onUpdate: (workspace: Workspace) => void
  ) {
    const supabase = createClient()

    return supabase
      .channel(`workspace:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'workspaces',
          filter: `id=eq.${workspaceId}`,
        },
        (payload) => {
          onUpdate(payload.new as Workspace)
        }
      )
      .subscribe()
  }

  /**
   * Subscribe to task updates (realtime)
   */
  static subscribeToTasks(
    workspaceId: string,
    onUpdate: (task: Task) => void
  ) {
    const supabase = createClient()

    return supabase
      .channel(`tasks:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            onUpdate(payload.new as Task)
          }
        }
      )
      .subscribe()
  }
}
