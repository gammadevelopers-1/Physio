"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { UserPlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { courseAssistantsApi, sessionAssistantsApi } from "@/lib/api";

interface CourseTA {
  id: string;
  courseId: string;
  userId: string;
  status: "suggested" | "approved" | "rejected";
  assignedAt: string;
  approvedAt: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface AvailableTA {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface CourseAssistantsSuggestPanelProps {
  courseId: string;
  sessionId?: string;
}

const CourseAssistantsSuggestPanel = ({
  courseId,
  sessionId,
}: CourseAssistantsSuggestPanelProps) => {
  const t = useTranslations("instructorDashboard");
  const [tas, setTAs] = useState<CourseTA[]>([]);
  const [availableTAs, setAvailableTAs] = useState<AvailableTA[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const fetchTAs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await courseAssistantsApi.getCourseTAs(courseId);
      setTAs(data);
    } catch {
      setTAs([]);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  const fetchAvailableTAs = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await sessionAssistantsApi.listAvailableTAs(sessionId);
      setAvailableTAs(data);
    } catch {
      setAvailableTAs([]);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchTAs();
    fetchAvailableTAs();
  }, [fetchTAs, fetchAvailableTAs]);

  const handleSuggest = async (userId: string) => {
    try {
      setSuggesting(true);
      await courseAssistantsApi.suggestTA(courseId, { userId });
      toast.success("TA suggestion sent to managers for approval");
      setShowDropdown(false);
      await fetchTAs();
    } catch {
      toast.error("Failed to suggest TA");
    } finally {
      setSuggesting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-50 text-green-700 border-green-200";
      case "suggested":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "rejected":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "approved":
        return "Approved";
      case "suggested":
        return "Pending Approval";
      case "rejected":
        return "Rejected";
      default:
        return status;
    }
  };

  // Filter out TAs that are already assigned
  const assignedUserIds = new Set(tas.map((ta) => ta.userId));
  const unassignedTAs = availableTAs.filter(
    (ta) => !assignedUserIds.has(ta.id)
  );

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[#1F2937]">
          Teaching Assistants
        </h3>
        {unassignedTAs.length > 0 && (
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#002D87] border border-[#002D87] rounded-lg hover:bg-[#F0F7FF] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Suggest TA
          </button>
        )}
      </div>

      {/* Suggest TA Dropdown */}
      {showDropdown && (
        <div className="mb-4 p-3 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-[#4B5563]">
              Select a Teaching Assistant
            </p>
            <button onClick={() => setShowDropdown(false)}>
              <X className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {unassignedTAs.map((ta) => (
              <button
                key={ta.id}
                onClick={() => handleSuggest(ta.id)}
                disabled={suggesting}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-[#1F2937] hover:bg-white rounded-lg transition-colors disabled:opacity-50"
              >
                <span>
                  {ta.firstName} {ta.lastName}{" "}
                  <span className="text-[#6B7280]">({ta.email})</span>
                </span>
                {suggesting && (
                  <Loader2 className="w-4 h-4 animate-spin text-[#002D87]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Current TAs List */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-[#002D87] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tas.length === 0 ? (
        <p className="text-sm text-[#6B7280] text-center py-4">
          No teaching assistants assigned to this course yet.
        </p>
      ) : (
        <div className="space-y-2">
          {tas.map((ta) => (
            <div
              key={ta.id}
              className="flex items-center justify-between px-3 py-2.5 bg-[#F9FAFB] rounded-lg"
            >
              <div>
                <p className="text-sm font-medium text-[#1F2937]">
                  {ta.firstName} {ta.lastName}
                </p>
                <p className="text-xs text-[#6B7280]">{ta.email}</p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadge(ta.status)}`}
              >
                {getStatusLabel(ta.status)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CourseAssistantsSuggestPanel;
