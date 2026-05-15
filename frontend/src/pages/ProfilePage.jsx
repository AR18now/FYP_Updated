import React from 'react';
import { Mail, User, Calendar } from 'lucide-react';
import { BrandMark } from '../components/BrandLogo';

/** Read-only view of the locally authenticated user (data comes from `utils/auth` storage). */
const ProfilePage = ({ currentUser }) => {
  const createdLabel = currentUser?.createdAt
    ? new Date(currentUser.createdAt).toLocaleString()
    : 'Not available';

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-6 px-1 sm:px-0">
      <section className="rounded-2xl border border-r2d-border bg-r2d-surfaceElevated shadow-card dark:bg-slate-900/85 dark:border-slate-700 overflow-hidden">
        <div className="px-4 sm:px-6 py-5 lg:px-8 lg:py-6 border-b border-r2d-border/80 dark:border-slate-700/80 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-900/50">
          <div className="flex items-center gap-3">
            <BrandMark className="h-10 w-10 border border-r2d-border/60 dark:border-slate-600" imgClassName="h-full w-full object-contain" />
            <h1 className="text-2xl font-bold text-r2d-primary dark:text-slate-100 tracking-tight">User Profile</h1>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Account details for the active Req2Design session.
          </p>
        </div>
        <div className="p-4 sm:p-6 lg:p-8 space-y-4">
          <div className="rounded-xl border border-r2d-border bg-white dark:bg-slate-900/70 dark:border-slate-700 p-4 flex items-start gap-3">
            <User className="h-5 w-5 text-r2d-accent mt-0.5" />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Username</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{currentUser?.username || 'Guest'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-r2d-border bg-white dark:bg-slate-900/70 dark:border-slate-700 p-4 flex items-start gap-3">
            <Mail className="h-5 w-5 text-r2d-accent mt-0.5" />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{currentUser?.email || 'Not available'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-r2d-border bg-white dark:bg-slate-900/70 dark:border-slate-700 p-4 flex items-start gap-3">
            <Calendar className="h-5 w-5 text-r2d-accent mt-0.5" />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Account Created</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{createdLabel}</p>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
};

export default ProfilePage;
