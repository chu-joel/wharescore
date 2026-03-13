-- WhareScore POC: Database Setup
-- Run this AFTER PostgreSQL + PostGIS are installed
-- Execute with: psql -U postgres -f 01-create-database.sql

-- Create the database
CREATE DATABASE wharescore;

-- Connect to it
\c wharescore

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify PostGIS is working
SELECT PostGIS_Version();
