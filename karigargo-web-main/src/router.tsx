import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'

// Auth
import Login from './pages/auth/Login'
import WorkerLogin from './pages/auth/WorkerLogin'
import CustomerSignup from './pages/auth/CustomerSignup'
import WorkerSignup from './pages/auth/WorkerSignup'
import EmailConfirmed from './pages/auth/EmailConfirmed'

// Customer
import CustomerHome from './pages/customer/Home'
import PostJob from './pages/customer/PostJob'
import CustomerMyJobs from './pages/customer/MyJobs'
import CustomerJobDetail from './pages/customer/JobDetail'
import CustomerActiveJob from './pages/customer/ActiveJob'
import CustomerReceipt from './pages/customer/Receipt'
import ReviewWorker from './pages/customer/ReviewWorker'
import ViewWorkerProfile from './pages/customer/WorkerProfile'
import CustomerProfile from './pages/customer/Profile'
import CustomerMessages from './pages/customer/Messages'
import ChangePassword from './pages/customer/ChangePassword'
import CustomerNotifications from './pages/customer/Notifications'
import CustomerPersonalInfo from './pages/customer/PersonalInfo'
import CustomerJobSummary from './pages/customer/JobSummary'
import TrackingScreen from './pages/customer/TrackingScreen'
import ChatPage from './pages/ChatPage'
import HelpSupport from './pages/shared/HelpSupport'
import LanguageSelection from './pages/shared/LanguageSelection'

// Worker
import WorkerDashboard from './pages/worker/Dashboard'
import JobBid from './pages/worker/JobBid'
import WorkerActiveJob from './pages/worker/ActiveJob'
import WorkerMyBids from './pages/worker/MyBids'
import WorkerEarnings from './pages/worker/Earnings'
import WorkerReviews from './pages/worker/ReviewsReceived'
import ReviewCustomer from './pages/worker/ReviewCustomer'
import WorkerProfile from './pages/worker/Profile'
import WorkerMessages from './pages/worker/Messages'
import WorkerChangePassword from './pages/worker/ChangePassword'
import WorkerPersonalInfo from './pages/worker/PersonalInfo'
import WorkerJobSummary from './pages/worker/JobSummary'

// Admin
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminJobs from './pages/admin/Jobs'
import AdminRevenue from './pages/admin/Revenue'
import AdminReports from './pages/admin/Reports'
import BrowserNotificationPrompt from './components/BrowserNotificationPrompt'
import CompleteCustomerProfile from './pages/auth/CompleteCustomerProfile'
import CompleteWorkerProfile from './pages/auth/CompleteWorkerProfile'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'

function roleHome(role: string) {
  if (role === 'customer') return '/customer/home'
  if (role === 'worker') return '/worker/dashboard'
  if (role === 'admin') return '/admin'
  return '/login'
}

function completionRoute(role: string) {
  if (role === 'customer') return '/complete-profile/customer'
  if (role === 'worker') return '/signup/worker'
  return '/login'
}

function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-surface">Loading...</div>
  if (!user) return <Navigate to="/login" replace />

  // Google OAuth users who haven't filled CNIC yet
  if (!user.profile_complete) {
    return <Navigate to={completionRoute(user.role)} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />
  }
  return <Outlet />
}

function AuthRoute() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm text-text-secondary">Loading...</p>
    </div>
  )
  if (user) {
    if (!user.profile_complete) return <Navigate to={completionRoute(user.role)} replace />
    return <Navigate to={roleHome(user.role)} replace />
  }
  return <Outlet />
}

/** Requires login but does NOT enforce profile_complete (used for completion pages themselves). */
function ProfileCompletionRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-surface">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  // Already complete → send them home
  if (user.profile_complete) return <Navigate to={roleHome(user.role)} replace />
  return <Outlet />
}

export function AppRouter() {
  return (
    <AuthProvider>
      <BrowserNotificationPrompt />
      <Routes>
        {/* Public / Auth routes */}
        <Route element={<AuthRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/login/worker" element={<WorkerLogin />} />
          <Route path="/signup/customer" element={<CustomerSignup />} />
        </Route>

        {/* Worker signup — accessible to unauthenticated users AND workers with profile_complete=false */}
        <Route path="/signup/worker" element={<WorkerSignup />} />

        {/* Email confirmation - accessible without auth check */}
        <Route path="/email-confirmed" element={<EmailConfirmed />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Profile completion (logged in but profile_complete = false) */}
        <Route element={<ProfileCompletionRoute />}>
          <Route path="/complete-profile/customer" element={<CompleteCustomerProfile />} />
          <Route path="/complete-profile/worker" element={<CompleteWorkerProfile />} />
        </Route>

        {/* Customer routes */}
        <Route element={<ProtectedRoute allowedRoles={['customer']} />}>
          <Route path="/customer/home" element={<CustomerHome />} />
          <Route path="/customer/post-job" element={<PostJob />} />
          <Route path="/customer/my-jobs" element={<CustomerMyJobs />} />
          <Route path="/customer/job/:jobId" element={<CustomerJobDetail />} />
          <Route path="/customer/active-job/:jobId" element={<CustomerActiveJob />} />
          <Route path="/customer/receipt/:jobId" element={<CustomerReceipt />} />
          <Route path="/customer/review/:jobId" element={<ReviewWorker />} />
          <Route path="/customer/worker/:workerId" element={<ViewWorkerProfile />} />
          <Route path="/customer/job-summary/:jobId" element={<CustomerJobSummary />} />
          <Route path="/customer/tracking/:jobId" element={<TrackingScreen />} />
          <Route path="/customer/profile" element={<CustomerProfile />} />
        </Route>

        {/* Shared chat route — accessible to any authenticated user */}
        <Route element={<ProtectedRoute />}>
          <Route path="/customer/messages" element={<CustomerMessages />} />
          <Route path="/customer/notifications" element={<CustomerNotifications />} />
          <Route path="/customer/change-password" element={<ChangePassword />} />
          <Route path="/customer/personal-info" element={<CustomerPersonalInfo />} />
          <Route path="/chat/:jobId" element={<ChatPage />} />
        </Route>

        {/* Shared help and language routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/help-support" element={<HelpSupport />} />
          <Route path="/language" element={<LanguageSelection />} />
        </Route>

        {/* Worker routes */}
        <Route element={<ProtectedRoute allowedRoles={['worker']} />}>
          <Route path="/worker/dashboard" element={<WorkerDashboard />} />
          <Route path="/worker/job/:jobId" element={<JobBid />} />
          <Route path="/worker/active-job/:jobId" element={<WorkerActiveJob />} />
          <Route path="/worker/my-bids" element={<WorkerMyBids />} />
          <Route path="/worker/earnings" element={<WorkerEarnings />} />
          <Route path="/worker/reviews" element={<WorkerReviews />} />
          <Route path="/worker/review-customer/:jobId" element={<ReviewCustomer />} />
          <Route path="/worker/messages" element={<WorkerMessages />} />
          <Route path="/worker/profile" element={<WorkerProfile />} />
          <Route path="/worker/change-password" element={<WorkerChangePassword />} />
          <Route path="/worker/personal-info" element={<WorkerPersonalInfo />} />
          <Route path="/worker/job-summary/:jobId" element={<WorkerJobSummary />} />
        </Route>

        {/* Admin routes */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/jobs" element={<AdminJobs />} />
          <Route path="/admin/revenue" element={<AdminRevenue />} />
          <Route path="/admin/reports" element={<AdminReports />} />
        </Route>

        {/* Default redirect */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  )
}
