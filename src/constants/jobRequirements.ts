export const LANGUAGES = [
  { value: "english", label: "English" },
  { value: "german", label: "German" },
  { value: "norwegian", label: "Norwegian" },
  { value: "swedish", label: "Swedish" },
  { value: "danish", label: "Danish" },
  { value: "french", label: "French" },
  { value: "polish", label: "Polish" },
  { value: "czech", label: "Czech" },
  { value: "slovak", label: "Slovak" },
  { value: "hungarian", label: "Hungarian" },
];

export const LANGUAGE_LEVELS = [
  { value: "A1", label: "A1 – Basic understanding" },
  { value: "A2", label: "A2 – Basic communication" },
  { value: "B1", label: "B1 – Independent communication" },
  { value: "B2", label: "B2 – Professional working proficiency" },
  { value: "C1", label: "C1 – Advanced / fluent" },
];

export const EXPERIENCE_LEVELS = [
  { value: "any", label: "Any experience" },
  { value: "no_experience", label: "No experience (entry-level)" },
  { value: "6_months", label: "Minimum 6 months" },
  { value: "1_year", label: "Minimum 1 year" },
  { value: "2_years", label: "2+ years" },
  { value: "3_5_years", label: "3–5 years (senior)" },
];

export const PROFESSION_CATEGORIES = [
  { value: "developer", label: "💻 Developer / IT" },
  { value: "designer", label: "🎨 Designer / UX" },
  { value: "waiter", label: "🍽 Waiter / Waitress" },
  { value: "cook", label: "🍳 Cook / Chef" },
  { value: "construction", label: "🏗 Construction Worker" },
  { value: "driver", label: "🚚 Driver (Truck / Delivery)" },
  { value: "hotel_staff", label: "🏨 Hotel & Support Services" },
  { value: "warehouse", label: "📦 Warehouse / Logistics" },
  { value: "agriculture", label: "🌾 Agriculture / Farm Work" },
  { value: "customer_support", label: "📞 Customer Support" },
  { value: "teacher", label: "📚 Teacher / Education" },
  { value: "other", label: "Other" },
];

export const JOB_BONUSES = [
  { value: "accommodation", label: "🏠 Accommodation provided" },
  { value: "food", label: "🍽 Food / Meals at workplace" },
  { value: "company_car", label: "🚗 Company car" },
  { value: "travel_allowance", label: "✈️ Travel allowance" },
  { value: "health_insurance", label: "🏥 Health insurance" },
  { value: "training", label: "📚 Training & Courses" },
  { value: "relocation_support", label: "🏡 Relocation support" },
  { value: "performance_bonus", label: "💰 Performance bonus" },
  { value: "remote_work", label: "🏠 Remote work option" },
  { value: "flexible_hours", label: "⏰ Flexible hours" },
];

export interface LanguageFilter {
  language: string;
  level: string;
}
