
import React, { useState, useMemo, useEffect } from 'react';
import { Location } from '../../types';
import { Input, Select } from '../Input';
import { Button } from '../Button';

interface LeadCaptureFormProps {
    locations: Location[];
    onSubmit: (formData: { firstName: string; lastName: string; email: string; phone: string; locationId: string; }) => void;
    isSubmitting: boolean;
}

export const LeadCaptureForm: React.FC<LeadCaptureFormProps> = ({ locations, onSubmit, isSubmitting }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [locationId, setLocationId] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const locationOptions = useMemo(() => [
        { value: '', label: 'Välj studio/ort...' },
        ...locations.map(loc => ({ value: loc.id, label: loc.name }))
    ], [locations]);
    
    useEffect(() => {
        // Om det bara finns en ort, förvälj den.
        if (locations.length === 1) {
            setLocationId(locations[0].id);
        }
    }, [locations]);

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!firstName.trim()) newErrors.firstName = "Förnamn är obligatoriskt.";
        if (!lastName.trim()) newErrors.lastName = "Efternamn är obligatoriskt.";
        if (!email.trim()) newErrors.email = "E-post är obligatoriskt.";
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            newErrors.email = "Ogiltig e-postadress.";
        }
        if (!locationId) newErrors.locationId = "Du måste välja en studio/ort.";
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            onSubmit({ firstName, lastName, email, phone, locationId });
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Input
                    label="Förnamn *"
                    id="lead-firstname"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    error={errors.firstName}
                    required
                />
                <Input
                    label="Efternamn *"
                    id="lead-lastname"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    error={errors.lastName}
                    required
                />
            </div>
            <Input
                label="E-post *"
                id="lead-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                error={errors.email}
                required
            />
            <Input
                label="Mobilnummer"
                id="lead-phone"
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                error={errors.phone}
            />
            <Select
                label="Studio/Ort *"
                id="lead-location"
                value={locationId}
                onChange={e => setLocationId(e.target.value)}
                options={locationOptions}
                error={errors.locationId}
                required
            />
            <Button type="submit" fullWidth size="lg" disabled={isSubmitting} className="h-12 text-lg">
                {isSubmitting ? (
                    <div className="flex items-center justify-center gap-2">
                         <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                         <span>Bearbetar...</span>
                    </div>
                ) : 'Gå vidare till bokning'}
            </Button>
        </form>
    );
};
