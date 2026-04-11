-- Enable the pg_cron extension if it doesn't already exist
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule a job to run every minute that deletes games that haven't been pinged in the last 10 minutes
-- And they are in a waiting state, or finished state, or playing state without activity. Actually we can just delete any game where last_ping is older than 10 minutes.
SELECT cron.schedule(
    'cleanup-inactive-games',
    '* * * * *',
    $$ DELETE FROM games WHERE last_ping < NOW() - INTERVAL '10 minutes'; $$
);
