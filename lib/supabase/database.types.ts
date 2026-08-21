/**
 * Typage Supabase Pass'Teny — généré automatiquement par scripts/generate-db-types.mjs.
 * Ne pas modifier manuellement. Pour régénérer :
 *   node scripts/generate-db-types.mjs
 */

export type UserRole = 'contributor' | 'trusted' | 'moderator'
export type AnnotationStatus = 'pending' | 'approved' | 'merged' | 'rejected'

export interface Database {
  public: {
    Tables: {
      annotation_versions: {
        Row: {
          id: string
          annotation_id: string
          body: string
          author_id: string
          created_at: string
        }
        Insert: {
          id?: string | null
          annotation_id?: string | null
          body?: string | null
          author_id?: string | null
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['annotation_versions']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'annotation_versions_annotation_id_fkey'
            columns: ['annotation_id']
            isOneToOne: false
            referencedRelation: 'annotations'
            referencedColumns: ['id']
          }
        ]
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
          status: 'pending' | 'approved' | 'merged' | 'rejected'
          score: number
          pr_number: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          song_id?: string | null
          start_offset?: number | null
          end_offset?: number | null
          quote?: string | null
          body?: string | null
          tags?: string[] | null
          author_id?: string | null
          status?: 'pending' | 'approved' | 'merged' | 'rejected' | null
          score?: number | null
          pr_number?: number | null
          created_at?: string | null
          updated_at?: string | null
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
          }
        ]
      }
      community_articles: {
        Row: {
          id: string
          author_id: string
          title: string
          subtitle: string | null
          content: string
          cover_url: string | null
          category: string
          tags: string[]
          status: string
          read_time: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | null
          author_id?: string | null
          title?: string | null
          subtitle?: string | null
          content?: string | null
          cover_url?: string | null
          category?: string | null
          tags?: string[] | null
          status?: string | null
          read_time?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['community_articles']['Insert']>
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
          id?: string | null
          term?: string | null
          meaning?: string | null
          language?: string | null
          example?: string | null
          author_id?: string | null
          approved?: boolean | null
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['glossary_terms']['Insert']>
        Relationships: []
      }
      lyric_suggestions: {
        Row: {
          id: string
          author_id: string
          artist_name: string
          artist_slug: string
          track_title: string
          song_slug: string
          album_title: string | null
          cover_url: string | null
          passio_track_id: string | null
          passio_album_id: string | null
          lyrics_format: string
          lyrics: string
          status: string
          pr_number: number | null
          created_at: string
        }
        Insert: {
          id?: string | null
          author_id?: string | null
          artist_name?: string | null
          artist_slug?: string | null
          track_title?: string | null
          song_slug?: string | null
          album_title?: string | null
          cover_url?: string | null
          passio_track_id?: string | null
          passio_album_id?: string | null
          lyrics_format?: string | null
          lyrics?: string | null
          status?: string | null
          pr_number?: number | null
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['lyric_suggestions']['Insert']>
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          github_handle: string | null
          role: 'contributor' | 'trusted' | 'moderator'
          reputation: number
          created_at: string
          updated_at: string
          facebook_url: string | null
          instagram_url: string | null
          onboarding_done: boolean
        }
        Insert: {
          id?: string | null
          username?: string | null
          display_name?: string | null
          github_handle?: string | null
          role?: 'contributor' | 'trusted' | 'moderator' | null
          reputation?: number | null
          created_at?: string | null
          updated_at?: string | null
          facebook_url?: string | null
          instagram_url?: string | null
          onboarding_done?: boolean | null
        }
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
        Relationships: []
      }
      punchline_votes: {
        Row: {
          punchline_id: string
          voter_id: string
          value: number
          created_at: string
        }
        Insert: {
          punchline_id?: string | null
          voter_id?: string | null
          value?: number | null
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['punchline_votes']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'punchline_votes_punchline_id_fkey'
            columns: ['punchline_id']
            isOneToOne: false
            referencedRelation: 'punchlines'
            referencedColumns: ['id']
          }
        ]
      }
      punchlines: {
        Row: {
          id: string
          song_id: string
          quote: string
          context: string | null
          author_id: string
          score: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string | null
          song_id?: string | null
          quote?: string | null
          context?: string | null
          author_id?: string | null
          score?: number | null
          status?: string | null
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['punchlines']['Insert']>
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          value: Record<string, unknown>
          updated_at: string
        }
        Insert: {
          key?: string | null
          value?: Record<string, unknown> | null
          updated_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['settings']['Insert']>
        Relationships: []
      }
      song_views: {
        Row: {
          song_id: string
          view_date: string
          count: number
        }
        Insert: {
          song_id?: string | null
          view_date?: string | null
          count?: number | null
        }
        Update: Partial<Database['public']['Tables']['song_views']['Insert']>
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
          id?: string | null
          artist_slug?: string | null
          artist_name?: string | null
          title?: string | null
          album?: string | null
          language?: string[] | null
          lyrics_txt?: string | null
          search?: string | null
          content_sha?: string | null
          updated_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['songs']['Insert']>
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
          annotation_id?: string | null
          voter_id?: string | null
          value?: number | null
          created_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['votes']['Insert']>
        Relationships: [
          {
            foreignKeyName: 'votes_annotation_id_fkey'
            columns: ['annotation_id']
            isOneToOne: false
            referencedRelation: 'annotations'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      increment_song_view: {
        Args: { p_song_id: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
