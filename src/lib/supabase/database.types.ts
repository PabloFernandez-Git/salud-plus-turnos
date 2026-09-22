export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      appointments: {
        Row: {
          administrative_note: string | null;
          center_id: string;
          created_at: string;
          ends_at: string;
          id: string;
          patient_center_id: string;
          professional_center_id: string;
          specialty_id: string;
          starts_at: string;
          status: Database["public"]["Enums"]["appointment_status"];
          updated_at: string;
        };
        Insert: {
          administrative_note?: string | null;
          center_id: string;
          created_at?: string;
          ends_at: string;
          id?: string;
          patient_center_id: string;
          professional_center_id: string;
          specialty_id: string;
          starts_at: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Update: {
          administrative_note?: string | null;
          center_id?: string;
          created_at?: string;
          ends_at?: string;
          id?: string;
          patient_center_id?: string;
          professional_center_id?: string;
          specialty_id?: string;
          starts_at?: string;
          status?: Database["public"]["Enums"]["appointment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_patient_center_fk";
            columns: ["patient_center_id", "center_id"];
            isOneToOne: false;
            referencedRelation: "patient_centers";
            referencedColumns: ["id", "center_id"];
          },
          {
            foreignKeyName: "appointments_professional_center_fk";
            columns: ["professional_center_id", "center_id"];
            isOneToOne: false;
            referencedRelation: "professional_centers";
            referencedColumns: ["id", "center_id"];
          },
          {
            foreignKeyName: "appointments_professional_center_specialty_fk";
            columns: ["professional_center_id", "specialty_id"];
            isOneToOne: false;
            referencedRelation: "professional_center_specialties";
            referencedColumns: ["professional_center_id", "specialty_id"];
          },
        ];
      };
      availabilities: {
        Row: {
          center_id: string;
          created_at: string;
          end_time: string;
          id: string;
          is_active: boolean;
          professional_center_id: string;
          start_time: string;
          updated_at: string;
          weekday: number;
        };
        Insert: {
          center_id: string;
          created_at?: string;
          end_time: string;
          id?: string;
          is_active?: boolean;
          professional_center_id: string;
          start_time: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          center_id?: string;
          created_at?: string;
          end_time?: string;
          id?: string;
          is_active?: boolean;
          professional_center_id?: string;
          start_time?: string;
          updated_at?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "availabilities_professional_center_fk";
            columns: ["professional_center_id", "center_id"];
            isOneToOne: false;
            referencedRelation: "professional_centers";
            referencedColumns: ["id", "center_id"];
          },
        ];
      };
      center_memberships: {
        Row: {
          center_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          professional_center_id: string | null;
          role: Database["public"]["Enums"]["membership_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          center_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          professional_center_id?: string | null;
          role: Database["public"]["Enums"]["membership_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          center_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          professional_center_id?: string | null;
          role?: Database["public"]["Enums"]["membership_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "center_memberships_center_fk";
            columns: ["center_id"];
            isOneToOne: false;
            referencedRelation: "centers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "center_memberships_professional_center_fk";
            columns: ["professional_center_id", "center_id"];
            isOneToOne: false;
            referencedRelation: "professional_centers";
            referencedColumns: ["id", "center_id"];
          },
          {
            foreignKeyName: "center_memberships_user_fk";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      centers: {
        Row: {
          address: string | null;
          created_at: string;
          email: string | null;
          id: string;
          is_active: boolean;
          logo_path: string | null;
          name: string;
          phone: string | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          logo_path?: string | null;
          name: string;
          phone?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          logo_path?: string | null;
          name?: string;
          phone?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      patient_centers: {
        Row: {
          administrative_notes: string | null;
          center_id: string;
          created_at: string;
          email: string | null;
          id: string;
          insurance_name: string | null;
          is_active: boolean;
          person_id: string;
          phone: string;
          updated_at: string;
        };
        Insert: {
          administrative_notes?: string | null;
          center_id: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          insurance_name?: string | null;
          is_active?: boolean;
          person_id: string;
          phone: string;
          updated_at?: string;
        };
        Update: {
          administrative_notes?: string | null;
          center_id?: string;
          created_at?: string;
          email?: string | null;
          id?: string;
          insurance_name?: string | null;
          is_active?: boolean;
          person_id?: string;
          phone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "patient_centers_center_fk";
            columns: ["center_id"];
            isOneToOne: false;
            referencedRelation: "centers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_centers_person_fk";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "persons";
            referencedColumns: ["id"];
          },
        ];
      };
      persons: {
        Row: {
          birth_date: string;
          created_at: string;
          document_number: string;
          first_name: string;
          id: string;
          last_name: string;
          nationality_code: string;
          normalized_document: string;
          updated_at: string;
        };
        Insert: {
          birth_date: string;
          created_at?: string;
          document_number: string;
          first_name: string;
          id?: string;
          last_name: string;
          nationality_code: string;
          normalized_document?: string;
          updated_at?: string;
        };
        Update: {
          birth_date?: string;
          created_at?: string;
          document_number?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          nationality_code?: string;
          normalized_document?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      professional_center_specialties: {
        Row: {
          center_id: string;
          created_at: string;
          is_active: boolean;
          professional_center_id: string;
          specialty_id: string;
          updated_at: string;
        };
        Insert: {
          center_id: string;
          created_at?: string;
          is_active?: boolean;
          professional_center_id: string;
          specialty_id: string;
          updated_at?: string;
        };
        Update: {
          center_id?: string;
          created_at?: string;
          is_active?: boolean;
          professional_center_id?: string;
          specialty_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "professional_center_specialties_professional_center_fk";
            columns: ["professional_center_id", "center_id"];
            isOneToOne: false;
            referencedRelation: "professional_centers";
            referencedColumns: ["id", "center_id"];
          },
          {
            foreignKeyName: "professional_center_specialties_specialty_fk";
            columns: ["specialty_id", "center_id"];
            isOneToOne: false;
            referencedRelation: "specialties";
            referencedColumns: ["id", "center_id"];
          },
        ];
      };
      professional_centers: {
        Row: {
          center_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          license_number: string | null;
          professional_id: string;
          updated_at: string;
          usual_appointment_duration_minutes: number;
        };
        Insert: {
          center_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          license_number?: string | null;
          professional_id: string;
          updated_at?: string;
          usual_appointment_duration_minutes?: number;
        };
        Update: {
          center_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          license_number?: string | null;
          professional_id?: string;
          updated_at?: string;
          usual_appointment_duration_minutes?: number;
        };
        Relationships: [
          {
            foreignKeyName: "professional_centers_center_fk";
            columns: ["center_id"];
            isOneToOne: false;
            referencedRelation: "centers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "professional_centers_professional_fk";
            columns: ["professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id"];
          },
        ];
      };
      professionals: {
        Row: {
          created_at: string;
          document_number: string;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
          nationality_code: string;
          normalized_document: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          document_number: string;
          email: string;
          first_name: string;
          id?: string;
          last_name: string;
          nationality_code: string;
          normalized_document?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          document_number?: string;
          email?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          nationality_code?: string;
          normalized_document?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      specialties: {
        Row: {
          center_id: string;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          updated_at: string;
        };
        Insert: {
          center_id: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          updated_at?: string;
        };
        Update: {
          center_id?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "specialties_center_fk";
            columns: ["center_id"];
            isOneToOne: false;
            referencedRelation: "centers";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          first_name: string;
          id: string;
          last_name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          first_name: string;
          id: string;
          last_name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      appointment_status: "PENDING" | "CONFIRMED" | "ATTENDED" | "CANCELLED" | "NO_SHOW";
      membership_role: "ADMIN" | "RECEPTION" | "PROFESSIONAL";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      appointment_status: ["PENDING", "CONFIRMED", "ATTENDED", "CANCELLED", "NO_SHOW"],
      membership_role: ["ADMIN", "RECEPTION", "PROFESSIONAL"],
    },
  },
} as const;
