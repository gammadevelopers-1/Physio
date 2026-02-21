"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

interface WizardStepIndicatorProps {
  currentStep: 1 | 2 | 3 | 4;
}

const WizardStepIndicator = ({ currentStep }: WizardStepIndicatorProps) => {
  const t = useTranslations("instructorDashboard.createCourse");

  const steps = [
    { number: 1, label: t("wizardStep1") },
    { number: 2, label: t("wizardStep2") },
    { number: 3, label: t("wizardStep3") },
    { number: 4, label: t("wizardStep4") },
  ];

  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, idx) => {
        const isCompleted = currentStep > step.number;
        const isCurrent = currentStep === step.number;

        return (
          <div key={step.number} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  isCompleted
                    ? "bg-[#22C55E] text-white"
                    : isCurrent
                      ? "bg-[#3B82F6] text-white"
                      : "bg-[#E5E7EB] text-[#9CA3AF]"
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium text-center whitespace-nowrap ${
                  isCurrent ? "text-[#3B82F6]" : isCompleted ? "text-[#22C55E]" : "text-[#9CA3AF]"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-3 mt-[-1rem] ${
                  currentStep > step.number ? "bg-[#22C55E]" : "bg-[#E5E7EB]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default WizardStepIndicator;
