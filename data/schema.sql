-- Schema definition for Adaptive AtCoder Practice Platform
-- Database: /home/atrv/Desktop/atcoder/data/atcoder_flow.db

CREATE TABLE IF NOT EXISTS problems (
    id TEXT PRIMARY KEY,
    contest_id TEXT NOT NULL,
    problem_index TEXT NOT NULL,
    name TEXT,
    title TEXT NOT NULL,
    difficulty INTEGER,
    clipped_difficulty INTEGER,
    category TEXT,
    sub_category TEXT,
    hints_json TEXT,
    sample_tests_json TEXT,
    statement_html TEXT,
    time_limit_ms INTEGER,
    memory_limit_mb INTEGER,
    is_solved INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON problems(difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_clipped_diff ON problems(clipped_difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_contest ON problems(contest_id);
CREATE INDEX IF NOT EXISTS idx_problems_category ON problems(category);
CREATE INDEX IF NOT EXISTS idx_problems_is_solved ON problems(is_solved);

CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY,
    epoch_second INTEGER NOT NULL,
    problem_id TEXT NOT NULL,
    contest_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    language TEXT NOT NULL,
    point REAL NOT NULL,
    length INTEGER NOT NULL,
    result TEXT NOT NULL,
    execution_time INTEGER,
    is_optimistic INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_submissions_user_epoch ON submissions(user_id, epoch_second DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_problem_res ON submissions(problem_id, result);

CREATE TABLE IF NOT EXISTS tech_tree (
    node_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    tier INTEGER NOT NULL,
    category TEXT NOT NULL,
    prereqs_json TEXT NOT NULL,
    unlock_threshold INTEGER NOT NULL,
    solved_count INTEGER DEFAULT 0,
    is_unlocked INTEGER DEFAULT 0,
    is_mastered INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_state (
    handle TEXT PRIMARY KEY,
    streak INTEGER DEFAULT 0,
    xp REAL DEFAULT 0,
    multiplier REAL DEFAULT 1.0,
    training_rating REAL DEFAULT 1150,
    session_paused INTEGER DEFAULT 0,
    session_elapsed_seconds INTEGER DEFAULT 0,
    session_solves INTEGER DEFAULT 0,
    last_solve_epoch INTEGER,
    active_problem_id TEXT,
    active_session_start INTEGER
);

CREATE TABLE IF NOT EXISTS user_preferences (
    handle TEXT PRIMARY KEY,
    hide_difficulty INTEGER DEFAULT 0,
    contest_filter TEXT DEFAULT 'ALL',
    min_diff INTEGER DEFAULT 1000,
    max_diff INTEGER DEFAULT 1500,
    muted INTEGER DEFAULT 0
);
