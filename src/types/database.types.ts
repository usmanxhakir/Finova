/* eslint-disable @typescript-eslint/no-explicit-any */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          company_id: string | null
          created_at: string
          updated_at: string
          full_name: string | null
          role: 'admin' | 'accountant' | 'viewer' | 'procurement'
          avatar_url: string | null
          is_active: boolean
        }
        Insert: {
          id: string
          company_id?: string | null
          created_at?: string
          updated_at?: string
          full_name?: string | null
          role?: 'admin' | 'accountant' | 'viewer' | 'procurement'
          avatar_url?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          company_id?: string | null
          created_at?: string
          updated_at?: string
          full_name?: string | null
          role?: 'admin' | 'accountant' | 'viewer' | 'procurement'
          avatar_url?: string | null
          is_active?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fk"
            columns: ["company_id"]
            isOneToMany: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          }
        ]
      }
      companies: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          name: string
          plan: 'free' | 'pro' | 'studio' | 'po_only'
          owner_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          name: string
          plan?: 'free' | 'pro' | 'studio' | 'po_only'
          owner_id: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          name?: string
          plan?: 'free' | 'pro' | 'studio' | 'po_only'
          owner_id?: string
        }
        Relationships: []
      }
      [key: string]: {
        Row: any
        Insert: any
        Update: any
        Relationships: any[]
      }
    }
    Views: {
      [key: string]: {
        Row: any
      }
    }
    Functions: Record<string, any>
    Enums: Record<string, any>
  }
}
