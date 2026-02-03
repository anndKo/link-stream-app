export type AppRole = 'admin' | 'user';

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  user_id_code: string;
  registration_ip?: string | null;
  is_banned: boolean;
  ban_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  user_id_code: string;
  is_banned: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Post {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  visibility?: string;
  created_at: string;
  updated_at: string;
  profiles?: Profile | PublicProfile;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  reply_to_id?: string | null;
  sender_profile?: Profile;
  receiver_profile?: Profile;
  reply_to?: Message | null;
}

export interface DeletionDisableRequest {
  id: string;
  requester_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  message?: string | null;
  created_at: string;
  updated_at: string;
  requester_profile?: Profile;
}

export interface MessageDeletionSetting {
  id: string;
  user1_id: string;
  user2_id: string;
  is_disabled: boolean;
  requested_by?: string | null;
  requested_at?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
  requester_profile?: Profile;
  addressee_profile?: Profile;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  description: string | null;
  evidence_url: string | null;
  status: 'pending' | 'reviewed' | 'resolved';
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  reporter_profile?: Profile;
  reported_profile?: Profile;
}

export interface BannedIP {
  id: string;
  ip_address: string;
  banned_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface AdminLog {
  id: string;
  admin_id: string | null;
  action: string;
  target_user_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant: Profile;
  lastMessage: Message | null;
  unreadCount: number;
}

export interface PostReport {
  id: string;
  reporter_id: string;
  post_id: string;
  post_type: 'post' | 'transaction_post';
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
  updated_at: string;
  reporter_profile?: Profile;
  post?: Post;
}

export interface TransactionPost {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  profiles?: Profile | PublicProfile;
}

// Status values: 'pending', 'buyer_paid', 'admin_confirmed', 'seller_completed', 'completed', 'cancelled', 'refund_requested', 'refunded', 'rejected'
export type PaymentBoxStatus = 'pending' | 'buyer_paid' | 'admin_confirmed' | 'seller_completed' | 'completed' | 'cancelled' | 'refund_requested' | 'refunded' | 'rejected';

export interface PaymentBox {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: PaymentBoxStatus;
  created_at: string;
  confirmed_at: string | null;
  image_url: string | null;
  content: string | null;
  payment_duration: string | null;
  payment_duration_days: number | null;
  admin_confirmed_at: string | null;
  seller_cancelled_at: string | null;
  refund_requested_at: string | null;
  refund_approved_at: string | null;
  transaction_fee: string | null;
  has_fee: boolean;
  transaction_start_at?: string | null;
  seller_completed_at?: string | null;
  buyer_confirmed_at?: string | null;
  buyer_bank_account?: string | null;
  buyer_bank_name?: string | null;
  refund_reason?: string | null;
  seller_bank_account?: string | null;
  seller_bank_name?: string | null;
  seller_confirmed_at?: string | null;
  bill_image_url?: string | null;
  sender_role?: 'buyer' | 'seller';
  sender_profile?: Profile;
  receiver_profile?: Profile;
}

export interface AdminPaymentBoxSettings {
  id: string;
  image_url: string | null;
  content: string | null;
  transaction_fee: string | null;
  has_fee: boolean;
  created_at: string;
  updated_at: string;
}
