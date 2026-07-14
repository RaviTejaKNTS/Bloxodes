import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { fetchQuizPlay, fetchQuizProgress, saveQuizProgress } from "../../src/api";
import { useAuth } from "../../src/auth";
import { AppIcon, Badge, Button, ErrorState, LoadingState, MetaText, ProgressBar } from "../../src/components/ui";
import { radii, spacing } from "../../src/theme";
import { useTheme } from "../../src/theme-context";
import type { QuizPlayResponse, QuizQuestion } from "../../src/types";

type Difficulty = "easy" | "medium" | "hard";
type PlayedQuestion = QuizQuestion & { level: Difficulty };
type Answer = { question: PlayedQuestion; selectedOptionId: string; correct: boolean };

const QUESTION_COUNTS: Record<Difficulty, number> = { easy: 5, medium: 5, hard: 5 };
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const QUESTIONS_PER_ATTEMPT = 15;

function shuffle<T>(input: T[]): T[] {
  const result = [...input];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function buildAttempt(quiz: QuizPlayResponse, seenIds: string[]): PlayedQuestion[] {
  const seen = new Set(seenIds);
  return DIFFICULTIES.flatMap((level) => {
    const pool = quiz.quizData[level].map((question) => ({
      ...question,
      level,
      options: shuffle(question.options)
    }));
    const ordered = [...shuffle(pool.filter((question) => !seen.has(question.id))), ...shuffle(pool.filter((question) => seen.has(question.id)))];
    return ordered.slice(0, QUESTION_COUNTS[level]);
  }).slice(0, QUESTIONS_PER_ATTEMPT);
}

function difficultyLabel(value: Difficulty): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function QuizScreen() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = typeof params.code === "string" ? decodeURIComponent(params.code) : "";
  const { colors } = useTheme();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<QuizPlayResponse | null>(null);
  const [attempt, setAttempt] = useState<PlayedQuestion[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const [payload, progress] = await Promise.all([fetchQuizPlay(code), fetchQuizProgress(code)]);
      const nextSeen = progress?.seenQuestionIds ?? [];
      setQuiz(payload);
      setSeenIds(nextSeen);
      setAttempt(buildAttempt(payload, nextSeen));
      setQuestionIndex(0);
      setAnswers([]);
      setShowSummary(false);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load quiz");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentQuestion = attempt[questionIndex] ?? null;
  const currentAnswer = currentQuestion ? answers.find((answer) => answer.question.id === currentQuestion.id) ?? null : null;
  const score = answers.filter((answer) => answer.correct).length;
  const breakdown = useMemo(() => {
    const base: Record<Difficulty, { correct: number; total: number }> = {
      easy: { correct: 0, total: 0 },
      medium: { correct: 0, total: 0 },
      hard: { correct: 0, total: 0 }
    };
    for (const question of attempt) base[question.level].total += 1;
    for (const answer of answers) if (answer.correct) base[answer.question.level].correct += 1;
    return base;
  }, [answers, attempt]);

  function selectOption(optionId: string) {
    if (!currentQuestion || currentAnswer) return;
    setAnswers((previous) => [
      ...previous,
      { question: currentQuestion, selectedOptionId: optionId, correct: optionId === currentQuestion.correctOptionId }
    ]);
  }

  function nextQuestion() {
    if (!currentAnswer) return;
    if (questionIndex >= attempt.length - 1) {
      setShowSummary(true);
      return;
    }
    setQuestionIndex((index) => index + 1);
  }

  function restart() {
    if (!quiz) return;
    const nextSeen = Array.from(new Set([...seenIds, ...attempt.map((question) => question.id)]));
    setSeenIds(nextSeen);
    setAttempt(buildAttempt(quiz, nextSeen));
    setQuestionIndex(0);
    setAnswers([]);
    setShowSummary(false);
  }

  useEffect(() => {
    if (!showSummary || !attempt.length || !code) return;
    const mergedSeen = Array.from(new Set([...seenIds, ...attempt.map((question) => question.id)]));
    if (!user) return;
    void saveQuizProgress({
      code,
      questionIds: mergedSeen,
      score,
      total: attempt.length,
      breakdown
    });
  }, [attempt, breakdown, code, score, seenIds, showSummary, user]);

  return (
    <>
      <Stack.Screen options={{ title: quiz?.title ?? "Quiz" }} />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ gap: spacing.xl, padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {loading ? <LoadingState label="Preparing 15 questions" /> : null}
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

        {quiz && attempt.length && !showSummary && currentQuestion ? (
          <>
            <View style={{ gap: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
                <Badge label={difficultyLabel(currentQuestion.level)} tone="accent" />
                <MetaText>Question {questionIndex + 1} of {attempt.length}</MetaText>
              </View>
              <ProgressBar progress={answers.length / attempt.length} />
            </View>

            <View style={{ gap: spacing.lg }}>
              <Text style={{ color: colors.foreground, fontSize: 25, lineHeight: 33, fontWeight: "800" }}>{currentQuestion.question}</Text>
              {currentQuestion.image || quiz.coverImage ? (
                <Image source={{ uri: currentQuestion.image || quiz.coverImage || "" }} style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: radii.lg, backgroundColor: colors.surfaceMuted }} resizeMode="cover" />
              ) : null}
            </View>

            <View style={{ gap: spacing.md }}>
              {currentQuestion.options.map((option, index) => {
                const selected = currentAnswer?.selectedOptionId === option.id;
                const correct = currentQuestion.correctOptionId === option.id;
                const revealed = Boolean(currentAnswer);
                const borderColor = revealed && correct ? "#22c55e" : revealed && selected ? colors.danger : colors.border;
                const backgroundColor = revealed && correct ? "rgba(34,197,94,0.1)" : revealed && selected ? "rgba(190,24,93,0.08)" : colors.surface;
                return (
                  <TouchableOpacity key={option.id} disabled={revealed} onPress={() => selectOption(option.id)} activeOpacity={0.85} style={{ minHeight: 56, flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1.5, borderColor, borderRadius: radii.lg, backgroundColor, padding: spacing.md }}>
                    <View style={{ width: 32, height: 32, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" }}>
                      <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: "900" }}>{String.fromCharCode(65 + index)}</Text>
                    </View>
                    <Text style={{ flex: 1, color: colors.foreground, fontSize: 15, lineHeight: 21, fontWeight: "600" }}>{option.text}</Text>
                    {revealed && correct ? <AppIcon name="check-circle" size={18} color="#22c55e" /> : null}
                    {revealed && selected && !correct ? <AppIcon name="x-circle" size={18} color={colors.danger} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {currentAnswer ? (
              <View style={{ borderWidth: 1, borderColor: currentAnswer.correct ? "rgba(34,197,94,0.4)" : colors.border, borderRadius: radii.lg, backgroundColor: currentAnswer.correct ? "rgba(34,197,94,0.1)" : colors.surfaceMuted, padding: spacing.md }}>
                <Text style={{ color: currentAnswer.correct ? "#16a34a" : colors.danger, fontSize: 14, lineHeight: 20, fontWeight: "800" }}>
                  {currentAnswer.correct ? "Correct!" : `Wrong. The correct answer is ${currentQuestion.options.find((option) => option.id === currentQuestion.correctOptionId)?.text ?? "shown above"}.`}
                </Text>
              </View>
            ) : null}

            {currentAnswer ? <Button label={questionIndex === attempt.length - 1 ? "See results" : "Next question"} icon="arrow-right" onPress={nextQuestion} /> : null}
          </>
        ) : null}

        {quiz && showSummary ? (
          <>
            <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 }}>Quiz complete</Text>
              <Text style={{ color: colors.foreground, fontSize: 38, lineHeight: 44, fontWeight: "900" }}>{score} / {attempt.length}</Text>
              <Text style={{ color: colors.mutedStrong, fontSize: 15, textAlign: "center" }}>{score === attempt.length ? "Perfect score." : score >= 11 ? "Great work — you know this game well." : score >= 7 ? "Solid attempt. Review the misses below." : "Review the answers and try another set."}</Text>
              {user ? <Badge label="Saved to your account" tone="accent" /> : <MetaText>Sign in from Account to sync quiz results.</MetaText>}
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {DIFFICULTIES.map((level) => (
                <View key={level} style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.surface, padding: spacing.md, gap: 3 }}>
                  <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}>{difficultyLabel(level)}</Text>
                  <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "900" }}>{breakdown[level].correct}/{breakdown[level].total}</Text>
                </View>
              ))}
            </View>

            <Button label="Try another 15 questions" icon="rotate-ccw" onPress={restart} />

            <View style={{ gap: spacing.md }}>
              <Text style={{ color: colors.foreground, fontSize: 22, lineHeight: 28, fontWeight: "800" }}>Review answers</Text>
              {answers.map((answer, index) => {
                const selected = answer.question.options.find((option) => option.id === answer.selectedOptionId)?.text ?? "Not answered";
                const correct = answer.question.options.find((option) => option.id === answer.question.correctOptionId)?.text ?? "";
                return (
                  <View key={answer.question.id} style={{ gap: spacing.xs, borderTopWidth: index ? 1 : 0, borderTopColor: colors.borderMuted, paddingTop: index ? spacing.md : 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
                      <AppIcon name={answer.correct ? "check-circle" : "x-circle"} size={17} color={answer.correct ? "#22c55e" : colors.danger} />
                      <Text style={{ flex: 1, color: colors.foreground, fontSize: 14, lineHeight: 20, fontWeight: "800" }}>{index + 1}. {answer.question.question}</Text>
                    </View>
                    <Text style={{ color: colors.mutedStrong, fontSize: 13, lineHeight: 19 }}>Your answer: {selected}</Text>
                    {!answer.correct ? <Text style={{ color: "#16a34a", fontSize: 13, lineHeight: 19, fontWeight: "700" }}>Correct answer: {correct}</Text> : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {!loading && quiz && !attempt.length ? <Text style={{ color: colors.muted, textAlign: "center" }}>No quiz questions are available yet.</Text> : null}
      </ScrollView>
    </>
  );
}
