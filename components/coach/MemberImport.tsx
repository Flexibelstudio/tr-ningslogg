import React, { useState, useMemo } from 'react';
import { ParticipantProfile, Location, Membership, GenderOption } from '../../types';
import { Button } from '../Button';
import { Textarea } from '../Textarea';

interface MemberImportProps {
    participants: ParticipantProfile[];
    setParticipants: (updater: ParticipantProfile[] | ((prev: ParticipantProfile[]) => ParticipantProfile[])) => void;
    locations: Location[];
    memberships: Membership[];
}

interface PreviewRow {
    data: string[];
    status: 'new' | 'duplicate_email' | 'error' | 'skipped';
    message: string;
    finalProfile?: ParticipantProfile;
}

const calculateAge = (dobString: string): number | null => {
    // Expects M/D/YYYY format
    const parts = dobString.split('/');
    if (parts.length !== 3) return null;
    const [month, day, year] = parts.map(p => parseInt(p, 10));
    if (isNaN(month) || isNaN(day) || isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
        return null;
    }
    const dob = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age;
};

export const MemberImport: React.FC<MemberImportProps> = ({ participants, setParticipants, locations, memberships }) => {
    const [pasteData, setPasteData] = useState<string>('');
    const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);

    const existingEmails = useMemo(() => new Set(participants.map(p => p.email?.toLowerCase())), [participants]);

    const handlePreview = () => {
        setIsProcessing(true);
        const lines = pasteData.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
            setPreviewRows([{ data: [], status: 'error', message: 'Klistra in data med minst en rubrikrad och en medlemsrad.' }]);
            setIsProcessing(false);
            return;
        }

        const newPreviewRows: PreviewRow[] = [];
        // Skip header row (line 0)
        for (let i = 1; i < lines.length; i++) {
            const cells = lines[i].split('\t');
            if (cells.length < 11) {
                newPreviewRows.push({ data: cells, status: 'error', message: `Fel antal kolumner (${cells.length}), förväntade 11.` });
                continue;
            }

            const [firstName, lastName, dob, genderStr, email, _mobil, city, membershipType, validFrom, _validTo, boundUntil] = cells.map(c => c.trim());

            const errors: string[] = [];
            const name = `${firstName} ${lastName}`;
            if (!name.trim()) errors.push('Namn saknas.');

            const lowerEmail = email.toLowerCase();
            if (!lowerEmail) errors.push('E-post saknas.');
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lowerEmail)) errors.push('Ogiltig e-post.');
            
            let status: PreviewRow['status'] = 'new';
            if (existingEmails.has(lowerEmail)) {
                status = 'duplicate_email';
            }

            const age = calculateAge(dob);
            if (age === null) errors.push('Ogiltigt födelsedatum (förväntat M/D/ÅÅÅÅ).');

            const gender: GenderOption | undefined = genderStr === 'Man' ? 'Man' : genderStr === 'Kvinna' ? 'Kvinna' : undefined;
            if (!gender) errors.push('Ogiltigt kön.');

            const location = locations.find(l => city.toLowerCase().includes(l.name.toLowerCase()));
            if (!location) errors.push(`Okänd ort: '${city}'.`);

            let membership: Membership | undefined;
            const lowerMembershipType = membershipType.toLowerCase();
            if (lowerMembershipType.includes('mini')) {
                membership = memberships.find(m => m.name.toLowerCase() === 'mini');
            } else {
                membership = memberships.find(m => m.name.toLowerCase() === 'medlemskap');
            }
            if (!membership) errors.push(`Okänt medlemskap: '${membershipType}'.`);

            let startDate: string | undefined;
            if (validFrom) {
                try {
                    const [m, d, y] = validFrom.split('/').map(Number);
                    startDate = new Date(y, m - 1, d).toISOString().split('T')[0];
                } catch { errors.push('Ogiltigt startdatum.'); }
            }
            
            let endDate: string | undefined;
            if (boundUntil) {
                try {
                    const [m, d, y] = boundUntil.split('/').map(Number);
                    endDate = new Date(y, m - 1, d).toISOString().split('T')[0];
                } catch { errors.push('Ogiltigt slutdatum.'); }
            }

            const today = new Date();
            today.setHours(0,0,0,0);
            const isActive = endDate ? new Date(endDate) >= today : true;

            if (errors.length > 0) {
                newPreviewRows.push({ data: cells, status: 'error', message: errors.join(' ') });
            } else {
                const finalProfile: ParticipantProfile = {
                    id: crypto.randomUUID(),
                    name: name.trim(),
                    email: lowerEmail,
                    isActive,
                    isProspect: false,
                    creationDate: new Date().toISOString(),
                    age: age?.toString(),
                    gender: gender,
                    lastUpdated: new Date().toISOString(),
                    locationId: location?.id,
                    membershipId: membership?.id,
                    startDate: startDate,
                    endDate: endDate,
                };
                newPreviewRows.push({ data: cells, status, message: status === 'duplicate_email' ? 'E-post finns redan, raden kommer hoppas över.' : 'Redo för import.', finalProfile });
            }
        }
        setPreviewRows(newPreviewRows);
        setIsProcessing(false);
    };

    const handleImport = () => {
        const newProfiles = previewRows
            .filter(r => r.status === 'new' && r.finalProfile)
            .map(r => r.finalProfile!);

        if (newProfiles.length > 0) {
            setParticipants(prev => {
                const currentEmails = new Set(prev.map(p => p.email?.toLowerCase()));
                const trulyNewProfiles = newProfiles.filter(p => !p.email || !currentEmails.has(p.email.toLowerCase()));
                return [...prev, ...trulyNewProfiles];
            });
            alert(`${newProfiles.length} nya medlemmar importerades!`);
        } else {
            alert('Inga nya medlemmar att importera.');
        }

        setPasteData('');
        setPreviewRows([]);
    };
    
    const summary = useMemo(() => {
        const newCount = previewRows.filter(r => r.status === 'new').length;
        const duplicateCount = previewRows.filter(r => r.status === 'duplicate_email').length;
        const errorCount = previewRows.filter(r => r.status === 'error').length;
        return { newCount, duplicateCount, errorCount, total: previewRows.length };
    }, [previewRows]);

    const statusClasses: Record<PreviewRow['status'], string> = {
        new: 'bg-green-50',
        duplicate_email: 'bg-yellow-50',
        error: 'bg-red-50',
        skipped: 'bg-gray-50'
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md mt-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Importera Medlemsregister</h3>
            <p className="text-sm text-gray-500 mb-4">Klistra in data från kalkylblad (tabb-separerad). Förväntade kolumner: Förnamn, Efternamn, Födelsedatum, Kön, E-post, Mobil, Stad, Korttyp, Giltigt Från, Giltigt Till, Bundet Till.</p>
            
            <Textarea
                value={pasteData}
                onChange={e => setPasteData(e.target.value)}
                placeholder="Klistra in data här..."
                rows={8}
            />
            <div className="flex gap-2 mt-2">
                <Button onClick={handlePreview} disabled={!pasteData.trim() || isProcessing}>
                    {isProcessing ? 'Bearbetar...' : 'Förhandsgranska'}
                </Button>
                <Button onClick={() => { setPasteData(''); setPreviewRows([]); }} variant="ghost">Rensa</Button>
            </div>

            {previewRows.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                        <div>
                            <h4 className="text-lg font-semibold text-gray-700">Förhandsgranskning ({summary.total} rader)</h4>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                <span className="text-green-600 font-medium">{summary.newCount} Nya</span>
                                <span className="text-yellow-600 font-medium">{summary.duplicateCount} Duplicerade</span>
                                <span className="text-red-600 font-medium">{summary.errorCount} Fel</span>
                            </div>
                        </div>
                        <Button onClick={handleImport} disabled={summary.newCount === 0}>
                            Importera {summary.newCount} Nya Medlemmar
                        </Button>
                    </div>

                    <div className="overflow-x-auto max-h-96">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-100 sticky top-0">
                                <tr>
                                    <th className="p-2 text-left font-medium text-gray-600">Status</th>
                                    <th className="p-2 text-left font-medium text-gray-600">Meddelande</th>
                                    <th className="p-2 text-left font-medium text-gray-600">Namn</th>
                                    <th className="p-2 text-left font-medium text-gray-600">E-post</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewRows.map((row, index) => (
                                    <tr key={index} className={statusClasses[row.status]}>
                                        <td className="p-2 font-semibold capitalize">{row.status.replace('_', ' ')}</td>
                                        <td className="p-2">{row.message}</td>
                                        <td className="p-2">{row.data[0]} {row.data[1]}</td>
                                        <td className="p-2">{row.data[4]}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};