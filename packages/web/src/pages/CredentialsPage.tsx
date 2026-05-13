import CredentialManager from '@/features/credentials/components/CredentialManager'

export default function CredentialsPage() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">Credentials</h1>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <CredentialManager />
      </section>
    </div>
  )
}
