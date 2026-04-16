export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Role = 'admin' | 'editor' | 'viewer';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          age: number | null;
          date_of_birth: string | null;
          phone: string | null;
          avatar_url: string | null;
          role: Role;
          approval_status: 'pending' | 'approved' | 'rejected';
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      jerseys: {
        Row: {
          id: string;
          player_name: string;
          jersey_number: string;
          size: string;
          paid: boolean;
          notes: string | null;
          created_at: string;
          submitted_by_id: string | null;
        };
        Insert: Omit<Database['public']['Tables']['jerseys']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['jerseys']['Insert']>;
      };
      contributions: {
        Row: {
          id: string;
          player_name: string;
          amount: number;
          paid: boolean;
          date: string;
          notes: string | null;
          submitted_by_id: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['contributions']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['contributions']['Insert']>;
      };
      expenses: {
        Row: {
          id: string;
          category: string;
          item: string;
          cost: number;
          bought?: boolean;
          submitted_by_id?: string | null;
          submitted_by_name?: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>;
      };
      matches: {
        Row: {
          id: string;
          date: string;
          time: string;
          opponent: string;
          ground: string;
          weather: Json | null;
          advisory: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['matches']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
          weather?: Json | null;
        };
        Update: Partial<Database['public']['Tables']['matches']['Insert']>;
      };
      match_media: {
        Row: {
          id: string;
          match_id: string | null;
          type: 'photo' | 'video' | 'highlight';
          url: string;
          title: string | null;
          album: 'main' | 'others';
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['match_media']['Row'], 'id' | 'created_at' | 'album' | 'match_id'> & {
          id?: string;
          created_at?: string;
          album?: 'main' | 'others';
          match_id?: string | null;
        };
        Update: Partial<Database['public']['Tables']['match_media']['Insert']>;
      };
      players: {
        Row: {
          id: string;
          name: string;
          photo: string | null;
          jersey_number: number | null;
          role: string;
          profile_id: string | null;
          honors: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['players']['Row'],
          'id' | 'created_at' | 'updated_at' | 'honors'
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          honors?: string | null;
        };
        Update: Partial<Database['public']['Tables']['players']['Insert']>;
      };
      match_stats: {
        Row: {
          id: string;
          match_id: string;
          player_id: string;
          runs: number;
          balls: number;
          fours: number;
          sixes: number;
          overs: number;
          wickets: number;
          runs_conceded: number;
          catches: number;
          runouts: number;
          mvp: boolean;
          include_bat: boolean;
          include_bowl: boolean;
          include_field: boolean;
          maidens: number;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['match_stats']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['match_stats']['Insert']>;
      };
      team_chat_messages: {
        Row: {
          id: string;
          user_id: string;
          sender_name: string;
          body: string;
          is_alert: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          sender_name: string;
          body: string;
          is_alert?: boolean;
          created_at?: string;
        };
        Update: Partial<{
          body: string;
          is_alert: boolean;
        }>;
      };
      team_chat_poll_votes: {
        Row: {
          message_id: string;
          user_id: string;
          option_index: number;
        };
        Insert: {
          message_id: string;
          user_id: string;
          option_index: number;
        };
        Update: Partial<{
          message_id: string;
          user_id: string;
          option_index: number;
        }>;
      };
      team_chat_settings: {
        Row: {
          id: number;
          header_image_url: string | null;
          desired_collection: string | null;
          player_match_fee: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          header_image_url?: string | null;
          desired_collection?: string | null;
          player_match_fee?: string | null;
          updated_at?: string;
        };
        Update: Partial<{
          header_image_url: string | null;
          desired_collection?: string | null;
          player_match_fee?: string | null;
          updated_at: string;
        }>;
      };
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Jersey = Database['public']['Tables']['jerseys']['Row'];
export type Contribution = Database['public']['Tables']['contributions']['Row'];
export type Expense = Database['public']['Tables']['expenses']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type MatchMedia = Database['public']['Tables']['match_media']['Row'];
export type Player = Database['public']['Tables']['players']['Row'];
export type MatchStat = Database['public']['Tables']['match_stats']['Row'];
export type TeamChatMessage = Database['public']['Tables']['team_chat_messages']['Row'];
export type TeamChatMessageInsert = Database['public']['Tables']['team_chat_messages']['Insert'];
