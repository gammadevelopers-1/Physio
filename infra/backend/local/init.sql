-- ===========================================
-- Database Initialization Script
-- ===========================================
-- This runs when the database container is first created

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE physioguidance TO postgres;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Database initialized successfully!';
END $$;
