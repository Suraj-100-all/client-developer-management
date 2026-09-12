-- ==============================================================================
-- VELOZITY GLOBAL SOLUTIONS - TECHNICAL HIRING ASSESSMENT
-- Database Schema: PostgreSQL 15+ Relational Architecture
-- ==============================================================================

-- 1. ENUMS
CREATE TYPE user_role AS ENUM ('ADMIN', 'PROJECT_MANAGER', 'DEVELOPER');
CREATE TYPE task_status AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');
CREATE TYPE task_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- 2. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    avatar_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    company VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. PROJECTS TABLE
-- Foreign Key: client_id -> clients(id)
-- Foreign Key: created_by_pm_id -> users(id)
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    created_by_pm_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TASKS TABLE
-- Foreign Key: project_id -> projects(id)
-- Foreign Key: assigned_to_dev_id -> users(id)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_number SERIAL NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assigned_to_dev_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status task_status NOT NULL DEFAULT 'TODO',
    priority task_priority NOT NULL DEFAULT 'MEDIUM',
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_overdue BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TASK ACTIVITY LOGS TABLE (Must be stored in DB, not derived!)
-- Foreign Key: task_id -> tasks(id)
-- Foreign Key: project_id -> projects(id)
-- Foreign Key: user_id -> users(id)
CREATE TABLE IF NOT EXISTS task_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action_type VARCHAR(50) NOT NULL, -- e.g. 'STATUS_CHANGE', 'ASSIGNMENT', 'OVERDUE_FLAGGED'
    old_value VARCHAR(100),
    new_value VARCHAR(100),
    formatted_message TEXT NOT NULL, -- e.g. "Ravi moved Task #12 from In Progress → In Review"
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. NOTIFICATIONS TABLE
-- Foreign Key: user_id -> users(id)
-- Foreign Key: task_id -> tasks(id)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. REFRESH TOKENS TABLE (For revocation & session management)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- INDEXING DECISIONS & PERFORMANCE OPTIMIZATIONS
-- ==============================================================================

-- 1. Tasks by Project: Enables fast retrieval of tasks when opening a project board.
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);

-- 2. Tasks by Assigned Developer: Developer view filters tasks assigned strictly to them.
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_dev ON tasks(assigned_to_dev_id);

-- 3. Tasks by Due Date & Status (Composite index): Crucial for the background overdue job
-- which scans: WHERE status != 'DONE' AND due_date < NOW() AND is_overdue = false
CREATE INDEX IF NOT EXISTS idx_tasks_overdue_scan ON tasks(due_date, status, is_overdue);

-- 4. Projects by Creator PM: PM dashboard filters projects where created_by_pm_id = current_user.id
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by_pm_id);

-- 5. Activity Logs by Project & Timestamp: Global / Project feed queries order by created_at DESC
CREATE INDEX IF NOT EXISTS idx_activity_project_created ON task_activity_logs(project_id, created_at DESC);

-- 6. Activity Logs by Task: Fetching the task audit history
CREATE INDEX IF NOT EXISTS idx_activity_task_id ON task_activity_logs(task_id);

-- 7. Unread Notifications by User: Fast lookup for real-time badge count and dropdown list
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
