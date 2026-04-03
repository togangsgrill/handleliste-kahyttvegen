export type Database = {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          invite_code: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          invite_code: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          invite_code?: string;
          updated_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          household_id: string | null;
          display_name: string;
          auth_provider: string;
          is_upgraded: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          household_id?: string | null;
          display_name: string;
          auth_provider: string;
          is_upgraded?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          household_id?: string | null;
          display_name?: string;
          auth_provider?: string;
          is_upgraded?: boolean;
          deleted_at?: string | null;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          emoji: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          emoji: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          emoji?: string;
          updated_at?: string;
        };
      };
      store_locations: {
        Row: {
          id: string;
          chain: string;
          name: string;
          address: string | null;
          lat: number | null;
          lng: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          chain: string;
          name: string;
          address?: string | null;
          lat?: number | null;
          lng?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          chain?: string;
          name?: string;
          address?: string | null;
          lat?: number | null;
          lng?: number | null;
          updated_at?: string;
        };
      };
      shopping_lists: {
        Row: {
          id: string;
          household_id: string;
          created_by: string;
          name: string;
          visibility: 'shared' | 'private';
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by: string;
          name: string;
          visibility?: 'shared' | 'private';
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          visibility?: 'shared' | 'private';
          is_deleted?: boolean;
          updated_at?: string;
        };
      };
      list_items: {
        Row: {
          id: string;
          list_id: string;
          name: string;
          category_id: string | null;
          quantity: number;
          is_checked: boolean;
          checked_by: string | null;
          checked_at: string | null;
          added_by: string;
          note: string | null;
          image_url: string | null;
          barcode: string | null;
          recipe_id: string | null;
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          name: string;
          category_id?: string | null;
          quantity?: number;
          is_checked?: boolean;
          checked_by?: string | null;
          checked_at?: string | null;
          added_by: string;
          note?: string | null;
          image_url?: string | null;
          barcode?: string | null;
          recipe_id?: string | null;
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          category_id?: string | null;
          quantity?: number;
          is_checked?: boolean;
          checked_by?: string | null;
          checked_at?: string | null;
          note?: string | null;
          image_url?: string | null;
          barcode?: string | null;
          recipe_id?: string | null;
          is_deleted?: boolean;
          updated_at?: string;
        };
      };
      list_item_comments: {
        Row: {
          id: string;
          list_item_id: string;
          user_id: string;
          comment: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          list_item_id: string;
          user_id: string;
          comment: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          comment?: string;
          updated_at?: string;
        };
      };
      list_activity: {
        Row: {
          id: string;
          list_id: string;
          user_id: string;
          action: 'added' | 'checked' | 'unchecked' | 'removed' | 'edited';
          item_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          user_id: string;
          action: 'added' | 'checked' | 'unchecked' | 'removed' | 'edited';
          item_name: string;
          created_at?: string;
        };
        Update: never;
      };
      list_shares: {
        Row: {
          id: string;
          list_id: string;
          share_token: string;
          permission: 'view' | 'edit';
          expires_at: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          share_token: string;
          permission?: 'view' | 'edit';
          expires_at?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          permission?: 'view' | 'edit';
          expires_at?: string | null;
        };
      };
      user_category_order: {
        Row: {
          id: string;
          user_id: string;
          store_location_id: string;
          category_id: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          store_location_id: string;
          category_id: string;
          sort_order: number;
        };
        Update: {
          sort_order?: number;
        };
      };
    };
  };
};
