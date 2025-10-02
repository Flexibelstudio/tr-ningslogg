import React, { useState, useMemo, useEffect } from 'react';
import { Location } from '../../types';
import { Input, Select } from '../Input';
import { Button } from '../Button';

interface LeadCaptureFormProps {
    locations: Location[];
    onSubmit: (formData: { firstName: string; lastName: string; email: string; phone: string; locationId: string; }) => void;
}

export const LeadCaptureForm: React.FC<LeadCaptureFormProps> = ({ locations, onSubmit }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [locationId, setLocationId] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const locationOptions = useMemo(() => [
        { value: '', label: 'Välj studio/ort...' },
        ...locations.map(loc => ({ value: loc.id, label: loc.name }))
    ], [locations]);
    
    useEffect(() => {
        // If there is only one location, pre-select it.
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
            setIsSubmitting(true);
            onSubmit({ firstName, lastName, email, phone, locationId });
            // The parent component will handle the state change to show success message.
            // No need to setIsSubmitting(false) here if the whole component unmounts.
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <p className="text-lg text-gray-600">Fyll i dina uppgifter nedan så kontaktar vi dig, eller boka en tid direkt på nästa sida.</p>
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
            <Button type="submit" fullWidth size="lg" disabled={isSubmitting}>
                {isSubmitting ? 'Skickar...' : 'Skicka intresseanmälan'}
            </Button>
        </form>
    );
};
