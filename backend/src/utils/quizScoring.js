export const QUIZ_PASS_PERCENTAGE = 50;

export const questionPoints = (question) => question.points || 1;

export function quizMaxScore(quiz) {
  return (quiz.questions ?? []).reduce((total, question) => total + questionPoints(question), 0);
}

export function quizScoreSummary(quiz, score) {
  const maxScore = quizMaxScore(quiz);
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return { score, maxScore, percentage, passed: percentage >= QUIZ_PASS_PERCENTAGE };
}

export function quizAnswerReview(quiz, answers) {
  const selectedByQuestion = new Map((answers ?? []).map(({ questionId, selectedOptionId }) => [questionId, selectedOptionId]));
  return (quiz.questions ?? []).map((question) => {
    const selectedOptionId = selectedByQuestion.get(question.id) ?? null;
    const isCorrect = selectedOptionId === question.correctOptionId;
    const points = questionPoints(question);
    return {
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      selectedOptionId,
      correctOptionId: question.correctOptionId,
      points,
      earnedPoints: isCorrect ? points : 0,
      isCorrect,
      explanation: question.explanation || null,
    };
  });
}
