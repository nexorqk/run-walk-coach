import { breathingLevelValues, formatTime, type BreathingLevel, type WorkoutSession } from "@run-walk-coach/shared";
import {
  Activity,
  Ban,
  Bed,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Droplets,
  Footprints,
  Gauge,
  HeartPulse,
  Route,
  ShieldAlert,
  Sparkles,
  ThermometerSun,
  Timer,
  TrendingUp
} from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";
import { getSessions } from "../api/client.js";
import { db, type LocalWorkoutSession } from "../db/local-db.js";
import { useAppStore } from "../store/app-store.js";
import {
  buildCoachInsights,
  type CoachInsight,
  type CoachInsightSession
} from "../utils/coach-insights.js";
import {
  breathingLabel,
  formatDateTime,
  localizeProgressionReason,
  localizeTemplateName,
  text,
  type AppLanguage,
  useLanguage
} from "../utils/language.js";

type PulseZone = {
  name: string;
  range: string;
  tone: "easy" | "steady" | "hard" | "alert";
  description: string;
};

type CoachCardTone = "default" | "good" | "amber" | "danger";

type CoachCard = {
  title: string;
  body: string;
  meta?: string;
  icon: ReactElement;
  tone?: CoachCardTone;
};

type GuideTableProps = {
  headers: string[];
  rows: string[][];
};

const aerobicSpeedRows = [
  ["Новичок", "6-8 км/ч", "10:00-7:30 мин/км"],
  ["Любитель с базой", "8-11 км/ч", "7:30-5:25 мин/км"],
  ["Хорошо тренированный бегун", "11-14 км/ч", "5:25-4:15 мин/км"],
  ["Очень сильный любитель / спортсмен", "14-17+ км/ч", "4:15-3:30 мин/км и быстрее"]
];

const currentSpeedRows = [
  ["Низкий пульс / Zone 2 / кардио-зона", "вероятно 5.5-7.5 км/ч, возможно через бег-шаг"],
  ["Лёгкий непрерывный бег, но пульс уже выше", "примерно 7-9 км/ч"],
  ["12 км/ч", "вероятно только короткими отрезками, не в кардио-зоне"]
];

const strideRows = [
  ["160 шагов/мин", "1.25 м"],
  ["170 шагов/мин", "1.18 м"],
  ["180 шагов/мин", "1.11 м"]
];

const breathingPulseRows = [
  ["Можно говорить длинными фразами", "очень легко / восстановление", "можно чуть ускориться, если это не разминка"],
  ["Можно говорить короткими фразами", "аэробная зона / Zone 2", "хороший режим для основной части"],
  ["Получаются только 1-2 слова", "выше лёгкой зоны", "замедлись или продли следующий шаг"],
  ["Дыхание рвётся, говорить почти нельзя", "слишком тяжело", "переходи на шаг до восстановления"]
];

const stopwatchPulseSteps = [
  "Остановись или перейди на шаг и сразу включи секундомер.",
  "Найди пульс на запястье двумя пальцами. Не используй большой палец: у него есть свой пульс.",
  "Считай удары 15 секунд и умножай на 4. Например, 36 ударов за 15 секунд = 144 уд/мин.",
  "Если ритм кажется неровным, считай 30 секунд и умножай на 2: так точнее.",
  "Запиши значение в отчёт как current HR или max HR, если это был пик нагрузки."
];

const pulseFormulaRows = [
  ["10 секунд", "удары x 6", "быстро, но менее точно"],
  ["15 секунд", "удары x 4", "лучший компромисс на тренировке"],
  ["30 секунд", "удары x 2", "точнее, если пульс неровный"]
];

const weeklySchedule = [
  "Понедельник - силовая",
  "Вторник - бег-шаг лёгкий",
  "Среда - отдых / ходьба / велосипед легко",
  "Четверг - силовая",
  "Пятница - бег-шаг лёгкий",
  "Суббота - силовая или велосипед легко",
  "Воскресенье - отдых / прогулка"
];

const progressionSteps = [
  "1 мин бег / 2 мин шаг",
  "1 мин бег / 1 мин шаг",
  "2 мин бег / 1 мин шаг",
  "3 мин бег / 1 мин шаг",
  "5 мин бег / 1 мин шаг",
  "10 мин бег / 1 мин шаг",
  "20-30 мин непрерывного лёгкого бега"
];

const progressCriteria = [
  "На следующий день нет боли в голенях, коленях, ахилле или стопах.",
  "Во время бега пульс не улетает сразу в 160-170.",
  "После тренировки сложность ощущается примерно как 5-6/10, а не как уничтожение."
];

const techniqueTips = [
  "Корпус высокий, без сутулости; представь, что тебя слегка тянут вверх за макушку.",
  "Небольшой наклон всем телом от голеностопа, не сгибание в пояснице.",
  "Взгляд вперёд на 10-20 метров, плечи расслаблены.",
  "Руки согнуты примерно под 80-100 градусов и двигаются назад-вперёд, не поперёк тела.",
  "Стопа ставится под центр тяжести, а не далеко впереди.",
  "Шаг короткий, мягкий и тихий: не тяни ногу вперёд, ставь стопу под себя."
];

const avoidMistakes = [
  "Не начинай с цели пробежать 3 км без остановки.",
  "Не пытайся держать 10-12 км/ч сейчас.",
  "Не делай бег после тяжёлых приседаний, если ноги и дыхание не восстановились.",
  "Не увеличивай одновременно скорость, длительность и количество тренировок.",
  "Не беги через боль в голени, ахилле, колене или стопе."
];

const firstWorkoutSteps = [
  "Разминка: 10 минут быстрая ходьба.",
  "Основная часть: 30 секунд лёгкий бег / 90 секунд шаг, 12 повторов.",
  "Заминка: 5-10 минут спокойная ходьба.",
  "Скорость бега такая, чтобы сознательно казалось: я бегу слишком медленно."
];

const afterWorkoutChecks = [
  "Средний и максимальный пульс.",
  "Сложность по шкале 1-10.",
  "Где усталость: дыхание, ноги, голени, сердце.",
  "Была ли боль.",
  "Какое восстановление через 10 минут."
];

type CollapsibleSectionProps = {
  summary: ReactElement | string;
  children: ReactElement | ReactElement[];
};

function CollapsibleSection({ summary, children }: CollapsibleSectionProps) {
  return (
    <details className="collapsible-section" open>
      <summary>
        {typeof summary === "string" ? <h2>{summary}</h2> : summary}
      </summary>
      <div className="collapsible-body">
        {children}
      </div>
    </details>
  );
}

function GuideTable({ headers, rows }: GuideTableProps) {
  return (
    <div className="guide-table-wrap">
      <table className="guide-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row.join("|")}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cellIndex}-${cell}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GuideList({ items }: { items: string[] }) {
  return (
    <ul className="guide-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function CoachCardGrid({ cards }: { cards: CoachCard[] }) {
  return (
    <div className="coach-card-grid">
      {cards.map((card) => (
        <article className={`coach-card coach-card-${card.tone ?? "default"}`} key={card.title}>
          <div className="coach-card-heading">
            {card.icon}
            <h3>{card.title}</h3>
          </div>
          <p>{card.body}</p>
          {card.meta ? <span>{card.meta}</span> : null}
        </article>
      ))}
    </div>
  );
}

function localToCoachSession(session: LocalWorkoutSession): CoachInsightSession {
  return {
    date: session.date,
    completed: session.completed,
    totalDurationSec: session.totalDurationSec,
    totalRunSec: session.totalRunSec,
    avgHr: session.avgHr,
    maxHr: session.maxHr,
    stopwatchPulseBpm: session.stopwatchPulseBpm,
    heartRateZone: session.heartRateZone,
    distanceMeters: session.distanceMeters,
    avgPaceSecPerKm: session.avgPaceSecPerKm,
    avgSpeedKmh: session.avgSpeedKmh,
    cadenceSpm: session.cadenceSpm,
    difficulty: session.difficulty,
    breathing: session.breathing,
    pain: session.pain
  };
}

function remoteToCoachSession(session: WorkoutSession): CoachInsightSession {
  return {
    date: session.date,
    completed: session.completed,
    totalDurationSec: session.totalDurationSec,
    totalRunSec: session.totalRunSec,
    avgHr: session.avgHr,
    maxHr: session.maxHr,
    stopwatchPulseBpm: session.stopwatchPulseBpm,
    heartRateZone: session.heartRateZone,
    distanceMeters: session.distanceMeters,
    avgPaceSecPerKm: session.avgPaceSecPerKm,
    avgSpeedKmh: session.avgSpeedKmh,
    cadenceSpm: session.cadenceSpm,
    difficulty: session.difficulty,
    breathing: session.breathing,
    pain: session.pain
  };
}

function pulseZones(easyMin: number, easyMax: number, language: AppLanguage): PulseZone[] {
  return [
    {
      name: text(language, { en: "Recovery", ru: "Восстановление" }),
      range: `< ${easyMin}`,
      tone: "easy",
      description: text(language, {
        en: "Use this for warmup, cooldown, and days when legs feel heavy.",
        ru: "Используй для разминки, заминки и дней, когда ноги тяжёлые."
      })
    },
    {
      name: text(language, { en: "Easy run", ru: "Лёгкий бег" }),
      range: `${easyMin}-${easyMax}`,
      tone: "easy",
      description: text(language, {
        en: "Main development zone: breathing controlled, conversation possible.",
        ru: "Главная зона развития: дыхание контролируемое, разговор возможен."
      })
    },
    {
      name: text(language, { en: "Steady", ru: "Устойчиво" }),
      range: `${easyMax + 1}-${easyMax + 15}`,
      tone: "steady",
      description: text(language, {
        en: "Useful in small doses, but not the target for most run-walk sessions.",
        ru: "Полезно малыми дозами, но не цель большинства бег-шаг тренировок."
      })
    },
    {
      name: text(language, { en: "Hard", ru: "Тяжело" }),
      range: `${easyMax + 16}-${easyMax + 30}`,
      tone: "hard",
      description: text(language, {
        en: "Short efforts only. Repeat the level if this appears often.",
        ru: "Только короткие отрезки. Повторяй уровень, если это часто появляется."
      })
    },
    {
      name: text(language, { en: "Too high", ru: "Слишком высоко" }),
      range: `> ${easyMax + 30}`,
      tone: "alert",
      description: text(language, {
        en: "Back off to walking until breathing and pulse settle.",
        ru: "Переходи на шаг, пока дыхание и пульс не успокоятся."
      })
    }
  ];
}

function currentPulseAdvice(
  heartRate: number | undefined,
  breathing: BreathingLevel,
  easyMin: number,
  easyMax: number,
  language: AppLanguage
) {
  if (!heartRate) {
    return text(language, {
      en: "Enter current heart rate during or after a workout for a pacing cue.",
      ru: "Введи текущий пульс во время или после отрезка, чтобы получить подсказку."
    });
  }

  if (heartRate > easyMax + 30 || breathing === "VERY_HARD") {
    return text(language, {
      en: "Switch to walking now. Resume running only after pulse and breathing drop back under control.",
      ru: "Переходи на шаг. Возвращай бег только когда пульс и дыхание снова под контролем."
    });
  }

  if (heartRate > easyMax || breathing === "HARD") {
    return text(language, {
      en: "Slow the run segment or extend the next walk. The goal is controlled effort, not speed.",
      ru: "Замедли беговой отрезок или продли следующий шаг. Цель - контроль усилия, не скорость."
    });
  }

  if (heartRate < easyMin && breathing === "EASY") {
    return text(language, {
      en: "You are below the easy target. Stay relaxed, or progress only if the full workout feels controlled.",
      ru: "Ты ниже лёгкого диапазона. Оставайся расслабленным, прогрессируй только если вся тренировка контролируемая."
    });
  }

  return text(language, {
    en: "Good training zone. Keep the current rhythm and finish with the same control.",
    ru: "Хорошая тренировочная зона. Держи текущий ритм и закончи с тем же контролем."
  });
}

function latestSessionCue(session: CoachInsightSession | undefined, language: AppLanguage) {
  if (!session) {
    return text(language, {
      en: "Complete a workout report to unlock feedback from your own sessions.",
      ru: "Заполни отчёт после тренировки, чтобы получать обратную связь по своим данным."
    });
  }

  if (session.pain !== "NONE") {
    return text(language, {
      en: "Pain was reported last time. Keep the next session easier and stop if pain changes your stride.",
      ru: "В прошлый раз была боль. Следующую тренировку сделай легче и остановись, если боль меняет шаг."
    });
  }

  if (session.difficulty >= 8 || session.breathing === "VERY_HARD") {
    return text(language, {
      en: "The last session was too demanding. Repeat the level and make the walk breaks calmer.",
      ru: "Прошлая тренировка была слишком тяжёлой. Повтори уровень и сделай шаговые паузы спокойнее."
    });
  }

  if (session.maxHr !== null && session.maxHr !== undefined && session.maxHr >= 170) {
    return text(language, {
      en: "Max pulse was high last time. Start slower and protect the first half of the workout.",
      ru: "Максимальный пульс был высоким. Начни медленнее и береги первую половину тренировки."
    });
  }

  if (session.difficulty <= 6 && ["EASY", "MEDIUM", "HARD"].includes(session.breathing)) {
    return text(language, {
      en: "Last session looked controlled. One more controlled session at this level supports progression.",
      ru: "Прошлая тренировка выглядела контролируемой. Ещё одна такая тренировка на уровне поддержит прогресс."
    });
  }

  return text(language, {
    en: "Repeat the current level until effort, breathing, and pulse are predictable.",
    ru: "Повторяй текущий уровень, пока усилие, дыхание и пульс не станут предсказуемыми."
  });
}

function insightCard(insight: CoachInsight, language: AppLanguage): CoachCard {
  const copy: Record<CoachInsight["code"], { title: Record<AppLanguage, string>; body: Record<AppLanguage, string>; meta?: Record<AppLanguage, string> }> = {
    "no-data": {
      title: { en: "Save a few reports", ru: "Сохрани несколько отчётов" },
      body: {
        en: "Coach insights need workout reports with pulse, pace, cadence, breathing and pain.",
        ru: "Для coach insights нужны отчёты с пульсом, темпом, каденсом, дыханием и болью."
      }
    },
    pain: {
      title: { en: "Pain is the limiter", ru: "Боль сейчас главный лимит" },
      body: {
        en: "Do not progress load until the same pain is gone and stride feels normal.",
        ru: "Не увеличивай нагрузку, пока эта боль не ушла и шаг не стал нормальным."
      }
    },
    "hard-load": {
      title: { en: "Load felt too hard", ru: "Нагрузка была тяжёлой" },
      body: {
        en: "Difficulty or breathing says the last session was closer to hard work than base building.",
        ru: "Сложность или дыхание говорят, что последняя тренировка была ближе к тяжёлой, чем к базовой."
      }
    },
    "hr-high": {
      title: { en: "Pulse drifted high", ru: "Пульс ушёл высоко" },
      body: {
        en: "Repeat the level, start slower, and extend walk breaks before adding volume.",
        ru: "Повтори уровень, начни медленнее и продли шаговые паузы перед увеличением объёма."
      }
    },
    "efficiency-up": {
      title: { en: "Efficiency is improving", ru: "Экономичность растёт" },
      body: {
        en: "Recent pace improved without a higher pulse. This is the signal you want.",
        ru: "Последний темп улучшился без роста пульса. Это именно тот сигнал, который нужен."
      }
    },
    "efficiency-drift": {
      title: { en: "Pace costs more pulse", ru: "Темп стоит дороже по пульсу" },
      body: {
        en: "The same or faster pace now needs a higher pulse. Keep the next run easier.",
        ru: "Тот же или более быстрый темп теперь требует более высокого пульса. Следующий бег сделай легче."
      }
    },
    "cadence-low": {
      title: { en: "Cadence is low", ru: "Каденс низковат" },
      body: {
        en: "Try a slightly shorter, quicker step. Do not force a long stride.",
        ru: "Попробуй чуть короче и чаще шаг. Не растягивай шаг специально."
      }
    },
    "cadence-good": {
      title: { en: "Cadence looks useful", ru: "Каденс выглядит полезно" },
      body: {
        en: "This step rate can reduce braking and keep the run smoother.",
        ru: "Такая частота шага помогает меньше тормозить и бежать мягче."
      }
    },
    "distance-consistency": {
      title: { en: "Consistency is forming", ru: "Появляется регулярность" },
      body: {
        en: "You have several distance-tracked sessions in the last two weeks.",
        ru: "За последние две недели есть несколько тренировок с дистанцией."
      }
    }
  };
  const iconByCode: Record<CoachInsight["code"], ReactElement> = {
    "no-data": <BookOpen aria-hidden="true" size={22} />,
    pain: <ShieldAlert aria-hidden="true" size={22} />,
    "hard-load": <Gauge aria-hidden="true" size={22} />,
    "hr-high": <HeartPulse aria-hidden="true" size={22} />,
    "efficiency-up": <TrendingUp aria-hidden="true" size={22} />,
    "efficiency-drift": <ThermometerSun aria-hidden="true" size={22} />,
    "cadence-low": <Footprints aria-hidden="true" size={22} />,
    "cadence-good": <Footprints aria-hidden="true" size={22} />,
    "distance-consistency": <Route aria-hidden="true" size={22} />
  };
  const toneBySeverity: Record<CoachInsight["severity"], CoachCardTone> = {
    good: "good",
    info: "default",
    caution: "amber",
    danger: "danger"
  };
  const meta =
    insight.value === undefined
      ? undefined
      : insight.code === "efficiency-up"
        ? text(language, { en: `${insight.value} sec/km faster`, ru: `быстрее на ${insight.value} сек/км` })
        : insight.code === "efficiency-drift"
          ? text(language, { en: `+${insight.value} bpm`, ru: `+${insight.value} уд/мин` })
          : insight.code === "distance-consistency"
            ? text(language, { en: `${insight.value} km in 14 days`, ru: `${insight.value} км за 14 дней` })
            : String(insight.value);

  return {
    title: text(language, copy[insight.code].title),
    body: text(language, copy[insight.code].body),
    meta,
    icon: iconByCode[insight.code],
    tone: toneBySeverity[insight.severity]
  };
}

export function CoachPage() {
  const profile = useAppStore((state) => state.profile);
  const recommendation = useAppStore((state) => state.recommendation);
  const serverSyncEnabled = useAppStore((state) => state.serverSyncEnabled);
  const { language, t } = useLanguage();
  const [coachSessions, setCoachSessions] = useState<CoachInsightSession[]>([]);
  const [heartRateInput, setHeartRateInput] = useState("");
  const [breathing, setBreathing] = useState<BreathingLevel>("MEDIUM");
  const easyMin = profile?.easyHrMin ?? 130;
  const easyMax = profile?.easyHrMax ?? 150;
  const practicalHrMax = Math.min(easyMax, 145);
  const practicalHrRange = easyMin <= practicalHrMax ? `${easyMin}-${practicalHrMax}` : `${easyMin}-${easyMax}`;
  const currentHeartRate = heartRateInput.trim() === "" ? undefined : Number(heartRateInput);
  const zones = useMemo(() => pulseZones(easyMin, easyMax, language), [easyMin, easyMax, language]);
  const latestSession = coachSessions[0];
  const smartInsightCards = useMemo(
    () => buildCoachInsights({ easyHrMax: easyMax, sessions: coachSessions }).map((insight) => insightCard(insight, language)),
    [coachSessions, easyMax, language]
  );
  const todayCards: CoachCard[] = [
    {
      title: t({ en: "Warm up first", ru: "Сначала разминка" }),
      body: t({
        en: "Walk briskly for 8-10 minutes. Start running only when breathing feels calm and legs are loose.",
        ru: "Иди быстрым шагом 8-10 минут. Начинай бег только когда дыхание спокойное, а ноги включились."
      }),
      meta: t({ en: "No rush in the first minutes", ru: "Первые минуты без спешки" }),
      icon: <Footprints aria-hidden="true" size={22} />,
      tone: "good"
    },
    {
      title: recommendation
        ? localizeTemplateName(recommendation.template.name, language)
        : t({ en: "Main set", ru: "Основная часть" }),
      body: recommendation
        ? `${formatTime(recommendation.template.runSec)} ${t({ en: "run", ru: "бег" })} / ${formatTime(recommendation.template.walkSec)} ${t({ en: "walk", ru: "шаг" })}, ${recommendation.template.repeats}x.`
        : t({
            en: "Use the current run-walk plan and keep every run segment repeatable.",
            ru: "Используй текущий план бег-шаг и держи каждый беговой отрезок повторяемым."
          }),
      meta: `${t({ en: "Target HR", ru: "Целевой пульс" })}: ${easyMin}-${easyMax}`,
      icon: <Route aria-hidden="true" size={22} />
    },
    {
      title: t({ en: "Control rule", ru: "Правило контроля" }),
      body: t({
        en: "If pulse climbs above the easy ceiling or speech breaks down, switch to walking before the workout turns hard.",
        ru: "Если пульс выше лёгкого потолка или речь разваливается, переходи на шаг до того, как тренировка станет тяжёлой."
      }),
      meta: `HR > ${easyMax}: ${t({ en: "walk earlier", ru: "раньше переходи на шаг" })}`,
      icon: <HeartPulse aria-hidden="true" size={22} />,
      tone: "amber"
    },
    {
      title: t({ en: "After the workout", ru: "После тренировки" }),
      body: t({
        en: "Save distance, pace, pulse, cadence, breathing, pain and notes. The next recommendation depends on this report.",
        ru: "Сохрани дистанцию, темп, пульс, каденс, дыхание, боль и заметки. От этого зависит следующая рекомендация."
      }),
      icon: <CheckCircle2 aria-hidden="true" size={22} />,
      tone: "good"
    }
  ];
  const highPulseCards: CoachCard[] = [
    {
      title: t({ en: "Start was too fast", ru: "Слишком быстрый старт" }),
      body: t({
        en: "The first run segment often decides the whole workout. Start slower than you think you need.",
        ru: "Первый беговой отрезок часто решает всю тренировку. Начинай медленнее, чем кажется нужным."
      }),
      icon: <Gauge aria-hidden="true" size={22} />
    },
    {
      title: t({ en: "Walk breaks are not restoring", ru: "Шаг не восстанавливает" }),
      body: t({
        en: "If the next run starts at a high pulse, extend walking until breathing is controlled again.",
        ru: "Если следующий бег начинается на высоком пульсе, продли шаг до управляемого дыхания."
      }),
      icon: <Timer aria-hidden="true" size={22} />
    },
    {
      title: t({ en: "Heat, sleep, stress", ru: "Жара, сон, стресс" }),
      body: t({
        en: "Poor sleep, heat, dehydration, caffeine and stress can push heart rate up at the same pace.",
        ru: "Недосып, жара, обезвоживание, кофеин и стресс могут поднимать пульс на том же темпе."
      }),
      icon: <ThermometerSun aria-hidden="true" size={22} />,
      tone: "amber"
    },
    {
      title: t({ en: "Aerobic base is lagging", ru: "Кардио-база отстаёт" }),
      body: t({
        en: "If easy running quickly becomes 160-170 bpm, use run-walk. This is the training target, not a failure.",
        ru: "Если лёгкий бег быстро становится 160-170, используй бег-шаг. Это цель тренировки, а не провал."
      }),
      icon: <TrendingUp aria-hidden="true" size={22} />
    }
  ];
  const stopwatchCards: CoachCard[] = [
    {
      title: t({ en: "Find the pulse", ru: "Найди пульс" }),
      body: t({
        en: "Use two fingers on the wrist. Do not use the thumb because it has its own pulse.",
        ru: "Двумя пальцами на запястье. Большой палец не используй: у него есть собственный пульс."
      }),
      icon: <HeartPulse aria-hidden="true" size={22} />
    },
    {
      title: t({ en: "Count 15 seconds", ru: "Считай 15 секунд" }),
      body: t({
        en: "Count beats for 15 seconds and multiply by 4. Example: 36 beats = 144 bpm.",
        ru: "Считай удары 15 секунд и умножай на 4. Пример: 36 ударов = 144 уд/мин."
      }),
      meta: t({ en: "30 seconds x2 if rhythm is uneven", ru: "30 секунд x2, если ритм неровный" }),
      icon: <Timer aria-hidden="true" size={22} />,
      tone: "good"
    },
    {
      title: t({ en: "Measure immediately", ru: "Меряй сразу" }),
      body: t({
        en: "Measure right after a run segment or at the end. Pulse drops quickly once you walk.",
        ru: "Меряй сразу после бегового отрезка или в конце. На шаге пульс быстро падает."
      }),
      icon: <Activity aria-hidden="true" size={22} />
    },
    {
      title: t({ en: "Save it in report", ru: "Сохрани в отчёт" }),
      body: t({
        en: "Use the “Pulse by stopwatch” field so History and Stats can keep this signal.",
        ru: "Запиши в поле “Пульс по секундомеру”, чтобы History и Stats учитывали этот сигнал."
      }),
      icon: <BookOpen aria-hidden="true" size={22} />
    }
  ];
  const doNotRunCards: CoachCard[] = [
    {
      title: t({ en: "Red-flag symptoms", ru: "Красные флаги" }),
      body: t({
        en: "Do not run with chest pain, severe shortness of breath, faintness, dizziness, or near-fainting.",
        ru: "Не беги при боли в груди, сильной одышке, предобморочном состоянии, головокружении или ощущении, что сейчас потеряешь сознание."
      }),
      meta: t({ en: "Stop and seek medical help if this appears", ru: "Остановись и обратись за медпомощью, если это появилось" }),
      icon: <ShieldAlert aria-hidden="true" size={22} />,
      tone: "danger"
    },
    {
      title: t({ en: "Fever or flu-like illness", ru: "Температура или гриппоподобное состояние" }),
      body: t({
        en: "If you feel systemically ill, replace training with rest. Resume with an easy walk first.",
        ru: "Если болеешь системно, замени тренировку отдыхом. Возвращайся сначала через лёгкую прогулку."
      }),
      icon: <Bed aria-hidden="true" size={22} />,
      tone: "amber"
    },
    {
      title: t({ en: "Heat stress", ru: "Перегрев" }),
      body: t({
        en: "Heavy sweating with dizziness, nausea, cramps or a racing pulse is a reason to stop and cool down.",
        ru: "Сильное потоотделение с головокружением, тошнотой, судорогами или частым пульсом — причина остановиться и охладиться."
      }),
      icon: <Droplets aria-hidden="true" size={22} />,
      tone: "amber"
    },
    {
      title: t({ en: "Pain changes your stride", ru: "Боль меняет шаг" }),
      body: t({
        en: "Sharp or local pain in the shin, knee, Achilles, foot or hip means walking or rest, not pushing through.",
        ru: "Острая или локальная боль в голени, колене, ахилле, стопе или тазу — это шаг или отдых, а не терпеть дальше."
      }),
      icon: <Ban aria-hidden="true" size={22} />,
      tone: "danger"
    }
  ];

  useEffect(() => {
    let ignore = false;

    async function loadCoachSessions() {
      try {
        if (serverSyncEnabled) {
          const remoteSessions = await getSessions();
          if (!ignore) {
            setCoachSessions(remoteSessions.map(remoteToCoachSession));
          }
          return;
        }

        const localSessions = await db.sessions.orderBy("date").reverse().toArray();
        if (!ignore) {
          setCoachSessions(localSessions.map(localToCoachSession));
        }
      } catch {
        const localSessions = await db.sessions.orderBy("date").reverse().toArray();
        if (!ignore) {
          setCoachSessions(localSessions.map(localToCoachSession));
        }
      }
    }

    void loadCoachSessions();

    return () => {
      ignore = true;
    };
  }, [serverSyncEnabled]);

  return (
    <div className="stack">
      <section className="hero-panel">
        <div className="eyebrow">Coach</div>
        <h1>{t({ en: "Pulse and running guide", ru: "Пульс и беговой гид" })}</h1>
        <p className="muted">
          {t({
            en: "Keep most work in the easy zone, progress after controlled sessions, and use walk breaks before pulse turns into a fight.",
            ru: "Держи основную работу в лёгкой зоне, прогрессируй после контролируемых тренировок и переходи на шаг до того, как пульс станет борьбой."
          })}
        </p>
        <div className="badge-row">
          <span className="badge">
            <HeartPulse aria-hidden="true" size={16} />
            Easy HR {easyMin}-{easyMax}
          </span>
          <span className="badge">
            <Activity aria-hidden="true" size={16} />
            {serverSyncEnabled ? t({ en: "Google sync on", ru: "Google sync включён" }) : t({ en: "Local only", ru: "Только локально" })}
          </span>
        </div>
      </section>

      <section className="coach-band">
        <CollapsibleSection
          summary={
            <>
              <div className="eyebrow">{t({ en: "Today", ru: "Сегодня" })}</div>
              <h2>{t({ en: "What to do today", ru: "Что делать сегодня" })}</h2>
            </>
          }
        >
          <p className="muted">
            {localizeProgressionReason(recommendation?.reason, language) ??
              t({ en: "Keep the workout easy and repeatable.", ru: "Держи тренировку лёгкой и повторяемой." })}
          </p>
          <CoachCardGrid cards={todayCards} />
        </CollapsibleSection>
      </section>

      <section className="coach-band">
        <CollapsibleSection
          summary={
            <>
              <div className="eyebrow">{t({ en: "Smart Coach", ru: "Умный Coach" })}</div>
              <h2>{t({ en: "What your data says", ru: "Что говорят твои данные" })}</h2>
            </>
          }
        >
          <p className="muted">
            {t({
              en: "Insights use recent reports: pace, pulse, cadence, breathing, pain and distance.",
              ru: "Выводы используют последние отчёты: темп, пульс, каденс, дыхание, боль и дистанцию."
            })}
          </p>
          <CoachCardGrid cards={smartInsightCards} />
        </CollapsibleSection>
      </section>

      <section className="form-section">
        <CollapsibleSection
          summary={
            <>
              <h2>{t({ en: "Live pacing cue", ru: "Подсказка по темпу" })}</h2>
              <p className="muted">{t({ en: "Use this during a workout or right after a run segment.", ru: "Используй во время тренировки или сразу после бегового отрезка." })}</p>
            </>
          }
        >
          <div className="form-grid two-column">
            <label>
              <span className="field-label">{t({ en: "Current HR", ru: "Текущий пульс" })}</span>
              <input
                inputMode="numeric"
                type="number"
                min="40"
                max="240"
                value={heartRateInput}
                onChange={(event) => setHeartRateInput(event.target.value)}
                placeholder={`${easyMin}-${easyMax}`}
              />
            </label>
            <label>
              <span className="field-label">{t({ en: "Breathing", ru: "Дыхание" })}</span>
              <select value={breathing} onChange={(event) => setBreathing(event.target.value as BreathingLevel)}>
                {breathingLevelValues.map((value) => (
                  <option key={value} value={value}>
                    {breathingLabel(value, language)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="coach-callout">
            <Gauge aria-hidden="true" size={24} />
            <p>{currentPulseAdvice(currentHeartRate, breathing, easyMin, easyMax, language)}</p>
          </div>
        </CollapsibleSection>
      </section>

      <section className="coach-band">
        <CollapsibleSection
          summary={
            <>
              <div className="eyebrow">{t({ en: "Heart rate", ru: "Пульс" })}</div>
              <h2>{t({ en: "Why pulse gets high", ru: "Почему пульс высокий" })}</h2>
            </>
          }
        >
          <p className="muted">
            {t({
              en: "If the same pace suddenly feels harder, look at context before blaming fitness.",
              ru: "Если тот же темп внезапно стал тяжелее, сначала проверь контекст, а не только форму."
            })}
          </p>
          <CoachCardGrid cards={highPulseCards} />
        </CollapsibleSection>
      </section>

      <section className="coach-band">
        <CollapsibleSection
          summary={
            <>
              <div className="eyebrow">{t({ en: "No watch", ru: "Без часов" })}</div>
              <h2>{t({ en: "How to measure pulse", ru: "Как измерить пульс без часов" })}</h2>
            </>
          }
        >
          <p className="muted">
            {t({
              en: "A manual check is not perfect, but it is good enough to decide whether to walk or continue.",
              ru: "Ручной замер не идеален, но его достаточно, чтобы решить: идти шагом или продолжать."
            })}
          </p>
          <CoachCardGrid cards={stopwatchCards} />
        </CollapsibleSection>
      </section>

      <section className="coach-band">
        <CollapsibleSection
          summary={
            <>
              <div className="eyebrow">{t({ en: "Safety", ru: "Безопасность" })}</div>
              <h2>{t({ en: "When not to run", ru: "Когда не бежать" })}</h2>
            </>
          }
        >
          <p className="muted">
            {t({
              en: "The useful training choice is sometimes walking, rest, or medical help.",
              ru: "Иногда лучший тренировочный выбор — ходьба, отдых или медицинская помощь."
            })}
          </p>
          <CoachCardGrid cards={doNotRunCards} />
        </CollapsibleSection>
      </section>

      <section className="form-section">
        <CollapsibleSection
          summary={
            <>
              <h2>{t({ en: "Pulse zones", ru: "Пульсовые зоны" })}</h2>
              <p className="muted">{t({ en: "Based on your easy HR range in Settings.", ru: "На основе лёгкого диапазона пульса из настроек." })}</p>
            </>
          }
        >
          <div className="zone-list">
            {zones.map((zone) => (
              <article className={`zone-row zone-${zone.tone}`} key={zone.name}>
                <div>
                  <strong>{zone.name}</strong>
                  <span>{zone.range}</span>
                </div>
                <p>{zone.description}</p>
              </article>
            ))}
          </div>
        </CollapsibleSection>
      </section>

      <section className="form-section">
        <CollapsibleSection
          summary={
            <>
              <h2>{t({ en: "Last session readout", ru: "Последняя тренировка" })}</h2>
              <p className="muted">
                {latestSession ? formatDateTime(latestSession.date, language) : t({ en: "No report yet", ru: "Отчёта пока нет" })}
              </p>
            </>
          }
        >
          <div className="coach-callout">
            <Footprints aria-hidden="true" size={24} />
            <p>{latestSessionCue(latestSession, language)}</p>
          </div>
        </CollapsibleSection>
      </section>

      <section className="form-section">
        <CollapsibleSection
          summary={
            <>
              <h2>Running development</h2>
              <p className="muted">
                В будущем это приложение будет прокачивать беговые характеристики и показатели
                выносливости: пульс, темп, дыхание, устойчивость и восстановление.
              </p>
            </>
          }
        >
          <div className="coach-callout coach-callout-amber">
            <Sparkles aria-hidden="true" size={24} />
            <p>
              Персональная оценка сейчас показана как recommended-база. Следующий шаг - подбирать
              рекомендации по твоим данным: профилю, отчётам тренировок, пульсу, темпу и восстановлению.
            </p>
          </div>
        </CollapsibleSection>
      </section>

      <section className="form-section guide-copy">
        <CollapsibleSection
          summary={
            <>
              <h2>Кардио-зона и скорость</h2>
              <p className="muted">
                Обычно под кардио-зоной имеют в виду аэробную Zone 2: примерно 60-75% от
                максимального пульса или темп, при котором можно говорить короткими фразами,
                а дыхание учащено, но контролируемое.
              </p>
            </>
          }
        >
          <GuideTable headers={["Уровень", "Скорость в аэробной зоне", "Темп на 1 км"]} rows={aerobicSpeedRows} />

          <p>
            Для хорошо тренированного любителя 12 км/ч в Zone 2 - это уже очень хороший уровень:
            темп 5:00 мин/км при относительно низком пульсе. У нетренированного человека даже
            7-9 км/ч могут быстро уводить пульс в 150-170, а у тренированного на этой скорости
            пульс может быть как при быстрой ходьбе.
          </p>

          <div className="coach-callout">
            <Gauge aria-hidden="true" size={24} />
            <p>
              Ключевой показатель - не сама скорость, а сочетание: темп + пульс + дыхание +
              устойчивость. Если 60 минут на 10 км/ч проходят с пульсом около 130-145 и
              спокойным дыханием, это уже приличная аэробная база.
            </p>
          </div>
        </CollapsibleSection>
      </section>

      <section className="form-section guide-copy">
        <CollapsibleSection
          summary={
            <>
              <h2>Recommended baseline</h2>
              <p className="muted">
                Текущий практичный ориентир - не 12 км/ч, а 40 минут движения в районе
                {` ${practicalHrRange} `}без развала дыхания.
              </p>
            </>
          }
        >
          <div className="badge-row">
            <span className="badge">Recommended</span>
            <span className="badge">Run-walk first</span>
            <span className="badge">HR {easyMin}-{easyMax}</span>
          </div>

          <p>
            Оценка сейчас такая: мышечно тело может быть готово к бегу, но кардио-база часто
            отстаёт. Если при лёгком беге пульс быстро уходит к 160-170, главный лимит - не
            ноги, а аэробная система.
          </p>

          <GuideTable headers={["Цель", "Примерная скорость сейчас"]} rows={currentSpeedRows} />

          <p>
            12 км/ч - это темп 5:00 мин/км. Бежать так короткими отрезками и держать такой темп
            в кардио-зоне - разные уровни. Сейчас это долгосрочный ориентир хорошей беговой
            формы, а не ближайшая зона лёгкой работы.
          </p>

          <GuideTable headers={["Каденс для 12 км/ч", "Нужная длина шага"]} rows={strideRows} />

          <p>
            Для роста 185 см длина шага 1.1-1.25 м на темпе 5:00/км нормальна, но её не нужно
            специально растягивать. Она должна вырасти за счёт скорости, упругости стопы,
            работы бедра и техники. Искусственно длинный шаг часто перегружает колени, голени
            и ахилл.
          </p>
        </CollapsibleSection>
      </section>

      <section className="form-section guide-copy">
        <CollapsibleSection
          summary={
            <>
              <h2>Тренировочная прогрессия</h2>
              <p className="muted">
                Начинай не с обычного непрерывного бега, а с бег-шага по пульсу. Цель - научить
                сердце, дыхание, связки и голени выдерживать регулярную аэробную работу.
              </p>
            </>
          }
        >

        <details className="guide-details">
          <summary>Первые 4 недели</summary>
          <div className="guide-details-body">
            <p>
              Разминка: 8-10 минут быстрой ходьбы, затем 2-3 минуты суставной разминки и
              2-3 коротких лёгких ускорения по 10-15 секунд.
            </p>
            <p>
              Недели 1-2: 1 минута лёгкий бег / 2 минуты шаг, 8-10 повторов. Если пульс
              быстро уходит выше 155-160, делай мягче: 30 секунд бег / 90 секунд шаг,
              10-12 повторов.
            </p>
            <p>
              Недели 3-4: 90 секунд лёгкий бег / 2 минуты шаг, 8 повторов, или 1 минута
              бег / 1 минута шаг, 12-15 повторов. Выбирай вариант, где дыхание остаётся
              управляемым.
            </p>
            <p>Заминка: 5-10 минут спокойной ходьбы до снижения пульса.</p>
          </div>
        </details>

        <details className="guide-details">
          <summary>Частота и неделя</summary>
          <div className="guide-details-body">
            <p>
              Оптимальный старт - 2 беговые тренировки в неделю + 2-3 силовые, без попытки
              сразу держать непрерывный бег.
            </p>
            <GuideList items={weeklySchedule} />
            <p>
              Через 4-6 недель можно перейти к 3 беговым, но только если нет проблем с
              голенями, коленями, ахиллом и восстановлением.
            </p>
          </div>
        </details>

        <details className="guide-details">
          <summary>Когда усложнять</summary>
          <div className="guide-details-body">
            <GuideList items={progressCriteria} />
            <p>Увеличивай не скорость, а долю бега. Скорость должна подтянуться позже.</p>
            <ol className="guide-ladder">
              {progressionSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </details>

        <details className="guide-details">
          <summary>Техника, шаг и каденс</summary>
          <div className="guide-details-body">
            <GuideList items={techniqueTips} />
            <p>
              На лёгком беге сейчас лучше ориентироваться на шаг 80-100 см и каденс
              155-175 шагов/мин. Не нужно насильно держать 180: сделай шаг чуть короче
              и чуть чаще, чтобы снизить ударную нагрузку.
            </p>
          </div>
        </details>

        <details className="guide-details">
          <summary>Дыхание и пульс</summary>
          <div className="guide-details-body">
            <p>
              Не нужно жёстко дышать только носом. Для лёгкого бега подходит вдох носом
              или нос+рот, выдох ртом. Если можешь сказать только 1-2 слова, интенсивность
              слишком высокая.
            </p>
            <div className="guide-subsection">
              <h3>Оценка по дыханию</h3>
              <GuideTable
                headers={["Дыхание", "Примерная зона", "Что делать"]}
                rows={breathingPulseRows}
              />
              <p>
                Дыхание не заменяет точный пульсометр, но помогает быстро понять интенсивность.
                Для развития базы держи режим, где короткие фразы ещё возможны, а дыхание
                остаётся управляемым.
              </p>
            </div>
            <div className="guide-metric-grid">
              <div>
                <strong>До 145</strong>
                <span>отлично</span>
              </div>
              <div>
                <strong>145-155</strong>
                <span>допустимо</span>
              </div>
              <div>
                <strong>155-160</strong>
                <span>осторожно</span>
              </div>
              <div>
                <strong>160+</strong>
                <span>переход на шаг</span>
              </div>
            </div>
            <p>
              Во время шага жди, пока пульс опустится хотя бы к 125-140. Не нужно ждать
              полного восстановления до 100-110, но и начинать следующий отрезок на
              155-160 не стоит.
            </p>
            <div className="guide-subsection">
              <h3>Замер по секундомеру</h3>
              <GuideList items={stopwatchPulseSteps} />
              <GuideTable headers={["Время замера", "Формула", "Когда использовать"]} rows={pulseFormulaRows} />
              <div className="coach-callout coach-callout-amber">
                <HeartPulse aria-hidden="true" size={24} />
                <p>
                  Если измеряешь на шее, нажимай мягко и только с одной стороны. Не используй
                  ручной замер для диагностики: при боли в груди, сильном головокружении,
                  необычной одышке или обморочном состоянии прекращай тренировку.
                </p>
              </div>
            </div>
          </div>
        </details>

        <details className="guide-details">
          <summary>Ошибки и первая тренировка</summary>
          <div className="guide-details-body">
            <div className="coach-callout coach-callout-danger">
              <ShieldAlert aria-hidden="true" size={24} />
              <p>
                Одышка и усталость допустимы. Локальная боль в суставах, сухожилиях,
                голени, ахилле, колене или стопе - нет.
              </p>
            </div>
            <GuideList items={avoidMistakes} />
            <div className="guide-subsection">
              <h3>Конкретная первая тренировка</h3>
              <GuideList items={firstWorkoutSteps} />
            </div>
            <div className="guide-subsection">
              <h3>Что оценить после</h3>
              <GuideList items={afterWorkoutChecks} />
            </div>
          </div>
        </details>
        </CollapsibleSection>
      </section>

      <section className="form-section guide-copy">
        <CollapsibleSection
          summary={
            <>
              <h2>Долгосрочный ориентир</h2>
              <p className="muted">
                12 км/ч в низкой кардио-зоне - не ближайшая цель, а ориентир сильной аэробной
                формы.
              </p>
            </>
          }
        >
          <div className="guide-timeline">
            <div>
              <CalendarDays aria-hidden="true" size={22} />
              <strong>2-3 месяца</strong>
              <span>уверенный бег-шаг или лёгкий непрерывный бег 30-40 минут</span>
            </div>
            <div>
              <Route aria-hidden="true" size={22} />
              <strong>4-6 месяцев</strong>
              <span>примерно 8-10 км/ч при более контролируемом пульсе</span>
            </div>
            <div>
              <TrendingUp aria-hidden="true" size={22} />
              <strong>9-12 месяцев</strong>
              <span>12 км/ч как рабочая скорость коротких или средних отрезков</span>
            </div>
            <div>
              <BookOpen aria-hidden="true" size={22} />
              <strong>12-24 месяца</strong>
              <span>цель: 12 км/ч как аэробный темп на 40-60 минут</span>
            </div>
          </div>
        </CollapsibleSection>
      </section>
    </div>
  );
}
