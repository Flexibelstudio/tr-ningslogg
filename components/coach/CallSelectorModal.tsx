import React, { useState, useMemo } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Lead, StaffMember, Location, IntegrationSettings } from '../../types';

interface CallSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  coach: StaffMember | null;
  locations: Location[];
  settings: IntegrationSettings;
  onConfirm: (callerId: string) => void;
}

export const CallSelectorModal: React.FC<CallSelectorModalProps> = ({ isOpen, onClose, lead, coach, locations, settings, onConfirm }) => {
  const [selectedId, setSelectedId] = useState('');

  const options = useMemo(() => {
    const list: { label: string, value: string }[] = [];
    
    // 1. Coach personal
    if (coach?.callerId) {
      list.push({ label: `Mitt mobilnummer (${coach.callerId})`, value: coach.callerId });
    } else if (coach?.phone) {
        list.push({ label: `Mitt mottagningsnummer (${coach.phone})`, value: coach.phone });
    }

    // 2. Studio number if available
    const studio = locations.find(l => l.id === lead?.locationId);
    if (studio?.phone) {
      list.push({ label: `Studions nummer (${studio.phone})`, value: studio.phone });
    }

    // 3. Global verified numbers
    settings.verifiedCallerIds?.forEach(id => {
      if (!list.some(o => o.value === id)) {
        list.push({ label: `Växelnummer (${id})`, value: id });
      }
    });

    return list;
  }, [coach, lead, locations, settings]);

  React.useEffect(() => {
    if (isOpen && options.length > 0) {
      setSelectedId(options[0].value);
    }
  }, [isOpen, options]);

  if (!isOpen || !lead) return null;

  const hasCoachPhone = !!coach?.phone;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Ring upp ${lead.firstName}`}>
      <div className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-lg border">
            <p className="text-sm text-gray-500 uppercase tracking-wide font-bold">Mottagare</p>
            <p className="text-xl font-bold text-gray-800">{lead.firstName} {lead.lastName}</p>
            <p className="text-lg text-flexibel">{lead.phone}</p>
        </div>

        {!hasCoachPhone && (
            <div className="p-4 bg-orange-50 border-l-4 border-orange-500 rounded-r-lg animate-pulse">
                <p className="text-sm font-bold text-orange-800 flex items-center gap-2">
                    <span>⚠️ Mottagningsnummer saknas</span>
                </p>
                <p className="text-xs text-orange-700 mt-1">
                    Du måste lägga till ditt eget telefonnummer under <strong>Personal</strong> (Mottagningsnummer) för att systemet ska veta vilken telefon 46elks ska ringa upp först.
                </p>
            </div>
        )}

        <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">Vilket nummer ska visas för kunden?</label>
            <div className="space-y-2">
                {options.map(opt => (
                    <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedId === opt.value ? 'bg-flexibel/10 border-flexibel' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                        <input 
                            type="radio" 
                            name="callerId" 
                            value={opt.value} 
                            checked={selectedId === opt.value} 
                            onChange={() => setSelectedId(opt.value)}
                            className="h-5 w-5 text-flexibel"
                        />
                        <span className="font-semibold text-gray-800">{opt.label}</span>
                    </label>
                ))}
                {options.length === 0 && (
                    <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded border border-amber-200 italic">
                        Inga Caller IDs verifierade än. Ring med dolt nummer eller lägg till i inställningar.
                    </p>
                )}
            </div>
        </div>

        <div className="pt-4 border-t space-y-4">
            <p className="text-xs text-gray-500 italic leading-relaxed">
                När du klickar på ring kommer 46elks först ringa din mobil ({coach?.phone || 'ej angivet'}). 
                När du svarar kopplas du automatiskt till kunden.
            </p>
            <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={onClose}>Avbryt</Button>
                <Button onClick={() => onConfirm(selectedId)} disabled={!hasCoachPhone}>
                    {hasCoachPhone ? 'Starta samtal via 46elks' : 'Ange mottagningsnummer först'}
                </Button>
            </div>
        </div>
      </div>
    </Modal>
  );
};