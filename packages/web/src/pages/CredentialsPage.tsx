import CredentialManager from '@/components/settings/CredentialManager'

export default function CredentialsPage() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-xl font-bold text-gray-900">Credentials</h1>
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <CredentialManager />
      </section>
    </div>
  )
}
