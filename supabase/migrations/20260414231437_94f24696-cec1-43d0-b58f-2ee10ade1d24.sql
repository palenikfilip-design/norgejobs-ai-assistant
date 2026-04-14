
-- Create storage bucket for language certificates
INSERT INTO storage.buckets (id, name, public) VALUES ('language-certificates', 'language-certificates', false);

-- Allow authenticated users to upload their own certificates
CREATE POLICY "Users can upload own certificates" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'language-certificates' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to view their own certificates
CREATE POLICY "Users can view own certificates" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'language-certificates' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own certificates
CREATE POLICY "Users can delete own certificates" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'language-certificates' AND (storage.foldername(name))[1] = auth.uid()::text);
