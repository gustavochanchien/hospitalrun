import { useState } from 'react'
import { z } from 'zod/v4'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase/client'

const schema = z
  .object({
    fullName: z.string().min(1, 'Full name is required'),
    email: z.email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormData = z.infer<typeof schema>

interface Props {
  onBack: () => void
  /**
   * Called when signup succeeds and a session is issued immediately
   * (i.e. email confirmation is disabled). The parent should advance
   * the wizard to its next step instead of redirecting. If email
   * confirmation is enabled, this callback is not invoked — the form
   * shows the "check your email" message instead.
   */
  onSignedUp?: () => void
}

export function FirstUserForm({ onBack, onSignedUp }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = async (data: FormData) => {
    setError(null)
    const { data: authData, error: signUpErr } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.fullName } },
    })
    if (signUpErr) {
      setError(signUpErr.message)
      return
    }
    if (authData.session) {
      // Email confirmation is disabled — session issued immediately.
      // Hand off to the parent wizard (which advances to the "Choose
      // Roles" step). Falls back to a full reload if no handler is
      // provided so the legacy behavior is preserved.
      if (onSignedUp) {
        onSignedUp()
      } else {
        window.location.assign('/')
      }
    } else {
      // Project requires email confirmation.
      setEmailSent(true)
    }
  }

  if (emailSent) {
    return (
      <div className="space-y-4 text-center text-sm">
        <p>A confirmation link has been sent to your email address.</p>
        <p className="text-muted-foreground">
          Click the link in that email to activate your account, then come back to sign in.
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => window.location.assign('/login')}
        >
          Go to sign in
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div className="space-y-2">
        <Label htmlFor="fu-name">Full name</Label>
        <Input id="fu-name" autoComplete="name" {...form.register('fullName')} />
        {form.formState.errors.fullName && (
          <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="fu-email">Email</Label>
        <Input id="fu-email" type="email" autoComplete="email" {...form.register('email')} />
        {form.formState.errors.email && (
          <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="fu-pw">Password</Label>
        <Input
          id="fu-pw"
          type="password"
          autoComplete="new-password"
          {...form.register('password')}
        />
        {form.formState.errors.password && (
          <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="fu-pw2">Confirm password</Label>
        <Input
          id="fu-pw2"
          type="password"
          autoComplete="new-password"
          {...form.register('confirmPassword')}
        />
        {form.formState.errors.confirmPassword && (
          <p className="text-sm text-destructive">
            {form.formState.errors.confirmPassword.message}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          disabled={form.formState.isSubmitting}
        >
          Back
        </Button>
        <Button type="submit" className="flex-1" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <button
          type="button"
          className="text-primary underline-offset-4 hover:underline"
          onClick={() => window.location.assign('/login')}
        >
          Sign in
        </button>
      </p>
    </form>
  )
}
