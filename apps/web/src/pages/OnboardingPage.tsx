import type { AuthProviders } from "@run-walk-coach/shared";
import { AlertTriangle, Database, HeartPulse, LogIn, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthProviders, googleLoginUrl } from "../api/client.js";
import { useLanguage } from "../utils/language.js";

type OnboardingPageProps = {
  onComplete: () => void;
};

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [authProviders, setAuthProviders] = useState<AuthProviders>();

  useEffect(() => {
    let ignore = false;

    void getAuthProviders()
      .then((providers) => {
        if (!ignore) {
          setAuthProviders(providers);
        }
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, []);

  const startLocal = () => {
    onComplete();
    navigate("/today", { replace: true });
  };

  const continueWithGoogle = () => {
    onComplete();
    window.location.assign(googleLoginUrl());
  };

  return (
    <div className="stack">
      <section className="panel">
        <div className="eyebrow">{t({ en: "Start", ru: "Старт" })}</div>
        <h1>{t({ en: "RunWalk Coach", ru: "RunWalk Coach" })}</h1>
        <p className="muted">
          {t({
            en: "A browser-first running assistant for aerobic base, run-walk progression, heart rate, and breathing control.",
            ru: "Браузерный беговой помощник для аэробной базы, прогрессии бег-шаг, контроля пульса и дыхания."
          })}
        </p>
      </section>

      <section className="onboarding-grid" aria-label={t({ en: "Setup options", ru: "Варианты запуска" })}>
        <article className="onboarding-step">
          <Database aria-hidden="true" size={25} />
          <div>
            <h2>{t({ en: "Browser session", ru: "Сессия браузера" })}</h2>
            <p className="muted">
              {t({
                en: "You can train without an account. Progress stays in this browser.",
                ru: "Можно тренироваться без аккаунта. Прогресс останется в этом браузере."
              })}
            </p>
          </div>
        </article>

        <article className="onboarding-step">
          <HeartPulse aria-hidden="true" size={25} />
          <div>
            <h2>{t({ en: "Coach feedback", ru: "Советы тренера" })}</h2>
            <p className="muted">
              {t({
                en: "After each session, the app uses effort, breathing, pain, and heart rate to suggest the next step.",
                ru: "После тренировки приложение учитывает усилие, дыхание, боль и пульс, чтобы подсказать следующий шаг."
              })}
            </p>
          </div>
        </article>
      </section>

      <div className="warning-callout">
        <AlertTriangle aria-hidden="true" size={22} />
        <p>
          {t({
            en: "Without Google login, progress can be lost if browser cache, cookies, or site data are cleared.",
            ru: "Без входа через Google прогресс может пропасть при очистке кеша, cookies или данных сайта."
          })}
        </p>
      </div>

      <section className="form-section">
        <button
          className="primary-action"
          type="button"
          disabled={!authProviders?.google.enabled}
          onClick={continueWithGoogle}
        >
          <LogIn aria-hidden="true" size={25} />
          {authProviders
            ? t({ en: "Continue with Google", ru: "Войти через Google" })
            : t({ en: "Checking Google login...", ru: "Проверка входа через Google..." })}
        </button>

        {authProviders && !authProviders.google.enabled ? (
          <p className="muted">
            {t({
              en: "Google login is not configured on this server. Local mode is still available.",
              ru: "Вход через Google не настроен на сервере. Локальный режим всё ещё доступен."
            })}
          </p>
        ) : null}

        <button className="secondary-action" type="button" onClick={startLocal}>
          <Play aria-hidden="true" size={24} />
          {t({ en: "Start locally", ru: "Начать локально" })}
        </button>
      </section>
    </div>
  );
}
