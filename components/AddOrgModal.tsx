import React, { useState } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';

interface AddOrgModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string) => Promise<void>;
    existingOrgNames: string[];
}

export const AddOrgModal: React.FC<AddOrgModalProps> = ({ isOpen, onClose, onSave, existingOrgNames }) => {
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            setError('Organisationsnamn kan inte vara tomt.');
            return;
        }
        if (existingOrgNames.some(orgName => orgName.toLowerCase() === trimmedName.toLowerCase())) {
            setError('En organisation med detta namn finns redan.');
            return;
        }

        setError('');
        setIsSaving(true);
        try {
            await onSave(trimmedName);
            // The parent component is responsible for closing the modal on success
        } catch (e) {
            // Error is handled/alerted in parent, but we should re-enable the button.
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Lägg till ny Organisation">
            <div className="space-y-4">
                <Input
                    label="Organisationsnamn"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(''); }}
                    error={error}
                    placeholder="T.ex. Flexibel Göteborg"
                    required
                />
                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Button onClick={onClose} variant="secondary" disabled={isSaving}>Avbryt</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Sparar...' : 'Spara Organisation'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
