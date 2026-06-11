-- Add Cancelled value to the request_status enum so customers can withdraw Pending requests
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'Cancelled';
