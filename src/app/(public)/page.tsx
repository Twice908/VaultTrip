import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">VaultTrip</h1>
      <p className="max-w-md text-slate-400">
        Every travel document. Every trip. Always ready — even offline.
      </p>
      <Link
        href="/sign-in"
        className="rounded-lg bg-blue-500 px-6 py-3 font-medium text-white"
      >
        Sign in
      </Link>
    </main>
  )
}
