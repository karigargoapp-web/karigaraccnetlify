import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'

import Login from './pages/auth/Login'
import WorkerLogin from './pages/auth/WorkerLogin'
import CustomerSignup from './pages/auth/CustomerSignup'
import WorkerSignup from './pages/auth/WorkerSignup'
import EmailConfirmed from './pages/auth/EmailConfirmed'
import CompleteCustomerProfile from './pages/auth/CompleteCustomerProfile'
import CompleteWorkerProfile from './pages/auth/CompleteWorkerProfile'
import ForgotPassword from './pages/auth/ForgotPassword'
import ResetPassword from './pages/auth/ResetPassword'

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
import PendingApproval from './pages/worker/PendingApproval'

import CustomerWallet from './pages/customer/Wallet'
import WorkerWallet from './pages/worker/Wallet'
import AdminLayout from './layouts/AdminLayout'
import AdminDashboard from './pages/admin/Dashboard'
import AdminUsers from './pages/admin/Users'
import AdminWorkers from './pages/admin/Workers'
import AdminWorkerDetail from './pages/admin/WorkerDetail'
import AdminJobs from './pages/admin/Jobs'
import AdminJobDetail from './pages/admin/JobDetail'
import AdminDisputes from './pages/admin/Disputes'
import AdminDisputeDetail from './pages/admin/DisputeDetail'
import AdminWallets from './pages/admin/Wallets'
import AdminRevenue from './pages/admin/Revenue'
import AdminReports from './pages/admin/Reports'

import BrowserNotificationPrompt from './components/BrowserNotificationPrompt'

function roleHome(role: string, approvalStatus?: string) {
  if (role === 'customer') return '/customer/home'
  if (role === 'worker') return approvalStatus === 'approved' ? '/worker/dashboard' : '/worker/pending-approval'
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
  if (!user.profile_complete) return <Navigate to={completionRoute(user.role)} replace />
  if (user.role === 'worker' && user.approval_status !== 'approved') return <Navigate to="/worker/pending-approval" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to={roleHome(user.role, user.approval_status)} replace />
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
    <div className="w-full min-h-screen bg-[#f5f5f5]">
      <Outlet />
    </div>
  )
}

export function AppRouter() {
  return (
    <AuthProvider>
      <BrowserNotificationPrompt />
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
    </AuthProvider>
  )
}
