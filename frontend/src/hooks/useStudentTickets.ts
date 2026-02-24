"use client";

import { useState, useEffect, useCallback } from "react";
import { studentApi } from "@/lib/api";
import type {
  SupportTicket,
  TicketDetail,
  TicketsResponse,
} from "@/types/student-dashboard";

export function useStudentTickets(params?: { status?: string }) {
  const [data, setData] = useState<SupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result: TicketsResponse = await studentApi.getTickets({
        status: params?.status,
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
  }, [params?.status]);

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
      const result = await studentApi.getTicketDetail(ticketId);
      setData(result);
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
