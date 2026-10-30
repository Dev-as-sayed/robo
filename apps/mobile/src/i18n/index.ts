import { getLocales } from "expo-localization";
import { I18nManager } from "react-native";
import { useAppSelector } from "@/store";

I18nManager.allowRTL(true);

export const supportedLocales = ["en", "hi"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];

const en = {
  "nav.today": "Today",
  "nav.chat": "Chat",
  "nav.tasks": "Tasks",
  "nav.insights": "Insights",
  "nav.settings": "Settings",

  "app.error": "Error",
  "app.cancel": "Cancel",
  "app.confirm": "Confirm",
  "app.send": "Send",
  "app.stop": "Stop",
  "app.loading": "Loading",
  "app.refresh": "Refresh",
  "app.no_data": "No data available",
  "app.empty_state": "Nothing here yet",

  "chat.send": "Send",
  "chat.stop": "Stop",
  "chat.placeholder": "Ask Robo...",
  "chat.new_chat": "New chat",
  "chat.history": "History",

  "approvals.title": "APPROVALS",
  "approvals.nothing_waiting": "Nothing waiting for approval.",
  "approvals.prepare_call": "Prepare call",
  "approvals.prepare_message": "Prepare message",
  "approvals.call": "Call",
  "approvals.text": "Text",
  "approvals.email": "Email",
  "approvals.whatsapp": "WhatsApp",

  "exam.activate": "Activate",
  "exam.recalculate": "Recalculate",
  "exam.plan": "Study plan",
  "exam.revision_summary": "Revision summary",

  "settings.title": "Settings",
  "settings.quiet_hours": "Quiet hours",
  "settings.wake_phrase": "Wake phrase",
  "settings.nudges": "Nudges (0-20 per day)",
  "settings.cloud_ai_docs": "Cloud AI for documents",
  "settings.export": "Export",
  "settings.delete_account": "Delete account",
  "settings.sign_out": "Sign out",

  "tasks.title": "Tasks",
  "tasks.no_tasks": "No tasks",
  "tasks.create": "Create task",
  "tasks.priority.high": "High",
  "tasks.priority.medium": "Medium",
  "tasks.priority.low": "Low",

  "reminders.title": "Reminders",
  "reminders.snooze": "Snooze",
  "reminders.channels": "Channels",

  "schedule.title": "Schedule",
  "schedule.skip_today": "Skip today",
  "schedule.no_entries": "No classes scheduled",
  "schedule.delete_entry": "Delete entry",
  "schedule.no_scheduled": "Nothing scheduled.",
  "schedule.add_first_class_below": "Add your first class or event below.",
  "schedule.skip": "Skip",
  "schedule.undo_skip": "Undo skip",
  "schedule.delete": "Delete",
  "schedule.save_changes": "Save changes",
  "schedule.add_entry": "Add entry",
  "schedule.refresh": "Refresh",

  "insights.title": "Insights",
  "insights.no_data": "No data available",
  "insights.study_minutes": "Study minutes",
  "insights.completed_tasks": "Tasks completed",
  "insights.completed_quizzes": "Quizzes completed",
  "insights.upcoming_exams": "Upcoming exams",
  "insights.day_streak": "Day streak",

  "documents.title": "Documents",
  "documents.upload": "Upload",
  "documents.no_documents": "No documents",
  "documents.parsing": "Parsing…",
  "documents.ocr": "OCR…",
  "documents.chunking": "Chunking…",
  "documents.embedding": "Embedding…",
  "documents.indexed": "Indexed",
  "documents.failed": "Failed",

  "profile.name": "Name",
  "profile.locale": "Locale",
  "profile.quiet_hours": "Quiet hours",
  "profile.nudges": "Nudges per day",

  "voice.title": "Voice",
  "voice.no_pairing": "No device paired",
  "voice.pairing_code": "Pairing code",
};

type TranslationKey = keyof typeof en;

const hi: Record<TranslationKey, string> = {
  "nav.today": "आज",
  "nav.chat": "चैट",
  "nav.tasks": "काम",
  "nav.insights": "जानकारी",
  "nav.settings": "सेटिंग्स",

  "app.error": "त्रुटि",
  "app.cancel": "रद्द करें",
  "app.confirm": "पुष्टि करें",
  "app.send": "भेजें",
  "app.stop": "रोकें",
  "app.loading": "लोड हो रहा है",
  "app.refresh": "ताज़ा करें",
  "app.no_data": "कोई डेटा उपलब्ध नहीं",
  "app.empty_state": "यहां कुछ नहीं है",

  "chat.send": "भेजें",
  "chat.stop": "रोकें",
  "chat.placeholder": "रोबो से पूछें...",
  "chat.new_chat": "नई चैट",
  "chat.history": "इतिहास",

  "approvals.title": "पुष्टि करें",
  "approvals.nothing_waiting": "के लिए प्रतीक्षा करने के लिए कुछ नहीं।",
  "approvals.prepare_call": "कॉल prepare करें",
  "approvals.prepare_message": "संदेश prepare करें",
  "approvals.call": "कॉल करें",
  "approvals.text": "टेक्स्ट करें",
  "approvals.email": "ईमेल करें",
  "approvals.whatsapp": "व्हाट्सएप करें",

  "exam.activate": "प्रभावी करें",
  "exam.recalculate": "रीकैलकुलेट करें",
  "exam.plan": "अध्ययन योजना",
  "exam.revision_summary": "रीजन विवरण",

  "settings.title": "सेटिंग्स",
  "settings.quiet_hours": "शांत घंटे",
  "settings.wake_phrase": "जागृत वाक्य",
  "settings.nudges": "दिन में 0-20 नडल्स",
  "settings.cloud_ai_docs": "डॉक के लिए क्लाउड AI",
  "settings.export": "निर्यात करें",
  "settings.delete_account": "खाता हटाएं",
  "settings.sign_out": "साइन आउट करें",

  "tasks.title": "कार्य",
  "tasks.no_tasks": "नहीं कोई कार्य",
  "tasks.create": "कार्य बनाएं",
  "tasks.priority.high": "उच्च",
  "tasks.priority.medium": "मध्यम",
  "tasks.priority.low": "निम्न",

  "reminders.title": "याद दिलाएं",
  "reminders.snooze": "डु ऑफ करें",
  "reminders.channels": "चैनल्स",

  "schedule.title": "क्रम",
  "schedule.skip_today": "आज छोड़ें",
  "schedule.no_entries": "कोई कक्षाएं निर्धारित नहीं",
  "schedule.delete_entry": "एंट्री हटाएं",
  "schedule.no_scheduled": "कोई शेड्यूल नहीं",
  "schedule.add_first_class_below": "अपनी पहली कक्षा या evento जोड़ें नीचे",
  "schedule.skip": "छोड़ें",
  "schedule.undo_skip": "स्किप रद्द करें",
  "schedule.delete": "हटाएं",
  "schedule.save_changes": "बदलाव बचाएं",
  "schedule.add_entry": "एंट्री जोड़ें",
  "schedule.refresh": "ताज़ा करें",

  "insights.title": "आकर्षण",
  "insights.no_data": "कोई डेटा उपलब्ध नहीं",
  "insights.study_minutes": "अध्ययन मिनट",
  "insights.completed_tasks": "पूर्ण किए गए कार्य",
  "insights.completed_quizzes": "पूर्ण किए गए क्विज",
  "insights.upcoming_exams": "आगामी परीक्षाएं",
  "insights.day_streak": "दिन की कड़ी",

  "documents.title": "दस्तावेज",
  "documents.upload": "अपलोड करें",
  "documents.no_documents": "नहीं कोई दस्तावेज",
  "documents.parsing": "पार्सिंग…",
  "documents.ocr": "OCR…",
  "documents.chunking": "चंकिंग…",
  "documents.embedding": "एम्बेडिंग…",
  "documents.indexed": "इंडेक्स किया गया",
  "documents.failed": "पक्षित",

  "profile.name": "नाम",
  "profile.locale": "स्थान",
  "profile.quiet_hours": "शांत घंटे",
  "profile.nudges": "दिन में नेडल्स",

  "voice.title": "आवाज़",
  "voice.no_pairing": "डिवाइस pairing नहीं",
  "voice.pairing_code": "पेयरिंग कोड",
};

type TranslationKey = keyof typeof en;

const dictionaries: Record<SupportedLocale, Record<TranslationKey, string>> = {
  en,
  hi,
};

function deviceLocale(): string {
  return getLocales()[0]?.languageCode ?? "en";
}

export function normalizeLocale(locale: string | null | undefined): SupportedLocale {
  const primary = (locale ?? deviceLocale()).toLowerCase().split(/[-_]/)[0];
  return primary === "hi" ? "hi" : "en";
}

export function translate(
  locale: string | null | undefined,
  key: TranslationKey
): string {
  return dictionaries[normalizeLocale(locale)][key];
}

export function textDirection(locale: string | null | undefined): "ltr" | "rtl" {
  return /^(ar|fa|he|ur)([-_]|$)/i.test(locale ?? "") ? "rtl" : "ltr";
}

export function useTranslation() {
  const locale = useAppSelector(state => state.auth.user?.locale);
  return {
    locale: normalizeLocale(locale),
    direction: textDirection(locale),
    t: (key: TranslationKey): string => translate(locale, key),
  };
}
