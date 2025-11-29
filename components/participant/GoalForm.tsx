import React, { useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Button } from '../Button';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { ParticipantGoalData } from '../../types';
import { COMMON_FITNESS_GOALS_OPTIONS } from '../../constants';
import { callGeminiApiFn } from '../../firebaseClient';
import { renderMarkdown } from '../../utils/textUtils';

export interface GoalFormRef {
    submitForm: () => Promise<boolean>;
    getFormData: () => {
        fitnessGoals: string;
        workoutsPerWeekTarget: number;
        targetDate?: string;
        preferences?: string;
        coachPrescription?: string;
        markGoalCompleted: boolean;
    };
}

interface GoalFormProps {
  currentGoalForForm: ParticipantGoalData | null;
  allParticipantGoals: ParticipantGoalData[];
  onSave: (
    goalData: { fitnessGoals: string; workoutsPerWeekTarget: number; preferences?: string; targetDate?: string; coachPrescription?: string; },
    markLatestGoalAsCompleted: boolean,
    noGoalAdviseOptOut: boolean
  ) => Promise<void>;
  onTriggerAiGoalPrognosis?: (goalDataOverride?: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate' | 'isCompleted' | 'completedDate'>) => Promise<void>;
  showCoachFields?: boolean;
  isOnline?: boolean;
}

const GOAL_EMOJIS: Record<string, string> = {
    'goal_strength': '💪',
    'goal_muscle': '🏋️',
    'goal_condition': '🏃',
    'goal_weightloss': '⚖️',
    'goal_stress': '🧘',
    'goal_mobility': '🤸',
    'goal_general_wellbeing': '❤️',
};

export const GoalForm = forwardRef<GoalFormRef, GoalFormProps>(({
  currentGoalForForm,
  allParticipantGoals,
  onSave,
  onTriggerAiGoalPrognosis,
  showCoachFields = false,
  isOnline,
}, ref) => {
  const [hasNoSpecificGoals, setHasNoSpecificGoals] = useState(false);
  const [selectedCommonGoals, setSelectedCommonGoals] = useState<string[]>([]);
  const [customFitnessGoalText, setCustomFitnessGoalText] = useState('');
  
  const [workoutsPerWeekTarget, setWorkoutsPerWeekTarget] = useState<number>(0);
  const [workoutsPerWeekTargetDisplay, setWorkoutsPerWeekTargetDisplay] = useState<string>('0');
  const [targetDate, setTargetDate] = useState<string>('');
  
  const [targetDateError, setTargetDateError] = useState<string>('');
  const [preferences, setPreferences] = useState('');
  const [coachPrescription, setCoachPrescription] = useState('');
  const [noGoalAdviseOptOut, setNoGoalAdviseOptOut] = useState(false);
  const [markGoalCompleted, setMarkGoalCompleted] = useState(false);

  const [isGeneratingGoal, setIsGeneratingGoal] = useState(false);
  const [generationError, setGenerationError] = useState('');
  
  const [isGeneratingPrognosis, setIsGeneratingPrognosis] = useState(false);
  const [prognosisError, setPrognosisError] = useState('');
  const [prognosisSuccess, setPrognosisSuccess] = useState(false);

  useEffect(() => {
    const initialWPT = currentGoalForForm?.workoutsPerWeekTarget ?? 0;
    const currentFitnessGoalsString = currentGoalForForm?.fitnessGoals || '';

    if (currentFitnessGoalsString === "Inga specifika mål satta") {
        setHasNoSpecificGoals(true);
        setSelectedCommonGoals([]);
        setCustomFitnessGoalText('');
    } else {
        setHasNoSpecificGoals(false);
        const commonSelected: string[] = [];
        let customText = currentFitnessGoalsString;
        
        COMMON_FITNESS_GOALS_OPTIONS.forEach(opt => {
            if (currentFitnessGoalsString.includes(opt.label)) {
                commonSelected.push(opt.id);
            }
        });

        const allLabels = commonSelected
            .map(id => COMMON_FITNESS_GOALS_OPTIONS.find(opt => opt.id === id)?.label)
            .filter((l): l is string => !!l);
            
        allLabels.forEach(label => {
            const regex = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.?\\s*', 'g');
            customText = customText.replace(regex, '');
        });

        setSelectedCommonGoals(commonSelected);
        setCustomFitnessGoalText(customText.trim());
    }
    
    setWorkoutsPerWeekTarget(initialWPT);
    setWorkoutsPerWeekTargetDisplay(initialWPT.toString());
    setTargetDate(currentGoalForForm?.targetDate || '');
    setPreferences(currentGoalForForm?.preferences || '');
    setCoachPrescription(currentGoalForForm?.coachPrescription || '');
    setMarkGoalCompleted(false);
    setTargetDateError('');
  }, [currentGoalForForm]);

  useEffect(() => {
    if (hasNoSpecificGoals) {
      setSelectedCommonGoals([]);
      setCustomFitnessGoalText('');
      setWorkoutsPerWeekTarget(0);
      setWorkoutsPerWeekTargetDisplay('0');
      setTargetDate('');
      setTargetDateError('');
      setMarkGoalCompleted(false); 
    }
  }, [hasNoSpecificGoals]);

  const composedGoalText = useMemo(() => {
    if (hasNoSpecificGoals) return "Inga specifika mål satta";
    const commonGoalLabels = selectedCommonGoals
      .map(id => COMMON_FITNESS_GOALS_OPTIONS.find(opt => opt.id === id)?.label)
      .filter(Boolean);
    const parts = [...commonGoalLabels];
    if (customFitnessGoalText.trim()) {
      parts.push(customFitnessGoalText.trim());
    }
    let finalString = parts.join('. ').trim();
    if (finalString.length > 0 && !finalString.endsWith('.')) {
      finalString += '.';
    }
    return finalString;
  }, [hasNoSpecificGoals, selectedCommonGoals, customFitnessGoalText]);

  const handleTargetDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setTargetDate(newDate);
    if (newDate) {
        const today = new Date();
        today.setHours(0,0,0,0); 
        if (new Date(newDate) < today) {
            setTargetDateError("Måldatum kan inte vara i det förflutna.");
        } else {
            setTargetDateError("");
        }
    } else {
        setTargetDateError("");
    }
  };

  // Logic for manual update of input field
  const handleWorkoutsPerWeekDisplayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setWorkoutsPerWeekTargetDisplay(inputValue); 
    if (inputValue === "") {
        setWorkoutsPerWeekTarget(0); 
    } else {
        const num = parseInt(inputValue, 10);
        if (!isNaN(num)) {
            setWorkoutsPerWeekTarget(Math.max(0, Math.min(21, num)));
        }
    }
  };
  
  // Logic for + / - buttons
  const adjustWorkoutsPerWeek = (amount: number) => {
      const current = workoutsPerWeekTarget;
      const next = Math.max(0, Math.min(21, current + amount));
      setWorkoutsPerWeekTarget(next);
      setWorkoutsPerWeekTargetDisplay(next.toString());
  };

  const handleWorkoutsPerWeekDisplayBlur = () => {
    let numericValue = 0;
    if (workoutsPerWeekTargetDisplay !== "") {
        const parsedNum = parseInt(workoutsPerWeekTargetDisplay, 10);
        if (!isNaN(parsedNum)) {
            numericValue = Math.max(0, Math.min(21, parsedNum));
        }
    }
    setWorkoutsPerWeekTarget(numericValue); 
    setWorkoutsPerWeekTargetDisplay(numericValue.toString()); 
  };
  
  const handleCommonGoalToggle = (goalId: string) => {
    if (hasNoSpecificGoals) return;
    setSelectedCommonGoals(prev => 
      prev.includes(goalId) ? prev.filter(id => id !== goalId) : [...prev, goalId]
    );
  };

  const handleGenerateSmartGoal = async () => {
    const commonGoalLabels = selectedCommonGoals
        .map(id => COMMON_FITNESS_GOALS_OPTIONS.find(opt => opt.id === id)?.label)
        .filter(Boolean);
    const goalInput = [...commonGoalLabels, customFitnessGoalText.trim()].filter(Boolean).join('. ');
    
    if (!goalInput) {
        setGenerationError("Skriv eller välj ett mål först.");
        return;
    }

    setIsGeneratingGoal(true);
    setGenerationError('');

    try {
        const result = await callGeminiApiFn({
            action: 'generate_smart_goal',
            context: { goalInput }
        });
        const { text, error } = result.data as { text?: string; error?: string };
        if (error) { throw new Error(`Cloud Function error: ${error}`); }
        if (!text) { throw new Error("Received empty response from AI."); }
        
        setCustomFitnessGoalText(text);
        setSelectedCommonGoals([]); 
    } catch (err) {
        console.error("Error generating SMART goal:", err);
        setGenerationError("Kunde inte generera målförslag. Försök igen.");
    } finally {
        setIsGeneratingGoal(false);
    }
  };

  const composeFinalGoalData = () => {
    let finalFitnessGoalsString = '';
    let finalWorkoutsPerWeekTarget = workoutsPerWeekTarget;
    let finalNoGoalAdviseOptOut = noGoalAdviseOptOut;
    let finalTargetDate = targetDate || undefined;

    if (hasNoSpecificGoals) {
      finalFitnessGoalsString = "Inga specifika mål satta";
      finalWorkoutsPerWeekTarget = 0;
      finalTargetDate = undefined;
      finalNoGoalAdviseOptOut = true; 
    } else {
      finalFitnessGoalsString = composedGoalText;

      if (finalFitnessGoalsString === '') {
        finalTargetDate = undefined;
      } else {
        finalNoGoalAdviseOptOut = false;
      }
    }
    
    return {
        fitnessGoals: finalFitnessGoalsString,
        workoutsPerWeekTarget: finalWorkoutsPerWeekTarget,
        targetDate: finalTargetDate,
        preferences: preferences.trim() || undefined,
        coachPrescription: coachPrescription.trim() || undefined,
        calculatedNoGoalAdviseOptOut: finalNoGoalAdviseOptOut
    };
  };
  
  const handleTriggerPrognosisClick = async () => {
    if (hasNoSpecificGoals) {
        setPrognosisError("Kan inte generera recept utan ett mål.");
        return;
    }
    if (!onTriggerAiGoalPrognosis) return;

    const goalData = composeFinalGoalData();
    if (!goalData.fitnessGoals) {
        setPrognosisError("Skriv eller välj ett mål innan du genererar ett recept.");
        return;
    }

    setIsGeneratingPrognosis(true);
    setPrognosisError('');
    setPrognosisSuccess(false);
    try {
        await onTriggerAiGoalPrognosis(goalData);
        setPrognosisSuccess(true);
        setTimeout(() => setPrognosisSuccess(false), 3000);
    } catch (e) {
        setPrognosisError("Kunde inte generera recept. Försök igen.");
        console.error(e);
    } finally {
        setIsGeneratingPrognosis(false);
    }
  };

  const handleSubmit = async () => {
    handleWorkoutsPerWeekDisplayBlur();

    if (targetDateError) {
      alert("Korrigera felen i formuläret innan du sparar.");
      return false;
    }

    const finalGoalData = composeFinalGoalData();
    
    await onSave(
      { 
        fitnessGoals: finalGoalData.fitnessGoals, 
        workoutsPerWeekTarget: finalGoalData.workoutsPerWeekTarget, 
        targetDate: finalGoalData.targetDate, 
        preferences: finalGoalData.preferences, 
        coachPrescription: finalGoalData.coachPrescription 
      }, 
      markGoalCompleted, 
      finalGoalData.calculatedNoGoalAdviseOptOut
    );

    return true;
  };

  useImperativeHandle(ref, () => ({
    submitForm: handleSubmit,
    getFormData: () => {
        handleWorkoutsPerWeekDisplayBlur(); 
        const finalGoalData = composeFinalGoalData();
        return {
            fitnessGoals: finalGoalData.fitnessGoals,
            workoutsPerWeekTarget: finalGoalData.workoutsPerWeekTarget,
            targetDate: finalGoalData.targetDate,
            preferences: finalGoalData.preferences,
            coachPrescription: finalGoalData.coachPrescription,
            markGoalCompleted: markGoalCompleted,
        };
    },
  }));

  const isLatestGoalAlreadyCompleted = currentGoalForForm?.isCompleted || false;
  const showNoGoalAdviceOptOutCheckbox = !hasNoSpecificGoals && composeFinalGoalData().fitnessGoals === '';
  const goalHasText = composeFinalGoalData().fitnessGoals !== '' && composeFinalGoalData().fitnessGoals !== 'Inga specifika mål satta';

  // --- Render ---

  return (
    <div className="space-y-6 py-2">
      {/* HISTORY DROPDOWN */}
      {allParticipantGoals && allParticipantGoals.length > 0 && !showCoachFields && (
        <details className="group bg-gray-50 rounded-lg border border-gray-200">
          <summary className="px-4 py-2 text-base font-semibold text-gray-600 cursor-pointer list-none flex justify-between items-center group-hover:text-gray-800 transition-colors">
            <span>Tidigare målhistorik</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </summary>
          <div className="p-4 border-t border-gray-200 space-y-3 max-h-60 overflow-y-auto">
            {allParticipantGoals.slice().sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime()).map(goal => (
                <div key={goal.id} className={`p-3 rounded-md border ${goal.isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                    {goal.isCompleted && goal.completedDate && (
                      <p className="font-semibold text-green-700 text-sm mb-1">🏆 Mål Slutfört ({new Date(goal.completedDate!).toLocaleDateString('sv-SE')})</p>
                    )}
                    <div className="text-xs sm:text-sm text-gray-700 space-y-0.5">
                        <p><strong className="font-medium">Mål:</strong> {goal.fitnessGoals}</p>
                        {goal.targetDate && <p><strong className="font-medium">Datum:</strong> {new Date(goal.targetDate).toLocaleDateString('sv-SE')}</p>}
                        <p><strong className="font-medium">Frekvens:</strong> {goal.workoutsPerWeekTarget} pass/v</p>
                    </div>
                </div>
            ))}
          </div>
        </details>
      )}

      {/* MAIN GOAL SECTION - HERO CARD */}
      <section className="relative">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden p-6 sm:p-8">
                
                {!hasNoSpecificGoals && (
                    <>
                        <div className="flex justify-between items-start mb-4">
                             <label htmlFor="customFitnessGoalText" className="text-xs font-bold uppercase tracking-wider text-gray-400">
                                Huvudmål & Vision
                            </label>
                            {!showCoachFields && (
                                 <Button 
                                    type="button" 
                                    variant="ghost" 
                                    size="sm"
                                    className="!text-xs !py-1 !px-2 text-flexibel bg-flexibel/10 hover:bg-flexibel/20"
                                    onClick={handleGenerateSmartGoal}
                                    disabled={isGeneratingGoal || !isOnline}
                                    title={!isOnline ? "AI kräver internet" : "Gör målet SMART med AI"}
                                >
                                    {isGeneratingGoal ? "Tänker..." : "✨ Gör SMART"}
                                </Button>
                            )}
                        </div>

                        <div className="relative">
                            <textarea
                                id="customFitnessGoalText"
                                name="customFitnessGoalText"
                                value={customFitnessGoalText}
                                onChange={(e) => setCustomFitnessGoalText(e.target.value)}
                                placeholder="Vad vill du uppnå? T.ex. 'Klara 100kg i marklyft' eller 'Springa milen under 60 min'."
                                rows={2}
                                className="w-full text-xl sm:text-3xl font-bold text-gray-800 placeholder-gray-300 border-none focus:ring-0 focus:outline-none bg-transparent resize-none leading-tight"
                            />
                            {generationError && <p className="absolute top-full left-0 text-xs text-red-500 mt-1">{generationError}</p>}
                        </div>
                        
                        {/* Common Goals Grid - Bento Style */}
                        <div className="mt-8">
                            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Fokusområden</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {COMMON_FITNESS_GOALS_OPTIONS.map(opt => {
                                    const isSelected = selectedCommonGoals.includes(opt.id);
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => handleCommonGoalToggle(opt.id)}
                                            className={`
                                                relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 group
                                                ${isSelected 
                                                    ? 'bg-flexibel/10 border-flexibel ring-1 ring-flexibel/50 shadow-sm' 
                                                    : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                                }
                                            `}
                                        >
                                            <span className="text-2xl">{GOAL_EMOJIS[opt.id] || '🎯'}</span>
                                            <span className={`text-sm font-semibold ${isSelected ? 'text-flexibel-dark' : 'text-gray-600 group-hover:text-gray-800'}`}>
                                                {opt.label}
                                            </span>
                                            {isSelected && (
                                                <div className="absolute top-2 right-2 w-2 h-2 bg-flexibel rounded-full"></div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* Checkbox for No Goals moved inside the card */}
                <div className={`flex items-center ${!hasNoSpecificGoals ? 'mt-8 pt-6 border-t border-gray-100' : ''}`}>
                    <label className="inline-flex items-center space-x-2 cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                        <input
                            type="checkbox"
                            id="hasNoSpecificGoals"
                            checked={hasNoSpecificGoals}
                            onChange={(e) => setHasNoSpecificGoals(e.target.checked)}
                            className="rounded border-gray-300 text-flexibel focus:ring-flexibel"
                        />
                        <span>Jag vill inte sätta några specifika mål just nu</span>
                    </label>
                </div>
            </div>
      </section>
      
      {!hasNoSpecificGoals && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Weekly Target Card */}
            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 flex flex-col items-center justify-center text-center h-full">
                 <label htmlFor="workoutsPerWeekTarget" className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
                    Mål: Pass per vecka
                </label>
                
                <div className="flex items-center gap-6">
                    <button 
                        type="button"
                        onClick={() => adjustWorkoutsPerWeek(-1)}
                        disabled={workoutsPerWeekTarget <= 0 || isLatestGoalAlreadyCompleted}
                        className="w-12 h-12 rounded-full bg-gray-100 text-gray-600 text-2xl font-bold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                        -
                    </button>
                    
                    <div className="relative w-20 text-center">
                        <input
                            id="workoutsPerWeekTarget"
                            type="number"
                            value={workoutsPerWeekTargetDisplay}
                            onChange={handleWorkoutsPerWeekDisplayChange}
                            onBlur={handleWorkoutsPerWeekDisplayBlur}
                            disabled={isLatestGoalAlreadyCompleted}
                            className="w-full text-5xl font-extrabold text-gray-800 text-center bg-transparent border-none focus:ring-0 p-0 m-0"
                        />
                    </div>

                    <button 
                        type="button"
                        onClick={() => adjustWorkoutsPerWeek(1)}
                        disabled={workoutsPerWeekTarget >= 21 || isLatestGoalAlreadyCompleted}
                        className="w-12 h-12 rounded-full bg-gray-100 text-gray-600 text-2xl font-bold hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                        +
                    </button>
                </div>
                <p className="text-sm text-gray-500 mt-4 font-medium">Detta påverkar din streak.</p>
            </div>

            {/* Details Card */}
            <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 flex flex-col h-full space-y-4">
                 <div>
                    <label htmlFor="targetDate" className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
                        Måldatum (valfritt)
                    </label>
                    <Input
                        id="targetDate"
                        type="date"
                        value={targetDate}
                        onChange={handleTargetDateChange}
                        min={new Date().toISOString().split('T')[0]}
                        disabled={isLatestGoalAlreadyCompleted || !goalHasText}
                        error={targetDateError}
                        inputSize="lg"
                        className="!bg-gray-50 !border-gray-200"
                    />
                 </div>
                 
                 <div>
                    <label htmlFor="userPreferences" className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5 block">
                        Preferenser & Hinder (valfritt)
                    </label>
                    <Textarea
                        id="userPreferences"
                        value={preferences}
                        onChange={(e) => setPreferences(e.target.value)}
                        placeholder="T.ex. 'Kan bara träna 45 min', 'Känning i axel', 'Vill träna utomhus'."
                        rows={3}
                        disabled={hasNoSpecificGoals || isLatestGoalAlreadyCompleted}
                        className="!bg-gray-50 !border-gray-200 text-sm"
                    />
                 </div>
            </div>
        </section>
      )}

        {/* Status & AI Section */}
        <section className="space-y-4">
             {currentGoalForForm && isLatestGoalAlreadyCompleted && (
                 <div className="p-4 bg-green-100 rounded-xl border border-green-300 flex items-center gap-3 text-green-800">
                    <span className="text-2xl">🏆</span>
                    <span className="font-semibold">Mål uppnått den {new Date(currentGoalForForm.completedDate!).toLocaleDateString('sv-SE')}! Sätt gärna ett nytt.</span>
                </div>
             )}

            {currentGoalForForm && !isLatestGoalAlreadyCompleted && !hasNoSpecificGoals && currentGoalForForm.fitnessGoals.trim() && (
                <div className="flex items-center justify-center">
                    <label className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors">
                        <input
                            type="checkbox"
                            checked={markGoalCompleted}
                            onChange={(e) => setMarkGoalCompleted(e.target.checked)}
                            className="h-5 w-5 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                        />
                        <span className="text-base font-medium text-yellow-800">
                            Markera nuvarande mål som uppnått! 🥇
                        </span>
                    </label>
                </div>
            )}

            {showCoachFields && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <Textarea
                        label="Coach Recept (synligt för medlem)"
                        name="coachPrescription"
                        value={coachPrescription}
                        onChange={(e) => setCoachPrescription(e.target.value)}
                        placeholder="Ge medlemmen en övergripande plan..."
                        rows={4}
                    />
                </div>
            )}

            {showCoachFields && onTriggerAiGoalPrognosis && (
                 <div className="pt-2">
                    <Button 
                        onClick={handleTriggerPrognosisClick} 
                        fullWidth 
                        variant="secondary" 
                        disabled={isGeneratingPrognosis || hasNoSpecificGoals || !goalHasText || !isOnline}
                    >
                        {isGeneratingPrognosis ? 'Genererar...' : (isOnline ? 'Generera AI Recept för Mål' : 'AI Offline')}
                    </Button>
                    {prognosisError && <p className="text-sm text-red-500 mt-1 text-center">{prognosisError}</p>}
                    {prognosisSuccess && <p className="text-sm text-green-600 mt-1 text-center font-medium">AI Recept genererat!</p>}
                </div>
            )}

            {!showCoachFields && currentGoalForForm?.aiPrognosis && (
                <div className="bg-violet-50 rounded-2xl border border-violet-200 p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-violet-900 mb-3 flex items-center gap-2">
                        <span className="text-xl">✨</span> Ditt AI-Recept
                    </h3>
                    <div className="prose prose-sm max-w-none text-violet-800 leading-relaxed">
                        {renderMarkdown(currentGoalForForm.aiPrognosis)}
                    </div>
                </div>
            )}
        </section>
    </div>
  );
});

GoalForm.displayName = "GoalForm";