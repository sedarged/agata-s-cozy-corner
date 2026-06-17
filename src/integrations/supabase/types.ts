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
      app_config: {
        Row: {
          created_at: string
          id: number
          owner_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          owner_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          owner_user_id?: string | null
        }
        Relationships: []
      }
      books: {
        Row: {
          author: string | null
          category: string | null
          cover_url: string | null
          created_at: string
          current_page: number
          description: string | null
          external_id: string | null
          id: string
          is_favourite: boolean
          isbn: string | null
          page_count: number | null
          published_date: string | null
          rating: number | null
          source: string
          status: Database["public"]["Enums"]["book_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          cover_url?: string | null
          created_at?: string
          current_page?: number
          description?: string | null
          external_id?: string | null
          id?: string
          is_favourite?: boolean
          isbn?: string | null
          page_count?: number | null
          published_date?: string | null
          rating?: number | null
          source?: string
          status?: Database["public"]["Enums"]["book_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author?: string | null
          category?: string | null
          cover_url?: string | null
          created_at?: string
          current_page?: number
          description?: string | null
          external_id?: string | null
          id?: string
          is_favourite?: boolean
          isbn?: string | null
          page_count?: number | null
          published_date?: string | null
          rating?: number | null
          source?: string
          status?: Database["public"]["Enums"]["book_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gigi_conversations: {
        Row: {
          context_book_id: string | null
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context_book_id?: string | null
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context_book_id?: string | null
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gigi_conversations_context_book_id_fkey"
            columns: ["context_book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      gigi_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gigi_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "gigi_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      note_tags: {
        Row: {
          note_id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          note_id: string
          tag_id: string
          user_id: string
        }
        Update: {
          note_id?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_tags_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          book_id: string | null
          chapter_number: number | null
          chapter_title: string | null
          comment: string | null
          content: string | null
          created_at: string
          id: string
          image_path: string | null
          is_favourite: boolean
          page_number: number | null
          quote_text: string | null
          title: string | null
          type: Database["public"]["Enums"]["note_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id?: string | null
          chapter_number?: number | null
          chapter_title?: string | null
          comment?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          is_favourite?: boolean
          page_number?: number | null
          quote_text?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["note_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string | null
          chapter_number?: number | null
          chapter_title?: string | null
          comment?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          is_favourite?: boolean
          page_number?: number | null
          quote_text?: string | null
          title?: string | null
          type?: Database["public"]["Enums"]["note_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          book_id: string
          created_at: string
          emotional_impact: number | null
          id: string
          overall: number | null
          summary: string | null
          updated_at: string
          usefulness: number | null
          user_id: string
          would_read_again: boolean | null
          writing_style: number | null
        }
        Insert: {
          book_id: string
          created_at?: string
          emotional_impact?: number | null
          id?: string
          overall?: number | null
          summary?: string | null
          updated_at?: string
          usefulness?: number | null
          user_id: string
          would_read_again?: boolean | null
          writing_style?: number | null
        }
        Update: {
          book_id?: string
          created_at?: string
          emotional_impact?: number | null
          id?: string
          overall?: number | null
          summary?: string | null
          updated_at?: string
          usefulness?: number | null
          user_id?: string
          would_read_again?: boolean | null
          writing_style?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: true
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_sessions: {
        Row: {
          book_id: string
          created_at: string
          duration_minutes: number | null
          end_page: number | null
          ended_at: string | null
          id: string
          pages_read: number | null
          start_page: number | null
          started_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          duration_minutes?: number | null
          end_page?: number | null
          ended_at?: string | null
          id?: string
          pages_read?: number | null
          start_page?: number | null
          started_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          duration_minutes?: number | null
          end_page?: number | null
          ended_at?: string | null
          id?: string
          pages_read?: number | null
          start_page?: number | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_sessions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          density: string | null
          font: string | null
          gigi_privacy: Database["public"]["Enums"]["gigi_privacy"]
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          density?: string | null
          font?: string | null
          gigi_privacy?: Database["public"]["Enums"]["gigi_privacy"]
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          density?: string | null
          font?: string | null
          gigi_privacy?: Database["public"]["Enums"]["gigi_privacy"]
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_ownership: { Args: never; Returns: boolean }
    }
    Enums: {
      book_status: "queue" | "reading" | "paused" | "dropped" | "finished"
      gigi_privacy:
        | "off"
        | "current_book"
        | "notes_only"
        | "full"
        | "full_plus_chats"
      note_type: "quote" | "text" | "photo" | "chapter" | "other" | "summary"
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
      book_status: ["queue", "reading", "paused", "dropped", "finished"],
      gigi_privacy: [
        "off",
        "current_book",
        "notes_only",
        "full",
        "full_plus_chats",
      ],
      note_type: ["quote", "text", "photo", "chapter", "other", "summary"],
    },
  },
} as const
