
import React, { useMemo } from 'react';
import { useCoachData } from '../../features/coach/hooks/useCoachData';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell 
} from 'recharts';
import { startOfWeek, endOfWeek, subDays, format, getDay, getHours, parseISO, isSameDay } from 'date-fns';
import { sv } from 'date-fns/locale';
import { STAFF_ROLE_OPTIONS } from '../../constants';

// --- HELPER COMPONENTS ---

const KpiCard: React.FC<{ title: string; value: string | number; subtitle: string; trend?: 'up' | 'down' | 'neutral'; color: string; icon: React.ReactNode }> = ({ title, value, subtitle, trend, color, icon }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between">
    <div>
      <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-3xl font-extrabold text-gray-900">{value}</h3>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </div>
    <div className={`p-3 rounded-xl bg-opacity-10 ${color} text-${color.replace('bg-', '').replace('text-', '')}`}>
      {icon}
    </div>
  </div>
);

const SectionHeader: React.FC<{ title: string; description?: string }> = ({ title, description }) => (
  <div className="mb-4">
    <h3 className="text-lg font-bold text-gray-800">{title}</h3>
    {description && <p className="text-sm text-gray-500">{description}</p>}
  </div>
);

// --- ICONS ---
const ChartIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>;
const StarIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.846 5.671a1 1 0 00.95.69h5.969c.969 0 1.371 1.24.588 1.81l-4.836 3.522a1 1 0 00-.364 1.118l1.846 5.671c.3.921-.755 1.688-1.54 1.118l-4.836-3.522a1 1 0 00-1.176 0l-4.836 3.522c-.784.57-1.838-.197-1.539-1.118l1.846-5.671a1 1 0 00-.364-1.118L2.98 11.11c-.783-.57-.38-1.81.588-1.81h5.969a1 1 0 00.95-.69L11.049 2.927z" /></svg>;
const UsersIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const FireIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7.014A8.003 8.003 0 0122 12c0 3.771-2.5 7-6.5 7a8.003 8.003 0 01-2.843-.543z" /></svg>;

// --- MAIN COMPONENT ---

const AnalyticsDashboard: React.FC = () => {
    const { 
        workoutLogsForView, 
        participantBookings, 
        participantsForView, 
        workouts, 
        groupClassSchedules 
    } = useCoachData();

    // --- DATA PROCESSING ---

    // 1. KPI Calculations (Last 30 Days)
    const stats = useMemo(() => {
        const thirtyDaysAgo = subDays(new Date(), 30);
        
        // Filter logs and bookings
        const recentLogs = workoutLogsForView.filter(l => new Date(l.completedDate) >= thirtyDaysAgo);
        const recentBookings = participantBookings.filter(b => new Date(b.bookingDate) >= thirtyDaysAgo && (b.status === 'BOOKED' || b.status === 'CHECKED-IN'));

        // A. Activity Level
        const activeMembersCount = participantsForView.filter(p => p.isActive).length || 1;
        const totalSessions = recentLogs.length;
        const avgSessionsPerWeek = ((totalSessions / 4) / activeMembersCount).toFixed(1);

        // B. Mood Score
        const ratedLogs = recentLogs.filter(l => l.moodRating);
        const avgMood = ratedLogs.length > 0 
            ? (ratedLogs.reduce((acc, l) => acc + (l.moodRating || 0), 0) / ratedLogs.length).toFixed(1) 
            : '-';

        // C. Occupancy (Beläggning) on Classes
        // Filter schedules that happened in the last 30 days
        // This is an approximation. For strict accuracy we would need every historical instance.
        // Here we look at bookings made in the last 30 days against capacity.
        // A simpler proxy for "Busyness":
        const occupancyRate = 'N/A'; // Complex to calc accurately without instance history backend. 
        // Alternative: Attendance Rate (Checked-in / Booked)
        const checkedIn = recentBookings.filter(b => b.status === 'CHECKED-IN').length;
        const totalBooked = recentBookings.length;
        const showRate = totalBooked > 0 ? Math.round((checkedIn / totalBooked) * 100) : 0;

        // D. Risk Groups (Inactive > 21 days)
        const riskCount = participantsForView.filter(p => {
             if (!p.isActive || p.isProspect) return false;
             const lastLog = workoutLogsForView
                .filter(l => l.participantId === p.id)
                .sort((a,b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())[0];
             if (!lastLog) return true; // Never active
             return (new Date().getTime() - new Date(lastLog.completedDate).getTime()) / (1000 * 60 * 60 * 24) > 21;
        }).length;

        return {
            avgSessionsPerWeek,
            avgMood,
            showRate,
            riskCount,
            activeMembers: activeMembersCount
        };
    }, [workoutLogsForView, participantBookings, participantsForView]);

    // 2. Heatmap Data (Booking frequency by Day/Hour)
    const heatmapData = useMemo(() => {
        // Initialize grid: 7 days x 15 hours (06:00 - 20:00 approx)
        const grid: { day: number; hour: number; value: number }[] = [];
        const hoursOfInterest = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
        
        // Flatten bookings to get counts
        const counts: Record<string, number> = {};
        
        participantBookings.forEach(b => {
             // Use classDate and schedule startTime to determine slot
             const schedule = groupClassSchedules.find(s => s.id === b.scheduleId);
             if (!schedule) return;
             
             const [h] = schedule.startTime.split(':').map(Number);
             const date = new Date(b.classDate);
             const day = getDay(date); // 0=Sun, 1=Mon...
             // Adjust to Mon=0, Sun=6 for visualization if needed, or keep JS standard
             // Let's use JS standard 0-6 (Sun-Sat) but display labels correctly
             
             const key = `${day}-${h}`;
             counts[key] = (counts[key] || 0) + 1;
        });

        // Normalize for visualization
        let maxVal = 0;
        Object.values(counts).forEach(v => maxVal = Math.max(maxVal, v));

        return hoursOfInterest.map(hour => {
            const daysData: any = { hour: `${hour}:00` };
            [1, 2, 3, 4, 5, 6, 0].forEach(day => { // Order: Mon -> Sun
                 const val = counts[`${day}-${hour}`] || 0;
                 daysData[`day${day}`] = val;
                 daysData[`opacity${day}`] = maxVal > 0 ? (val / maxVal) : 0;
            });
            return daysData;
        });
    }, [participantBookings, groupClassSchedules]);

    // 3. Workout Ratings (Top Lists)
    const workoutRatings = useMemo(() => {
        const ratingsMap: Record<string, { total: number; count: number }> = {};
        
        workoutLogsForView.forEach(log => {
            if (log.moodRating) {
                const workout = workouts.find(w => w.id === log.workoutId);
                const title = workout?.title || 'Okänt pass'; // Use 'Okänt pass' or fallback if deleted
                // Group by generic title to catch templates
                const cleanTitle = title.split('(')[0].trim(); 
                
                if (!ratingsMap[cleanTitle]) ratingsMap[cleanTitle] = { total: 0, count: 0 };
                ratingsMap[cleanTitle].total += log.moodRating;
                ratingsMap[cleanTitle].count += 1;
            }
        });

        return Object.entries(ratingsMap)
            .map(([name, data]) => ({
                name,
                avgRating: (data.total / data.count).toFixed(1),
                count: data.count
            }))
            .filter(item => item.count >= 3) // Only show classes with at least 3 ratings to avoid noise
            .sort((a, b) => Number(b.avgRating) - Number(a.avgRating))
            .slice(0, 7); // Top 7
    }, [workoutLogsForView, workouts]);

    // 4. Recent Feedback Stream
    const recentFeedback = useMemo(() => {
        return workoutLogsForView
            .filter(l => l.postWorkoutComment && l.postWorkoutComment.length > 2)
            .sort((a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime())
            .slice(0, 10)
            .map(l => {
                const workout = workouts.find(w => w.id === l.workoutId);
                const member = participantsForView.find(p => p.id === l.participantId);
                return {
                    id: l.id,
                    comment: l.postWorkoutComment,
                    rating: l.moodRating,
                    workoutName: workout?.title || 'Pass',
                    memberName: member?.name || 'Anonym',
                    date: l.completedDate,
                };
            });
    }, [workoutLogsForView, workouts, participantsForView]);

    const getRatingColor = (rating?: number) => {
        if (!rating) return 'bg-gray-100 text-gray-500';
        if (rating >= 4.5) return 'bg-green-100 text-green-800';
        if (rating >= 3.5) return 'bg-blue-100 text-blue-800';
        if (rating >= 2.5) return 'bg-yellow-100 text-yellow-800';
        return 'bg-red-100 text-red-800';
    };

    return (
        <div className="space-y-8 animate-fade-in">
            
            {/* 1. HEADLINE KPIS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard 
                    title="Aktivitet" 
                    value={stats.avgSessionsPerWeek} 
                    subtitle="Pass / vecka & medlem" 
                    color="bg-blue-50"
                    icon={<FireIcon />}
                />
                <KpiCard 
                    title="Nöjdhet" 
                    value={stats.avgMood} 
                    subtitle="Snittbetyg (1-5)" 
                    color="bg-yellow-50"
                    icon={<StarIcon />}
                />
                <KpiCard 
                    title="Närvaro" 
                    value={`${stats.showRate}%`} 
                    subtitle="Show-rate (Bokad vs Incheckad)" 
                    color="bg-green-50"
                    icon={<UsersIcon />}
                />
                <KpiCard 
                    title="Riskzon" 
                    value={stats.riskCount} 
                    subtitle="Inaktiva > 21 dagar" 
                    color="bg-red-50"
                    icon={<span className="text-2xl">⚠️</span>}
                />
            </div>

            {/* 2. CHARTS ROW: TRENDS & HEATMAP */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                 {/* HEATMAP */}
                 <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
                    <SectionHeader title="Beläggnings-Heatmap" description="När är det högst tryck i verksamheten? (Mörkare färg = fler bokningar)" />
                    <div className="overflow-x-auto">
                        <div className="min-w-[600px]">
                             <div className="grid grid-cols-[50px_repeat(7,_1fr)] gap-1 mb-2">
                                <div className="text-xs font-bold text-gray-400"></div>
                                {['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'].map(d => (
                                    <div key={d} className="text-center text-xs font-bold text-gray-500 uppercase">{d}</div>
                                ))}
                             </div>
                             <div className="space-y-1">
                                {heatmapData.map((row, i) => (
                                    <div key={i} className="grid grid-cols-[50px_repeat(7,_1fr)] gap-1 items-center">
                                        <div className="text-xs font-medium text-gray-400 text-right pr-2">{row.hour}</div>
                                        {[1, 2, 3, 4, 5, 6, 0].map(day => {
                                            const opacity = row[`opacity${day}`];
                                            const val = row[`day${day}`];
                                            return (
                                                <div 
                                                    key={day} 
                                                    className="h-8 rounded-sm transition-all hover:ring-2 ring-flexibel relative group"
                                                    style={{ backgroundColor: `rgba(59, 171, 90, ${Math.max(0.05, opacity)})` }} // using brand color
                                                >
                                                    {val > 0 && (
                                                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block bg-black text-white text-xs rounded px-2 py-1 z-10 whitespace-nowrap shadow-lg">
                                                            {val} bokningar
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))}
                             </div>
                        </div>
                    </div>
                </div>

                {/* CLASS RATINGS */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <SectionHeader title="Pass-toppen" description="Högst snittbetyg (min. 3 röster)" />
                    <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart layout="vertical" data={workoutRatings} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" domain={[0, 5]} hide />
                                <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 11}} />
                                <Tooltip cursor={{fill: 'transparent'}} />
                                <Bar dataKey="avgRating" fill="#3bab5a" radius={[0, 4, 4, 0]} barSize={20}>
                                    {workoutRatings.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={Number(entry.avgRating) > 4.5 ? '#3bab5a' : '#fbbf24'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 3. VOICE OF CUSTOMER */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <SectionHeader title="Röster från medlemmarna" description="Senaste feedbacken från loggade pass" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto pr-2">
                    {recentFeedback.length === 0 ? (
                        <p className="text-gray-500 italic">Ingen feedback än.</p>
                    ) : (
                        recentFeedback.map(fb => (
                            <div key={fb.id} className="p-4 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${getRatingColor(fb.rating)}`}>
                                        {fb.rating ? `${fb.rating}/5` : '-'}
                                    </span>
                                    <span className="text-xs text-gray-400">{format(new Date(fb.date), 'd MMM', { locale: sv })}</span>
                                </div>
                                <p className="text-sm text-gray-800 font-medium italic mb-3">"{fb.comment}"</p>
                                <div className="flex justify-between items-end mt-auto">
                                    <div className="text-xs text-gray-500">
                                        <p className="font-semibold text-gray-700">{fb.memberName}</p>
                                        <p>{fb.workoutName}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

        </div>
    );
};

export default AnalyticsDashboard;
