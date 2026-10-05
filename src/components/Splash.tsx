export default function Splash() {
  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center">
      <img src="/logo.png" alt="KarigarGo" className="w-20 h-20 rounded-2xl mb-6" />
      <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  )
}
