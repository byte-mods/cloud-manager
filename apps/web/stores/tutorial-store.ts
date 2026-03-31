import { create } from 'zustand';

type StepProgress = {
  stepId: string;
  completed: boolean;
  completedAt?: Date;
};

type TutorialProgress = {
  tutorialId: string;
  currentStep: number;
  steps: StepProgress[];
  startedAt: Date;
  completedAt?: Date;
};

type TutorialState = {
  activeTutorial: TutorialProgress | null;
  completedTutorials: string[];
  startTutorial: (tutorialId: string, totalSteps: number) => void;
  advanceStep: () => void;
  completeStep: (stepId: string) => void;
  resetProgress: () => void;
  getCompletionPercentage: () => number;
};

export const useTutorialStore = create<TutorialState>((set, get) => ({
  activeTutorial: null,
  completedTutorials: [],

  startTutorial: (tutorialId, totalSteps) =>
    set({
      activeTutorial: {
        tutorialId,
        currentStep: 0,
        steps: Array.from({ length: totalSteps }, (_, i) => ({
          stepId: `step-${i}`,
          completed: false,
        })),
        startedAt: new Date(),
      },
    }),

  advanceStep: () =>
    set((state) => {
      const tutorial = state.activeTutorial;
      if (!tutorial) return state;

      const nextStep = tutorial.currentStep + 1;
      const isComplete = nextStep >= tutorial.steps.length;

      if (isComplete) {
        return {
          activeTutorial: { ...tutorial, currentStep: nextStep, completedAt: new Date() },
          completedTutorials: [
            ...state.completedTutorials,
            tutorial.tutorialId,
          ],
        };
      }

      return {
        activeTutorial: { ...tutorial, currentStep: nextStep },
      };
    }),

  completeStep: (stepId) =>
    set((state) => {
      const tutorial = state.activeTutorial;
      if (!tutorial) return state;

      return {
        activeTutorial: {
          ...tutorial,
          steps: tutorial.steps.map((step) =>
            step.stepId === stepId
              ? { ...step, completed: true, completedAt: new Date() }
              : step,
          ),
        },
      };
    }),

  resetProgress: () =>
    set({ activeTutorial: null }),

  getCompletionPercentage: () => {
    const tutorial = get().activeTutorial;
    if (!tutorial || tutorial.steps.length === 0) return 0;
    const completed = tutorial.steps.filter((s) => s.completed).length;
    return Math.round((completed / tutorial.steps.length) * 100);
  },
}));

export type { StepProgress, TutorialProgress, TutorialState };
