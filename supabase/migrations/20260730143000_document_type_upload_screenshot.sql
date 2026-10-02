-- UI document types "Upload" and "Screenshot" were missing from the Postgres enum,
-- causing upload-complete to fail after storage succeeded (invalid input value for enum).

ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'upload';
ALTER TYPE document_type ADD VALUE IF NOT EXISTS 'screenshot';
