-- Migration: Add email verification fields to users table
-- Run once on existing databases

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verification_token   VARCHAR(64),
  ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMPTZ;
