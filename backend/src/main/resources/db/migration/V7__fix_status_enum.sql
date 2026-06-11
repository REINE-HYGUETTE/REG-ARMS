-- Rename the request_status enum value from 'In Progress' to 'In_Progress'
-- to match the Java enum RequestStatus.In_Progress (uses underscore, not space)
ALTER TYPE request_status RENAME VALUE 'In Progress' TO 'In_Progress';
