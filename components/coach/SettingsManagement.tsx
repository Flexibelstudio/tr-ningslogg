import React, { useState, useMemo, useEffect, useRef } from 'react';
import { StaffMember, IntegrationSettings, Location, Membership, WorkoutCategoryDefinition } from '../../types';
import { Input, Select } from '../Input';
import { useAppContext } from '../../context/AppContext';
import { ToggleSwitch } from '../ToggleSwitch';
import { Button } from '../Button';
import { Modal } from '../Modal';
import { Textarea } from '../Textarea';
import { ConfirmationModal } from '../ConfirmationModal';
import QRCode from 'qrcode';

const Card: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
    <div className={`bg-white p-6 rounded-lg shadow-md ${className}`}>
        <h3 className="text-2xl font-bold text-gray-800 mb-4">{title}</h3>
        {children}
    </div>
);

const BrandingManager: React.FC = () => {
    const { branding, setBrandingData } = useAppContext();
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64String = e.target?.result as string;
            setBrandingData(prev => ({ ...prev, logoBase64: base64String }));
        };
        reader.readAsDataURL(file);
    };

    const handleRemoveLogo = () => {
        setBrandingData(prev => {
            if (!prev) return undefined;
            const { logoBase64, ...rest } = prev;
            return rest;
        });
    };

    return (
        <Card title="Varumärkesprofil">
            <p className="text-base text-gray-600 mb-2">Nuvarande Logotyp</p>
            {branding?.logoBase64 ? (
                <div className="border p-2 rounded-md inline-block">
                    <img src={branding.logoBase64} alt="Nuvarande logotyp" className="max-h-20" />
                </div>
            ) : (
                <p className="text-gray-500 italic">Ingen logotyp uppladdad.</p>
            )}
            <div className="flex gap-2 mt-4">
                <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/png, image/jpeg, image/svg+xml" className="hidden" />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Välj ny bild...</Button>
                {branding?.logoBase64 && <Button variant="danger" onClick={handleRemoveLogo}>Ta bort logotyp</Button>}
            </div>
        </Card>
    );
};


const ModuleSettingsManager: React.FC = () => {
    const { integrationSettings, setIntegrationSettingsData, workoutCategories } = useAppContext();

    const handleSettingChange = (field: keyof IntegrationSettings, value: any) => {
        setIntegrationSettingsData(prev => ({ ...prev, [field]: value }));
    };

    const categoryOptions = useMemo(() => [
        { value: '', label: 'Välj en kategori...' },
        ...workoutCategories.map(c => ({ value: c.id, label: c.name }))
      ], [workoutCategories]);

    return (
        <Card title="Modulinställningar">
            <div className="space-y-4">
                <ToggleSwitch
                    id="client-journey-toggle"
                    checked={integrationSettings.isClientJourneyEnabled ?? true}
                    onChange={(val) => handleSettingChange('isClientJourneyEnabled', val)}
                    label="Aktivera Klientresan"
                    description="Visar 'Klientresan'-vyn för att proaktivt följa upp medlemmar."
                />
                <ToggleSwitch
                    id="booking-toggle"
                    checked={integrationSettings.isBookingEnabled}
                    onChange={(val) => handleSettingChange('isBookingEnabled', val)}
                    label="Aktivera Bokningssystem"
                    description="Aktiverar bokningskalendern och relaterade funktioner för både coacher och medlemmar. Detta är avsett för grupp-pass (träning, yoga etc)."
                />
                <ToggleSwitch
                    id="schedule-toggle"
                    checked={integrationSettings.isScheduleEnabled ?? true}
                    onChange={(val) => handleSettingChange('isScheduleEnabled', val)}
                    label="Aktivera Schema"
                    description="Visar schemaläggningskalendern inuti 'Personal & Schema'-vyn."
                />

                <div className="pt-6 border-t">
                    <h4 className="text-xl font-bold text-gray-700 mb-2">Startprogram</h4>
                    <p className="text-base text-gray-600 mb-4">
                        Styr vilket program nya medlemmar ska genomföra.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select
                        label="Startprogram Kategori"
                        value={integrationSettings.startProgramCategoryId || ''}
                        onChange={(e) => handleSettingChange('startProgramCategoryId', e.target.value)}
                        options={categoryOptions}
                        />
                        <Input
                        label="Antal pass att slutföra"
                        type="number"
                        min="1"
                        step="1"
                        value={integrationSettings.startProgramSessionsRequired || ''}
                        onChange={(e) => handleSettingChange('startProgramSessionsRequired', e.target.value === '' ? undefined : Number(e.target.value))}
                        placeholder="T.ex. 4"
                        />
                    </div>
                </div>
            </div>
        </Card>
    );
};


const LocationManager: React.FC = () => {
    const { locations, setLocationsData, participantDirectory, staffMembers } = useAppContext();
    const [newLocation, setNewLocation] = useState('');
    const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);

    const handleAdd = () => {
        if (newLocation.trim() && !locations.some(l => l.name.toLowerCase() === newLocation.trim().toLowerCase())) {
            setLocationsData(prev => [...prev, { id: crypto.randomUUID(), name: newLocation.trim() }]);
            setNewLocation('');
        }
    };

    const handleDelete = (location: Location) => {
        const isUsed = participantDirectory.some(p => p.locationId === location.id) || staffMembers.some(s => s.locationId === location.id);
        if (isUsed) {
            alert(`Kan inte ta bort orten "${location.name}" eftersom den används av medlemmar eller personal.`);
        } else {
            setLocationToDelete(location);
        }
    };
    
    const confirmDelete = () => {
        if(locationToDelete) {
            setLocationsData(prev => prev.filter(l => l.id !== locationToDelete.id));
        }
        setLocationToDelete(null);
    }

    return (
        <>
            <Card title="Hantera Orter">
                <div className="space-y-4">
                    <div>
                        <label htmlFor="new-location" className="block text-base font-medium text-gray-700 mb-1">Ny Ort</label>
                        <div className="flex gap-2">
                            <Input id="new-location" value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="T.ex. Stockholm" />
                            <Button onClick={handleAdd}>Lägg till</Button>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-base font-medium text-gray-700 mb-2">Befintliga Orter</h4>
                        <div className="space-y-2">
                            {locations.map(loc => (
                                <div key={loc.id} className="flex justify-between items-center p-2 bg-gray-100 rounded-md">
                                    <span className="text-gray-800">{loc.name}</span>
                                    <Button variant="danger" size="sm" className="!p-1.5" onClick={() => handleDelete(loc)}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>
            <ConfirmationModal 
                isOpen={!!locationToDelete}
                onClose={() => setLocationToDelete(null)}
                onConfirm={confirmDelete}
                title={`Ta bort orten ${locationToDelete?.name}?`}
                message="Är du säker? Detta kan inte ångras."
                confirmButtonText="Ja, ta bort"
            />
        </>
    );
};

const WorkoutCategoryManager: React.FC = () => {
    const { workoutCategories, setWorkoutCategoriesData, workouts, memberships } = useAppContext();
    const [newCategory, setNewCategory] = useState('');
    const [categoryToDelete, setCategoryToDelete] = useState<WorkoutCategoryDefinition | null>(null);

    const handleAdd = () => {
        if (newCategory.trim() && !workoutCategories.some(c => c.name.toLowerCase() === newCategory.trim().toLowerCase())) {
            setWorkoutCategoriesData(prev => [...prev, { id: crypto.randomUUID(), name: newCategory.trim() }]);
            setNewCategory('');
        }
    };
    
    const handleDelete = (category: WorkoutCategoryDefinition) => {
        const isUsedInWorkouts = workouts.some(w => w.category === category.name);
        const isUsedInMemberships = memberships.some(m => m.restrictedCategories?.includes(category.name) || m.clipCardCategories?.includes(category.name));
        if (isUsedInWorkouts || isUsedInMemberships) {
            alert(`Kan inte ta bort kategorin "${category.name}" eftersom den används av pass eller medlemskap.`);
        } else {
            setCategoryToDelete(category);
        }
    };

    const confirmDelete = () => {
        if (categoryToDelete) {
            setWorkoutCategoriesData(prev => prev.filter(c => c.id !== categoryToDelete.id));
        }
        setCategoryToDelete(null);
    }

    return (
        <>
            <Card title="Hantera Passkategorier">
                 <div className="space-y-4">
                    <div>
                        <label htmlFor="new-category" className="block text-base font-medium text-gray-700 mb-1">Ny Kategori</label>
                        <div className="flex gap-2">
                            <Input id="new-category" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="T.ex. Kondition" />
                            <Button onClick={handleAdd}>Lägg till</Button>
                        </div>
                    </div>
                    <div>
                        <h4 className="text-base font-medium text-gray-700 mb-2">Befintliga Kategorier</h4>
                        <div className="space-y-2">
                            {workoutCategories.map(cat => (
                                <div key={cat.id} className="flex justify-between items-center p-2 bg-gray-100 rounded-md">
                                    <span className="text-gray-800">{cat.name}</span>
                                    <Button variant="danger" size="sm" className="!p-1.5" onClick={() => handleDelete(cat)}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </Card>
            <ConfirmationModal 
                isOpen={!!categoryToDelete}
                onClose={() => setCategoryToDelete(null)}
                onConfirm={confirmDelete}
                title={`Ta bort kategorin ${categoryToDelete?.name}?`}
                message="Är du säker? Detta kan inte ångras."
                confirmButtonText="Ja, ta bort"
            />
        </>
    );
};

const QRCodeManager: React.FC = () => {
    const { locations } = useAppContext();
    const [selectedLocationId, setSelectedLocationId] = useState<string>(locations[0]?.id || '');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (selectedLocationId && canvasRef.current) {
            const data = JSON.stringify({ type: 'flexibel-checkin', locationId: selectedLocationId });
            QRCode.toCanvas(canvasRef.current, data, { width: 256, margin: 2 }, (error) => {
                if (error) console.error(error);
            });
        }
    }, [selectedLocationId]);

    const locationName = locations.find(l => l.id === selectedLocationId)?.name || 'Okänd Ort';

    const handlePrint = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow?.document.write('<html><head><title>QR-kod för Incheckning</title>');
        printWindow?.document.write('<style>body { text-align: center; font-family: sans-serif; } h1 { font-size: 24px; } canvas { width: 80%; max-width: 400px; height: auto; }</style>');
        printWindow?.document.write('</head><body >');
        printWindow?.document.write(`<h1>Checka in på ${locationName}</h1>`);
        printWindow?.document.write('<img src="' + canvas.toDataURL() + '" />');
        printWindow?.document.write('</body></html>');
        printWindow?.document.close();
        printWindow?.focus();
        setTimeout(() => { // Timeout to ensure content is loaded
            printWindow?.print();
            printWindow?.close();
        }, 250);
    };


    return (
        <Card title="QR-kod för Incheckning">
            <Select
                label="Välj ort för QR-kod"
                value={selectedLocationId}
                onChange={e => setSelectedLocationId(e.target.value)}
                options={locations.map(l => ({ value: l.id, label: l.name }))}
            />
            {selectedLocationId && (
                <div className="mt-4 text-center space-y-4">
                    <p className="font-semibold text-xl">Checka in på {locationName}</p>
                    <canvas ref={canvasRef} className="mx-auto" />
                    <Button onClick={handlePrint}>Skriv ut / Spara som PDF</Button>
                </div>
            )}
        </Card>
    );
};

// Simplified MembershipModal for brevity
const MembershipModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (membership: Membership) => void;
    membershipToEdit: Membership | null;
    workoutCategories: WorkoutCategoryDefinition[];
}> = ({ isOpen, onClose, onSave, membershipToEdit, workoutCategories }) => {
    const [formState, setFormState] = useState<Partial<Membership>>({});

    useEffect(() => {
        setFormState(membershipToEdit || { type: 'subscription' });
    }, [membershipToEdit, isOpen]);

    const handleChange = (field: keyof Membership, value: any) => {
        setFormState(p => ({ ...p, [field]: value }));
    };

    const handleCategoryToggle = (categoryName: string, type: 'restrictedCategories' | 'clipCardCategories') => {
        const currentCategories = formState[type] || [];
        const newCategories = currentCategories.includes(categoryName)
            ? currentCategories.filter(c => c !== categoryName)
            : [...currentCategories, categoryName];
        handleChange(type, newCategories);
    };

    const handleSave = () => {
        if (!formState.name) return;
        onSave({
            id: formState.id || crypto.randomUUID(),
            name: formState.name,
            description: formState.description,
            type: formState.type,
            restrictedCategories: formState.type === 'subscription' ? formState.restrictedCategories : undefined,
            clipCardClips: formState.type === 'clip_card' ? Number(formState.clipCardClips) || undefined : undefined,
            clipCardValidityDays: formState.type === 'clip_card' ? Number(formState.clipCardValidityDays) || undefined : undefined,
            clipCardCategories: formState.type === 'clip_card' ? formState.clipCardCategories : undefined,
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={membershipToEdit ? 'Redigera Medlemskap' : 'Nytt Medlemskap'}>
            <div className="space-y-4">
                <Input label="Namn *" value={formState.name || ''} onChange={e => handleChange('name', e.target.value)} />
                <Textarea label="Beskrivning" value={formState.description || ''} onChange={e => handleChange('description', e.target.value)} rows={2} />
                <Select label="Typ" value={formState.type || 'subscription'} onChange={e => handleChange('type', e.target.value as any)} options={[{value: 'subscription', label: 'Löpande'}, {value: 'clip_card', label: 'Klippkort'}]} />
                
                {formState.type === 'subscription' && (
                    <div className="p-2 border rounded-md">
                        <label className="font-medium">Begränsa från passkategorier:</label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                           {workoutCategories.map(cat => (
                               <label key={cat.id} className="flex items-center gap-2"><input type="checkbox" checked={formState.restrictedCategories?.includes(cat.name)} onChange={() => handleCategoryToggle(cat.name, 'restrictedCategories')} /> {cat.name}</label>
                           ))}
                        </div>
                    </div>
                )}

                {formState.type === 'clip_card' && (
                    <div className="p-2 border rounded-md space-y-2">
                         <Input type="number" label="Antal klipp" value={String(formState.clipCardClips || '')} onChange={e => handleChange('clipCardClips', e.target.value)} />
                         <Input type="number" label="Giltighet (dagar, lämna tomt för obegränsad)" value={String(formState.clipCardValidityDays || '')} onChange={e => handleChange('clipCardValidityDays', e.target.value)} />
                    </div>
                )}
                 <div className="flex justify-end gap-2 pt-4 border-t"><Button variant="secondary" onClick={onClose}>Avbryt</Button><Button onClick={handleSave}>Spara</Button></div>
            </div>
        </Modal>
    );
};

const MembershipManager: React.FC = () => {
    const { memberships, setMembershipsData, workoutCategories, participantDirectory } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMembership, setEditingMembership] = useState<Membership | null>(null);
    const [membershipToDelete, setMembershipToDelete] = useState<Membership | null>(null);

    const handleSave = (membership: Membership) => {
        setMembershipsData(prev => {
            const index = prev.findIndex(m => m.id === membership.id);
            if (index > -1) {
                const newMemberships = [...prev];
                newMemberships[index] = membership;
                return newMemberships;
            }
            return [...prev, membership];
        });
    };

    const handleDelete = (membership: Membership) => {
        if (participantDirectory.some(p => p.membershipId === membership.id)) {
            alert(`Kan inte ta bort "${membership.name}" eftersom det används av medlemmar.`);
        } else {
            setMembershipToDelete(membership);
        }
    };
    
    const confirmDelete = () => {
        if(membershipToDelete) {
            setMembershipsData(prev => prev.filter(m => m.id !== membershipToDelete.id));
        }
        setMembershipToDelete(null);
    }
    
    return (
        <>
            <Card title="Hantera Medlemskap">
                <div className="flex justify-end mb-4">
                    <Button onClick={() => { setEditingMembership(null); setIsModalOpen(true); }}>Nytt Medlemskap</Button>
                </div>
                <div className="space-y-3">
                    {memberships.map(mem => {
                        const descriptionParts: string[] = [];
                        if(mem.type === 'subscription' && mem.restrictedCategories?.length) {
                            descriptionParts.push(`Begränsad från: ${mem.restrictedCategories.join(', ')}`);
                        }
                        if(mem.type === 'clip_card') {
                            descriptionParts.push(`${mem.clipCardClips} klipp, giltigt ${mem.clipCardValidityDays || 'obegränsad tid'} dagar.`);
                        }

                        return (
                            <div key={mem.id} className="p-3 border rounded-md">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-800">{mem.name}</h4>
                                        <p className="text-sm text-gray-600">{mem.description || 'Ingen beskrivning.'}</p>
                                        {descriptionParts.map((part, i) => <p key={i} className={`text-sm ${part.toLowerCase().includes('begränsad') ? 'text-red-600' : 'text-gray-600'}`}>{part}</p>)}
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <Button variant="outline" size="sm" onClick={() => {setEditingMembership(mem); setIsModalOpen(true);}}>Redigera</Button>
                                        <Button variant="danger" size="sm" className="!p-1.5" onClick={() => handleDelete(mem)}><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></Button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </Card>
            <MembershipModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSave} membershipToEdit={editingMembership} workoutCategories={workoutCategories} />
            <ConfirmationModal 
                isOpen={!!membershipToDelete}
                onClose={() => setMembershipToDelete(null)}
                onConfirm={confirmDelete}
                title={`Ta bort medlemskapet ${membershipToDelete?.name}?`}
                message="Är du säker? Detta kan inte ångras."
                confirmButtonText="Ja, ta bort"
            />
        </>
    )
}

export const SettingsManagement: React.FC<{ loggedInStaff: StaffMember | null }> = ({ loggedInStaff }) => {
    if (loggedInStaff?.role !== 'Admin') {
        return <div className="p-4 bg-yellow-100 text-yellow-800 rounded-md">Du måste vara administratör för att se inställningarna.</div>;
    }
    
    return (
        <div className="space-y-6">
            <BrandingManager />
            <ModuleSettingsManager />
            <LocationManager />
            <MembershipManager />
            <WorkoutCategoryManager />
            <QRCodeManager />
        </div>
    );
};
