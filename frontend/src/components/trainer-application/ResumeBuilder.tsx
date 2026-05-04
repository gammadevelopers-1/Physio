"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, FolderPlus } from "lucide-react";
import DatePicker from "@/components/ui/DatePicker";

// ─── Types ────────────────────────────────────────────────────────────────

export type EducationEntry = {
  university: string;
  graduationYear: string; // ISO YYYY-MM-DD
  profession: string;
  specialty: string;
  qualification: string;
};

export type ScientificResearchEntry = {
  type: string;
  role: string;
  description: string;
};

export type ProfessionalSkillEntry = {
  placeOfWork: string;
  type: "Academic" | "Practical Experience" | string;
  yearsOfExperience: number;
  academicRank?: string;
  natureOfWork?: string;
};

export type TrainingExperienceEntry = {
  eventName: string;
  executingAgency: string;
};

export type StructuredResume = {
  education: EducationEntry[];
  professionalSkills: ProfessionalSkillEntry[];
  scientificResearches: ScientificResearchEntry[];
  trainingExperiences: TrainingExperienceEntry[];
};

export const emptyStructuredResume: StructuredResume = {
  education: [],
  professionalSkills: [],
  scientificResearches: [],
  trainingExperiences: [],
};

type Option = { value: string; label: string };
type Profession = { value: string; label: string; specialties?: Array<{ value: string; label: string }> };

interface ResumeBuilderProps {
  value: StructuredResume;
  onChange: (next: StructuredResume) => void;
  isRTL: boolean;
  professions: Profession[];
  qualificationOptions: Option[];
  rankOptions: Option[];
}

// ─── Shared bits ──────────────────────────────────────────────────────────

const Modal = ({ title, isRTL, onClose, children }: { title: string; isRTL: boolean; onClose: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div
      className="bg-white rounded-2xl w-full max-w-lg shadow-xl"
      dir={isRTL ? "rtl" : "ltr"}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h3>
        <button type="button" onClick={onClose} className="p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-border-subtle)] rounded">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="px-6 pb-6">{children}</div>
    </div>
  </div>
);

const inputCls = (isRTL: boolean) =>
  `w-full h-11 px-3 bg-white border border-[var(--color-input-border)] rounded-lg outline-none focus:border-[var(--color-input-focus)] text-sm ${isRTL ? "text-right" : ""}`;

const SelectField = ({
  label,
  value,
  onChange,
  options,
  required,
  placeholder,
  isRTL,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  required?: boolean;
  placeholder?: string;
  isRTL: boolean;
  disabled?: boolean;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-[var(--color-text-primary)]">
      {label} {required && <span className="text-[#dc2626]">*</span>}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`${inputCls(isRTL)} bg-white disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <option value="">{placeholder || ""}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
);

const TextField = ({
  label,
  value,
  onChange,
  required,
  placeholder,
  isRTL,
  type = "text",
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  isRTL: boolean;
  type?: string;
  min?: number;
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-[var(--color-text-primary)]">
      {label} {required && <span className="text-[#dc2626]">*</span>}
    </label>
    <input
      type={type}
      min={min}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={inputCls(isRTL)}
    />
  </div>
);

const SaveBtn = ({ onClick, isRTL }: { onClick: () => void; isRTL: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    className="mt-4 px-6 py-2 rounded-lg text-white text-sm font-medium"
    style={{
      background: isRTL
        ? "linear-gradient(to left, var(--color-primary), var(--color-primary-dark))"
        : "linear-gradient(to right, var(--color-primary), var(--color-primary-dark))",
    }}
  >
    {isRTL ? "حفظ" : "Save"}
  </button>
);

// ─── Education modal ──────────────────────────────────────────────────────

const EducationModal = ({
  initial,
  isRTL,
  professions,
  qualificationOptions,
  onSave,
  onClose,
}: {
  initial: EducationEntry | null;
  isRTL: boolean;
  professions: Profession[];
  qualificationOptions: Option[];
  onSave: (entry: EducationEntry) => void;
  onClose: () => void;
}) => {
  const [draft, setDraft] = useState<EducationEntry>(
    initial || { university: "", graduationYear: "", profession: "", specialty: "", qualification: "" },
  );

  const professionOptions = professions.map((p) => ({ value: p.value, label: p.label }));
  // Cascade: specialties come from the selected profession's nested list.
  const selectedProfession = professions.find(
    (p) => p.value === draft.profession || p.label === draft.profession,
  );
  const specialtyOptions = (selectedProfession?.specialties || []).map((s) => ({ value: s.value, label: s.label }));

  const submit = () => {
    if (!draft.university.trim() || !draft.graduationYear || !draft.profession || !draft.specialty || !draft.qualification) return;
    onSave(draft);
  };

  return (
    <Modal title={isRTL ? "التعليم" : "Education"} isRTL={isRTL} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label={isRTL ? "الجامعة" : "University"} required isRTL={isRTL} value={draft.university} onChange={(v) => setDraft((p) => ({ ...p, university: v }))} />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--color-text-primary)]">
            {isRTL ? "تاريخ التخرج" : "Graduation Year"} <span className="text-[#dc2626]">*</span>
          </label>
          <DatePicker value={draft.graduationYear} onChange={(iso) => setDraft((p) => ({ ...p, graduationYear: iso }))} placeholder={isRTL ? "اختر التاريخ" : "Select date"} />
        </div>
        <SelectField label={isRTL ? "المهنة" : "Profession"} required isRTL={isRTL} placeholder={isRTL ? "اختر المهنة" : "Select profession"} options={professionOptions} value={draft.profession} onChange={(v) => setDraft((p) => ({ ...p, profession: v, specialty: "" }))} />
        <SelectField label={isRTL ? "التخصص" : "Specialty"} required isRTL={isRTL} placeholder={!draft.profession ? (isRTL ? "اختر المهنة أولاً" : "Pick profession first") : (isRTL ? "اختر التخصص" : "Select specialty")} options={specialtyOptions} value={draft.specialty} onChange={(v) => setDraft((p) => ({ ...p, specialty: v }))} disabled={!draft.profession} />
        <SelectField label={isRTL ? "المؤهل" : "Qualification"} required isRTL={isRTL} placeholder={isRTL ? "اختر المؤهل" : "Select qualification"} options={qualificationOptions} value={draft.qualification} onChange={(v) => setDraft((p) => ({ ...p, qualification: v }))} />
      </div>
      <div className="flex justify-center">
        <SaveBtn onClick={submit} isRTL={isRTL} />
      </div>
    </Modal>
  );
};

// ─── Scientific Research modal ────────────────────────────────────────────

const ScientificResearchModal = ({
  initial,
  isRTL,
  onSave,
  onClose,
}: {
  initial: ScientificResearchEntry | null;
  isRTL: boolean;
  onSave: (entry: ScientificResearchEntry) => void;
  onClose: () => void;
}) => {
  const [draft, setDraft] = useState<ScientificResearchEntry>(initial || { type: "", role: "", description: "" });
  const typeOptions: Option[] = [
    { value: "Conferences", label: isRTL ? "مؤتمرات" : "Conferences" },
    { value: "Journals", label: isRTL ? "مجلات" : "Journals" },
  ];
  const roleOptions: Option[] = [
    { value: "Lead", label: isRTL ? "قائد" : "Lead" },
    { value: "Assistant", label: isRTL ? "مساعد" : "Assistant" },
  ];
  const submit = () => {
    if (!draft.type.trim() || !draft.role.trim() || !draft.description.trim()) return;
    onSave(draft);
  };

  return (
    <Modal title={isRTL ? "البحث العلمي" : "Scientific Research"} isRTL={isRTL} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField label={isRTL ? "النوع" : "Type"} required isRTL={isRTL} placeholder={isRTL ? "اختر أو اكتب" : "Select"} options={typeOptions} value={draft.type} onChange={(v) => setDraft((p) => ({ ...p, type: v }))} />
        <SelectField label={isRTL ? "الدور" : "Role"} required isRTL={isRTL} placeholder={isRTL ? "اختر" : "Select"} options={roleOptions} value={draft.role} onChange={(v) => setDraft((p) => ({ ...p, role: v }))} />
        <div className="sm:col-span-2">
          <TextField label={isRTL ? "الوصف" : "Description"} required isRTL={isRTL} value={draft.description} onChange={(v) => setDraft((p) => ({ ...p, description: v }))} />
        </div>
      </div>
      <div className="flex justify-center">
        <SaveBtn onClick={submit} isRTL={isRTL} />
      </div>
    </Modal>
  );
};

// ─── Professional Skills modal ────────────────────────────────────────────

const ProfessionalSkillModal = ({
  initial,
  isRTL,
  rankOptions,
  onSave,
  onClose,
}: {
  initial: ProfessionalSkillEntry | null;
  isRTL: boolean;
  rankOptions: Option[];
  onSave: (entry: ProfessionalSkillEntry) => void;
  onClose: () => void;
}) => {
  const [draft, setDraft] = useState<ProfessionalSkillEntry>(
    initial || { placeOfWork: "", type: "", yearsOfExperience: 0, academicRank: "", natureOfWork: "" },
  );

  const typeOptions: Option[] = [
    { value: "Academic", label: isRTL ? "أكاديمي" : "Academic" },
    { value: "Practical Experience", label: isRTL ? "خبرة عملية" : "Practical Experience" },
  ];

  const submit = () => {
    if (!draft.placeOfWork.trim() || !draft.type || draft.yearsOfExperience < 0) return;
    if (draft.type === "Academic" && !draft.academicRank?.trim()) return;
    if (draft.type === "Practical Experience" && !draft.natureOfWork?.trim()) return;
    // Drop the unused conditional field before saving
    const cleaned: ProfessionalSkillEntry = {
      placeOfWork: draft.placeOfWork,
      type: draft.type,
      yearsOfExperience: Number(draft.yearsOfExperience) || 0,
      ...(draft.type === "Academic" ? { academicRank: draft.academicRank } : {}),
      ...(draft.type === "Practical Experience" ? { natureOfWork: draft.natureOfWork } : {}),
    };
    onSave(cleaned);
  };

  return (
    <Modal title={isRTL ? "المهارات المهنية" : "Professional Skill"} isRTL={isRTL} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label={isRTL ? "مكان العمل" : "Place of Work"} required isRTL={isRTL} value={draft.placeOfWork} onChange={(v) => setDraft((p) => ({ ...p, placeOfWork: v }))} />
        <SelectField label={isRTL ? "النوع" : "Type"} required isRTL={isRTL} placeholder={isRTL ? "اختر" : "Select"} options={typeOptions} value={draft.type} onChange={(v) => setDraft((p) => ({ ...p, type: v, academicRank: "", natureOfWork: "" }))} />
        <TextField label={isRTL ? "سنوات الخبرة" : "Years of Experience"} required isRTL={isRTL} type="number" min={0} value={String(draft.yearsOfExperience || "")} onChange={(v) => setDraft((p) => ({ ...p, yearsOfExperience: Number(v) || 0 }))} />
        {draft.type === "Academic" && (
          <SelectField label={isRTL ? "الدرجة الأكاديمية" : "Academic Rank"} required isRTL={isRTL} placeholder={isRTL ? "اختر الدرجة" : "Select rank"} options={rankOptions} value={draft.academicRank || ""} onChange={(v) => setDraft((p) => ({ ...p, academicRank: v }))} />
        )}
        {draft.type === "Practical Experience" && (
          <TextField label={isRTL ? "طبيعة العمل" : "Nature of Work"} required isRTL={isRTL} value={draft.natureOfWork || ""} onChange={(v) => setDraft((p) => ({ ...p, natureOfWork: v }))} />
        )}
      </div>
      <div className="flex justify-center">
        <SaveBtn onClick={submit} isRTL={isRTL} />
      </div>
    </Modal>
  );
};

// ─── Training Experience modal ────────────────────────────────────────────

const TrainingExperienceModal = ({
  initial,
  isRTL,
  onSave,
  onClose,
}: {
  initial: TrainingExperienceEntry | null;
  isRTL: boolean;
  onSave: (entry: TrainingExperienceEntry) => void;
  onClose: () => void;
}) => {
  const [draft, setDraft] = useState<TrainingExperienceEntry>(initial || { eventName: "", executingAgency: "" });
  const submit = () => {
    if (!draft.eventName.trim() || !draft.executingAgency.trim()) return;
    onSave(draft);
  };
  return (
    <Modal title={isRTL ? "الخبرة التدريبية" : "Training Experience"} isRTL={isRTL} onClose={onClose}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label={isRTL ? "اسم الفعالية" : "Event Name"} required isRTL={isRTL} value={draft.eventName} onChange={(v) => setDraft((p) => ({ ...p, eventName: v }))} />
        <TextField label={isRTL ? "الجهة المنفذة" : "Executing Agency"} required isRTL={isRTL} value={draft.executingAgency} onChange={(v) => setDraft((p) => ({ ...p, executingAgency: v }))} />
      </div>
      <div className="flex justify-center">
        <SaveBtn onClick={submit} isRTL={isRTL} />
      </div>
    </Modal>
  );
};

// ─── Section shell ────────────────────────────────────────────────────────

const SectionHeader = ({ title, onAdd, isRTL }: { title: string; onAdd: () => void; isRTL: boolean }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{title}</h3>
    <button
      type="button"
      onClick={onAdd}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
    >
      <Plus className="w-4 h-4" />
      {isRTL ? "إضافة" : "Add"}
    </button>
  </div>
);

const EmptyState = ({ message, onAdd, isRTL }: { message: string; onAdd: () => void; isRTL: boolean }) => (
  <div className="border border-dashed border-[var(--color-border)] rounded-xl py-6 flex flex-col items-center gap-3">
    <FolderPlus className="w-7 h-7 text-[var(--color-text-secondary)]" />
    <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>
    <button
      type="button"
      onClick={onAdd}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
    >
      <Plus className="w-4 h-4" />
      {isRTL ? "إضافة" : "Add"}
    </button>
  </div>
);

const Card = ({
  children,
  onEdit,
  onDelete,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) => (
  <div className="border border-[var(--color-border)] rounded-xl p-4 flex items-start justify-between gap-3 mb-3 bg-white">
    <div className="flex-1 min-w-0">{children}</div>
    <div className="flex flex-col gap-2 shrink-0">
      <button type="button" onClick={onEdit} className="p-1.5 rounded border border-[var(--color-border)] hover:bg-[var(--color-border-subtle)] transition-colors">
        <Pencil className="w-4 h-4 text-[var(--color-text-secondary)]" />
      </button>
      <button type="button" onClick={onDelete} className="p-1.5 rounded border border-[var(--color-border)] hover:bg-red-50 hover:border-red-200 transition-colors">
        <Trash2 className="w-4 h-4 text-red-500" />
      </button>
    </div>
  </div>
);

// Format ISO YYYY-MM-DD as MM/YYYY for compact card display
const formatMonthYear = (iso: string) => {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  return `${m}/${y}`;
};

// ─── Root component ───────────────────────────────────────────────────────

export default function ResumeBuilder({
  value,
  onChange,
  isRTL,
  professions,
  qualificationOptions,
  rankOptions,
}: ResumeBuilderProps) {
  // Derived once for card display (matching label by value)
  const professionOptions = professions.map((p) => ({ value: p.value, label: p.label }));
  const allSpecialtyOptions = professions.flatMap((p) =>
    (p.specialties || []).map((s) => ({ value: s.value, label: s.label })),
  );
  type ModalState =
    | { kind: "education"; index: number | null }
    | { kind: "research"; index: number | null }
    | { kind: "skill"; index: number | null }
    | { kind: "training"; index: number | null }
    | null;

  const [modal, setModal] = useState<ModalState>(null);

  // Lock body scroll while a modal is open
  useEffect(() => {
    if (modal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [modal]);

  const findLabel = (opts: Option[], v: string) => opts.find((o) => o.value === v)?.label || v;

  const todayIso = new Date().toISOString().slice(0, 10);

  // ── Education ──
  const upsertEducation = (entry: EducationEntry) => {
    const list = [...value.education];
    if (modal?.kind === "education" && modal.index !== null) list[modal.index] = entry;
    else list.push(entry);
    onChange({ ...value, education: list });
    setModal(null);
  };
  const deleteEducation = (i: number) => onChange({ ...value, education: value.education.filter((_, idx) => idx !== i) });

  // ── Skills ──
  const upsertSkill = (entry: ProfessionalSkillEntry) => {
    const list = [...value.professionalSkills];
    if (modal?.kind === "skill" && modal.index !== null) list[modal.index] = entry;
    else list.push(entry);
    onChange({ ...value, professionalSkills: list });
    setModal(null);
  };
  const deleteSkill = (i: number) => onChange({ ...value, professionalSkills: value.professionalSkills.filter((_, idx) => idx !== i) });

  // ── Research ──
  const upsertResearch = (entry: ScientificResearchEntry) => {
    const list = [...value.scientificResearches];
    if (modal?.kind === "research" && modal.index !== null) list[modal.index] = entry;
    else list.push(entry);
    onChange({ ...value, scientificResearches: list });
    setModal(null);
  };
  const deleteResearch = (i: number) => onChange({ ...value, scientificResearches: value.scientificResearches.filter((_, idx) => idx !== i) });

  // ── Training ──
  const upsertTraining = (entry: TrainingExperienceEntry) => {
    const list = [...value.trainingExperiences];
    if (modal?.kind === "training" && modal.index !== null) list[modal.index] = entry;
    else list.push(entry);
    onChange({ ...value, trainingExperiences: list });
    setModal(null);
  };
  const deleteTraining = (i: number) => onChange({ ...value, trainingExperiences: value.trainingExperiences.filter((_, idx) => idx !== i) });

  return (
    <div className="flex flex-col gap-6" dir={isRTL ? "rtl" : "ltr"}>
      {/* Education */}
      <section>
        <SectionHeader title={isRTL ? "التعليم" : "Education"} onAdd={() => setModal({ kind: "education", index: null })} isRTL={isRTL} />
        {value.education.length === 0 ? (
          <EmptyState message={isRTL ? "أضف معلومات التعليم إلى ملفك." : "Add Education to your profile."} onAdd={() => setModal({ kind: "education", index: null })} isRTL={isRTL} />
        ) : (
          value.education.map((e, i) => {
            const isFuture = e.graduationYear > todayIso;
            return (
              <Card key={i} onEdit={() => setModal({ kind: "education", index: i })} onDelete={() => deleteEducation(i)}>
                <p className="font-semibold text-[var(--color-text-primary)] truncate">{e.university}</p>
                <p className={`text-sm ${isFuture ? "text-red-500" : "text-[var(--color-primary)]"}`}>
                  {findLabel(qualificationOptions, e.qualification)} — {formatMonthYear(e.graduationYear)}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] truncate">
                  {findLabel(professionOptions, e.profession)} · {findLabel(allSpecialtyOptions, e.specialty)}
                </p>
              </Card>
            );
          })
        )}
      </section>

      {/* Professional Skills */}
      <section>
        <SectionHeader title={isRTL ? "المهارات المهنية" : "Professional Skills"} onAdd={() => setModal({ kind: "skill", index: null })} isRTL={isRTL} />
        {value.professionalSkills.length === 0 ? (
          <EmptyState message={isRTL ? "أضف مهاراتك المهنية." : "Add Professional Skills to your profile."} onAdd={() => setModal({ kind: "skill", index: null })} isRTL={isRTL} />
        ) : (
          value.professionalSkills.map((s, i) => (
            <Card key={i} onEdit={() => setModal({ kind: "skill", index: i })} onDelete={() => deleteSkill(i)}>
              <p className="font-semibold text-[var(--color-text-primary)] truncate">{s.placeOfWork}</p>
              <p className="text-sm text-[var(--color-primary)]">
                {s.type}{s.type === "Academic" && s.academicRank ? ` — ${findLabel(rankOptions, s.academicRank)}` : s.type === "Practical Experience" && s.natureOfWork ? ` — ${s.natureOfWork}` : ""}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {s.yearsOfExperience} {isRTL ? "سنوات خبرة" : `Year${s.yearsOfExperience === 1 ? "" : "s"} of Experience`}
              </p>
            </Card>
          ))
        )}
      </section>

      {/* Scientific Researches */}
      <section>
        <SectionHeader title={isRTL ? "الأبحاث العلمية" : "Scientific Researches"} onAdd={() => setModal({ kind: "research", index: null })} isRTL={isRTL} />
        {value.scientificResearches.length === 0 ? (
          <EmptyState message={isRTL ? "أضف أبحاثك العلمية." : "Add Scientific Researches to your profile."} onAdd={() => setModal({ kind: "research", index: null })} isRTL={isRTL} />
        ) : (
          value.scientificResearches.map((r, i) => (
            <Card key={i} onEdit={() => setModal({ kind: "research", index: i })} onDelete={() => deleteResearch(i)}>
              <p className="font-semibold text-[var(--color-text-primary)] truncate">{r.description}</p>
              <p className="text-sm text-[var(--color-primary)]">{r.type} · {r.role}</p>
            </Card>
          ))
        )}
      </section>

      {/* Training Experience */}
      <section>
        <SectionHeader title={isRTL ? "الخبرة التدريبية" : "Training Experience"} onAdd={() => setModal({ kind: "training", index: null })} isRTL={isRTL} />
        {value.trainingExperiences.length === 0 ? (
          <EmptyState message={isRTL ? "أضف خبراتك التدريبية." : "Add Training Experience to your profile."} onAdd={() => setModal({ kind: "training", index: null })} isRTL={isRTL} />
        ) : (
          value.trainingExperiences.map((t, i) => (
            <Card key={i} onEdit={() => setModal({ kind: "training", index: i })} onDelete={() => deleteTraining(i)}>
              <p className="font-semibold text-[var(--color-text-primary)] truncate">{t.eventName}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">{t.executingAgency}</p>
            </Card>
          ))
        )}
      </section>

      {/* Modals */}
      {modal?.kind === "education" && (
        <EducationModal
          initial={modal.index !== null ? value.education[modal.index] : null}
          isRTL={isRTL}
          professions={professions}
          qualificationOptions={qualificationOptions}
          onSave={upsertEducation}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "research" && (
        <ScientificResearchModal
          initial={modal.index !== null ? value.scientificResearches[modal.index] : null}
          isRTL={isRTL}
          onSave={upsertResearch}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "skill" && (
        <ProfessionalSkillModal
          initial={modal.index !== null ? value.professionalSkills[modal.index] : null}
          isRTL={isRTL}
          rankOptions={rankOptions}
          onSave={upsertSkill}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === "training" && (
        <TrainingExperienceModal
          initial={modal.index !== null ? value.trainingExperiences[modal.index] : null}
          isRTL={isRTL}
          onSave={upsertTraining}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
