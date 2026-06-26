import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type AppLanguage, useLanguage } from "../utils/language.js";
import { getOnboardingComplete } from "../utils/onboarding.js";

const REDUCED_MOTION =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(REDUCED_MOTION);

  useEffect(() => {
    if (REDUCED_MOTION) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function RevealBlock({ children, className = "", delay = 0 }: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useScrollReveal();

  return (
    <div
      ref={ref}
      className={`landing-reveal ${visible ? "landing-reveal-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function LandingPage() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const hasOnboarded = getOnboardingComplete();

  const switchLang = (lang: AppLanguage) => {
    setLanguage(lang);
  };

  return (
    <div className="landing">
      <nav className="landing-topbar">
        <span className="landing-topbar-brand">RunWalk Coach</span>
        <div className="landing-lang-switch" role="group" aria-label="Language">
          <button
            className={`landing-lang-btn${language === "en" ? " active" : ""}`}
            type="button"
            onClick={() => switchLang("en")}
          >
            EN
          </button>
          <button
            className={`landing-lang-btn${language === "ru" ? " active" : ""}`}
            type="button"
            onClick={() => switchLang("ru")}
          >
            RU
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <h1 className="landing-display landing-reveal landing-reveal-visible landing-hero-anim">
          {t({ en: "RUN. WALK. REPEAT.", ru: "БЕГИ. ИДИ. ПОВТОРИ." })}
        </h1>
        <p className="landing-hero-sub landing-reveal landing-reveal-visible landing-hero-anim">
          {t({
            en: "A personal running assistant that builds your aerobic base with smart run-walk progression, heart rate guidance, and breathing feedback.",
            ru: "Персональный беговой помощник, который строит аэробную базу с умной прогрессией бег-шаг, контролем пульса и дыхания."
          })}
        </p>
        <div className="landing-hero-actions landing-reveal landing-reveal-visible landing-hero-anim">
          <button
            className="landing-cta-btn"
            type="button"
            onClick={() => navigate(hasOnboarded ? "/today" : "/onboarding")}
          >
            {hasOnboarded
              ? t({ en: "Open today", ru: "Сегодня" })
              : t({ en: "Get started", ru: "Начать" })}
          </button>
        </div>
      </section>

      <RevealBlock className="landing-divider-wrap">
        <div className="landing-divider" />
      </RevealBlock>

      <section className="landing-features" aria-label={t({ en: "Features", ru: "Возможности" })}>
        <RevealBlock delay={0}>
          <div className="landing-feature">
            <span className="landing-feature-num">01</span>
            <div>
              <h3>{t({ en: "Guided timer", ru: "Таймер" })}</h3>
              <p>
                {t({
                  en: "Full-screen timer with warmup, run, walk, and cooldown phases. One tap to pause, resume, finish.",
                  ru: "Полноэкранный таймер с фазами разминки, бега, шага и заминки. Пауза, продолжение и завершение одним касанием."
                })}
              </p>
            </div>
          </div>
        </RevealBlock>

        <RevealBlock delay={60}>
          <div className="landing-feature">
            <span className="landing-feature-num">02</span>
            <div>
              <h3>{t({ en: "Smart progression", ru: "Умная прогрессия" })}</h3>
              <p>
                {t({
                  en: "The coach analyzes effort, breathing, pain, and heart rate to recommend your next workout.",
                  ru: "Тренер анализирует усилие, дыхание, боль и пульс, чтобы рекомендовать следующую тренировку."
                })}
              </p>
            </div>
          </div>
        </RevealBlock>

        <RevealBlock delay={120}>
          <div className="landing-feature">
            <span className="landing-feature-num">03</span>
            <div>
              <h3>{t({ en: "Heart rate zones", ru: "Зоны пульса" })}</h3>
              <p>
                {t({
                  en: "Set your easy heart rate range. Get real-time pacing cues to stay in the aerobic zone.",
                  ru: "Настрой диапазон лёгкого пульса. Получай подсказки по темпу для аэробной зоны."
                })}
              </p>
            </div>
          </div>
        </RevealBlock>

        <RevealBlock delay={180}>
          <div className="landing-feature">
            <span className="landing-feature-num">04</span>
            <div>
              <h3>{t({ en: "Progress tracking", ru: "Прогресс" })}</h3>
              <p>
                {t({
                  en: "History, weekly analytics, and trend charts. See how your running improves over time.",
                  ru: "История, недельная аналитика и графики трендов. Видно, как бег улучшается со временем."
                })}
              </p>
            </div>
          </div>
        </RevealBlock>

        <RevealBlock delay={240}>
          <div className="landing-feature">
            <span className="landing-feature-num">05</span>
            <div>
              <h3>{t({ en: "Offline-first", ru: "Офлайн" })}</h3>
              <p>
                {t({
                  en: "Workouts save to your browser. No account needed to start training.",
                  ru: "Тренировки сохраняются в браузере. Аккаунт не нужен."
                })}
              </p>
            </div>
          </div>
        </RevealBlock>

        <RevealBlock delay={300}>
          <div className="landing-feature">
            <span className="landing-feature-num">06</span>
            <div>
              <h3>{t({ en: "Privacy-first", ru: "Приватность" })}</h3>
              <p>
                {t({
                  en: "Optionally sync with Google. No GPS, no social feed, no ads. Your data stays yours.",
                  ru: "По желанию — синхронизация через Google. Нет GPS, ленты, рекламы. Твои данные — твои."
                })}
              </p>
            </div>
          </div>
        </RevealBlock>
      </section>

      <RevealBlock className="landing-divider-wrap">
        <div className="landing-divider" />
      </RevealBlock>

      <section className="landing-how" aria-label={t({ en: "How it works", ru: "Как это работает" })}>
        <RevealBlock>
          <h2 className="landing-section-title">
            {t({ en: "HOW IT WORKS", ru: "КАК ЭТО РАБОТАЕТ" })}
          </h2>
        </RevealBlock>
        <div className="landing-steps">
          <RevealBlock delay={0}>
            <div className="landing-step">
              <span className="landing-step-num">1</span>
              <div>
                <strong>{t({ en: "Get your recommendation", ru: "Получи рекомендацию" })}</strong>
                <p>
                  {t({
                    en: "Open the app. See today's workout based on your recent sessions.",
                    ru: "Открой приложение. Увидь сегодняшнюю тренировку на основе недавних занятий."
                  })}
                </p>
              </div>
            </div>
          </RevealBlock>
          <RevealBlock delay={100}>
            <div className="landing-step">
              <span className="landing-step-num">2</span>
              <div>
                <strong>{t({ en: "Follow the timer", ru: "Следуй таймеру" })}</strong>
                <p>
                  {t({
                    en: "Run and walk when the timer tells you. The coach guides your pace and breathing.",
                    ru: "Беги и шагай, когда таймер подсказывает. Тренер направляет темп и дыхание."
                  })}
                </p>
              </div>
            </div>
          </RevealBlock>
          <RevealBlock delay={200}>
            <div className="landing-step">
              <span className="landing-step-num">3</span>
              <div>
                <strong>{t({ en: "Log and progress", ru: "Запиши и прогрессируй" })}</strong>
                <p>
                  {t({
                    en: "Rate difficulty, breathing, and pain. The app adjusts your next workout automatically.",
                    ru: "Оцени сложность, дыхание и боль. Приложение скорректирует следующую тренировку."
                  })}
                </p>
              </div>
            </div>
          </RevealBlock>
        </div>
      </section>

      <RevealBlock className="landing-divider-wrap">
        <div className="landing-divider" />
      </RevealBlock>

      <section className="landing-final">
        <RevealBlock>
          <h2 className="landing-section-title">
            {t({ en: "READY TO RUN?", ru: "ГОТОВ БЕЖАТЬ?" })}
          </h2>
        </RevealBlock>
        <RevealBlock delay={100}>
          <p className="landing-final-sub">
            {t({
              en: "Start with a gentle run-walk session. No account required.",
              ru: "Начни с мягкой тренировки бег-шаг. Аккаунт не нужен."
            })}
          </p>
        </RevealBlock>
        <RevealBlock delay={200}>
          <button
            className="landing-cta-btn"
            type="button"
            onClick={() => navigate(hasOnboarded ? "/today" : "/onboarding")}
          >
            {hasOnboarded
              ? t({ en: "Open today", ru: "Сегодня" })
              : t({ en: "Start training", ru: "Начать тренировку" })}
          </button>
        </RevealBlock>
      </section>

      <div className="landing-scroll-hint">
        {t({ en: "RUNWALK COACH", ru: "RUNWALK COACH" })}
      </div>
    </div>
  );
}
