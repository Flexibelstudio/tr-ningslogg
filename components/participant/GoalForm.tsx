import React, { useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import { Button } from '../Button';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { ParticipantGoalData } from '../../types';
import { COMMON_FITNESS_GOALS_OPTIONS } from '../../constants';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
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
  onTriggerAiGoalPrognosis?: (goalDataOverride?: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate'| 'isCompleted' | 'completedDate'>) => Promise<void>;
  showCoachFields?: boolean;
  ai?: GoogleGenAI | null;
  isOnline?: boolean;
}

export const GoalForm = forwardRef<GoalFormRef, GoalFormProps>(({
  currentGoalForForm,
  allParticipantGoals,
  onSave,
  onTriggerAiGoalPrognosis,
  showCoachFields = false,
  ai,
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
        
        // First, identify all common goals present in the string
        COMMON_FITNESS_GOALS_OPTIONS.forEach(opt => {
            if (currentFitnessGoalsString.includes(opt.label)) {
                commonSelected.push(opt.id);
            }
        });

        // Then, remove all identified common goals to isolate the custom text
        const allLabels = commonSelected
            .map(id => COMMON_FITNESS_GOALS_OPTIONS.find(opt => opt.id === id)?.label)
            .filter((l): l is string => !!l);
            
        allLabels.forEach(label => {
            // Use a regex to safely remove the label and optional trailing period/space
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
    if (!ai) return;

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

    const prompt = `Du är en hjälpsam AI-assistent för en träningscoach. Användaren anger ett enkelt träningsmål. Din uppgift är att omvandla det till ett SMART (Specifikt, Mätbart, Accepterat, Realistiskt, Tidsbundet) mål. Svara på svenska. Var koncis och uppmuntrande, och returnera ENDAST den nya måltexten.

Användarens mål: "${goalInput}"`;

    try {
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt
        });
        setCustomFitnessGoalText(response.text);
        setSelectedCommonGoals([]); // Clear selections as they are now incorporated
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
        handleWorkoutsPerWeekDisplayBlur(); // Ensure numeric value is up-to-date
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

  return (
    <div className="space-y-6 py-4">
      {allParticipantGoals && allParticipantGoals.length > 0 && !showCoachFields && (
        <details className="group">
          <summary className="text-xl font-semibold text-gray-700 cursor-pointer list-none flex justify-between items-center py-2 hover:text-flexibel transition-colors">
            Målhistorik
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 transition-transform duration-200 group-open:rotate-180" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </summary>
          <div className="mt-2 space-y-3 max-h-60 overflow-y-auto pr-2 -mr-2">
            {allParticipantGoals.slice().sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime()).map(goal => (
                <div key={goal.id} className={`p-3 rounded-lg border ${goal.isCompleted ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                    {goal.isCompleted && goal.completedDate && (
                      <p className="font-semibold text-green-700 text-base mb-1">🏆 Mål Slutfört ({new Date(goal.completedDate!).toLocaleDateString('sv-SE')})</p>
                    )}
                    <div className="text-sm text-gray-700 space-y-1">
                        <p><strong className="font-medium text-gray-800">Mål:</strong> {goal.fitnessGoals || "Inget specifikt mål angivet"}</p>
                        {goal.targetDate && <p><strong className="font-medium text-gray-800">Måldatum:</strong> {new Date(goal.targetDate).toLocaleDateString('sv-SE')}</p>}
                        <p><strong className="font-medium text-gray-800">Veckotarget:</strong> {goal.workoutsPerWeekTarget} pass</p>
                        <p><strong className="font-medium text-gray-800">Preferenser:</strong> {goal.preferences || "Inga angivna"}</p>
                        <p className="text-xs text-gray-500 pt-1 mt-1 border-t"><strong className="font-normal">Satt den:</strong> {new Date(goal.setDate).toLocaleString('sv-SE')}</p>
                    </div>
                </div>
            ))}
          </div>
        </details>
      )}
      <section className="space-y-4 pt-4 border-t">
        {!showCoachFields && <h3 className="text-xl font-semibold text-gray-700">Aktuella Mål</h3>}
        
        <label className="flex items-center space-x-3 p-3 bg-gray-100 rounded-md cursor-pointer">
          <input
            type="checkbox"
            id="hasNoSpecificGoals"
            checked={hasNoSpecificGoals}
            onChange={(e) => setHasNoSpecificGoals(e.target.checked)}
            className="h-6 w-6 text-flexibel border-gray-300 rounded focus:ring-flexibel"
          />
          <span className="text-lg font-medium text-gray-700">
            Jag har inga specifika mål just nu
          </span>
        </label>

        {currentGoalForForm && !isLatestGoalAlreadyCompleted && !hasNoSpecificGoals && currentGoalForForm.fitnessGoals.trim() && (
            <label className="flex items-center space-x-3 mt-2 p-3 bg-yellow-50 rounded-md border border-yellow-200 cursor-pointer">
                <input
                    type="checkbox"
                    id="markGoalCompleted"
                    checked={markGoalCompleted}
                    onChange={(e) => setMarkGoalCompleted(e.target.checked)}
                    className="h-6 w-6 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                />
                <span className="text-lg text-yellow-700">
                    Jag har uppnått detta mål: "{currentGoalForForm.fitnessGoals}"
                </span>
            </label>
        )}
        
        {!hasNoSpecificGoals && (
          <>
            <div className="pt-2 space-y-2">
              <label className="block text-lg font-medium text-gray-700 mb-1">Vanliga Mål (välj en eller flera):</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {COMMON_FITNESS_GOALS_OPTIONS.map(opt => (
                  <label key={opt.id} className="flex items-center space-x-3 p-2.5 rounded-md border border-gray-200 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      id={opt.id}
                      checked={selectedCommonGoals.includes(opt.id)}
                      onChange={() => handleCommonGoalToggle(opt.id)}
                      className="h-6 w-6 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                      disabled={hasNoSpecificGoals}
                    />
                    <span className="text-lg text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div>
                <label htmlFor="customFitnessGoalText" className="block text-lg font-medium text-gray-700 mb-1">
                    Annat/Specifikt mål
                </label>
                <div className="flex items-start gap-2">
                    <Textarea
                        id="customFitnessGoalText"
                        name="customFitnessGoalText"
                        value={customFitnessGoalText}
                        onChange={(e) => setCustomFitnessGoalText(e.target.value)}
                        placeholder="Var specifik! T.ex. 'Öka Marklyft 1RM till 100kg', 'Springa 5km under 25 min', 'Gå ner 3kg fettmassa'."
                        rows={3}
                        disabled={hasNoSpecificGoals}
                        className="flex-grow"
                    />
                </div>
                 {generationError && <p className="text-sm text-red-500 mt-1">{generationError}</p>}
                 {!showCoachFields && (
                    <p className="mt-1 text-sm text-gray-500">
                        Tips: Försök formulera dina mål SMART (Specifikt, Mätbart, Accepterat, Realistiskt, Tidsbundet).
                    </p>
                 )}
            </div>
          </>
        )}
        
         {currentGoalForForm && isLatestGoalAlreadyCompleted && (
             <div className="mt-2 p-3 bg-green-100 rounded-md border border-green-300 text-lg text-green-700">
                🏆 Mål "{currentGoalForForm.fitnessGoals}" uppnått den {new Date(currentGoalForForm.completedDate!).toLocaleDateString('sv-SE')}! Sätt gärna ett nytt.
            </div>
         )}

        {!hasNoSpecificGoals && (
            <div className="space-y-4">
                <Input
                label="Mål Pass/Vecka"
                id="workoutsPerWeekTarget"
                name="workoutsPerWeekTarget"
                type="number"
                value={workoutsPerWeekTargetDisplay}
                onChange={handleWorkoutsPerWeekDisplayChange}
                onBlur={handleWorkoutsPerWeekDisplayBlur}
                placeholder="T.ex. 3"
                min="0"
                max="21" 
                step="1"
                disabled={isLatestGoalAlreadyCompleted}
                />
                <p className="text-sm text-gray-500 -mt-3">Antal pass/vecka (0-21) för detta mål. Påverkar streak.</p>
                
                <Input
                    label="Måldatum (valfritt)"
                    id="targetDate"
                    name="targetDate"
                    type="date"
                    value={targetDate}
                    onChange={handleTargetDateChange}
                    min={new Date().toISOString().split('T')[0]}
                    disabled={isLatestGoalAlreadyCompleted || !goalHasText}
                    error={targetDateError}
                />
                {!goalHasText && <p className="text-sm text-gray-500 -mt-3">Ange ett mål för att kunna sätta ett måldatum.</p>}
            </div>
        )}
        
        {showNoGoalAdviceOptOutCheckbox && (
          <label className="flex items-center space-x-3 bg-yellow-50 p-3 rounded-md border border-yellow-200 cursor-pointer">
            <input
              type="checkbox"
              id="noGoalAdviceOptOut"
              checked={noGoalAdviseOptOut}
              onChange={(e) => setNoGoalAdviseOptOut(e.target.checked)}
              className="h-6 w-6 text-flexibel border-gray-300 rounded focus:ring-flexibel"
              disabled={hasNoSpecificGoals}
            />
            <span className="text-sm text-yellow-700">
              Jag vill ha AI passförslag även om jag inte har angett ett specifikt mål ovan (AI:n kommer då inte påminna om att sätta mål).
            </span>
          </label>
        )}

        <Textarea
          label="Övrigt för AI (valfritt)"
          name="preferences"
          id="userPreferences"
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          placeholder="T.ex. 'Tränar helst morgon', 'Har känsligt knä', 'Behöver korta pass', 'Tillgång till begränsad utrustning'."
          rows={3}
          disabled={hasNoSpecificGoals || isLatestGoalAlreadyCompleted}
        />
        {showCoachFields && (
            <Textarea
                label="Coach Recept (synligt för medlem)"
                name="coachPrescription"
                value={coachPrescription}
                onChange={(e) => setCoachPrescription(e.target.value)}
                placeholder="Ge medlemmen en övergripande plan för att nå målet. T.ex. 'Fokusera på 2 PT-Bas pass och 1 HIIT pass i veckan. Öka vikterna successivt.'"
                rows={4}
            />
        )}

        {showCoachFields && ai && onTriggerAiGoalPrognosis && (
            <div className="pt-4 border-t">
                <Button 
                    onClick={handleTriggerPrognosisClick} 
                    fullWidth 
                    variant="secondary" 
                    disabled={isGeneratingPrognosis || hasNoSpecificGoals || !goalHasText || !isOnline}
                    title={!isOnline ? "Funktionen kräver internetanslutning" : (hasNoSpecificGoals || !goalHasText ? "Sätt ett mål först" : "")}
                >
                    {isGeneratingPrognosis ? 'Genererar...' : (isOnline ? 'Generera AI Recept för Mål' : 'AI Offline')}
                </Button>
                 {prognosisError && <p className="text-sm text-red-500 mt-1">{prognosisError}</p>}
                 {prognosisSuccess && <p className="text-sm text-green-600 mt-1">AI Recept genererat och sparat!</p>}
            </div>
        )}

        {!showCoachFields && currentGoalForForm?.aiPrognosis && (
            <div className="mt-4 pt-4 border-t">
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Ditt AI-genererade Recept</h3>
                <div className="p-4 bg-violet-50 rounded-lg border border-violet-200 max-h-80 overflow-y-auto prose prose-base max-w-none">
                    {renderMarkdown(currentGoalForForm.aiPrognosis)}
                </div>
            </div>
        )}
      </section>
    </div>
  );
});

GoalForm.displayName = "GoalForm";