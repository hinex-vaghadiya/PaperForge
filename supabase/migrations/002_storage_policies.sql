-- ============================================
-- Storage Policies for Hinex PaperForge
-- Run this in Supabase SQL Editor to allow file uploads
-- ============================================

-- Enable RLS on storage objects (usually enabled by default, but just in case)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 1. Uploads Bucket Policies
CREATE POLICY "Users can upload their own files" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read their own files" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files" 
ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 2. Question Images Bucket Policies
CREATE POLICY "Users can insert question images" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'question-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read question images" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'question-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete question images" 
ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'question-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3. Generated Papers Bucket Policies
CREATE POLICY "Users can insert generated papers" 
ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'generated-papers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can read generated papers" 
ON storage.objects FOR SELECT TO authenticated 
USING (bucket_id = 'generated-papers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete generated papers" 
ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'generated-papers' AND auth.uid()::text = (storage.foldername(name))[1]);
