-- Rename the supervisor seed account email so no trace of the role remains in data
UPDATE users SET email = 'staff2@reg.rw' WHERE email = 'supervisor@reg.rw';
