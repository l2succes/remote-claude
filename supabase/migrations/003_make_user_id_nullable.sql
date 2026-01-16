-- Make user_id nullable for local development without authentication
-- This allows creating workspaces without a real user account

ALTER TABLE workspaces ALTER COLUMN user_id DROP NOT NULL;

-- Also remove the unique constraint that requires user_id
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_user_id_repo_name_key;

-- Add a new unique constraint on just repo_name for local dev
-- (In production with auth, you'd want the user_id in this constraint)
CREATE UNIQUE INDEX workspaces_repo_name_key ON workspaces(repo_name) WHERE user_id IS NULL;
