export default function Loading() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full" />
        <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
      <p className="text-gray-500 text-sm tracking-widest uppercase">Loading</p>
    </main>
  )
}
