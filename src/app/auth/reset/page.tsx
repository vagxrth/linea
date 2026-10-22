'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { usePasswordReset } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'

export default function ResetPasswordPage() {

  const { requestForm, resetForm, email, handleRequestCode, handleResetPassword, startOver, isLoading } = usePasswordReset();
  const { register: registerRequest, handleSubmit: handleRequestSubmit, formState: { errors: requestErrors } } = requestForm;
  const { register: registerReset, handleSubmit: handleResetSubmit, formState: { errors: resetErrors } } = resetForm;

  return (
    <section className="flex min-h-screen bg-zinc-50 px-4 py-16 md:py-32 dark:bg-transparent">
      <form
        onSubmit={email ? handleResetSubmit(handleResetPassword) : handleRequestSubmit(handleRequestCode)}
        className="bg-card m-auto h-fit w-full max-w-sm rounded-[calc(var(--radius)+.125rem)] border p-0.5 shadow-md dark:[--color-muted:var(--color-zinc-900)]">
        <div className="p-8 pb-6">
          <div className="flex items-center gap-3 mb-4">
            <Link
              href="/"
              aria-label="go home"
              className="shrink-0">
              <Image src="/images/logo.webp" alt="Linea" width={75} height={75} className="rounded-lg" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Reset your password</h1>
              {email ? (
                <p className="text-sm">If <span className="font-medium break-all">{email}</span> has a Linea account, we sent it an 8-digit code</p>
              ) : (
                <p className="text-sm">We&apos;ll email you a code to set a new one</p>
              )}
            </div>
          </div>

          {email ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label
                  htmlFor="code"
                  className="block text-sm">
                  Code
                </Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  {...registerReset('code')}
                  className={resetErrors.code ? 'border-destructive' : ''}
                />
                {resetErrors.code && <p className="text-sm text-destructive">{resetErrors.code.message}</p>}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="newPassword"
                  className="block text-sm">
                  New Password
                </Label>
                <Input
                  type="password"
                  id="newPassword"
                  autoComplete="new-password"
                  {...registerReset('newPassword')}
                  className={resetErrors.newPassword ? 'border-destructive' : ''}
                />
                {resetErrors.newPassword && <p className="text-sm text-destructive">{resetErrors.newPassword.message}</p>}
              </div>

              <Button className="w-full" disabled={isLoading} type="submit">
                {isLoading ? (<> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving... </>) : ('Set New Password')}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="block text-sm">
                  Email
                </Label>
                <Input
                  type="email"
                  required
                  id="email"
                  autoFocus
                  {...registerRequest('email')}
                  className={requestErrors.email ? 'border-destructive' : ''}
                />
                {requestErrors.email && <p className="text-sm text-destructive">{requestErrors.email.message}</p>}
              </div>

              <Button className="w-full" disabled={isLoading} type="submit">
                {isLoading ? (<> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending... </>) : ('Send Code')}
              </Button>
            </div>
          )}
        </div>

        <div className="bg-muted rounded-(--radius) border p-3">
          {email ? (
            <p className="text-accent-foreground text-center text-sm">
              No email?
              <Button
                type="button"
                variant="link"
                className="px-2"
                disabled={isLoading}
                onClick={() => handleRequestCode({ email })}>
                Send a new code
              </Button>
              or
              <Button
                type="button"
                variant="link"
                className="px-2"
                onClick={startOver}>
                use another email
              </Button>
            </p>
          ) : (
            <p className="text-accent-foreground text-center text-sm">
              Remembered it?
              <Button
                asChild
                variant="link"
                className="px-2">
                <Link href="/auth/signin">Sign In</Link>
              </Button>
            </p>
          )}
        </div>
      </form>
    </section>
  )
}
