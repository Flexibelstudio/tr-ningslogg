import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input, Select } from '../Input';
import { Textarea } from '../Textarea';
import { ProspectIntroCall } from '../../types';
import { useAppContext } from '../../context/AppContext';
import { REFERRAL_SOURCE_OPTIONS, INTRO_CALL_OUTCOME_OPTIONS } from '../../constants';

interface IntroCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (introCall: Omit<ProspectIntroCall, 'id' | 'createdDate' | 'status' | 'coachId'>) => void;
  introCallToEdit?: ProspectIntroCall | null;
  onUpdate?: (introCall: ProspectIntroCall) => void;
  initialData?: Partial<Omit<ProspectIntroCall, 'id' | 'createdDate' | 'status' | 'coachId'>>;
}

export const IntroCallModal: React.FC<IntroCallModalProps> = ({ isOpen, onClose, onSave, introCallToEdit, onUpdate, initialData }) => {
  const { locations } = useAppContext();

  // State for all new form fields
  const [prospectName, setProspectName] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [studioId, setStudioId] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [referralSourceOther, setReferralSourceOther] = useState('');

  const [trainingGoals, setTrainingGoals] = useState('');
  const [timingNotes, setTimingNotes] = useState('');
  const [engagementLevel, setEngagementLevel] = useState<number | undefined>(undefined);
  const [engagementReason, setEngagementReason] = useState('');
  
  const [sleepAndStress, setSleepAndStress] = useState('');
  const [isSickListed, setIsSickListed] = useState<boolean | undefined>(undefined);
  const [healthIssues, setHealthIssues] = useState('');
  
  const [whyNeedHelp, setWhyNeedHelp] = useState('');
  const [coachSummary, setCoachSummary] = useState('');

  const [outcome, setOutcome] = useState<ProspectIntroCall['outcome']>(undefined);
  const [tshirtHandedOut, setTshirtHandedOut] = useState(false);
  
  const [error, setError] = useState('');

  const isEditing = !!introCallToEdit;

  const resetForm = () => {
    setProspectName('');
    setProspectEmail('');
    setProspectPhone('');
    setStudioId(locations.length > 0 ? locations[0].id : '');
    setReferralSource('');
    setReferralSourceOther('');
    setTrainingGoals('');
    setTimingNotes('');
    setEngagementLevel(undefined);
    setEngagementReason('');
    setSleepAndStress('');
    setIsSickListed(undefined);
    setHealthIssues('');
    setWhyNeedHelp('');
    setCoachSummary('');
    setOutcome(undefined);
    setTshirtHandedOut(false);
    setError('');
  };

  useEffect(() => {
    if (isOpen) {
      if (introCallToEdit) {
        setProspectName(introCallToEdit.prospectName);
        setProspectEmail(introCallToEdit.prospectEmail || '');
        setProspectPhone(introCallToEdit.prospectPhone || '');
        setStudioId(introCallToEdit.studioId || '');
        setTrainingGoals(introCallToEdit.trainingGoals || '');
        setTimingNotes(introCallToEdit.timingNotes || '');
        setEngagementLevel(introCallToEdit.engagementLevel);
        setEngagementReason(introCallToEdit.engagementReason || '');
        setSleepAndStress(introCallToEdit.sleepAndStress || '');
        setIsSickListed(introCallToEdit.isSickListed);
        setHealthIssues(introCallToEdit.healthIssues || '');
        setWhyNeedHelp(introCallToEdit.whyNeedHelp || '');
        setCoachSummary(introCallToEdit.coachSummary || '');
        setOutcome(introCallToEdit.outcome);
        setTshirtHandedOut(introCallToEdit.tshirtHandedOut || false);

        const source = introCallToEdit.referralSource;
        if (source) {
            const isPredefined = REFERRAL_SOURCE_OPTIONS.some(opt => opt.value === source && opt.value !== 'Annat');
            if (isPredefined) {
                setReferralSource(source);
                setReferralSourceOther('');
            } else {
                setReferralSource('Annat');
                setReferralSourceOther(source);
            }
        } else {
            setReferralSource('');
            setReferralSourceOther('');
        }
      } else if (initialData) {
        setProspectName(initialData.prospectName || '');
        setProspectEmail(initialData.prospectEmail || '');
        setProspectPhone(initialData.prospectPhone || '');
        // Reset other fields as initialData only has basic info
        setStudioId(locations.length > 0 ? locations[0].id : '');
        setReferralSource('');
        setReferralSourceOther('');
        setTrainingGoals('');
        setTimingNotes('');
        setEngagementLevel(undefined);
        setEngagementReason('');
        setSleepAndStress('');
        setIsSickListed(undefined);
        setHealthIssues('');
        setWhyNeedHelp('');
        setCoachSummary('');
        setOutcome(undefined);
        setTshirtHandedOut(false);
      } else {
        resetForm();
      }
      setError('');
    }
  }, [isOpen, introCallToEdit, initialData, locations]);

  const handleSave = () => {
    if (!prospectName.trim() || !studioId) {
      setError('Namn och studio är obligatoriska.');
      return;
    }
    setError('');

    const finalReferralSource = referralSource === 'Annat'
        ? (referralSourceOther.trim() || undefined)
        : (referralSource || undefined);

    const callData = {
      prospectName: prospectName.trim(),
      prospectEmail: prospectEmail.trim() || undefined,
      prospectPhone: prospectPhone.trim() || undefined,
      studioId,
      referralSource: finalReferralSource,
      trainingGoals: trainingGoals.trim() || undefined,
      timingNotes: timingNotes.trim() || undefined,
      engagementLevel,
      engagementReason: engagementReason.trim() || undefined,
      sleepAndStress: sleepAndStress.trim() || undefined,
      isSickListed,
      healthIssues: healthIssues.trim() || undefined,
      whyNeedHelp: whyNeedHelp.trim() || undefined,
      coachSummary: coachSummary.trim() || undefined,
      outcome,
      tshirtHandedOut: outcome === 'bought_starter' ? tshirtHandedOut : undefined,
    };

    if (isEditing && onUpdate && introCallToEdit) {
      onUpdate({ ...introCallToEdit, ...callData });
    } else {
      onSave(callData);
    }
    onClose();
  };
  
  const modalTitle = isEditing ? 'Redigera Introsamtal' : 'Nytt Introsamtal';
  const locationOptions = locations.map(loc => ({ value: loc.id, label: loc.name }));

  const engagementScale = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} size="3xl">
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-4 -mr-4">
        {error && <p className="text-red-500 bg-red-100 p-3 rounded-md">{error}</p>}
        
        {/* Grunduppgifter */}
        <div className="p-4 border rounded-lg bg-gray-50/50 space-y-4">
            <h3 className="text-xl font-semibold text-gray-800">Grunduppgifter</h3>
            <Input label="Namn (för- och efternamn) *" value={prospectName} onChange={(e) => setProspectName(e.target.value)} required />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="E-post" type="email" value={prospectEmail} onChange={(e) => setProspectEmail(e.target.value)} />
                <Input label="Telefonnummer" type="tel" value={prospectPhone} onChange={(e) => setProspectPhone(e.target.value)} />
            </div>
            <div>
              <p className="block text-base font-medium text-gray-700 mb-1">Studio *</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {locationOptions.map(loc => (
                  <label key={loc.value} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="studio" value={loc.value} checked={studioId === loc.value} onChange={e => setStudioId(e.target.value)} className="h-5 w-5 text-flexibel" />
                    <span className="text-lg">{loc.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
                <p className="block text-base font-medium text-gray-700 mb-2">Hur hittade du oss?</p>
                <div className="space-y-2">
                    {REFERRAL_SOURCE_OPTIONS.map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="referralSource"
                                value={opt.value}
                                checked={referralSource === opt.value}
                                onChange={() => setReferralSource(opt.value)}
                                className="h-5 w-5 text-flexibel"
                            />
                            <span className="text-base">{opt.label}</span>
                        </label>
                    ))}
                    {referralSource === 'Annat' && (
                        <div className="pl-7 pt-1 animate-fade-in-down">
                            <Input
                                placeholder="Vänligen specificera..."
                                value={referralSourceOther}
                                onChange={e => setReferralSourceOther(e.target.value)}
                                inputSize="sm"
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
        
        {/* Bakgrund & Motivation */}
        <div className="p-4 border rounded-lg bg-gray-50/50 space-y-4">
            <h3 className="text-xl font-semibold text-gray-800">Bakgrund & Motivation</h3>
            <Textarea label="1. Träningsmål & 'Varför'" value={trainingGoals} onChange={e => setTrainingGoals(e.target.value)} rows={4} placeholder="Vad vill du uppnå? (OBJEKTIVA MÅL) Försök att fråga 'vad mer' för att få fler svar/mål och använd tekniken '5 varför' för att få veta varför personen t ex vill gå ner 5 kg osv. Gräv verkligen in i personens motivation." />
            <Textarea label="2. Timing - 'Varför just nu?'" value={timingNotes} onChange={e => setTimingNotes(e.target.value)} rows={3} placeholder="Varför är just nu rätt tid att göra detta? Du klickade på vår annons, men varför nu? Varför inte för sex veckor eller sex månader sedan? Varför nu? (Hitta personens motivation)" />
            <div>
              <label className="block text-base font-medium text-gray-700 mb-2">3A. Från 1 till 10, hur engagerad är du för att verkligen göra denna förändring?</label>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="radiogroup">
                {engagementScale.map(num => (
                  <label key={num} className="flex flex-col items-center gap-1 cursor-pointer">
                    <span className="text-sm">{num}</span>
                    <input type="radio" name="engagement" value={num} checked={engagementLevel === num} onChange={() => setEngagementLevel(num)} className="h-5 w-5 text-flexibel" />
                  </label>
                ))}
              </div>
            </div>
            <Textarea label="3B. Om kunden inte säger 10: Om 8 eller 9, Vad hindrar dig från att säga 10? om 2 - 7, varför sa du inte en lägre siffra?" value={engagementReason} onChange={e => setEngagementReason(e.target.value)} rows={3} />
        </div>

        {/* Livsstil & Hälsa */}
        <div className="p-4 border rounded-lg bg-gray-50/50 space-y-4">
            <h3 className="text-xl font-semibold text-gray-800">Livsstil & Hälsa</h3>
            <Textarea label="4. Sömn & Stress" value={sleepAndStress} onChange={e => setSleepAndStress(e.target.value)} rows={3} placeholder={'ÖVERGÅNG: "Okej, toppen! Låt mig få lite mer information från dig."\n"Hur många timmar sover du? När går du och lägger dig och när vaknar du?"\n"Känner du dig stressad" (inre/yttre stress)'} />
            <div>
              <p className="block text-base font-medium text-gray-700 mb-1">5. "Har du de senaste 12 månaderna varit sjukskriven?"</p>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="sicklisted" value="yes" checked={isSickListed === true} onChange={() => setIsSickListed(true)} className="h-5 w-5 text-flexibel" />
                  <span className="text-lg">Ja</span>
                </label>
                 <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="sicklisted" value="no" checked={isSickListed === false} onChange={() => setIsSickListed(false)} className="h-5 w-5 text-flexibel" />
                  <span className="text-lg">Nej</span>
                </label>
              </div>
            </div>
            <Textarea label={'6 & 7. "Tar du någon medicin för tillfället?" & "Har du några skador eller hälsoproblem?"'} value={healthIssues} onChange={e => setHealthIssues(e.target.value)} rows={3} />
        </div>

        {/* Avslutning */}
        <div className="p-4 border rounded-lg bg-gray-50/50 space-y-4">
            <h3 className="text-xl font-semibold text-gray-800">Avslutning & Nästa Steg</h3>
            <Textarea label={'8. Sista stora frågan: Varför kan du inte göra detta själv? Varför behöver du vår hjälp?'} value={whyNeedHelp} onChange={e => setWhyNeedHelp(e.target.value)} rows={3} />
            <Textarea label="Coachanteckningar & Rekommendation" value={coachSummary} onChange={e => setCoachSummary(e.target.value)} rows={4} placeholder={'Namnlös rubrik\n"Okej, låt mig bara sammanfatta ..."\n(IDENTIFIERA BEHOV: RUTOR 1, 2 och 9)\n"Stämmer det?"\n"Okej, låt mig visa dig hur vi gör saker." Gå igenom din rekommendation och fyll även i det nedan. Växla mellan denna sidan och prislistan.'} />
        </div>

        {/* Resultat & Nästa Steg */}
        <div className="p-4 border rounded-lg bg-violet-50/50 space-y-4">
            <h3 className="text-xl font-semibold text-gray-800">Resultat & Nästa Steg</h3>
            <div>
                <p className="block text-base font-medium text-gray-700 mb-2">Vad blev resultatet av samtalet?</p>
                <div className="space-y-2">
                    {INTRO_CALL_OUTCOME_OPTIONS.map(opt => (
                        <label key={opt.value} className="flex items-center gap-2 cursor-pointer p-2 rounded-md hover:bg-violet-100">
                            <input
                                type="radio"
                                name="outcome"
                                value={opt.value}
                                checked={outcome === opt.value}
                                onChange={() => setOutcome(opt.value)}
                                className="h-5 w-5 text-flexibel"
                            />
                            <span className="text-base">{opt.label}</span>
                        </label>
                    ))}
                </div>
            </div>
            
            {outcome === 'bought_starter' && (
                <div className="pl-2 pt-2 border-t border-violet-200 animate-fade-in-down">
                    <label className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-violet-100">
                        <input
                            type="checkbox"
                            checked={tshirtHandedOut}
                            onChange={(e) => setTshirtHandedOut(e.target.checked)}
                            className="h-6 w-6 text-flexibel border-gray-300 rounded focus:ring-flexibel"
                        />
                        <span className="text-base font-medium text-gray-700">T-shirt utlämnad</span>
                    </label>
                </div>
            )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6 border-t mt-6">
        <Button onClick={onClose} variant="secondary">Avbryt</Button>
        <Button onClick={handleSave} variant="primary">{isEditing ? 'Spara Ändringar' : 'Spara Introsamtal'}</Button>
      </div>
    </Modal>
  );
};