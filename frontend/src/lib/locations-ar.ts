/**
 * Arabic localization for the country / state / city dropdowns.
 *
 * - Country names: i18n-iso-countries (full coverage of all 250 countries)
 * - States + cities: curated map for KSA + GCC + major Arabic-speaking
 *   countries. Outside this map we fall back to the English name from
 *   country-state-city, which is the standard in regional applications.
 */

import countries from "i18n-iso-countries";
import arLocale from "i18n-iso-countries/langs/ar.json";

countries.registerLocale(arLocale);

/** Country ISO-2 → Arabic name (covers 250 countries) */
export function arCountryName(iso: string, fallback: string): string {
  const name = countries.getName(iso, "ar");
  return name || fallback;
}

/**
 * State name lookup. We key by `${countryIso}:${stateName}` (English name
 * as it comes from country-state-city). Only Arabic-speaking countries
 * are populated; everything else returns `fallback`.
 */
const STATE_AR: Record<string, string> = {
  // ── Saudi Arabia (13 regions) ────────────────────────────────
  "SA:Al Bahah": "الباحة",
  "SA:Al-Bahah": "الباحة",
  "SA:Al Jawf": "الجوف",
  "SA:Al-Jawf": "الجوف",
  "SA:Al Madinah": "المدينة المنورة",
  "SA:Al Madinah Region": "المدينة المنورة",
  "SA:Al Qasim": "القصيم",
  "SA:Al-Qassim": "القصيم",
  "SA:Asir": "عسير",
  "SA:'Asir": "عسير",
  "SA:Eastern Province": "المنطقة الشرقية",
  "SA:Ha'il": "حائل",
  "SA:Hail": "حائل",
  "SA:Jazan": "جازان",
  "SA:Jizan": "جازان",
  "SA:Makkah": "مكة المكرمة",
  "SA:Makkah Region": "مكة المكرمة",
  "SA:Najran": "نجران",
  "SA:Northern Borders": "الحدود الشمالية",
  "SA:Riyadh": "الرياض",
  "SA:Riyadh Province": "الرياض",
  "SA:Tabuk": "تبوك",

  // ── UAE (7 emirates) ─────────────────────────────────────────
  "AE:Abu Dhabi": "أبوظبي",
  "AE:Ajman": "عجمان",
  "AE:Dubai": "دبي",
  "AE:Fujairah": "الفجيرة",
  "AE:Ras Al Khaimah": "رأس الخيمة",
  "AE:Ras al-Khaimah": "رأس الخيمة",
  "AE:Sharjah": "الشارقة",
  "AE:Umm Al Quwain": "أم القيوين",
  "AE:Umm al-Quwain": "أم القيوين",

  // ── Bahrain ──────────────────────────────────────────────────
  "BH:Capital": "العاصمة",
  "BH:Capital Governorate": "العاصمة",
  "BH:Muharraq": "المحرق",
  "BH:Northern": "الشمالية",
  "BH:Southern": "الجنوبية",

  // ── Kuwait ───────────────────────────────────────────────────
  "KW:Al Ahmadi": "الأحمدي",
  "KW:Al-Ahmadi": "الأحمدي",
  "KW:Al Asimah": "العاصمة",
  "KW:Al Farwaniyah": "الفروانية",
  "KW:Al Jahra": "الجهراء",
  "KW:Hawalli": "حولي",
  "KW:Mubarak Al-Kabeer": "مبارك الكبير",

  // ── Qatar ────────────────────────────────────────────────────
  "QA:Ad Dawhah": "الدوحة",
  "QA:Doha": "الدوحة",
  "QA:Al Khor": "الخور",
  "QA:Al Rayyan": "الريان",
  "QA:Al Wakrah": "الوكرة",
  "QA:Al-Daayen": "الضعاين",
  "QA:Madinat ash Shamal": "مدينة الشمال",
  "QA:Umm Salal": "أم صلال",

  // ── Oman ─────────────────────────────────────────────────────
  "OM:Ad Dakhiliyah": "الداخلية",
  "OM:Ad Dhahirah": "الظاهرة",
  "OM:Al Batinah North": "شمال الباطنة",
  "OM:Al Batinah South": "جنوب الباطنة",
  "OM:Al Buraymi": "البريمي",
  "OM:Al Wusta": "الوسطى",
  "OM:Ash Sharqiyah North": "شمال الشرقية",
  "OM:Ash Sharqiyah South": "جنوب الشرقية",
  "OM:Dhofar": "ظفار",
  "OM:Musandam": "مسندم",
  "OM:Muscat": "مسقط",

  // ── Egypt (top governorates) ─────────────────────────────────
  "EG:Cairo": "القاهرة",
  "EG:Giza": "الجيزة",
  "EG:Alexandria": "الإسكندرية",
  "EG:Aswan": "أسوان",
  "EG:Asyut": "أسيوط",
  "EG:Beheira": "البحيرة",
  "EG:Beni Suef": "بني سويف",
  "EG:Dakahlia": "الدقهلية",
  "EG:Damietta": "دمياط",
  "EG:Faiyum": "الفيوم",
  "EG:Gharbia": "الغربية",
  "EG:Ismailia": "الإسماعيلية",
  "EG:Kafr el-Sheikh": "كفر الشيخ",
  "EG:Luxor": "الأقصر",
  "EG:Matrouh": "مطروح",
  "EG:Minya": "المنيا",
  "EG:Monufia": "المنوفية",
  "EG:New Valley": "الوادي الجديد",
  "EG:North Sinai": "شمال سيناء",
  "EG:Port Said": "بورسعيد",
  "EG:Qalyubia": "القليوبية",
  "EG:Qena": "قنا",
  "EG:Red Sea": "البحر الأحمر",
  "EG:Sharqia": "الشرقية",
  "EG:Sohag": "سوهاج",
  "EG:South Sinai": "جنوب سيناء",
  "EG:Suez": "السويس",

  // ── Jordan ───────────────────────────────────────────────────
  "JO:Amman": "عمان",
  "JO:Aqaba": "العقبة",
  "JO:Balqa": "البلقاء",
  "JO:Irbid": "إربد",
  "JO:Jerash": "جرش",
  "JO:Karak": "الكرك",
  "JO:Ma'an": "معان",
  "JO:Madaba": "مادبا",
  "JO:Mafraq": "المفرق",
  "JO:Tafilah": "الطفيلة",
  "JO:Zarqa": "الزرقاء",
};

/**
 * City name lookup. Same `${countryIso}:${cityName}` key. Only major cities
 * for KSA + GCC seeded — adding more is just adding rows here.
 */
const CITY_AR: Record<string, string> = {
  // ── Saudi Arabia ─────────────────────────────────────────────
  "SA:Riyadh": "الرياض",
  "SA:Jeddah": "جدة",
  "SA:Mecca": "مكة المكرمة",
  "SA:Makkah": "مكة المكرمة",
  "SA:Medina": "المدينة المنورة",
  "SA:Madinah": "المدينة المنورة",
  "SA:Dammam": "الدمام",
  "SA:Khobar": "الخبر",
  "SA:Al Khobar": "الخبر",
  "SA:Dhahran": "الظهران",
  "SA:Tabuk": "تبوك",
  "SA:Buraidah": "بريدة",
  "SA:Khamis Mushait": "خميس مشيط",
  "SA:Hail": "حائل",
  "SA:Ha'il": "حائل",
  "SA:Najran": "نجران",
  "SA:Jazan": "جازان",
  "SA:Jizan": "جازان",
  "SA:Yanbu": "ينبع",
  "SA:Abha": "أبها",
  "SA:Sakaka": "سكاكا",
  "SA:Arar": "عرعر",
  "SA:Al Bahah": "الباحة",
  "SA:Taif": "الطائف",
  "SA:Al Taif": "الطائف",
  "SA:Hofuf": "الهفوف",
  "SA:Al-Hofuf": "الهفوف",
  "SA:Qatif": "القطيف",
  "SA:Jubail": "الجبيل",

  // ── UAE ──────────────────────────────────────────────────────
  "AE:Abu Dhabi": "أبوظبي",
  "AE:Dubai": "دبي",
  "AE:Sharjah": "الشارقة",
  "AE:Ajman": "عجمان",
  "AE:Fujairah": "الفجيرة",
  "AE:Ras Al Khaimah": "رأس الخيمة",
  "AE:Ras al-Khaimah": "رأس الخيمة",
  "AE:Umm Al Quwain": "أم القيوين",
  "AE:Al Ain": "العين",

  // ── Bahrain ──────────────────────────────────────────────────
  "BH:Manama": "المنامة",
  "BH:Muharraq": "المحرق",
  "BH:Riffa": "الرفاع",
  "BH:Hamad Town": "مدينة حمد",
  "BH:Isa Town": "مدينة عيسى",
  "BH:Sitra": "سترة",

  // ── Kuwait ───────────────────────────────────────────────────
  "KW:Kuwait City": "مدينة الكويت",
  "KW:Al Ahmadi": "الأحمدي",
  "KW:Hawalli": "حولي",
  "KW:Salmiya": "السالمية",
  "KW:Jahra": "الجهراء",
  "KW:Farwaniya": "الفروانية",
  "KW:Fahaheel": "الفحيحيل",

  // ── Qatar ────────────────────────────────────────────────────
  "QA:Doha": "الدوحة",
  "QA:Al Rayyan": "الريان",
  "QA:Al Wakrah": "الوكرة",
  "QA:Al Khor": "الخور",
  "QA:Mesaieed": "مسيعيد",

  // ── Oman ─────────────────────────────────────────────────────
  "OM:Muscat": "مسقط",
  "OM:Salalah": "صلالة",
  "OM:Sohar": "صحار",
  "OM:Nizwa": "نزوى",
  "OM:Sur": "صور",
  "OM:Ibri": "عبري",

  // ── Egypt (major cities) ─────────────────────────────────────
  "EG:Cairo": "القاهرة",
  "EG:Alexandria": "الإسكندرية",
  "EG:Giza": "الجيزة",
  "EG:Shubra El Kheima": "شبرا الخيمة",
  "EG:Port Said": "بورسعيد",
  "EG:Suez": "السويس",
  "EG:Luxor": "الأقصر",
  "EG:Aswan": "أسوان",
  "EG:Tanta": "طنطا",
  "EG:Mansoura": "المنصورة",
  "EG:Asyut": "أسيوط",
  "EG:Ismailia": "الإسماعيلية",
  "EG:Faiyum": "الفيوم",
  "EG:Zagazig": "الزقازيق",
  "EG:Damietta": "دمياط",

  // ── Jordan ───────────────────────────────────────────────────
  "JO:Amman": "عمان",
  "JO:Zarqa": "الزرقاء",
  "JO:Irbid": "إربد",
  "JO:Aqaba": "العقبة",
  "JO:Salt": "السلط",
  "JO:Madaba": "مادبا",
  "JO:Mafraq": "المفرق",
  "JO:Karak": "الكرك",
};

export function arStateName(countryIso: string, englishName: string): string {
  return STATE_AR[`${countryIso}:${englishName}`] || englishName;
}

export function arCityName(countryIso: string, englishName: string): string {
  return CITY_AR[`${countryIso}:${englishName}`] || englishName;
}
