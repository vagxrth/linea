'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import AuthShell, { AuthField } from '@/components/auth-shell'

type Props = {
  email: string
  form: UseFormReturn<{ code: string }>
  onVerify: (data: { code: string }) => void
  onResend: () => void
  onCancel: () => void
  isLoading: boolean
}

// Shown after signing up, or signing in to an account whose email isn't confirmed yet
export default function VerifyEmail({ email, form, onVerify, onResend, onCancel, isLoading }: Props) {

  const { register, handleSubmit, formState: { errors } } = form;

  return (
    <AuthShell
      title="Check your email"
      description={<>We sent an 8-digit code to <span className="font-medium break-all text-foreground">{email}</span>.</>}
      footer={
        <>
          No email?{' '}
          <Button type="button" variant="link" className="h-auto p-0 text-foreground" disabled={isLoading} onClick={onResend}>
            Send a new code
          </Button>
          {' '}or{' '}
          <Button type="button" variant="link" className="h-auto p-0 text-foreground" onClick={onCancel}>
            go back
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onVerify)} className="flex flex-col gap-5">
        <AuthField id="code" label="Code" error={errors.code?.message}>
          <Input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            aria-invalid={!!errors.code}
            aria-describedby={errors.code ? 'code-error' : undefined}
            {...register('code')}
          />
        </AuthField>

        <Button className="mt-1 w-full" size="lg" disabled={isLoading} type="submit">
          {isLoading ? (<><Loader2 className="animate-spin" /> Checking...</>) : 'Confirm email'}
        </Button>
      </form>
    </AuthShell>
  )
}
