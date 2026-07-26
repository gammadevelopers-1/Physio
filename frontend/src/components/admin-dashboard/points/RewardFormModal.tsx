"use client";

/**
 * Create / edit modal for a reward.
 *
 * Shape depends on `type`:
 *  • discount_coupon        — percent + expiry + scope (all-paid / specific
 *                              courses / by delivery type)
 *  • fixed_discount_coupon  — amount + expiry + scope (same as above)
 *  • free_course            — course multi-select (bundle 1..N courses, the
 *                              student picks one at redeem time)
 *  • free_webinar           — single searchable session picker
 *  • other                  — free-form fulfilment instructions
 *
 * Type is locked once the reward exists (same DB constraint as before —
 * mixing payload shapes across a type flip is more trouble than it's worth).
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import Select from "../Select";
import SearchableSelect from "../SearchableSelect";
import MultiSelect from "../MultiSelect";
import {
  pointsAdminApi,
  type AdminReward,
  type AdminRewardInput,
  type AdminCourseRedemption,
  type AdminWebinarSession,
  type RewardType,
} from "@/lib/api";

interface Props {
  initial: AdminReward | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

type Scope = "all_paid" | "specific_courses" | "by_delivery_type";
const DELIVERY_TYPES = ["zoom", "onsite", "blended", "self-paced", "webinar"] as const;

export default function RewardFormModal({ initial, onClose, onSaved }: Props) {
  const t = useTranslations("adminDashboard.points.rewards");
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<RewardType>(initial?.type ?? "discount_coupon");
  const [form, setForm] = useState({
    nameEn: initial?.nameEn ?? "",
    nameAr: initial?.nameAr ?? "",
    descriptionEn: initial?.descriptionEn ?? "",
    descriptionAr: initial?.descriptionAr ?? "",
    pointsCost: initial?.pointsCost ?? 100,
    isActive: initial?.isActive ?? true,
    displayOrder: initial?.displayOrder ?? 0,
    maxPerUser: initial?.maxPerUser ?? null,
    totalStock: initial?.totalStock ?? null,
    validFrom: initial?.validFrom ?? "",
    validUntil: initial?.validUntil ?? "",
  });
  const [payload, setPayload] = useState<Record<string, unknown>>(() => {
    const base = initial?.payload ?? defaultPayload(type);
    // Legacy `other` rewards created before Phase 2 lack expectedDeliveryDays.
    // Seed the field so the admin sees the current-default value on edit
    // instead of an empty required box.
    if (
      (initial?.type ?? type) === "other" &&
      typeof (base as Record<string, unknown>).expectedDeliveryDays !== "number"
    ) {
      return { ...(base as Record<string, unknown>), expectedDeliveryDays: 7 };
    }
    return base;
  });

  const changeType = (newType: RewardType) => {
    setType(newType);
    setPayload(defaultPayload(newType));
  };

  const submit = async () => {
    if (!form.nameEn.trim()) {
      toast.error(t("errors.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const body: AdminRewardInput = {
        nameEn: form.nameEn.trim(),
        nameAr: form.nameAr.trim() || undefined,
        descriptionEn: form.descriptionEn.trim() || undefined,
        descriptionAr: form.descriptionAr.trim() || undefined,
        type,
        pointsCost: Number(form.pointsCost),
        payload,
        isActive: form.isActive,
        displayOrder: Number(form.displayOrder),
        maxPerUser: form.maxPerUser === null ? null : Number(form.maxPerUser),
        totalStock: form.totalStock === null ? null : Number(form.totalStock),
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
      };
      if (isEdit && initial) {
        await pointsAdminApi.updateReward(initial.id, body);
        toast.success(t("toasts.updated"));
      } else {
        await pointsAdminApi.createReward(body);
        toast.success(t("toasts.created"));
      }
      await onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const typeOptions = useMemo(
    () => [
      { value: "discount_coupon", label: t("types.discount_coupon") },
      { value: "fixed_discount_coupon", label: t("types.fixed_discount_coupon") },
      { value: "free_course", label: t("types.free_course") },
      { value: "free_webinar", label: t("types.free_webinar") },
      { value: "other", label: t("types.other") },
    ],
    [t],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 overflow-y-auto py-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="text-base font-semibold">
            {isEdit ? t("editTitle") : t("createTitle")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--color-border-subtle)] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <Label>{t("fields.type")}</Label>
            <Select
              options={typeOptions}
              value={type}
              onChange={(v) => changeType(v as RewardType)}
              placeholder={t("fields.type")}
              disabled={isEdit}
            />
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              {t("fields.typeHelp")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("fields.nameEn")}</Label>
              <Input
                value={form.nameEn}
                onChange={(v) => setForm({ ...form, nameEn: v })}
                placeholder="10% Off Coupon"
              />
            </div>
            <div>
              <Label>{t("fields.nameAr")}</Label>
              <Input
                value={form.nameAr}
                onChange={(v) => setForm({ ...form, nameAr: v })}
                placeholder="قسيمة خصم 10%"
                dir="rtl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("fields.descriptionEn")}</Label>
              <Textarea
                value={form.descriptionEn}
                onChange={(v) => setForm({ ...form, descriptionEn: v })}
              />
            </div>
            <div>
              <Label>{t("fields.descriptionAr")}</Label>
              <Textarea
                value={form.descriptionAr}
                onChange={(v) => setForm({ ...form, descriptionAr: v })}
                dir="rtl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("fields.pointsCost")}</Label>
              <Input
                type="number"
                value={String(form.pointsCost)}
                onChange={(v) => setForm({ ...form, pointsCost: Number(v) })}
              />
            </div>
            <div>
              <Label>{t("fields.displayOrder")}</Label>
              <Input
                type="number"
                value={String(form.displayOrder)}
                onChange={(v) => setForm({ ...form, displayOrder: Number(v) })}
              />
            </div>
          </div>

          {/* Type-specific payload fields */}
          <PayloadForm type={type} payload={payload} setPayload={setPayload} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("fields.maxPerUser")}</Label>
              <Input
                type="number"
                value={form.maxPerUser === null ? "" : String(form.maxPerUser)}
                onChange={(v) =>
                  setForm({ ...form, maxPerUser: v === "" ? null : Number(v) })
                }
                placeholder={t("unlimited")}
              />
            </div>
            <div>
              <Label>{t("fields.totalStock")}</Label>
              <Input
                type="number"
                value={form.totalStock === null ? "" : String(form.totalStock)}
                onChange={(v) =>
                  setForm({ ...form, totalStock: v === "" ? null : Number(v) })
                }
                placeholder={t("unlimited")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("fields.validFrom")}</Label>
              <Input
                type="datetime-local"
                value={form.validFrom ? form.validFrom.slice(0, 16) : ""}
                onChange={(v) =>
                  setForm({ ...form, validFrom: v ? new Date(v).toISOString() : "" })
                }
              />
            </div>
            <div>
              <Label>{t("fields.validUntil")}</Label>
              <Input
                type="datetime-local"
                value={form.validUntil ? form.validUntil.slice(0, 16) : ""}
                onChange={(v) =>
                  setForm({ ...form, validUntil: v ? new Date(v).toISOString() : "" })
                }
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            {t("fields.isActive")}
          </label>
        </div>

        <div className="px-5 py-3 border-t border-[var(--color-border)] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)]"
          >
            {t("cancel")}
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? t("save") : t("createBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

function PayloadForm({
  type,
  payload,
  setPayload,
}: {
  type: RewardType;
  payload: Record<string, unknown>;
  setPayload: (p: Record<string, unknown>) => void;
}) {
  const t = useTranslations("adminDashboard.points.rewards");
  const set = (patch: Record<string, unknown>) =>
    setPayload({ ...payload, ...patch });

  switch (type) {
    case "discount_coupon":
      return (
        <div className="p-3 bg-[var(--color-surface-page)] rounded-lg space-y-3">
          <div className="text-xs font-medium uppercase text-[var(--color-text-secondary)]">
            {t("payload.discount_coupon.title")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("payload.discount_coupon.percent")}</Label>
              <Input
                type="number"
                value={String(payload.percent ?? "")}
                onChange={(v) => set({ percent: Number(v) })}
                placeholder="10"
              />
            </div>
            <div>
              <Label>{t("payload.expiryDays")}</Label>
              <Input
                type="number"
                value={String(payload.expiryDays ?? "")}
                onChange={(v) => set({ expiryDays: Number(v) })}
                placeholder="30"
              />
            </div>
          </div>
          <ScopePicker payload={payload} setPayload={setPayload} />
        </div>
      );
    case "fixed_discount_coupon":
      return (
        <div className="p-3 bg-[var(--color-surface-page)] rounded-lg space-y-3">
          <div className="text-xs font-medium uppercase text-[var(--color-text-secondary)]">
            {t("payload.fixed_discount_coupon.title")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("payload.fixed_discount_coupon.amountSar")}</Label>
              <Input
                type="number"
                value={String(payload.amountSar ?? "")}
                onChange={(v) => set({ amountSar: Number(v) })}
                placeholder="50"
              />
            </div>
            <div>
              <Label>{t("payload.expiryDays")}</Label>
              <Input
                type="number"
                value={String(payload.expiryDays ?? "")}
                onChange={(v) => set({ expiryDays: Number(v) })}
                placeholder="30"
              />
            </div>
          </div>
          <ScopePicker payload={payload} setPayload={setPayload} />
        </div>
      );
    case "free_course":
      return (
        <div className="p-3 bg-[var(--color-surface-page)] rounded-lg space-y-3">
          <div className="text-xs font-medium uppercase text-[var(--color-text-secondary)]">
            {t("payload.free_course.title")}
          </div>
          <CourseMultiPicker
            selected={extractCourseIds(payload)}
            onChange={(ids) => setPayload({ courseIds: ids })}
          />
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t("payload.free_course.help")}
          </p>
        </div>
      );
    case "free_webinar":
      return (
        <div className="p-3 bg-[var(--color-surface-page)] rounded-lg space-y-3">
          <div className="text-xs font-medium uppercase text-[var(--color-text-secondary)]">
            {t("payload.free_webinar.title")}
          </div>
          <SessionPicker
            selected={(payload.sessionId as string) || null}
            onChange={(id) => set({ sessionId: id ?? "" })}
          />
        </div>
      );
    case "other":
      return (
        <div className="p-3 bg-[var(--color-surface-page)] rounded-lg space-y-3">
          <div className="text-xs font-medium uppercase text-[var(--color-text-secondary)]">
            {t("payload.other.title")}
          </div>
          <div>
            <Label>{t("payload.other.expectedDeliveryDaysLabel")}</Label>
            <Input
              type="number"
              value={String(payload.expectedDeliveryDays ?? "")}
              onChange={(v) =>
                set({ expectedDeliveryDays: v === "" ? undefined : Number(v) })
              }
              placeholder={t("payload.other.expectedDeliveryDaysPlaceholder")}
            />
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              {t("payload.other.expectedDeliveryDaysHelper")}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>{t("payload.other.instructionsEn")}</Label>
              <Textarea
                value={String(payload.instructionsEn ?? "")}
                onChange={(v) => set({ instructionsEn: v })}
              />
            </div>
            <div>
              <Label>{t("payload.other.instructionsAr")}</Label>
              <Textarea
                value={String(payload.instructionsAr ?? "")}
                onChange={(v) => set({ instructionsAr: v })}
                dir="rtl"
              />
            </div>
          </div>
          <div className="text-xs text-[var(--color-text-secondary)] flex items-start gap-1">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
            <span>{t("payload.other.pendingNotice")}</span>
          </div>
        </div>
      );
  }
}

function ScopePicker({
  payload,
  setPayload,
}: {
  payload: Record<string, unknown>;
  setPayload: (p: Record<string, unknown>) => void;
}) {
  const t = useTranslations("adminDashboard.points.rewards");
  const tShared = useTranslations("financeDashboard.discountsPage.campaignsV2.form");
  const scope: Scope = (payload.scope as Scope) ?? "all_paid";
  const scopeOpts = useMemo(
    () => [
      { value: "all_paid", label: t("scope.all_paid") },
      { value: "specific_courses", label: t("scope.specific_courses") },
      { value: "by_delivery_type", label: t("scope.by_delivery_type") },
    ],
    [t],
  );
  return (
    <div className="space-y-2">
      <Label>{t("scope.label")}</Label>
      <Select
        options={scopeOpts}
        value={scope}
        onChange={(v) =>
          setPayload({
            ...payload,
            scope: v,
            scopeCourseIds: v === "specific_courses" ? (payload.scopeCourseIds ?? []) : [],
            deliveryTypes: v === "by_delivery_type" ? (payload.deliveryTypes ?? []) : [],
          })
        }
        placeholder={t("scope.label")}
      />
      {scope === "specific_courses" && (
        <CourseMultiPicker
          selected={((payload.scopeCourseIds as string[]) ?? [])}
          onChange={(ids) => setPayload({ ...payload, scopeCourseIds: ids })}
        />
      )}
      {scope === "by_delivery_type" && (
        <MultiSelect
          value={(payload.deliveryTypes as string[]) ?? []}
          onChange={(vals) => setPayload({ ...payload, deliveryTypes: vals })}
          options={DELIVERY_TYPES.map((dt) => ({
            value: dt,
            label: tShared(`deliveryTypes.${dt}` as Parameters<typeof tShared>[0]),
          }))}
          placeholder={t("scope.deliveryTypePlaceholder")}
          searchPlaceholder={t("multiSelect.search")}
          emptyLabel={t("multiSelect.empty")}
          clearAllLabel={t("multiSelect.clearAll")}
        />
      )}
    </div>
  );
}

function CourseMultiPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations("adminDashboard.points.rewards");
  const [courses, setCourses] = useState<AdminCourseRedemption[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    pointsAdminApi
      .listCourses()
      .then((rows) => {
        if (!cancelled) setCourses(rows);
      })
      .catch(() => {
        if (!cancelled) setCourses([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const options = useMemo(
    () =>
      (courses ?? []).map((c) => ({
        value: c.id,
        label: c.title,
        hint:
          Number(c.price ?? 0) > 0
            ? `SAR ${Number(c.price ?? 0).toLocaleString()} · ${c.deliveryType}`
            : `${t("payload.free_course.freeBadge")} · ${c.deliveryType}`,
      })),
    [courses, t],
  );
  return (
    <MultiSelect
      value={selected}
      onChange={onChange}
      options={options}
      loading={courses === null}
      placeholder={t("payload.free_course.pickerPlaceholder")}
      searchPlaceholder={t("multiSelect.search")}
      emptyLabel={t("payload.free_course.pickerEmpty")}
      loadingLabel={t("multiSelect.loading")}
      clearAllLabel={t("multiSelect.clearAll")}
    />
  );
}

function SessionPicker({
  selected,
  onChange,
}: {
  selected: string | null;
  onChange: (id: string | null) => void;
}) {
  const t = useTranslations("adminDashboard.points.rewards");
  const [sessions, setSessions] = useState<AdminWebinarSession[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    pointsAdminApi
      .listWebinarSessions()
      .then((rows) => {
        if (!cancelled) setSessions(rows);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const options = useMemo(
    () =>
      (sessions ?? []).map((s) => ({
        value: s.id,
        label: s.title,
        hint: `${s.courseTitle} · ${new Date(s.scheduledAt).toLocaleString()}`,
      })),
    [sessions],
  );
  return (
    <SearchableSelect
      options={options}
      value={selected}
      onChange={onChange}
      placeholder={t("payload.free_webinar.pickerPlaceholder")}
      searchPlaceholder={t("multiSelect.search")}
      emptyLabel={t("payload.free_webinar.pickerEmpty")}
      clearLabel={t("multiSelect.clearAll")}
      disabled={sessions === null}
    />
  );
}

function defaultPayload(type: RewardType): Record<string, unknown> {
  switch (type) {
    case "discount_coupon":
      return { percent: 10, expiryDays: 30, scope: "all_paid" };
    case "fixed_discount_coupon":
      return { amountSar: 50, expiryDays: 30, scope: "all_paid" };
    case "free_course":
      return { courseIds: [] };
    case "free_webinar":
      return { sessionId: "" };
    case "other":
      return { instructionsEn: "", instructionsAr: "", expectedDeliveryDays: 7 };
  }
}

/**
 * Read the courseIds array from a payload; falls back to the legacy
 * `courseId` scalar so rewards created before the 0108 migration still
 * pre-populate correctly.
 */
function extractCourseIds(payload: Record<string, unknown>): string[] {
  if (Array.isArray(payload.courseIds)) {
    return (payload.courseIds as unknown[]).filter(
      (v): v is string => typeof v === "string",
    );
  }
  if (typeof payload.courseId === "string" && payload.courseId) {
    return [payload.courseId];
  }
  return [];
}

// ─── Local building blocks (small enough to inline) ───────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  type,
  placeholder,
  dir,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  dir?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      type={type}
      placeholder={placeholder}
      dir={dir}
      className="w-full border border-[var(--color-input-border)] rounded px-3 py-1.5 text-sm bg-white"
    />
  );
}

function Textarea({
  value,
  onChange,
  dir,
}: {
  value: string;
  onChange: (v: string) => void;
  dir?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      dir={dir}
      rows={2}
      className="w-full border border-[var(--color-input-border)] rounded px-3 py-1.5 text-sm bg-white resize-none"
    />
  );
}
