import React, { useState, useEffect, useRef } from 'react';
import { Location, Membership, Workout, WorkoutCategory, WorkoutCategoryDefinition, ParticipantProfile, IntegrationSettings, StaffMember } from '../../types';
import { Input, Select } from '../Input';
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { ConfirmationModal } from '../ConfirmationModal';
import { Modal } from '../Modal';
import { MemberImport } from './MemberImport';
import { ToggleSwitch } from '../ToggleSwitch';
import QRCode from 'qrcode';
import { useAppContext } from '../../context/AppContext';

interface SettingsManagementProps {
  loggedInStaff: StaffMember | null;
}

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
);


const LocationManager: React.FC<{locations: Location[], setLocations: (updater: Location[] | ((prev: Location[]) => Location[])) => void}> = ({ locations, setLocations }) => {
    const [newLocationName, setNewLocationName] = useState('');
    const [error, setError] = useState('');
    const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);

    const handleAddLocation = () => {
        const trimmedName = newLocationName.trim();
        if (!trimmedName) {
            setError('Ortsnamn kan inte vara tomt.');
            return;
        }
        if (locations.some(loc => loc.name.toLowerCase() === trimmedName.toLowerCase())) {
            setError('Denna ort finns redan.');
            return;
        }

        const newLocation: Location = {
            id: crypto.randomUUID(),
            name: trimmedName,
        };
        setLocations(prev => [...prev, newLocation].sort((a,b) => a.name.localeCompare(b.name)));
        setNewLocationName('');
        setError('');
    };

    const handleDeleteLocation = () => {
        if (!locationToDelete) return;
        setLocations(prev => prev.filter(loc => loc.id !== locationToDelete.id));
        setLocationToDelete(null);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Hantera Orter</h3>
            <div className="space-y-4">
                <div className="flex items-end gap-2">
                    <Input 
                        label="Ny Ort"
                        value={newLocationName}
                        onChange={(e) => { setNewLocationName(e.target.value); setError(''); }}
                        placeholder="T.ex. Stockholm"
                        error={error}
                        inputSize="sm"
                    />
                    <Button onClick={handleAddLocation} size="sm" className="flex-shrink-0">Lägg till</Button>
                </div>
                
                <div className="pt-4 border-t">
                    <h4 className="text-lg font-semibold text-gray-700 mb-2">Befintliga Orter</h4>
                    {locations.length > 0 ? (
                        <ul className="space-y-2">
                            {locations.map(loc => (
                                <li key={loc.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                    <span className="text-gray-800">{loc.name}</span>
                                    <Button variant="danger" size="sm" className="!p-1.5" onClick={() => setLocationToDelete(loc)} aria-label={`Ta bort ${loc.name}`}>
                                        <TrashIcon />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 italic">Inga orter tillagda.</p>
                    )}
                </div>
            </div>

            <ConfirmationModal
                isOpen={!!locationToDelete}
                onClose={() => setLocationToDelete(null)}
                onConfirm={handleDeleteLocation}
                title="Ta bort Ort"
                message={`Är du säker på att du vill ta bort orten "${locationToDelete?.name}"? Detta kan inte ångras.`}
                confirmButtonText="Ta bort"
            />
        </div>
    );
};

const MembershipManager: React.FC<{
  memberships: Membership[];
  setMemberships: (updater: Membership[] | ((prev: Membership[]) => Membership[])) => void;
  workoutCategories: WorkoutCategoryDefinition[];
}> = ({ memberships, setMemberships, workoutCategories }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMembership, setEditingMembership] = useState<Membership | null>(null);
    const [membershipToDelete, setMembershipToDelete] = useState<Membership | null>(null);

    const handleOpenModal = (membership: Membership | null) => {
        setEditingMembership(membership);
        setIsModalOpen(true);
    };

    const handleSave = (membershipData: Membership) => {
        if (editingMembership) {
            setMemberships(prev => prev.map(m => m.id === membershipData.id ? membershipData : m));
        } else {
            setMemberships(prev => [...prev, membershipData].sort((a, b) => a.name.localeCompare(b.name)));
        }
        setIsModalOpen(false);
    };

    const handleDeleteMembership = () => {
        if (!membershipToDelete) return;
        setMemberships(prev => prev.filter(mem => mem.id !== membershipToDelete.id));
        setMembershipToDelete(null);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-800">Hantera Medlemskap</h3>
                <Button onClick={() => handleOpenModal(null)}>Nytt Medlemskap</Button>
            </div>
            <div className="space-y-2">
                {memberships.length > 0 ? (
                    memberships.map(mem => (
                        <div key={mem.id} className="flex justify-between items-start p-3 bg-gray-50 rounded">
                            <div>
                                <p className="font-semibold text-gray-800">{mem.name}</p>
                                <p className="text-sm text-gray-500">{mem.description || 'Ingen beskrivning.'}</p>
                                {mem.restrictedCategories && mem.restrictedCategories.length > 0 && (
                                    <p className="text-xs text-red-600 mt-1">
                                        Begränsad från: {mem.restrictedCategories.join(', ')}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                                <Button variant="outline" size="sm" className="!text-xs" onClick={() => handleOpenModal(mem)}>Redigera</Button>
                                <Button variant="danger" size="sm" className="!p-1.5" onClick={() => setMembershipToDelete(mem)} aria-label={`Ta bort ${mem.name}`}>
                                    <TrashIcon />
                                </Button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-gray-500 italic">Inga medlemskap tillagda.</p>
                )}
            </div>

            {isModalOpen && (
                <AddEditMembershipModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    membershipToEdit={editingMembership}
                    allMemberships={memberships}
                    workoutCategories={workoutCategories}
                />
            )}

            <ConfirmationModal
                isOpen={!!membershipToDelete}
                onClose={() => setMembershipToDelete(null)}
                onConfirm={handleDeleteMembership}
                title="Ta bort Medlemskap"
                message={`Är du säker på att du vill ta bort medlemskapet "${membershipToDelete?.name}"? Medlemmar med detta medlemskap kommer att förlora sin koppling. Detta kan inte ångras.`}
                confirmButtonText="Ta bort"
            />
        </div>
    );
};

const AddEditMembershipModal: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    onSave: (data: Membership) => void,
    membershipToEdit: Membership | null,
    allMemberships: Membership[],
    workoutCategories: WorkoutCategoryDefinition[],
}> = ({ isOpen, onClose, onSave, membershipToEdit, allMemberships, workoutCategories }) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<'subscription' | 'clip_card'>('subscription');
    const [clipCardClips, setClipCardClips] = useState('');
    const [clipCardValidityDays, setClipCardValidityDays] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<Set<WorkoutCategory>>(new Set());
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{ clips?: string, validity?: string }>({});

    useEffect(() => {
        if (isOpen) {
            const memType = membershipToEdit?.type || 'subscription';
            setType(memType);
            setName(membershipToEdit?.name || '');
            setDescription(membershipToEdit?.description || '');
            setClipCardClips(membershipToEdit?.clipCardClips?.toString() || '');
            setClipCardValidityDays(membershipToEdit?.clipCardValidityDays?.toString() || '');
            
            if (memType === 'clip_card') {
                setSelectedCategories(new Set(membershipToEdit?.clipCardCategories || []));
            } else {
                setSelectedCategories(new Set(membershipToEdit?.restrictedCategories || []));
            }
            
            setError('');
            setFieldErrors({});
        }
    }, [membershipToEdit, isOpen]);

    const handleToggleCategory = (categoryName: WorkoutCategory) => {
        setSelectedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryName)) {
                newSet.delete(categoryName);
            } else {
                newSet.add(categoryName);
            }
            return newSet;
        });
    };

    const handleSave = () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            setError('Namn på medlemskap kan inte vara tomt.');
            return;
        }
        if (allMemberships.some(m => m.name.toLowerCase() === trimmedName.toLowerCase() && m.id !== membershipToEdit?.id)) {
            setError('Detta medlemskap finns redan.');
            return;
        }
        
        const newFieldErrors: { clips?: string, validity?: string } = {};
        if (type === 'clip_card') {
            if (!clipCardClips || isNaN(Number(clipCardClips)) || Number(clipCardClips) <= 0) {
                newFieldErrors.clips = 'Ange ett giltigt antal klipp (mer än 0).';
            }
            if (clipCardValidityDays && (isNaN(Number(clipCardValidityDays)) || Number(clipCardValidityDays) < 0)) {
                newFieldErrors.validity = 'Ange ett giltigt antal dagar.';
            }
        }

        setFieldErrors(newFieldErrors);
        if (Object.keys(newFieldErrors).length > 0) {
            return;
        }

        let membershipData: Membership = {
            id: membershipToEdit?.id || crypto.randomUUID(),
            name: trimmedName,
            description: description.trim() || undefined,
            type: type,
        };

        if (type === 'clip_card') {
            membershipData.clipCardClips = parseInt(clipCardClips, 10);
            membershipData.clipCardValidityDays = clipCardValidityDays ? parseInt(clipCardValidityDays, 10) : undefined;
            membershipData.clipCardCategories = Array.from(selectedCategories);
        } else {
            membershipData.restrictedCategories = Array.from(selectedCategories);
        }

        onSave(membershipData);
    };
    
    const categoryLabel = type === 'subscription' 
        ? 'Begränsa tillgång till passkategorier (lämna tomt för alla)' 
        : 'Begränsa klippkort från passkategorier (välj vilka pass klippen INTE gäller för)';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={membershipToEdit ? 'Redigera Medlemskap' : 'Nytt Medlemskap'}>
            <div className="space-y-4">
                <Input label="Namn *" value={name} onChange={e => { setName(e.target.value); setError(''); }} error={error} />
                <Textarea label="Beskrivning" value={description} onChange={e => setDescription(e.target.value)} rows={2} />

                <div>
                    <label className="block text-base font-medium text-gray-700 mb-2">Typ av medlemskap</label>
                    <div className="flex gap-4 p-2 bg-gray-100 rounded-md">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" value="subscription" checked={type === 'subscription'} onChange={() => setType('subscription')} className="h-4 w-4 text-flexibel"/>
                            <span className="text-base">Abonnemang</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" value="clip_card" checked={type === 'clip_card'} onChange={() => setType('clip_card')} className="h-4 w-4 text-flexibel"/>
                            <span className="text-base">Klippkort</span>
                        </label>
                    </div>
                </div>
                
                {type === 'clip_card' && (
                    <div className="grid grid-cols-2 gap-4 p-4 border rounded-md bg-blue-50/50 animate-fade-in-down">
                        <Input 
                            label="Antal Klipp *" 
                            type="number" 
                            min="1"
                            value={clipCardClips} 
                            onChange={e => setClipCardClips(e.target.value)} 
                            error={fieldErrors.clips}
                        />
                        <Input 
                            label="Giltighetstid (dagar)" 
                            type="number" 
                            min="0"
                            value={clipCardValidityDays} 
                            onChange={e => setClipCardValidityDays(e.target.value)} 
                            placeholder="Lämna tom för obegränsad"
                            error={fieldErrors.validity}
                        />
                    </div>
                )}

                <div>
                    <h4 className="text-base font-medium text-gray-700 mb-2">{categoryLabel}</h4>
                    <div className="space-y-2 p-3 bg-gray-50 rounded-md border">
                        {workoutCategories.filter(cat => cat.name !== 'Personligt program').map(cat => (
                            <label key={cat.id} className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={selectedCategories.has(cat.name)}
                                    onChange={() => handleToggleCategory(cat.name)}
                                    className="h-4 w-4 text-flexibel"
                                />
                                <span>{cat.name}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4 border-t">
                    <Button onClick={onClose} variant="secondary">Avbryt</Button>
                    <Button onClick={handleSave} variant="primary">Spara</Button>
                </div>
            </div>
        </Modal>
    );
};

const WorkoutCategoryManager: React.FC<{
  workoutCategories: WorkoutCategoryDefinition[],
  setWorkoutCategories: (updater: WorkoutCategoryDefinition[] | ((prev: WorkoutCategoryDefinition[]) => WorkoutCategoryDefinition[])) => void
}> = ({ workoutCategories, setWorkoutCategories }) => {
    const [newCategoryName, setNewCategoryName] = useState('');
    const [error, setError] = useState('');
    const [categoryToDelete, setCategoryToDelete] = useState<WorkoutCategoryDefinition | null>(null);

    const handleAddCategory = () => {
        const trimmedName = newCategoryName.trim();
        if (!trimmedName) {
            setError('Kategorinamn kan inte vara tomt.');
            return;
        }
        if (trimmedName.toLowerCase() === 'personligt program') {
            setError('"Personligt program" är en reserverad systemkategori.');
            return;
        }
        if (workoutCategories.some(cat => cat.name.toLowerCase() === trimmedName.toLowerCase())) {
            setError('Denna kategori finns redan.');
            return;
        }

        const newCategory: WorkoutCategoryDefinition = {
            id: crypto.randomUUID(),
            name: trimmedName,
        };
        setWorkoutCategories(prev => [...prev, newCategory].sort((a,b) => a.name.localeCompare(b.name)));
        setNewCategoryName('');
        setError('');
    };

    const handleDeleteCategory = () => {
        if (!categoryToDelete) return;
        setWorkoutCategories(prev => prev.filter(cat => cat.id !== categoryToDelete.id));
        setCategoryToDelete(null);
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Hantera Passkategorier</h3>
            <div className="space-y-4">
                <div className="flex items-end gap-2">
                    <Input 
                        label="Ny Kategori"
                        value={newCategoryName}
                        onChange={(e) => { setNewCategoryName(e.target.value); setError(''); }}
                        placeholder="T.ex. Kondition"
                        error={error}
                        inputSize="sm"
                    />
                    <Button onClick={handleAddCategory} size="sm" className="flex-shrink-0">Lägg till</Button>
                </div>
                <div className="pt-4 border-t">
                    <h4 className="text-lg font-semibold text-gray-700 mb-2">Befintliga Kategorier</h4>
                    {workoutCategories.filter(c => c.name !== 'Personligt program').length > 0 ? (
                        <ul className="space-y-2">
                            {workoutCategories.filter(cat => cat.name !== 'Personligt program').map(cat => (
                                <li key={cat.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                    <span className="text-gray-800">{cat.name}</span>
                                    <Button variant="danger" size="sm" className="!p-1.5" onClick={() => setCategoryToDelete(cat)} aria-label={`Ta bort ${cat.name}`}>
                                        <TrashIcon />
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 italic">Inga egna kategorier tillagda.</p>
                    )}
                </div>
            </div>

            <ConfirmationModal
                isOpen={!!categoryToDelete}
                onClose={() => setCategoryToDelete(null)}
                onConfirm={handleDeleteCategory}
                title="Ta bort Kategori"
                message={`Är du säker på att du vill ta bort kategorin "${categoryToDelete?.name}"? Detta kommer också ta bort den från eventuella medlemskapsbegränsningar. Detta kan inte ångras.`}
                confirmButtonText="Ta bort"
            />
        </div>
    );
};

const QrCodeGenerator: React.FC<{ locations: Location[] }> = ({ locations }) => {
    const [selectedLocationId, setSelectedLocationId] = useState<string>(locations[0]?.id || '');
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const printRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selectedLocationId && canvasRef.current) {
            const qrData = JSON.stringify({
                type: 'flexibel-checkin',
                locationId: selectedLocationId,
            });
            QRCode.toCanvas(canvasRef.current, qrData, { width: 256, errorCorrectionLevel: 'H' }, (error) => {
                if (error) console.error('QR Code generation error:', error);
            });
        }
    }, [selectedLocationId]);

    const handlePrint = () => {
        const printContent = printRef.current;
        if (printContent) {
            const newWindow = window.open('', '_blank', 'height=400,width=400');
            newWindow?.document.write('<html><head><title>Skriv ut QR-kod</title>');
            newWindow?.document.write('<style>@media print { body { margin: 0; } #qr-print-area { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; } canvas { width: 80vmin; height: 80vmin; } h1 { font-family: sans-serif; font-size: 2rem; } }</style>');
            newWindow?.document.write('</head><body>');
            newWindow?.document.write(printContent.innerHTML);
            newWindow?.document.write('</body></html>');
            newWindow?.document.close();
            newWindow?.focus();
            setTimeout(() => {
                newWindow?.print();
                newWindow?.close();
            }, 250);
        }
    };

    const selectedLocationName = locations.find(l => l.id === selectedLocationId)?.name || 'Okänd';

    return (
        <div className="bg-white p-6 rounded-lg shadow-md mt-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">QR-kod för Incheckning</h3>
            <div className="space-y-4">
                <Select
                    label="Välj ort för QR-kod"
                    value={selectedLocationId}
                    onChange={e => setSelectedLocationId(e.target.value)}
                    options={locations.map(l => ({ value: l.id, label: l.name }))}
                    inputSize="sm"
                    containerClassName="max-w-xs"
                />
                {selectedLocationId && (
                    <div className="flex flex-col items-center gap-4 pt-4 border-t">
                        <div ref={printRef} id="qr-print-area" className="flex flex-col items-center gap-2">
                            <h1 className="text-2xl font-bold text-gray-800">Checka in på {selectedLocationName}</h1>
                            <canvas ref={canvasRef} />
                        </div>
                        <Button onClick={handlePrint}>Skriv ut / Spara som PDF</Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export const SettingsManagement: React.FC<SettingsManagementProps> = ({ loggedInStaff }) => {
    const {
        locations, setLocationsData,
        memberships, setMembershipsData,
        workoutCategories, setWorkoutCategoriesData,
        participantDirectory: participants, setParticipantDirectoryData,
        integrationSettings, setIntegrationSettingsData,
    } = useAppContext();
    
    return (
        <div className="space-y-6">
            <LocationManager locations={locations} setLocations={setLocationsData} />
            <MembershipManager memberships={memberships} setMemberships={setMembershipsData} workoutCategories={workoutCategories} />
            <WorkoutCategoryManager workoutCategories={workoutCategories} setWorkoutCategories={setWorkoutCategoriesData} />
            
            {loggedInStaff?.role === 'Admin' && (
              <div className="bg-white p-6 rounded-lg shadow-md mt-6">
                  <h3 className="text-2xl font-bold text-gray-800 mb-4">Modulinställningar</h3>
                  <div className="space-y-4">
                      <ToggleSwitch
                          id="booking-module-toggle"
                          checked={integrationSettings.isBookingEnabled}
                          onChange={(isEnabled) =>
                              setIntegrationSettingsData(prev => ({...prev, isBookingEnabled: isEnabled}))
                          }
                          label="Aktivera Bokningssystem"
                          description="Aktiverar bokningskalendern och relaterade funktioner för både coacher och medlemmar. Detta är avsett för grupp-pass (träning, yoga etc)."
                      />
                      {integrationSettings.isBookingEnabled && (
                          <div className="pl-6 mt-2 border-l-2 ml-3 border-gray-200 space-y-4">
                              <Select
                                  label="Bokningsfönster"
                                  value={String(integrationSettings.bookingLeadTimeWeeks || 2)}
                                  onChange={(e) => setIntegrationSettingsData(prev => ({ ...prev, bookingLeadTimeWeeks: Number(e.target.value) }))}
                                  options={[
                                      { value: '1', label: '1 vecka i förväg' },
                                      { value: '2', label: '2 veckor i förväg' },
                                      { value: '3', label: '3 veckor i förväg' },
                                      { value: '4', label: '4 veckor i förväg' },
                                  ]}
                                  inputSize="sm"
                                  containerClassName="max-w-xs"
                              />
                              <Input
                                  label="Avbokningsgräns (timmar)"
                                  type="number"
                                  value={String(integrationSettings.cancellationCutoffHours ?? 2)}
                                  onChange={(e) => setIntegrationSettingsData(prev => ({ ...prev, cancellationCutoffHours: Number(e.target.value) < 0 ? 0 : Number(e.target.value) }))}
                                  inputSize="sm"
                                  containerClassName="max-w-xs"
                                  min="0"
                                  step="1"
                              />
                          </div>
                      )}
                  </div>
              </div>
            )}

            {loggedInStaff?.role === 'Admin' && (
                <QrCodeGenerator locations={locations} />
            )}

            <MemberImport 
                participants={participants}
                setParticipants={setParticipantDirectoryData}
                locations={locations}
                memberships={memberships}
            />
        </div>
    );
};