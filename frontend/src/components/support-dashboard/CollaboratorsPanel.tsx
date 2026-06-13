"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UserPlus, X, Users } from "lucide-react";
import { toast } from "sonner";
import { supportApi } from "@/lib/api";
import LoopInCollaboratorModal from "./LoopInCollaboratorModal";
import ConfirmDialog from "@/components/support-shared/ConfirmDialog";

export interface Collaborator {
  id: string;
  userId: string;
  department: string;
  addedAt: string;
  userName: string | null;
  userEmail: string | null;
  addedBy: { id: string; name: string | null } | null;
}

interface Props {
  ticketId: string;
  courseId: string | null;
  collaborators: Collaborator[];
  /** When true the panel is read-only — used for the
   *  collaborator's own view of the ticket. */
  readOnly?: boolean;
  /** Whether the viewer can remove collaborators. Supervisors +
   *  admins always can. Plain support can only remove ones they
   *  added themselves (enforced server-side). */
  canManage: boolean;
  /** Category's suggestedDepartment — preselects the Loop-in modal
   *  dept picker. */
  suggestedDepartment?: string | null;
  onChange: () => void;
}

const DEPT_TONE: Record<string, string> = {
  finance: "bg-amber-50 text-amber-900 border-amber-200",
  course_manager: "bg-indigo-50 text-indigo-900 border-indigo-200",
  instructor: "bg-emerald-50 text-emerald-900 border-emerald-200",
  ta: "bg-emerald-50 text-emerald-900 border-emerald-200",
  admin: "bg-red-50 text-red-900 border-red-200",
  supervisor: "bg-sky-50 text-sky-900 border-sky-200",
};

export default function CollaboratorsPanel({
  ticketId,
  courseId,
  collaborators,
  readOnly = false,
  canManage,
  suggestedDepartment,
  onChange,
}: Props) {
  const t = useTranslations("ticketDetail.collaborators");
  const tDept = useTranslations("support.departments");
  const [loopInOpen, setLoopInOpen] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  // Group collaborators by department for tidy rendering.
  const grouped = collaborators.reduce<Record<string, Collaborator[]>>(
    (acc, c) => {
      (acc[c.department] ||= []).push(c);
      return acc;
    },
    {},
  );

  const activeUserIds = collaborators.map((c) => c.userId);
  const target = confirmRemoveId
    ? collaborators.find((c) => c.userId === confirmRemoveId)
    : null;

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white">
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[var(--color-text-secondary)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("title")}
          </h3>
          <span className="text-xs text-[var(--color-text-secondary)]">
            ({collaborators.length})
          </span>
        </div>
        {!readOnly && canManage && (
          <button
            type="button"
            onClick={() => setLoopInOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-[var(--color-border)] bg-white hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-colors"
          >
            <UserPlus className="w-3 h-3" />
            {t("loopIn")}
          </button>
        )}
      </div>

      {/* Body */}
      {collaborators.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <div className="text-xs text-[var(--color-text-secondary)]">
            {t("empty")}
          </div>
          {!readOnly && canManage && (
            <div className="text-[10px] text-[var(--color-text-secondary)]/60 mt-1">
              {t("emptyHint")}
            </div>
          )}
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {Object.entries(grouped).map(([dept, members]) => (
            <div key={dept} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full border ${
                    DEPT_TONE[dept] ?? "bg-[var(--color-bg-secondary)] border-[var(--color-border)]"
                  }`}
                >
                  {tDept(dept)}
                </span>
              </div>
              <ul className="space-y-1.5">
                {members.map((m) => {
                  const display =
                    m.userName ?? m.userEmail ?? m.userId.slice(0, 8);
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]"
                    >
                      <div className="w-6 h-6 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center text-[10px] font-semibold text-[var(--color-text-secondary)]">
                        {display.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="min-w-0 flex-1 truncate">{display}</span>
                      {!readOnly && canManage && (
                        <button
                          type="button"
                          onClick={() => setConfirmRemoveId(m.userId)}
                          className="w-6 h-6 rounded-md hover:bg-red-50 hover:text-red-700 text-[var(--color-text-secondary)] flex items-center justify-center"
                          title={t("removeAria")}
                          aria-label={t("removeAria")}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      <LoopInCollaboratorModal
        open={loopInOpen}
        onOpenChange={setLoopInOpen}
        ticketId={ticketId}
        courseId={courseId}
        suggestedDepartment={suggestedDepartment ?? null}
        activeUserIds={activeUserIds}
        onAdded={onChange}
      />

      <ConfirmDialog
        open={!!confirmRemoveId}
        onOpenChange={(o) => !o && setConfirmRemoveId(null)}
        title={t("removeConfirmTitle")}
        description={
          target
            ? t("removeConfirmDescription", {
                name: target.userName ?? target.userEmail ?? "",
              })
            : ""
        }
        destructive
        confirmLabel={t("removeConfirm")}
        onConfirm={async () => {
          if (!confirmRemoveId) return;
          setRemoving(true);
          try {
            await supportApi.removeCollaborator(ticketId, confirmRemoveId);
            toast.success(t("removedSuccess"));
            onChange();
          } catch (e) {
            toast.error(
              (e as { message?: string })?.message || t("removeFailed"),
            );
          } finally {
            setRemoving(false);
            setConfirmRemoveId(null);
          }
        }}
      />
    </div>
  );
}
