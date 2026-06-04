-- ============================================
-- Hinex PaperForge — Initial Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    role TEXT DEFAULT 'teacher' CHECK (role IN ('admin', 'teacher', 'reviewer')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Upload batches
CREATE TABLE IF NOT EXISTS upload_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    file_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Individual uploaded files
CREATE TABLE IF NOT EXISTS uploaded_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES upload_batches(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('jpg', 'jpeg', 'png', 'pdf')),
    storage_path TEXT NOT NULL,
    page_count INTEGER DEFAULT 1,
    processing_status TEXT DEFAULT 'pending'
        CHECK (processing_status IN (
            'pending', 'preprocessing', 'ocr_running',
            'structuring', 'completed', 'failed'
        )),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Questions (temporary — deleted after PDF generation)
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    batch_id UUID REFERENCES upload_batches(id) ON DELETE CASCADE,
    question_text TEXT,
    question_image_path TEXT,
    question_mode TEXT NOT NULL DEFAULT 'text'
        CHECK (question_mode IN ('text', 'image')),
    original_ocr_text TEXT,
    subject TEXT NOT NULL,
    chapter TEXT,
    class_grade TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN (
        'mcq', 'short_answer', 'long_answer', 'numerical',
        'fill_blanks', 'true_false', 'assertion_reason', 'match_following'
    )),
    marks INTEGER DEFAULT 1,
    source_file_id UUID REFERENCES uploaded_files(id),
    source_page_number INTEGER,
    source_image_path TEXT,
    approval_status TEXT DEFAULT 'pending'
        CHECK (approval_status IN ('pending', 'approved', 'rejected')),
    confidence_score REAL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_questions_filters
    ON questions(created_by, subject, class_grade, chapter, question_type, approval_status);

-- Papers (PERMANENT)
CREATE TABLE IF NOT EXISTS papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES auth.users(id) NOT NULL,
    title TEXT NOT NULL,
    school_name TEXT DEFAULT 'English Pathshala',
    exam_name TEXT,
    subject TEXT NOT NULL,
    class_grade TEXT NOT NULL,
    duration_minutes INTEGER,
    max_marks INTEGER,
    instructions TEXT,
    sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_marks INTEGER,
    pdf_storage_path TEXT,
    status TEXT DEFAULT 'draft'
        CHECK (status IN ('draft', 'finalized', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_papers_user ON papers(created_by, created_at DESC);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE upload_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users see own profile" ON profiles
    FOR ALL USING (auth.uid() = id);

-- Upload batches
CREATE POLICY "Users manage own batches" ON upload_batches
    FOR ALL USING (auth.uid() = created_by);

-- Uploaded files (via batch ownership)
CREATE POLICY "Users manage own files" ON uploaded_files
    FOR ALL USING (
        batch_id IN (SELECT id FROM upload_batches WHERE created_by = auth.uid())
    );

-- Questions
CREATE POLICY "Users manage own questions" ON questions
    FOR ALL USING (auth.uid() = created_by);

-- Papers
CREATE POLICY "Users manage own papers" ON papers
    FOR ALL USING (auth.uid() = created_by);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
        'teacher'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
