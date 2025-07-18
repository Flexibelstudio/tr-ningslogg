

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Input, Select } from '../Input';
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { ParticipantGoalData, ParticipantProfile, GenderOption, ParticipantGamificationStats } from '../../types';
import { GENDER_OPTIONS, COMMON_FITNESS_GOALS_OPTIONS } from '../../constants';
import * as dateUtils from '../../utils/dateUtils';

export interface ProfileGoalFormRef {
    submitForm: () => boolean;
}

interface ProfileGoalFormProps {
  currentProfile: ParticipantProfile | null;
  currentGoalForForm: ParticipantGoalData | null;
  allParticipantGoals: ParticipantGoalData[];
  participantGamificationStats: ParticipantGamificationStats | null;
  onSave: (
    profileData: { name?: string; age?: string; gender?: GenderOption; enableLeaderboardParticipation?: boolean; },
    goalData: { fitnessGoals: string; workoutsPerWeekTarget: number; preferences?: string; targetDate?: string; },
    markLatestGoalAsCompleted: boolean,
    noGoalAdviseOptOut: boolean,
    migratedWorkoutCount?: number
  ) => void;
  onTriggerAiGoalPrognosis: (goalDataOverride?: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate'| 'isCompleted' | 'completedDate'>) => void;
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
    return <span className="mr-2 text-xl" role="img" aria-label="Rubrik">📄</span>; // Default icon
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

export const ProfileGoalForm = forwardRef<ProfileGoalFormRef, ProfileGoalFormProps>(({
  currentProfile,
  currentGoalForForm,
  allParticipantGoals,
  participantGamificationStats,
  onSave,
  onTriggerAiGoalPrognosis,
}, ref) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<GenderOption>('-');
  const [migratedWorkoutCount, setMigratedWorkoutCount] = useState('');
  const [enableLeaderboard, setEnableLeaderboard] = useState(false);
  
  const [hasNoSpecificGoals, setHasNoSpecificGoals] = useState(false);
  const [selectedCommonGoals, setSelectedCommonGoals] = useState<string[]>([]);
  const [customFitnessGoalText, setCustomFitnessGoalText] = useState('');
  
  const [workoutsPerWeekTarget, setWorkoutsPerWeekTarget] = useState<number>(0);
  const [workoutsPerWeekTargetDisplay, setWorkoutsPerWeekTargetDisplay] = useState<string>('0');
  const [targetDate, setTargetDate] = useState<string>('');
  
  const [ageError, setAgeError] = useState<string>('');
  const [targetDateError, setTargetDateError] = useState<string>('');
  const [migratedWorkoutCountError, setMigratedWorkoutCountError] = useState('');
  const [preferences, setPreferences] = useState('');
  const [noGoalAdviseOptOut, setNoGoalAdviseOptOut] = useState(false);
  const [markGoalCompleted, setMarkGoalCompleted] = useState(false);

  useEffect(() => {
    setName(currentProfile?.name || '');
    setAge(currentProfile?.age?.toString() || '');
    setGender(currentProfile?.gender || '-');
    setEnableLeaderboard(currentProfile?.enableLeaderboardParticipation || false);
    setMigratedWorkoutCount(participantGamificationStats?.migratedWorkoutCount?.toString() || '');
    
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
    setMarkGoalCompleted(currentGoalForForm?.isCompleted || false);
    
    setAgeError('');
    setTargetDateError('');
    setMigratedWorkoutCountError('');
  }, [currentProfile, currentGoalForForm, participantGamificationStats]);


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


  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAge(value);
    if (value === '') {
        setAgeError('');
        return;
    }
    if (isNaN(Number(value)) || Number(value) < 0 || Number(value) > 120 || !Number.isInteger(Number(value))) {
      setAgeError('Ange en giltig ålder (heltal mellan 0-120).');
    } else {
      setAgeError('');
    }
  };

  const handleMigratedWorkoutCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setMigratedWorkoutCount(value);
    if (value === '') {
        setMigratedWorkoutCountError('');
        return;
    }
    if (isNaN(Number(value)) || Number(value) < 0 || !Number.isInteger(Number(value))) {
      setMigratedWorkoutCountError('Ange ett giltigt heltal (minst 0).');
    } else {
      setMigratedWorkoutCountError('');
    }
  };

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
        setTargetDateError(""); // Clear error if date is cleared
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
        finalTargetDate = undefined; // No target date if no actual goal text
      } else {
        finalNoGoalAdviseOptOut = false;
      }
    }
    
    return {
        fitnessGoals: finalFitnessGoalsString,
        workoutsPerWeekTarget: finalWorkoutsPerWeekTarget,
        targetDate: finalTargetDate,
        preferences: preferences.trim() || undefined,
        calculatedNoGoalAdviseOptOut: finalNoGoalAdviseOptOut
    };
  };

  const handleSubmit = () => {
    handleWorkoutsPerWeekDisplayBlur(); 

    if (ageError || targetDateError || migratedWorkoutCountError) {
        alert("Korrigera felen i formuläret innan du sparar.");
        return false;
    }
    
    const migratedCount = migratedWorkoutCount.trim() ? parseInt(migratedWorkoutCount, 10) : undefined;

    const profileData = { 
        name: name.trim(), 
        age: age.trim(), 
        gender, 
        enableLeaderboardParticipation: enableLeaderboard,
    };
    
    const { fitnessGoals: composedFitnessGoals, 
            workoutsPerWeekTarget: composedWPT, 
            targetDate: composedTargetDate,
            preferences: composedPrefs,
            calculatedNoGoalAdviseOptOut
          } = composeFinalGoalData();

    const goalDataToSave = {
        fitnessGoals: composedFitnessGoals,
        workoutsPerWeekTarget: composedWPT,
        targetDate: composedTargetDate,
        preferences: composedPrefs
    };
    
    onSave(profileData, goalDataToSave, markGoalCompleted, calculatedNoGoalAdviseOptOut, migratedCount);
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
      <p className="text-base text-gray-600">
        Vänligen fyll i din information så kan vi hjälpa dig på bästa sätt.
      </p>

      {/* Profilsektion */}
      <section className="space-y-4 pt-4 border-t">
        <h3 className="text-xl font-semibold text-gray-700">Om Mig (valfritt)</h3>
        <Input
          label="Namn"
          id="profileName"
          name="profileName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ditt namn"
        />
        <Input
          label="Ålder"
          id="profileAge"
          name="profileAge"
          type="number"
          value={age}
          onChange={handleAgeChange}
          placeholder="Din ålder i år"
          error={ageError}
        />
        <Select
          label="Kön"
          id="profileGender"
          name="profileGender"
          value={gender}
          onChange={(e) => setGender(e.target.value as GenderOption)}
          options={GENDER_OPTIONS}
        />
        <details className="pt-2">
          <summary className="text-base font-medium text-gray-600 cursor-pointer hover:text-gray-900 list-inside">
            Bytt från en annan app?
          </summary>
          <div className="pt-2 pl-2 border-l-2 border-gray-200 ml-1 mt-2">
              <Input
                  label="Antal tidigare genomförda pass"
                  id="migratedWorkoutCount"
                  name="migratedWorkoutCount"
                  type="number"
                  value={migratedWorkoutCount}
                  onChange={handleMigratedWorkoutCountChange}
                  placeholder="T.ex. 150"
                  error={migratedWorkoutCountError}
                  min="0"
                  step="1"
              />
              <p className="text-sm text-gray-500 mt-1">Ange det totala antalet pass du loggat i ett tidigare system. Detta kommer att läggas till din totala räkning i denna app.</p>
          </div>
        </details>
      </section>
      
       {/* Leaderboard Opt-in */}
      <section className="space-y-4 pt-4 border-t">
          <h3 className="text-xl font-semibold text-gray-700">Inställningar</h3>
          <label className="flex items-start space-x-3 p-3 bg-gray-100 rounded-md cursor-pointer">
            <input
              type="checkbox"
              id="enableLeaderboard"
              checked={enableLeaderboard}
              onChange={(e) => setEnableLeaderboard(e.target.checked)}
              className="h-6 w-6 mt-1 text-flexibel border-gray-300 rounded focus:ring-flexibel"
            />
            <div>
                <span className="text-lg font-medium text-gray-700">
                    Delta i Topplistor & Utmaningar
                </span>
                <p className="text-sm text-gray-500">
                    Genom att kryssa i denna ruta godkänner du att ditt namn och dina resultat (t.ex. antal pass, personliga rekord) visas på interna topplistor som är synliga för andra medlemmar och coacher.
                </p>
            </div>
          </label>
      </section>

      {/* Målsättningshistorik (visas om det finns tidigare mål) */}
      {allParticipantGoals && allParticipantGoals.length > 0 && (
        <section className="space-y-2 pt-4 border-t">
            <h3 className="text-xl font-semibold text-gray-700">Målhistorik:</h3>
            <div className="max-h-32 overflow-y-auto space-y-2 bg-gray-100 p-3 rounded-md">
            {allParticipantGoals.slice().sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime()).map(goal => (
                <div key={goal.id} className={`text-sm text-gray-600 border-b pb-1 mb-1 ${goal.isCompleted ? 'bg-green-50 p-1.5 rounded' : ''}`}>
                    {goal.isCompleted && goal.completedDate && (
                      <p className="font-semibold text-green-700">🏆 Mål Slutfört ({new Date(goal.completedDate).toLocaleDateString('sv-SE')})</p>
                    )}
                    <p><span className="font-semibold">Mål:</span> {goal.fitnessGoals || "Inget specifikt mål angivet"}</p>
                    {goal.targetDate && <p><span className="font-semibold">Måldatum:</span> {new Date(goal.targetDate).toLocaleDateString('sv-SE')}</p>}
                    <p><span className="font-semibold">Veckotarget:</span> {goal.workoutsPerWeekTarget} pass</p>
                    <p><span className="font-semibold">Preferenser:</span> {goal.preferences || "Inga angivna"}</p>
                    <p><span className="font-semibold">Satt den:</span> {new Date(goal.setDate).toLocaleString('sv-SE')}</p>
                </div>
            ))}
            </div>
        </section>
      )}

      {/* Målsättningssektion */}
      <section className="space-y-4 pt-4 border-t">
        <h3 className="text-xl font-semibold text-gray-700">Aktuella Mål</h3>
        
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
                <Textarea
                    id="customFitnessGoalText"
                    name="customFitnessGoalText"
                    value={customFitnessGoalText}
                    onChange={(e) => setCustomFitnessGoalText(e.target.value)}
                    placeholder="Var specifik! T.ex. 'Öka Marklyft 1RM till 100kg', 'Springa 5km under 25 min', 'Gå ner 3kg fettmassa'."
                    rows={3}
                    disabled={hasNoSpecificGoals}
                />
                <p className="mt-1 text-sm text-gray-500">
                    Tips: Försök formulera dina mål SMART (Specifikt, Mätbart, Accepterat, Realistiskt, Tidsbundet).
                </p>
            </div>
          </>
        )}
        
         {currentGoalForForm && isLatestGoalAlreadyCompleted && (
             <div className="mt-2 p-3 bg-green-100 rounded-md border border-green-300 text-lg text-green-700">
                🏆 Mål "{currentGoalForForm.fitnessGoals}" uppnått den {new Date(currentGoalForForm.completedDate!).toLocaleDateString('sv-SE')}! Sätt gärna ett nytt.
            </div>
         )}


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
          disabled={hasNoSpecificGoals || isLatestGoalAlreadyCompleted}
        />
        <p className="text-sm text-gray-500">Antal pass/vecka (0-21) för detta mål. Påverkar streak.</p>
        
        <Input
            label="Måldatum (valfritt)"
            id="targetDate"
            name="targetDate"
            type="date"
            value={targetDate}
            onChange={handleTargetDateChange}
            min={new Date().toISOString().split('T')[0]} // Min today
            disabled={hasNoSpecificGoals || isLatestGoalAlreadyCompleted || !goalHasText}
            error={targetDateError}
        />
        {!goalHasText && !hasNoSpecificGoals && <p className="text-sm text-gray-500">Ange ett mål för att kunna sätta ett måldatum.</p>}
        
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
      </section>

      {currentGoalForForm?.aiPrognosis && (
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

ProfileGoalForm.displayName = "ProfileGoalForm";