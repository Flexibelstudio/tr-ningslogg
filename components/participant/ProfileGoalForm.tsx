import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { Input, Select } from '../Input';
import { ParticipantProfile, GenderOption, Location } from '../../types';
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
    shareMyBookings?: boolean;
    receiveFriendBookingNotifications?: boolean;
    notificationSettings?: {
        pushEnabled: boolean;
        waitlistPromotion: boolean;
        sessionReminder: boolean;
        classCancellation: boolean;
    };
    photoURL?: string;
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
  const [shareMyBookings, setShareMyBookings] = useState(false);
  const [receiveFriendBookingNotifications, setReceiveFriendBookingNotifications] = useState(true);
  const [notificationSettings, setNotificationSettings] = useState({
    pushEnabled: true,
    waitlistPromotion: true,
    sessionReminder: true,
    classCancellation: true,
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
    setShareMyBookings(currentProfile?.shareMyBookings || false);
    setReceiveFriendBookingNotifications(currentProfile?.receiveFriendBookingNotifications ?? true);
    setNotificationSettings({
        pushEnabled: currentProfile?.notificationSettings?.pushEnabled ?? true,
        waitlistPromotion: currentProfile?.notificationSettings?.waitlistPromotion ?? true,
        sessionReminder: currentProfile?.notificationSettings?.sessionReminder ?? true,
        classCancellation: currentProfile?.notificationSettings?.classCancellation ?? true,
    });
    setImagePreview(null); // Reset image preview on open
  }, [currentProfile]);
  
  const handleNotificationSettingChange = (field: keyof typeof notificationSettings, value: boolean) => {
    setNotificationSettings(prev => ({ ...prev, [field]: value }));
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
    const profileData: Partial<ParticipantProfile> = {
      name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      birthDate: birthDate.trim() ? birthDate.trim() : undefined,
      gender,
      locationId: locationId,
      enableLeaderboardParticipation: enableLeaderboard,
      isSearchable: isSearchable,
      enableInBodySharing: enableInBodySharing,
      enableFssSharing: enableFssSharing,
      shareMyBookings: shareMyBookings,
      receiveFriendBookingNotifications: receiveFriendBookingNotifications,
      notificationSettings,
    };

    // Only include photoURL in the update if a new image has been selected or it has been removed.
    // This prevents overwriting the existing URL with undefined.
    if (imagePreview !== null) {
      // An empty string signifies removal, which will be saved to Firestore.
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
  
  const currentPhoto = imagePreview === null ? currentProfile?.photoURL : imagePreview;

  return (
    <div className="space-y-6 py-4">
      <p className="text-base text-gray-600">Din profilinformation hjälper oss att ge dig mer relevanta jämförelser och rekommendationer.</p>

      <section className="space-y-4 pt-4 border-t">
        <h3 className="text-lg font-semibold text-gray-700">Profilbild</h3>
        <div className="flex items-center gap-4">
          <Avatar photoURL={currentPhoto} name={combinedName} size="lg" />
          <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/png, image/jpeg" className="hidden" />
          <div className="flex flex-col gap-2">
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              Ladda upp ny bild
            </Button>
          </div>
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

      <section className="space-y-4 pt-4 border-t">
        <h3 className="text-lg font-semibold text-gray-700">Notis- & Delningsinställningar</h3>
        <div className="p-3 bg-gray-100 rounded-md space-y-2">
          <ToggleSwitch
            id="pushEnabled"
            checked={notificationSettings.pushEnabled}
            onChange={(val) => handleNotificationSettingChange('pushEnabled', val)}
            label="Ta emot pushnotiser"
            description="Få notiser på din enhet även när appen är stängd."
          />
          {notificationSettings.pushEnabled && (
            <div className="pl-6 pt-2 border-l-2 border-gray-300 space-y-2 animate-fade-in-down">
              <ToggleSwitch
                id="waitlistPromotion"
                checked={notificationSettings.waitlistPromotion}
                onChange={(val) => handleNotificationSettingChange('waitlistPromotion', val)}
                label="När jag får en plats från kölistan"
              />
              <ToggleSwitch
                id="sessionReminder"
                checked={notificationSettings.sessionReminder}
                onChange={(val) => handleNotificationSettingChange('sessionReminder', val)}
                label="Påminnelser innan pass"
              />
              <ToggleSwitch
                id="classCancellation"
                checked={notificationSettings.classCancellation}
                onChange={(val) => handleNotificationSettingChange('classCancellation', val)}
                label="När ett pass ställs in"
              />
              <ToggleSwitch
                  id="receiveFriendBookingNotifications"
                  checked={receiveFriendBookingNotifications}
                  onChange={setReceiveFriendBookingNotifications}
                  label="När en vän bokar ett pass"
                />
            </div>
          )}
        </div>
        <div className="p-3 bg-gray-100 rounded-md">
          <ToggleSwitch
            id="shareMyBookings"
            checked={shareMyBookings}
            onChange={setShareMyBookings}
            label="Dela mina passbokningar med vänner"
            description="Tillåt vänner att få en notis när du bokar ett pass, så de kan haka på."
          />
        </div>
      </section>

      <section className="space-y-4 pt-4 border-t">
        <h3 className="text-lg font-semibold text-gray-700">Synlighet & Topplistor</h3>
        <ToggleSwitch
            id="enableLeaderboard"
            checked={enableLeaderboard}
            onChange={setEnableLeaderboard}
            label="Delta i Topplistor & Utmaningar"
            description="Tillåt att ditt namn och dina resultat (t.ex. antal pass, personliga rekord) visas på interna topplistor som är synliga för andra medlemmar och coacher."
        />
        <ToggleSwitch
            id="enableInBodySharing"
            checked={enableInBodySharing}
            onChange={setEnableInBodySharing}
            label="Visa InBody-poäng på topplistor"
            description='Tillåt att din InBody-poäng visas på "All-Time Topplistor" som är synlig för andra medlemmar och coacher.'
        />
        <ToggleSwitch
            id="enableFssSharing"
            checked={enableFssSharing}
            onChange={setEnableFssSharing}
            label="Visa FSS-poäng på topplistor"
            description='Tillåt att din FSS-poäng (styrkepoäng) visas på "All-Time Topplistor" som är synlig för andra medlemmar och coacher.'
        />
        <ToggleSwitch
            id="isSearchable"
            checked={isSearchable}
            onChange={setIsSearchable}
            label="Gör min profil sökbar för andra medlemmar"
            description="Tillåt andra medlemmar att hitta dig via sökfunktionen och skicka en vänförfrågan för att kunna se varandras flöden."
        />
      </section>
    </div>
  );
});
ProfileForm.displayName = 'ProfileForm';