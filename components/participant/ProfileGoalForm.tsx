


import React, { useState, useEffect } from 'react';
import { Input, Select } from '../Input';
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { ParticipantGoalData, ParticipantProfile, GenderOption, ParticipantGamificationStats } from '../../types';
import { GENDER_OPTIONS, COMMON_FITNESS_GOALS_OPTIONS } from '../../constants';
import * as dateUtils from '../../utils/dateUtils';

interface ProfileGoalFormProps {
  currentProfile: ParticipantProfile | null;
  currentGoalForForm: ParticipantGoalData | null;
  allParticipantGoals: ParticipantGoalData[];
  participantGamificationStats: ParticipantGamificationStats | null;
  onSave: (
    profileData: { name?: string; age?: string; gender?: GenderOption; muscleMassKg?: number; fatMassKg?: number; inbodyScore?: number },
    goalData: { fitnessGoals: string; workoutsPerWeekTarget: number; preferences?: string; targetDate?: string; },
    markLatestGoalAsCompleted: boolean,
    noGoalAdviseOptOut: boolean,
    migratedWorkoutCount?: number
  ) => void;
  onCancel: () => void; 
  onTriggerAiGoalPrognosis: (goalDataOverride: Omit<ParticipantGoalData, 'id' | 'participantId' | 'currentWeeklyStreak' | 'lastStreakUpdateEpochWeekId' | 'setDate' | 'isCompleted' | 'completedDate'>) => void;
}

export const ProfileGoalForm: React.FC<ProfileGoalFormProps> = ({
  currentProfile,
  currentGoalForForm,
  allParticipantGoals,
  participantGamificationStats,
  onSave,
  onCancel,
  onTriggerAiGoalPrognosis,
}) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<GenderOption>('Vill ej ange');
  const [muscleMass, setMuscleMass] = useState('');
  const [fatMass, setFatMass] = useState('');
  const [inbodyScore, setInbodyScore] = useState('');
  const [migratedWorkoutCount, setMigratedWorkoutCount] = useState('');
  
  const [hasNoSpecificGoals, setHasNoSpecificGoals] = useState(false);
  const [selectedCommonGoals, setSelectedCommonGoals] = useState<string[]>([]);
  const [customFitnessGoalText, setCustomFitnessGoalText] = useState('');
  
  const [workoutsPerWeekTarget, setWorkoutsPerWeekTarget] = useState<number>(0);
  const [workoutsPerWeekTargetDisplay, setWorkoutsPerWeekTargetDisplay] = useState<string>('0');
  const [targetDate, setTargetDate] = useState<string>('');
  
  const [ageError, setAgeError] = useState<string>('');
  const [muscleMassError, setMuscleMassError] = useState('');
  const [fatMassError, setFatMassError] = useState('');
  const [inbodyScoreError, setInbodyScoreError] = useState('');
  const [targetDateError, setTargetDateError] = useState<string>('');
  const [migratedWorkoutCountError, setMigratedWorkoutCountError] = useState('');
  const [preferences, setPreferences] = useState('');
  const [noGoalAdviseOptOut, setNoGoalAdviseOptOut] = useState(false);
  const [markGoalCompleted, setMarkGoalCompleted] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    setName(currentProfile?.name || '');
    setAge(currentProfile?.age?.toString() || '');
    setGender(currentProfile?.gender || 'Vill ej ange');
    setMuscleMass(currentProfile?.muscleMassKg?.toString() || '');
    setFatMass(currentProfile?.fatMassKg?.toString() || '');
    setInbodyScore(currentProfile?.inbodyScore?.toString() || ''); 
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
    setMuscleMassError('');
    setFatMassError('');
    setInbodyScoreError(''); 
    setTargetDateError('');
    setMigratedWorkoutCountError('');
    setIsSaving(false);
    setHasSaved(false);
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

  const validateWeightField = (value: string, setter: React.Dispatch<React.SetStateAction<string>>, errorSetter: React.Dispatch<React.SetStateAction<string>>) => {
    setter(value);
    if (value === '') {
        errorSetter('');
        return;
    }
    const num = Number(value);
    if (isNaN(num) || num < 0) {
        errorSetter('Ange ett giltigt positivt tal (kg).');
    } else if ((num * 10) % 5 !== 0) { // Allows X.0 and X.5
        errorSetter('Vikt måste anges i hela eller halva kilon (t.ex. 35 eller 35.5).');
    } else {
        errorSetter('');
    }
  };

  const handleMuscleMassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateWeightField(e.target.value, setMuscleMass, setMuscleMassError);
  };

  const handleFatMassChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateWeightField(e.target.value, setFatMass, setFatMassError);
  };

  const handleInbodyScoreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInbodyScore(value);
    if (value === '') {
        setInbodyScoreError('');
        return;
    }
    const num = Number(value);
    if (isNaN(num) || num < 0 || num > 100 || !Number.isInteger(Number(num))) { // InBody score typically 0-100, integer
      setInbodyScoreError('Ange en giltig InBody-poäng (heltal 0-100).');
    } else {
      setInbodyScoreError('');
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

  const handlePrognosisClick = () => {
    const { 
        fitnessGoals: composedFitnessGoals, 
        workoutsPerWeekTarget: composedWPT, 
        targetDate: composedTargetDate,
        preferences: composedPrefs,
    } = composeFinalGoalData();

    const goalDataForPrognosis = {
        fitnessGoals: composedFitnessGoals,
        workoutsPerWeekTarget: composedWPT,
        targetDate: composedTargetDate,
        preferences: composedPrefs,
    };

    onTriggerAiGoalPrognosis(goalDataForPrognosis);
  };

  const handleSaveClick = () => {
    setIsSaving(true);
    setHasSaved(false);
    handleWorkoutsPerWeekDisplayBlur(); 

    if (ageError || muscleMassError || fatMassError || inbodyScoreError || targetDateError || migratedWorkoutCountError) {
        alert("Korrigera felen i formuläret innan du sparar.");
        setIsSaving(false);
        return;
    }
    
    const muscleMassNum = muscleMass.trim() ? parseFloat(muscleMass) : undefined;
    const fatMassNum = fatMass.trim() ? parseFloat(fatMass) : undefined;
    const inbodyScoreNum = inbodyScore.trim() ? parseInt(inbodyScore, 10) : undefined;
    const migratedCount = migratedWorkoutCount.trim() ? parseInt(migratedWorkoutCount, 10) : undefined;

    const profileData = { 
        name: name.trim(), 
        age: age.trim(), 
        gender, 
        muscleMassKg: muscleMassNum, 
        fatMassKg: fatMassNum,
        inbodyScore: inbodyScoreNum,
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
    
    setHasSaved(true);
    setTimeout(() => {
      onSave(profileData, goalDataToSave, markGoalCompleted, calculatedNoGoalAdviseOptOut, migratedCount);
      // isSaving and hasSaved will be reset when the parent modal closes and this form might re-initialize
      // or when this component useEffect runs if it's kept open and props change.
      // For this specific case where parent (ProfileGoalModal) handles closing,
      // this timeout primarily ensures the "Sparat! ✓" text is visible.
    }, 1500);
  };

  const isFormValidToSave = () => {
    if (ageError || muscleMassError || fatMassError || inbodyScoreError || targetDateError || migratedWorkoutCountError) return false;
    
    if (workoutsPerWeekTargetDisplay === "") return true; 
    const numDisplay = parseInt(workoutsPerWeekTargetDisplay, 10);
    if (isNaN(numDisplay)) return false; 
    return true;
  };

  const isLatestGoalAlreadyCompleted = currentGoalForForm?.isCompleted || false;
  const showNoGoalAdviceOptOutCheckbox = !hasNoSpecificGoals && composeFinalGoalData().fitnessGoals === '';
  const goalHasText = composeFinalGoalData().fitnessGoals !== '' && composeFinalGoalData().fitnessGoals !== 'Inga specifika mål satta';

  let saveButtonText = "Spara Profil & Mål";
  if (isSaving && !hasSaved) saveButtonText = "Sparar...";
  if (hasSaved) saveButtonText = "Sparat! ✓";

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
         <Input
          label="Muskelmassa (kg, InBody)"
          id="profileMuscleMass"
          name="profileMuscleMass"
          type="number"
          step="0.1"
          value={muscleMass}
          onChange={handleMuscleMassChange}
          placeholder="T.ex. 35.5"
          error={muscleMassError}
        />
        <Input
          label="Fettmassa (kg, InBody)"
          id="profileFatMass"
          name="profileFatMass"
          type="number"
          step="0.1"
          value={fatMass}
          onChange={handleFatMassChange}
          placeholder="T.ex. 12.0"
          error={fatMassError}
        />
        <Input
          label="InBody Score (valfri)"
          id="profileInbodyScore"
          name="profileInbodyScore"
          type="number"
          value={inbodyScore}
          onChange={handleInbodyScoreChange}
          placeholder="T.ex. 82"
          error={inbodyScoreError}
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
        
        {currentGoalForForm && !isLatestGoalAlreadyCompleted && (
            <label className="flex items-center space-x-3 mt-2 p-3 bg-yellow-50 rounded-md border border-yellow-200 cursor-pointer">
                <input
                    type="checkbox"
                    id="markGoalCompleted"
                    checked={markGoalCompleted}
                    onChange={(e) => setMarkGoalCompleted(e.target.checked)}
                    className="h-6 w-6 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                    disabled={hasNoSpecificGoals || isLatestGoalAlreadyCompleted}
                />
                <span className="text-lg text-yellow-700">
                    Jag har uppnått detta mål: "{currentGoalForForm.fitnessGoals}"
                </span>
            </label>
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
        
        <div className="mt-4 bg-violet-50 p-3 rounded-lg border border-violet-200">
            <Button
                onClick={handlePrognosisClick}
                variant="outline"
                size="sm"
                fullWidth
                className="!text-sm bg-white"
                title={!goalHasText ? "Ange ett mål för att få en prognos" : "Få en AI-driven uppskattning på hur lång tid ditt mål kan ta"}
                disabled={!goalHasText}
            >
                🔮 Hur lång tid tar det att nå målet? (AI Prognos)
            </Button>
        </div>
        
        {showNoGoalAdviceOptOutCheckbox && (
          <label className="flex items-center space-x-3 bg-yellow-50 p-3 rounded-md border border-yellow-200 cursor-pointer">
            <input
              type="checkbox"
              id="noGoalAdviseOptOut"
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

      <div className="flex justify-end space-x-3 pt-6 border-t">
        <Button onClick={onCancel} variant="secondary" disabled={isSaving}>Avbryt</Button>
        <Button onClick={handleSaveClick} variant="primary" disabled={!isFormValidToSave() || isSaving}>
          {saveButtonText}
        </Button>
      </div>
    </div>
  );
};