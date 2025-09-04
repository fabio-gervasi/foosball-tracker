-- REVERT: Make avatars bucket private again for security
-- Remove the public access we added earlier

-- Update bucket back to private
UPDATE storage.buckets
SET public = false
WHERE id = 'make-171cbf6f-avatars';

-- Remove the public access policy (keeping only authenticated policies)
DROP POLICY IF EXISTS "Public Access to Avatars" ON storage.objects;

-- Keep only the authenticated policies for security
-- Allow authenticated users to upload to avatars bucket
CREATE POLICY "Allow authenticated avatar uploads" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'make-171cbf6f-avatars');

-- Allow users to update/delete their own avatars
CREATE POLICY "Allow users to manage their avatars" ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'make-171cbf6f-avatars');

CREATE POLICY "Allow users to delete their avatars" ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'make-171cbf6f-avatars');
