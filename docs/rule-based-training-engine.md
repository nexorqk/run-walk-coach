# Rule-Based Training Engine

This document captures the intended direction for the large training-coach feature:
the app should become a deterministic expert system for training decisions, not an
LLM chat assistant.

The core idea:

```txt
Profile -> History -> Progression rules -> Safety rules -> Next workout
        -> Program validation -> Explanation text
```

The app should not "think in language". It should calculate from structured user
state, apply explicit rules, and return a workout plus reason codes that the UI can
turn into clear text.

## Product Shape

The MVP should stay template-adaptive instead of trying to generate arbitrary
workouts. The system starts with a small set of known templates, then adapts sets,
reps, rest, substitutions, optional exercises, intensity, and training day choice.

Initial templates:

```txt
Strength A
- Pull-up
- Push-up
- Deep squat
- Dead bug

Strength B
- Reverse-grip pull-up
- Push-up
- Deep squat
- Dead bug

Kettlebell B
- Kettlebell deadlift
- Kettlebell row
- Romanian deadlift
- Optional goblet squat
```

The first complete vertical flow should be:

1. User opens the app.
2. User sees today's workout.
3. User completes the workout and submits a structured report.
4. The system updates exercise state and progress aggregates.
5. The system shows what will change next time and why.
6. Exercise exclusions, constraints, and preferences are saved as rules.

## Data Model

The strength-training domain needs structured entities that are separate from the
existing run-walk timer templates.

Minimum server-side model:

```ts
User {
  id
  height
  weight
  goal
  experienceLevel
}

Exercise {
  id
  slug
  name
  category
  movementPattern
  equipment
  difficulty
}

StrengthWorkoutTemplate {
  id
  code
  name
}

StrengthWorkoutExercise {
  templateId
  exerciseId
  sets
  repsMin
  repsMax
  restSeconds
  sortOrder
}

StrengthWorkoutSession {
  id
  userId
  templateId
  date
  completed
  durationMinutes
  difficulty
  notes
}

StrengthSetLog {
  sessionId
  exerciseId
  setNumber
  reps
  weightKg
  rpe
  completed
}

StrengthExerciseFeedback {
  sessionId
  exerciseId
  muscleDifficulty
  breathingDifficulty
  pain
  comment
}

UserRule {
  userId
  type
  payload
  priority
  active
}
```

The most important persistence concept is `UserRule`. This is the deterministic
"memory" of the system.

Example exercise exclusion:

```json
{
  "type": "exercise_exclusion",
  "payload": {
    "exercise": "plank",
    "scope": "all_future_workouts",
    "replacement": "dead_bug"
  },
  "priority": 100
}
```

Example exercise constraint:

```json
{
  "type": "exercise_constraint",
  "payload": {
    "exercise": "reverse_grip_pull_up",
    "maxSets": 2,
    "maxRepsPerSet": 3,
    "reason": "currently hard exercise, keep low volume"
  },
  "priority": 80
}
```

## Aggregated User State

The system should not rely only on raw session history. After each completed
workout, a summary service should update per-exercise state.

```ts
UserExerciseState {
  userId
  exerciseId
  currentLevel
  bestSetReps
  bestWeightKg
  bestVolume
  lastDifficulty
  averageDifficultyLast3
  lastPain
  trend
  nextRecommendedSets
  nextRecommendedReps
}
```

Example pull-up state:

```json
{
  "exercise": "pull_up",
  "bestSetReps": 6,
  "lastWorkout": "4x3-5",
  "averageDifficultyLast3": 6.5,
  "trend": "stable",
  "nextRecommendation": "maintain"
}
```

Example deep-squat state:

```json
{
  "exercise": "deep_squat",
  "lastWorkout": "3x20",
  "breathingDifficulty": 9,
  "muscleDifficulty": 4,
  "limiter": "cardio",
  "nextRecommendation": "split_sets"
}
```

## Core Services

The intended modules are:

```txt
TrainingPlanService
  Chooses the next workout template or recovery day.

ProgressionEngine
  Changes sets, reps, weight, and rest for each exercise.

ReadinessService
  Decides whether the user should train normally, train light, recover, or rest.

ExerciseSubstitutionService
  Applies exclusions and selects known alternatives.

WorkoutValidator
  Enforces user rules, volume caps, safety constraints, and template validity.

TrainingSummaryService
  Updates UserExerciseState after a completed report.

SafetyService
  Detects pain, overload, risky symptoms, and stop conditions.

ExplanationService
  Converts reason codes into localized user-facing text.
```

## Progression Engine

The engine takes structured exercise history and rules:

```ts
type ProgressionInput = {
  exercise: Exercise
  currentSets: number
  currentRepsMin: number
  currentRepsMax: number
  lastPerformances: ExercisePerformance[]
  userRules: UserRule[]
  feedback: ExerciseFeedback[]
}
```

It returns a deterministic decision:

```ts
type ProgressionDecision = {
  action: "increase" | "maintain" | "decrease" | "split_volume" | "substitute"
  nextSets: number
  nextReps: string
  reasonCode: string
  replacementSlug?: string
}
```

Baseline rules:

```ts
if (painDetected) {
  return {
    action: "decrease",
    nextSets: currentSets - 1,
    nextReps: currentReps,
    reasonCode: "pain_detected"
  }
}

if (completedAllSets && difficulty <= 6 && noPain) {
  return {
    action: "increase",
    nextSets: currentSets,
    nextReps: increaseReps(currentReps),
    reasonCode: "completed_easy"
  }
}

if (difficulty >= 8) {
  return {
    action: "maintain",
    nextSets: currentSets,
    nextReps: currentReps,
    reasonCode: "high_difficulty"
  }
}
```

Specific rule for deep squats:

```ts
if (
  exercise.slug === "deep_squat" &&
  feedback.breathingDifficulty >= 8 &&
  feedback.muscleDifficulty <= 5
) {
  return {
    action: "split_volume",
    nextSets: 4,
    nextReps: "15",
    reasonCode: "cardio_limited_not_muscle_limited"
  }
}
```

The point of this rule is that the limiter is breathing, not leg strength. The
system should avoid blindly reducing total volume; splitting the same volume across
more sets is often a better first adjustment.

## Substitution Engine

Exercise alternatives should be explicit data, not generated text.

```ts
ExerciseAlternative {
  exerciseId
  alternativeExerciseId
  reason
  difficultyDelta
}
```

Example:

```json
{
  "exercise": "plank",
  "alternatives": [
    {
      "exercise": "dead_bug",
      "reason": "core_stability_lower_back_friendly",
      "difficultyDelta": -1
    },
    {
      "exercise": "bird_dog",
      "reason": "low_load_core_control",
      "difficultyDelta": -2
    }
  ]
}
```

When a user removes an exercise, the app should create a rule:

```ts
excludeExercise("plank", {
  replacement: "dead_bug",
  scope: "all_future_workouts"
})
```

Then validation applies it consistently:

```ts
for (const exercise of workout.exercises) {
  if (isExcluded(exercise, userRules)) {
    replaceExercise(exercise, getReplacement(exercise, userRules))
  }
}
```

## Today Workout Generation

The daily generator should be deterministic and auditable.

```txt
1. Determine day in cycle: A, B, kettlebell, cardio, recovery, rest.
2. Check recent strength history.
3. Enforce minimum recovery window, usually 48 hours for strength.
4. Evaluate readiness.
5. Select template.
6. Apply user rules.
7. Apply exercise progressions.
8. Run workout validation.
9. Return workout plus reason codes.
```

Conceptual flow:

```ts
function generateTodayWorkout(userId: string, date: Date) {
  const user = getUser(userId)
  const history = getRecentWorkoutHistory(userId)
  const rules = getUserRules(userId)

  const readiness = calculateReadiness(user, history)

  if (!readiness.canTrainStrength) {
    return generateRecoveryWorkout(user, readiness)
  }

  const nextTemplate = getNextWorkoutTemplate(user, history)
  let workout = buildWorkoutFromTemplate(nextTemplate)

  workout = applyExerciseExclusions(workout, rules)
  workout = applyProgressions(workout, history, rules)
  workout = validateWorkout(workout, rules)

  return workout
}
```

## Readiness

Readiness can stay rule-based. A simple score is enough for MVP:

```ts
let score = 100

if (sleepHours < 6) score -= 20
if (lastStrengthWorkoutHoursAgo < 36) score -= 30
if (muscleSoreness >= 7) score -= 25
if (stress >= 8) score -= 10
if (pain) score -= 40

if (score >= 75) return "normal_training"
if (score >= 50) return "light_training"
if (score >= 30) return "recovery"
return "rest"
```

Safety rules should override score-based logic. Red flags, fever, acute pain,
severe shortness of breath, faintness, or chest pain should move the user out of
training recommendations.

## Explanations

Explanations should be generated from reason codes:

```ts
const explanations = {
  completed_easy:
    "You completed all sets without pain at a controlled effort, so load can increase slightly.",

  high_difficulty:
    "Difficulty was high, so the next workout keeps the same load.",

  cardio_limited_not_muscle_limited:
    "Breathing was the limiter, not the muscles, so total work is split across more sets.",

  pain_detected:
    "Pain or discomfort was reported, so load is reduced."
}
```

This keeps the user-facing experience clear while keeping the system controllable,
testable, and easy to debug.

## Implementation Order

Build this in vertical slices:

1. Add strength domain tables, shared schemas, default exercise catalog, and seed.
2. Add a pure shared `ProgressionEngine` with test scenarios.
3. Add API endpoints for strength templates and strength session reports.
4. Add offline IndexedDB storage and sync for strength sessions.
5. Build the first strength report UI with set logs and exercise feedback.
6. Add `TrainingSummaryService` to update `UserExerciseState`.
7. Generate the next strength workout from template plus progression decisions.
8. Add user rules for exclusions and constraints.
9. Add substitution and validation layers.
10. Add explanation text and localized UI copy.

Do not start with a fully general workout generator. Start with one full flow:

```txt
Strength A -> report sets and feedback -> update exercise state
           -> show next Strength A recommendation with reason codes
```

Once this is stable, add Strength B, kettlebell templates, substitutions, and cycle
selection.

## Non-Goals For MVP

- No LLM chat behavior.
- No arbitrary program generation.
- No unsupported exercise database.
- No hidden memory outside structured tables.
- No automatic medical advice.
- No complex periodization until the first vertical strength flow works.

## Design Principle

The training assistant should be:

```txt
History -> State -> Rules -> Decision -> Explanation
```

Not:

```txt
Prompt -> Free-form answer
```

This makes the feature safer, testable, explainable, and much easier to ship in
small reliable steps.
