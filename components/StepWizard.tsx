import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface StepWizardProps {
  title: string;
  description?: string;
  canNext: boolean;
  canPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  children: React.ReactNode;
  isLastStep?: boolean;
}

export const StepWizard: React.FC<StepWizardProps> = ({
  title,
  description,
  canNext,
  canPrev,
  onNext,
  onPrev,
  children,
  isLastStep = false,
}) => {
  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full p-4">
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">{title}</h2>
        {description && <p className="text-gray-500">{description}</p>}
      </div>

      <div className="flex-1 overflow-y-auto mb-6 p-1">
        {children}
      </div>

      <div className="flex justify-between items-center pt-4 border-t border-gray-200 bg-white sticky bottom-0 z-10 p-4">
        <button
          onClick={onPrev}
          disabled={!canPrev}
          className={`flex items-center px-6 py-3 rounded-lg text-lg font-medium transition-colors ${
            canPrev
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          이전 (Prev)
        </button>

        <button
          onClick={onNext}
          disabled={!canNext}
          className={`flex items-center px-8 py-3 rounded-lg text-lg font-bold shadow-lg transition-transform transform active:scale-95 ${
            canNext
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isLastStep ? '동영상 생성 (Create)' : '다음 (Next)'}
          {!isLastStep && <ArrowRight className="w-5 h-5 ml-2" />}
        </button>
      </div>
    </div>
  );
};