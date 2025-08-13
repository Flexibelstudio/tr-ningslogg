

import React, { useState, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ParticipantProfile, UserStrengthStat, StrengthStandard, LiftType, StrengthLevel, StrengthStandardDetail, AllUserProvidedStrengthMultipliers, GenderOption, ParticipantGoalData, ClubDefinition, ParticipantClubMembership } from '../../types';
import { STRENGTH_LEVEL_ORDER, FSS_CONFIG, FLEXIBEL_PRIMARY_COLOR, MAIN_LIFTS_CONFIG_HEADER, LEVEL_COLORS_HEADER, CLUB_DEFINITIONS } from '../../constants';
import { Input } from '../Input';
import { Button } from '../Button';
import { calculateEstimated1RM } from '../../utils/workoutUtils';

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

export const calculateFlexibelStrengthScoreInternal = (
    userStats: UserStrengthStat,
    userProfile: ParticipantProfile
): FssScoreOutput | null => {
    const getLevelFromScore = (score: number): StrengthLevel => {
        const levelConfig = FSS_CONFIG.fssLevels.find(l => score >= l.min && score <= l.max);
        if (!levelConfig && score >= FSS_CONFIG.fssLevels[FSS_CONFIG.fssLevels.length - 1].min) {
            return FSS_CONFIG.fssLevels[FSS_CONFIG.fssLevels.length - 1].label;
        }
        return levelConfig ? levelConfig.label : FSS_CONFIG.fssLevels[0].label;
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
        const multiplierConfig = FSS_CONFIG.bodyweightAdjustment.multipliers.find(m => bodyweight <= m.maxWeight);
        if (multiplierConfig) {
            bodyweightMultiplier = multiplierConfig.multiplier;
        } else if (FSS_CONFIG.bodyweightAdjustment.multipliers.length > 0) {
            bodyweightMultiplier = FSS_CONFIG.bodyweightAdjustment.multipliers[FSS_CONFIG.bodyweightAdjustment.multipliers.length - 1].multiplier;
        }
    }

    // AGE ADJUSTMENT
    let ageMultiplier = 1.0;
    if (FSS_CONFIG.ageAdjustment.apply) {
        const modifierConfig = FSS_CONFIG.ageAdjustment.modifiers.find(m => age >= m.minAge && age <= m.maxAge);
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
                if (adjusted1RM >= weights[i] && adjusted1RM < weights[i+1]) {
                    const weightRange = weights[i+1] - weights[i];
                    const pointRange = points[i+1] - points[i];
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

export const getFssScoreInterpretation = (score: number | undefined | null): { label: StrengthLevel; color: string; } | null => {
    if (score === undefined || score === null || isNaN(score)) return null;
    const levelConfig = FSS_CONFIG.fssLevels.find(l => score >= l.min && score <= l.max);
    if (!levelConfig) {
        if (score >= FSS_CONFIG.fssLevels[FSS_CONFIG.fssLevels.length - 1].min) {
             const topLevel = FSS_CONFIG.fssLevels[FSS_CONFIG.fssLevels.length - 1];
             return { label: topLevel.label, color: LEVEL_COLORS_HEADER[topLevel.label] };
        }
        const bottomLevel = FSS_CONFIG.fssLevels[0];
        return { label: bottomLevel.label, color: LEVEL_COLORS_HEADER[bottomLevel.label] };
    }
    return { label: levelConfig.label, color: LEVEL_COLORS_HEADER[levelConfig.label] };
};


interface StrengthComparisonToolProps {
  profile: ParticipantProfile | null;
  latestGoal: ParticipantGoalData | null;
  strengthStatsHistory: UserStrengthStat[];
  clubMemberships: ParticipantClubMembership[];
  onSaveStrengthStats: (stats: UserStrengthStat) => void;
  isEmbedded: boolean; // To control if it shows its own save/cancel, or if a parent does.
}

export interface StrengthComparisonToolRef {
    submitForm: () => boolean;
}

const FocusedClubDisplay: React.FC<{
  liftType: LiftType;
  oneRepMax: number;
}> = ({ liftType, oneRepMax }) => {
    const allClubsForLift = useMemo(() => {
        return CLUB_DEFINITIONS
            .filter(club => club.liftType === liftType && club.type === 'LIFT' && club.threshold)
            .sort((a, b) => (a.threshold || 0) - (b.threshold || 0));
    }, [liftType]);

    const { currentClub, nextClub } = useMemo(() => {
        let current: ClubDefinition | null = null;
        for (let i = allClubsForLift.length - 1; i >= 0; i--) {
            if (Number(oneRepMax) >= (allClubsForLift[i].threshold || 0)) {
                current = allClubsForLift[i];
                break;
            }
        }

        const currentIndex = current ? allClubsForLift.findIndex(c => c.id === current!.id) : -1;

        const next = currentIndex > -1
            ? (allClubsForLift[currentIndex + 1] || null)
            : allClubsForLift[0] || null;

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
                            <p className="text-right text-xs font-medium text-gray-500">{Number(oneRepMax).toFixed(1)} kg / {club.threshold} kg</p>
                        </div>
                    )}
                </div>
            )
        }
        return null;
    };

    if (allClubsForLift.length === 0) {
        return null;
    }
    
    if (oneRepMax <= 0 && !currentClub) {
         return (
            <div className="mt-2 space-y-2">
                <h5 className="text-xs font-bold uppercase text-gray-400">Klubbprogression</h5>
                {renderClubRow(nextClub, 'next')}
            </div>
        );
    }

    return (
        <div className="mt-2 space-y-2">
            <h5 className="text-xs font-bold uppercase text-gray-400">Klubbprogression</h5>
            {renderClubRow(currentClub, 'current')}
            {renderClubRow(nextClub, 'next')}
        </div>
    );
};

const CalculatorIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6 mr-2 flex-shrink-0"
    fill="none"
    viewBox="0 0 24 24"
    stroke="url(#calcIconGradient)"
    strokeWidth="2"
  >
    <defs>
      <linearGradient id="calcIconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#51A1A1" />
        <stop offset="100%" stopColor="#f97316" />
      </linearGradient>
    </defs>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M9 7h6m0 10v-6m-3 6v-6m-3 6v-6m0-4h.01M9 3h6l-3 4-3-4zM4.75 3h14.5A2.75 2.75 0 0122 5.75v12.5A2.75 2.75 0 0119.25 21H4.75A2.75 2.75 0 012 18.25V5.75A2.75 2.75 0 014.75 3z"
    />
  </svg>
);

export const StrengthComparisonTool = forwardRef<StrengthComparisonToolRef, StrengthComparisonToolProps>(({
  profile,
  latestGoal,
  strengthStatsHistory,
  clubMemberships,
  onSaveStrengthStats,
  isEmbedded,
}, ref) => {
  const latestStats = useMemo(() => strengthStatsHistory.length > 0 ? [...strengthStatsHistory].sort((a,b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())[0] : null, [strengthStatsHistory]);

  const [bodyweight, setBodyweight] = useState('');
  const [squat1RMax, setSquat1RMax] = useState('');
  const [benchPress1RMax, setBenchPress1RMax] = useState('');
  const [deadlift1RMax, setDeadlift1RMax] = useState('');
  const [overheadPress1RMax, setOverheadPress1RMax] = useState('');
  
  const [calcWeight, setCalcWeight] = useState('');
  const [calcReps, setCalcReps] = useState('');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const estimated1RM = useMemo(() => calculateEstimated1RM(calcWeight, calcReps), [calcWeight, calcReps]);

  useEffect(() => {
    const bwFromStats = latestStats?.bodyweightKg?.toString();
    const bwFromProfile = profile?.bodyweightKg?.toString();
    
    setBodyweight(bwFromStats || bwFromProfile || '');

    setSquat1RMax(latestStats?.squat1RMaxKg?.toString() || '');
    setBenchPress1RMax(latestStats?.benchPress1RMaxKg?.toString() || '');
    setDeadlift1RMax(latestStats?.deadlift1RMaxKg?.toString() || '');
    setOverheadPress1RMax(latestStats?.overheadPress1RMaxKg?.toString() || '');
    setErrors({});
  }, [latestStats, profile]);
  
  const validateField = (value: string, fieldName: keyof UserStrengthStat): boolean => {
    if (value.trim() === '') {
      setErrors(prev => { const newErrors = {...prev}; delete newErrors[fieldName]; return newErrors; });
      return true;
    }
    const num = Number(value.replace(',', '.'));
    if (isNaN(num) || num < 0) {
      setErrors(prev => ({ ...prev, [fieldName]: 'Ogiltigt värde.' }));
      return false;
    }
    if (fieldName !== 'bodyweightKg' && Math.round(num * 10) % 5 !== 0) {
      setErrors(prev => ({ ...prev, [fieldName]: 'Ange i hela/halva kg.'}));
      return false;
    }
    setErrors(prev => { const newErrors = {...prev}; delete newErrors[fieldName]; return newErrors; });
    return true;
  };
  
  const handleSave = useCallback(() => {
    let isValid = true;
    const fieldsToValidate: Array<{value: string, key: keyof UserStrengthStat}> = [
        {value: bodyweight, key: 'bodyweightKg'},
        {value: squat1RMax, key: 'squat1RMaxKg'},
        {value: benchPress1RMax, key: 'benchPress1RMaxKg'},
        {value: deadlift1RMax, key: 'deadlift1RMaxKg'},
        {value: overheadPress1RMax, key: 'overheadPress1RMaxKg'}
    ];
    fieldsToValidate.forEach(field => {
        if (!validateField(field.value, field.key)) isValid = false;
    });
    
    if (!bodyweight.trim()) {
        setErrors(prev => ({ ...prev, bodyweightKg: 'Kroppsvikt är obligatoriskt.' }));
        isValid = false;
    }
    
    if (!isValid) {
      alert("Vänligen korrigera felen i formuläret.");
      return false;
    }

    if (!profile?.id) {
        alert("Kan inte spara, deltagarprofil saknas.");
        return false;
    }

    const newStat: UserStrengthStat = {
      id: crypto.randomUUID(),
      participantId: profile.id,
      bodyweightKg: Number(bodyweight.replace(',', '.')),
      squat1RMaxKg: squat1RMax.trim() ? Number(squat1RMax.replace(',', '.')) : undefined,
      benchPress1RMaxKg: benchPress1RMax.trim() ? Number(benchPress1RMax.replace(',', '.')) : undefined,
      deadlift1RMaxKg: deadlift1RMax.trim() ? Number(deadlift1RMax.replace(',', '.')) : undefined,
      overheadPress1RMaxKg: overheadPress1RMax.trim() ? Number(overheadPress1RMax.replace(',', '.')) : undefined,
      lastUpdated: new Date().toISOString(),
    };
    onSaveStrengthStats(newStat);
    return true;
  }, [bodyweight, squat1RMax, benchPress1RMax, deadlift1RMax, overheadPress1RMax, profile, onSaveStrengthStats]);

  useImperativeHandle(ref, () => ({
    submitForm: () => {
      return handleSave();
    }
  }));

  const FssDataForHistory = useMemo(() => {
    if (!profile) return [];
    return strengthStatsHistory.map(stat => {
        const scoreData = calculateFlexibelStrengthScoreInternal(stat, profile);
        if (scoreData) {
            return { date: stat.lastUpdated, score: scoreData.totalScore };
        }
        return null;
    }).filter(Boolean) as { date: string, score: number }[];
  }, [strengthStatsHistory, profile]);

  const latestFss = useMemo(() => {
      if (FssDataForHistory.length === 0) return null;
      return [...FssDataForHistory].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [FssDataForHistory]);

  const findLatestStat = useCallback((metric: keyof Omit<UserStrengthStat, 'id' | 'participantId' | 'lastUpdated'>, history: UserStrengthStat[]): { value: number; date: string } | null => {
      const sortedHistory = [...history].sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
      for (const stat of sortedHistory) {
        const val = stat[metric];
        if (val !== undefined && val !== null && (val as number) > 0) {
          return { value: val as number, date: stat.lastUpdated };
        }
      }
      return null;
  }, []);

  const latestLifts = useMemo(() => {
      const lifts: {label: string, value: number, date: string}[] = [];
      const metrics: { key: keyof Omit<UserStrengthStat, 'id' | 'participantId' | 'lastUpdated'>, label: string }[] = [
          { key: 'squat1RMaxKg', label: 'Knäböj' },
          { key: 'benchPress1RMaxKg', label: 'Bänkpress' },
          { key: 'deadlift1RMaxKg', label: 'Marklyft' },
          { key: 'overheadPress1RMaxKg', label: 'Axelpress' },
          { key: 'bodyweightKg', label: 'Kroppsvikt' },
      ];
      
      metrics.forEach(metric => {
          const latest = findLatestStat(metric.key, strengthStatsHistory);
          if (latest) {
              lifts.push({ label: metric.label, ...latest });
          }
      });

      return lifts;
  }, [strengthStatsHistory, findLatestStat]);

  const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long' });
  };

  if (!profile || !profile.gender || !profile.age) {
    return <p className="text-center p-4 bg-yellow-100 text-yellow-800 rounded-md">Vänligen fyll i kön och ålder i din profil för att kunna se och jämföra din styrka.</p>;
  }
  
  const fssData = useMemo(() => {
    const numericBw = bodyweight.trim() ? Number(bodyweight.replace(',', '.')) : 0;
    if (!profile || !numericBw) return null;
    
    const currentStats: UserStrengthStat = {
        id: '', participantId: profile.id, lastUpdated: '',
        bodyweightKg: numericBw,
        squat1RMaxKg: squat1RMax ? Number(squat1RMax.replace(',', '.')) : undefined,
        benchPress1RMaxKg: benchPress1RMax ? Number(benchPress1RMax.replace(',', '.')) : undefined,
        deadlift1RMaxKg: deadlift1RMax ? Number(deadlift1RMax.replace(',', '.')) : undefined,
        overheadPress1RMaxKg: overheadPress1RMax ? Number(overheadPress1RMax.replace(',', '.')) : undefined,
    };
    return calculateFlexibelStrengthScoreInternal(currentStats, profile);
  }, [bodyweight, squat1RMax, benchPress1RMax, deadlift1RMax, overheadPress1RMax, profile]);

  const fssInterpretation = getFssScoreInterpretation(fssData?.totalScore);


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Form */}
        <div className="space-y-4">
          <div className="pb-4 mb-4 border-b">
            <Button
              variant="outline"
              fullWidth
              size="md"
              className="!text-lg justify-center"
              onClick={() => setIsCalculatorOpen(prev => !prev)}
              aria-expanded={isCalculatorOpen}
              aria-controls="rm-calculator"
            >
              <CalculatorIcon />
              Beräkna Estimerat 1RM
            </Button>

            {isCalculatorOpen && (
              <div id="rm-calculator" className="mt-4 p-4 bg-gray-50 rounded-lg border space-y-3 animate-fade-in-down">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Vikt (kg)"
                    type="number"
                    value={calcWeight}
                    onChange={(e) => setCalcWeight(e.target.value)}
                    placeholder="T.ex. 80"
                    inputSize="sm"
                  />
                  <Input
                    label="Reps"
                    type="number"
                    value={calcReps}
                    onChange={(e) => setCalcReps(e.target.value)}
                    placeholder="T.ex. 5"
                    inputSize="sm"
                    max="12"
                  />
                </div>
                {estimated1RM !== null && (
                  <div className="text-center p-2 bg-white rounded-md border">
                    <p className="text-sm text-gray-500">Estimerat 1RM</p>
                    <p className="text-2xl font-bold text-flexibel">{estimated1RM.toFixed(1)} kg</p>
                  </div>
                )}
                <p className="text-xs text-gray-500 text-center">
                  Baserat på Brzycki-formeln. Mest tillförlitligt för 1-12 reps.
                </p>
                {estimated1RM !== null && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium text-gray-600 mb-2">Använd värdet för:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => { const val = String(estimated1RM); setSquat1RMax(val); validateField(val, 'squat1RMaxKg'); }}>Knäböj</Button>
                      <Button variant="outline" size="sm" onClick={() => { const val = String(estimated1RM); setBenchPress1RMax(val); validateField(val, 'benchPress1RMaxKg'); }}>Bänkpress</Button>
                      <Button variant="outline" size="sm" onClick={() => { const val = String(estimated1RM); setDeadlift1RMax(val); validateField(val, 'deadlift1RMaxKg'); }}>Marklyft</Button>
                      <Button variant="outline" size="sm" onClick={() => { const val = String(estimated1RM); setOverheadPress1RMax(val); validateField(val, 'overheadPress1RMaxKg'); }}>Axelpress</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <h3 className="text-xl font-semibold text-gray-700">Dina 1RM (maxlyft för 1 repetition)</h3>
          <Input
            label="Kroppsvikt (kg) *"
            id="bodyweight" name="bodyweight" type="number" step="0.1"
            value={bodyweight}
            onChange={(e) => { setBodyweight(e.target.value); validateField(e.target.value, 'bodyweightKg'); }}
            error={errors.bodyweightKg}
            required
          />
          {MAIN_LIFTS_CONFIG_HEADER.map(({ lift, statKey, label }) => {
            const liftState = {
                squat1RMaxKg: squat1RMax, benchPress1RMaxKg: benchPress1RMax,
                deadlift1RMaxKg: deadlift1RMax, overheadPress1RMaxKg: overheadPress1RMax
            }[statKey];
            const setStateAction = {
                squat1RMaxKg: setSquat1RMax, benchPress1RMaxKg: setBenchPress1RMax,
                deadlift1RMaxKg: setDeadlift1RMax, overheadPress1RMaxKg: setOverheadPress1RMax
            }[statKey];

            return (
              <div key={statKey} className="space-y-2">
                <Input
                  label={label}
                  id={statKey} name={statKey} type="number" step="0.5"
                  value={liftState}
                  onChange={(e) => { setStateAction(e.target.value); validateField(e.target.value, statKey); }}
                  error={errors[statKey]}
                />
                <FocusedClubDisplay
                    liftType={lift}
                    oneRepMax={Number((liftState || '0').replace(',', '.')) || 0}
                />
              </div>
            );
          })}
        </div>
        
        {/* Right Column: Results & History */}
        <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-700">Ditt Resultat</h3>
            <div className="p-4 bg-gray-100 rounded-lg text-center space-y-3">
                <div>
                    <h4 className="text-base font-semibold text-gray-600">Flexibel Strength Score (FSS)</h4>
                    <p className="text-5xl font-bold" style={{color: FLEXIBEL_PRIMARY_COLOR}}>{fssData?.totalScore ?? '-'}</p>
                </div>
                {fssInterpretation && (
                    <div>
                        <p className="text-base font-semibold text-gray-600">Nivå</p>
                        <p className="text-2xl font-bold" style={{color: fssInterpretation.color}}>{fssInterpretation.label}</p>
                    </div>
                )}
                <p className="text-xs text-gray-500">Ett genomsnitt av dina loggade baslyft, justerat för kroppsvikt och ålder.</p>
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                {fssData?.liftScores.map(liftScore => (
                    <div key={liftScore.lift} className="p-3 border rounded-md bg-white">
                        <h5 className="font-bold text-lg text-gray-800">{liftScore.lift}</h5>
                        {liftScore.oneRepMax === null ? (
                            <p className="text-gray-500">Inget 1RM loggat.</p>
                        ) : (
                            <>
                                <p className="text-sm text-gray-600">1RM: {liftScore.oneRepMax} kg</p>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <p className="text-2xl font-bold" style={{ color: LEVEL_COLORS_HEADER[liftScore.level] }}>{liftScore.score}</p>
                                    <p className="text-sm font-semibold text-gray-500">poäng</p>
                                </div>
                                <p className="text-sm font-semibold" style={{ color: LEVEL_COLORS_HEADER[liftScore.level] }}>{liftScore.level}</p>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
      </div>
      
      {/* History List Section */}
      <div className="mt-8 pt-6 border-t">
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Historik</h3>
           <div
                className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 cursor-pointer"
                onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setIsHistoryExpanded(!isHistoryExpanded)}
                aria-expanded={isHistoryExpanded}
            >
                {/* Collapsed View */}
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-2xl font-bold text-gray-800">Senaste Styrkestatus</h4>
                        {latestFss && <p className="text-base text-gray-500">den {formatDate(latestFss.date)}</p>}
                    </div>
                    <div className="text-right">
                        <p className="text-4xl font-bold text-gray-800">{latestFss ? latestFss.score : '-'}<span className="text-2xl text-gray-500 font-medium ml-1">poäng</span></p>
                        {latestFss && (
                            <p className="font-semibold" style={{ color: getFssScoreInterpretation(latestFss.score)?.color }}>
                                {getFssScoreInterpretation(latestFss.score)?.label}
                            </p>
                        )}
                    </div>
                </div>

                {/* Expanded View */}
                {isHistoryExpanded && (
                    <div className="mt-4 pt-4 border-t animate-fade-in-down">
                        <h4 className="text-lg font-semibold text-gray-800 mb-3">Senaste Noteringar</h4>
                        {(latestFss || latestLifts.length > 0) ? (
                            <ul className="space-y-2 text-base text-gray-700">
                                {latestFss && (
                                    <li className="flex justify-between items-center py-1 border-b border-gray-200">
                                        <span className="font-semibold">FSS:</span>
                                        <span>
                                            <span className="font-bold">{latestFss.score}</span> den <span className="text-sm">{formatDate(latestFss.date)}</span>
                                        </span>
                                    </li>
                                )}
                                {latestLifts.map(lift => (
                                    <li key={lift.label} className="flex justify-between items-center py-1 border-b border-gray-200 last:border-b-0">
                                        <span className="font-semibold">{lift.label}:</span>
                                        <span>
                                            <span className="font-bold">{lift.value} kg</span> den <span className="text-sm">{formatDate(lift.date)}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-500 italic">Spara en mätpunkt för att se din historik här.</p>
                        )}
                    </div>
                )}
            </div>
      </div>

      {!isEmbedded && (
          <div className="flex justify-end space-x-3 pt-6 border-t">
              {/* <Button onClick={onCancel} variant="secondary">Avbryt</Button> */}
              <Button onClick={handleSave} variant="primary">Spara Styrkestatus</Button>
          </div>
      )}
    </div>
  );
});

StrengthComparisonTool.displayName = 'StrengthComparisonTool';
