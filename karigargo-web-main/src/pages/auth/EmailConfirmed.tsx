import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoCheckmarkCircle } from 'react-icons/io5'
import { useAuth } from '../../hooks/useAuth'

function roleHome(role: string) {
  if (role === 'customer') return '/customer/home'
  if (role === 'worker') return '/worker/dashboard'
  if (role === 'admin') return '/admin'
  return '/login'
}

function completionRoute(role: string) {
  if (role === 'customer') return '/complete-profile/customer'
  if (role === 'worker') return '/complete-profile/worker'
  return '/login'
}

export default function EmailConfirmed() {
  const { user, loading } = useAuth()
  const nav = useNavigate()

  useEffect(() => {
    // We wait 3 seconds to let the user read the success message,
    // then navigate them to the correct dashboard based on their role and profile status.
    if (!loading && user) {
      const timeout = setTimeout(() => {
        if (!user.profile_complete) {
          nav(completionRoute(user.role), { replace: true })
        } else {
          nav(roleHome(user.role), { replace: true })
        }
      }, 3000)
      return () => clearTimeout(timeout)
    } else if (!loading && !user) {
      // If for some reason there is no session, boot them to login after a delay
      const timeout = setTimeout(() => nav('/login', { replace: true }), 3000)
      return () => clearTimeout(timeout)
    }
  }, [user, loading, nav])

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 text-center animate-fade-in">
      <div className="w-16 h-16 bg-[#10b981]/10 text-[#10b981] rounded-full flex items-center justify-center mb-4">
        <IoCheckmarkCircle className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-text-primary mb-2">Email Confirmed!</h2>
      <p className="text-text-secondary text-sm mb-8">
        Your email has been successfully verified.
        <br /><br />
        Redirecting you to your dashboard...
      </p>
    </div>
  )
}
