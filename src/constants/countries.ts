export const COUNTRIES = [
  { value: "Norway", label: "🇳🇴 Norway", flag: "🇳🇴" },
  { value: "Germany", label: "🇩🇪 Germany", flag: "🇩🇪" },
  { value: "Austria", label: "🇦🇹 Austria", flag: "🇦🇹" },
  { value: "Switzerland", label: "🇨🇭 Switzerland", flag: "🇨🇭" },
  { value: "Netherlands", label: "🇳🇱 Netherlands", flag: "🇳🇱" },
  { value: "Iceland", label: "🇮🇸 Iceland", flag: "🇮🇸" },
  { value: "Poland", label: "🇵🇱 Poland", flag: "🇵🇱" },
  { value: "Canada", label: "🇨🇦 Canada", flag: "🇨🇦" },
  { value: "Australia", label: "🇦🇺 Australia", flag: "🇦🇺" },
  { value: "New Zealand", label: "🇳🇿 New Zealand", flag: "🇳🇿" },
  { value: "Italy", label: "🇮🇹 Italy", flag: "🇮🇹" },
  { value: "France", label: "🇫🇷 France", flag: "🇫🇷" },
  { value: "Greece", label: "🇬🇷 Greece", flag: "🇬🇷" },
  { value: "Great Britain", label: "🇬🇧 Great Britain", flag: "🇬🇧" },
  { value: "Ireland", label: "🇮🇪 Ireland", flag: "🇮🇪" },
  { value: "Sweden", label: "🇸🇪 Sweden", flag: "🇸🇪" },
  { value: "Denmark", label: "🇩🇰 Denmark", flag: "🇩🇰" },
  { value: "Finland", label: "🇫🇮 Finland", flag: "🇫🇮" },
  { value: "Belgium", label: "🇧🇪 Belgium", flag: "🇧🇪" },
  { value: "Luxembourg", label: "🇱🇺 Luxembourg", flag: "🇱🇺" },
  { value: "Czech Republic", label: "🇨🇿 Czech Republic", flag: "🇨🇿" },
  { value: "Slovakia", label: "🇸🇰 Slovakia", flag: "🇸🇰" },
  { value: "Hungary", label: "🇭🇺 Hungary", flag: "🇭🇺" },
  { value: "Spain", label: "🇪🇸 Spain", flag: "🇪🇸" },
  { value: "Portugal", label: "🇵🇹 Portugal", flag: "🇵🇹" },
  { value: "USA", label: "🇺🇸 USA", flag: "🇺🇸" },
  { value: "United Arab Emirates", label: "🇦🇪 UAE", flag: "🇦🇪" },
  { value: "Singapore", label: "🇸🇬 Singapore", flag: "🇸🇬" },
  { value: "Japan", label: "🇯🇵 Japan", flag: "🇯🇵" },
  { value: "Qatar", label: "🇶🇦 Qatar", flag: "🇶🇦" },
  { value: "Remote", label: "🌍 Remote", flag: "🌍" },
];

export const COUNTRY_FLAGS: Record<string, string> = Object.fromEntries(
  COUNTRIES.map(c => [c.value, c.flag])
);

/** Map country to its primary native language */
export const COUNTRY_NATIVE_LANGUAGES: Record<string, string> = {
  "Norway": "Norwegian",
  "Germany": "German",
  "Austria": "German",
  "Switzerland": "German",
  "Netherlands": "Dutch",
  "Iceland": "Icelandic",
  "Poland": "Polish",
  "Canada": "English",
  "Australia": "English",
  "New Zealand": "English",
  "Italy": "Italian",
  "France": "French",
  "Greece": "Greek",
  "Great Britain": "English",
  "Ireland": "English",
  "Sweden": "Swedish",
  "Denmark": "Danish",
  "Finland": "Finnish",
  "Belgium": "French",
  "Luxembourg": "French",
  "Czech Republic": "Czech",
  "Slovakia": "Slovak",
  "Hungary": "Hungarian",
  "Spain": "Spanish",
  "Portugal": "Portuguese",
  "USA": "English",
  "United Arab Emirates": "Arabic",
  "Singapore": "English",
  "Japan": "Japanese",
  "Qatar": "Arabic",
};

/** Available languages for native language dropdown */
export const NATIVE_LANGUAGES = [
  "Arabic", "Czech", "Danish", "Dutch", "English", "Finnish", "French",
  "German", "Greek", "Hungarian", "Icelandic", "Italian", "Japanese",
  "Norwegian", "Polish", "Portuguese", "Romanian", "Russian", "Serbian",
  "Slovak", "Spanish", "Swedish", "Turkish", "Ukrainian", "Vietnamese",
];

/** App display languages */
export const APP_LANGUAGES = [
  { value: "en", label: "🇬🇧 English" },
  { value: "cs", label: "🇨🇿 Čeština" },
  { value: "de", label: "🇩🇪 Deutsch" },
  { value: "pl", label: "🇵🇱 Polski" },
  { value: "sk", label: "🇸🇰 Slovenčina" },
];
