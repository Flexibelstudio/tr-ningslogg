import React from 'react';
import { useAuth } from '../context/AuthContext';
import firebaseService from '../services/firebaseService';
import dataService from '../services/dataService';
import { User } from '../types';

export const DevToolbar: React.FC = () => {
    const { login, user: currentUser } = useAuth();
    const isOffline = firebaseService.isOffline();

    if (!isOffline) {
        return null;
    }

    const testUsers = dataService.get('users');

    const handleSwitchUser = (user: User) => {
        // We can ignore the password because the offline login in AuthContext doesn't check it.
        login(user.email, 'password').catch(err => console.error("DevToolbar login failed:", err));
    };

    return (
        <div style={{ position: 'fixed', bottom: '10px', left: '10px', zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '8px', color: 'white' }}>
            <h4 style={{ margin: 0, paddingBottom: '5px', borderBottom: '1px solid white', fontSize: '14px', fontWeight: 'bold' }}>Dev Toolbar</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '5px' }}>
                {testUsers.map(user => (
                    <button 
                        key={user.id} 
                        onClick={() => handleSwitchUser(user)}
                        style={{
                            backgroundColor: currentUser?.id === user.id ? '#3bab5a' : '#555',
                            color: 'white',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            textAlign: 'left'
                        }}
                    >
                        {user.name}
                    </button>
                ))}
            </div>
        </div>
    );
};
