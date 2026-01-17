import { createBrowserClient } from '@supabase/ssr'

// Client-side Supabase client (for React components)
export const createClient = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Database types
export type Workspace = {
  id: string
  user_id: string
  name: string
  repo_url: string
  repo_name: string
  repo_owner: string
  default_branch: string
  disk_path: string
  clone_status: 'pending' | 'cloning' | 'ready' | 'error'
  created_at: string
  updated_at: string
}

export type Task = {
  id: string
  workspace_id: string
  name: string
  description?: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  session_id?: string
  started_at?: string
  completed_at?: string
  created_at: string
}

export type Message = {
  id: string
  task_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  tool_use?: {
    tool: string
    params: any
    result?: any
  }
  timestamp: string
  created_at: string
}

export type TaskTodo = {
  id: string
  task_id: string
  text: string
  active_form: string
  status: 'pending' | 'in_progress' | 'completed'
  created_at: string
  completed_at?: string
}
