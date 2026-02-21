"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, Pencil, ChevronUp, ChevronDown, Video, FileText, HelpCircle, Layers } from "lucide-react";
import type { WizardState, WizardAction, WizardModule } from "./CreateCourseWizard";

interface Step3Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

const MODULE_TYPES = ["video", "document", "quiz", "mixed"] as const;

const typeIcons: Record<string, React.ReactNode> = {
  video: <Video className="w-4 h-4" />,
  document: <FileText className="w-4 h-4" />,
  quiz: <HelpCircle className="w-4 h-4" />,
  mixed: <Layers className="w-4 h-4" />,
};

const emptyForm = { title: "", titleAr: "", type: "video", durationMinutes: "" as number | "" };

const Step3Modules = ({ state, dispatch }: Step3Props) => {
  const t = useTranslations("instructorDashboard.createCourse");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!form.title.trim()) return;
    if (editingId) {
      dispatch({
        type: "UPDATE_MODULE",
        tempId: editingId,
        data: {
          title: form.title.trim(),
          titleAr: form.titleAr.trim(),
          type: form.type,
          durationMinutes: form.durationMinutes,
        },
      });
      setEditingId(null);
    } else {
      dispatch({
        type: "ADD_MODULE",
        module: {
          tempId: crypto.randomUUID(),
          title: form.title.trim(),
          titleAr: form.titleAr.trim(),
          type: form.type,
          durationMinutes: form.durationMinutes,
        },
      });
    }
    setForm(emptyForm);
  };

  const handleEdit = (mod: WizardModule) => {
    setEditingId(mod.tempId);
    setForm({
      title: mod.title,
      titleAr: mod.titleAr,
      type: mod.type,
      durationMinutes: mod.durationMinutes,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleReorder = (index: number, direction: "up" | "down") => {
    const modules = [...state.modules];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= modules.length) return;
    [modules[index], modules[swapIndex]] = [modules[swapIndex], modules[index]];
    dispatch({ type: "REORDER_MODULES", modules });
  };

  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
      <h2 className="text-lg font-semibold text-[#1F2937] mb-1">
        {t("wizardStep3")}
      </h2>
      <p className="text-sm text-[#6B7280] mb-4">{t("modulesHint")}</p>

      {/* Module Form */}
      <div className="border border-[#E5E7EB] rounded-lg p-4 mb-4 bg-[#F9FAFB]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("moduleTitle")} *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("moduleTitleAr")}
            </label>
            <input
              type="text"
              dir="rtl"
              value={form.titleAr}
              onChange={(e) => setForm((f) => ({ ...f, titleAr: e.target.value }))}
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("moduleType")}
            </label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent bg-white"
            >
              {MODULE_TYPES.map((mType) => (
                <option key={mType} value={mType}>
                  {t(`moduleTypes.${mType}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              {t("moduleDuration")}
            </label>
            <input
              type="number"
              min={0}
              value={form.durationMinutes}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  durationMinutes: e.target.value ? parseInt(e.target.value) : "",
                }))
              }
              placeholder="60"
              className="w-full px-3 py-2 border border-[#D1D5DB] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="px-4 py-2 text-sm text-[#6B7280] hover:text-[#1F2937] transition-colors"
            >
              {t("cancel")}
            </button>
          )}
          <button
            type="button"
            onClick={handleAdd}
            disabled={!form.title.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#3B82F6] text-white text-sm font-medium rounded-lg hover:bg-[#2563EB] disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {editingId ? t("updateModule") : t("addModule")}
          </button>
        </div>
      </div>

      {/* Module List */}
      {state.modules.length === 0 ? (
        <div className="text-center py-8 text-sm text-[#9CA3AF]">
          {t("noModulesAdded")}
        </div>
      ) : (
        <div className="space-y-2">
          {state.modules.map((mod, idx) => (
            <div
              key={mod.tempId}
              className={`flex items-center gap-3 p-3 border rounded-lg ${
                editingId === mod.tempId
                  ? "border-[#3B82F6] bg-[#EFF6FF]"
                  : "border-[#E5E7EB]"
              }`}
            >
              <span className="text-sm font-medium text-[#9CA3AF] w-6 text-center">
                {idx + 1}
              </span>
              <span className="text-[#6B7280]">{typeIcons[mod.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1F2937] truncate">
                  {mod.title}
                </p>
                <p className="text-xs text-[#6B7280]">
                  {t(`moduleTypes.${mod.type}`)}
                  {mod.durationMinutes ? ` \u00B7 ${mod.durationMinutes} min` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleReorder(idx, "up")}
                  disabled={idx === 0}
                  className="p-1 text-[#9CA3AF] hover:text-[#1F2937] disabled:opacity-30"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleReorder(idx, "down")}
                  disabled={idx === state.modules.length - 1}
                  className="p-1 text-[#9CA3AF] hover:text-[#1F2937] disabled:opacity-30"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleEdit(mod)}
                  className="p-1 text-[#6B7280] hover:text-[#3B82F6]"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "REMOVE_MODULE", tempId: mod.tempId })}
                  className="p-1 text-[#6B7280] hover:text-[#EF4444]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Step3Modules;
