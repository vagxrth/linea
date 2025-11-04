'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { Loader2 } from 'lucide-react'
import Google from '@/components/google'
import Image from 'next/image'

export default function SignUpPage() {

  const { signUpForm, handleSignUp, isLoading } = useAuth();
  const { register, handleSubmit, formState: { errors } } = signUpForm;

  return (
    <section className="flex min-h-screen bg-zinc-50 px-4 py-16 md:py-32 dark:bg-transparent">
      <form
        onSubmit={handleSubmit(handleSignUp)}
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
              <h1 className="text-xl font-semibold">Create a Linea Account</h1>
              <p className="text-sm">Hola! Get started now</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Google className="col-span-2" />
          </div>

          <hr className="my-4 border-dashed" />

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label
                  htmlFor="firstName"
                  className="block text-sm">
                  First Name
                </Label>
                <Input
                  type="text"
                  required
                  id="firstName"
                  {...register('firstName')}
                  className={errors.firstName ? 'border-destructive' : ''}
                />
                {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="lastName"
                  className="block text-sm">
                  Last Name
                </Label>
                <Input
                  type="text"
                  required
                  id="lastName"
                  {...register('lastName')}
                  className={errors.lastName ? 'border-destructive' : ''}
                />
                {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>

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
                {...register('email')}
                className={errors.email ? 'border-destructive' : ''}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm">
                Password
              </Label>
              <Input
                type="password"
                id="password"
                {...register('password')}
                className={errors.password ? 'border-destructive' : ''}
              />
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            {errors.root && <p className="text-sm text-destructive text-center">{errors.root.message}</p>}

            <Button className="w-full" disabled={isLoading} type="submit">
              {isLoading ? (<> <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account... </>) : ('Create Account')}
            </Button>
          </div>
        </div>

        <div className="bg-muted rounded-(--radius) border p-3">
          <p className="text-accent-foreground text-center text-sm">
            Have an account ?
            <Button
              asChild
              variant="link"
              className="px-2">
              <Link href="/auth/signin">Sign In</Link>
            </Button>
          </p>
        </div>
      </form>
    </section>
  )
}
