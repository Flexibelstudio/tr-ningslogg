

import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import { Input } from '../Input';
import { ParticipantConditioningStat, ParticipantProfile, ParticipantClubMembership, ConditioningMetric } from '../../types';
import { CLUB_DEFINITIONS } from '../../constants';

const ClubProgressDisplay: React.FC<{
    metric: ConditioningMetric;
    clubs: typeof CLUB_DEFINITIONS;
    memberships: ParticipantClubMembership[];
    participantId?: string;
}> = ({ metric, clubs, memberships, participantId }) => {
    const relevantClubs = useMemo(() => {
        return clubs
            .filter(club => club.conditioningMetric === metric)
            .sort((a, b) => {
                const valA = a.threshold || 0;
                const valB = b.threshold || 0;
                // For LESS_OR_EQUAL (time), sort descending (higher number is worse)
                // For GREATER_OR_EQUAL, sort ascending
                return a.comparison === 'LESS_OR_EQUAL' ? valB - valA : valA - valB;
            });
    }, [metric, clubs]);

    if (relevantClubs.length === 0 || !participantId) return null;

    return (
        <div className="mt-2 space-y-1">
            <h5 className="text-xs font-bold uppercase text-gray-400">Relevanta Klubbar</h5>
            <div className="flex flex-wrap gap-2">
                {relevantClubs.map(club => {
                    const isAchieved = memberships.some(m => m.clubId === club.id && m.participantId === participantId);
                    let targetValueStr = '';
                    if (club.threshold) {
                        if (club.comparison === 'LESS_OR_EQUAL') {
                            const minutes = Math.floor(club.threshold / 60);
                            const seconds = club.threshold % 60;
                            targetValueStr = `Sub ${minutes}:${seconds.toString().padStart(2, '0')}`;
                        } else {
                            targetValueStr = `${club.threshold} ${metric === 'airbike4MinKcal' ? 'kcal' : 'm'}`;
                        }
                    }

                    return (
                        <div key={club.id} title={club.description} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${isAchieved ? 'bg-green-100 border-green-300 text-green-800' : 'bg-gray-100 border-gray-300 text-gray-600'}`}>
                            {isAchieved && <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                            <span className="font-semibold">{targetValueStr || club.name}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


interface ConditioningStatsFormProps {
  statsHistory: ParticipantConditioningStat[];
  onSaveStats: (statsData: Omit<ParticipantConditioningStat, 'id' | 'participantId'>) => void;
  participantProfile: ParticipantProfile | null;
  clubMemberships: ParticipantClubMembership[];
}

export interface ConditioningStatsFormRef {
  submitForm: () => boolean;
}

export const ConditioningStatsForm = forwardRef<ConditioningStatsFormRef, ConditioningStatsFormProps>(({
  statsHistory,
  onSaveStats,
  participantProfile,
  clubMemberships,
}, ref) => {
  const [airbike4MinKcal, setAirbike4MinKcal] = useState('');
  const [skierg4MinMeters, setSkierg4MinMeters] = useState('');
  const [rower4MinMeters, setRower4MinMeters] = useState('');
  const [treadmill4MinMeters, setTreadmill4MinMeters] = useState('');
  const [rower2000mMinutes, setRower2000mMinutes] = useState('');
  const [rower2000mSeconds, setRower2000mSeconds] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    setAirbike4MinKcal('');
    setSkierg4MinMeters('');
    setRower4MinMeters('');
    setTreadmill4MinMeters('');
    setRower2000mMinutes('');
    setRower2000mSeconds('');
    setErrors({});
  }, [statsHistory]);

  const findPreviousValue = useCallback((key: ConditioningMetric) => {
    for (let i = statsHistory.length - 1; i >= 0; i--) {
        const stat = statsHistory[i][key];
        if (stat !== undefined && stat !== null) {
            return { value: stat, date: statsHistory[i].lastUpdated };
        }
    }
    return null;
  }, [statsHistory]);

  const validateNumericInput = useCallback((value: string, fieldName: string, isInteger: boolean = true): boolean => {
    if (value.trim() === '') {
       setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
      return true;
    }
    const num = Number(value);
    if (isNaN(num) || num < 0 || (isInteger && !Number.isInteger(num))) {
      setErrors(prev => ({ ...prev, [fieldName]: `Ogiltigt värde. Ange ett positivt ${isInteger ? 'heltal' : 'tal'}.` }));
      return false;
    }
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
    return true;
  }, []);


  const handleSave = useCallback(() => {
    let validForm = true;
    if (!validateNumericInput(airbike4MinKcal, 'airbike4MinKcal')) validForm = false;
    if (!validateNumericInput(skierg4MinMeters, 'skierg4MinMeters')) validForm = false;
    if (!validateNumericInput(rower4MinMeters, 'rower4MinMeters')) validForm = false;
    if (!validateNumericInput(treadmill4MinMeters, 'treadmill4MinMeters')) validForm = false;
    if (!validateNumericInput(rower2000mMinutes, 'rower2000mMinutes')) validForm = false;
    if (!validateNumericInput(rower2000mSeconds, 'rower2000mSeconds')) validForm = false;
    
    if (!validForm) {
        alert("Var god korrigera felen i formuläret för konditionstester.");
        return false;
    }
    
    const entryData = {
        airbike4MinKcal: airbike4MinKcal.trim() ? Number(airbike4MinKcal) : undefined,
        skierg4MinMeters: skierg4MinMeters.trim() ? Number(skierg4MinMeters) : undefined,
        rower4MinMeters: rower4MinMeters.trim() ? Number(rower4MinMeters) : undefined,
        treadmill4MinMeters: treadmill4MinMeters.trim() ? Number(treadmill4MinMeters) : undefined,
        rower2000mTimeSeconds: (rower2000mMinutes.trim() || rower2000mSeconds.trim())
            ? (Number(rower2000mMinutes || 0) * 60) + Number(rower2000mSeconds || 0)
            : undefined,
        lastUpdated: new Date().toISOString(),
    };

    if (Object.values(entryData).every(v => v === undefined)) {
        alert("Du måste fylla i minst ett testresultat.");
        return false;
    }

    onSaveStats(entryData);
    return true;
  }, [airbike4MinKcal, skierg4MinMeters, rower4MinMeters, treadmill4MinMeters, rower2000mMinutes, rower2000mSeconds, validateNumericInput, onSaveStats]);

  useImperativeHandle(ref, () => ({
    submitForm: handleSave
  }));

  const renderInputWithHistory = (
    label: string,
    metric: ConditioningMetric,
    value: string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
    isInteger: boolean,
    placeholder: string,
    error?: string
  ) => {
    const previousValue = findPreviousValue(metric);
    return (
      <div className="space-y-1">
        <Input
          label={label}
          name={metric}
          type="number"
          step={isInteger ? "1" : "any"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          error={error}
          min="0"
          inputSize="sm"
        />
        {previousValue && (
          <p className="text-xs text-gray-500 px-1">
            Föregående: {previousValue.value} (
            {new Date(previousValue.date).toLocaleDateString('sv-SE')})
          </p>
        )}
        <ClubProgressDisplay metric={metric} clubs={CLUB_DEFINITIONS} memberships={clubMemberships} participantId={participantProfile?.id} />
      </div>
    );
  };
  
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Fyll i dina senaste resultat från konditionstesterna. Du behöver bara fylla i de tester du har genomfört.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
        {renderInputWithHistory(
            "Airbike 4 min (kcal)",
            'airbike4MinKcal',
            airbike4MinKcal,
            (e) => { setAirbike4MinKcal(e.target.value); validateNumericInput(e.target.value, 'airbike4MinKcal'); },
            true, "Antal kalorier", errors.airbike4MinKcal
        )}
        {renderInputWithHistory(
            "SkiErg 4 min (meter)",
            'skierg4MinMeters',
            skierg4MinMeters,
            (e) => { setSkierg4MinMeters(e.target.value); validateNumericInput(e.target.value, 'skierg4MinMeters'); },
            true, "Antal meter", errors.skierg4MinMeters
        )}
        {renderInputWithHistory(
            "Roddmaskin 4 min (meter)",
            'rower4MinMeters',
            rower4MinMeters,
            (e) => { setRower4MinMeters(e.target.value); validateNumericInput(e.target.value, 'rower4MinMeters'); },
            true, "Antal meter", errors.rower4MinMeters
        )}
        {renderInputWithHistory(
            "Löpband 4 min (meter)",
            'treadmill4MinMeters',
            treadmill4MinMeters,
            (e) => { setTreadmill4MinMeters(e.target.value); validateNumericInput(e.target.value, 'treadmill4MinMeters'); },
            true, "Antal meter", errors.treadmill4MinMeters
        )}
        
        {/* Special case for 2000m row */}
        <div className="space-y-2 md:col-span-2">
            <label className="block text-base font-medium text-gray-700">Rodd 2000m (tid)</label>
            <div className="flex items-start gap-2">
                <Input
                    label="Minuter"
                    name="rower2000mMinutes"
                    type="number"
                    step="1"
                    min="0"
                    value={rower2000mMinutes}
                    onChange={(e) => { setRower2000mMinutes(e.target.value); validateNumericInput(e.target.value, 'rower2000mMinutes'); }}
                    placeholder="T.ex. 7"
                    error={errors.rower2000mMinutes}
                    inputSize="sm"
                    containerClassName="flex-1"
                />
                <Input
                    label="Sekunder"
                    name="rower2000mSeconds"
                    type="number"
                    step="1"
                    min="0"
                    max="59"
                    value={rower2000mSeconds}
                    onChange={(e) => { setRower2000mSeconds(e.target.value); validateNumericInput(e.target.value, 'rower2000mSeconds'); }}
                    placeholder="T.ex. 30"
                    error={errors.rower2000mSeconds}
                    inputSize="sm"
                    containerClassName="flex-1"
                />
            </div>
            {findPreviousValue('rower2000mTimeSeconds') && (
                <p className="text-xs text-gray-500 px-1">
                    Föregående: {Math.floor((findPreviousValue('rower2000mTimeSeconds')?.value || 0) / 60)} min { (findPreviousValue('rower2000mTimeSeconds')?.value || 0) % 60 } sek (
                    {new Date(findPreviousValue('rower2000mTimeSeconds')?.date as string).toLocaleDateString('sv-SE')})
                </p>
            )}
             <ClubProgressDisplay metric="rower2000mTimeSeconds" clubs={CLUB_DEFINITIONS} memberships={clubMemberships} participantId={participantProfile?.id} />
        </div>
      </div>
    </div>
  );
});

ConditioningStatsForm.displayName = 'ConditioningStatsForm';