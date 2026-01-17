-- Fix RLS policies to work in local dev (where auth.uid() is null and user_id is null)

-- First, fix workspaces table RLS policies
DROP POLICY IF EXISTS "Users can view own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can create own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can update own workspaces" ON workspaces;
DROP POLICY IF EXISTS "Users can delete own workspaces" ON workspaces;

CREATE POLICY "Users can view own workspaces"
  ON workspaces FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IS NULL
  );

CREATE POLICY "Users can create own workspaces"
  ON workspaces FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IS NULL
  );

CREATE POLICY "Users can update own workspaces"
  ON workspaces FOR UPDATE
  USING (
    user_id = auth.uid()
    OR user_id IS NULL
  );

CREATE POLICY "Users can delete own workspaces"
  ON workspaces FOR DELETE
  USING (
    user_id = auth.uid()
    OR user_id IS NULL
  );

-- Fix messages table RLS policies
DROP POLICY IF EXISTS "Users can view messages in own tasks" ON messages;
DROP POLICY IF EXISTS "Users can create messages in own tasks" ON messages;

CREATE POLICY "Users can view messages in own tasks"
  ON messages FOR SELECT
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN workspaces w ON t.workspace_id = w.id
      WHERE w.user_id = auth.uid()
         OR w.user_id IS NULL
    )
  );

CREATE POLICY "Users can create messages in own tasks"
  ON messages FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN workspaces w ON t.workspace_id = w.id
      WHERE w.user_id = auth.uid()
         OR w.user_id IS NULL
    )
  );

-- Fix task_todos table RLS policies
DROP POLICY IF EXISTS "Users can view todos in own tasks" ON task_todos;
DROP POLICY IF EXISTS "Users can create todos in own tasks" ON task_todos;
DROP POLICY IF EXISTS "Users can update todos in own tasks" ON task_todos;
DROP POLICY IF EXISTS "Users can delete todos in own tasks" ON task_todos;

CREATE POLICY "Users can view todos in own tasks"
  ON task_todos FOR SELECT
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN workspaces w ON t.workspace_id = w.id
      WHERE w.user_id = auth.uid()
         OR w.user_id IS NULL
    )
  );

CREATE POLICY "Users can create todos in own tasks"
  ON task_todos FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN workspaces w ON t.workspace_id = w.id
      WHERE w.user_id = auth.uid()
         OR w.user_id IS NULL
    )
  );

CREATE POLICY "Users can update todos in own tasks"
  ON task_todos FOR UPDATE
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN workspaces w ON t.workspace_id = w.id
      WHERE w.user_id = auth.uid()
         OR w.user_id IS NULL
    )
  );

CREATE POLICY "Users can delete todos in own tasks"
  ON task_todos FOR DELETE
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN workspaces w ON t.workspace_id = w.id
      WHERE w.user_id = auth.uid()
         OR w.user_id IS NULL
    )
  );
