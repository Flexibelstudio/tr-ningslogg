import React, { useState, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ParticipantProfile, UserStrengthStat, StrengthStandard, LiftType, StrengthLevel, StrengthStandardDetail, AllUserProvidedStrengthMultipliers, GenderOption, ParticipantGoalData, ClubDefinition, ParticipantClubMembership } from '../../types';
import { STRENGTH_STANDARDS_DATA, STRENGTH_LEVEL_ORDER, USER_PROVIDED_STRENGTH_MULTIPLIERS, FLEXIBEL_PRIMARY_COLOR, MAIN_LIFTS_CONFIG_HEADER, LEVEL_COLORS_HEADER, CLUB_DEFINITIONS } from '../../constants';
import { Input } from '../Input';
import { Button } from '../Button';
import { StrengthHistoryChart } from './StrengthHistoryChart';
import { FssHistoryChart } from './FssHistoryChart';

// Helper function to get age adjustment factor
const getAgeAdjustmentFactor = (
  age: number | undefined,
  lift: LiftType,
  gender: GenderOption | undefined,
  multipliers: AllUserProvidedStrengthMultipliers
): number => {
    if (!age || !gender || (gender !== 'Man' && gender !== 'Kvinna') ) return 1.0;
    const liftKey = lift.toLowerCase() as keyof AllUserProvidedStrengthMultipliers;
    if (!multipliers[liftKey]) return 1.0;
    const liftData = multipliers[liftKey];
    const genderKey = gender === 'Man' ? 'män' : 'kvinnor';
    const genderSpecificMultipliers = liftData[genderKey];
    if (!genderSpecificMultipliers || !genderSpecificMultipliers.justering) return 1.0;
    const ageAdjustments = genderSpecificMultipliers.justering;
    const ageRanges = Object.keys(ageAdjustments).sort((a,b) => parseInt(a.split('-')[0],10) - parseInt(b.split('-')[0],10));
    if (ageRanges.length > 0) {
        const firstRangeMinAge = parseInt(ageRanges[0].split('-')[0], 10);
        if (age < firstRangeMinAge) return 1.0;
    } else { return 1.0; }
    for (const range of ageRanges) {
        const [minAge, maxAge] = range.split('-').map(Number);
        if (age >= minAge && age <= maxAge) return ageAdjustments[range as keyof typeof ageAdjustments.justering];
    }
    if (ageRanges.length > 0) {
        const lastRangeMaxAge = parseInt(ageRanges[ageRanges.length - 1].split('-')[1], 10);
        if (age > lastRangeMaxAge) return ageAdjustments[ageRanges[ageRanges.length - 1] as keyof typeof ageAdjustments.justering];
    }
    return 1.0;
};

// Main function to calculate strength level for a given lift
const getStrengthLevel = (
  lift: LiftType,
  oneRepMax: number,
  bodyweight: number,
  gender: GenderOption,
  age: number | undefined
): { level: StrengthLevel; standardsForLevel: StrengthStandardDetail[] } | null => {
  if (gender !== 'Man' && gender !== 'Kvinna') return null;
  const liftKey = lift.toLowerCase() as keyof AllUserProvidedStrengthMultipliers;
  const multipliersForLift = USER_PROVIDED_STRENGTH_MULTIPLIERS[liftKey];
  if (!multipliersForLift) return null;

  const genderKey = gender === 'Man' ? 'män' : 'kvinnor';
  const ageAdjustment = getAgeAdjustmentFactor(age, lift, gender, USER_PROVIDED_STRENGTH_MULTIPLIERS);
  const adjustedOneRepMax = oneRepMax / ageAdjustment;

  const standardsForBodyweight = multipliersForLift[genderKey].bas.map((multiplier, index) => ({
    level: STRENGTH_LEVEL_ORDER[index],
    weightKg: parseFloat((bodyweight * multiplier).toFixed(1)),
  }));

  let currentLevel: StrengthLevel = 'Otränad';
  for (let i = standardsForBodyweight.length - 1; i >= 0; i--) {
    if (adjustedOneRepMax >= standardsForBodyweight[i].weightKg) {
      currentLevel = standardsForBodyweight[i].level;
      break;
    }
  }

  return {
    level: currentLevel,
    standardsForLevel: standardsForBodyweight,
  };
};

const calculateEstimated1RM = (weightStr?: number | string, repsStr?: number | string): string | null => {
    const weight = parseFloat(String(weightStr || '').replace(',', '.'));
    const reps = parseInt(String(repsStr || ''), 10);

    if (isNaN(weight) || isNaN(reps) || weight <= 0 || reps <= 0) {
        return null;
    }
    
    // Formula is most accurate for reps <= 12
    if (reps > 12) {
        return null;
    }

    if (reps === 1) {
        return weight.toFixed(1);
    }

    // Brzycki Formula
    const e1RM = weight / (1.0278 - (0.0278 * reps));

    if (e1RM < weight) {
        return null;
    }

    // Round to the nearest 0.5
    return (Math.round(e1RM * 2) / 2).toFixed(1);
};


export const calculateFlexibelStrengthScoreInternal = (
    userStats: UserStrengthStat,
    userProfile: ParticipantProfile
): { score: number; interpretation: string } | null => {
    if (!userProfile.age || !userProfile.gender || (userProfile.gender !== 'Man' && userProfile.gender !== 'Kvinna') || !userStats.bodyweightKg) {
        const hasRequiredProfileInfo = userProfile.age && userProfile.gender && (userProfile.gender === 'Man' || userProfile.gender === 'Kvinna');
        if (!hasRequiredProfileInfo) {
            // console.warn("Cannot calculate FSS: User profile is missing age or gender.");
        }
        if (!userStats.bodyweightKg) {
            // console.warn("Cannot calculate FSS: User stats are missing bodyweight.");
        }
        return null;
    }

    const age = parseInt(userProfile.age, 10);
    const bodyweight = userStats.bodyweightKg;
    if (!bodyweight) return null;

    const levelToPoints: Record<StrengthLevel, number> = { 'Otränad': 60, 'Nybörjare': 75, 'Medelgod': 85, 'Avancerad': 95, 'Elit': 100 };
    const liftsToConsider: (keyof UserStrengthStat)[] = ['squat1RMaxKg', 'benchPress1RMaxKg', 'deadlift1RMaxKg', 'overheadPress1RMaxKg'];
    const liftTypeMap: Partial<Record<keyof UserStrengthStat, LiftType>> = { squat1RMaxKg: 'Knäböj', benchPress1RMaxKg: 'Bänkpress', deadlift1RMaxKg: 'Marklyft', overheadPress1RMaxKg: 'Axelpress' };

    let totalPoints = 0;
    let liftCount = 0;

    for (const liftStatKey of liftsToConsider) {
        const oneRepMax = userStats[liftStatKey] as number | undefined;
        if (oneRepMax !== undefined && oneRepMax > 0) {
            const liftType = liftTypeMap[liftStatKey];
            if (liftType) {
                const levelInfo = getStrengthLevel(liftType, oneRepMax, bodyweight, userProfile.gender, age);
                if (levelInfo) {
                    totalPoints += levelToPoints[levelInfo.level];
                    liftCount++;
                }
            }
        }
    }

    if (liftCount === 0) return null;

    const score = Math.round(totalPoints / liftCount);
    let interpretation = "Okänt";
    if (score < 65) interpretation = "Grundläggande nivå. Bra start!";
    else if (score < 80) interpretation = "Solid grundstyrka!";
    else if (score < 90) interpretation = "Stark! Bra jobbat!";
    else if (score < 98) interpretation = "Mycket stark!";
    else interpretation = "Elitnivå! Imponerande!";

    return { score, interpretation };
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

const ClubProgressDisplay: React.FC<{
  liftType: LiftType;
  currentBodyweight?: number;
  clubMemberships: ParticipantClubMembership[];
  participantId: string;
}> = ({ liftType, currentBodyweight, clubMemberships, participantId }) => {
    const relevantClubs = useMemo(() => {
        return CLUB_DEFINITIONS
            .filter(club => club.liftType === liftType && (club.type === 'LIFT' || club.type === 'BODYWEIGHT_LIFT'))
            .sort((a, b) => (a.threshold || a.multiplier! * 100) - (b.threshold || b.multiplier! * 100));
    }, [liftType]);

    if (relevantClubs.length === 0) return null;

    return (
        <div className="mt-2 space-y-1">
            <h5 className="text-xs font-bold uppercase text-gray-400">Klubbar för {liftType}</h5>
            <div className="flex flex-wrap gap-2">
                {relevantClubs.map(club => {
                    const isAchieved = clubMemberships.some(m => m.clubId === club.id && m.participantId === participantId);
                    let targetValueStr = '';
                    if (club.type === 'LIFT' && club.threshold) {
                        targetValueStr = `${club.threshold} kg`;
                    } else if (club.type === 'BODYWEIGHT_LIFT' && club.multiplier && currentBodyweight) {
                        targetValueStr = `(${Math.round(currentBodyweight * club.multiplier)} kg)`;
                    }

                    return (
                        <div key={club.id} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${isAchieved ? 'bg-green-100 border-green-300 text-green-800' : 'bg-gray-100 border-gray-300 text-gray-600'}`}>
                            {isAchieved && <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                            <span className="font-semibold">{club.name}</span>
                            {targetValueStr && <span className="text-gray-500">{targetValueStr}</span>}
                        </div>
                    );
                })}
            </div>
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
  const latestStats = useMemo(() => strengthStatsHistory.length > 0 ? strengthStatsHistory[strengthStatsHistory.length - 1] : null, [strengthStatsHistory]);

  const [bodyweight, setBodyweight] = useState('');
  const [squat1RMax, setSquat1RMax] = useState('');
  const [benchPress1RMax, setBenchPress1RMax] = useState('');
  const [deadlift1RMax, setDeadlift1RMax] = useState('');
  const [overheadPress1RMax, setOverheadPress1RMax] = useState('');
  
  const [calcWeight, setCalcWeight] = useState('');
  const [calcReps, setCalcReps] = useState('');
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const estimated1RM = useMemo(() => calculateEstimated1RM(calcWeight, calcReps), [calcWeight, calcReps]);

  useEffect(() => {
    // New logic for bodyweight:
    // 1. From latest strength stat if available
    // 2. From profile's direct bodyweight field
    // 3. Fallback to calculating from muscle+fat mass
    // 4. Default to empty
    const bwFromStats = latestStats?.bodyweightKg?.toString();
    const bwFromProfile = profile?.bodyweightKg?.toString();
    const bwFromInBody = (profile?.muscleMassKg && profile?.fatMassKg) ? (profile.muscleMassKg + profile.fatMassKg).toString() : undefined;

    setBodyweight(bwFromStats || bwFromProfile || bwFromInBody || '');

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

  const FssDataForChart = useMemo(() => {
      if (!profile) return [];
      return strengthStatsHistory.map(stat => {
          const scoreData = calculateFlexibelStrengthScoreInternal(stat, profile);
          if (scoreData) {
              return { date: stat.lastUpdated, score: scoreData.score };
          }
          return null;
      }).filter(Boolean) as { date: string, score: number }[];
  }, [strengthStatsHistory, profile]);

  if (!profile || !profile.gender || !profile.age) {
    return <p className="text-center p-4 bg-yellow-100 text-yellow-800 rounded-md">Vänligen fyll i kön och ålder i din profil för att kunna se och jämföra din styrka.</p>;
  }

  const numericBodyweight = bodyweight.trim() ? Number(bodyweight.replace(',', '.')) : 0;
  const numericAge = profile.age ? parseInt(profile.age, 10) : undefined;

  const currentFssScore = calculateFlexibelStrengthScoreInternal({
      bodyweightKg: numericBodyweight,
      squat1RMaxKg: squat1RMax ? Number(squat1RMax.replace(',', '.')) : undefined,
      benchPress1RMaxKg: benchPress1RMax ? Number(benchPress1RMax.replace(',', '.')) : undefined,
      deadlift1RMaxKg: deadlift1RMax ? Number(deadlift1RMax.replace(',', '.')) : undefined,
      overheadPress1RMaxKg: overheadPress1RMax ? Number(overheadPress1RMax.replace(',', '.')) : undefined,
      id: '',
      participantId: profile.id,
      lastUpdated: '',
  }, profile);

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
                {estimated1RM && (
                  <div className="text-center p-2 bg-white rounded-md border">
                    <p className="text-sm text-gray-500">Estimerat 1RM</p>
                    <p className="text-2xl font-bold text-flexibel">{estimated1RM} kg</p>
                  </div>
                )}
                <p className="text-xs text-gray-500 text-center">
                  Baserat på Brzycki-formeln. Mest tillförlitligt för 1-12 reps.
                </p>
                {estimated1RM && (
                  <div className="pt-2 border-t">
                    <p className="text-sm font-medium text-gray-600 mb-2">Använd värdet för:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setSquat1RMax(estimated1RM); validateField(estimated1RM, 'squat1RMaxKg'); }}>Knäböj</Button>
                      <Button variant="outline" size="sm" onClick={() => { setBenchPress1RMax(estimated1RM); validateField(estimated1RM, 'benchPress1RMaxKg'); }}>Bänkpress</Button>
                      <Button variant="outline" size="sm" onClick={() => { setDeadlift1RMax(estimated1RM); validateField(estimated1RM, 'deadlift1RMaxKg'); }}>Marklyft</Button>
                      <Button variant="outline" size="sm" onClick={() => { setOverheadPress1RMax(estimated1RM); validateField(estimated1RM, 'overheadPress1RMaxKg'); }}>Axelpress</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <h3 className="text-xl font-semibold text-gray-700">Dina 1RM (maxlyft för 1 repetition)</h3>
          <Input
            label="Kroppsvikt (kg) *"
            id="bodyweight" name="bodyweight" type="number" step="0.5"
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
                <ClubProgressDisplay 
                    liftType={lift}
                    currentBodyweight={numericBodyweight || undefined}
                    clubMemberships={clubMemberships}
                    participantId={profile.id}
                />
              </div>
            );
          })}
        </div>
        
        {/* Right Column: Results & Graphs */}
        <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-700">Din Styrkenivå</h3>
            {MAIN_LIFTS_CONFIG_HEADER.map(({ lift, statKey }) => {
                const oneRepMax = {
                    squat1RMaxKg: squat1RMax, benchPress1RMaxKg: benchPress1RMax,
                    deadlift1RMaxKg: deadlift1RMax, overheadPress1RMaxKg: overheadPress1RMax
                }[statKey];
                if (!oneRepMax.trim()) return null;

                const numericOneRepMax = Number(oneRepMax.replace(',', '.'));
                if (numericBodyweight <= 0 || numericOneRepMax <= 0) return null;

                const levelInfo = getStrengthLevel(lift, numericOneRepMax, numericBodyweight, profile.gender as GenderOption, numericAge);
                if (!levelInfo) return null;

                return (
                    <div key={lift}>
                        <h4 className="font-semibold text-base">{lift}</h4>
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-1">
                            {levelInfo.standardsForLevel.map(({level, weightKg}, index) => {
                                let widthPercent = 0;
                                if (index === 0) {
                                    widthPercent = (weightKg / levelInfo.standardsForLevel[levelInfo.standardsForLevel.length - 1].weightKg) * 100;
                                } else {
                                    const prevWeight = levelInfo.standardsForLevel[index-1].weightKg;
                                    widthPercent = ((weightKg - prevWeight) / levelInfo.standardsForLevel[levelInfo.standardsForLevel.length - 1].weightKg) * 100;
                                }
                                return (
                                    <div key={level} style={{ width: `${100 / STRENGTH_LEVEL_ORDER.length}%`, backgroundColor: LEVEL_COLORS_HEADER[level] }} className="h-2.5 inline-block first:rounded-l-full last:rounded-r-full" title={`${level}: ${weightKg} kg`}></div>
                                )
                            })}
                            <div style={{left: `${(numericOneRepMax / levelInfo.standardsForLevel[levelInfo.standardsForLevel.length - 1].weightKg) * 100}%` }} className="relative">
                                <div className="absolute -translate-x-1/2 -bottom-3.5 text-center">
                                    <div className="w-0 h-0 border-x-4 border-x-transparent border-b-[6px] border-b-gray-800 mx-auto"></div>
                                    <span className="text-xs font-bold text-gray-800 bg-white px-1 rounded">{numericOneRepMax}</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-sm text-center mt-2 font-medium" style={{color: LEVEL_COLORS_HEADER[levelInfo.level]}}>
                            Nivå: {levelInfo.level}
                        </p>
                    </div>
                )
            })}
            
            {currentFssScore && (
                 <div className="p-3 bg-gray-100 rounded-lg text-center mt-4">
                    <h4 className="text-base font-semibold text-gray-600">Flexibel Strength Score (FSS)</h4>
                    <p className="text-4xl font-bold" style={{color: FLEXIBEL_PRIMARY_COLOR}}>{currentFssScore.score}</p>
                    <p className="text-sm text-gray-500">{currentFssScore.interpretation}</p>
                </div>
            )}
        </div>
      </div>
      
      {/* History Charts Section */}
      <div className="mt-8 pt-6 border-t">
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Historik</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h4 className="font-semibold text-center mb-2">1RM Utveckling</h4>
              <StrengthHistoryChart history={strengthStatsHistory} />
            </div>
            <div>
              <h4 className="font-semibold text-center mb-2">FSS Utveckling</h4>
              <FssHistoryChart history={FssDataForChart} />
            </div>
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