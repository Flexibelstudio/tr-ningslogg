
// src/components/coach/AnalyticsDashboard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useAppContext } from '../../context/AppContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getAnalyticsDataFn } from '../../firebaseClient';

interface ChartData {
    date: string; // "YYYY-MM-DD" formatted for display
    bookings: number;
    cancellations: number;
    checkins: number;
}

const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-t-2 border-flexibel"></div>
    </div>
);

const AnalyticsDashboard: React.FC = () => {
    const { organizationId } = useAuth();
    const { allOrganizations } = useAppContext();
    const [data, setData] = useState<ChartData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const organizationName = useMemo(() => {
        return allOrganizations.find(org => org.id === organizationId)?.name;
    }, [allOrganizations, organizationId]);

    useEffect(() => {
        if (!organizationId) {
            setError("Kunde inte ladda data: Organisation saknas.");
            setLoading(false);
            return;
        }

        const fetchAnalytics = async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await getAnalyticsDataFn({ orgId: organizationId });
                const resultData = result.data as { data?: ChartData[]; error?: string };

                if (resultData.error) {
                    throw new Error(resultData.error);
                }
                
                if (resultData.data) {
                    setData(resultData.data);
                } else {
                    setData([]);
                }
            } catch (err) {
                console.error("Error fetching analytics data:", err);
                setError("Kunde inte hämta analysdata. Försök igen senare.");
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [organizationId]);

    if (loading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return <div className="text-center p-8 text-red-600 bg-red-100 rounded-lg">{error}</div>;
    }

    if (data.every(d => d.bookings === 0 && d.cancellations === 0 && d.checkins === 0)) {
        return <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg">Ingen analysdata har registrerats de senaste 30 dagarna.</div>;
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">30 dagar av aktivitet – {organizationName}</h2>
            <div style={{ width: '100%', height: 400 }}>
                <ResponsiveContainer>
                    <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(tick) => new Date(tick).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} />
                        <YAxis allowDecimals={false} />
                        <Tooltip
                            labelFormatter={(label) => new Date(label).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}
                            formatter={(value: number, name: string) => [value, name === 'bookings' ? 'Bokningar' : name === 'cancellations' ? 'Avbokningar' : 'Incheckningar']}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="bookings" name="Bokningar" stroke="#3b82f6" strokeWidth={2} activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="cancellations" name="Avbokningar" stroke="#ef4444" strokeWidth={2} activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="checkins" name="Incheckningar" stroke="#22c55e" strokeWidth={2} activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
