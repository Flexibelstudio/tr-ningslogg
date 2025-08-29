import React, { useState, useMemo } from 'react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input } from '../Input';
import { ParticipantProfile, Connection } from '../../types';
import { Avatar } from '../Avatar';

interface CommunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentParticipantId: string;
  allParticipants: ParticipantProfile[];
  connections: Connection[];
  setConnections: (updater: Connection[] | ((prev: Connection[]) => Connection[])) => void;
}

type CommunityTab = 'search' | 'friends' | 'requests';

export const CommunityModal: React.FC<CommunityModalProps> = ({
  isOpen,
  onClose,
  currentParticipantId,
  allParticipants,
  connections,
  setConnections,
}) => {
  const [activeTab, setActiveTab] = useState<CommunityTab>('friends');
  const [searchTerm, setSearchTerm] = useState('');

  const myFriends = useMemo(() => {
    const friendIds = new Set<string>();
    connections.forEach(conn => {
        if (conn.status === 'accepted') {
            if (conn.requesterId === currentParticipantId) friendIds.add(conn.receiverId);
            if (conn.receiverId === currentParticipantId) friendIds.add(conn.requesterId);
        }
    });
    return allParticipants.filter(p => friendIds.has(p.id));
  }, [connections, allParticipants, currentParticipantId]);

  const incomingRequests = useMemo(() => {
    return connections
        .filter(conn => conn.receiverId === currentParticipantId && conn.status === 'pending')
        .map(conn => {
            const requester = allParticipants.find(p => p.id === conn.requesterId);
            return requester ? { ...conn, requester } : null;
        })
        .filter(Boolean) as (Connection & { requester: ParticipantProfile })[];
  }, [connections, allParticipants, currentParticipantId]);

  const outgoingRequests = useMemo(() => {
    return connections
        .filter(conn => conn.requesterId === currentParticipantId && conn.status === 'pending')
        .map(conn => {
            const receiver = allParticipants.find(p => p.id === conn.receiverId);
            return receiver ? { ...conn, receiver } : null;
        })
        .filter(Boolean) as (Connection & { receiver: ParticipantProfile })[];
  }, [connections, allParticipants, currentParticipantId]);
  
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lowerCaseSearch = searchTerm.toLowerCase();

    return allParticipants.filter(p => 
        p.id !== currentParticipantId &&
        p.isActive &&
        !!p.membershipId &&
        p.isSearchable !== false && 
        p.name?.toLowerCase().includes(lowerCaseSearch)
    );
  }, [searchTerm, allParticipants, currentParticipantId]);

  const getConnectionStatus = (targetId: string) => {
    const conn = connections.find(c => 
        (c.requesterId === currentParticipantId && c.receiverId === targetId) ||
        (c.requesterId === targetId && c.receiverId === currentParticipantId)
    );
    return conn ? conn.status : null;
  };
  
  const handleSendRequest = (receiverId: string) => {
    const newConnection: Connection = {
        id: crypto.randomUUID(),
        requesterId: currentParticipantId,
        receiverId: receiverId,
        status: 'pending',
        createdDate: new Date().toISOString()
    };
    setConnections(prev => [...prev, newConnection]);
  };

  const handleUpdateRequest = (connectionId: string, newStatus: 'accepted' | 'declined') => {
    setConnections(prev => prev.map(c => c.id === connectionId ? { ...c, status: newStatus } : c));
  };
  
  const handleRemoveFriend = (friendId: string) => {
     if (!confirm("Är du säker på att du vill ta bort den här vännen? Ni kommer inte längre se varandras flöden.")) return;
     setConnections(prev => prev.filter(c => 
         !((c.requesterId === currentParticipantId && c.receiverId === friendId) || 
           (c.requesterId === friendId && c.receiverId === currentParticipantId))
     ));
  };
  
  const handleCancelRequest = (connectionId: string) => {
    if (confirm("Är du säker på att du vill dra tillbaka din vänförfrågan?")) {
      setConnections(prev => prev.filter(c => c.id !== connectionId));
    }
  };

  const getTabButtonStyle = (tabName: CommunityTab) => {
    return activeTab === tabName
        ? 'border-flexibel text-flexibel bg-flexibel/10'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Community" size="2xl">
        <div className="flex flex-col max-h-[70vh] min-h-[50vh]">
            <div className="border-b border-gray-200 flex-shrink-0">
                <nav className="-mb-px flex flex-wrap gap-x-4" aria-label="Tabs">
                    <button onClick={() => setActiveTab('friends')} className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-lg rounded-t-lg ${getTabButtonStyle('friends')}`}>
                        Mina Vänner ({myFriends.length})
                    </button>
                     <button onClick={() => setActiveTab('requests')} className={`relative whitespace-nowrap py-3 px-4 border-b-2 font-medium text-lg rounded-t-lg ${getTabButtonStyle('requests')}`}>
                        Förfrågningar
                        {incomingRequests.length > 0 && <span className="absolute top-1 right-1 h-5 w-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">{incomingRequests.length}</span>}
                    </button>
                    <button onClick={() => setActiveTab('search')} className={`whitespace-nowrap py-3 px-4 border-b-2 font-medium text-lg rounded-t-lg ${getTabButtonStyle('search')}`}>
                        Sök Medlemmar
                    </button>
                </nav>
            </div>
            
            <div className="flex-grow overflow-y-auto pt-4 pr-2 -mr-2">
                <div role="tabpanel" hidden={activeTab !== 'search'}>
                    <Input placeholder="Sök efter namn..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <ul className="mt-4 space-y-2">
                        {searchResults.map(p => {
                            const status = getConnectionStatus(p.id);
                            return (
                                <li key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                    <div className="flex items-center gap-3">
                                        <Avatar name={p.name} photoURL={p.photoURL} size="md" className="!w-10 !h-10" />
                                        <span className="font-medium text-lg">{p.name}</span>
                                    </div>
                                    {status === 'accepted' && <span className="text-base font-semibold text-green-600">Vänner</span>}
                                    {status === 'pending' && <span className="text-base font-semibold text-yellow-600">Väntar</span>}
                                    {status === null && <Button size="sm" onClick={() => handleSendRequest(p.id)}>Skicka förfrågan</Button>}
                                </li>
                            )
                        })}
                        {searchTerm.trim() && searchResults.length === 0 && (
                            <p className="text-gray-500 text-center pt-4 text-lg">Inga medlemmar hittades.</p>
                        )}
                    </ul>
                </div>

                <div role="tabpanel" hidden={activeTab !== 'friends'}>
                    <ul className="mt-4 space-y-2">
                        {myFriends.length > 0 ? myFriends.map(f => (
                            <li key={f.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                <div className="flex items-center gap-3">
                                    <Avatar name={f.name} photoURL={f.photoURL} size="md" className="!w-10 !h-10" />
                                    <span className="font-medium text-lg">{f.name}</span>
                                </div>
                                <Button size="sm" variant="danger" onClick={() => handleRemoveFriend(f.id)}>Ta bort</Button>
                            </li>
                        )) : <p className="text-gray-500 text-center pt-4 text-lg">Du har inga vänner än. Använd sök för att hitta andra medlemmar!</p>}
                    </ul>
                </div>

                <div role="tabpanel" hidden={activeTab !== 'requests'}>
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">Mottagna förfrågningar</h3>
                            <ul className="space-y-2">
                                {incomingRequests.length > 0 ? incomingRequests.map(r => (
                                    <li key={r.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                        <div className="flex items-center gap-3">
                                            <Avatar name={r.requester.name} photoURL={r.requester.photoURL} size="md" className="!w-10 !h-10" />
                                            <span className="font-medium text-lg">{r.requester.name}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="primary" onClick={() => handleUpdateRequest(r.id, 'accepted')}>Acceptera</Button>
                                            <Button size="sm" variant="secondary" onClick={() => handleUpdateRequest(r.id, 'declined')}>Avböj</Button>
                                        </div>
                                    </li>
                                )) : <p className="text-gray-500 text-center pt-4 text-lg">Inga nya vänförfrågningar.</p>}
                            </ul>
                        </div>

                        <div className="pt-6 border-t">
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">Skickade förfrågningar</h3>
                            <ul className="space-y-2">
                                {outgoingRequests.length > 0 ? outgoingRequests.map(r => (
                                    <li key={r.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                                        <div className="flex items-center gap-3">
                                            <Avatar name={r.receiver.name} photoURL={r.receiver.photoURL} size="md" className="!w-10 !h-10" />
                                            <span className="font-medium text-lg">{r.receiver.name}</span>
                                        </div>
                                        <Button size="sm" variant="danger" onClick={() => handleCancelRequest(r.id)}>Ångra</Button>
                                    </li>
                                )) : <p className="text-gray-500 text-center pt-4 text-lg">Du har inga väntande skickade förfrågningar.</p>}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Modal>
  );
};