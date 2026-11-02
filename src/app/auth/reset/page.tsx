'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { usePasswordReset } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'
import AuthShell, { AuthField } from '@/components/auth-shell'

export default function ResetPasswordPage() {

  const { requestForm, resetForm, email, handleRequestCode, handleResetPassword, startOver, isLoading } = usePasswordReset();
  const { register: registerRequest, handleSubmit: handleRequestSubmit, formState: { errors: requestErrors } } = requestForm;
  const { register: registerReset, handleSubmit: handleResetSubmit, formState: { errors: resetErrors } } = resetForm;

  return (
    <AuthShell
      title="Reset your password"
      description={email ? (
        <>If <span className="font-medium break-all text-foreground">{email}</span> has a Linea account, we sent it an 8-digit code.</>
      ) : (
        <>We&apos;ll email you a code to set a new one.</>
      )}
      footer={email ? (
        <>
          No email?{' '}
          <Button type="button" variant="link" className="h-auto p-0 text-foreground" disabled={isLoading} onClick={() => handleRequestCode({ email })}>
            Send a new code
          </Button>
          {' '}or{' '}
          <Button type="button" variant="link" className="h-auto p-0 text-foreground" onClick={startOver}>
            use another email
          </Button>
        </>
      ) : (
        <>
          Remembered it?{' '}
          <Link href="/auth/signin" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      )}
    >
      {email ? (
        <form onSubmit={handleResetSubmit(handleResetPassword)} className="flex flex-col gap-5">
          <AuthField id="code" label="Code" error={resetErrors.code?.message}>
            <Input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              aria-invalid={!!resetErrors.code}
              aria-describedby={resetErrors.code ? 'code-error' : undefined}
              {...registerReset('code')}
            />
          </AuthField>

          <AuthField id="newPassword" label="New password" error={resetErrors.newPassword?.message}>
            <Input
              type="password"
              id="newPassword"
              autoComplete="new-password"
              aria-invalid={!!resetErrors.newPassword}
              aria-describedby={resetErrors.newPassword ? 'newPassword-error' : undefined}
              {...registerReset('newPassword')}
            />
          </AuthField>

          <Button className="mt-1 w-full" size="lg" disabled={isLoading} type="submit">
            {isLoading ? (<><Loader2 className="animate-spin" /> Saving...</>) : 'Set new password'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleRequestSubmit(handleRequestCode)} className="flex flex-col gap-5">
          <AuthField id="email" label="Email" error={requestErrors.email?.message}>
            <Input
              type="email"
              required
              id="email"
              autoComplete="email"
              autoFocus
              aria-invalid={!!requestErrors.email}
              aria-describedby={requestErrors.email ? 'email-error' : undefined}
              {...registerRequest('email')}
            />
          </AuthField>

          <Button className="mt-1 w-full" size="lg" disabled={isLoading} type="submit">
            {isLoading ? (<><Loader2 className="animate-spin" /> Sending...</>) : 'Send code'}
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
