import React, { useState, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { ParticipantProfile, UserStrengthStat, StrengthStandard, LiftType, StrengthLevel, StrengthStandardDetail, AllUserProvidedStrengthMultipliers, GenderOption, ParticipantGoalData } from '../../types';
import { STRENGTH_STANDARDS_DATA, STRENGTH_LEVEL_ORDER, USER_PROVIDED_STRENGTH_MULTIPLIERS, FLEXIBEL_PRIMARY_COLOR } from '../../constants';
import { Input } from '../Input';
import { Button } from '../Button';
import { getPassRecommendations } from '../../utils/passRecommendationHelper';
import { StrengthHistoryChart } from './StrengthHistoryChart';
import { FssHistoryChart } from './FssHistoryChart';

// Icons
const SquatIcon = () => <span className="mr-2 text-xl" role="img" aria-label="Knäböj">🏋️</span>;
const BenchPressIcon = () => <span className="mr-2 text-xl" role="img" aria-label="Bänkpress">⚖️</span>;
const DeadliftIcon = () => <span className="mr-2 text-xl" role="img" aria-label="Marklyft">🏋️</span>;
const OverheadPressIcon = () => <span className="mr-2 text-xl" role="img" aria-label="Axelpress">💪</span>;

const LIFT_CONFIG: { lift: LiftType, label: string, icon: () => JSX.Element, statKey: keyof UserStrengthStat }[] = [
    { lift: 'Knäböj', label: 'Knäböj 1RM (kg)', icon: SquatIcon, statKey: 'squat1RMaxKg'},
    { lift: 'Bänkpress', label: 'Bänkpress 1RM (kg)', icon: BenchPressIcon, statKey: 'benchPress1RMaxKg'},
    { lift: 'Marklyft', label: 'Marklyft 1RM (kg)', icon: DeadliftIcon, statKey: 'deadlift1RMaxKg'},
    { lift: 'Axelpress', label: 'Axelpress 1RM (kg)', icon: OverheadPressIcon, statKey: 'overheadPress1RMaxKg'},
];

interface StrengthComparisonToolProps {
  profile: ParticipantProfile | null;
  strengthStatsHistory: UserStrengthStat[];
  latestGoal: ParticipantGoalData | null; 
  onSaveStrengthStats: (stats: UserStrengthStat) => void;
  isEmbedded?: boolean; 
}

export interface StrengthComparisonToolRef {
  submitForm: () => boolean;
}

interface CalculatedLevelResult {
  lift: LiftType;
  user1RM?: number; 
  effectiveUser1RM?: number; 
  level?: StrengthLevel;
  levelColor?: string;
  nextLevelGoal?: string; 
  standardsForBodyweight?: StrengthStandardDetail[];
  achievedStandardWeight?: number; 
  nextStandardWeight?: number;
  bodyweightCategoryForDisplay?: string; 
}

// This interface is now for the assembled result in the component
export interface FlexibelStrengthScoreResult {
  score: number;
  interpretationText: string;
  recommendations: { name: string; motivation: string }[];
  retestText: string;
}

// Type for the internal calculation function's return value
interface FSSCalculationOutput {
  score: number;
  interpretationText: string;
  retestText: string;
}


const LEVEL_COLORS: { [key in StrengthLevel]: string } = {
  'Otränad': '#ef4444', // red-500
  'Nybörjare': '#f97316', // orange-500
  'Medelgod': '#eab308', // yellow-500
  'Avancerad': '#84cc16', // lime-500
  'Elit': '#14b8a6', // teal-500
};

const getAgeAdjustmentFactor = (
    age: number | undefined,
    lift: LiftType,
    gender: GenderOption | undefined,
    multipliers: AllUserProvidedStrengthMultipliers
): number => {
    if (!age || !gender || (gender !== 'Man' && gender !== 'Kvinna') ) return 1.0;

    const liftKey = lift.toLowerCase() as keyof AllUserProvidedStrengthMultipliers;
    if (!multipliers[liftKey]) {
        return 1.0;
    }
    const liftData = multipliers[liftKey];

    const genderKey = gender === 'Man' ? 'män' : 'kvinnor';
    const genderSpecificMultipliers = liftData[genderKey];

    if (!genderSpecificMultipliers || !genderSpecificMultipliers.justering) return 1.0;
    const ageAdjustments = genderSpecificMultipliers.justering;
    const ageRanges = Object.keys(ageAdjustments).sort((a,b) => parseInt(a.split('-')[0],10) - parseInt(b.split('-')[0],10));

    if (ageRanges.length > 0) {
        const firstRangeMinAge = parseInt(ageRanges[0].split('-')[0], 10);
        if (age < firstRangeMinAge) return 1.0;
    } else {
        return 1.0;
    }

    for (const range of ageRanges) {
        const [minAge, maxAge] = range.split('-').map(Number);
        if (age >= minAge && age <= maxAge) {
            return ageAdjustments[range as keyof typeof ageAdjustments.justering];
        }
    }
    
    if (ageRanges.length > 0) {
        const lastRangeMaxAge = parseInt(ageRanges[ageRanges.length - 1].split('-')[1], 10);
        if (age > lastRangeMaxAge) {
            return ageAdjustments[ageRanges[ageRanges.length - 1] as keyof typeof ageAdjustments.justering];
        }
    }
    return 1.0;
};


export const calculateFlexibelStrengthScoreInternal = ( 
  bwKg: number,
  rmSquat: number,
  rmDeadlift: number,
  rmBench: number,
  rmOverhead: number
): FSSCalculationOutput | null => { 
  if (bwKg <= 0 || rmSquat < 0 || rmDeadlift < 0 || rmBench < 0 || rmOverhead < 0) {
    return null;
  }

  const percSquat = (rmSquat / bwKg) * 100;
  const percDeadlift = (rmDeadlift / bwKg) * 100;
  const percBench = (rmBench / bwKg) * 100;
  const percOverhead = (rmOverhead / bwKg) * 100;

  const deltaSquat = percSquat - 100;
  const deltaDeadlift = percDeadlift - 100;
  const deltaBench = percBench - 100;
  const deltaOverhead = percOverhead - 100;

  const score =
    80 +
    0.3 * deltaSquat +
    0.3 * deltaDeadlift +
    0.2 * deltaBench +
    0.2 * deltaOverhead;

  const roundedScore = parseFloat(score.toFixed(1));

  let interpretationText: string;
  if (roundedScore > 90) interpretationText = "Mycket stark – optimal hälsa!";
  else if (roundedScore >= 80) interpretationText = "Stark och balanserad!";
  else if (roundedScore >= 70) interpretationText = "Bra, potential att utvecklas!";
  else interpretationText = "Fokuserad styrketräning behövs.";
  
  const retestText = "Gör gärna ett nytt test om 6–8 veckor för att följa din utveckling!";

  return {
    score: roundedScore,
    interpretationText,
    retestText,
  };
};

const formatBodyweightCategoryDisplay = (category?: { min: number, max: number }): string => {
  if (!category) return "N/A";
  return `${category.min}-${category.max} kg`;
};


export const StrengthComparisonTool = forwardRef<StrengthComparisonToolRef, StrengthComparisonToolProps>(({
  profile,
  strengthStatsHistory,
  latestGoal, 
  onSaveStrengthStats,
  isEmbedded,
}, ref) => {
  const latestStats = useMemo(() => strengthStatsHistory.length > 0 ? strengthStatsHistory[strengthStatsHistory.length - 1] : null, [strengthStatsHistory]);
  
  const [bodyweight, setBodyweight] = useState<string>(latestStats?.bodyweightKg?.toString() || '');
  const [oneRMs, setOneRMs] = useState<{[key in LiftType]?: string}>(() => {
    const initialRMs: {[key in LiftType]?: string} = {};
    LIFT_CONFIG.forEach(config => {
        const val = latestStats?.[config.statKey] as number | undefined;
        if (val !== undefined) initialRMs[config.lift] = val.toString();
        else initialRMs[config.lift] = '';
    });
    return initialRMs;
  });
  const [inputErrors, setInputErrors] = useState<{[key:string]: string}>({});

  useEffect(() => {
    const latestStats = strengthStatsHistory.length > 0 ? strengthStatsHistory[strengthStatsHistory.length - 1] : null;
    setBodyweight(latestStats?.bodyweightKg?.toString() || '');
    const newRMs: {[key in LiftType]?: string} = {};
    LIFT_CONFIG.forEach(config => {
        const val = latestStats?.[config.statKey] as number | undefined;
        if (val !== undefined) newRMs[config.lift] = val.toString();
        else newRMs[config.lift] = '';
    });
    setOneRMs(newRMs);
    setInputErrors({}); 
  }, [strengthStatsHistory]);

  const validateNumericInput = useCallback((value: string, fieldName: string, allowEmpty: boolean = true, isInteger: boolean = false, minVal: number = 0): boolean => {
    if (value.trim() === '' && allowEmpty) {
      setInputErrors(prev => ({...prev, [fieldName]: ''}));
      return true;
    }
    if (value.trim() === '') {
      setInputErrors(prev => ({...prev, [fieldName]: 'Fältet får inte vara tomt.'}));
      return false;
    }

    const num = Number(value);
    if (isNaN(num)) {
      setInputErrors(prev => ({...prev, [fieldName]: 'Ange ett giltigt tal.'}));
      return false;
    }
    if (num < minVal) {
      setInputErrors(prev => ({...prev, [fieldName]: `Värdet måste vara minst ${minVal}.`}));
      return false;
    }
    if (isInteger && !Number.isInteger(num)) {
      setInputErrors(prev => ({...prev, [fieldName]: 'Ange ett heltal.'}));
      return false;
    }
    if (!isInteger && (num * 10) % 5 !== 0 && fieldName !== 'bodyweight') { 
      setInputErrors(prev => ({...prev, [fieldName]: 'Vikt måste anges i hela eller halva kilon (t.ex. 100 eller 100.5).'}));
      return false;
    }
    setInputErrors(prev => ({...prev, [fieldName]: ''}));
    return true;
  }, []);

  const handleBodyweightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBodyweight(val);
    validateNumericInput(val, 'bodyweight', false, false, 1);
  };

  const handle1RMChange = (lift: LiftType, value: string) => {
    setOneRMs(prev => ({...prev, [lift]: value}));
    validateNumericInput(value, lift, true, false, 0);
  };

  const genderSetForComparison = useMemo(() => {
    return profile?.gender && (profile.gender === 'Man' || profile.gender === 'Kvinna');
  }, [profile]);

  const calculatedLevels = useMemo<CalculatedLevelResult[]>(() => {
    const results: CalculatedLevelResult[] = [];
    const bwKg = parseFloat(bodyweight);
    const userAge = profile?.age ? parseInt(profile.age, 10) : undefined;
    const userGender = profile?.gender;

    if (!genderSetForComparison || isNaN(bwKg) || bwKg <= 0) {
      return LIFT_CONFIG.map(lc => ({ lift: lc.lift, user1RM: oneRMs[lc.lift] ? parseFloat(oneRMs[lc.lift]!) : undefined }));
    }

    LIFT_CONFIG.forEach(config => {
      const lift = config.lift;
      const raw1RMStr = oneRMs[lift];
      const raw1RM = raw1RMStr ? parseFloat(raw1RMStr) : undefined;

      if (raw1RM === undefined || isNaN(raw1RM) || raw1RM < 0) {
        results.push({ lift });
        return;
      }

      const ageFactor = getAgeAdjustmentFactor(userAge, lift, userGender, USER_PROVIDED_STRENGTH_MULTIPLIERS);
      const effective1RM = parseFloat((raw1RM / ageFactor).toFixed(2)); 

      const relevantStandards = STRENGTH_STANDARDS_DATA.filter(
        s => s.lift === lift && s.gender === userGender
      );

      if (relevantStandards.length === 0) {
        results.push({ lift, user1RM: raw1RM, effectiveUser1RM: effective1RM });
        return;
      }

      let bestMatchStandardSet: StrengthStandard | undefined = relevantStandards.reduce((best, current) => {
          if (!best) return current;
          const currentFits = bwKg >= current.bodyweightCategoryKg.min && bwKg <= current.bodyweightCategoryKg.max;
          const bestFits = bwKg >= best.bodyweightCategoryKg.min && bwKg <= best.bodyweightCategoryKg.max;

          if (currentFits && !bestFits) return current;
          if (!currentFits && bestFits) return best;
          if (!currentFits && !bestFits) { 
             const bestMid = (best.bodyweightCategoryKg.min + best.bodyweightCategoryKg.max) / 2;
             const currentMid = (current.bodyweightCategoryKg.min + current.bodyweightCategoryKg.max) / 2;
             return Math.abs(bwKg - currentMid) < Math.abs(bwKg - bestMid) ? current : best;
          }
          return current; 
      }, undefined as StrengthStandard | undefined);
      
      if (!bestMatchStandardSet) { 
         bestMatchStandardSet = relevantStandards.sort((a,b) => {
            const aDist = Math.min(Math.abs(bwKg - a.bodyweightCategoryKg.min), Math.abs(bwKg - a.bodyweightCategoryKg.max));
            const bDist = Math.min(Math.abs(bwKg - b.bodyweightCategoryKg.min), Math.abs(bwKg - b.bodyweightCategoryKg.max));
            return aDist - bDist;
        })[0];
      }
      
      if (!bestMatchStandardSet) {
          results.push({ lift, user1RM: raw1RM, effectiveUser1RM: effective1RM });
          return;
      }

      const standardsForBodyweight = [...bestMatchStandardSet.standards].sort(
        (a, b) => STRENGTH_LEVEL_ORDER.indexOf(a.level) - STRENGTH_LEVEL_ORDER.indexOf(b.level)
      );

      let currentLevel: StrengthLevel = 'Otränad';
      let achievedStandardWeight: number | undefined;
      let nextLevelGoal: string | undefined;
      let nextStandardWeight : number | undefined;

      for (let i = standardsForBodyweight.length - 1; i >= 0; i--) {
        if (effective1RM >= standardsForBodyweight[i].weightKg) {
          currentLevel = standardsForBodyweight[i].level;
          achievedStandardWeight = standardsForBodyweight[i].weightKg;
          const nextLevelIndex = STRENGTH_LEVEL_ORDER.indexOf(currentLevel) + 1;
          if (nextLevelIndex < STRENGTH_LEVEL_ORDER.length) {
            const nextLevelDetails = standardsForBodyweight.find(s => s.level === STRENGTH_LEVEL_ORDER[nextLevelIndex]);
            if (nextLevelDetails) {
              nextLevelGoal = `${nextLevelDetails.weightKg} kg för ${nextLevelDetails.level}`;
              nextStandardWeight = nextLevelDetails.weightKg;
            }
          }
          break;
        }
      }
      if (achievedStandardWeight === undefined && standardsForBodyweight.length > 0) { 
           const otranadDetails = standardsForBodyweight[0];
           nextLevelGoal = `${otranadDetails.weightKg} kg för ${otranadDetails.level}`;
           nextStandardWeight = otranadDetails.weightKg;
      }

      results.push({
        lift,
        user1RM: raw1RM,
        effectiveUser1RM: effective1RM,
        level: currentLevel,
        levelColor: LEVEL_COLORS[currentLevel],
        nextLevelGoal,
        standardsForBodyweight,
        achievedStandardWeight,
        nextStandardWeight,
        bodyweightCategoryForDisplay: formatBodyweightCategoryDisplay(bestMatchStandardSet.bodyweightCategoryKg),
      });
    });
    return results;
  }, [bodyweight, oneRMs, profile, genderSetForComparison]);


  const flexibelStrengthScoreData = useMemo<FlexibelStrengthScoreResult | null>(() => {
    const bw = parseFloat(bodyweight);
    const squat = parseFloat(oneRMs['Knäböj'] || '');
    const deadlift = parseFloat(oneRMs['Marklyft'] || '');
    const bench = parseFloat(oneRMs['Bänkpress'] || '');
    const overhead = parseFloat(oneRMs['Axelpress'] || '');

    if (isNaN(bw) || bw <= 0 || isNaN(squat) || squat < 0 || isNaN(deadlift) || deadlift < 0 || isNaN(bench) || bench < 0 || isNaN(overhead) || overhead < 0) {
      return null;
    }
    const scoreCalcOutput = calculateFlexibelStrengthScoreInternal(bw, squat, deadlift, bench, overhead);
    if (!scoreCalcOutput) return null;

    const recommendations = getPassRecommendations(
        scoreCalcOutput.score,
        latestGoal?.fitnessGoals,
        latestGoal?.preferences
    );

    return {
        ...scoreCalcOutput,
        recommendations
    };
  }, [bodyweight, oneRMs, latestGoal]);

  const fssHistoryData = useMemo(() => {
    return strengthStatsHistory.map(stat => {
        const { bodyweightKg, squat1RMaxKg, deadlift1RMaxKg, benchPress1RMaxKg, overheadPress1RMaxKg, lastUpdated } = stat;
        if (bodyweightKg && bodyweightKg > 0 && squat1RMaxKg && deadlift1RMaxKg && benchPress1RMaxKg && overheadPress1RMaxKg) {
            const scoreCalc = calculateFlexibelStrengthScoreInternal(
                bodyweightKg,
                squat1RMaxKg,
                deadlift1RMaxKg,
                benchPress1RMaxKg,
                overheadPress1RMaxKg
            );
            if (scoreCalc) {
                return { date: lastUpdated, score: scoreCalc.score };
            }
        }
        return null;
    }).filter((item): item is { date: string, score: number } => item !== null);
  }, [strengthStatsHistory]);

  const handleSave = useCallback(() => {
    let isValid = true;
    if (!validateNumericInput(bodyweight, 'bodyweight', false, false, 1)) isValid = false;
    LIFT_CONFIG.forEach(config => {
        if (!validateNumericInput(oneRMs[config.lift] || '', config.lift, true, false, 0)) isValid = false;
    });

    if (!isValid) {
      alert("Var god korrigera felen i formuläret för styrka.");
      return false;
    }
    
    if (!profile) {
        alert("Profilinformation saknas. Kan inte spara styrkestatus.");
        return false;
    }

    const newStatEntry: UserStrengthStat = {
      id: profile.id, // ID remains consistent for the user
      bodyweightKg: parseFloat(bodyweight) || undefined,
      squat1RMaxKg: parseFloat(oneRMs['Knäböj'] || '') || undefined,
      benchPress1RMaxKg: parseFloat(oneRMs['Bänkpress'] || '') || undefined,
      deadlift1RMaxKg: parseFloat(oneRMs['Marklyft'] || '') || undefined,
      overheadPress1RMaxKg: parseFloat(oneRMs['Axelpress'] || '') || undefined,
      lastUpdated: new Date().toISOString(),
    };
    onSaveStrengthStats(newStatEntry);
    return true;
  }, [bodyweight, oneRMs, profile, onSaveStrengthStats, validateNumericInput]);

  useImperativeHandle(ref, () => ({
    submitForm: () => {
      return handleSave();
    }
  }));

  const canSave = useMemo(() => {
    return Object.values(inputErrors).every(err => err === '') && bodyweight.trim() !== '' && !isNaN(parseFloat(bodyweight)) && parseFloat(bodyweight) > 0;
  }, [inputErrors, bodyweight]);

  return (
    <div className={`space-y-6 ${!isEmbedded ? 'p-4 bg-white rounded-lg shadow-xl' : 'py-4'}`}>
      {!isEmbedded && <h3 className="text-2xl font-semibold text-gray-800 mb-4" style={{color: FLEXIBEL_PRIMARY_COLOR}}>Jämför Styrka</h3>}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <Input
          label="Kroppsvikt (kg) *"
          type="number"
          id="bodyweight"
          value={bodyweight}
          onChange={handleBodyweightChange}
          placeholder="T.ex. 75.5"
          error={inputErrors.bodyweight}
          min="1"
          step="0.1" 
          required
        />
        {profile?.age && (
            <div className="text-base text-gray-600 bg-gray-100 p-3 rounded-md md:mt-7">
                <p>Din ålder: <span className="font-semibold">{profile.age} år</span>.</p>
                <p className="text-sm">1RM justeras för ålder i nivåbedömning.</p>
            </div>
        )}
      </div>

      {!genderSetForComparison && (
        <div className={`p-3 rounded-md text-center text-base ${isEmbedded ? 'bg-yellow-50 text-yellow-800 border border-yellow-300' : 'bg-red-100 text-red-700 border border-red-300'}`}>
          <p>
            Ange kön i profil för nivåer. 1RM & Score sparas ändå.
          </p>
        </div>
      )}

      {strengthStatsHistory && strengthStatsHistory.length > 1 && (
        <div className="mt-6 pt-4 border-t">
          <h4 className="text-xl font-semibold text-gray-700 mb-3">Din Utveckling</h4>
          <StrengthHistoryChart history={strengthStatsHistory} />
        </div>
      )}

      <div className="space-y-6 pt-4">
        {LIFT_CONFIG.map(config => {
          const result = calculatedLevels.find(r => r.lift === config.lift);
          const currentOneRM = oneRMs[config.lift] || '';
          return (
            <div key={config.lift} className="p-4 border rounded-lg bg-gray-50/50 shadow-sm">
              <h4 className="text-xl font-semibold text-gray-700 mb-3 flex items-center">
                {config.icon()} {config.lift}
              </h4>
              <Input
                label={config.label}
                type="number"
                id={config.lift}
                value={currentOneRM}
                onChange={(e) => handle1RMChange(config.lift, e.target.value)}
                placeholder="Ditt max (1 rep)"
                error={inputErrors[config.lift]}
                min="0"
                step="0.5"
              />
              {genderSetForComparison && result && bodyweight && parseFloat(bodyweight)>0 && currentOneRM && parseFloat(currentOneRM) >=0 && (
                <div className="mt-4 space-y-2 text-base">
                  {result.effectiveUser1RM !== undefined && result.user1RM !== result.effectiveUser1RM && (
                     <p className="text-sm text-gray-500">
                       Justerat 1RM (ålder): <span className="font-semibold">{result.effectiveUser1RM.toFixed(1)} kg</span>
                       {result.user1RM && result.user1RM > result.effectiveUser1RM ? ` (högre pga åldersfaktor)` : result.user1RM && result.user1RM < result.effectiveUser1RM ? ` (lägre pga åldersfaktor)`: ''}
                    </p>
                  )}
                  {result.level && (
                    <div className="flex items-center">
                        <p className="text-base mr-2">Din nivå:</p>
                        <span 
                            className="font-semibold px-2 py-0.5 rounded-full text-sm" 
                            style={{ backgroundColor: `${result.levelColor}20`, color: result.levelColor }}
                        >
                            {result.level}
                        </span>
                    </div>
                  )}
                  {result.nextLevelGoal && (
                    <p>Nästa nivå: <span className="font-semibold text-flexibel">{result.nextLevelGoal}</span></p>
                  )}

                  {result.achievedStandardWeight !== undefined && result.effectiveUser1RM !== undefined && result.nextStandardWeight !== undefined && result.level !== 'Elit' && (
                    <div className="mt-2">
                      <div className="flex justify-between text-sm text-gray-500 mb-0.5">
                        <span>{result.level === 'Otränad' && result.effectiveUser1RM < result.achievedStandardWeight ? '0 kg' : result.achievedStandardWeight?.toFixed(0) + ' kg'}</span>
                        <span>{result.nextStandardWeight?.toFixed(0)} kg</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-flexibel h-2.5 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${Math.min(100, Math.max(0, ((result.effectiveUser1RM - (result.level === 'Otränad' && result.effectiveUser1RM < result.achievedStandardWeight ? 0 : result.achievedStandardWeight)) / (result.nextStandardWeight - (result.level === 'Otränad' && result.effectiveUser1RM < result.achievedStandardWeight ? 0 : result.achievedStandardWeight)) * 100)))}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {result.standardsForBodyweight && result.standardsForBodyweight.length > 0 && (
                     <details className="mt-3 text-sm">
                        <summary className="cursor-pointer text-flexibel hover:underline">Standarder ({result.bodyweightCategoryForDisplay || 'N/A'})</summary>
                        <ul className="mt-1 pl-2 text-sm">
                        {result.standardsForBodyweight.map(s => (
                            <li key={s.level}><span className="font-medium">{s.level}:</span> {s.weightKg} kg</li>
                        ))}
                        </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
       {/* Flexibel Strength Score Section */}
       {flexibelStrengthScoreData && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h4 className="text-2xl font-semibold text-center mb-4" style={{color: FLEXIBEL_PRIMARY_COLOR}}>Flexibel Strength Score</h4>
          <div className="text-center mb-4">
            <span className="text-6xl font-bold" style={{color: FLEXIBEL_PRIMARY_COLOR}}>{flexibelStrengthScoreData.score}</span>
            <p className="text-xl text-gray-700 font-medium">{flexibelStrengthScoreData.interpretationText}</p>
            <p className="text-sm text-gray-500 mt-1">{flexibelStrengthScoreData.retestText}</p>
            {fssHistoryData && fssHistoryData.length > 1 && (
                <FssHistoryChart history={fssHistoryData} />
            )}
          </div>
          {flexibelStrengthScoreData.recommendations && flexibelStrengthScoreData.recommendations.length > 0 && (
            <div>
              <h5 className="text-lg font-semibold text-gray-700 mb-2">Rekommenderade Pass:</h5>
              <ul className="space-y-2">
                {flexibelStrengthScoreData.recommendations.map((rec, index) => (
                  <li key={index} className="p-3 bg-teal-50 border border-teal-200 rounded-md">
                    <p className="font-semibold text-teal-700">{rec.name}</p>
                    <p className="text-sm text-gray-600">{rec.motivation}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}


      {/* The save button is removed from here if isEmbedded is true, handled by parent */}
      {!isEmbedded && ( 
        <div className="mt-8 pt-6 border-t">
          <Button onClick={handleSave} disabled={!canSave} fullWidth>
            Spara Styrkestatus
          </Button>
        </div>
      )}
    </div>
  );
});

StrengthComparisonTool.displayName = 'StrengthComparisonTool';