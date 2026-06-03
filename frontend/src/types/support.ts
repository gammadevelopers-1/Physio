// ─── Support Dashboard Types ──────────────────────────────────

export type TicketStatus =
  | 'new'
  | 'in_progress'
  | 'on_hold'
  | 'resolved'
  | 'closed';

export type TicketPriority = 'high' | 'medium' | 'low';

export type TicketCategory =
  | 'billing'
  | 'login'
  | 'content'
  | 'certificate'
  | 'technical'
  | 'other';

export type SupportSubRole = 'supervisor' | 'agent';

export interface SupportTicket {
  id: string;
  studentId: string;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description?: string;
  attachmentUrl?: string | null;
  courseId?: string | null;
  status: TicketStatus;
  assigneeId?: string | null;
  satisfactionRating?: number | null;
  firstResponseAt?: string | null;
  slaBreachedFrt: boolean;
  slaBreachedTtr: boolean;
  onHoldReason?: string | null;
  onHoldAt?: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  // Joined fields from list endpoint
  studentFirstName?: string | null;
  studentLastName?: string | null;
  studentEmail?: string | null;
  // Joined fields from detail endpoint
  assigneeName?: string | null;
  courseName?: string | null;
}

export interface TicketComment {
  id: string;
  message: string;
  isStaffReply: boolean;
  isInternal: boolean;
  createdAt: string;
  userId: string;
  userFirstName?: string | null;
  userLastName?: string | null;
}

export interface TicketDetailResponse extends SupportTicket {
  comments: TicketComment[];
  slaPolicy?: SlaPolicy | null;
}

export interface TicketListResponse {
  tickets: SupportTicket[];
  total: number;
  page: number;
  limit: number;
}

export interface SlaPolicy {
  id: string;
  priority: TicketPriority;
  frtMinutes: number;
  ttrMinutes: number;
  escalateAfterMinutes: number;
  escalateToRole?: string | null;
  active: boolean;
}

export interface SupportKPIs {
  openTickets: number;
  highPriorityOpen: number;
  slaBreaches: number;
  avgFrtMinutes: number | null;
  avgTtrMinutes: number | null;
  statusBreakdown: Record<string, number>;
}

export interface SupportAgent {
  userId: string;
  supportSubRole: SupportSubRole | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export interface CreateTicketPayload {
  category: TicketCategory;
  priority?: TicketPriority;
  subject: string;
  description: string;
  courseId?: string;
  attachmentUrl?: string;
}

export interface UpdateTicketPayload {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: string;
  onHoldReason?: string;
}

export interface AddCommentPayload {
  message: string;
  isInternal?: boolean;
}

export interface ListTicketsParams {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  assigneeId?: string;
  search?: string;
  page?: number;
  limit?: number;
}
