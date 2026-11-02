'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'
import Google from '@/components/google'
import VerifyEmail from '@/components/verify-email'
import AuthShell, { AuthDivider, AuthField } from '@/components/auth-shell'

export default function SignUpPage() {

  const { signUpForm, handleSignUp, isLoading, verifyingEmail, verifyForm, handleVerifyEmail, resendVerificationCode, cancelVerification } = useAuth();
  const { register, handleSubmit, formState: { errors } } = signUpForm;

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
      title="Create your account"
      description="Start with 10 free credits. No card needed."
      footer={
        <>
          Have an account?{' '}
          <Link href="/auth/signin" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <Google className="w-full" />

      <AuthDivider />

      <form onSubmit={handleSubmit(handleSignUp)} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <AuthField id="firstName" label="First name" error={errors.firstName?.message}>
            <Input
              type="text"
              required
              id="firstName"
              autoComplete="given-name"
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? 'firstName-error' : undefined}
              {...register('firstName')}
            />
          </AuthField>

          <AuthField id="lastName" label="Last name" error={errors.lastName?.message}>
            <Input
              type="text"
              required
              id="lastName"
              autoComplete="family-name"
              aria-invalid={!!errors.lastName}
              aria-describedby={errors.lastName ? 'lastName-error' : undefined}
              {...register('lastName')}
            />
          </AuthField>
        </div>

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

        <AuthField id="password" label="Password" error={errors.password?.message}>
          <Input
            type="password"
            id="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
          />
        </AuthField>

        {errors.root && <p role="alert" className="text-sm text-destructive">{errors.root.message}</p>}

        <Button className="mt-1 w-full" size="lg" disabled={isLoading} type="submit">
          {isLoading ? (<><Loader2 className="animate-spin" /> Creating account...</>) : 'Create account'}
        </Button>
      </form>
    </AuthShell>
  )
}
