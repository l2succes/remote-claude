-- Temporarily disable RLS for local development without authentication
-- TODO: Re-enable these when GitHub OAuth is configured

-- Disable RLS on tables
ALTER TABLE workspaces DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

-- Note: In production, you should re-enable RLS and configure proper authentication
-- This is only for local development and testing purposes
