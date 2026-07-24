import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { Sparkles, Phone, CheckCircle2, AlarmClock, GitBranch } from 'lucide-react';
import { dashboardApi, leadsApi } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';
import StatCard from '../components/StatCard';
import FollowUpCard from '../components/FollowUpCard';
import PipelineCard from '../components/PipelineCard';
import PointsBadge, { getNextLevel } from '../components/PointsBadge';
import NewFeaturePopup from '../components/NewFeaturePopup';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const heroRef = useRef(null);
  const progressBarRef = useRef(null);
  const dueSectionRef = useRef(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['user-stats'],
    queryFn: () => dashboardApi.userStats().then((r) => r.data),
  });

  // Daily points are claimed from AppLayout now (fires on any authenticated page,
  // not just this one) — see AppLayout.jsx.

  const { data: dueLeads, isLoading: dueLoading } = useQuery({
    queryKey: ['due-today'],
    queryFn: () => leadsApi.dueToday().then((r) => r.data.leads),
  });

  const { data: pipelineData, isLoading: pipelineLoading } = useQuery({
    queryKey: ['pipeline'],
    queryFn: () => leadsApi.pipeline().then((r) => r.data.leads),
  });

  const points = stats?.currentPoints ?? 0;
  const nextLevel = getNextLevel(points);
  const progressPct = nextLevel ? Math.min(100, Math.round((points / nextLevel.min) * 100)) : 100;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Overdue/due-today vs upcoming split
  const actionableLeads = pipelineData?.filter((l) => l.tag !== 'upcoming') || [];
  const upcomingLeads = pipelineData?.filter((l) => l.tag === 'upcoming') || [];

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(heroRef.current, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' });
    });
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (statsLoading || !progressBarRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        progressBarRef.current,
        { width: '0%' },
        { width: `${progressPct}%`, duration: 1.1, delay: 0.2, ease: 'power3.out' }
      );
    });
    return () => ctx.revert();
  }, [statsLoading, progressPct]);

  useEffect(() => {
    if (dueLoading || !dueSectionRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        dueSectionRef.current.children,
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.08, ease: 'power2.out' }
      );
    });
    return () => ctx.revert();
  }, [dueLoading, dueLeads]);

  return (
    <div className="space-y-6">
      <NewFeaturePopup />
      {/* Hero */}
      <section
        ref={heroRef}
        className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg"
        style={{
          background:
            'radial-gradient(circle at 15% 20%, #4f6fea 0%, transparent 45%), radial-gradient(circle at 85% 0%, #6c4fea 0%, transparent 50%), linear-gradient(135deg, #2f4cc7 0%, #25409e 100%)',
        }}
      >
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[length:18px_18px]" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-brand-100 text-sm">{greeting},</p>
            <h2 className="text-3xl font-extrabold tracking-tight">{user?.name}</h2>
          </div>
          <Link
            to="/leads/new"
            className="bg-white text-brand-700 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-50 hover:scale-[1.03] active:scale-95 transition-transform flex items-center gap-1.5 shadow-md"
          >
            <Sparkles size={16} />
            Log today's work
          </Link>
        </div>
        <div className="relative mt-6">
          <div className="flex items-center justify-between mb-1.5">
            <PointsBadge points={points} />
            {nextLevel && (
              <span className="text-xs text-brand-100 font-medium">
                {nextLevel.min - points} pts to {nextLevel.label}
              </span>
            )}
          </div>
          <div className="w-full h-2.5 bg-white/15 rounded-full overflow-hidden">
            <div ref={progressBarRef} className="h-full bg-gradient-to-r from-white to-brand-100 rounded-full" style={{ width: '0%' }} />
          </div>
        </div>
      </section>

      {/* Due today announcement */}
      <section className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <AlarmClock size={16} className="text-amber-700" />
          <h3 className="text-sm font-semibold text-amber-800">
            Follow-ups due today {dueLeads ? `(${dueLeads.length})` : ''}
          </h3>
        </div>
        {dueLoading && <p className="text-sm text-amber-700">Loading...</p>}
        {!dueLoading && dueLeads?.length === 0 && (
          <p className="text-sm text-amber-700">No follow-ups due today. Inbox zero energy. ✨</p>
        )}
        <div ref={dueSectionRef} className="space-y-2">
          {dueLeads?.map((lead) => (
            <FollowUpCard key={lead._id} lead={lead} />
          ))}
        </div>
      </section>

      {/* Follow-up Pipeline */}
      <section className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitBranch size={16} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-gray-800">
              My Follow-up Pipeline
              {pipelineData && (
                <span className="text-xs font-normal text-gray-400 ml-2">
                  {pipelineData.length} pending
                </span>
              )}
            </h3>
          </div>
        </div>

        {pipelineLoading && <p className="text-sm text-gray-400">Loading...</p>}

        {!pipelineLoading && pipelineData?.length === 0 && (
          <p className="text-sm text-gray-400">No pending follow-ups. Log a lead to get started.</p>
        )}

        {/* Actionable first — overdue + due today with action buttons */}
        {actionableLeads.length > 0 && (
          <div className="space-y-3 mb-4">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Action needed</p>
            {actionableLeads.map((lead) => (
              <PipelineCard
                key={lead._id}
                lead={lead}
                onUpdate={() => queryClient.invalidateQueries({ queryKey: ['pipeline'] })}
              />
            ))}
          </div>
        )}

        {/* Upcoming — informational only, no action buttons yet */}
        {upcomingLeads.length > 0 && (
          <div className="space-y-3">
            {actionableLeads.length > 0 && (
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Upcoming</p>
            )}
            {upcomingLeads.map((lead) => (
              <PipelineCard
                key={lead._id}
                lead={lead}
                onUpdate={() => queryClient.invalidateQueries({ queryKey: ['pipeline'] })}
              />
            ))}
          </div>
        )}
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Leads" value={stats?.totalLeads} loading={statsLoading} icon={Sparkles} index={0} />
        <StatCard label="Talked Today" value={stats?.talkedToday} loading={statsLoading} icon={Phone} index={1} />
        <StatCard label="Follow-ups Closed" value={stats?.closedFollowUps} loading={statsLoading} icon={CheckCircle2} index={2} />
        <StatCard label="Due Now" value={stats?.dueNow} loading={statsLoading} icon={AlarmClock} urgent={stats?.dueNow > 0} index={3} />
      </section>

      <section className="grid grid-cols-2 gap-4">
        <StatCard label="Points This Month" value={stats?.monthlyPoints} loading={statsLoading} accent index={4} />
        <StatCard label="All-Time Points" value={stats?.currentPoints} loading={statsLoading} accent index={5} />
      </section>
    </div>
  );
}