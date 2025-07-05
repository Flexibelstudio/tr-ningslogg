

import React, { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Input } from '../Input';
import { Button } from '../Button';
import { ParticipantConditioningStats } from '../../types';

interface ConditioningStatsFormProps {
  currentStats: ParticipantConditioningStats | null;
  onSaveStats: (statsData: ParticipantConditioningStats) => void;
  participantId: string | undefined; 
  // onCancel prop is removed as the parent FixedHeaderAndTools will handle closing.
}

export interface ConditioningStatsFormRef {
  submitForm: () => boolean;
}

export const ConditioningStatsForm = forwardRef<ConditioningStatsFormRef, ConditioningStatsFormProps>(({
  currentStats,
  onSaveStats,
  participantId,
}, ref) => {
  const [airbike4MinTest, setAirbike4MinTest] = useState('');
  const [skierg4MinMeters, setSkierg4MinMeters] = useState('');
  const [rower4MinMeters, setRower4MinMeters] = useState('');
  const [treadmill4MinMeters, setTreadmill4MinMeters] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    setAirbike4MinTest(currentStats?.airbike4MinTest || '');
    setSkierg4MinMeters(currentStats?.skierg4MinMeters?.toString() || '');
    setRower4MinMeters(currentStats?.rower4MinMeters?.toString() || '');
    setTreadmill4MinMeters(currentStats?.treadmill4MinMeters?.toString() || '');
    setErrors({});
  }, [currentStats]);

  const validateNumericInput = useCallback((value: string, fieldName: string): boolean => {
    if (value.trim() === '') { // Allow empty strings, they will be saved as undefined
       setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName];
        return newErrors;
      });
      return true;
    }
    const num = Number(value);
    if (isNaN(num) || num < 0) {
      setErrors(prev => ({ ...prev, [fieldName]: 'Ogiltigt värde. Ange ett positivt tal eller lämna tomt.' }));
      return false;
    }
    // No integer check for meters, allow decimals if needed, but current inputs are "number" type
    // which might imply integers depending on step. For now, just positive.
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
    return true;
  }, []);


  const handleSave = useCallback(() => {
    let validForm = true;
    // Airbike is free text, no numeric validation here.
    if (!validateNumericInput(skierg4MinMeters, 'skierg4MinMeters')) validForm = false;
    if (!validateNumericInput(rower4MinMeters, 'rower4MinMeters')) validForm = false;
    if (!validateNumericInput(treadmill4MinMeters, 'treadmill4MinMeters')) validForm = false;
    
    if (!validForm) {
        alert("Var god korrigera felen i formuläret för konditionstester.");
        return false;
    }
    
    if (!participantId && !currentStats?.id) { // Check if we can form an ID
        alert("Kan inte spara konditionsstatus, deltagar-ID saknas. Ange profilinformation först.");
        return false;
    }

    onSaveStats({
      id: currentStats?.id || participantId!, // participantId must exist if currentStats.id doesn't
      airbike4MinTest: airbike4MinTest.trim() || undefined,
      skierg4MinMeters: skierg4MinMeters.trim() ? skierg4MinMeters : undefined,
      rower4MinMeters: rower4MinMeters.trim() ? rower4MinMeters : undefined,
      treadmill4MinMeters: treadmill4MinMeters.trim() ? treadmill4MinMeters : undefined,
      lastUpdated: new Date().toISOString(),
    });
    return true;
  }, [airbike4MinTest, skierg4MinMeters, rower4MinMeters, treadmill4MinMeters, currentStats, participantId, onSaveStats, validateNumericInput]);

  useImperativeHandle(ref, () => ({
    submitForm: () => {
      return handleSave();
    }
  }));

  return (
    <div className="space-y-6 py-4">
      <p className="text-sm text-gray-600">
        Ange 4-min max-effort resultat. Följ din konditionsutveckling.
      </p>
      
      <div className="space-y-4 pt-4">
        <Input
          label="Airbike (4 min)"
          id="airbike-result-form"
          name="airbikeResult"
          value={airbike4MinTest}
          onChange={(e) => setAirbike4MinTest(e.target.value)}
          placeholder="T.ex. 65 kcal eller 1200 m"
          // No specific numeric validation for airbike as it can be text
        />
        <Input
          label="Skierg (m, 4 min)"
          id="skierg-meters-form"
          name="skiergMeters"
          type="number"
          inputMode="numeric"
          value={skierg4MinMeters}
          onChange={(e) => { setSkierg4MinMeters(e.target.value); validateNumericInput(e.target.value, 'skierg4MinMeters');}}
          placeholder="T.ex. 1050"
          min="0"
          error={errors.skierg4MinMeters}
        />
        <Input
          label="Rodd (m, 4 min)"
          id="rower-meters-form"
          name="rowerMeters"
          type="number"
          inputMode="numeric"
          value={rower4MinMeters}
          onChange={(e) => { setRower4MinMeters(e.target.value); validateNumericInput(e.target.value, 'rower4MinMeters'); }}
          placeholder="T.ex. 1150"
          min="0"
          error={errors.rower4MinMeters}
        />
        <Input
          label="Löpband (m, 4 min)"
          id="treadmill-meters-form"
          name="treadmillMeters"
          type="number"
          inputMode="numeric"
          value={treadmill4MinMeters}
          onChange={(e) => { setTreadmill4MinMeters(e.target.value); validateNumericInput(e.target.value, 'treadmill4MinMeters');}}
          placeholder="T.ex. 950"
          min="0"
          error={errors.treadmill4MinMeters}
        />
      </div>

      {/* Save and Cancel buttons are removed from here. Parent will provide a single save button. */}
    </div>
  );
});

ConditioningStatsForm.displayName = 'ConditioningStatsForm';
