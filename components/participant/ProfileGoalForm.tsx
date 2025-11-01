import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { Input, Select } from '../Input';
import { ParticipantProfile, GenderOption, Location, NotificationSettings } from '../../types';
import { GENDER_OPTIONS } from '../../constants';
import { Avatar } from '../Avatar';
import { Button } from '../Button';
import { ToggleSwitch } from '../ToggleSwitch';

export interface ProfileFormRef {
  submitForm: () => boolean;
}

interface ProfileFormProps {
  currentProfile: ParticipantProfile | null;
  onSave: (profileData: {
    name?: string;
    birthDate?: string;
    gender?: GenderOption;
    enableLeaderboardParticipation?: boolean;
    isSearchable?: boolean;
    locationId?: string;
    enableInBodySharing?: boolean;
    enableFssSharing?: boolean;
    photoURL?: string;
    notificationSettings?: NotificationSettings;
  }) => void;
  locations: Location[];
}

export const ProfileForm = forwardRef<ProfileFormRef, ProfileFormProps>(({ currentProfile, onSave, locations }, ref) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<GenderOption>('-');
  const [locationId, setLocationId] = useState('');
  const [enableLeaderboard, setEnableLeaderboard] = useState(false);
  const [isSearchable, setIsSearchable] = useState(false);
  const [enableInBodySharing, setEnableInBodySharing] = useState(false);
  const [enableFssSharing, setEnableFssSharing] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    pushEnabled: true,
    reminders: true,
    friendBooking: true,
    news: true,
    waitlist: true,
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const nameParts = currentProfile?.name?.split(' ') || [''];
    setFirstName(nameParts[0] || '');
    setLastName(nameParts.slice(1).join(' ') || '');
    setBirthDate(currentProfile?.birthDate || '');
    setGender(currentProfile?.gender || '-');
    setLocationId(currentProfile?.locationId || '');
    setEnableLeaderboard(currentProfile?.enableLeaderboardParticipation || false);
    setIsSearchable(currentProfile?.isSearchable ?? true);
    setEnableInBodySharing(currentProfile?.enableInBodySharing || false);
    setEnableFssSharing(currentProfile?.enableFssSharing || false);
    setNotificationSettings({
      pushEnabled: currentProfile?.notificationSettings?.pushEnabled ?? true,
      reminders: currentProfile?.notificationSettings?.reminders ?? true,
      friendBooking: currentProfile?.notificationSettings?.friendBooking ?? true,
      news: currentProfile?.notificationSettings?.news ?? true,
      waitlist: currentProfile?.notificationSettings?.waitlist ?? true,
    });
    setImagePreview(null); // Reset image preview on open
  }, [currentProfile]);

  const handleNotificationSettingChange = (field: keyof NotificationSettings, value: boolean) => {
    setNotificationSettings(prev => ({...prev, [field]: value}));
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
    const profileData = {
      name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      birthDate: birthDate.trim() ? birthDate.trim() : undefined,
      gender,
      locationId: locationId,
      enableLeaderboardParticipation: enableLeaderboard,
      isSearchable: isSearchable,
      enableInBodySharing: enableInBodySharing,
      enableFssSharing: enableFssSharing,
      photoURL: imagePreview || undefined,
      notificationSettings,
    };

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
        <Input label="Födelsedatum" id="profileBirthDate" name="profileBirthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
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

      <section className="space-y-2 pt-4 border-t">
        <h3 className="text-lg font-semibold text-gray-700">Notisinställningar</h3>
        <ToggleSwitch
          id="pushEnabled"
          checked={notificationSettings.pushEnabled}
          onChange={(val) => handleNotificationSettingChange('pushEnabled', val)}
          label="Aktivera Pushnotiser"
          description="Huvudbrytare för att skicka notiser till din enhet när appen är stängd."
        />
        <div className={`space-y-1 pl-4 ml-4 border-l-2 transition-opacity ${notificationSettings.pushEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <ToggleSwitch
              id="waitlist"
              checked={notificationSettings.waitlist}
              onChange={(val) => handleNotificationSettingChange('waitlist', val)}
              label="Plats från kölista"
            />
             <ToggleSwitch
              id="reminders"
              checked={notificationSettings.reminders}
              onChange={(val) => handleNotificationSettingChange('reminders', val)}
              label="Påminnelser om pass"
            />
             <ToggleSwitch
              id="friendBooking"
              checked={notificationSettings.friendBooking}
              onChange={(val) => handleNotificationSettingChange('friendBooking', val)}
              label="När en vän bokar pass"
            />
             <ToggleSwitch
              id="news"
              checked={notificationSettings.news}
              onChange={(val) => handleNotificationSettingChange('news', val)}
              label="Nyheter & Händelser"
            />
        </div>
      </section>

      <section className="space-y-4 pt-4 border-t">
        <h3 className="text-lg font-semibold text-gray-700">Community & Delning</h3>
        <ToggleSwitch
            id="enableLeaderboard"
            checked={enableLeaderboard}
            onChange={(val) => setEnableLeaderboard(val)}
            label="Delta i Topplistor & Utmaningar"
            description="Godkänn att ditt namn och dina resultat (t.ex. PBs) visas på interna topplistor."
        />
        <ToggleSwitch
            id="enableInBodySharing"
            checked={enableInBodySharing}
            onChange={(val) => setEnableInBodySharing(val)}
            label="Visa InBody-poäng på topplistor"
            description="Tillåt att din InBody-poäng visas på 'All-Time Topplistor'."
        />
        <ToggleSwitch
            id="enableFssSharing"
            checked={enableFssSharing}
            onChange={(val) => setEnableFssSharing(val)}
            label="Visa FSS-poäng på topplistor"
            description="Tillåt att din FSS-poäng (styrkepoäng) visas på 'All-Time Topplistor'."
        />
        <ToggleSwitch
            id="isSearchable"
            checked={isSearchable}
            onChange={(val) => setIsSearchable(val)}
            label="Gör min profil sökbar"
            description="Tillåt andra medlemmar att hitta dig och skicka en vänförfrågan."
        />
      </section>
    </div>
  );
});
ProfileForm.displayName = 'ProfileForm';
