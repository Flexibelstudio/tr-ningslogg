import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Button } from '../Button';
import { Input } from '../Input';
import { Textarea } from '../Textarea';
import { ParticipantGoalData } from '../../types';
import { COMMON_FITNESS_GOALS_OPTIONS } from '../../constants';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export interface GoalFormRef {
    submitForm: () => boolean;
}

interface GoalFormProps {
  currentGoalForForm: ParticipantGoalData | null;
  allParticipantGoals: ParticipantGoalData[];
  onSave: (
    goalData: { fitnessGoals: string; workoutsPerWeekTarget: number; preferences?: string; targetDate?: string; coachPrescription?: string; },
    markLatestGoalAsCompleted: boolean,
    noGoalAdviseOptOut: boolean
  ) => void;
  onTriggerAiGoalPrognosis: (goalDataOverride?: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate'| 'isCompleted' | 'completedDate'>) => void;
  showCoachFields?: boolean;
  ai?: GoogleGenAI | null;
}

const getIconForHeader = (headerText: string): JSX.Element | null => {
    const lowerHeaderText = headerText.toLowerCase();
    if (lowerHeaderText.includes("prognos")) return <span className="mr-2 text-xl" role="img" aria-label="Prognos">🔮</span>;
    if (lowerHeaderText.includes("nyckelpass") || lowerHeaderText.includes("rekommendera")) return <span className="mr-2 text-xl" role="img" aria-label="Rekommenderade pass">🎟️</span>;
    if (lowerHeaderText.includes("tänka på") || lowerHeaderText.includes("tips") || lowerHeaderText.includes("motivation")) return <span className="mr-2 text-xl" role="img" aria-label="Tips">💡</span>;
    if (lowerHeaderText.includes("lycka till") || lowerHeaderText.includes("avslutning")) return <span className="mr-2 text-xl" role="img" aria-label="Avslutning">🎉</span>;
    if (lowerHeaderText.includes("sammanfattning") || lowerHeaderText.includes("uppmuntran")) return <span className="mr-2 text-xl" role="img" aria-label="Sammanfattning">⭐</span>;
    if (lowerHeaderText.includes("progress") || lowerHeaderText.includes("inbody") || lowerHeaderText.includes("styrka")) return <span className="mr-2 text-xl" role="img" aria-label="Framsteg">💪</span>;
    if (lowerHeaderText.includes("mentalt välbefinnande") || lowerHeaderText.includes("balans")) return <span className="mr-2 text-xl" role="img" aria-label="Mentalt välbefinnande">🧘</span>;
    if (lowerHeaderText.includes("observationer") || lowerHeaderText.includes("pass") || lowerHeaderText.includes("aktiviteter")) return <span className="mr-2 text-xl" role="img" aria-label="Observationer">👀</span>;
    if (lowerHeaderText.includes("särskilda råd")) return <span className="mr-2 text-xl" role="img" aria-label="Särskilda råd">ℹ️</span>;
    return <span className="mr-2 text-xl" role="img" aria-label="Rubrik">📄</span>;
  };

const renderAiPrognosis = (feedback: string | null): JSX.Element[] | null => {
    if (!feedback) return null;
    const lines = feedback.split('\n');
    const renderedElements: JSX.Element[] = [];
    let currentListItems: JSX.Element[] = [];
    let listKeySuffix = 0;
  
    const flushList = () => {
      if (currentListItems.length > 0) {
        renderedElements.push(
          <ul key={`ul-${renderedElements.length}-${listKeySuffix}`} className="list-disc pl-5 space-y-1 my-2">
            {currentListItems}
          </ul>
        );
        currentListItems = [];
        listKeySuffix++;
      }
    };
  
    for (let i = 0; i < lines.length; i++) {
      let lineContent = lines[i];
      lineContent = lineContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      lineContent = lineContent.replace(/\*(?=\S)(.*?)(?<=\S)\*/g, '<em>$1</em>');
  
      if (lineContent.startsWith('## ')) {
        flushList();
        const headerText = lineContent.substring(3).trim();
        const icon = getIconForHeader(headerText.replace(/<\/?(strong|em)>/g, ''));
        renderedElements.push(
          <h4 key={`h4-${i}`} className="text-lg font-bold text-gray-800 flex items-center mb-1.5 mt-3">
            {icon} <span dangerouslySetInnerHTML={{ __html: headerText }} />
          </h4>
        );
      } else if (lineContent.startsWith('* ') || lineContent.startsWith('- ')) {
        const listItemText = lineContent.substring(2).trim();
        currentListItems.push(
          <li key={`li-${i}`} className="text-base text-gray-700" dangerouslySetInnerHTML={{ __html: listItemText }} />
        );
      } else {
        flushList(); 
        if (lineContent.trim() !== '') {
          renderedElements.push(
            <p key={`p-${i}`} className="text-base text-gray-700 mb-2" dangerouslySetInnerHTML={{ __html: lineContent }} />
          );
        }
      }
    }
    flushList(); 
    return renderedElements;
};

export const GoalForm = forwardRef<GoalFormRef, GoalFormProps>(({
  currentGoalForForm,
  allParticipantGoals,
  onSave,
  onTriggerAiGoalPrognosis,
  showCoachFields = false,
  ai
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
                customText = customText.replace(opt.label, '').replace(/\.\s*/, '').trim();
            }
        });
        setSelectedCommonGoals(commonSelected);
        setCustomFitnessGoalText(customText);
    }
    
    setWorkoutsPerWeekTarget(initialWPT);
    setWorkoutsPerWeekTargetDisplay(initialWPT.toString());
    setTargetDate(currentGoalForForm?.targetDate || '');
    setPreferences(currentGoalForForm?.preferences || '');
    setCoachPrescription(currentGoalForForm?.coachPrescription || '');
    setMarkGoalCompleted(currentGoalForForm?.isCompleted || false);
    
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
      const commonGoalLabels = selectedCommonGoals
        .map(id => COMMON_FITNESS_GOALS_OPTIONS.find(opt => opt.id === id)?.label)
        .filter(Boolean);
      
      const parts = [...commonGoalLabels];
      if (customFitnessGoalText.trim()) {
        parts.push(customFitnessGoalText.trim());
      }
      finalFitnessGoalsString = parts.join('. ').trim();
      if (finalFitnessGoalsString.length > 0 && !finalFitnessGoalsString.endsWith('.')) {
        finalFitnessGoalsString += '.';
      }

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

  const handleSubmit = () => {
    handleWorkoutsPerWeekDisplayBlur(); 

    if (targetDateError) {
        alert("Korrigera felen i formuläret innan du sparar.");
        return false;
    }
    
    const { fitnessGoals, workoutsPerWeekTarget, targetDate, preferences, coachPrescription, calculatedNoGoalAdviseOptOut } = composeFinalGoalData();
    onSave({ fitnessGoals, workoutsPerWeekTarget, targetDate, preferences, coachPrescription }, markGoalCompleted, calculatedNoGoalAdviseOptOut);
    return true;
  };

  useImperativeHandle(ref, () => ({
    submitForm: handleSubmit,
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
                      <p className="font-semibold text-green-700 text-base mb-1">🏆 Mål Slutfört ({new Date(goal.completedDate).toLocaleDateString('sv-SE')})</p>
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
                    {showCoachFields && ai && (
                        <Button type="button" variant="outline" size="sm" onClick={handleGenerateSmartGoal} disabled={isGeneratingGoal} className="self-center">
                            {isGeneratingGoal ? '...' : '✨'}
                        </Button>
                    )}
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
          placeholder="T.ex. 'Tränar helst morgon', 'Har känsligt knä', 'Behöver korta pass', 'Tillgång till gym 3 ggr/v'."
          rows={3}
          disabled={isLatestGoalAlreadyCompleted && !hasNoSpecificGoals} 
        />

        {showCoachFields && (
            <Textarea
                label="Coach Recept (syns för medlem)"
                name="coachPrescription"
                id="coachPrescription"
                value={coachPrescription}
                onChange={(e) => setCoachPrescription(e.target.value)}
                placeholder="Coach rekommendation för att nå målet. T.ex. 'Fortsätt med PT-Bas 2 ggr/vecka, addera 1 HIIT-pass.'"
                rows={3}
            />
        )}
      </section>

      {currentGoalForForm?.aiPrognosis && !showCoachFields && (
        <section className="space-y-2 pt-4 border-t">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-xl font-semibold text-gray-700">Senaste AI Prognos (Recept)</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onTriggerAiGoalPrognosis(composeFinalGoalData())}
            >
              Uppdatera Prognos
            </Button>
          </div>
          <div className="p-3 bg-violet-50 border border-violet-200 rounded-md prose prose-sm max-w-none text-gray-800 leading-relaxed">
            {renderAiPrognosis(currentGoalForForm.aiPrognosis)}
          </div>
        </section>
      )}
    </div>
  );
});
GoalForm.displayName = "GoalForm";
