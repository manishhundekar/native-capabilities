'use client';

interface Step {
  id: string;
  title: string;
  description: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick: (index: number) => void;
  completedSteps: Set<number>;
}

export function Stepper({ steps, currentStep, onStepClick, completedSteps }: StepperProps) {
  return (
    <div className="flex items-center gap-1 p-4 overflow-x-auto">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = completedSteps.has(index);
        const isPast = index < currentStep;
        
        return (
          <button
            key={step.id}
            onClick={() => onStepClick(index)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg transition-all min-w-fit
              ${isActive 
                ? 'bg-accent text-white' 
                : isCompleted 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : isPast
                    ? 'bg-bg-elevated text-text-muted'
                    : 'bg-bg-card text-text-muted border border-border hover:border-border-light'
              }
            `}
          >
            <span className={`
              w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold
              ${isActive 
                ? 'bg-white/20' 
                : isCompleted 
                  ? 'bg-green-500 text-white' 
                  : 'bg-bg-elevated'
              }
            `}>
              {isCompleted ? '✓' : index + 1}
            </span>
            <span className="text-sm font-medium whitespace-nowrap">{step.title}</span>
          </button>
        );
      })}
    </div>
  );
}
