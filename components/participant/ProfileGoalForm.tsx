import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { Input, Select } from '../Input';
import { ParticipantProfile, GenderOption, Location } from '../../types';
import { GENDER_OPTIONS } from '../../constants';
import { Avatar } from '../Avatar';
import { Button } from '../Button';

export interface ProfileFormRef {
  submitForm: () => boolean;
}

interface ProfileFormProps {
  currentProfile: ParticipantProfile | null;
  onSave: (profileData: {
    name?: string;
    age?: string;
    gender?: GenderOption;
    enableLeaderboardParticipation?: boolean;
    isSearchable?: boolean;
    locationId?: string;
    enableInBodySharing?: boolean;
    enableFssSharing?: boolean;
    photoURL?: string;
  }) => void;
  locations: Location[];
}

export const ProfileForm = forwardRef<ProfileFormRef, ProfileFormProps>(({ currentProfile, onSave, locations }, ref) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<GenderOption>('-');
  const [locationId, setLocationId] = useState('');
  const [enableLeaderboard, setEnableLeaderboard] = useState(false);
  const [isSearchable, setIsSearchable] = useState(false);
  const [enableInBodySharing, setEnableInBodySharing] = useState(false);
  const [enableFssSharing, setEnableFssSharing] = useState(false);

  const [ageError, setAgeError] = useState<string>('');

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const nameParts = currentProfile?.name?.split(' ') || [''];
    setFirstName(nameParts[0] || '');
    setLastName(nameParts.slice(1).join(' ') || '');
    setAge(currentProfile?.age?.toString() || '');
    setGender(currentProfile?.gender || '-');
    setLocationId(currentProfile?.locationId || '');
    setEnableLeaderboard(currentProfile?.enableLeaderboardParticipation || false);
    setIsSearchable(currentProfile?.isSearchable ?? true);
    setEnableInBodySharing(currentProfile?.enableInBodySharing || false);
    setEnableFssSharing(currentProfile?.enableFssSharing || false);
    setAgeError('');
    setImagePreview(null); // Reset image preview on open
  }, [currentProfile]);

  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAge(value);
    if (value === '') {
      setAgeError('');
      return;
    }
    if (isNaN(Number(value)) || Number(value) < 0 || Number(value) > 120 || !Number.isInteger(Number(value))) {
      setAgeError('Ange en giltig ålder (heltal mellan 0-120).');
    } else {
      setAgeError('');
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_WIDTH = 512;
        const MAX_HEIGHT = 512;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setImagePreview(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (ageError) {
      alert('Korrigera felen i formuläret innan du sparar.');
      return false;
    }

    const profileData: Partial<Pick<ParticipantProfile, 'name' | 'age' | 'gender' | 'enableLeaderboardParticipation' | 'isSearchable' | 'locationId' | 'enableInBodySharing' | 'enableFssSharing' | 'photoURL'>> = {
      name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      age: age.trim(),
      gender,
      locationId: locationId,
      enableLeaderboardParticipation: enableLeaderboard,
      isSearchable: isSearchable,
      enableInBodySharing: enableInBodySharing,
      enableFssSharing: enableFssSharing,
    };

    if (imagePreview) {
      profileData.photoURL = imagePreview;
    }

    onSave(profileData);
    return true;
  };

  useImperativeHandle(ref, () => ({
    submitForm: handleSubmit,
  }));

  const locationOptions = locations.map((loc) => ({ value: loc.id, label: loc.name }));
  const combinedName = `${firstName} ${lastName}`.trim();

  return (
    <div className="space-y-6 py-4">
      <p className="text-base text-gray-600">Din profilinformation hjälper oss att ge dig mer relevanta jämförelser och rekommendationer.</p>

      <section className="space-y-4 pt-4 border-t">
        <h3 className="text-lg font-semibold text-gray-700">Profilbild</h3>
        <div className="flex items-center gap-4">
          <Avatar photoURL={imagePreview || currentProfile?.photoURL} name={combinedName} size="lg" />
          <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/png, image/jpeg" className="hidden" />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            Ladda upp ny bild
          </Button>
        </div>
      </section>

      <section className="space-y-4 pt-4 border-t">
        <h3 className="text-lg font-semibold text-gray-700">Om Mig</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Förnamn" id="profileFirstName" name="profileFirstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ditt förnamn" />
          <Input label="Efternamn" id="profileLastName" name="profileLastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Ditt efternamn" />
        </div>
        <Input label="Ålder" id="profileAge" name="profileAge" type="number" value={age} onChange={handleAgeChange} placeholder="Din ålder i år" error={ageError} />
        <Select label="Kön" id="profileGender" name="profileGender" value={gender} onChange={(e) => setGender(e.target.value as GenderOption)} options={GENDER_OPTIONS} />
        <Select
          label="Primär Ort/Studio"
          id="profileLocation"
          name="profileLocation"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          options={[{ value: '', label: 'Välj en ort...' }, ...locationOptions]}
        />
      </section>
      <section className="space-y-4 pt-4 border-t">
        <h3 className="text-lg font-semibold text-gray-700">Inställningar</h3>
        <label className="flex items-start space-x-3 p-3 bg-gray-100 rounded-md cursor-pointer">
          <input
            type="checkbox"
            id="enableLeaderboard"
            checked={enableLeaderboard}
            onChange={(e) => setEnableLeaderboard(e.target.checked)}
            className="h-6 w-6 mt-1 text-flexibel border-gray-300 rounded focus:ring-flexibel"
          />
          <div>
            <span className="text-base font-medium text-gray-700">Delta i Topplistor & Utmaningar</span>
            <p className="text-sm text-gray-500">
              Genom att kryssa i denna ruta godkänner du att ditt namn och dina resultat (t.ex. antal pass, personliga rekord) visas på interna topplistor som är synliga för
              andra medlemmar och coacher.
            </p>
          </div>
        </label>
        <label className="flex items-start space-x-3 p-3 bg-gray-100 rounded-md cursor-pointer">
          <input
            type="checkbox"
            id="enableInBodySharing"
            checked={enableInBodySharing}
            onChange={(e) => setEnableInBodySharing(e.target.checked)}
            className="h-6 w-6 mt-1 text-flexibel border-gray-300 rounded focus:ring-flexibel"
          />
          <div>
            <span className="text-base font-medium text-gray-700">Visa InBody-poäng på topplistor</span>
            <p className="text-sm text-gray-500">Tillåt att din InBody-poäng visas på "All-Time Topplistor" som är synlig för andra medlemmar och coacher.</p>
          </div>
        </label>
        <label className="flex items-start space-x-3 p-3 bg-gray-100 rounded-md cursor-pointer">
          <input
            type="checkbox"
            id="enableFssSharing"
            checked={enableFssSharing}
            onChange={(e) => setEnableFssSharing(e.target.checked)}
            className="h-6 w-6 mt-1 text-flexibel border-gray-300 rounded focus:ring-flexibel"
          />
          <div>
            <span className="text-base font-medium text-gray-700">Visa FSS-poäng på topplistor</span>
            <p className="text-sm text-gray-500">Tillåt att din FSS-poäng (styrkepoäng) visas på "All-Time Topplistor" som är synlig för andra medlemmar och coacher.</p>
          </div>
        </label>
        <label className="flex items-start space-x-3 p-3 bg-gray-100 rounded-md cursor-pointer">
          <input
            type="checkbox"
            id="isSearchable"
            checked={isSearchable}
            onChange={(e) => setIsSearchable(e.target.checked)}
            className="h-6 w-6 mt-1 text-flexibel border-gray-300 rounded focus:ring-flexibel"
          />
          <div>
            <span className="text-base font-medium text-gray-700">Gör min profil sökbar för andra medlemmar</span>
            <p className="text-sm text-gray-500">
              Genom att aktivera detta kan andra medlemmar hitta dig via sökfunktionen och skicka en vänförfrågan för att kunna se varandras flöden.
            </p>
          </div>
        </label>
      </section>
    </div>
  );
});
ProfileForm.displayName = 'ProfileForm';
