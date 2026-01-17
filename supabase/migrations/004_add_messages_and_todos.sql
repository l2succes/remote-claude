-- Messages table (conversation history for each task)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  tool_use JSONB, -- Store tool use information
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast task message retrieval
CREATE INDEX idx_messages_task_id ON messages(task_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- RLS policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own tasks"
  ON messages FOR SELECT
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN workspaces w ON t.workspace_id = w.id
      WHERE w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own tasks"
  ON messages FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN workspaces w ON t.workspace_id = w.id
      WHERE w.user_id = auth.uid()
    )
  );

-- Task todos (planning todos that Claude generates)
CREATE TABLE task_todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  active_form TEXT NOT NULL, -- "Running tests" vs "Run tests"
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_task_todos_task_id ON task_todos(task_id);
CREATE INDEX idx_task_todos_status ON task_todos(status);

ALTER PUBLICATION supabase_realtime ADD TABLE task_todos;

ALTER TABLE task_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view todos in own tasks"
  ON task_todos FOR SELECT
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN workspaces w ON t.workspace_id = w.id
      WHERE w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create todos in own tasks"
  ON task_todos FOR INSERT
  WITH CHECK (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN workspaces w ON t.workspace_id = w.id
      WHERE w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update todos in own tasks"
  ON task_todos FOR UPDATE
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN workspaces w ON t.workspace_id = w.id
      WHERE w.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete todos in own tasks"
  ON task_todos FOR DELETE
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN workspaces w ON t.workspace_id = w.id
      WHERE w.user_id = auth.uid()
    )
  );
