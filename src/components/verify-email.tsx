'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import Image from 'next/image'
import { UseFormReturn } from 'react-hook-form'

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
    <section className="flex min-h-screen bg-zinc-50 px-4 py-16 md:py-32 dark:bg-transparent">
      <form
        onSubmit={handleSubmit(onVerify)}
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
              <h1 className="text-xl font-semibold">Check your email</h1>
              <p className="text-sm">We sent an 8-digit code to <span className="font-medium break-all">{email}</span></p>
            </div>
          </div>

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
                {...register('code')}
                className={errors.code ? 'border-destructive' : ''}
              />
              {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
            </div>

            <Button className="w-full" disabled={isLoading} type="submit">
              {isLoading ? (<> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking... </>) : ('Confirm Email')}
            </Button>
          </div>
        </div>

        <div className="bg-muted rounded-(--radius) border p-3">
          <p className="text-accent-foreground text-center text-sm">
            No email?
            <Button
              type="button"
              variant="link"
              className="px-2"
              disabled={isLoading}
              onClick={onResend}>
              Send a new code
            </Button>
            or
            <Button
              type="button"
              variant="link"
              className="px-2"
              onClick={onCancel}>
              go back
            </Button>
          </p>
        </div>
      </form>
    </section>
  )
}
