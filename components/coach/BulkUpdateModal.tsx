
import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { Select } from '../Input';
import { Button } from '../Button';
import { Location, Membership } from '../../types';

export type BulkActionType = 'membership' | 'status' | 'location';

interface BulkUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (value: string) => void;
    action: BulkActionType;
    memberCount: number;
    locations: Location[];
    memberships: Membership[];
}

export const BulkUpdateModal: React.FC<BulkUpdateModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    action,
    memberCount,
    locations,
    memberships
}) => {
    const [selectedValue, setSelectedValue] = useState('');

    const config = {
        membership: {
            title: `Ändra medlemskap för ${memberCount} medlemmar`,
            label: 'Nytt medlemskap',
            options: [{ value: '', label: 'Välj medlemskap...' }, ...memberships.map(m => ({ value: m.id, label: m.name }))],
        },
        location: {
            title: `Ändra ort för ${memberCount} medlemmar`,
            label: 'Ny ort',
            options: [{ value: '', label: 'Välj ort...' }, ...locations.map(l => ({ value: l.id, label: l.name }))],
        },
        status: {
            title: `Ändra status för ${memberCount} medlemmar`,
            label: 'Ny status',
            options: [
                { value: '', label: 'Välj status...' },
                { value: 'active', label: 'Aktiv' },
                { value: 'inactive', label: 'Inaktiv' },
            ],
        },
    };

    const currentConfig = config[action];

    useEffect(() => {
        if (isOpen) {
            setSelectedValue(''); // Reset to default on open
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={currentConfig.title}>
            <div className="space-y-4">
                <Select
                    label={currentConfig.label}
                    value={selectedValue}
                    onChange={(e) => setSelectedValue(e.target.value)}
                    options={currentConfig.options}
                    required
                />
                <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Button onClick={onClose} variant="secondary">Avbryt</Button>
                    <Button onClick={() => onConfirm(selectedValue)} variant="primary" disabled={!selectedValue}>
                        Uppdatera
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
