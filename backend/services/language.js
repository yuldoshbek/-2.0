const replacements = [
  [/геологический отдел|геология/gi, "Geologiya bo‘limi"],
  [/финансовый отдел|финансы/gi, "Moliya bo‘limi"],
  [/юридический отдел|юристы|юридический/gi, "Yuridik bo‘lim"],
  [/канцелярия/gi, "Kanselyariya"],
  [/проектный офис/gi, "Loyiha ofisi"],
  [/министерство горнодобывающей промышленности и геологии/gi, "Tog‘-kon sanoati va geologiya vazirligi"],
  [/министерство/gi, "vazirlik"],
  [/критическое сырьё|критического сырья|критическому сырью|критическое сырье|критического сырья/gi, "kritik xomashyo"],
  [/отч[её]т/gi, "hisobot"],
  [/бюджет/gi, "byudjet"],
  [/регуляторные риски|регуляторных рисков/gi, "tartibga solish xavflari"],
  [/рабочая встреча|рабочей встречи/gi, "ishchi uchrashuv"],
  [/данные/gi, "ma’lumotlar"],
];

function officialUzbekLetter({ recipient, instruction, subject, mode = "Черновик" }) {
  const topic = inferTopic(instruction || subject || "");
  const recipientUz = normalizeRecipient(recipient || "tegishli tashkilot");

  return {
    subject: subject || topic.subject,
    bodyUz: [
      `Mavzu: ${subject || topic.subject}`,
      "",
      `Hurmatli ${recipientUz} vakillari!`,
      "",
      `Sizga shuni ma’lum qilamizki, tashkilotimiz tomonidan ${topic.body} masalasi bo‘yicha ishlar olib borilmoqda.`,
      "",
      "Shu munosabat bilan, mazkur yo‘nalishdagi hujjatlarni kelishish hamda keyingi amaliy qadamlarni aniqlashtirish maqsadida mas’ul vakillar ishtirokida ishchi uchrashuv o‘tkazishni taklif etamiz.",
      "",
      "Iltimos, uchrashuv uchun Sizga qulay bo‘lgan sana va vaqt, shuningdek, mazkur masala bo‘yicha mas’ul xodim haqida ma’lumot berishingizni so‘raymiz.",
      "",
      "Hurmat bilan,",
      "Bosh direktor yordamchisi",
    ].join("\n"),
    mode,
    quality: [
      { label: "Официальный стиль", status: "pass" },
      { label: "Узбекская латиница", status: "pass" },
      { label: "Есть тема и просьба", status: "pass" },
      { label: mode === "Готово к отправке" ? "Финальная версия" : "Нужна проверка реквизитов", status: mode === "Готово к отправке" ? "pass" : "warn" },
    ],
  };
}

function inferTopic(text) {
  const lower = String(text).toLowerCase();
  if (lower.includes("крит") && lower.includes("отч")) {
    return {
      subject: "Kritik xomashyo yo‘nalishi bo‘yicha hisobotni kelishish yuzasidan",
      body: "kritik xomashyo yo‘nalishi bo‘yicha hisobotni tayyorlash va kelishish",
    };
  }
  if (lower.includes("бюджет")) {
    return {
      subject: "Byudjet hisob-kitoblarini kelishish yuzasidan",
      body: "tegishli yo‘nalish bo‘yicha byudjet hisob-kitoblarini tayyorlash va kelishish",
    };
  }
  if (lower.includes("напом")) {
    return {
      subject: "Belgilangan muddat bo‘yicha eslatma",
      body: "belgilangan topshiriq ijrosini ta’minlash",
    };
  }
  return {
    subject: "Ishchi tartibda hamkorlik qilish yuzasidan",
    body: "belgilangan masalalarni ishchi tartibda ko‘rib chiqish",
  };
}

function normalizeRecipient(value) {
  const lower = String(value).toLowerCase();
  if (lower.includes("горнодобы") || lower.includes("геолог")) {
    return "Tog‘-kon sanoati va geologiya vazirligi";
  }
  if (lower.includes("министер")) {
    return "tegishli vazirlik";
  }
  return translateSimple(value).replace(/^vazirlik\s+/i, "").trim();
}

function translateSimple(value) {
  return replacements.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), String(value || ""));
}

function officialDepartmentRequest({ departmentName, topic, dueDate, needed }) {
  const departmentUz = translateSimple(departmentName);
  const topicUz = translateSimple(topic || "tegishli masala");
  const neededUz = translateSimple(needed || "zarur ma’lumotlar");

  return [
    `Hurmatli ${departmentUz} vakillari,`,
    "",
    `${topicUz} bo‘yicha ishlarni o‘z vaqtida yakunlash maqsadida ${neededUz}ni ${dueDate || "belgilangan muddat"}ga qadar taqdim etishingizni so‘raymiz.`,
    "",
    "Ma’lumotlarda bajarilgan ishlar, mavjud muammolar, xavf ostidagi muddatlar va rahbariyatdan talab etiladigan yordam alohida ko‘rsatilishi lozim.",
    "",
    "Hurmat bilan,",
    "Bosh direktor yordamchisi",
  ].join("\n");
}

module.exports = {
  officialDepartmentRequest,
  officialUzbekLetter,
  translateSimple,
};
