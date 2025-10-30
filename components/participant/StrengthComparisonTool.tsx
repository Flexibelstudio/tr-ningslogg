import React, { useState, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { ParticipantProfile, UserStrengthStat, StrengthStandard, LiftType, StrengthLevel, StrengthStandardDetail, GenderOption, ParticipantGoalData, ClubDefinition, ParticipantClubMembership } from '../../types';
import { STRENGTH_LEVEL_ORDER, FSS_CONFIG, FLEXIBEL_PRIMARY_COLOR, MAIN_LIFTS_CONFIG_HEADER, LEVEL_COLORS_HEADER, CLUB_DEFINITIONS } from '../../constants';
import { Input } from '../Input';
import { Button } from '../Button';
import { calculateEstimated1RM } from '../../utils/workoutUtils';
import html2canvas from 'html2canvas';
import { useAppContext } from '../../context/AppContext';

export interface LiftScoreDetails {
  lift: LiftType;
  oneRepMax: number | null;
  score: number; // This will now hold the points (interpolated)
  level: StrengthLevel; // The new type
}

export interface FssScoreOutput {
  totalScore: number;
  liftScores: LiftScoreDetails[];
}

const FSS_LIFT_MAPPING = {
  'Knäböj': 'squat',
  'Bänkpress': 'bench_press',
  'Marklyft': 'deadlift',
  'Axelpress': 'overhead_press',
} as const;

const FSS_STAT_KEY_MAPPING = {
  'Knäböj': 'squat1RMaxKg',
  'Bänkpress': 'benchPress1RMaxKg',
  'Marklyft': 'deadlift1RMaxKg',
  'Axelpress': 'overheadPress1RMaxKg',
} as const;

export const calculateFlexibelStrengthScoreInternal = (userStats: UserStrengthStat, userProfile: ParticipantProfile): FssScoreOutput | null => {
  const getLevelFromScore = (score: number): StrengthLevel => {
    // Find the last level where the score is greater than or equal to the minimum.
    // This correctly handles fractional scores between integer levels (e.g., 89.9).
    let foundLevel: StrengthLevel = FSS_CONFIG.fssLevels[0].label; // Default to the first level
    for (const level of FSS_CONFIG.fssLevels) {
      if (score >= level.min) {
        foundLevel = level.label;
      } else {
        // Since the levels are sorted by 'min', we can stop searching.
        break;
      }
    }
    return foundLevel;
  };

  const gender = userProfile.gender;
  const age = userProfile.age ? parseInt(userProfile.age, 10) : null;
  const bodyweight = userStats.bodyweightKg;

  if (!gender || (gender !== 'Man' && gender !== 'Kvinna') || !age || !bodyweight) {
    return null;
  }

  // BODYWEIGHT ADJUSTMENT
  let bodyweightMultiplier = 1.0;
  if (FSS_CONFIG.bodyweightAdjustment.apply) {
    const multiplierConfig = FSS_CONFIG.bodyweightAdjustment.multipliers.find((m) => bodyweight <= m.maxWeight);
    if (multiplierConfig) {
      bodyweightMultiplier = multiplierConfig.multiplier;
    } else if (FSS_CONFIG.bodyweightAdjustment.multipliers.length > 0) {
      bodyweightMultiplier = FSS_CONFIG.bodyweightAdjustment.multipliers[FSS_CONFIG.bodyweightAdjustment.multipliers.length - 1].multiplier;
    }
  }

  // AGE ADJUSTMENT
  let ageMultiplier = 1.0;
  if (FSS_CONFIG.ageAdjustment.apply) {
    const modifierConfig = FSS_CONFIG.ageAdjustment.modifiers.find((m) => age >= m.minAge && age <= m.maxAge);
    if (modifierConfig) {
      ageMultiplier = modifierConfig.multiplier;
    }
  }

  const genderKey = gender === 'Man' ? 'male' : 'female';
  const liftScores: LiftScoreDetails[] = [];

  const liftsToCalculateFor: LiftType[] = ['Knäböj', 'Bänkpress', 'Marklyft', 'Axelpress'];

  for (const liftName of liftsToCalculateFor) {
    const statKey = FSS_STAT_KEY_MAPPING[liftName];
    const actual1RM = userStats[statKey];

    if (actual1RM === undefined || actual1RM === null || actual1RM <= 0) {
      continue;
    }

    const adjusted1RM = actual1RM * bodyweightMultiplier;

    const liftConfigKey = FSS_LIFT_MAPPING[liftName];
    const config = FSS_CONFIG.scoreConversionPerLift[genderKey][liftConfigKey];
    const { weights, points } = config;

    let baseScore = 0;
    if (adjusted1RM >= weights[weights.length - 1]) {
      baseScore = points[points.length - 1];
    } else if (adjusted1RM <= weights[0]) {
      baseScore = points[0];
    } else {
      for (let i = 0; i < weights.length - 1; i++) {
        if (adjusted1RM >= weights[i] && adjusted1RM < weights[i + 1]) {
          const weightRange = weights[i + 1] - weights[i];
          const pointRange = points[i + 1] - points[i];
          const weightProgress = adjusted1RM - weights[i];
          baseScore = points[i] + (weightProgress / weightRange) * pointRange;
          break;
        }
      }
    }

    const finalLiftScore = baseScore;
    const level = getLevelFromScore(finalLiftScore);

    liftScores.push({
      lift: liftName,
      oneRepMax: actual1RM,
      score: Math.round(finalLiftScore),
      level: level,
    });
  }

  if (liftScores.length === 0) {
    return { totalScore: 0, liftScores: [] };
  }

  const averageScore = liftScores.reduce((sum, current) => sum + current.score, 0) / liftScores.length;
  const totalScore = averageScore * ageMultiplier;

  return {
    totalScore: Math.round(totalScore),
    liftScores: liftScores,
  };
};

export const getFssScoreInterpretation = (score: number | undefined | null): { label: StrengthLevel; color: string } | null => {
  if (score === undefined || score === null || isNaN(score)) return null;
  
  // Find the last level where the score is greater than or equal to the minimum.
  // This correctly handles any score, including those on boundaries.
  let foundLevel: StrengthLevel = FSS_CONFIG.fssLevels[0].label; // Default to the first level
  for (const level of FSS_CONFIG.fssLevels) {
    if (score >= level.min) {
      foundLevel = level.label;
    } else {
      // Since the levels are sorted by 'min', we can stop searching.
      break;
    }
  }

  return { label: foundLevel, color: LEVEL_COLORS_HEADER[foundLevel] };
};

interface StrengthComparisonToolProps {
  profile: ParticipantProfile | null;
  latestGoal: ParticipantGoalData | null;
  strengthStatsHistory: UserStrengthStat[];
  clubMemberships: ParticipantClubMembership[];
  onSaveStrengthStats: (stats: UserStrengthStat) => void;
  isEmbedded: boolean; // To control if it shows its own save/cancel, or if a parent does.
  onOpenPhysiqueModal: () => void;
}

export interface StrengthComparisonToolRef {
  submitForm: () => boolean;
}

const FocusedClubDisplay: React.FC<{
  liftType: LiftType;
  oneRepMax: number;
}> = ({ liftType, oneRepMax }) => {
  const allClubsForLift = useMemo(() => {
    return CLUB_DEFINITIONS.filter((club) => club.liftType === liftType && club.type === 'LIFT' && club.threshold).sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
  }, [liftType]);

  const { currentClub, nextClub } = useMemo(() => {
    let current: ClubDefinition | null = null;
    for (let i = allClubsForLift.length - 1; i >= 0; i--) {
      if (Number(oneRepMax) >= (allClubsForLift[i].threshold || 0)) {
        current = allClubsForLift[i];
        break;
      }
    }

    const currentIndex = current ? allClubsForLift.findIndex((c) => c.id === current!.id) : -1;

    const next = currentIndex > -1 ? allClubsForLift[currentIndex + 1] || null : allClubsForLift[0] || null;

    return { currentClub: current, nextClub: next };
  }, [allClubsForLift, oneRepMax]);

  const renderClubRow = (club: ClubDefinition | null, status: 'current' | 'next') => {
    if (!club || !club.threshold) {
      if (status === 'current' && !nextClub) {
        return (
          <div className="p-3 border-2 border-green-400 bg-green-50 rounded-lg text-center">
            <p className="font-bold text-green-800 text-lg">👑 Du har nått den högsta klubben!</p>
            <p className="text-sm text-green-700">Otroligt bra jobbat!</p>
          </div>
        );
      }
      return null;
    }

    if (status === 'current') {
      return (
        <div className="p-3 border-2 border-yellow-400 bg-yellow-50 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="font-bold text-yellow-800 text-lg">🏆 {club.name}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-800">Nuvarande</span>
          </div>
          <p className="text-sm text-yellow-700">Krav: {club.threshold} kg</p>
        </div>
      );
    }

    if (status === 'next') {
      const prevThreshold = currentClub?.threshold || 0;
      const progress = Number(oneRepMax) - prevThreshold;
      const total = club.threshold - prevThreshold;
      const progressPercent = total > 0 ? Math.min(100, Math.max(0, (progress / total) * 100)) : 0;

      return (
        <div className="p-3 border-2 border-dashed border-flexibel/50 bg-flexibel/5 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="font-bold text-flexibel text-lg">🎯 {club.name}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-flexibel/20 text-flexibel-800">Nästa Mål</span>
          </div>
          <p className="text-sm text-gray-600">Krav: {club.threshold} kg</p>
          {oneRepMax >= 0 && (
            <div className="mt-2 space-y-1">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-flexibel h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
              </div>
              <p className="text-right text-xs font-medium text-gray-500">
                {Number(oneRepMax).toFixed(1)} kg / {club.threshold} kg
              </p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (allClubsForLift.length === 0) {
    return null;
  }

  if (oneRepMax <= 0 && !currentClub) {
    return (
      <div className="mt-4 space-y-2">
        <h5 className="text-base font-semibold text-gray-700">Klubbprogression</h5>
        {renderClubRow(nextClub, 'next')}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      <h5 className="text-base font-semibold text-gray-700">Klubbprogression</h5>
      {renderClubRow(currentClub, 'current')}
      {renderClubRow(nextClub, 'next')}
    </div>
  );
};

const CalculatorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="url(#calcIconGradient)" strokeWidth="2">
    <defs>
      <linearGradient id="calcIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#51A1A1" />
        <stop offset="100%" stopColor="#f97316" />
      </linearGradient>
    </defs>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-6m-3 6v-6m-3 6v-6m0-4h.01M9 3h6l-3 4-3-4zM4.75 3h14.5A2.75 2.75 0 0122 5.75v12.5A2.75 2.75 0 0119.25 21H4.75A2.75 2.75 0 012 18.25V5.75A2.75 2.75 0 014.75 3z" />
  </svg>
);

export const StrengthComparisonTool = forwardRef<StrengthComparisonToolRef, StrengthComparisonToolProps>(
  ({ profile, onSaveStrengthStats, isEmbedded, onOpenPhysiqueModal }, ref) => {
    const { userStrengthStats: strengthStatsHistory } = useAppContext();
    const latestStats = useMemo(
      () => (strengthStatsHistory.length > 0 ? [...strengthStatsHistory].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0] : null),
      [strengthStatsHistory]
    );

    const [squat1RMax, setSquat1RMax] = useState('');
    const [benchPress1RMax, setBenchPress1RMax] = useState('');
    const [deadlift1RMax, setDeadlift1RMax] = useState('');
    const [overheadPress1RMax, setOverheadPress1RMax] = useState('');

    const [calcWeight, setCalcWeight] = useState('');
    const [calcReps, setCalcReps] = useState('');
    const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
    const [expandedLifts, setExpandedLifts] = useState<Partial<Record<LiftType, boolean>>>(MAIN_LIFTS_CONFIG_HEADER.reduce((acc, liftConfig) => ({ ...acc, [liftConfig.lift]: true }), {}));

    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    const shareableFssRef = useRef<HTMLDivElement>(null);
    const inputRefs = {
      squat1RMaxKg: useRef<HTMLInputElement>(null),
      benchPress1RMaxKg: useRef<HTMLInputElement>(null),
      deadlift1RMaxKg: useRef<HTMLInputElement>(null),
      overheadPress1RMaxKg: useRef<HTMLInputElement>(null),
    };

    const estimated1RM = useMemo(() => calculateEstimated1RM(calcWeight, calcReps), [calcWeight, calcReps]);

    useEffect(() => {
      setSquat1RMax(latestStats?.squat1RMaxKg?.toString() || '');
      setBenchPress1RMax(latestStats?.benchPress1RMaxKg?.toString() || '');
      setDeadlift1RMax(latestStats?.deadlift1RMaxKg?.toString() || '');
      setOverheadPress1RMax(latestStats?.overheadPress1RMaxKg?.toString() || '');
      setErrors({});
    }, [latestStats]);

    const areAllStatsFilled = useMemo(() => {
      return !!(profile?.bodyweightKg && squat1RMax.trim() && benchPress1RMax.trim() && deadlift1RMax.trim() && overheadPress1RMax.trim());
    }, [profile, squat1RMax, benchPress1RMax, deadlift1RMax, overheadPress1RMax]);

    const validateField = (value: string, fieldName: keyof UserStrengthStat): boolean => {
      if (value.trim() === '') {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[fieldName];
          return newErrors;
        });
        return true;
      }
      const num = Number(value.replace(',', '.'));
      if (isNaN(num) || num < 0) {
        setErrors((prev) => ({ ...prev, [fieldName]: 'Ogiltigt värde.' }));
        return false;
      }
      if (fieldName !== 'bodyweightKg' && Math.round(num * 10) % 5 !== 0) {
        setErrors((prev) => ({ ...prev, [fieldName]: 'Ange i hela/halva kg.' }));
        return false;
      }
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
      return true;
    };

    const handleSave = useCallback(() => {
      let isValid = true;
      if (!profile?.bodyweightKg) {
        alert("Ange din kroppsvikt i 'Min kropp' innan du sparar.");
        onOpenPhysiqueModal();
        return false;
      }
      const fieldsToValidate: Array<{ value: string; key: keyof UserStrengthStat }> = [
        { value: squat1RMax, key: 'squat1RMaxKg' },
        { value: benchPress1RMax, key: 'benchPress1RMaxKg' },
        { value: deadlift1RMax, key: 'deadlift1RMaxKg' },
        { value: overheadPress1RMax, key: 'overheadPress1RMaxKg' },
      ];
      fieldsToValidate.forEach((field) => {
        if (!validateField(field.value, field.key)) isValid = false;
      });

      if (!isValid) {
        alert('Vänligen korrigera felen i formuläret.');
        return false;
      }

      if (!profile?.id) {
        alert('Kan inte spara, deltagarprofil saknas.');
        return false;
      }

      const newStat: UserStrengthStat = {
        id: crypto.randomUUID(),
        participantId: profile.id,
        bodyweightKg: profile.bodyweightKg,
        squat1RMaxKg: squat1RMax.trim() ? Number(squat1RMax.replace(',', '.')) : undefined,
        benchPress1RMaxKg: benchPress1RMax.trim() ? Number(benchPress1RMax.replace(',', '.')) : undefined,
        deadlift1RMaxKg: deadlift1RMax.trim() ? Number(deadlift1RMax.replace(',', '.')) : undefined,
        overheadPress1RMaxKg: overheadPress1RMax.trim() ? Number(overheadPress1RMax.replace(',', '.')) : undefined,
        lastUpdated: new Date().toISOString(),
      };
      onSaveStrengthStats(newStat);
      return true;
    }, [squat1RMax, benchPress1RMax, deadlift1RMax, overheadPress1RMax, profile, onSaveStrengthStats, onOpenPhysiqueModal]);

    useImperativeHandle(ref, () => ({
      submitForm: () => {
        return handleSave();
      },
    }));

    const handleShare = async () => {
      if (shareableFssRef.current) {
        try {
          const canvas = await html2canvas(shareableFssRef.current, { backgroundColor: '#f1f5f9', scale: 2 });
          const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
          if (blob) {
            const file = new File([blob], 'min_styrka.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], title: 'Min Styrkestatus' });
            } else {
              alert('Din webbläsare stödjer inte bilddelning. Försök från en mobil enhet!');
            }
          }
        } catch (error) {
          console.error('Kunde inte skapa bild:', error);
          alert('Kunde inte skapa bild för delning.');
        }
      }
    };

    const fssData = useMemo(() => {
      const numericBw = profile?.bodyweightKg ?? 0;
      if (!profile || !numericBw) return null;

      const currentStats: UserStrengthStat = {
        id: '',
        participantId: profile.id,
        lastUpdated: '',
        bodyweightKg: numericBw,
        squat1RMaxKg: squat1RMax ? Number(squat1RMax.replace(',', '.')) : undefined,
        benchPress1RMaxKg: benchPress1RMax ? Number(benchPress1RMax.replace(',', '.')) : undefined,
        deadlift1RMaxKg: deadlift1RMax ? Number(deadlift1RMax.replace(',', '.')) : undefined,
        overheadPress1RMaxKg: overheadPress1RMax ? Number(overheadPress1RMax.replace(',', '.')) : undefined,
      };
      return calculateFlexibelStrengthScoreInternal(currentStats, profile);
    }, [squat1RMax, benchPress1RMax, deadlift1RMax, overheadPress1RMax, profile]);

    const fssInterpretation = getFssScoreInterpretation(fssData?.totalScore);

    if (!profile || !profile.gender || !profile.age) {
      return <p className="text-center p-4 bg-yellow-100 text-yellow-800 rounded-md">Vänligen fyll i kön och ålder i din profil för att kunna se och jämföra din styrka.</p>;
    }

    const missingStats: { key: keyof typeof inputRefs; label: string }[] = [];
    MAIN_LIFTS_CONFIG_HEADER.forEach((lift) => {
      const stateValue = { squat1RMaxKg: squat1RMax, benchPress1RMaxKg: benchPress1RMax, deadlift1RMaxKg: deadlift1RMax, overheadPress1RMaxKg: overheadPress1RMax }[
        lift.statKey
      ];
      if (!stateValue.trim()) {
        missingStats.push({ key: lift.statKey, label: lift.lift });
      }
    });

    return (
      <div className="space-y-6">
        {areAllStatsFilled ? (
          <div className="space-y-4">
            <div ref={shareableFssRef} className="p-4 bg-gray-100 rounded-lg text-center space-y-3">
              <div>
                <h4 className="text-base font-semibold text-gray-600">Flexibel Strength Score (FSS)</h4>
                <p className="text-5xl font-bold" style={{ color: FLEXIBEL_PRIMARY_COLOR }}>
                  {fssData?.totalScore ?? '-'}
                </p>
              </div>
              {fssInterpretation && (
                <div>
                  <p className="text-base font-semibold text-gray-600">Nivå</p>
                  <p className="text-2xl font-bold" style={{ color: fssInterpretation.color }}>
                    {fssInterpretation.label}
                  </p>
                </div>
              )}
            </div>
            <Button onClick={handleShare} fullWidth variant="secondary">
              Dela resultat
            </Button>
          </div>
        ) : !profile.bodyweightKg ? (
          <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
            <h3 className="text-lg font-bold text-yellow-800">Kroppsvikt saknas</h3>
            <p className="text-base text-yellow-700 mt-1">Ange din kroppsvikt i "Min kropp" för att beräkna din FSS-poäng och se din styrkenivå.</p>
            <Button onClick={onOpenPhysiqueModal} className="mt-3">
              Ange kroppsvikt
            </Button>
          </div>
        ) : (
          <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg">
            <h3 className="text-xl font-bold text-gray-800">Kom igång!</h3>
            <p className="text-base text-gray-700 mt-1">Fyll i dina maxlyft för att se din FSS-poäng och styrkenivå.</p>
            {missingStats.length > 0 && (
              <ul className="mt-3 space-y-2">
                {missingStats.map((stat) => (
                  <li key={stat.key} className="flex items-center text-base">
                    <span className="text-lg mr-2">❌</span>
                    <span>{stat.label}</span>
                    <button onClick={() => inputRefs[stat.key].current?.focus()} className="ml-auto text-sm text-flexibel hover:underline">
                      Fyll i
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="pb-4 mb-4 border-b">
          <Button variant="outline" fullWidth size="md" className="!text-lg justify-center" onClick={() => setIsCalculatorOpen((prev) => !prev)} aria-expanded={isCalculatorOpen}>
            <CalculatorIcon /> Beräkna Estimerat 1RM
          </Button>
          {isCalculatorOpen && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border space-y-3 animate-fade-in-down">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Vikt (kg)" type="number" value={calcWeight} onChange={(e) => setCalcWeight(e.target.value)} placeholder="T.ex. 80" inputSize="sm" />
                <Input label="Reps" type="number" value={calcReps} onChange={(e) => setCalcReps(e.target.value)} placeholder="T.ex. 5" inputSize="sm" max="12" />
              </div>
              {estimated1RM !== null && (
                <div className="text-center p-2 bg-white rounded-md border">
                  <p className="text-sm text-gray-500">Estimerat 1RM</p>
                  <p className="text-2xl font-bold text-flexibel">{estimated1RM.toFixed(1)} kg</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-gray-700">Dina 1RM</h3>
          {profile?.bodyweightKg && (
            <div className="p-3 bg-gray-100 rounded-lg flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Beräknas med kroppsvikt</p>
                <p className="text-xl font-bold text-gray-800">{profile.bodyweightKg} kg</p>
              </div>
              <Button variant="ghost" size="sm" onClick={onOpenPhysiqueModal}>
                Ändra
              </Button>
            </div>
          )}

          {MAIN_LIFTS_CONFIG_HEADER.map(({ lift, statKey, label }) => {
            const liftState = { squat1RMaxKg: squat1RMax, benchPress1RMaxKg: benchPress1RMax, deadlift1RMaxKg: deadlift1RMax, overheadPress1RMaxKg: overheadPress1RMax }[
              statKey
            ];
            const setStateAction = { squat1RMaxKg: setSquat1RMax, benchPress1RMaxKg: setBenchPress1RMax, deadlift1RMaxKg: setDeadlift1RMax, overheadPress1RMaxKg: setOverheadPress1RMax }[
              statKey
            ];
            const liftScoreData = fssData?.liftScores.find((l) => l.lift === lift);

            return (
              <details key={statKey} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200" open={expandedLifts[lift]}>
                <summary
                  className="font-semibold text-lg text-gray-800 cursor-pointer list-none flex justify-between items-center"
                  onClick={(e) => {
                    e.preventDefault();
                    setExpandedLifts((p) => ({ ...p, [lift]: !p[lift] }));
                  }}
                >
                  <span>
                    {lift}:{' '}
                    <span className="font-bold text-flexibel">
                      {liftState || '-'} kg
                    </span>
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 text-gray-500 transition-transform ${expandedLifts[lift] ? 'rotate-180' : ''}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </summary>
                <div className="mt-3 pt-3 border-t space-y-4">
                  {liftScoreData && (
                    <div className="p-3 border rounded-md bg-gray-50 text-center">
                      <h5 className="font-semibold text-base text-gray-700">Poäng & Nivå</h5>
                      <p className="text-3xl font-bold" style={{ color: LEVEL_COLORS_HEADER[liftScoreData.level] }}>
                        {liftScoreData.score}
                      </p>
                      <p className="text-lg font-semibold" style={{ color: LEVEL_COLORS_HEADER[liftScoreData.level] }}>
                        {liftScoreData.level}
                      </p>
                    </div>
                  )}
                  <FocusedClubDisplay liftType={lift} oneRepMax={Number((liftState || '0').replace(',', '.')) || 0} />
                  <Input
                    label={`Uppdatera ${label}`}
                    id={statKey}
                    name={statKey}
                    type="number"
                    step="0.5"
                    value={liftState}
                    onChange={(e) => {
                      setStateAction(e.target.value);
                      validateField(e.target.value, statKey);
                    }}
                    error={errors[statKey]}
                    ref={inputRefs[statKey]}
                  />
                </div>
              </details>
            );
          })}
        </div>

        <details className="mt-8 pt-6 border-t">
          <summary className="text-xl font-semibold text-gray-700 cursor-pointer list-none flex justify-between items-center py-2 group hover:text-flexibel transition-colors">
            Historik
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-500 transition-transform duration-200 group-open:rotate-180"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </summary>
          <div className="mt-2 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <p className="text-base text-gray-600">Här kan du se din historiska utveckling. Spara nya mätpunkter för att se grafen växa!</p>
            {/* Future chart component would go here */}
          </div>
        </details>

        {!isEmbedded && (
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button onClick={handleSave} variant="primary">
              Spara Styrkestatus
            </Button>
          </div>
        )}
      </div>
    );
  }
);

StrengthComparisonTool.displayName = 'StrengthComparisonTool';
