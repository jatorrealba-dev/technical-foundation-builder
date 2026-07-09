import {
  InterviewAnswer,
  InterviewQuestion,
  ProjectInterview,
  initialInterviewQuestions,
} from "@/domain/interviews/interview";

const STORAGE_KEY = "technical-foundation-builder.interviews";

function isBrowser() {
  return typeof window !== "undefined";
}

function getAllInterviews(): ProjectInterview[] {
  if (!isBrowser()) {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as ProjectInterview[];
  } catch {
    return [];
  }
}

function saveAllInterviews(interviews: ProjectInterview[]) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(interviews));
}

export function getInitialInterviewQuestions(): InterviewQuestion[] {
  return initialInterviewQuestions;
}

export function getProjectInterview(projectId: string): ProjectInterview {
  const existingInterview = getAllInterviews().find(
    (interview) => interview.projectId === projectId
  );

  if (existingInterview) {
    return existingInterview;
  }

  const now = new Date().toISOString();

  return {
    projectId,
    status: "not_started",
    currentStage: "idea",
    answers: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function saveProjectInterview(
  interview: ProjectInterview
): ProjectInterview {
  const interviews = getAllInterviews();

  const nextInterviews = [
    interview,
    ...interviews.filter((item) => item.projectId !== interview.projectId),
  ];

  saveAllInterviews(nextInterviews);

  return interview;
}

export function saveInterviewAnswer(input: {
  projectId: string;
  questionId: string;
  answer: string;
}): ProjectInterview {
  const interview = getProjectInterview(input.projectId);
  const now = new Date().toISOString();

  const nextAnswer: InterviewAnswer = {
    questionId: input.questionId,
    answer: input.answer.trim(),
    answeredAt: now,
  };

  const nextAnswers = [
    nextAnswer,
    ...interview.answers.filter(
      (answer) => answer.questionId !== input.questionId
    ),
  ];

  const question = initialInterviewQuestions.find(
    (item) => item.id === input.questionId
  );

  const nextInterview: ProjectInterview = {
    ...interview,
    status: "in_progress",
    currentStage: question?.stage ?? interview.currentStage,
    answers: nextAnswers,
    updatedAt: now,
  };

  const totalQuestions = initialInterviewQuestions.length;

  if (nextAnswers.length >= totalQuestions) {
    nextInterview.status = "completed";
  }

  return saveProjectInterview(nextInterview);
}

export function getInterviewCompletionPercentage(projectId: string): number {
  const interview = getProjectInterview(projectId);
  const totalQuestions = initialInterviewQuestions.length;

  if (totalQuestions === 0) {
    return 0;
  }

  return Math.round((interview.answers.length / totalQuestions) * 100);
}

export function getAnswerForQuestion(input: {
  projectId: string;
  questionId: string;
}): string {
  const interview = getProjectInterview(input.projectId);

  return (
    interview.answers.find((answer) => answer.questionId === input.questionId)
      ?.answer ?? ""
  );
}
