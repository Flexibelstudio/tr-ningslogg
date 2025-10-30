// src/components/coach/AnalyticsDashboard.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as dateUtils from '../../utils/dateUtils';
import { AnalyticsEvent } from '../../types';

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

export const AnalyticsDashboard: React.FC = () => {
    const { organizationId } = useAuth();
    const [data, setData] = useState<ChartData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!organizationId || !db) {
            setError("Kunde inte ladda data: Organisation saknas.");
            setLoading(false);
            return;
        }

        const thirtyDaysAgo = dateUtils.addDays(new Date(), -30);
        const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);

        const q = query(
            collection(db, 'analyticsEvents'),
            where('orgId', '==', organizationId),
            where('timestamp', '>=', thirtyDaysAgoTimestamp),
            where('type', 'in', ['BOOKING_CREATED', 'BOOKING_CANCELLED', 'CHECKIN']),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const dailyData: { [key: string]: Omit<ChartData, 'date'> } = {};

            querySnapshot.forEach(doc => {
                const event = doc.data() as AnalyticsEvent;
                if (event.timestamp) {
                    const date = event.timestamp.toDate();
                    const dateString = dateUtils.toYYYYMMDD(date);
                    
                    if (!dailyData[dateString]) {
                        dailyData[dateString] = { bookings: 0, cancellations: 0, checkins: 0 };
                    }

                    if (event.type === 'BOOKING_CREATED') {
                        dailyData[dateString].bookings++;
                    } else if (event.type === 'BOOKING_CANCELLED') {
                        dailyData[dateString].cancellations++;
                    } else if (event.type === 'CHECKIN') {
                        dailyData[dateString].checkins++;
                    }
                }
            });

            const chartData: ChartData[] = Object.entries(dailyData)
                .map(([date, counts]) => ({ date, ...counts }))
                .sort((a, b) => a.date.localeCompare(b.date));
            
            setData(chartData);
            setLoading(false);
            setError(null);
        }, (err) => {
            console.error("Error fetching analytics data:", err);
            setError("Kunde inte hämta analysdata. Försök igen senare.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [organizationId]);

    if (loading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return <div className="text-center p-8 text-red-600 bg-red-100 rounded-lg">{error}</div>;
    }

    if (data.length === 0) {
        return <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg">Ingen analysdata har registrerats de senaste 30 dagarna.</div>;
    }

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">30 dagar av aktivitet</h2>
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