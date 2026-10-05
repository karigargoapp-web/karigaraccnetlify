import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'

import Login from './pages/auth/Login'
import WorkerLogin from './pages/auth/WorkerLogin'
const CustomerSignup = lazy(() => import('./pages/auth/CustomerSignup'))
const WorkerSignup = lazy(() => import('./pages/auth/WorkerSignup'))
const EmailConfirmed = lazy(() => import('./pages/auth/EmailConfirmed'))
const CompleteCustomerProfile = lazy(() => import('./pages/auth/CompleteCustomerProfile'))
const CompleteWorkerProfile = lazy(() => import('./pages/auth/CompleteWorkerProfile'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))

const CustomerHome = lazy(() => import('./pages/customer/Home'))
const PostJob = lazy(() => import('./pages/customer/PostJob'))
const CustomerMyJobs = lazy(() => import('./pages/customer/MyJobs'))
const CustomerJobDetail = lazy(() => import('./pages/customer/JobDetail'))
const CustomerActiveJob = lazy(() => import('./pages/customer/ActiveJob'))
const CustomerReceipt = lazy(() => import('./pages/customer/Receipt'))
const ReviewWorker = lazy(() => import('./pages/customer/ReviewWorker'))
const ViewWorkerProfile = lazy(() => import('./pages/customer/WorkerProfile'))
const CustomerProfile = lazy(() => import('./pages/customer/Profile'))
const CustomerMessages = lazy(() => import('./pages/customer/Messages'))
const ChangePassword = lazy(() => import('./pages/customer/ChangePassword'))
const CustomerNotifications = lazy(() => import('./pages/customer/Notifications'))
const CustomerPersonalInfo = lazy(() => import('./pages/customer/PersonalInfo'))
const CustomerJobSummary = lazy(() => import('./pages/customer/JobSummary'))
const TrackingScreen = lazy(() => import('./pages/customer/TrackingScreen'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const HelpSupport = lazy(() => import('./pages/shared/HelpSupport'))
const LanguageSelection = lazy(() => import('./pages/shared/LanguageSelection'))

const WorkerDashboard = lazy(() => import('./pages/worker/Dashboard'))
const JobBid = lazy(() => import('./pages/worker/JobBid'))
const WorkerActiveJob = lazy(() => import('./pages/worker/ActiveJob'))
const WorkerMyBids = lazy(() => import('./pages/worker/MyBids'))
const WorkerEarnings = lazy(() => import('./pages/worker/Earnings'))
const WorkerReviews = lazy(() => import('./pages/worker/ReviewsReceived'))
const ReviewCustomer = lazy(() => import('./pages/worker/ReviewCustomer'))
const WorkerProfile = lazy(() => import('./pages/worker/Profile'))
const WorkerMessages = lazy(() => import('./pages/worker/Messages'))
const WorkerChangePassword = lazy(() => import('./pages/worker/ChangePassword'))
const WorkerPersonalInfo = lazy(() => import('./pages/worker/PersonalInfo'))
const WorkerJobSummary = lazy(() => import('./pages/worker/JobSummary'))
const PendingApproval = lazy(() => import('./pages/worker/PendingApproval'))

const CustomerWallet = lazy(() => import('./pages/customer/Wallet'))
const WorkerWallet = lazy(() => import('./pages/worker/Wallet'))
const AdminLayout = lazy(() => import('./layouts/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
const AdminWorkers = lazy(() => import('./pages/admin/Workers'))
const AdminWorkerDetail = lazy(() => import('./pages/admin/WorkerDetail'))
const AdminJobs = lazy(() => import('./pages/admin/Jobs'))
const AdminJobDetail = lazy(() => import('./pages/admin/JobDetail'))
const AdminDisputes = lazy(() => import('./pages/admin/Disputes'))
const AdminDisputeDetail = lazy(() => import('./pages/admin/DisputeDetail'))
const AdminWallets = lazy(() => import('./pages/admin/Wallets'))
const AdminRevenue = lazy(() => import('./pages/admin/Revenue'))
const AdminReports = lazy(() => import('./pages/admin/Reports'))

import BrowserNotificationPrompt from './components/BrowserNotificationPrompt'

function roleHome(role: string, approvalStatus?: string) {
  if (role === 'customer') return '/customer/home'
  if (role === 'worker') return approvalStatus === 'approved' ? '/worker/dashboard' : '/worker/pending-approval'
  if (role === 'admin') return '/admin'
  return '/login'
}

function completionRoute(role: string) {
  if (role === 'customer') return '/complete-profile/customer'
  if (role === 'worker') return '/complete-profile/worker'
  return '/login'
}

function ProtectedRoute({ allowedRoles }: { allowedRoles?: string[] }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-surface">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (!user.profile_complete) return <Navigate to={completionRoute(user.role)} replace />
  if (user.role === 'worker' && user.approval_status !== 'approved') return <Navigate to="/worker/pending-approval" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to={roleHome(user.role, user.approval_status)} replace />
  return <Outlet />
}

function AuthRoute() {
  const { user, loading } = useAuth()
  // Only show spinner on true initial load (no user yet and still loading)
  if (loading && !user) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm text-text-secondary">Loading...</p>
    </div>
  )
  if (user) {
    if (!user.profile_complete) return <Navigate to={completionRoute(user.role)} replace />
    return <Navigate to={roleHome(user.role, user.approval_status)} replace />
  }
  return <Outlet />
}

function ProfileCompletionRoute() {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-surface">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.profile_complete) return <Navigate to={roleHome(user.role, user.approval_status)} replace />
  return <Outlet />
}

function AppShell() {
  return (
    <div className="app-shell">
      <Outlet />
    </div>
  )
}

export function AppRouter() {
  return (
    <AuthProvider>
      <BrowserNotificationPrompt />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
      <Routes>

        <Route element={<AppShell />}>
          <Route element={<AuthRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/login/worker" element={<WorkerLogin />} />
            <Route path="/signup/customer" element={<CustomerSignup />} />
          </Route>

          <Route path="/signup/worker" element={<WorkerSignup />} />
          <Route path="/email-confirmed" element={<EmailConfirmed />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/worker/pending-approval" element={<PendingApproval />} />

          <Route element={<ProfileCompletionRoute />}>
            <Route path="/complete-profile/customer" element={<CompleteCustomerProfile />} />
            <Route path="/complete-profile/worker" element={<CompleteWorkerProfile />} />
          </Route>

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
            <Route path="/customer/wallet" element={<CustomerWallet />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/customer/messages" element={<CustomerMessages />} />
            <Route path="/customer/notifications" element={<CustomerNotifications />} />
            <Route path="/customer/change-password" element={<ChangePassword />} />
            <Route path="/customer/personal-info" element={<CustomerPersonalInfo />} />
            <Route path="/chat/:jobId" element={<ChatPage />} />
            <Route path="/help-support" element={<HelpSupport />} />
            <Route path="/language" element={<LanguageSelection />} />
          </Route>

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
            <Route path="/worker/wallet" element={<WorkerWallet />} />
            <Route path="/worker/change-password" element={<WorkerChangePassword />} />
            <Route path="/worker/personal-info" element={<WorkerPersonalInfo />} />
            <Route path="/worker/job-summary/:jobId" element={<WorkerJobSummary />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/workers" element={<AdminWorkers />} />
            <Route path="/admin/workers/:workerId" element={<AdminWorkerDetail />} />
            <Route path="/admin/jobs" element={<AdminJobs />} />
            <Route path="/admin/jobs/:jobId" element={<AdminJobDetail />} />
            <Route path="/admin/disputes" element={<AdminDisputes />} />
            <Route path="/admin/disputes/:disputeId" element={<AdminDisputeDetail />} />
            <Route path="/admin/wallets" element={<AdminWallets />} />
            <Route path="/admin/revenue" element={<AdminRevenue />} />
            <Route path="/admin/reports" element={<AdminReports />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
      </Suspense>
    </AuthProvider>
  )
}
