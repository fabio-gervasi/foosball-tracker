-- Migration: Create relational database schema for foosball tracker
-- This replaces the KV store approach with proper relational tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  name TEXT NOT NULL,
  avatar TEXT,
  is_admin BOOLEAN DEFAULT false,
  singles_elo INTEGER DEFAULT 1200,
  doubles_elo INTEGER DEFAULT 1200,
  singles_wins INTEGER DEFAULT 0,
  singles_losses INTEGER DEFAULT 0,
  doubles_wins INTEGER DEFAULT 0,
  doubles_losses INTEGER DEFAULT 0,
  current_group_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT false
);

-- Create groups table
CREATE TABLE groups (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_groups junction table
CREATE TABLE user_groups (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  group_code TEXT REFERENCES groups(code) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, group_code)
);

-- Create matches table
CREATE TABLE matches (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  group_code TEXT REFERENCES groups(code),
  match_type TEXT CHECK (match_type IN ('1v1', '2v2')),
  series_type TEXT CHECK (series_type IN ('bo1', 'bo3', 'bo5')),
  recorded_by UUID REFERENCES users(id),
  winner_email TEXT,
  winner_is_guest BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create match_players table
CREATE TABLE match_players (
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  team TEXT CHECK (team IN ('team1', 'team2')),
  position INTEGER CHECK (position IN (1, 2)), -- player1 or player2
  is_guest BOOLEAN DEFAULT false,
  guest_name TEXT,
  PRIMARY KEY (match_id, user_id)
);

-- Create match_results table
CREATE TABLE match_results (
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  game_number INTEGER,
  winning_team TEXT CHECK (winning_team IN ('team1', 'team2')),
  PRIMARY KEY (match_id, game_number)
);

-- Create elo_changes table
CREATE TABLE elo_changes (
  match_id TEXT REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  old_rating INTEGER NOT NULL,
  new_rating INTEGER NOT NULL,
  rating_type TEXT CHECK (rating_type IN ('singles', 'doubles')),
  change_amount INTEGER NOT NULL,
  PRIMARY KEY (match_id, user_id, rating_type)
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_current_group ON users(current_group_code);
CREATE INDEX idx_matches_group_code ON matches(group_code);
CREATE INDEX idx_matches_date ON matches(date);
CREATE INDEX idx_match_players_user_id ON match_players(user_id);
CREATE INDEX idx_elo_changes_user_id ON elo_changes(user_id);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE elo_changes ENABLE ROW LEVEL SECURITY;
