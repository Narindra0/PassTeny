/**
 * Typage Supabase Pass'Teny — reflète `schema.sql`.
 * Utilisé par tous les clients (browser, session, admin) pour un typage
 * complet des requêtes.
 */

export type UserRole = 'contributor' | 'trusted' | 'moderator'
export type AnnotationStatus = 'pending' | 'approved' | 'merged' | 'rejected'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          github_handle: string | null
          role: UserRole
          reputation: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          github_handle?: string | null
          role?: UserRole
          reputation?: number
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
        Relationships: []
      }
      songs: {
        Row: {
          id: string
          artist_slug: string
          artist_name: string
          title: string
          album: string | null
          language: string[]
          lyrics_txt: string
          search: string | null
          content_sha: string | null
          updated_at: string
        }
        Insert: {
          id: string
          artist_slug: string
          artist_name: string
          title: string
          album?: string | null
          language?: string[]
          lyrics_txt: string
          content_sha?: string | null
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['songs']['Insert']>
        Relationships: []
      }
      annotations: {
        Row: {
          id: string
          song_id: string
          start_offset: number
          end_offset: number
          quote: string
          body: string
          tags: string[]
          author_id: string
          status: AnnotationStatus
          score: number
          pr_number: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          song_id: string
          start_offset: number
          end_offset: number
          quote: string
          body: string
          tags?: string[]
          author_id: string
          status?: AnnotationStatus
          score?: number
          pr_number?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['annotations']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'annotations_song_id_fkey'
            columns: ['song_id']
            isOneToOne: false
            referencedRelation: 'songs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'annotations_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      annotation_versions: {
        Row: {
          id: string
          annotation_id: string
          body: string
          author_id: string
          created_at: string
        }
        Insert: {
          id?: string
          annotation_id: string
          body: string
          author_id: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['annotation_versions']['Insert']>
        Relationships: []
      }
      votes: {
        Row: {
          annotation_id: string
          voter_id: string
          value: number
          created_at: string
        }
        Insert: {
          annotation_id: string
          voter_id: string
          value: number
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['votes']['Insert']>
        Relationships: []
      }
      glossary_terms: {
        Row: {
          id: string
          term: string
          meaning: string
          language: string
          example: string | null
          author_id: string | null
          approved: boolean
          created_at: string
        }
        Insert: {
          id?: string
          term: string
          meaning: string
          language?: string
          example?: string | null
          author_id?: string | null
          approved?: boolean
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['glossary_terms']['Insert']>
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          value: Record<string, unknown>
          updated_at: string
        }
        Insert: {
          key: string
          value: Record<string, unknown>
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['settings']['Insert']>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
