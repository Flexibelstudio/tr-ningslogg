import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './Button';
import { Input, Select } from './Input';
import { useAppContext } from '../context/AppContext';
import { Location } from '../types';
import dataService from '../services/dataService';
import { TermsModal } from './TermsModal';

interface RegisterProps {
  onSwitchToLogin: () => void;
  onRegistrationSuccess: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onSwitchToLogin, onRegistrationSuccess }) => {
  const { register } = useAuth();
  const { allOrganizations } = useAppContext();
  const { isOnline } = useNetworkStatus();

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [locationsForOrg, setLocationsForOrg] = useState<Location[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [apiError, setApiError] = useState('');
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    if (selectedOrgId) {
      const fetchLocations = async () => {
        setIsLoadingLocations(true);
        setSelectedLocationId('');
        setApiError('');
        setFormErrors({});
        try {
          const mockOrgData = dataService.getOrgData(selectedOrgId);
          const locs = mockOrgData?.locations || [];
          setLocationsForOrg(locs);

          if (locs.length === 0) {
            const orgName = allOrganizations.find((o) => o.id === selectedOrgId)?.name || 'Den valda organisationen';
            setFormErrors((prev) => ({ ...prev, orgId: `'${orgName}' har inga konfigurerade studios/orter.` }));
          }
        } catch (err) {
          console.error('Failed to fetch locations from dataService:', err);
          setApiError('Ett fel uppstod vid hämtning av orter.');
          setLocationsForOrg([]);
        } finally {
          setIsLoadingLocations(false);
        }
      };
      fetchLocations();
    } else {
      setLocationsForOrg([]);
      setSelectedLocationId('');
      setApiError('');
    }
  }, [selectedOrgId, allOrganizations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError('');

    const trimmedEmail = email.trim();
    setEmail(trimmedEmail);

    const newErrors: { [key: string]: string } = {};
    if (!firstName.trim()) newErrors.firstName = 'Förnamn är obligatoriskt.';
    if (!lastName.trim()) newErrors.lastName = 'Efternamn är obligatoriskt.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) newErrors.email = 'Vänligen ange en giltig e-postadress.';