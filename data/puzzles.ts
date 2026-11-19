export type Difficulty = "سهل" | "متوسط" | "صعب";
export type PuzzleKind = "اختيار" | "إجابة قصيرة" | "نطق";

export type Puzzle = {
  id: string;
  difficulty: Difficulty;
  category: string;
  kind: PuzzleKind;
  prompt: string;
  choices?: string[];
  answer: string;
  hint: string;
  explanation: string;
  estimatedSeconds: number;
};

/** بنك تجريبي أصلي؛ يمكن إضافة دفعات محتوى جديدة دون تغيير محرك اللعب. */
export const PUZZLES: Puzzle[] = [
  {
    id: "e-pattern-01",
    difficulty: "سهل",
    category: "أنماط",
    kind: "اختيار",
    prompt: "أكمل النمط: ٣، ٦، ٩، ١٢، ؟",
    choices: ["١٣", "١٤", "١٥", "١٦"],
    answer: "١٥",
    hint: "يزيد كل رقم بمقدار ثابت.",
    explanation: "نضيف ٣ في كل خطوة، لذلك ١٢ + ٣ = ١٥.",
    estimatedSeconds: 20,
  },
  {
    id: "e-word-01",
    difficulty: "سهل",
    category: "كلمات",
    kind: "اختيار",
    prompt: "أي كلمة لا تنتمي إلى المجموعة؟",
    choices: ["تفاحة", "كمثرى", "برتقالة", "مطرقة"],
    answer: "مطرقة",
    hint: "ثلاث كلمات أسماء فواكه.",
    explanation: "التفاحة والكمثرى والبرتقالة فواكه، أما المطرقة فأداة.",
    estimatedSeconds: 18,
  },
  {
    id: "e-logic-01",
    difficulty: "سهل",
    category: "منطق",
    kind: "اختيار",
    prompt: "إذا كان اليوم الثلاثاء، فما اليوم بعد غد؟",
    choices: ["الأربعاء", "الخميس", "الجمعة", "السبت"],
    answer: "الخميس",
    hint: "ابدأ من الأربعاء ثم تقدّم يوماً آخر.",
    explanation: "غداً الأربعاء، وبعد غد الخميس.",
    estimatedSeconds: 25,
  },
  {
    id: "e-riddle-01",
    difficulty: "سهل",
    category: "ألغاز لفظية",
    kind: "اختيار",
    prompt: "له أسنان كثيرة لكنه لا يعضّ، ما هو؟",
    choices: ["المشط", "الوسادة", "الكتاب", "الشمعة"],
    answer: "المشط",
    hint: "نستخدمه لترتيب الشعر.",
    explanation: "للمشط أسنان تُمرّر بين الشعر، لكنها لا تعضّ.",
    estimatedSeconds: 20,
  },
  {
    id: "e-math-01",
    difficulty: "سهل",
    category: "حساب",
    kind: "إجابة قصيرة",
    prompt: "معك ٧ قطع حلوى، وأعطيت صديقك ٣. كم بقي معك؟",
    answer: "٤",
    hint: "اطرح ما أعطيته من العدد الكلي.",
    explanation: "٧ − ٣ = ٤ قطع.",
    estimatedSeconds: 25,
  },
  {
    id: "e-observe-01",
    difficulty: "سهل",
    category: "ملاحظة",
    kind: "اختيار",
    prompt: "أي شكل له أربعة أضلاع متساوية وأربع زوايا قائمة؟",
    choices: ["مستطيل", "مربع", "مثلث", "دائرة"],
    answer: "مربع",
    hint: "كل أضلاعه متساوية، وزواياه مثل زوايا الكتاب.",
    explanation: "المربع له أربعة أضلاع متساوية وأربع زوايا قائمة.",
    estimatedSeconds: 22,
  },
  {
    id: "m-pattern-01",
    difficulty: "متوسط",
    category: "أنماط",
    kind: "اختيار",
    prompt: "ما العدد التالي؟ ٢، ٥، ١١، ٢٣، ؟",
    choices: ["٣٥", "٤٥", "٤٧", "٤٩"],
    answer: "٤٧",
    hint: "اضرب العدد في ٢ ثم أضف ١.",
    explanation: "كل خطوة هي ضعف العدد السابق زائد ١: ٢٣ × ٢ + ١ = ٤٧.",
    estimatedSeconds: 35,
  },
  {
    id: "m-math-01",
    difficulty: "متوسط",
    category: "حساب",
    kind: "إجابة قصيرة",
    prompt: "عمر ليلى ١٢ سنة، وأخوها أصغر منها بأربع سنوات. كم عمر أخيها؟",
    answer: "٨",
    hint: "اطرح ٤ من ١٢.",
    explanation: "١٢ − ٤ = ٨ سنوات.",
    estimatedSeconds: 35,
  },
  {
    id: "m-words-01",
    difficulty: "متوسط",
    category: "كلمات",
    kind: "اختيار",
    prompt: "اختر الكلمة الأقرب في المعنى إلى «متأنٍ».",
    choices: ["مستعجل", "متريّث", "مسرور", "متعب"],
    answer: "متريّث",
    hint: "الشخص المتأني لا يستعجل.",
    explanation: "«متريّث» تعني متأنياً لا يستعجل في قراره أو فعله.",
    estimatedSeconds: 30,
  },
  {
    id: "m-logic-01",
    difficulty: "متوسط",
    category: "منطق",
    kind: "اختيار",
    prompt:
      "كل الكتب على الرف زرقاء. هذا الدفتر على الرف، لكنه أحمر. ما الاستنتاج الأدق؟",
    choices: [
      "الدفتر كتاب أزرق",
      "المعلومة لا تسمح بالقول إن الدفتر كتاب",
      "كل الرفوف حمراء",
      "الدفتر غير موجود",
    ],
    answer: "المعلومة لا تسمح بالقول إن الدفتر كتاب",
    hint: "الجملة تتحدث عن الكتب فقط، لا عن كل ما على الرف.",
    explanation:
      "كون الكتب زرقاء لا يعني أن كل شيء على الرف كتاب؛ قد يكون الدفتر شيئاً آخر.",
    estimatedSeconds: 45,
  },
  {
    id: "m-riddle-01",
    difficulty: "متوسط",
    category: "ألغاز لفظية",
    kind: "إجابة قصيرة",
    prompt:
      "أنا عدد من رقمين. مجموع رقميّ ٩، ورقم العشرات أكبر من الآحاد بثلاثة. ما أنا؟",
    answer: "٦٣",
    hint: "إذا كان الآحاد ٣، فالعشرات ٦.",
    explanation: "٦ + ٣ = ٩، و٦ أكبر من ٣ بثلاثة، إذن العدد ٦٣.",
    estimatedSeconds: 50,
  },
  {
    id: "m-speech-01",
    difficulty: "متوسط",
    category: "تحدي النطق",
    kind: "نطق",
    prompt:
      "ردّد العبارة ثم حوّلها إلى نص باستخدام ميكروفون لوحة المفاتيح: «سافر سامر صباحاً صوب الساحل». ",
    answer: "سافر سامر صباحا صوب الساحل",
    hint: "قلها ببطء على مقاطع قصيرة: سا-فر / سا-مر / صبا-حاً / صو-بَ السا-حل.",
    explanation:
      "هذا تمرين لعب لمطابقة الكلمات التي التقطها الإملاء الصوتي. لا يقيس جودة الصوت أو مخارج الحروف قياساً طبياً.",
    estimatedSeconds: 55,
  },
  {
    id: "h-pattern-01",
    difficulty: "صعب",
    category: "أنماط",
    kind: "إجابة قصيرة",
    prompt: "أكمل: ١، ٢، ٦، ٢٤، ١٢٠، ؟",
    answer: "٧٢٠",
    hint: "اضرب في ٢ ثم ٣ ثم ٤ ثم ٥.",
    explanation: "تُضرب الحدود تباعاً في ٢، ٣، ٤، ٥، ثم ٦: ١٢٠ × ٦ = ٧٢٠.",
    estimatedSeconds: 55,
  },
  {
    id: "h-logic-01",
    difficulty: "صعب",
    category: "منطق",
    kind: "اختيار",
    prompt: "في سباق، تجاوزتَ المتسابق صاحب المركز الثاني. في أي مركز أصبحت؟",
    choices: ["الأول", "الثاني", "الثالث", "لا يمكن التحديد"],
    answer: "الثاني",
    hint: "أنت تأخذ مكان الشخص الذي تجاوزته مباشرة.",
    explanation: "عندما تتجاوز صاحب المركز الثاني، تصبح مكانه: المركز الثاني.",
    estimatedSeconds: 35,
  },
  {
    id: "h-math-01",
    difficulty: "صعب",
    category: "حساب",
    kind: "إجابة قصيرة",
    prompt: "عدد إذا ضُرب في ٣ ثم أُضيف إليه ٧ أصبح ٤٠. ما العدد؟",
    answer: "١١",
    hint: "اعكس العمليات: اطرح ٧ من ٤٠، ثم اقسم على ٣.",
    explanation: "(٤٠ − ٧) ÷ ٣ = ٣٣ ÷ ٣ = ١١.",
    estimatedSeconds: 50,
  },
  {
    id: "h-words-01",
    difficulty: "صعب",
    category: "كلمات",
    kind: "اختيار",
    prompt: "أي كلمة تُقرأ بالطريقة نفسها من اليمين واليسار؟",
    choices: ["باب", "كتاب", "قلم", "نافذة"],
    answer: "باب",
    hint: "جرّب قراءة الحروف معكوسة.",
    explanation: "«باب» تبقى كما هي عند عكس ترتيب حروفها.",
    estimatedSeconds: 30,
  },
  {
    id: "h-observe-01",
    difficulty: "صعب",
    category: "ملاحظة",
    kind: "اختيار",
    prompt:
      "في كيس ٣ جوارب سوداء و٣ بيضاء. كم جورباً تسحب في الظلام لتضمن زوجاً من اللون نفسه؟",
    choices: ["٢", "٣", "٤", "٦"],
    answer: "٣",
    hint: "مع لونين فقط، فكّر في أسوأ حالة بعد سحبتين.",
    explanation:
      "بعد سحبتين قد يكون معك لونان مختلفان؛ الجورب الثالث سيطابق أحدهما حتماً.",
    estimatedSeconds: 45,
  },
  {
    id: "h-speech-01",
    difficulty: "صعب",
    category: "تحدي النطق",
    kind: "نطق",
    prompt:
      "ردّد العبارة ثم أدخل ما التقطته لوحة المفاتيح الصوتية: «خيط حرير على حائط خليل». ",
    answer: "خيط حرير على حائط خليل",
    hint: "انتبه للتمييز بين الخاء والحاء عند الترديد.",
    explanation: "النتيجة مطابقة نصية للمحاولة ولا تُعد تقييماً مهنياً للنطق.",
    estimatedSeconds: 60,
  },
];

export const DIFFICULTIES = ["سهل", "متوسط", "صعب"] as const;
