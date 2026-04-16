/**
 * Saudi Arabia cities for session/venue selection.
 * Ordered by population. Arabic names for bilingual UI.
 */
export interface SaudiCity {
  value: string; // canonical English name (stored in DB)
  labelEn: string;
  labelAr: string;
}

export const SAUDI_CITIES: SaudiCity[] = [
  { value: "Riyadh", labelEn: "Riyadh", labelAr: "الرياض" },
  { value: "Jeddah", labelEn: "Jeddah", labelAr: "جدة" },
  { value: "Mecca", labelEn: "Mecca", labelAr: "مكة المكرمة" },
  { value: "Medina", labelEn: "Medina", labelAr: "المدينة المنورة" },
  { value: "Dammam", labelEn: "Dammam", labelAr: "الدمام" },
  { value: "Khobar", labelEn: "Khobar", labelAr: "الخبر" },
  { value: "Dhahran", labelEn: "Dhahran", labelAr: "الظهران" },
  { value: "Taif", labelEn: "Taif", labelAr: "الطائف" },
  { value: "Tabuk", labelEn: "Tabuk", labelAr: "تبوك" },
  { value: "Buraydah", labelEn: "Buraydah", labelAr: "بريدة" },
  { value: "Khamis Mushait", labelEn: "Khamis Mushait", labelAr: "خميس مشيط" },
  { value: "Hail", labelEn: "Hail", labelAr: "حائل" },
  { value: "Jubail", labelEn: "Jubail", labelAr: "الجبيل" },
  { value: "Abha", labelEn: "Abha", labelAr: "أبها" },
  { value: "Najran", labelEn: "Najran", labelAr: "نجران" },
  { value: "Yanbu", labelEn: "Yanbu", labelAr: "ينبع" },
  { value: "Qatif", labelEn: "Qatif", labelAr: "القطيف" },
  { value: "Hafar Al-Batin", labelEn: "Hafar Al-Batin", labelAr: "حفر الباطن" },
  { value: "Jazan", labelEn: "Jazan", labelAr: "جازان" },
  { value: "Al Kharj", labelEn: "Al Kharj", labelAr: "الخرج" },
  { value: "Arar", labelEn: "Arar", labelAr: "عرعر" },
  { value: "Sakaka", labelEn: "Sakaka", labelAr: "سكاكا" },
  { value: "Al-Qassim", labelEn: "Al-Qassim", labelAr: "القصيم" },
  { value: "Al-Bahah", labelEn: "Al-Bahah", labelAr: "الباحة" },
];

export function getCityLabel(value: string | null | undefined, locale: string = "en"): string {
  if (!value) return "";
  const city = SAUDI_CITIES.find((c) => c.value === value);
  if (!city) return value;
  return locale === "ar" ? city.labelAr : city.labelEn;
}
