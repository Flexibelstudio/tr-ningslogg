import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Lead, StaffMember, SmsTemplate, Location } from '../../types';

interface SmsTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  coach: StaffMember | null;
  templates: SmsTemplate[];
  locations: Location[];
  onConfirm: (content: string, templateName: string) => void;
}

export const SmsTemplateModal: React.FC<SmsTemplateModalProps> = ({ isOpen, onClose, lead, coach, templates, locations, onConfirm }) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  const currentTemplate = useMemo(() => 
    templates.find(t => t.id === selectedTemplateId) || null
  , [selectedTemplateId, templates]);

  const studioName = useMemo(() => 
    locations.find(l => l.id === lead?.locationId)?.name || 'Flexibel'
  , [locations, lead]);

  const previewText = useMemo(() => {
    if (!currentTemplate || !lead) return '';
    let text = currentTemplate.content;
    text = text.replace(/\{\{namn\}\}/g, lead.firstName);
    text = text.replace(/\{\{coach\}\}/g, coach?.name?.split(' ')[0] || 'Din coach');
    text = text.replace(/\{\{studio\}\}/g, studioName);
    return text;
  }, [currentTemplate, lead, coach, studioName]);

  useEffect(() => {
    if (isOpen && templates.length > 0) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [isOpen, templates]);

  if (!isOpen || !lead) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Skicka SMS till ${lead.firstName}`}>
      <div className="space-y-6">
        <div>
            <label className="block text-sm font-bold text-gray-700 mb-3">Välj en mall</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1">
                {templates.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setSelectedTemplateId(t.id)}
                        className={`text-left p-3 rounded-xl border-2 transition-all ${selectedTemplateId === t.id ? 'bg-flexibel/10 border-flexibel' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                    >
                        <p className="font-bold text-gray-800 text-sm">{t.name}</p>
                    </button>
                ))}
            </div>
            {templates.length === 0 && (
                 <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded border border-amber-200 italic">
                    Inga SMS-mallar skapade. Gå till Inställningar för att lägga till.
                </p>
            )}
        </div>

        {currentTemplate && (
            <div className="space-y-3 animate-fade-in">
                <p className="text-sm font-bold text-gray-700">Förhandsgranskning</p>
                <div className="bg-gray-100 p-4 rounded-2xl relative">
                    <div className="bg-white p-3 rounded-2xl rounded-bl-none shadow-sm text-gray-800 text-base border border-gray-200">
                        {previewText}
                    </div>
                    <div className="absolute left-[-5px] bottom-0 w-4 h-4 bg-gray-100 rounded-full"></div>
                </div>
                <p className="text-[10px] text-gray-400 text-right">Ca {Math.ceil(previewText.length / 160)} SMS-enheter</p>
            </div>
        )}

        <div className="pt-4 border-t flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Avbryt</Button>
            <Button 
                onClick={() => onConfirm(previewText, currentTemplate?.name || 'Anpassat')} 
                disabled={!previewText || !lead.phone}
            >
                Skicka via 46elks
            </Button>
        </div>
      </div>
    </Modal>
  );
};