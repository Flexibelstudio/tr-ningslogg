

import React, { useState, useEffect } from 'react';
import { Input, Select } from '../Input';
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { ParticipantGoalData, ParticipantProfile, GenderOption } from '../../types';
import { GENDER_OPTIONS } from '../../constants';

interface ProfileGoalFormProps {
  currentProfile: ParticipantProfile | null;
  currentGoalForForm: ParticipantGoalData | null;
  allParticipantGoals: ParticipantGoalData[];
  onSave: (
    profileData: { name?: string; age?: string; gender?: GenderOption; muscleMassKg?: number; fatMassKg?: number; inbodyScore?: number },
    goalData: { fitnessGoals: string; workoutsPerWeekTarget: number; preferences?: string; }, // Added preferences here
    preferencesLegacy: string, // This was the old preferences, now part of goalData
    noGoalAdviseOptOut: boolean
  ) => void;
  onCancel: () => void; 
}

export const ProfileGoalForm: React.FC<ProfileGoalFormProps> = ({
  currentProfile,
  currentGoalForForm,
  allParticipantGoals,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<GenderOption>('Vill ej ange');
  const [muscleMass, setMuscleMass] = useState('');
  const [fatMass, setFatMass] = useState('');
  const [inbodyScore, setInbodyScore] = useState(''); // New state for InBody score
  
  const [fitnessGoals, setFitnessGoals] = useState('');
  const [workoutsPerWeekTarget, setWorkoutsPerWeekTarget] = useState<number>(0);
  const [workoutsPerWeekTargetDisplay, setWorkoutsPerWeekTargetDisplay] = useState<string>('0');
  
  const [ageError, setAgeError] = useState<string>('');
  const [muscleMassError, setMuscleMassError] = useState('');
  const [fatMassError, setFatMassError] = useState('');
  const [inbodyScoreError, setInbodyScoreError] = useState(''); // New error state
  const [preferences, setPreferences] = useState('');
  const [noGoalAdviseOptOut, setNoGoalAdviseOptOut] = useState(false);

  useEffect(() => {
    setName(currentProfile?.name || '');
    setAge(currentProfile?.age?.toString() || '');
    setGender(currentProfile?.gender || 'Vill ej ange');
    setMuscleMass(currentProfile?.muscleMassKg?.toString() || '');
    setFatMass(currentProfile?.fatMassKg?.toString() || '');
    setInbodyScore(currentProfile?.inbodyScore?.toString() || ''); 
    
    const initialWPT = currentGoalForForm?.workoutsPerWeekTarget ?? 0;
    setFitnessGoals(currentGoalForForm?.fitnessGoals || '');
    setWorkoutsPerWeekTarget(initialWPT);
    setWorkoutsPerWeekTargetDisplay(initialWPT.toString());
    setPreferences(currentGoalForForm?.preferences || ''); // Load preferences
    
    setAgeError('');
    setMuscleMassError('');
    setFatMassError('');
    setInbodyScoreError(''); 
  }, [currentProfile, currentGoalForForm]);

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


  const handleSaveClick = () => {
    handleWorkoutsPerWeekDisplayBlur(); 

    if (ageError || muscleMassError || fatMassError || inbodyScoreError) {
        alert("Korrigera felen i formuläret innan du sparar.");
        return;
    }
    
    const finalWPT = workoutsPerWeekTarget;

    const muscleMassNum = muscleMass.trim() ? parseFloat(muscleMass) : undefined;
    const fatMassNum = fatMass.trim() ? parseFloat(fatMass) : undefined;
    const inbodyScoreNum = inbodyScore.trim() ? parseInt(inbodyScore, 10) : undefined;

    const profileData = { 
        name: name.trim(), 
        age: age.trim(), 
        gender, 
        muscleMassKg: muscleMassNum, 
        fatMassKg: fatMassNum,
        inbodyScore: inbodyScoreNum,
    };
    const goalData = { 
        fitnessGoals: fitnessGoals.trim(), 
        workoutsPerWeekTarget: finalWPT,
        preferences: preferences.trim() || undefined, // Add preferences to goalData
    };
    // Pass preferencesLegacy as the original preferences string, though it's now part of goalData
    onSave(profileData, goalData, preferences.trim(), noGoalAdviseOptOut); 
  };

  const isFormValidToSave = () => {
    if (ageError || muscleMassError || fatMassError || inbodyScoreError) return false;
    
    if (workoutsPerWeekTargetDisplay === "") return true; 
    const numDisplay = parseInt(workoutsPerWeekTargetDisplay, 10);
    if (isNaN(numDisplay)) return false; 
    return true;
  };

  return (
    <div className="space-y-6 py-4">
      <p className="text-sm text-gray-600">
        Vänligen fyll i din information så kan vi hjälpa dig på bästa sätt.
      </p>

      {/* Profilsektion */}
      <section className="space-y-4 pt-4 border-t">
        <h3 className="text-lg font-semibold text-gray-700">Om Mig (valfritt)</h3>
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
      </section>

      {/* Målsättningshistorik (visas om det finns tidigare mål) */}
      {allParticipantGoals && allParticipantGoals.length > 0 && (
        <section className="space-y-2 pt-4 border-t">
            <h3 className="text-lg font-semibold text-gray-700">Målhistorik:</h3>
            <div className="max-h-32 overflow-y-auto space-y-2 bg-gray-100 p-3 rounded-md">
            {allParticipantGoals.slice().sort((a,b) => new Date(b.setDate).getTime() - new Date(a.setDate).getTime()).map(goal => (
                <div key={goal.id} className="text-xs text-gray-600 border-b pb-1">
                    <p><span className="font-semibold">Mål:</span> {goal.fitnessGoals || "Inget specifikt mål angivet"}</p>
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
        <h3 className="text-lg font-semibold text-gray-700">Aktuella Mål</h3>
        <Textarea
          label="Ditt fitnessmål"
          id="fitnessGoals"
          name="fitnessGoals"
          value={fitnessGoals}
          onChange={(e) => setFitnessGoals(e.target.value)}
          placeholder="T.ex. Bli starkare i marklyft, springa 5 km utan att stanna, minska stress..."
          rows={3}
        />
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
        />
        <p className="text-xs text-gray-500">Antal pass/vecka (0-21) för detta mål. Påverkar streak.</p>
        
        <Textarea
          label="Övrigt för AI (valfritt)"
          name="preferences"
          id="userPreferences"
          value={preferences}
          onChange={(e) => setPreferences(e.target.value)}
          placeholder="T.ex. föredrar morgonpass, har känsligt knä, vill träna ensam, stora utmaningar med motivation..."
          rows={3}
        />
         {!fitnessGoals && (
          <div className="flex items-center space-x-2 bg-yellow-50 p-3 rounded-md border border-yellow-200">
            <input
              type="checkbox"
              id="noGoalAdviseOptOut"
              checked={noGoalAdviseOptOut}
              onChange={(e) => setNoGoalAdviseOptOut(e.target.checked)}
              className="h-4 w-4 text-flexibel border-gray-300 rounded focus:ring-flexibel"
            />
            <label htmlFor="noGoalAdviseOptOut" className="text-xs text-yellow-700">
              Passförslag utan påminnelse om mål nu.
            </label>
          </div>
        )}
      </section>

      <div className="flex justify-end space-x-3 pt-6 border-t">
        <Button onClick={onCancel} variant="secondary">Avbryt</Button>
        <Button onClick={handleSaveClick} variant="primary" disabled={!isFormValidToSave()}>
          Spara Profil & Mål
        </Button>
      </div>
    </div>
  );
};