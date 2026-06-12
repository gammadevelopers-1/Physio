"use client";

import { useState, useEffect, useCallback } from "react";
import { supportApi } from "@/lib/api";
import type {
  SupportTicket,
  TicketDetail,
} from "@/types/student-dashboard";

export function useMyTickets(params?: { status?: string; source?: string }) {
  const [data, setData] = useState<SupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await supportApi.getMyTickets({
        status: params?.status,
        source: params?.source,
      });
      setData(result.tickets);
      setTotal(result.total);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load tickets",
      );
    } finally {
      setLoading(false);
    }
  }, [params?.status, params?.source]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  return { data, total, loading, error, refetch: fetchTickets };
}

export function useTicketDetail(ticketId: string | null) {
  const [data, setData] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await supportApi.getTicket(ticketId);
      const mapped: TicketDetail = {
        id: result.id,
        category: result.category,
        priority: result.priority,
        subject: result.subject,
        description: result.description,
        attachmentUrl: result.attachmentUrl ?? null,
        status: result.status,
        satisfactionRating: result.satisfactionRating ?? null,
        courseTitle: result.courseName ?? null,
        courseTitleAr: null,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        resolvedAt: result.resolvedAt ?? null,
        closedAt: result.closedAt ?? null,
        replies: (result.comments ?? []).map((c: any) => ({
          id: c.id,
          message: c.message,
          isStaffReply: Boolean(c.isStaffReply),
          createdAt: c.createdAt,
          userName:
            [c.userFirstName, c.userLastName].filter(Boolean).join(" ") ||
            "Unknown",
          attachments: Array.isArray(c.attachments) ? c.attachments : [],
        })),
      };
      setData(mapped);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load ticket",
      );
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { data, loading, error, refetch: fetchDetail };
}

export function useTicketCategories() {
  const [data, setData] = useState<
    {
      slug: string;
      nameEn: string;
      nameAr: string | null;
      autoPriority: "high" | "medium" | "low" | null;
      builtin: boolean;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await supportApi.listTicketCategories();
      setData(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load categories",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { data, loading, error, refetch: fetchCategories };
}
