export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          owner_user_id: string | null
          name: string
          tagline: string | null
          description: string | null
          website: string | null
          location: string | null
          industry: string | null
          employee_count: string | null
          founded_year: number | null
          logo_url: string | null
          subscription_tier: string | null
          created_at: string
          updated_at: string
          brand_primary_color: string | null
          brand_secondary_color: string | null
          brand_accent_color: string | null
          brand_style_recipe: Json | null
          brand_sample_post_path: string | null
        }
        Insert: {
          id?: string
          owner_user_id?: string | null
          name: string
          tagline?: string | null
          description?: string | null
          website?: string | null
          location?: string | null
          industry?: string | null
          employee_count?: string | null
          founded_year?: number | null
          logo_url?: string | null
          subscription_tier?: string | null
          created_at?: string
          updated_at?: string
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          brand_accent_color?: string | null
          brand_style_recipe?: Json | null
          brand_sample_post_path?: string | null
        }
        Update: {
          id?: string
          owner_user_id?: string | null
          name?: string
          tagline?: string | null
          description?: string | null
          website?: string | null
          location?: string | null
          industry?: string | null
          employee_count?: string | null
          founded_year?: number | null
          logo_url?: string | null
          subscription_tier?: string | null
          created_at?: string
          updated_at?: string
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          brand_accent_color?: string | null
          brand_style_recipe?: Json | null
          brand_sample_post_path?: string | null
        }
        Relationships: []
      }
      company_members: {
        Row: {
          id: string
          company_id: string
          user_id: string
          role: string
          invited_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id: string
          user_id: string
          role?: string
          invited_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string
          user_id?: string
          role?: string
          invited_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      cv_requests: {
        Row: {
          id: string
          employer_id: string
          candidate_id: string
          status: string
          cv_path: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          employer_id: string
          candidate_id: string
          status?: string
          cv_path?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          employer_id?: string
          candidate_id?: string
          status?: string
          cv_path?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cv_requests_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cv_requests_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      employer_audit_logs: {
        Row: {
          id: string
          company_id: string | null
          user_id: string | null
          action_type: string
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          user_id?: string | null
          action_type: string
          description: string
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          user_id?: string | null
          action_type?: string
          description?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_audit_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      highlighted_candidates: {
        Row: {
          id: string
          candidate_id: string
          employer_id: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          candidate_id: string
          employer_id: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          candidate_id?: string
          employer_id?: string
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "highlighted_candidates_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "highlighted_candidates_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      application_documents: {
        Row: {
          created_at: string
          filename: string
          id: string
          label: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          label: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          label?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          cover_letter: string | null
          created_at: string
          id: string
          job_id: string
          recruiter_notes: string | null
          starred: boolean | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
          merged_pdf_path: string | null
        }
        Insert: {
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id: string
          recruiter_notes?: string | null
          starred?: boolean | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          merged_pdf_path?: string | null
        }
        Update: {
          cover_letter?: string | null
          created_at?: string
          id?: string
          job_id?: string
          recruiter_notes?: string | null
          starred?: boolean | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          merged_pdf_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_analyses: {
        Row: {
          created_at: string
          cv_filename: string | null
          feedback: string | null
          formatting_score: number
          id: string
          keyword_score: number
          readability_score: number
          score: number
          structure_score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          cv_filename?: string | null
          feedback?: string | null
          formatting_score?: number
          id?: string
          keyword_score?: number
          readability_score?: number
          score: number
          structure_score?: number
          user_id: string
        }
        Update: {
          created_at?: string
          cv_filename?: string | null
          feedback?: string | null
          formatting_score?: number
          id?: string
          keyword_score?: number
          readability_score?: number
          score?: number
          structure_score?: number
          user_id?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          id: string
          key: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_views: {
        Row: {
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          application_deadline: string | null
          application_email: string | null
          company: string
          company_id: string | null
          created_at: string
          description: string
          employment_type: string | null
          hiring_contact_name: string | null
          hiring_contact_title: string | null
          id: string
          industry: string
          is_active: boolean
          job_type: string
          location: string
          posted_by: string | null
          required_field_of_study: string[] | null
          required_qualification: string | null
          required_years_experience: number | null
          salary_range: string | null
          skills: string[]
          title: string
          updated_at: string
          required_documents: string[] | null
          status: string | null
        }
        Insert: {
          application_deadline?: string | null
          application_email?: string | null
          company: string
          company_id?: string | null
          created_at?: string
          description: string
          employment_type?: string | null
          hiring_contact_name?: string | null
          hiring_contact_title?: string | null
          id?: string
          industry: string
          is_active?: boolean
          job_type?: string
          location: string
          posted_by?: string | null
          required_field_of_study?: string[] | null
          required_qualification?: string | null
          required_years_experience?: number | null
          salary_range?: string | null
          skills?: string[]
          title: string
          updated_at?: string
          required_documents?: string[] | null
          status?: string | null
        }
        Update: {
          application_deadline?: string | null
          application_email?: string | null
          company?: string
          company_id?: string | null
          created_at?: string
          description?: string
          employment_type?: string | null
          hiring_contact_name?: string | null
          hiring_contact_title?: string | null
          id?: string
          industry?: string
          is_active?: boolean
          job_type?: string
          location?: string
          posted_by?: string | null
          required_field_of_study?: string[] | null
          required_qualification?: string | null
          required_years_experience?: number | null
          salary_range?: string | null
          skills?: string[]
          title?: string
          updated_at?: string
          required_documents?: string[] | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          job_id: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          job_id?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_type: string | null
          ai_consent_at: string | null
          career_summary: string | null
          created_at: string
          current_job_title: string | null
          current_location: string | null
          cv_extracted_experience_years: number | null
          cv_extracted_qualification: string | null
          cv_extracted_skills: string[] | null
          cv_filename: string | null
          cv_path: string | null
          cv_summary: string | null
          email: string | null
          field_of_study: string | null
          full_name: string | null
          graduation_year: number | null
          highest_education: string | null
          id: string
          industries: string[] | null
          institution: string | null
          onboarding_complete: boolean
          phone: string | null
          postal_address: string | null
          preferred_industries: string[] | null
          residential_address: string | null
          skills: string[] | null
          subscription_expires_at: string | null
          subscription_status: string
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          account_type?: string | null
          ai_consent_at?: string | null
          career_summary?: string | null
          created_at?: string
          current_job_title?: string | null
          current_location?: string | null
          cv_extracted_experience_years?: number | null
          cv_extracted_qualification?: string | null
          cv_extracted_skills?: string[] | null
          cv_filename?: string | null
          cv_path?: string | null
          cv_summary?: string | null
          email?: string | null
          field_of_study?: string | null
          full_name?: string | null
          graduation_year?: number | null
          highest_education?: string | null
          id: string
          industries?: string[] | null
          institution?: string | null
          onboarding_complete?: boolean
          phone?: string | null
          postal_address?: string | null
          preferred_industries?: string[] | null
          residential_address?: string | null
          skills?: string[] | null
          subscription_expires_at?: string | null
          subscription_status?: string
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          account_type?: string | null
          ai_consent_at?: string | null
          career_summary?: string | null
          created_at?: string
          current_job_title?: string | null
          current_location?: string | null
          cv_extracted_experience_years?: number | null
          cv_extracted_qualification?: string | null
          cv_extracted_skills?: string[] | null
          cv_filename?: string | null
          cv_path?: string | null
          cv_summary?: string | null
          email?: string | null
          field_of_study?: string | null
          full_name?: string | null
          graduation_year?: number | null
          highest_education?: string | null
          id?: string
          industries?: string[] | null
          institution?: string | null
          onboarding_complete?: boolean
          phone?: string | null
          postal_address?: string | null
          preferred_industries?: string[] | null
          residential_address?: string | null
          skills?: string[] | null
          subscription_expires_at?: string | null
          subscription_status?: string
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      quick_jobs: {
        Row: {
          budget: string | null
          category: string
          contact: string | null
          contact_number: string | null
          created_at: string
          date_needed: string | null
          description: string
          details: Json | null
          duration: string | null
          id: string
          is_active: boolean
          location: string | null
          pay_amount: number | null
          pay_type: string | null
          payment_status: string
          posted_by: string | null
          poster_id: string | null
          poster_name: string | null
          preferred_gender: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          budget?: string | null
          category: string
          contact?: string | null
          contact_number?: string | null
          created_at?: string
          date_needed?: string | null
          description: string
          details?: Json | null
          duration?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          pay_amount?: number | null
          pay_type?: string | null
          payment_status?: string
          posted_by?: string | null
          poster_id?: string | null
          poster_name?: string | null
          preferred_gender?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          budget?: string | null
          category?: string
          contact?: string | null
          contact_number?: string | null
          created_at?: string
          date_needed?: string | null
          description?: string
          details?: Json | null
          duration?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          pay_amount?: number | null
          pay_type?: string | null
          payment_status?: string
          posted_by?: string | null
          poster_id?: string | null
          poster_name?: string | null
          preferred_gender?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      revamp_requests: {
        Row: {
          additional_attachment_paths: string[] | null
          attachment_paths: string[] | null
          created_at: string
          current_job_title: string | null
          cv_path: string | null
          delivered_at: string | null
          fulfilment_status: string
          id: string
          notes: string | null
          partner_notes: string | null
          payment_status: string
          revamp_amount: number | null
          revamp_level: string | null
          revamped_cv_filename: string | null
          revamped_cv_path: string | null
          target_job_title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_attachment_paths?: string[] | null
          attachment_paths?: string[] | null
          created_at?: string
          current_job_title?: string | null
          cv_path?: string | null
          delivered_at?: string | null
          fulfilment_status?: string
          id?: string
          notes?: string | null
          partner_notes?: string | null
          payment_status?: string
          revamp_amount?: number | null
          revamp_level?: string | null
          revamped_cv_filename?: string | null
          revamped_cv_path?: string | null
          target_job_title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_attachment_paths?: string[] | null
          attachment_paths?: string[] | null
          created_at?: string
          current_job_title?: string | null
          cv_path?: string | null
          delivered_at?: string | null
          fulfilment_status?: string
          id?: string
          notes?: string | null
          partner_notes?: string | null
          payment_status?: string
          revamp_amount?: number | null
          revamp_level?: string | null
          revamped_cv_filename?: string | null
          revamped_cv_path?: string | null
          target_job_title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interview_preps: {
        Row: {
          amount: number | null
          attachment_paths: string[] | null
          created_at: string
          delivered_at: string | null
          id: string
          interview_date: string | null
          meeting_link: string | null
          partner_notes: string | null
          payment_status: string
          script_path: string | null
          session_scheduled_at: string | null
          status: string
          target_role: string | null
          type: string
          user_id: string
          job_id: string | null
        }
        Insert: {
          amount?: number | null
          attachment_paths?: string[] | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          interview_date?: string | null
          meeting_link?: string | null
          partner_notes?: string | null
          payment_status?: string
          script_path?: string | null
          session_scheduled_at?: string | null
          status?: string
          target_role?: string | null
          type: string
          user_id: string
          job_id?: string | null
        }
        Update: {
          amount?: number | null
          attachment_paths?: string[] | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          interview_date?: string | null
          meeting_link?: string | null
          partner_notes?: string | null
          payment_status?: string
          script_path?: string | null
          session_scheduled_at?: string | null
          status?: string
          target_role?: string | null
          type?: string
          user_id?: string
          job_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_preps_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          }
        ]
      }
      swipes: {
        Row: {
          action: Database["public"]["Enums"]["swipe_action"]
          created_at: string
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["swipe_action"]
          created_at?: string
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["swipe_action"]
          created_at?: string
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "swipes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      external_applications: {
        Row: {
          id: string
          job_id: string
          full_name: string
          email: string
          phone: string
          cover_letter: string | null
          cv_path: string
          cv_filename: string
          status: string
          starred: boolean | null
          recruiter_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          full_name: string
          email: string
          phone: string
          cover_letter?: string | null
          cv_path: string
          cv_filename: string
          status?: string
          starred?: boolean | null
          recruiter_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          full_name?: string
          email?: string
          phone?: string
          cover_letter?: string | null
          cv_path?: string
          cv_filename?: string
          status?: string
          starred?: boolean | null
          recruiter_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          }
        ]
      }
      pre_screening_questions: {
        Row: {
          id: string
          job_id: string
          question_text: string
          question_type: string
          options: string[] | null
          is_required: boolean | null
          is_disqualifying: boolean | null
          correct_answer: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          question_text: string
          question_type: string
          options?: string[] | null
          is_required?: boolean | null
          is_disqualifying?: boolean | null
          correct_answer?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          question_text?: string
          question_type?: string
          options?: string[] | null
          is_required?: boolean | null
          is_disqualifying?: boolean | null
          correct_answer?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_screening_questions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          }
        ]
      }
      pre_screening_answers: {
        Row: {
          id: string
          job_id: string
          application_id: string | null
          external_application_id: string | null
          question_id: string
          answer_text: string
          is_disqualified: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          application_id?: string | null
          external_application_id?: string | null
          question_id: string
          answer_text: string
          is_disqualified?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          application_id?: string | null
          external_application_id?: string | null
          question_id?: string
          answer_text?: string
          is_disqualified?: boolean | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pre_screening_answers_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_screening_answers_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_screening_answers_external_application_id_fkey"
            columns: ["external_application_id"]
            isOneToOne: false
            referencedRelation: "external_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_screening_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "pre_screening_questions"
            referencedColumns: ["id"]
          }
        ]
      }
      assessments: {
        Row: {
          id: string
          job_id: string
          name: string
          attempts_allowed: string
          is_live_timed: boolean
          deadline_days: number | null
          auto_send: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          job_id: string
          name: string
          attempts_allowed?: string
          is_live_timed?: boolean
          deadline_days?: number | null
          auto_send?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          job_id?: string
          name?: string
          attempts_allowed?: string
          is_live_timed?: boolean
          deadline_days?: number | null
          auto_send?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          }
        ]
      }
      assessment_questions: {
        Row: {
          id: string
          assessment_id: string
          question_text: string
          question_type: string
          order_index: number
          options: string[] | null
          correct_answers: string[] | null
          video_max_duration: number | null
          iq_difficulty: string | null
          iq_count: number | null
          iq_source: string | null
          time_limit_seconds: number | null
          created_at: string
        }
        Insert: {
          id?: string
          assessment_id: string
          question_text: string
          question_type: string
          order_index?: number
          options?: string[] | null
          correct_answers?: string[] | null
          video_max_duration?: number | null
          iq_difficulty?: string | null
          iq_count?: number | null
          iq_source?: string | null
          time_limit_seconds?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          assessment_id?: string
          question_text?: string
          question_type?: string
          order_index?: number
          options?: string[] | null
          correct_answers?: string[] | null
          video_max_duration?: number | null
          iq_difficulty?: string | null
          iq_count?: number | null
          iq_source?: string | null
          time_limit_seconds?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          }
        ]
      }
      assessment_responses: {
        Row: {
          id: string
          assessment_id: string
          application_id: string | null
          external_application_id: string | null
          attempt_number: number
          answers: Json
          score: number | null
          completed_at: string | null
          time_taken_seconds: number | null
          created_at: string
        }
        Insert: {
          id?: string
          assessment_id: string
          application_id?: string | null
          external_application_id?: string | null
          attempt_number?: number
          answers?: Json
          score?: number | null
          completed_at?: string | null
          time_taken_seconds?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          assessment_id?: string
          application_id?: string | null
          external_application_id?: string | null
          attempt_number?: number
          answers?: Json
          score?: number | null
          completed_at?: string | null
          time_taken_seconds?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_responses_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_responses_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_responses_external_application_id_fkey"
            columns: ["external_application_id"]
            isOneToOne: false
            referencedRelation: "external_applications"
            referencedColumns: ["id"]
          }
        ]
      }
      iq_question_bank: {
        Row: {
          id: string
          category: string
          question_text: string
          options: string[]
          correct_option_index: number
          time_limit_seconds: number
          difficulty: string
          created_at: string
        }
        Insert: {
          id?: string
          category: string
          question_text: string
          options: string[]
          correct_option_index: number
          time_limit_seconds?: number
          difficulty: string
          created_at?: string
        }
        Update: {
          id?: string
          category?: string
          question_text?: string
          options?: string[]
          correct_option_index?: number
          time_limit_seconds?: number
          difficulty?: string
          created_at?: string
        }
        Relationships: []
      }
      video_notes: {
        Row: {
          id: string
          response_id: string
          question_id: string
          timestamp: number
          note: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          response_id: string
          question_id: string
          timestamp: number
          note: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          response_id?: string
          question_id?: string
          timestamp?: number
          note?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_notes_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "assessment_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_notes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "assessment_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      assessment_tokens: {
        Row: {
          id: string
          assessment_id: string
          application_id: string | null
          external_application_id: string | null
          token: string
          attempt_number: number
          used_at: string | null
          expires_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          assessment_id: string
          application_id?: string | null
          external_application_id?: string | null
          token: string
          attempt_number?: number
          used_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          assessment_id?: string
          application_id?: string | null
          external_application_id?: string | null
          token?: string
          attempt_number?: number
          used_at?: string | null
          expires_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_tokens_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_tokens_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_tokens_external_application_id_fkey"
            columns: ["external_application_id"]
            isOneToOne: false
            referencedRelation: "external_applications"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "partner"
      application_status: "draft" | "submitted" | "reviewing" | "shortlisted" | "interview" | "hired" | "declined" | "assessment_sent" | "offer" | "rejected"
      swipe_action: "like" | "save" | "pass"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "partner"],
      application_status: ["draft", "submitted", "reviewing", "shortlisted", "interview", "hired", "declined", "assessment_sent", "offer", "rejected"],
      swipe_action: ["like", "save", "pass"],
    },
  },
} as const
