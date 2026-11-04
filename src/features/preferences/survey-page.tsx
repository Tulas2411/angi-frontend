"use client";
import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { Alert, Button } from "@/shared/ui";
import { ConfirmDialog, Skeleton } from "@/components/ui/primitives";
import { useRemote } from "@/features/explore/use-remote";
import { surveyQuestions, type SurveyQuestion } from "./survey-questions";
import {
  buildAnswers,
  isAlreadyDone,
  isAnswered,
  noPreference,
  surveyError,
  type SurveySelection,
} from "./survey-rules";
import {
  preferenceSurveyService,
  type PreferenceSurveyService,
} from "./survey-service";
import "./survey.css";

type Finished = "completed" | "skipped";

/**
 * A horizontal slider over the question options, which are ordered from the mildest to the
 * strongest. Nothing is chosen until the traveler moves it, taps a mark or uses the keys;
 * "Không quan trọng" stands apart below and sends no answer.
 */
function QuestionBody({
  question,
  selection,
  onPick,
}: {
  question: SurveyQuestion;
  selection: SurveySelection;
  onPick: (code: string) => void;
}) {
  const picked = selection[question.id];
  const levels = question.options;
  const index = levels.findIndex((option) => option.code === picked);
  const chosen = index >= 0;
  const none = picked === noPreference;
  const last = levels.length - 1;
  // Unchosen, the thumb waits in the middle; it never sends that middle level by itself.
  const position = chosen ? index : last / 2;
  const percent = last > 0 ? (position / last) * 100 : 0;
  return (
    <div className="survey-slider-block" data-none={none || undefined}>
      <p className="survey-level" aria-hidden>
        {chosen
          ? levels[index].label
          : none
            ? "Không quan trọng"
            : "Kéo thanh trượt để chọn"}
      </p>
      <div
        className="survey-slider"
        data-chosen={chosen || undefined}
        style={{ "--fill": `${chosen ? percent : 0}%` } as CSSProperties}
      >
        <input
          type="range"
          min={0}
          max={last}
          step={1}
          value={position}
          aria-label={question.title}
          aria-valuetext={chosen ? levels[index].label : "Chưa chọn"}
          onChange={(event) => onPick(levels[Number(event.target.value)].code)}
          onPointerDown={(event) => {
            // A press on the thumb where it waits also counts as choosing that level.
            if (!chosen) onPick(levels[Number(event.currentTarget.value)].code);
          }}
        />
        <span className="survey-slider-track" aria-hidden />
        <span className="survey-slider-fill" aria-hidden />
        {levels.map((option, mark) => (
          <span
            key={option.code}
            className="survey-slider-stop"
            aria-hidden
            data-active={(chosen && mark <= index) || undefined}
            style={{ left: `${last > 0 ? (mark / last) * 100 : 0}%` }}
          />
        ))}
        <span
          className="survey-slider-thumb"
          aria-hidden
          style={{ left: `${percent}%` }}
        />
      </div>
      <ol
        className="survey-marks"
        style={{ "--span": `${100 / Math.max(last, 1)}%` } as CSSProperties}
      >
        {levels.map((option, mark) => (
          <li
            key={option.code}
            style={
              {
                "--pos": `${last > 0 ? (mark / last) * 100 : 0}%`,
              } as CSSProperties
            }
          >
            <button
              type="button"
              tabIndex={-1}
              data-current={(chosen && mark === index) || undefined}
              onClick={() => onPick(option.code)}
            >
              {option.label}
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="survey-none"
        aria-pressed={none}
        onClick={() => onPick(noPreference)}
      >
        <CheckIcon aria-hidden /> Không quan trọng với tôi
      </button>
    </div>
  );
}

/** F-17 Set Up Preference Profile: one question per step, then PREF-02; or PREF-03 to skip. */
export function PreferenceSurveyPage({
  service = preferenceSurveyService,
}: {
  service?: PreferenceSurveyService;
}) {
  const [status] = useRemote(() => service.status(), "status");
  const [step, setStep] = useState(0);
  const [selection, setSelection] = useState<SurveySelection>({});
  const [finished, setFinished] = useState<Finished | null>(null);
  const [problem, setProblem] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const busy = useRef(false);

  const total = surveyQuestions.length;
  const question = surveyQuestions[step];
  const last = step === total - 1;
  const answers = buildAnswers(surveyQuestions, selection);
  const answered = question ? isAnswered(question, selection) : false;

  async function settle(action: () => Promise<unknown>, outcome: Finished) {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setProblem("");
    try {
      await action();
      setFinished(outcome);
      setConfirmSkip(false);
      // The session's needsPreferenceSurvey is read again so sign-in stops sending here.
      await service.refreshSession().catch(() => undefined);
    } catch (caught) {
      if (isAlreadyDone(caught)) {
        setFinished("completed");
        setConfirmSkip(false);
        await service.refreshSession().catch(() => undefined);
      }
      setProblem(surveyError(caught));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  const done =
    finished ?? (status.status === "ready" && status.data ? status.data : null);

  if (status.status === "loading")
    return (
      <div className="survey-page">
        <div className="survey-card">
          <Skeleton rows={5} />
        </div>
      </div>
    );

  if (done)
    return (
      <div className="survey-page">
        <div className="survey-card survey-done">
          <span className="survey-done-icon" aria-hidden>
            <SparklesIcon />
          </span>
          <p className="survey-eyebrow">Khảo sát khẩu vị</p>
          <h1>
            {done === "skipped"
              ? "Bạn đã bỏ qua khảo sát"
              : "Cảm ơn bạn đã chia sẻ khẩu vị!"}
          </h1>
          <p className="survey-lead">
            {done === "skipped"
              ? "ANGI sẽ học dần khẩu vị của bạn qua những món bạn thích và đánh giá."
              : "ANGI sẽ dùng câu trả lời này để gợi ý món ăn hợp với bạn hơn, và tiếp tục học thêm từ những món bạn thích."}
          </p>
          {problem && finished && <Alert tone="info">{problem}</Alert>}
          <Link className="button button-primary survey-done-cta" href="/">
            Bắt đầu khám phá món ngon
          </Link>
        </div>
      </div>
    );

  return (
    <div className="survey-page">
      <div className="survey-card">
        <header className="survey-head">
          <div>
            <p className="survey-eyebrow">Khảo sát khẩu vị · chỉ một lần</p>
            <p className="survey-progress-label" aria-live="polite">
              Câu {step + 1} / {total}
            </p>
          </div>
          <Button variant="tertiary" onClick={() => setConfirmSkip(true)}>
            Bỏ qua khảo sát
          </Button>
        </header>
        <div
          className="survey-progress"
          role="progressbar"
          aria-label="Tiến độ khảo sát"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step + 1}
        >
          <span style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>

        <section className="survey-question" key={question.id}>
          <h1>{question.title}</h1>
          <p className="survey-lead">
            Kéo thanh trượt hoặc chạm vào một mức. Không để ý điều này thì chọn
            “Không quan trọng”.
          </p>
          <QuestionBody
            question={question}
            selection={selection}
            onPick={(value) => {
              setSelection((current) => ({ ...current, [question.id]: value }));
              setProblem("");
            }}
          />
        </section>

        {problem && <Alert>{problem}</Alert>}

        <footer className="survey-actions">
          <Button
            variant="secondary"
            disabled={step === 0 || saving}
            onClick={() => setStep((value) => value - 1)}
          >
            <ArrowLeftIcon className="survey-icon" aria-hidden /> Quay lại
          </Button>
          {!last ? (
            <Button onClick={() => setStep((value) => value + 1)}>
              {answered ? "Tiếp tục" : "Bỏ qua câu này"}
              <ArrowRightIcon
                className="survey-icon survey-icon-end"
                aria-hidden
              />
            </Button>
          ) : (
            <Button
              loading={saving}
              disabled={answers.length === 0}
              onClick={() =>
                void settle(() => service.submit(answers), "completed")
              }
            >
              Hoàn tất khảo sát
            </Button>
          )}
        </footer>
        {last && answers.length === 0 && (
          <p className="helper survey-note">
            Bạn chưa trả lời câu nào. Hãy chọn ít nhất một câu, hoặc bỏ qua khảo
            sát.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmSkip}
        title="Bỏ qua khảo sát khẩu vị?"
        label="Bỏ qua khảo sát"
        loading={saving}
        onClose={() => {
          if (!saving) setConfirmSkip(false);
        }}
        onConfirm={() => void settle(() => service.skip(), "skipped")}
      >
        <div className="stack-sm">
          <p>
            Khảo sát chỉ làm được một lần: bỏ qua rồi thì không quay lại làm
            được nữa. ANGI vẫn học khẩu vị của bạn qua những món bạn thích và
            đánh giá.
          </p>
          {problem && <Alert>{problem}</Alert>}
        </div>
      </ConfirmDialog>
    </div>
  );
}
