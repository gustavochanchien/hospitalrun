import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { z } from 'zod/v4'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuthStore } from './auth.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const loginSchema = z.object({
  email: z.email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type LoginFormData = z.infer<typeof loginSchema>

const signUpSchema = loginSchema.extend({
  fullName: z.string().min(1, 'Full name is required'),
})

type SignUpFormData = z.infer<typeof signUpSchema>

export function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { signIn, signUp } = useAuthStore()

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', fullName: '' },
  })

  const onLogin = async (data: LoginFormData) => {
    setError(null)
    const result = await signIn(data.email, data.password)
    if (result.error) {
      setError(result.error)
    } else {
      navigate({ to: '/' })
    }
  }

  const onSignUp = async (data: SignUpFormData) => {
    setError(null)
    const result = await signUp(data.email, data.password, data.fullName)
    if (result.error) {
      setError(result.error)
    } else {
      setError(null)
      setIsSignUp(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">HospitalRun</CardTitle>
          <CardDescription>
            {isSignUp ? 'Create an account to get started' : 'Sign in to your account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {isSignUp ? (
            <form onSubmit={signUpForm.handleSubmit(onSignUp)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" {...signUpForm.register('fullName')} />
                {signUpForm.formState.errors.fullName && (
                  <p className="text-sm text-destructive">
                    {signUpForm.formState.errors.fullName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input id="signup-email" type="email" {...signUpForm.register('email')} />
                {signUpForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {signUpForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  {...signUpForm.register('password')}
                />
                {signUpForm.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {signUpForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={signUpForm.formState.isSubmitting}>
                {signUpForm.formState.isSubmitting ? 'Creating account...' : 'Create account'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(false)}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...loginForm.register('email')} />
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {loginForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" {...loginForm.register('password')} />
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {loginForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}>
                {loginForm.formState.isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => setIsSignUp(true)}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Sign up
                </button>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
