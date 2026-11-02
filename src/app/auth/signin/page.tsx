'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'
import Google from '@/components/google'
import VerifyEmail from '@/components/verify-email'
import AuthShell, { AuthDivider, AuthField } from '@/components/auth-shell'

export default function LoginPage() {

  const { signInForm, handleSignIn, isLoading, verifyingEmail, verifyForm, handleVerifyEmail, resendVerificationCode, cancelVerification } = useAuth();
  const { register, handleSubmit, formState: { errors } } = signInForm;

  if (verifyingEmail) {
    return (
      <VerifyEmail
        email={verifyingEmail}
        form={verifyForm}
        onVerify={handleVerifyEmail}
        onResend={resendVerificationCode}
        onCancel={cancelVerification}
        isLoading={isLoading}
      />
    )
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to get back to your canvas."
      footer={
        <>
          New to Linea?{' '}
          <Link href="/auth/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Google className="w-full" />

      <AuthDivider />

      <form onSubmit={handleSubmit(handleSignIn)} className="flex flex-col gap-5">
        <AuthField id="email" label="Email" error={errors.email?.message}>
          <Input
            type="email"
            required
            id="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
          />
        </AuthField>

        <AuthField
          id="password"
          label="Password"
          error={errors.password?.message}
          action={
            <Link href="/auth/reset" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              Forgot password?
            </Link>
          }
        >
          <Input
            type="password"
            id="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
          />
        </AuthField>

        {errors.root && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}

        <Button className="mt-1 w-full" size="lg" disabled={isLoading} type="submit">
          {isLoading ? (<><Loader2 className="animate-spin" /> Signing in...</>) : 'Sign in'}
        </Button>
      </form>
    </AuthShell>
  )
}
