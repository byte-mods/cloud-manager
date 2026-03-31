import { useTutorialStore } from '@/stores/tutorial-store';

type UseTutorialProgressReturn = {
  progress: {
    tutorialId: string;
    currentStep: number;
    totalSteps: number;
    steps: Array<{
      stepId: string;
      completed: boolean;
      completedAt?: Date;
    }>;
    startedAt: Date;
    completedAt?: Date;
  } | null;
  completionPercentage: number;
  advanceStep: () => void;
  completeStep: (stepId: string) => void;
  isComplete: boolean;
  isActive: boolean;
  completedTutorials: string[];
};

export function useTutorialProgress(
  tutorialId?: string
): UseTutorialProgressReturn {
  const activeTutorial = useTutorialStore((s) => s.activeTutorial);
  const completedTutorials = useTutorialStore((s) => s.completedTutorials);
  const advanceStep = useTutorialStore((s) => s.advanceStep);
  const completeStep = useTutorialStore((s) => s.completeStep);
  const getCompletionPercentage = useTutorialStore(
    (s) => s.getCompletionPercentage
  );

  const isMatchingTutorial =
    !tutorialId || activeTutorial?.tutorialId === tutorialId;
  const progress = isMatchingTutorial && activeTutorial
    ? {
        ...activeTutorial,
        totalSteps: activeTutorial.steps.length,
      }
    : null;

  const completionPercentage = isMatchingTutorial
    ? getCompletionPercentage()
    : 0;

  const isComplete = tutorialId
    ? completedTutorials.includes(tutorialId)
    : activeTutorial?.completedAt != null;

  const isActive = isMatchingTutorial && activeTutorial !== null;

  return {
    progress,
    completionPercentage,
    advanceStep,
    completeStep,
    isComplete,
    isActive,
    completedTutorials,
  };
}

export type { UseTutorialProgressReturn };
