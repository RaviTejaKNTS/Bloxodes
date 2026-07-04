import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { fetchQuizPlay, saveQuizProgress } from "../../src/api";
import { useAuth } from "../../src/auth";
import { radii, spacing } from "../../src/theme";
import { useTheme } from "../../src/theme-context";
import { AppIcon, Badge, Button, Card, CoverImage, ErrorState, LoadingState, MetaText, Pill, ProgressBar } from "../../src/components/ui";
import type { QuizPlayResponse, QuizQuestion } from "../../src/types";

type Difficulty = "easy" | "medium" | "hard" | "mixed";

type PlayedQuestion = QuizQuestion & { level: "easy" | "medium" | "hard" };

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  mixed: "Mixed"
};

const QUESTIONS_PER_ROUND = 10;

function shuffle<T>(input: T[]): T[] {
  const result = [...input];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function buildRound(quiz: QuizPlayResponse, difficulty: Difficulty): PlayedQuestion[] {
  const withLevel = (level: "easy" | "medium" | "hard") =>
    quiz.quizData[level].map((question) => ({ ...question, level }) satisfies PlayedQuestion);

  if (difficulty !== "mixed") {
    return shuffle(withLevel(difficulty)).slice(0, QUESTIONS_PER_ROUND);
  }
  const perLevel = Math.ceil(QUESTIONS_PER_ROUND / 3);
  return shuffle([
    ...shuffle(withLevel("easy")).slice(0, perLevel),
    ...shuffle(withLevel("medium")).slice(0, perLevel),
    ...shuffle(withLevel("hard")).slice(0, perLevel)
  ]).slice(0, QUESTIONS_PER_ROUND);
}

export default function QuizScreen() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = typeof params.code === "string" ? decodeURIComponent(params.code) : "";
  const { colors } = useTheme();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<QuizPlayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [round, setRound] = useState<PlayedQuestion[] | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("mixed");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Array<{ question: PlayedQuestion; correct: boolean }>>([]);
  const [finished, setFinished] = useState(false);

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchQuizPlay(code);
      setQuiz(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load quiz");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    if (!quiz) return { easy: 0, medium: 0, hard: 0 };
    return {
      easy: quiz.quizData.easy.length,
      medium: quiz.quizData.medium.length,
      hard: quiz.quizData.hard.length
    };
  }, [quiz]);

  function startRound(nextDifficulty: Difficulty) {
    if (!quiz) return;
    setDifficulty(nextDifficulty);
    setRound(buildRound(quiz, nextDifficulty));
    setQuestionIndex(0);
    setSelectedOptionId(null);
    setAnswers([]);
    setFinished(false);
  }

  function selectOption(optionId: string) {
    if (selectedOptionId || !round) return;
    const question = round[questionIndex];
    setSelectedOptionId(optionId);
    setAnswers((prev) => [...prev, { question, correct: optionId === question.correctOptionId }]);
  }

  function nextQuestion() {
    if (!round) return;
    if (questionIndex + 1 >= round.length) {
      setFinished(true);
      return;
    }
    setQuestionIndex((prev) => prev + 1);
    setSelectedOptionId(null);
  }

  // Persist results to the signed-in account when a round finishes.
  useEffect(() => {
    if (!finished || !answers.length || !user || !code) return;
    const breakdown: Record<string, { correct: number; total: number }> = {};
    for (const entry of answers) {
      const bucket = breakdown[entry.question.level] ?? { correct: 0, total: 0 };
      bucket.total += 1;
      if (entry.correct) bucket.correct += 1;
      breakdown[entry.question.level] = bucket;
    }
    void saveQuizProgress({
      code,
      questionIds: answers.map((entry) => entry.question.id),
      score: answers.filter((entry) => entry.correct).length,
      total: answers.length,
      breakdown
    });
  }, [finished, answers, user, code]);

  const score = answers.filter((entry) => entry.correct).length;

  return (
    <>
      <Stack.Screen options={{ title: quiz?.title ?? "Quiz" }} />
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxl }}
      >
        {loading ? <LoadingState label="Loading quiz" /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        {quiz && !round ? (
          <>
            <Card>
              <CoverImage source={quiz.coverImage} label={quiz.title} />
              <View style={{ gap: spacing.sm, padding: spacing.lg }}>
                <Badge label="Quiz" tone="accent" />
                <Text style={{ color: colors.foreground, fontSize: 22, lineHeight: 28, fontWeight: "800" }}>{quiz.title}</Text>
                {quiz.universeName ? <MetaText>{quiz.universeName}</MetaText> : null}
                {quiz.description ? (
                  <Text style={{ color: colors.mutedStrong, fontSize: 14.5, lineHeight: 21 }}>{quiz.description}</Text>
                ) : null}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  <Pill icon="help-circle" label={`${counts.easy + counts.medium + counts.hard} questions`} tone="accent" />
                  <Pill icon="zap" label={`${QUESTIONS_PER_ROUND} per round`} />
                </View>
              </View>
            </Card>

            <Card>
              <View style={{ gap: spacing.md, padding: spacing.lg }}>
                <Text style={{ color: colors.foreground, fontSize: 17, fontWeight: "800" }}>Pick a difficulty</Text>
                {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((level) => {
                  const available = level === "mixed" ? counts.easy + counts.medium + counts.hard : counts[level];
                  if (!available) return null;
                  return (
                    <TouchableOpacity
                      key={level}
                      onPress={() => startRound(level)}
                      activeOpacity={0.85}
                      style={{
                        minHeight: 52,
                        borderRadius: radii.md,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceMuted,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingHorizontal: spacing.lg
                      }}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: "800" }}>
                        {DIFFICULTY_LABELS[level]}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                        <MetaText>{available} questions</MetaText>
                        <AppIcon name="play" size={15} color={colors.accent} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>
          </>
        ) : null}

        {quiz && round && !finished ? (
          <>
            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <MetaText>
                  Question {questionIndex + 1} of {round.length} · {DIFFICULTY_LABELS[difficulty]}
                </MetaText>
                <MetaText>Score {score}</MetaText>
              </View>
              <ProgressBar progress={(questionIndex + (selectedOptionId ? 1 : 0)) / round.length} />
            </View>

            <Card>
              <View style={{ gap: spacing.md, padding: spacing.lg }}>
                <Badge label={round[questionIndex].level} />
                {round[questionIndex].image ? (
                  <Image
                    source={{ uri: round[questionIndex].image! }}
                    style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radii.md, backgroundColor: colors.surfaceMuted }}
                    resizeMode="cover"
                  />
                ) : null}
                <Text style={{ color: colors.foreground, fontSize: 18, lineHeight: 25, fontWeight: "800" }}>
                  {round[questionIndex].question}
                </Text>
                <View style={{ gap: spacing.sm }}>
                  {round[questionIndex].options.map((option) => {
                    const isSelected = selectedOptionId === option.id;
                    const isCorrect = option.id === round[questionIndex].correctOptionId;
                    const revealed = selectedOptionId !== null;
                    const borderColor = revealed && isCorrect ? "#22c55e" : revealed && isSelected ? colors.danger : colors.border;
                    const background = revealed && isCorrect ? "rgba(34,197,94,0.12)" : isSelected ? colors.accentSoft : colors.surfaceMuted;
                    return (
                      <TouchableOpacity
                        key={option.id}
                        onPress={() => selectOption(option.id)}
                        disabled={revealed}
                        activeOpacity={0.85}
                        style={{
                          minHeight: 48,
                          borderRadius: radii.md,
                          borderWidth: 1.5,
                          borderColor,
                          backgroundColor: background,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: spacing.sm,
                          paddingHorizontal: spacing.lg,
                          paddingVertical: spacing.sm
                        }}
                      >
                        <Text style={{ flex: 1, color: colors.foreground, fontSize: 15, fontWeight: "600" }}>{option.text}</Text>
                        {revealed && isCorrect ? <AppIcon name="check-circle" size={17} color="#22c55e" /> : null}
                        {revealed && isSelected && !isCorrect ? <AppIcon name="x-circle" size={17} color={colors.danger} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {selectedOptionId ? (
                  <Button
                    label={questionIndex + 1 >= round.length ? "See results" : "Next question"}
                    icon="arrow-right"
                    onPress={nextQuestion}
                  />
                ) : null}
              </View>
            </Card>
          </>
        ) : null}

        {quiz && round && finished ? (
          <Card>
            <View style={{ gap: spacing.md, padding: spacing.xl, alignItems: "center" }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 999,
                  backgroundColor: colors.accentSoft,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Text style={{ color: colors.accent, fontSize: 22, fontWeight: "900" }}>
                  {Math.round((score / round.length) * 100)}%
                </Text>
              </View>
              <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "800" }}>
                {score} of {round.length} correct
              </Text>
              <MetaText>
                {score === round.length
                  ? "Perfect run!"
                  : score >= round.length * 0.7
                    ? "Nice work — almost perfect."
                    : "Keep playing to learn the answers."}
              </MetaText>
              {user ? <Pill icon="check" label="Result saved to your account" tone="accent" /> : (
                <MetaText>Sign in on the Account tab to save results.</MetaText>
              )}
              <View style={{ alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.sm }}>
                <Button label="Play again" icon="rotate-ccw" onPress={() => startRound(difficulty)} />
                <Button label="Change difficulty" variant="secondary" onPress={() => setRound(null)} />
              </View>
            </View>
          </Card>
        ) : null}
      </ScrollView>
    </>
  );
}
