"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  UserPlus,
  X,
  Loader2,
  ChevronUp,
  ChevronDown,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  courseAssistantsApi,
  type CourseAssistantTA,
  type ThresholdStatus,
} from "@/lib/api";

interface CourseAssistantsManagePanelProps {
  courseId: string;
}

interface AvailableTA {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

const CourseAssistantsManagePanel = ({
  courseId,
}: CourseAssistantsManagePanelProps) => {
  const t = useTranslations("courseManagerDashboard");
  const [tas, setTAs] = useState<CourseAssistantTA[]>([]);
  const [thresholdStatus, setThresholdStatus] =
    useState<ThresholdStatus | null>(null);
  const [availableTAs, setAvailableTAs] = useState<AvailableTA[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectingLoading, setRejectingLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [taData, statusData] = await Promise.all([
        courseAssistantsApi.getCourseTAs(courseId),
        courseAssistantsApi.getThresholdStatus(courseId),
      ]);
      setTAs(taData);
      setThresholdStatus(statusData);
    } catch {
      setTAs([]);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  const fetchAvailableTAs = useCallback(async () => {
    try {
      const data = await courseAssistantsApi.listAvailableTAs(courseId);
      setAvailableTAs(data);
    } catch {
      setAvailableTAs([]);
    }
  }, [courseId]);

  useEffect(() => {
    fetchData();
    fetchAvailableTAs();
  }, [fetchData, fetchAvailableTAs]);

  const handleAssign = async (userId: string) => {
    try {
      setAssigning(true);
      await courseAssistantsApi.assignTA(courseId, { userId });
      toast.success(t("taManagement.assignSuccess") || "TA assigned successfully");
      setShowDropdown(false);
      await fetchData();
      await fetchAvailableTAs();
    } catch {
      toast.error(t("taManagement.assignError") || "Failed to assign TA");
    } finally {
      setAssigning(false);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      await courseAssistantsApi.approveTA(courseId, userId);
      toast.success("TA suggestion approved");
      await fetchData();
    } catch {
      toast.error("Failed to approve TA");
    }
  };

  const handleReject = async (userId: string) => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    try {
      setRejectingLoading(true);
      await courseAssistantsApi.rejectTA(courseId, userId, { reason: rejectionReason.trim() });
      toast.success("TA suggestion rejected");
      setRejectingUserId(null);
      setRejectionReason("");
      await fetchData();
    } catch {
      toast.error("Failed to reject TA");
    } finally {
      setRejectingLoading(false);
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      setRemoving(userId);
      await courseAssistantsApi.removeTA(courseId, userId);
      toast.success("TA removed from course");
      setConfirmRemove(null);
      await fetchData();
      await fetchAvailableTAs();
    } catch {
      toast.error("Failed to remove TA");
    } finally {
      setRemoving(null);
    }
  };

  const handlePriorityChange = async (
    userId: string,
    direction: "up" | "down"
  ) => {
    const ta = tas.find((t) => t.userId === userId);
    if (!ta) return;
    const newPriority =
      direction === "up" ? ta.priority - 1 : ta.priority + 1;
    if (newPriority < 1) return;

    try {
      await courseAssistantsApi.updatePriority(courseId, userId, newPriority);
      await fetchData();
    } catch {
      toast.error("Failed to update priority");
    }
  };

  const getStatusBadge = (ta: CourseAssistantTA) => {
    switch (ta.status) {
      case "approved":
        return "bg-green-50 text-green-700 border-green-200";
      case "suggested":
        return "bg-orange-50 text-orange-700 border-orange-200";
      case "rejected":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  const getStatusLabel = (ta: CourseAssistantTA) => {
    switch (ta.status) {
      case "approved":
        return t("taManagement.activeTA") || "Active";
      case "suggested":
        return "Pending Approval";
      case "rejected":
        return "Rejected";
      default:
        return ta.status;
    }
  };

  // Sort TAs: approved first, then suggested, then rejected; within same status by priority
  const sortedTAs = [...tas].sort((a, b) => {
    const statusOrder: Record<string, number> = {
      approved: 0,
      suggested: 1,
      rejected: 2,
    };
    const statusDiff =
      (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
    if (statusDiff !== 0) return statusDiff;
    return a.priority - b.priority;
  });

  const assignedUserIds = new Set(
    tas.filter((ta) => ta.status !== "rejected").map((ta) => ta.userId)
  );
  const unassignedTAs = availableTAs.filter(
    (ta) => !assignedUserIds.has(ta.id)
  );

  const activeTAs = sortedTAs.filter(
    (ta) => ta.status === "approved"
  );
  const minPriority = Math.min(...activeTAs.map((ta) => ta.priority), Infinity);
  const maxPriority = Math.max(...activeTAs.map((ta) => ta.priority), 0);

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[#1F2937]">
          {t("taManagement.title") || "Teaching Assistants"}
        </h3>
        {unassignedTAs.length > 0 && (
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#6b4e24] border border-[#a37f49] rounded-lg hover:bg-[#FFF8E6] transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            {t("taManagement.assignTA") || "Assign TA"}
          </button>
        )}
      </div>

      {/* NELC Compliance Indicator */}
      {thresholdStatus && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-sm ${
            thresholdStatus.deficit > 0
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-green-50 text-green-700 border border-green-200"
          }`}
        >
          {thresholdStatus.deficit > 0 ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>
            {thresholdStatus.deficit > 0
              ? t("taManagement.deficit", {
                  required: thresholdStatus.requiredTAs,
                  active: thresholdStatus.activeTAs,
                })
              : t("taManagement.noDeficit")}
          </span>
          <span className="text-xs opacity-75 ml-auto">
            {t("taManagement.thresholdInfo", {
              enrolled: thresholdStatus.enrolledCount,
              required: thresholdStatus.requiredTAs,
            })}
          </span>
        </div>
      )}

      {/* Assign TA Dropdown */}
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
                onClick={() => handleAssign(ta.id)}
                disabled={assigning}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-[#1F2937] hover:bg-white rounded-lg transition-colors disabled:opacity-50"
              >
                <span>
                  {ta.firstName} {ta.lastName}{" "}
                  <span className="text-[#6B7280]">({ta.email})</span>
                </span>
                {assigning && (
                  <Loader2 className="w-4 h-4 animate-spin text-[#6b4e24]" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* TAs List */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-[#a37f49] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sortedTAs.length === 0 ? (
        <p className="text-sm text-[#6B7280] text-center py-4">
          No teaching assistants assigned to this course yet.
        </p>
      ) : (
        <div className="space-y-2">
          {sortedTAs.map((ta) => (
            <div
              key={ta.id}
              className="flex items-center justify-between px-3 py-2.5 bg-[#F9FAFB] rounded-lg"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Priority controls (for approved only) */}
                {ta.status === "approved" && (
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() =>
                        handlePriorityChange(ta.userId, "up")
                      }
                      disabled={ta.priority <= minPriority}
                      className="p-0.5 text-[#6B7280] hover:text-[#6b4e24] disabled:opacity-30 disabled:cursor-not-allowed"
                      title={t("taManagement.movePriorityUp") || "Move priority up"}
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() =>
                        handlePriorityChange(ta.userId, "down")
                      }
                      disabled={ta.priority >= maxPriority}
                      className="p-0.5 text-[#6B7280] hover:text-[#6b4e24] disabled:opacity-30 disabled:cursor-not-allowed"
                      title={t("taManagement.movePriorityDown") || "Move priority down"}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1F2937] truncate">
                    {ta.firstName} {ta.lastName}
                    {ta.otherCourseCount > 0 && (
                      <span
                        className="ml-1.5 text-xs text-amber-600"
                        title={t("taManagement.workloadWarning", {
                          name: `${ta.firstName} ${ta.lastName}`,
                          count: ta.otherCourseCount,
                        })}
                      >
                        ({ta.otherCourseCount} other{" "}
                        {ta.otherCourseCount === 1 ? "course" : "courses"})
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#6B7280] truncate">{ta.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadge(ta)}`}
                >
                  {getStatusLabel(ta)}
                </span>

                {/* Approve/Reject for suggested TAs */}
                {ta.status === "suggested" && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleApprove(ta.userId)}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Approve"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setRejectingUserId(ta.userId)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Reject"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Remove button */}
                {ta.status !== "rejected" && (
                  <>
                    {confirmRemove === ta.userId ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRemove(ta.userId)}
                          disabled={removing === ta.userId}
                          className="px-2 py-1 text-xs text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                        >
                          {removing === ta.userId ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            "Confirm"
                          )}
                        </button>
                        <button
                          onClick={() => setConfirmRemove(null)}
                          className="px-2 py-1 text-xs text-[#6B7280] border border-[#E5E7EB] rounded hover:bg-[#F9FAFB]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRemove(ta.userId)}
                        className="p-1.5 text-[#6B7280] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove TA"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectingUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!rejectingLoading) {
                setRejectingUserId(null);
                setRejectionReason("");
              }
            }}
          />
          <div className="relative bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[#1F2937] mb-1">
              Reject TA Suggestion
            </h3>
            <p className="text-sm text-[#6B7280] mb-4">
              Please provide a reason for rejecting this TA suggestion.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => {
                if (e.target.value.length <= 500) {
                  setRejectionReason(e.target.value);
                }
              }}
              placeholder="Enter rejection reason..."
              rows={4}
              className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#a37f49] focus:border-transparent resize-none text-[#1F2937] placeholder-[#9CA3AF]"
              disabled={rejectingLoading}
            />
            <div className="flex items-center justify-between mt-2 mb-4">
              <span className="text-xs text-[#9CA3AF]">
                {rejectionReason.length}/500 characters
              </span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setRejectingUserId(null);
                  setRejectionReason("");
                }}
                disabled={rejectingLoading}
                className="px-4 py-2 text-sm font-medium text-[#4B5563] border border-[#E5E7EB] rounded-lg hover:bg-[#F9FAFB] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(rejectingUserId)}
                disabled={rejectingLoading || !rejectionReason.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#a37f49] rounded-lg hover:bg-[#8b6a3d] transition-colors disabled:opacity-50"
              >
                {rejectingLoading && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseAssistantsManagePanel;
