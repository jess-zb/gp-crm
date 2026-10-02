-- The refunds table shipped without table privileges, so PostgREST refused every
-- request with "permission denied for table refunds" and the Refunds tab could
-- not load. Privileges are checked before RLS, so the policies in
-- 20260805220000_refunds.sql never got a chance to run.
--
-- Row-level access is unchanged and still comes from those policies; these
-- grants only let the roles reach the table at all. DELETE is deliberately
-- withheld from authenticated: refunds are denied by status, never removed.

GRANT SELECT, INSERT, UPDATE ON refunds TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON refunds TO service_role;
