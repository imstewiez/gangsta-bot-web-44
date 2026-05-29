export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          discord_id: string | null
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          discord_id?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          discord_id?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
      members: {
        Row: {
          id: number
          discord_id: string | null
          username: string | null
          display_name: string | null
          full_name: string | null
          nickname: string | null
          role: string | null
          tier: string | null
          status: string | null
          lifecycle_state: string | null
          joined_at: string | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          discord_id?: string | null
          username?: string | null
          display_name?: string | null
          full_name?: string | null
          nickname?: string | null
          role?: string | null
          tier?: string | null
          status?: string | null
          lifecycle_state?: string | null
          joined_at?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          discord_id?: string | null
          username?: string | null
          display_name?: string | null
          full_name?: string | null
          nickname?: string | null
          role?: string | null
          tier?: string | null
          status?: string | null
          lifecycle_state?: string | null
          joined_at?: string | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      items: {
        Row: {
          id: number
          name: string
          category: string | null
          subcategory: string | null
          side: string | null
          purchase_price: number | null
          morador_purchase_price: number | null
          min_sale_price: number | null
          estimated_value: number | null
          xp_points: number | null
          active: boolean | null
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name: string
          category?: string | null
          subcategory?: string | null
          side?: string | null
          purchase_price?: number | null
          morador_purchase_price?: number | null
          min_sale_price?: number | null
          estimated_value?: number | null
          xp_points?: number | null
          active?: boolean | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string
          category?: string | null
          subcategory?: string | null
          side?: string | null
          purchase_price?: number | null
          morador_purchase_price?: number | null
          min_sale_price?: number | null
          estimated_value?: number | null
          xp_points?: number | null
          active?: boolean | null
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          id: number
          member_id: number | null
          item_id: number | null
          quantity: number
          status: string
          unit_price: number | null
          total_price: number | null
          notes: string | null
          markup_percent: number | null
          created_at: string
          updated_at: string
          updated_by: string | null
          delivered_at: string | null
          resolved_at: string | null
          approved_by: string | null
          fulfilled_by: string | null
          responsavel_member_id: number | null
          ingredients_json: Json | null
          batch_id: string | null
          dirty_money: number | null
          payment_mode: string | null
          material_cost: number | null
          money_cost: number | null
        }
        Insert: {
          id?: number
          member_id?: number | null
          item_id?: number | null
          quantity?: number
          status?: string
          unit_price?: number | null
          total_price?: number | null
          notes?: string | null
          markup_percent?: number | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          delivered_at?: string | null
          resolved_at?: string | null
          approved_by?: string | null
          fulfilled_by?: string | null
          responsavel_member_id?: number | null
          ingredients_json?: Json | null
          batch_id?: string | null
          dirty_money?: number | null
          payment_mode?: string | null
          material_cost?: number | null
          money_cost?: number | null
        }
        Update: {
          id?: number
          member_id?: number | null
          item_id?: number | null
          quantity?: number
          status?: string
          unit_price?: number | null
          total_price?: number | null
          notes?: string | null
          markup_percent?: number | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          delivered_at?: string | null
          resolved_at?: string | null
          approved_by?: string | null
          fulfilled_by?: string | null
          responsavel_member_id?: number | null
          ingredients_json?: Json | null
          batch_id?: string | null
          dirty_money?: number | null
          payment_mode?: string | null
          material_cost?: number | null
          money_cost?: number | null
        }
        Relationships: []
      }
      order_comments: {
        Row: {
          id: number
          order_id: number
          author_id: number | null
          author_name: string | null
          content: string
          created_at: string
        }
        Insert: {
          id?: number
          order_id: number
          author_id?: number | null
          author_name?: string | null
          content: string
          created_at?: string
        }
        Update: {
          id?: number
          order_id?: number
          author_id?: number | null
          author_name?: string | null
          content?: string
          created_at?: string
        }
        Relationships: []
      }
      operations: {
        Row: {
          id: number
          operation_type: string | null
          spot: string | null
          leader_id: number | null
          status: string
          date: string | null
          scheduled_time: string | null
          start_time: string | null
          end_time: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
          enemy_name: string | null
          enemy_faction: string | null
          enemy_count: number | null
          our_kills: number | null
          deaths: number | null
          survivors: number | null
          had_fight: boolean | null
          was_profitable: boolean | null
          result_notes: string | null
          supplied_value: number | null
          returned_value: number | null
          lost_value: number | null
          consumed_value: number | null
          gross_value: number | null
          net_value: number | null
          result: string | null
          liquidation_started_at: string | null
        }
        Insert: {
          id?: number
          operation_type?: string | null
          spot?: string | null
          leader_id?: number | null
          status?: string
          date?: string | null
          scheduled_time?: string | null
          start_time?: string | null
          end_time?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          enemy_name?: string | null
          enemy_faction?: string | null
          enemy_count?: number | null
          our_kills?: number | null
          deaths?: number | null
          survivors?: number | null
          had_fight?: boolean | null
          was_profitable?: boolean | null
          result_notes?: string | null
          supplied_value?: number | null
          returned_value?: number | null
          lost_value?: number | null
          consumed_value?: number | null
          gross_value?: number | null
          net_value?: number | null
          result?: string | null
          liquidation_started_at?: string | null
        }
        Update: {
          id?: number
          operation_type?: string | null
          spot?: string | null
          leader_id?: number | null
          status?: string
          date?: string | null
          scheduled_time?: string | null
          start_time?: string | null
          end_time?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
          enemy_name?: string | null
          enemy_faction?: string | null
          enemy_count?: number | null
          our_kills?: number | null
          deaths?: number | null
          survivors?: number | null
          had_fight?: boolean | null
          was_profitable?: boolean | null
          result_notes?: string | null
          supplied_value?: number | null
          returned_value?: number | null
          lost_value?: number | null
          consumed_value?: number | null
          gross_value?: number | null
          net_value?: number | null
          result?: string | null
          liquidation_started_at?: string | null
        }
        Relationships: []
      }
      operation_participants: {
        Row: {
          id: number
          operation_id: number
          member_id: number
          role_in_op: string | null
          participant_type: string | null
          kills: number | null
          deaths_count: number | null
          survived: boolean | null
          died: boolean | null
          issued_value: number | null
          returned_value: number | null
          lost_value: number | null
          consumed_value: number | null
          net_material_delta: number | null
          settled: boolean | null
          discipline_score: number | null
        }
        Insert: {
          id?: number
          operation_id: number
          member_id: number
          role_in_op?: string | null
          participant_type?: string | null
          kills?: number | null
          deaths_count?: number | null
          survived?: boolean | null
          died?: boolean | null
          issued_value?: number | null
          returned_value?: number | null
          lost_value?: number | null
          consumed_value?: number | null
          net_material_delta?: number | null
          settled?: boolean | null
          discipline_score?: number | null
        }
        Update: {
          id?: number
          operation_id?: number
          member_id?: number
          role_in_op?: string | null
          participant_type?: string | null
          kills?: number | null
          deaths_count?: number | null
          survived?: boolean | null
          died?: boolean | null
          issued_value?: number | null
          returned_value?: number | null
          lost_value?: number | null
          consumed_value?: number | null
          net_material_delta?: number | null
          settled?: boolean | null
          discipline_score?: number | null
        }
        Relationships: []
      }
      operation_materials: {
        Row: {
          id: number
          operation_id: number
          item_id: number | null
          member_id: number | null
          direction: string
          quantity: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: number
          operation_id: number
          item_id?: number | null
          member_id?: number | null
          direction: string
          quantity: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          operation_id?: number
          item_id?: number | null
          member_id?: number | null
          direction?: string
          quantity?: number
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          id: number
          movement_type: string
          item_id: number
          quantity: number
          member_id: number | null
          location: string | null
          notes: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: number
          movement_type: string
          item_id: number
          quantity: number
          member_id?: number | null
          location?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          movement_type?: string
          item_id?: number
          quantity?: number
          member_id?: number | null
          location?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      inventory_balance: {
        Row: {
          item_id: number
          balance: number | null
          updated_at: string
        }
        Insert: {
          item_id: number
          balance?: number | null
          updated_at?: string
        }
        Update: {
          item_id?: number
          balance?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_delivery_requests: {
        Row: {
          id: string
          requester_member_id: number
          requester_discord_id: string | null
          status: string
          tipo: string
          lines: Json
          notes: string | null
          total_qty: number
          total_value: number | null
          created_by: string | null
          created_at: string
          updated_at: string
          decided_at: string | null
          decision_by: string | null
          decision_reason: string | null
          responsavel_member_id: number | null
          approver_discord_id: string | null
        }
        Insert: {
          id?: string
          requester_member_id: number
          requester_discord_id?: string | null
          status?: string
          tipo?: string
          lines?: Json
          notes?: string | null
          total_qty?: number
          total_value?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          decided_at?: string | null
          decision_by?: string | null
          decision_reason?: string | null
          responsavel_member_id?: number | null
          approver_discord_id?: string | null
        }
        Update: {
          id?: string
          requester_member_id?: number
          requester_discord_id?: string | null
          status?: string
          tipo?: string
          lines?: Json
          notes?: string | null
          total_qty?: number
          total_value?: number | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
          decided_at?: string | null
          decision_by?: string | null
          decision_reason?: string | null
          responsavel_member_id?: number | null
          approver_discord_id?: string | null
        }
        Relationships: []
      }
      kill_logs: {
        Row: {
          id: number
          killer_id: number
          victim_name: string
          spot: string | null
          notes: string | null
          date: string
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: number
          killer_id: number
          victim_name: string
          spot?: string | null
          notes?: string | null
          date?: string
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          killer_id?: number
          victim_name?: string
          spot?: string | null
          notes?: string | null
          date?: string
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      weekly_rankings: {
        Row: {
          id: number
          member_id: number
          week_start: string
          week_end: string
          deliveries: number
          sales: number
          operations_count: number
          weighted_value: number
          return_rate: number
          rank_position: number
          kills_count: number
          wins_count: number
          loss_count: number
          net_profit_generated: number
          survival_rate: number
          performance_score: number
          hybrid_score: number
          normalized_score: number
          total_score: number
          material_points: number
          sales_points: number
          ops_points: number
          created_at: string
        }
        Insert: {
          id?: number
          member_id: number
          week_start: string
          week_end: string
          deliveries?: number
          sales?: number
          operations_count?: number
          weighted_value?: number
          return_rate?: number
          rank_position?: number
          kills_count?: number
          wins_count?: number
          loss_count?: number
          net_profit_generated?: number
          survival_rate?: number
          performance_score?: number
          hybrid_score?: number
          normalized_score?: number
          total_score?: number
          material_points?: number
          sales_points?: number
          ops_points?: number
          created_at?: string
        }
        Update: {
          id?: number
          member_id?: number
          week_start?: string
          week_end?: string
          deliveries?: number
          sales?: number
          operations_count?: number
          weighted_value?: number
          return_rate?: number
          rank_position?: number
          kills_count?: number
          wins_count?: number
          loss_count?: number
          net_profit_generated?: number
          survival_rate?: number
          performance_score?: number
          hybrid_score?: number
          normalized_score?: number
          total_score?: number
          material_points?: number
          sales_points?: number
          ops_points?: number
          created_at?: string
        }
        Relationships: []
      }
      weekly_prizes: {
        Row: {
          id: number
          week_start: string
          week_end: string
          winner_member_id: number
          hybrid_score: number | null
          prize_status: string
          prize_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          week_start: string
          week_end: string
          winner_member_id: number
          hybrid_score?: number | null
          prize_status?: string
          prize_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          week_start?: string
          week_end?: string
          winner_member_id?: number
          hybrid_score?: number | null
          prize_status?: string
          prize_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: number
          action: string
          entity_type: string | null
          entity_id: string | null
          actor_id: string | null
          actor_name: string | null
          context: string | null
          after_state: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          action: string
          entity_type?: string | null
          entity_id?: string | null
          actor_id?: string | null
          actor_name?: string | null
          context?: string | null
          after_state?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          action?: string
          entity_type?: string | null
          entity_id?: string | null
          actor_id?: string | null
          actor_name?: string | null
          context?: string | null
          after_state?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      all_time_stats: {
        Row: {
          id: number
          member_id: number
          kills_total: number
          deaths_total: number
          deliveries: number
          sales: number
          orders: number
          saidas_total: number
          updated_at: string
        }
        Insert: {
          id?: number
          member_id: number
          kills_total?: number
          deaths_total?: number
          deliveries?: number
          sales?: number
          orders?: number
          saidas_total?: number
          updated_at?: string
        }
        Update: {
          id?: number
          member_id?: number
          kills_total?: number
          deaths_total?: number
          deliveries?: number
          sales?: number
          orders?: number
          saidas_total?: number
          updated_at?: string
        }
        Relationships: []
      }
      pending_notifications: {
        Row: {
          id: number
          channel_id: string | null
          payload: Json
          priority: number
          attempts: number
          max_attempts: number
          next_retry_at: string
          created_at: string
          processed_at: string | null
          failed_at: string | null
          last_error: string | null
          retry_count: number
          dedup_key: string | null
        }
        Insert: {
          id?: number
          channel_id?: string | null
          payload?: Json
          priority?: number
          attempts?: number
          max_attempts?: number
          next_retry_at?: string
          created_at?: string
          processed_at?: string | null
          failed_at?: string | null
          last_error?: string | null
          retry_count?: number
          dedup_key?: string | null
        }
        Update: {
          id?: number
          channel_id?: string | null
          payload?: Json
          priority?: number
          attempts?: number
          max_attempts?: number
          next_retry_at?: string
          created_at?: string
          processed_at?: string | null
          failed_at?: string | null
          last_error?: string | null
          retry_count?: number
          dedup_key?: string | null
        }
        Relationships: []
      }
      sync_retries: {
        Row: {
          id: number
          retry_count: number
          max_retries: number
          last_error: string | null
          next_retry_at: string | null
          dead_lettered: boolean
          dead_lettered_at: string | null
          created_at: string
        }
        Insert: {
          id?: number
          retry_count?: number
          max_retries?: number
          last_error?: string | null
          next_retry_at?: string | null
          dead_lettered?: boolean
          dead_lettered_at?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          retry_count?: number
          max_retries?: number
          last_error?: string | null
          next_retry_at?: string | null
          dead_lettered?: boolean
          dead_lettered_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      job_runs: {
        Row: {
          id: number
          job_name: string | null
          started_at: string | null
          ended_at: string | null
          status: string | null
          error_message: string | null
          rows_affected: number | null
          created_at: string
        }
        Insert: {
          id?: number
          job_name?: string | null
          started_at?: string | null
          ended_at?: string | null
          status?: string | null
          error_message?: string | null
          rows_affected?: number | null
          created_at?: string
        }
        Update: {
          id?: number
          job_name?: string | null
          started_at?: string | null
          ended_at?: string | null
          status?: string | null
          error_message?: string | null
          rows_affected?: number | null
          created_at?: string
        }
        Relationships: []
      }
      tag_requests: {
        Row: {
          id: number
          discord_id: string | null
          username: string | null
          full_name: string | null
          nickname: string | null
          status: string
          created_at: string
          resolved_at: string | null
          deny_reason: string | null
          denial_reason: string | null
          approved_by: string | null
          denied_by: string | null
          processed_at: string | null
        }
        Insert: {
          id?: number
          discord_id?: string | null
          username?: string | null
          full_name?: string | null
          nickname?: string | null
          status?: string
          created_at?: string
          resolved_at?: string | null
          deny_reason?: string | null
          denial_reason?: string | null
          approved_by?: string | null
          denied_by?: string | null
          processed_at?: string | null
        }
        Update: {
          id?: number
          discord_id?: string | null
          username?: string | null
          full_name?: string | null
          nickname?: string | null
          status?: string
          created_at?: string
          resolved_at?: string | null
          deny_reason?: string | null
          denial_reason?: string | null
          approved_by?: string | null
          denied_by?: string | null
          processed_at?: string | null
        }
        Relationships: []
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
      sp_transition_order: {
        Args: {
          p_order_id: number
          p_new_status: string
          p_changed_by: string
          p_notes?: string
        }
        Returns: {
          old_status: string
          member_id: number
          item_id: number
          quantity: number
          item_name: string
          responsavel_member_id: number
        }[]
      }
      sp_cancel_orders: {
        Args: {
          p_order_ids: number[]
          p_changed_by: string
          p_reason?: string
        }
        Returns: number
      }
      sp_create_operation_with_participants: {
        Args: {
          p_operation_type: string
          p_spot: string
          p_leader_id: number
          p_scheduled_at: string
          p_notes: string
          p_created_by: string
          p_participants: number[]
        }
        Returns: number
      }
      sp_approve_tag_request: {
        Args: {
          p_request_id: number
          p_approved_by: string
        }
        Returns: number
      }
      sp_liquidate_saida: {
        Args: {
          p_operation_id: number
          p_actor_id: string
        }
        Returns: {
          supplied: number
          returned: number
          lost: number
          consumed: number
          gross: number
          net: number
          operation_type: string
          spot: string
        }[]
      }
      sp_adjust_stock: {
        Args: {
          p_item_id: number
          p_target_qty: number
          p_created_by: string
          p_notes?: string
        }
        Returns: number
      }
      sp_approve_delivery: {
        Args: {
          p_request_id: string
          p_approved_by: string
          p_approver_discord_id?: string
        }
        Returns: void
      }
    }
    Enums: {
      app_role: "admin" | "member"
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
      app_role: ["admin", "member"],
    },
  },
} as const
