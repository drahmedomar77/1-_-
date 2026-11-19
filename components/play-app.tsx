import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Speech from "expo-speech";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenContainer } from "@/components/screen-container";
import {
  NativeAdBanner,
  initializeAds,
  openPrivacyOptions,
  showInterstitialAtBreak,
  showRewardedForLife,
} from "@/lib/ads";
import {
  DIFFICULTIES,
  PUZZLES,
  type Difficulty,
  type Puzzle,
} from "@/data/puzzles";
import {
  answerMatches,
  dayBefore,
  defaultProgress,
  loadProgress,
  saveProgress,
  todayKey,
  type GameProgress,
} from "@/lib/game-state";

type Page =
  | "home"
  | "journey"
  | "achievements"
  | "settings"
  | "game"
  | "result";
type GameMode = "story" | "daily" | "timed" | "speech";
type Session = {
  mode: GameMode;
  queue: string[];
  index: number;
  score: number;
  initialPoints: number;
  endReason?: "time" | "lives" | "complete";
};
type Feedback = "correct" | "wrong" | null;
const CORE_PUZZLES = PUZZLES.filter((puzzle) => puzzle.kind !== "نطق");
const C = {
  paper: "#F4EBD8",
  card: "#FFFDF8",
  ink: "#253136",
  muted: "#77746C",
  red: "#C43D4D",
  redWash: "#F8E5E4",
  line: "#E7DDCA",
  green: "#547A62",
  greenWash: "#E8F0E7",
  pale: "#EBE2D2",
  gold: "#B88130",
};
const AR_NUMERALS = "٠١٢٣٤٥٦٧٨٩";
function ar(value: number): string {
  return String(Math.max(0, value)).replace(
    /[0-9]/g,
    (digit) => AR_NUMERALS[Number(digit)] ?? digit,
  );
}
function dailyPuzzle(date: string): Puzzle {
  const code = date
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return CORE_PUZZLES[(code * 7) % CORE_PUZZLES.length];
}
function randomQueue(): string[] {
  const ids = CORE_PUZZLES.map((puzzle) => puzzle.id);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, 10);
}
function randomSpeechPuzzle(): Puzzle | undefined {
  const speech = PUZZLES.filter((item) => item.kind === "نطق");
  return speech[Math.floor(Math.random() * speech.length)];
}
function Bar({
  value,
  max,
  color = C.red,
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const width =
    `${Math.min(100, Math.max(0, max ? (value / max) * 100 : 0))}%` as `${number}%`;
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width, backgroundColor: color }]} />
    </View>
  );
}
function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "red" | "green";
}) {
  const backgroundColor =
    tone === "red" ? C.redWash : tone === "green" ? C.greenWash : C.pale;
  const color = tone === "red" ? C.red : tone === "green" ? C.green : C.ink;
  return (
    <View style={[styles.pill, { backgroundColor }]}>
      <Text style={[styles.pillText, { color }]}>{children}</Text>
    </View>
  );
}
function ActionButton({
  title,
  onPress,
  kind = "primary",
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  kind?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        kind === "primary"
          ? styles.primaryButton
          : kind === "secondary"
            ? styles.secondaryButton
            : styles.quietButton,
        disabled && styles.disabledButton,
        pressed && !disabled && { opacity: 0.78, transform: [{ scale: 0.99 }] },
      ]}
    >
      <Text
        style={[
          styles.actionText,
          kind === "primary"
            ? styles.primaryText
            : kind === "secondary"
              ? styles.secondaryText
              : styles.quietText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
function AppCard({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PlayApp() {
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<Page>("home");
  const [progress, setProgress] = useState<GameProgress>(defaultProgress);
  const [ready, setReady] = useState(false);
  const [adsReady, setAdsReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [lives, setLives] = useState(5);
  const [seconds, setSeconds] = useState(60);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [hintOpen, setHintOpen] = useState(false);
  const [rewardMessage, setRewardMessage] = useState("");
  const [toast, setToast] = useState("");
  const [savingAd, setSavingAd] = useState(false);
  const finishSession = useCallback(
    (endReason: "time" | "lives" | "complete" = "complete") => {
      if (!session) return;
      if (session.mode === "timed") {
        setProgress((previous) => ({
          ...previous,
          bestTimedScore: Math.max(previous.bestTimedScore, session.score),
        }));
      }
      setSession((previous) =>
        previous ? { ...previous, endReason } : previous,
      );
      setPage("result");
    },
    [session],
  );

  useEffect(() => {
    let mounted = true;
    loadProgress().then((saved) => {
      if (mounted) {
        setProgress(saved);
        setReady(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let mounted = true;
    initializeAds().then((available) => {
      if (mounted) setAdsReady(available);
    });
    return () => {
      mounted = false;
    };
  }, [ready]);
  useEffect(() => {
    if (page !== "game" || session?.mode !== "timed") return;
    if (seconds <= 0) {
      const endTimer = setTimeout(() => finishSession("time"), 0);
      return () => clearTimeout(endTimer);
    }
    const timer = setTimeout(
      () => setSeconds((remaining) => remaining - 1),
      1000,
    );
    return () => clearTimeout(timer);
  }, [finishSession, page, session?.mode, session?.score, seconds]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const currentPuzzle = useMemo(() => {
    const id = session?.queue[session.index];
    return id ? (PUZZLES.find((puzzle) => puzzle.id === id) ?? null) : null;
  }, [session]);
  const completed = progress.completedIds.filter((id) =>
    CORE_PUZZLES.some((puzzle) => puzzle.id === id),
  ).length;
  const unlockedIndex = Math.min(completed, CORE_PUZZLES.length - 1);
  const today = todayKey();
  const dailyDone = progress.dailyCompletedDays.includes(today);
  const todayPuzzle = dailyPuzzle(today);

  function updateProgress(updater: (previous: GameProgress) => GameProgress) {
    setProgress(updater);
  }
  useEffect(() => {
    if (ready) void saveProgress(progress);
  }, [progress, ready]);
  async function buzz(ok: boolean) {
    if (!progress.settings.haptics || Platform.OS === "web") return;
    try {
      await Haptics.notificationAsync(
        ok
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      );
    } catch {
      /* جهاز بلا اهتزاز */
    }
  }
  function begin(mode: GameMode, ids: string[]) {
    if (!ids.length) return;
    setSession({
      mode,
      queue: ids,
      index: 0,
      score: 0,
      initialPoints: progress.points,
    });
    setLives(5);
    setSeconds(60);
    setAnswer("");
    setFeedback(null);
    setHintOpen(false);
    setRewardMessage("");
    setPage("game");
  }
  function startStory(fromIndex?: number) {
    const firstMissing = CORE_PUZZLES.findIndex(
      (puzzle) => !progress.completedIds.includes(puzzle.id),
    );
    if (firstMissing < 0 && fromIndex === undefined) {
      begin(
        "story",
        CORE_PUZZLES.map((puzzle) => puzzle.id),
      );
      return;
    }
    const start = fromIndex ?? firstMissing;
    if (start > unlockedIndex) {
      setToast("أكمل اللغز المفتوح قبله لفتح هذه الخطوة.");
      return;
    }
    const chapter = CORE_PUZZLES[start]?.difficulty;
    begin(
      "story",
      CORE_PUZZLES.slice(start)
        .filter((puzzle) => puzzle.difficulty === chapter)
        .map((puzzle) => puzzle.id),
    );
  }
  function startDaily() {
    if (dailyDone) {
      setToast("أنجزت تحدي اليوم بالفعل. عد غداً للغز جديد.");
      return;
    }
    begin("daily", [todayPuzzle.id]);
  }
  function startSpeech(puzzle?: Puzzle) {
    const selected = puzzle ?? randomSpeechPuzzle();
    if (!selected) return;
    begin("speech", [selected.id]);
  }
  function startTimed() {
    begin("timed", randomQueue());
  }
  function recordCorrect(puzzle: Puzzle) {
    if (!session) return;
    const day = todayKey();
    const wasCompleted = progress.completedIds.includes(puzzle.id);
    const speechDone = progress.speechCompletedIds.includes(puzzle.id);
    const isNewDaily =
      session.mode === "daily" && !progress.dailyCompletedDays.includes(day);
    const isNewSpeech = session.mode === "speech" && !speechDone;
    const isNewCore = session.mode === "story" && !wasCompleted;
    const earned =
      session.mode === "timed"
        ? 3
        : isNewDaily
          ? 20
          : isNewSpeech
            ? 6
            : isNewCore
              ? 12
              : 0;

    updateProgress((previous) => {
      const completedIds = isNewCore
        ? [...previous.completedIds, puzzle.id]
        : previous.completedIds;
      const speechCompletedIds = isNewSpeech
        ? [...previous.speechCompletedIds, puzzle.id]
        : previous.speechCompletedIds;
      let streak = previous.streak;
      let lastPlayDate = previous.lastPlayDate;
      let dailyCompletedDays = previous.dailyCompletedDays;
      if (isNewDaily) {
        streak =
          previous.lastPlayDate === day
            ? previous.streak
            : previous.lastPlayDate === dayBefore(day)
              ? previous.streak + 1
              : 1;
        lastPlayDate = day;
        dailyCompletedDays = [
          ...previous.dailyCompletedDays.filter((saved) => saved !== day),
          day,
        ].slice(-400);
      }
      return {
        ...previous,
        points: previous.points + earned,
        stars: previous.stars + (isNewCore ? 1 : 0),
        completedIds,
        speechCompletedIds,
        dailyCompletedDays,
        streak,
        lastPlayDate,
      };
    });
    setSession((previous) =>
      previous ? { ...previous, score: previous.score + 1 } : previous,
    );
    setFeedback("correct");
    setRewardMessage(earned ? `+${ar(earned)} نقطة` : "إجابة صحيحة — أحسنت!");
    void buzz(true);
  }
  function submit() {
    if (!session || !currentPuzzle || feedback || lives <= 0) return;
    if (answerMatches(answer, currentPuzzle.answer)) {
      recordCorrect(currentPuzzle);
      return;
    }
    setLives((remaining) => Math.max(0, remaining - 1));
    setFeedback("wrong");
    setRewardMessage("ليست هذه الإجابة. راجع التلميح وحاول مجدداً.");
    void buzz(false);
  }
  function selectChoice(choice: string) {
    if (feedback || lives <= 0) return;
    setAnswer(choice);
    if (answerMatches(choice, currentPuzzle?.answer ?? "")) {
      if (currentPuzzle) recordCorrect(currentPuzzle);
      return;
    }
    setLives((remaining) => Math.max(0, remaining - 1));
    setFeedback("wrong");
    setRewardMessage("إجابة غير صحيحة. انتبه للتلميح في المحاولة القادمة.");
    void buzz(false);
  }
  function moveOn() {
    if (!session) return;
    if (feedback === "wrong") {
      if (lives <= 0) {
        finishSession("lives");
        return;
      }
      setAnswer("");
      setFeedback(null);
      setRewardMessage("");
      return;
    }
    const nextIndex = session.index + 1;
    if (nextIndex >= session.queue.length) {
      finishSession("complete");
      return;
    }
    setSession({ ...session, index: nextIndex });
    setAnswer("");
    setFeedback(null);
    setHintOpen(false);
    setRewardMessage("");
  }
  async function restoreLife() {
    if (!adsReady || savingAd) return;
    setSavingAd(true);
    const rewarded = await showRewardedForLife();
    setSavingAd(false);
    if (rewarded) {
      setLives(1);
      setFeedback(null);
      setRewardMessage("");
      setAnswer("");
      setToast("استعدت محاولة إضافية، بالتوفيق!");
    } else
      setToast(
        "الإعلان غير متاح الآن. يمكنك العودة إلى المسار وإكماله لاحقاً.",
      );
  }
  async function leaveResult() {
    const chapterEnds = [6, 11, CORE_PUZZLES.length];
    if (
      session?.mode === "story" &&
      chapterEnds.includes(completed) &&
      progress.points > session.initialPoints &&
      adsReady
    )
      await showInterstitialAtBreak();
    setPage("home");
    setSession(null);
    setFeedback(null);
  }
  function toggleSetting(key: keyof GameProgress["settings"]) {
    updateProgress((previous) => ({
      ...previous,
      settings: { ...previous.settings, [key]: !previous.settings[key] },
    }));
  }
  async function readPrompt() {
    if (!currentPuzzle || !progress.settings.sound) return;
    try {
      Speech.speak(currentPuzzle.prompt, { language: "ar-SA", rate: 0.88 });
    } catch {
      setToast("تعذرت القراءة الصوتية على هذا الجهاز.");
    }
  }

  if (!ready)
    return (
      <ScreenContainer style={styles.screen}>
        <View style={styles.loading}>
          <ActivityIndicator color={C.red} size="large" />
          <Text style={styles.mutedText}>نحضّر دفتر الألغاز...</Text>
        </View>
      </ScreenContainer>
    );
  const progressPct = Math.round((completed / CORE_PUZZLES.length) * 100);

  function Header({ back = false, title }: { back?: boolean; title?: string }) {
    return (
      <View style={styles.topBar}>
        {back ? (
          <Pressable onPress={() => setPage("home")} style={styles.iconButton}>
            <Text style={styles.backArrow}>→</Text>
          </Pressable>
        ) : (
          <View style={styles.brandMark}>
            <Text style={styles.brandGlyph}>ذ</Text>
          </View>
        )}
        <View style={styles.brandTextWrap}>
          <Text style={styles.brandName}>{title ?? "ذِهْن"}</Text>
          {!title && <Text style={styles.brandSub}>دفتر تحدياتك اليومية</Text>}
        </View>
        <Pressable
          onPress={() => setPage("settings")}
          style={styles.streakChip}
        >
          <Text style={styles.streakFire}>✦</Text>
          <Text style={styles.streakNumber}>{ar(progress.streak)}</Text>
        </Pressable>
      </View>
    );
  }
  function BottomNav() {
    const items: { key: Page; icon: string; label: string }[] = [
      { key: "home", icon: "⌂", label: "الرئيسية" },
      { key: "journey", icon: "◷", label: "المراحل" },
      { key: "achievements", icon: "☆", label: "إنجازاتي" },
      { key: "settings", icon: "⚙", label: "الإعدادات" },
    ];
    return (
      <View
        style={[
          styles.bottomNav,
          { paddingBottom: Math.max(insets.bottom, 10) },
        ]}
      >
        {items.map((item) => {
          const active = page === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setPage(item.key)}
              style={styles.navItem}
            >
              <Text style={[styles.navIcon, active && styles.navActive]}>
                {item.icon}
              </Text>
              <Text style={[styles.navLabel, active && styles.navActive]}>
                {item.label}
              </Text>
              {active && <View style={styles.navDot} />}
            </Pressable>
          );
        })}
      </View>
    );
  }
  function HomePage() {
    const next = CORE_PUZZLES.find(
      (puzzle) => !progress.completedIds.includes(puzzle.id),
    );
    const difficultyCounts = (DIFFICULTIES as readonly Difficulty[]).map(
      (level) => ({
        level,
        done: CORE_PUZZLES.filter(
          (puzzle) =>
            puzzle.difficulty === level &&
            progress.completedIds.includes(puzzle.id),
        ).length,
        total: CORE_PUZZLES.filter((puzzle) => puzzle.difficulty === level)
          .length,
      }),
    );
    return (
      <>
        <ScrollView
          contentContainerStyle={styles.pageContent}
          showsVerticalScrollIndicator={false}
        >
          <Header />
          <View style={styles.welcomeRow}>
            <View style={styles.welcomeCopy}>
              <Text style={styles.eyebrow}>مساحتك اليومية للتفكير</Text>
              <Text style={styles.heroTitle}>لغز صغير،{"\n"}قفزة كبيرة.</Text>
              <Text style={styles.bodyText}>
                اختبر فضولك خطوة بخطوة، بلا ضغط ولا استعجال.
              </Text>
            </View>
            <View style={styles.doodleCard}>
              <Text style={styles.doodleIcon}>⌁</Text>
              <Text style={styles.doodleStar}>✦</Text>
            </View>
          </View>
          <AppCard style={styles.dailyCard}>
            <View style={styles.sectionRow}>
              <Pill tone={dailyDone ? "green" : "red"}>
                {dailyDone ? "أُنجز اليوم" : "لغز جديد"}
              </Pill>
              <Text style={styles.cardKicker}>
                تحدّي اليوم · {todayPuzzle.category}
              </Text>
            </View>
            <Text style={styles.dailyTitle}>
              {dailyDone
                ? "أحسنت، حافظت على عادتك."
                : "هل تحلّه من أول محاولة؟"}
            </Text>
            <Text style={styles.bodyText}>
              {dailyDone
                ? "في الغد ستجد لغزاً جديداً بانتظارك."
                : "دقيقة واحدة تكفي لتضيف إنجازاً إلى سلسلتك."}
            </Text>
            <View style={styles.rowBetween}>
              <ActionButton
                title={dailyDone ? "تم إنجاز التحدي ✓" : "ابدأ تحدي اليوم ←"}
                onPress={startDaily}
                kind={dailyDone ? "secondary" : "primary"}
                disabled={dailyDone}
              />
              <Text style={styles.rewardHint}>+٢٠ نقطة</Text>
            </View>
          </AppCard>
          {progress.settings.speechChallenges && (
            <Pressable onPress={() => startSpeech()} style={styles.speechCard}>
              <View style={styles.speechIcon}>
                <Text style={styles.speechIconText}>◖))</Text>
              </View>
              <View style={styles.timerCopy}>
                <Text style={styles.timerTitle}>مساحة النطق · اختياري</Text>
                <Text style={styles.timerSub}>
                  ردّد عبارة قصيرة، ثم جرّب الإملاء الصوتي.
                </Text>
              </View>
              <Text style={styles.chevron}>‹</Text>
            </Pressable>
          )}
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionTitle}>مسارك الذهني</Text>
              <Text style={styles.sectionCaption}>
                المستوى التالي: {next?.difficulty ?? "اكتمل المسار"}
              </Text>
            </View>
            <Pressable onPress={() => setPage("journey")}>
              <Text style={styles.linkText}>كل المراحل ‹</Text>
            </Pressable>
          </View>
          <AppCard style={styles.progressCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.progressBig}>
                  {ar(completed)}{" "}
                  <Text style={styles.progressOf}>
                    / {ar(CORE_PUZZLES.length)} لغز
                  </Text>
                </Text>
                <Text style={styles.bodyText}>
                  أنجزت {ar(progressPct)}٪ من المسار
                </Text>
              </View>
              <View style={styles.levelBadge}>
                <Text style={styles.levelBadgeIcon}>✦</Text>
                <Text style={styles.levelBadgeText}>
                  اللاعب {ar(Math.max(1, Math.floor(progress.points / 80) + 1))}
                </Text>
              </View>
            </View>
            <Bar value={completed} max={CORE_PUZZLES.length} />
            <View style={styles.difficultyRow}>
              {difficultyCounts.map((item) => (
                <View key={item.level} style={styles.difficultyItem}>
                  <View
                    style={[
                      styles.difficultyDot,
                      {
                        backgroundColor:
                          item.level === "سهل"
                            ? C.green
                            : item.level === "متوسط"
                              ? C.gold
                              : C.red,
                      },
                    ]}
                  />
                  <Text style={styles.difficultyLabel}>{item.level}</Text>
                  <Text style={styles.difficultyCount}>
                    {ar(item.done)}/{ar(item.total)}
                  </Text>
                </View>
              ))}
            </View>
            <ActionButton
              title={next ? `تابع من ${next.difficulty} ←` : "أعد لعب المسار"}
              onPress={() => startStory()}
              kind="secondary"
            />
          </AppCard>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionTitle}>غيّر الإيقاع</Text>
              <Text style={styles.sectionCaption}>تحدٍّ سريع قابل للإعادة</Text>
            </View>
          </View>
          <Pressable
            onPress={startTimed}
            style={({ pressed }) => [
              styles.timerCard,
              pressed && { opacity: 0.82 },
            ]}
          >
            <View style={styles.timerIcon}>
              <Text style={styles.timerGlyph}>◷</Text>
            </View>
            <View style={styles.timerCopy}>
              <Text style={styles.timerTitle}>سباق الدقيقة</Text>
              <Text style={styles.timerSub}>
                أسئلة متتابعة، ٦٠ ثانية، حاول تحطيم رقمك.
              </Text>
            </View>
            <Text style={styles.chevron}>‹</Text>
          </Pressable>
          <View style={styles.statsStrip}>
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{ar(progress.points)}</Text>
              <Text style={styles.statLabel}>نقطة</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{ar(progress.stars)}</Text>
              <Text style={styles.statLabel}>نجمة</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>{ar(progress.streak)}</Text>
              <Text style={styles.statLabel}>يوم متتالٍ</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCell}>
              <Text style={styles.statValue}>
                {ar(progress.bestTimedScore)}
              </Text>
              <Text style={styles.statLabel}>أفضل سباق</Text>
            </View>
          </View>
          {adsReady && (
            <View style={styles.adWrap}>
              <NativeAdBanner />
            </View>
          )}
          <Text style={styles.disclaimer}>
            ذِهْن للترفيه والتدريب الذهني؛ لا يقدم اختبار ذكاء أو تشخيصاً لغوياً
            معتمداً.
          </Text>
        </ScrollView>
        <BottomNav />
      </>
    );
  }
  function JourneyPage() {
    return (
      <>
        <ScrollView
          contentContainerStyle={styles.pageContent}
          showsVerticalScrollIndicator={false}
        >
          <Header title="رحلتك" />
          <Text style={styles.heroTitleSmall}>
            ثلاث محطات،{"\n"}ومهارات أكثر.
          </Text>
          <Text style={styles.bodyText}>
            كل إجابة صحيحة تفتح لك بطاقة جديدة. يمكنك العودة إلى أي لغز أنجزته.
          </Text>
          {(DIFFICULTIES as readonly Difficulty[]).map((difficulty) => {
            const puzzles = CORE_PUZZLES.filter(
              (puzzle) => puzzle.difficulty === difficulty,
            );
            const levelDone = puzzles.filter((puzzle) =>
              progress.completedIds.includes(puzzle.id),
            ).length;
            return (
              <View key={difficulty} style={styles.levelSection}>
                <View style={styles.sectionHeadingRow}>
                  <View>
                    <Text style={styles.sectionTitle}>{difficulty}</Text>
                    <Text style={styles.sectionCaption}>
                      {ar(levelDone)} من {ar(puzzles.length)} ألغاز
                    </Text>
                  </View>
                  <Pill
                    tone={
                      difficulty === "سهل"
                        ? "green"
                        : difficulty === "صعب"
                          ? "red"
                          : "neutral"
                    }
                  >
                    {difficulty === "سهل"
                      ? "البداية"
                      : difficulty === "متوسط"
                        ? "خطوة أبعد"
                        : "تحدٍّ عميق"}
                  </Pill>
                </View>
                {puzzles.map((puzzle) => {
                  const index = CORE_PUZZLES.findIndex(
                    (item) => item.id === puzzle.id,
                  );
                  const done = progress.completedIds.includes(puzzle.id);
                  const locked = index > unlockedIndex;
                  return (
                    <Pressable
                      key={puzzle.id}
                      onPress={() => !locked && startStory(index)}
                      style={[styles.puzzleRow, locked && styles.puzzleLocked]}
                    >
                      <View
                        style={[
                          styles.puzzleNumber,
                          done && styles.puzzleDone,
                          locked && styles.puzzleNumberLocked,
                        ]}
                      >
                        <Text
                          style={[
                            styles.puzzleNumberText,
                            done && styles.puzzleDoneText,
                          ]}
                        >
                          {done ? "✓" : locked ? "•" : ar(index + 1)}
                        </Text>
                      </View>
                      <View style={styles.puzzleRowCopy}>
                        <Text style={styles.puzzleCategory}>
                          {puzzle.category}
                        </Text>
                        <Text style={styles.puzzlePrompt} numberOfLines={1}>
                          {locked
                            ? "أكمل البطاقة السابقة لفتحها"
                            : puzzle.prompt}
                        </Text>
                      </View>
                      <Text style={styles.chevron}>{locked ? "▣" : "‹"}</Text>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
          {progress.settings.speechChallenges && (
            <View style={styles.levelSection}>
              <View style={styles.sectionHeadingRow}>
                <View>
                  <Text style={styles.sectionTitle}>تحديات النطق</Text>
                  <Text style={styles.sectionCaption}>
                    مسار جانبي اختياري، لا يحجب المراحل
                  </Text>
                </View>
                <Pill tone="red">اختياري</Pill>
              </View>
              {PUZZLES.filter((puzzle) => puzzle.kind === "نطق").map(
                (puzzle) => {
                  const done = progress.speechCompletedIds.includes(puzzle.id);
                  return (
                    <Pressable
                      key={puzzle.id}
                      onPress={() => startSpeech(puzzle)}
                      style={styles.puzzleRow}
                    >
                      <View
                        style={[styles.puzzleNumber, done && styles.puzzleDone]}
                      >
                        <Text
                          style={[
                            styles.puzzleNumberText,
                            done && styles.puzzleDoneText,
                          ]}
                        >
                          {done ? "✓" : "◖"}
                        </Text>
                      </View>
                      <View style={styles.puzzleRowCopy}>
                        <Text style={styles.puzzleCategory}>
                          {puzzle.difficulty} · {puzzle.category}
                        </Text>
                        <Text style={styles.puzzlePrompt} numberOfLines={1}>
                          {puzzle.prompt}
                        </Text>
                      </View>
                      <Text style={styles.chevron}>‹</Text>
                    </Pressable>
                  );
                },
              )}
            </View>
          )}
        </ScrollView>
        <BottomNav />
      </>
    );
  }
  function AchievementPage() {
    const badges = [
      {
        icon: "✦",
        title: "أول خطوة",
        text: "حل أول لغز",
        unlocked: completed >= 1,
      },
      {
        icon: "⌁",
        title: "ثلاثة على التوالي",
        text: "أكمل ٣ ألغاز",
        unlocked: completed >= 3,
      },
      {
        icon: "◷",
        title: "سريع البديهة",
        text: "أحرز ٥ في سباق",
        unlocked: progress.bestTimedScore >= 5,
      },
      {
        icon: "☼",
        title: "عادة جميلة",
        text: "حافظ على سلسلة ٣ أيام",
        unlocked: progress.streak >= 3,
      },
      {
        icon: "✧",
        title: "عقل متفتح",
        text: "جرّب مستوى صعب",
        unlocked: progress.completedIds.some(
          (id) =>
            CORE_PUZZLES.find((puzzle) => puzzle.id === id)?.difficulty ===
            "صعب",
        ),
      },
      {
        icon: "∞",
        title: "دفتر ممتلئ",
        text: "أكمل كل ألغاز المسار",
        unlocked: completed === CORE_PUZZLES.length,
      },
    ];
    return (
      <>
        <ScrollView
          contentContainerStyle={styles.pageContent}
          showsVerticalScrollIndicator={false}
        >
          <Header title="إنجازاتك" />
          <Text style={styles.heroTitleSmall}>كل علامة،{"\n"}خطوة محسوبة.</Text>
          <Text style={styles.bodyText}>
            الإنجازات تقيس نشاطك داخل اللعبة، لا مستوى ذكائك.
          </Text>
          <AppCard style={styles.achievementSummary}>
            <Text style={styles.summaryPoints}>{ar(progress.points)}</Text>
            <Text style={styles.summaryLabel}>نقطة جمعتها حتى الآن</Text>
            <Bar value={completed} max={CORE_PUZZLES.length} />
            <Text style={styles.summarySmall}>
              {ar(completed)} لغز من {ar(CORE_PUZZLES.length)}
            </Text>
          </AppCard>
          <View style={styles.badgeGrid}>
            {badges.map((badge) => (
              <AppCard
                key={badge.title}
                style={[
                  styles.badgeCard,
                  !badge.unlocked && styles.badgeLocked,
                ]}
              >
                <Text
                  style={[styles.badgeIcon, !badge.unlocked && styles.badgeDim]}
                >
                  {badge.unlocked ? badge.icon : "· · ·"}
                </Text>
                <Text style={styles.badgeTitle}>{badge.title}</Text>
                <Text style={styles.badgeDescription}>{badge.text}</Text>
                <Pill tone={badge.unlocked ? "green" : "neutral"}>
                  {badge.unlocked ? "مفتوحة" : "لم تُفتح"}
                </Pill>
              </AppCard>
            ))}
          </View>
          <AppCard style={styles.streakCard}>
            <Text style={styles.streakCardIcon}>✦</Text>
            <View style={styles.streakCardCopy}>
              <Text style={styles.cardTitle}>
                سلسلتك: {ar(progress.streak)}{" "}
                {progress.streak === 1 ? "يوم" : "أيام"}
              </Text>
              <Text style={styles.bodyText}>
                أنجز تحدي اليوم للمحافظة على العادة.
              </Text>
            </View>
          </AppCard>
        </ScrollView>
        <BottomNav />
      </>
    );
  }
  function SettingRow({
    title,
    description,
    value,
    onPress,
  }: {
    title: string;
    description: string;
    value: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        onPress={onPress}
        style={styles.settingRow}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
      >
        <View style={[styles.switchTrack, value && styles.switchOn]}>
          <View style={[styles.switchKnob, value && styles.switchKnobOn]} />
        </View>
        <View style={styles.settingCopy}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingDescription}>{description}</Text>
        </View>
      </Pressable>
    );
  }
  function SettingsPage() {
    return (
      <>
        <ScrollView
          contentContainerStyle={styles.pageContent}
          showsVerticalScrollIndicator={false}
        >
          <Header title="الإعدادات" />
          <Text style={styles.heroTitleSmall}>على طريقتك.</Text>
          <Text style={styles.bodyText}>
            اختر ما يجعل جلسة التفكير أريح لك.
          </Text>
          <AppCard style={styles.settingsCard}>
            <SettingRow
              title="قراءة السؤال"
              description="استمع للسؤال بالعربية عند فتح لغز."
              value={progress.settings.sound}
              onPress={() => toggleSetting("sound")}
            />
            <View style={styles.rowDivider} />
            <SettingRow
              title="تحديات النطق"
              description="تمارين ترديد وإملاء صوتي اختيارية."
              value={progress.settings.speechChallenges}
              onPress={() => toggleSetting("speechChallenges")}
            />
            <View style={styles.rowDivider} />
            <SettingRow
              title="اهتزاز خفيف"
              description="تنبيه لمسي عند صحة الإجابة أو خطئها."
              value={progress.settings.haptics}
              onPress={() => toggleSetting("haptics")}
            />
          </AppCard>
          <AppCard style={styles.infoCard}>
            <Text style={styles.cardTitle}>عن تحدي النطق</Text>
            <Text style={styles.bodyText}>
              استخدم زر الميكروفون في لوحة مفاتيح الهاتف لكتابة ما قلته. نطابق
              الكلمات فقط؛ لا نسجّل صوتك داخل التطبيق ولا نقيس مخارج الحروف أو
              مستوى النطق طبياً.
            </Text>
          </AppCard>
          <AppCard style={styles.infoCard}>
            <Text style={styles.cardTitle}>الخصوصية والإعلانات</Text>
            <Text style={styles.bodyText}>
              يتحقق التطبيق من حالة الموافقة عبر Google UMP قبل طلب إعلان، ويعرض
              النموذج حيث يقتضي النظام ذلك. تُطلب إعلانات غير مخصصة؛ تظهر
              البانرات في الرئيسية فقط، والإعلان البيني عند نهاية فصل مكتمل،
              ومشاهدة المكافأة اختيار صريح من اللاعب.
            </Text>
            {adsReady && (
              <ActionButton
                title="خيارات خصوصية الإعلانات"
                kind="secondary"
                onPress={() => {
                  void openPrivacyOptions().then((opened) => {
                    if (!opened)
                      setToast("خيارات الخصوصية غير متاحة الآن. حاول لاحقاً.");
                  });
                }}
              />
            )}
            {!adsReady && (
              <Text style={styles.smallNote}>
                تظهر الإعلانات بعد إضافة معرفات AdMob وبناء نسخة Android أصلية.
                معاينة Expo Go لا تدعم وحدات الإعلانات الأصلية.
              </Text>
            )}
          </AppCard>
          <AppCard style={styles.infoCard}>
            <Text style={styles.cardTitle}>التقدم على هذا الجهاز</Text>
            <Text style={styles.bodyText}>
              تُحفظ النقاط والمراحل والإعدادات محلياً. حذف التطبيق قد يمحو هذا
              التقدم.
            </Text>
          </AppCard>
          <Text style={styles.version}>ذِهْن · نسخة أولية ١.٠</Text>
        </ScrollView>
        <BottomNav />
      </>
    );
  }
  function GamePage() {
    if (!session || !currentPuzzle)
      return (
        <View style={styles.loading}>
          <Text style={styles.mutedText}>اختر جولة من الصفحة الرئيسية.</Text>
          <ActionButton
            title="الرئيسية"
            onPress={() => setPage("home")}
            kind="secondary"
          />
        </View>
      );
    const stepNumber = session.index + 1;
    const maxSteps = session.queue.length;
    const noLives = lives <= 0;
    return (
      <ScrollView
        contentContainerStyle={styles.gameContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gameTop}>
          <Pressable
            onPress={() => {
              setPage("home");
              setSession(null);
            }}
            style={styles.iconButton}
          >
            <Text style={styles.closeGlyph}>×</Text>
          </Pressable>
          <View style={styles.gameProgressCopy}>
            <Text style={styles.gameMode}>
              {session.mode === "daily"
                ? "تحدّي اليوم"
                : session.mode === "timed"
                  ? "سباق الدقيقة"
                  : session.mode === "speech"
                    ? "تحدي نطق اختياري"
                    : "المسار الأساسي"}
            </Text>
            <Text style={styles.gameStep}>
              السؤال {ar(stepNumber)} من {ar(maxSteps)}
            </Text>
          </View>
          <View style={[styles.livesBadge, noLives && styles.livesEmpty]}>
            <Text style={styles.lifeGlyph}>♥</Text>
            <Text style={styles.livesText}>{ar(lives)}</Text>
          </View>
        </View>
        {session.mode === "timed" && (
          <View style={styles.timerStrip}>
            <Text style={styles.timerLeft}>{ar(seconds)} ثانية</Text>
            <Bar
              value={seconds}
              max={60}
              color={seconds < 15 ? C.red : C.gold}
            />
          </View>
        )}
        <View style={styles.progressMeta}>
          <Pill
            tone={
              currentPuzzle.difficulty === "سهل"
                ? "green"
                : currentPuzzle.difficulty === "صعب"
                  ? "red"
                  : "neutral"
            }
          >
            {currentPuzzle.difficulty}
          </Pill>
          <Text style={styles.categoryMeta}>{currentPuzzle.category}</Text>
          <Text style={styles.questionNumber}>
            {ar(stepNumber)} / {ar(maxSteps)}
          </Text>
        </View>
        <Bar value={stepNumber - 1} max={maxSteps} />
        <AppCard style={styles.questionCard}>
          <View style={styles.questionTop}>
            <Text style={styles.questionLabel}>
              {currentPuzzle.kind === "نطق"
                ? "تحدي نطق اختياري"
                : "تأمل قبل أن تجيب"}
            </Text>
            <Pressable
              onPress={() => void readPrompt()}
              style={[
                styles.speakButton,
                !progress.settings.sound && styles.speakDisabled,
              ]}
            >
              <Text style={styles.speakGlyph}>◖))</Text>
            </Pressable>
          </View>
          <Text style={styles.questionText}>{currentPuzzle.prompt}</Text>
          {currentPuzzle.kind === "نطق" && (
            <View style={styles.speechNote}>
              <Text style={styles.speechNoteText}>
                ردّد العبارة، ثم استخدم زر الميكروفون في لوحة مفاتيح الهاتف أو
                اكتب ما نطقت به. لا يُحفظ أي تسجيل.
              </Text>
            </View>
          )}
          {currentPuzzle.choices ? (
            <View style={styles.optionsList}>
              {currentPuzzle.choices.map((choice, index) => {
                const chosen = answer === choice;
                const correctChoice = feedback === "correct" && chosen;
                return (
                  <Pressable
                    key={`${choice}-${index}`}
                    disabled={!!feedback || noLives}
                    onPress={() => selectChoice(choice)}
                    style={({ pressed }) => [
                      styles.optionRow,
                      chosen && styles.optionSelected,
                      correctChoice && styles.optionCorrect,
                      pressed && !feedback && { opacity: 0.75 },
                    ]}
                  >
                    <View
                      style={[
                        styles.optionLetter,
                        chosen && styles.optionLetterSelected,
                        correctChoice && styles.optionLetterCorrect,
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionLetterText,
                          (chosen || correctChoice) &&
                            styles.optionLetterTextSelected,
                        ]}
                      >
                        {String.fromCharCode(65 + index)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.optionText,
                        chosen && styles.optionTextSelected,
                      ]}
                    >
                      {choice}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <View style={styles.answerBox}>
              <TextInput
                value={answer}
                onChangeText={setAnswer}
                placeholder={
                  currentPuzzle.kind === "نطق"
                    ? "اكتب ما التقطه الإملاء الصوتي…"
                    : "اكتب إجابتك هنا…"
                }
                placeholderTextColor="#9B958A"
                style={styles.answerInput}
                textAlign="right"
                editable={!feedback && !noLives}
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={submit}
              />
              {currentPuzzle.kind === "نطق" && (
                <Text style={styles.inputFootnote}>
                  يمكنك اختيار الميكروفون من لوحة مفاتيح Android إن كان متاحاً.
                </Text>
              )}
              {!feedback && (
                <ActionButton
                  title="تحقق من الإجابة"
                  onPress={submit}
                  disabled={!answer.trim() || noLives}
                />
              )}
            </View>
          )}
          {feedback && (
            <View
              style={[
                styles.feedbackBox,
                feedback === "correct"
                  ? styles.feedbackCorrect
                  : styles.feedbackWrong,
              ]}
            >
              <Text
                style={[
                  styles.feedbackTitle,
                  { color: feedback === "correct" ? C.green : C.red },
                ]}
              >
                {feedback === "correct"
                  ? "أحسنت، التقطت الفكرة!"
                  : noLives
                    ? "انتهت محاولات هذه الجولة"
                    : "قريب! جرّب مجدداً"}
              </Text>
              <Text style={styles.feedbackBody}>
                {feedback === "correct"
                  ? currentPuzzle.explanation
                  : noLives
                    ? `الإجابة: ${currentPuzzle.answer}. ${currentPuzzle.explanation}`
                    : rewardMessage}
              </Text>
              {feedback === "correct" && (
                <Text style={styles.pointsGain}>{rewardMessage}</Text>
              )}
              {feedback === "wrong" && noLives && adsReady && (
                <ActionButton
                  title={
                    savingAd
                      ? "جارٍ تحميل الإعلان…"
                      : "شاهد إعلاناً لاستعادة محاولة"
                  }
                  onPress={() => void restoreLife()}
                  disabled={savingAd}
                  kind="secondary"
                />
              )}
              {feedback === "wrong" && noLives && !adsReady && (
                <Text style={styles.smallNote}>
                  لا يوجد إعلان مفعّل في هذه النسخة. يمكنك العودة للمراحل
                  ومتابعة اللعب لاحقاً.
                </Text>
              )}
              <ActionButton
                title={
                  feedback === "correct"
                    ? "اللغز التالي ←"
                    : noLives
                      ? "العودة إلى النتائج"
                      : "حاول مرة أخرى"
                }
                onPress={moveOn}
                kind="primary"
              />
            </View>
          )}
          {!feedback && (
            <Pressable
              onPress={() => setHintOpen((open) => !open)}
              style={styles.hintToggle}
            >
              <Text style={styles.hintIcon}>✎</Text>
              <Text style={styles.hintText}>
                {hintOpen ? "إخفاء التلميح" : "أعطني تلميحاً"}
              </Text>
              <Text style={styles.chevron}>{hintOpen ? "⌃" : "⌄"}</Text>
            </Pressable>
          )}
          {hintOpen && !feedback && (
            <View style={styles.hintBox}>
              <Text style={styles.hintBoxText}>{currentPuzzle.hint}</Text>
            </View>
          )}
        </AppCard>
        <View style={styles.gameFooter}>
          <Text style={styles.footerNote}>خذ وقتك. الذكاء ليس سباقاً.</Text>
          {session.mode === "timed" && (
            <Text style={styles.timerScore}>الصحيحة: {ar(session.score)}</Text>
          )}
        </View>
      </ScrollView>
    );
  }
  function ResultPage() {
    const modeName =
      session?.mode === "daily"
        ? "تحدي اليوم"
        : session?.mode === "timed"
          ? "سباق الدقيقة"
          : session?.mode === "speech"
            ? "تحدي النطق"
            : "المسار الأساسي";
    return (
      <View style={styles.resultPage}>
        <View style={styles.resultStamp}>
          <Text style={styles.resultStampIcon}>
            {session?.mode === "timed" ? "◷" : "✦"}
          </Text>
        </View>
        <Pill tone="green">انتهت الجولة</Pill>
        <Text style={styles.resultTitle}>
          {session?.mode === "timed"
            ? session.endReason === "time"
              ? "انتهى الوقت!"
              : session.endReason === "lives"
                ? "انتهت المحاولات"
                : "أكملت سباق الدقيقة!"
            : (session?.score ?? 0) > 0
              ? "أحسنت، يا صاحب الفكرة."
              : "جولة أخرى بانتظارك."}
        </Text>
        <Text style={styles.resultSubtitle}>
          {modeName} · أداء جميل في طريقك اليوم.
        </Text>
        <AppCard style={styles.resultCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.resultLabel}>إجابات صحيحة</Text>
            <Text style={styles.resultValue}>{ar(session?.score ?? 0)}</Text>
          </View>
          <View style={styles.rowDivider} />
          <View style={styles.rowBetween}>
            <Text style={styles.resultLabel}>مجموع النقاط</Text>
            <Text style={styles.resultValue}>{ar(progress.points)}</Text>
          </View>
          {session?.mode === "timed" && (
            <>
              <View style={styles.rowDivider} />
              <View style={styles.rowBetween}>
                <Text style={styles.resultLabel}>أفضل نتيجة</Text>
                <Text style={styles.resultValue}>
                  {ar(progress.bestTimedScore)}
                </Text>
              </View>
            </>
          )}
        </AppCard>
        <ActionButton title="تابع رحلتك ←" onPress={() => void leaveResult()} />
        {session?.mode !== "daily" && (
          <ActionButton
            title="جولة جديدة"
            kind="secondary"
            onPress={() =>
              session?.mode === "timed"
                ? startTimed()
                : session?.mode === "speech"
                  ? startSpeech()
                  : startStory()
            }
          />
        )}
        <Text style={styles.disclaimer}>
          النتيجة تعرض أداء هذه الجولة فقط، ولا تمثل مقياساً علمياً للذكاء.
        </Text>
      </View>
    );
  }

  return (
    <ScreenContainer style={styles.screen}>
      <View style={styles.appShell}>
        {page === "home" && HomePage()}
        {page === "journey" && JourneyPage()}
        {page === "achievements" && AchievementPage()}
        {page === "settings" && SettingsPage()}
        {page === "game" && GamePage()}
        {page === "result" && ResultPage()}
        {toast && page !== "game" ? (
          <View
            style={[styles.toast, { bottom: Math.max(insets.bottom, 18) + 84 }]}
          >
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.paper },
  appShell: { flex: 1, backgroundColor: C.paper },
  pageContent: { paddingHorizontal: 20, paddingBottom: 28, gap: 18 },
  gameContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 36,
    gap: 18,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: C.paper,
  },
  mutedText: { color: C.muted, fontSize: 13 },
  topBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 11,
    paddingTop: 4,
    paddingBottom: 6,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.red,
  },
  brandGlyph: {
    color: "#FFFDF8",
    fontSize: 26,
    fontWeight: "900",
    writingDirection: "rtl",
  },
  brandTextWrap: { flex: 1, alignItems: "flex-end" },
  brandName: {
    color: C.ink,
    fontSize: 21,
    fontWeight: "900",
    textAlign: "right",
    writingDirection: "rtl",
  },
  brandSub: {
    color: C.muted,
    fontSize: 11,
    marginTop: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  streakChip: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
    borderRadius: 13,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  streakFire: { color: C.red, fontSize: 16 },
  streakNumber: { color: C.ink, fontWeight: "800", fontSize: 14 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
  },
  backArrow: { color: C.ink, fontSize: 22, transform: [{ scaleX: -1 }] },
  closeGlyph: { color: C.ink, fontSize: 27, lineHeight: 29 },
  welcomeRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 5,
    paddingBottom: 4,
  },
  welcomeCopy: { flex: 1, alignItems: "flex-end", paddingLeft: 8 },
  eyebrow: {
    color: C.red,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "right",
  },
  heroTitle: {
    color: C.ink,
    fontSize: 32,
    lineHeight: 41,
    fontWeight: "900",
    textAlign: "right",
    writingDirection: "rtl",
  },
  heroTitleSmall: {
    color: C.ink,
    fontSize: 29,
    lineHeight: 39,
    fontWeight: "900",
    textAlign: "right",
    writingDirection: "rtl",
    marginTop: 2,
  },
  bodyText: {
    color: C.muted,
    fontSize: 13,
    lineHeight: 22,
    textAlign: "right",
    writingDirection: "rtl",
  },
  doodleCard: {
    width: 86,
    height: 92,
    borderRadius: 22,
    backgroundColor: "#E9DEC9",
    justifyContent: "center",
    alignItems: "center",
    transform: [{ rotate: "4deg" }],
  },
  doodleIcon: {
    color: C.red,
    fontSize: 53,
    fontWeight: "800",
    transform: [{ rotate: "-15deg" }],
  },
  doodleStar: {
    color: C.gold,
    position: "absolute",
    top: 7,
    left: 13,
    fontSize: 17,
  },
  card: {
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    padding: 17,
    gap: 13,
  },
  dailyCard: { borderColor: "#E9C7C5", backgroundColor: "#FFF9F4", gap: 11 },
  sectionRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardKicker: {
    color: C.muted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },
  dailyTitle: {
    color: C.ink,
    fontSize: 19,
    fontWeight: "900",
    textAlign: "right",
    writingDirection: "rtl",
  },
  rowBetween: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  actionButton: {
    borderRadius: 14,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 17,
    paddingVertical: 12,
    flexGrow: 0,
  },
  primaryButton: { backgroundColor: C.red },
  secondaryButton: {
    backgroundColor: "#F3E7D5",
    borderWidth: 1,
    borderColor: "#E6D5BD",
  },
  quietButton: { backgroundColor: "transparent" },
  disabledButton: { opacity: 0.52 },
  actionText: {
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    writingDirection: "rtl",
  },
  primaryText: { color: "#FFFDF8" },
  secondaryText: { color: C.ink },
  quietText: { color: C.red },
  rewardHint: { color: C.gold, fontSize: 12, fontWeight: "800" },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  pillText: { fontSize: 10, fontWeight: "800", textAlign: "right" },
  sectionHeadingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 1,
  },
  sectionTitle: {
    color: C.ink,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "right",
  },
  sectionCaption: {
    color: C.muted,
    fontSize: 11,
    marginTop: 3,
    textAlign: "right",
  },
  linkText: { color: C.red, fontSize: 12, fontWeight: "800" },
  progressCard: { gap: 14 },
  progressBig: {
    color: C.ink,
    fontSize: 23,
    fontWeight: "900",
    textAlign: "right",
  },
  progressOf: { color: C.muted, fontSize: 12, fontWeight: "600" },
  levelBadge: {
    borderRadius: 13,
    backgroundColor: "#F8E8C9",
    padding: 9,
    alignItems: "center",
    minWidth: 75,
  },
  levelBadgeIcon: { color: C.gold, fontSize: 16 },
  levelBadgeText: {
    color: C.ink,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  progressTrack: {
    height: 7,
    borderRadius: 99,
    overflow: "hidden",
    backgroundColor: "#E9E0D1",
    flex: 1,
  },
  progressFill: { height: "100%", borderRadius: 99, alignSelf: "flex-end" },
  difficultyRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    gap: 8,
  },
  difficultyItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 5,
  },
  difficultyDot: { width: 7, height: 7, borderRadius: 5 },
  difficultyLabel: { color: C.muted, fontSize: 10, fontWeight: "700" },
  difficultyCount: { color: C.ink, fontSize: 10, fontWeight: "800" },
  timerCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: 19,
    backgroundColor: "#EDE3D2",
    borderWidth: 1,
    borderColor: "#E3D5C0",
  },
  speechCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: 18,
    backgroundColor: "#F7E8E4",
    borderWidth: 1,
    borderColor: "#EBCBC4",
  },
  speechIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: C.red,
    justifyContent: "center",
    alignItems: "center",
  },
  speechIconText: { color: "white", fontSize: 13, fontWeight: "900" },
  timerIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: C.ink,
    justifyContent: "center",
    alignItems: "center",
  },
  timerGlyph: { color: C.paper, fontSize: 23 },
  timerCopy: { flex: 1, alignItems: "flex-end" },
  timerTitle: { color: C.ink, fontSize: 15, fontWeight: "900" },
  timerSub: {
    color: C.muted,
    fontSize: 11,
    marginTop: 4,
    textAlign: "right",
    writingDirection: "rtl",
  },
  chevron: { color: C.red, fontSize: 24, fontWeight: "800" },
  statsStrip: {
    flexDirection: "row-reverse",
    backgroundColor: C.card,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 13,
    alignItems: "center",
  },
  statCell: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { color: C.ink, fontSize: 16, fontWeight: "900" },
  statLabel: { color: C.muted, fontSize: 10 },
  statDivider: { width: 1, height: 26, backgroundColor: C.line },
  disclaimer: {
    color: "#918B80",
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
    writingDirection: "rtl",
    paddingHorizontal: 10,
  },
  adWrap: { alignItems: "center" },
  bottomNav: {
    flexDirection: "row-reverse",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 9,
    paddingHorizontal: 8,
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center", gap: 1 },
  navIcon: { color: "#9B958A", fontSize: 19, height: 22 },
  navLabel: { color: "#9B958A", fontSize: 9, fontWeight: "700" },
  navActive: { color: C.red, fontWeight: "900" },
  navDot: {
    marginTop: 1,
    width: 4,
    height: 4,
    borderRadius: 4,
    backgroundColor: C.red,
  },
  levelSection: { gap: 10, marginTop: 7 },
  puzzleRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 11,
    padding: 12,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 15,
  },
  puzzleLocked: { opacity: 0.56 },
  puzzleNumber: {
    width: 33,
    height: 33,
    borderRadius: 11,
    backgroundColor: "#F3E7D5",
    alignItems: "center",
    justifyContent: "center",
  },
  puzzleNumberLocked: { backgroundColor: "#EDE8E0" },
  puzzleDone: { backgroundColor: C.green },
  puzzleNumberText: { color: C.ink, fontSize: 11, fontWeight: "800" },
  puzzleDoneText: { color: "white", fontSize: 15 },
  puzzleRowCopy: { flex: 1, alignItems: "flex-end" },
  puzzleCategory: { color: C.red, fontSize: 10, fontWeight: "800" },
  puzzlePrompt: {
    color: C.ink,
    fontSize: 12,
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  achievementSummary: {
    alignItems: "center",
    backgroundColor: "#F9EBD2",
    borderColor: "#EAD5AE",
  },
  summaryPoints: { color: C.ink, fontSize: 34, fontWeight: "900" },
  summaryLabel: { color: C.muted, fontSize: 12, marginTop: -8 },
  summarySmall: { color: C.muted, fontSize: 10 },
  badgeGrid: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 10 },
  badgeCard: {
    width: "48%",
    flexGrow: 1,
    alignItems: "flex-end",
    minHeight: 140,
  },
  badgeLocked: { backgroundColor: "#F0EAE0", opacity: 0.78 },
  badgeIcon: { color: C.red, fontSize: 25, fontWeight: "900" },
  badgeDim: { color: "#BEB7AA", fontSize: 20 },
  badgeTitle: {
    color: C.ink,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  badgeDescription: {
    color: C.muted,
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
    flex: 1,
  },
  streakCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: "#F8E8C9",
  },
  streakCardIcon: { color: C.gold, fontSize: 32 },
  streakCardCopy: { flex: 1, alignItems: "flex-end" },
  cardTitle: {
    color: C.ink,
    fontSize: 14,
    fontWeight: "900",
    textAlign: "right",
  },
  rowDivider: { height: 1, backgroundColor: C.line },
  settingsCard: { paddingVertical: 0, gap: 0 },
  settingRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    paddingVertical: 15,
    gap: 13,
  },
  settingCopy: { flex: 1, alignItems: "flex-end" },
  settingTitle: {
    color: C.ink,
    fontSize: 13,
    fontWeight: "900",
    textAlign: "right",
  },
  settingDescription: {
    color: C.muted,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 3,
    textAlign: "right",
    writingDirection: "rtl",
  },
  switchTrack: {
    width: 42,
    height: 25,
    borderRadius: 13,
    backgroundColor: "#D8D2C7",
    padding: 3,
    justifyContent: "center",
  },
  switchOn: { backgroundColor: C.red },
  switchKnob: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: "white",
    alignSelf: "flex-start",
  },
  switchKnobOn: { alignSelf: "flex-end" },
  infoCard: { gap: 9 },
  smallNote: {
    color: C.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "right",
    writingDirection: "rtl",
  },
  version: { color: "#A39D91", fontSize: 10, textAlign: "center" },
  gameTop: { flexDirection: "row-reverse", alignItems: "center", gap: 11 },
  gameProgressCopy: { flex: 1, alignItems: "flex-end" },
  gameMode: { color: C.ink, fontWeight: "900", fontSize: 14 },
  gameStep: { color: C.muted, fontSize: 10, marginTop: 2 },
  livesBadge: {
    flexDirection: "row-reverse",
    gap: 5,
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: C.redWash,
  },
  livesEmpty: { opacity: 0.55 },
  lifeGlyph: { color: C.red, fontSize: 14 },
  livesText: { color: C.red, fontWeight: "900", fontSize: 12 },
  timerStrip: { flexDirection: "row-reverse", gap: 10, alignItems: "center" },
  timerLeft: {
    color: C.ink,
    fontSize: 11,
    fontWeight: "900",
    width: 70,
    textAlign: "right",
  },
  progressMeta: { flexDirection: "row-reverse", alignItems: "center", gap: 9 },
  categoryMeta: {
    flex: 1,
    color: C.muted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
  },
  questionNumber: { color: C.muted, fontSize: 10 },
  questionCard: { padding: 18, gap: 16, marginTop: 2 },
  questionTop: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
  },
  questionLabel: { color: C.red, fontSize: 11, fontWeight: "800" },
  speakButton: {
    width: 35,
    height: 35,
    borderRadius: 11,
    backgroundColor: "#F1E6D5",
    alignItems: "center",
    justifyContent: "center",
  },
  speakDisabled: { opacity: 0.4 },
  speakGlyph: { color: C.ink, fontSize: 13, fontWeight: "900" },
  questionText: {
    color: C.ink,
    fontSize: 22,
    lineHeight: 35,
    fontWeight: "800",
    textAlign: "right",
    writingDirection: "rtl",
  },
  speechNote: { borderRadius: 12, padding: 11, backgroundColor: "#F8EEDB" },
  speechNoteText: {
    color: "#73664F",
    fontSize: 11,
    lineHeight: 18,
    textAlign: "right",
    writingDirection: "rtl",
  },
  optionsList: { gap: 9 },
  optionRow: {
    minHeight: 49,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: "#FBF8F1",
    borderWidth: 1,
    borderColor: C.line,
  },
  optionSelected: { borderColor: C.red, backgroundColor: "#FFF7F5" },
  optionCorrect: { borderColor: C.green, backgroundColor: C.greenWash },
  optionLetter: {
    width: 27,
    height: 27,
    borderRadius: 9,
    backgroundColor: "#EDE6D9",
    alignItems: "center",
    justifyContent: "center",
  },
  optionLetterSelected: { backgroundColor: C.red },
  optionLetterCorrect: { backgroundColor: C.green },
  optionLetterText: { color: C.muted, fontSize: 10, fontWeight: "900" },
  optionLetterTextSelected: { color: "white" },
  optionText: {
    color: C.ink,
    fontSize: 13,
    flex: 1,
    textAlign: "right",
    writingDirection: "rtl",
  },
  optionTextSelected: { fontWeight: "800" },
  answerBox: { gap: 10 },
  answerInput: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    backgroundColor: "#FBF8F1",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.ink,
    fontSize: 16,
    writingDirection: "rtl",
  },
  inputFootnote: {
    color: C.muted,
    fontSize: 10,
    textAlign: "right",
    writingDirection: "rtl",
  },
  feedbackBox: { borderRadius: 16, padding: 14, gap: 9 },
  feedbackCorrect: { backgroundColor: C.greenWash },
  feedbackWrong: { backgroundColor: "#FBEEEB" },
  feedbackTitle: {
    fontSize: 15,
    fontWeight: "900",
    textAlign: "right",
    writingDirection: "rtl",
  },
  feedbackBody: {
    color: C.ink,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "right",
    writingDirection: "rtl",
  },
  pointsGain: {
    color: C.green,
    fontSize: 11,
    fontWeight: "900",
    textAlign: "right",
  },
  hintToggle: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    paddingTop: 4,
  },
  hintIcon: { color: C.gold, fontSize: 17 },
  hintText: {
    color: C.gold,
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
    textAlign: "right",
  },
  hintBox: {
    borderRightWidth: 3,
    borderRightColor: C.gold,
    backgroundColor: "#FBF2DF",
    padding: 11,
    borderRadius: 10,
  },
  hintBoxText: {
    color: C.ink,
    fontSize: 12,
    textAlign: "right",
    writingDirection: "rtl",
  },
  gameFooter: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  footerNote: { color: C.muted, fontSize: 10, textAlign: "right" },
  timerScore: { color: C.red, fontSize: 10, fontWeight: "800" },
  resultPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 22,
    gap: 15,
  },
  resultStamp: {
    width: 76,
    height: 76,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8E4C6",
    transform: [{ rotate: "-5deg" }],
  },
  resultStampIcon: { color: C.red, fontSize: 42, fontWeight: "900" },
  resultTitle: {
    color: C.ink,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    writingDirection: "rtl",
  },
  resultSubtitle: {
    color: C.muted,
    fontSize: 12,
    textAlign: "center",
    writingDirection: "rtl",
  },
  resultCard: { width: "100%", gap: 12 },
  resultLabel: { color: C.muted, fontSize: 12 },
  resultValue: { color: C.ink, fontSize: 16, fontWeight: "900" },
  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: C.ink,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    maxWidth: "88%",
    zIndex: 20,
  },
  toastText: {
    color: C.card,
    fontSize: 11,
    textAlign: "center",
    writingDirection: "rtl",
  },
});
