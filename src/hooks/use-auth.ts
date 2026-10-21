import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { z } from 'zod'
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const signInSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

const signUpSchema = z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

const codeSchema = z.string().trim().regex(/^\d{8}$/, 'Enter the 8-digit code from the email')

const verifySchema = z.object({
    code: codeSchema,
});

const resetRequestSchema = z.object({
    email: z.string().email('Invalid email address'),
});

const resetSchema = z.object({
    code: codeSchema,
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

type signInData = z.infer<typeof signInSchema>;
type signUpData = z.infer<typeof signUpSchema>
type verifyData = z.infer<typeof verifySchema>
type resetRequestData = z.infer<typeof resetRequestSchema>
type resetData = z.infer<typeof resetSchema>

export const useAuth = () => {
    const { signIn, signOut } = useAuthActions();
    const [isLoading, setIsLoading] = useState(false);
    // Set while an account confirms its email: sign-up and sign-in email a code instead of signing in
    // until it has. The password is kept to ask for a new code.
    const [pendingVerification, setPendingVerification] = useState<{ email: string; password: string } | null>(null);


    const signInForm = useForm<signInData>({
        resolver: zodResolver(signInSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    const signUpForm = useForm<signUpData>({
        resolver: zodResolver(signUpSchema),
        defaultValues: {
            firstName: '',
            lastName: '',
            email: '',
            password: '',
        },
    });

    const verifyForm = useForm<verifyData>({
        resolver: zodResolver(verifySchema),
        defaultValues: {
            code: '',
        },
    });

    const handleSignIn = async (data: signInData) => {
        setIsLoading(true);
        try {
            const { signingIn } = await signIn('password', {
                email: data.email,
                password: data.password,
                flow: 'signIn',
            });
            if (!signingIn) {
                setPendingVerification({ email: data.email, password: data.password });
                return;
            }
            // Use full page navigation to ensure server-side profile fetch
            window.location.href = '/dashboard';
        } catch (error) {
            console.error(error);
            signInForm.setError('password', { message: 'Invalid email or password' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignUp = async (data: signUpData) => {
        setIsLoading(true);
        try {
            const { signingIn } = await signIn('password', {
                email: data.email,
                password: data.password,
                name: `${data.firstName} ${data.lastName}`,
                flow: 'signUp',
            });
            if (!signingIn) {
                setPendingVerification({ email: data.email, password: data.password });
                return;
            }
            // Use full page navigation to ensure server-side profile fetch
            window.location.href = '/dashboard';
        } catch (error) {
            console.error(error);
            signUpForm.setError('root', { message: 'Failed to create account' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyEmail = async (data: verifyData) => {
        if (!pendingVerification) return;
        setIsLoading(true);
        try {
            const { signingIn } = await signIn('password', {
                email: pendingVerification.email,
                code: data.code,
                flow: 'email-verification',
            });
            if (!signingIn) throw new Error('The code was not accepted');
            window.location.href = '/dashboard';
        } catch (error) {
            console.error(error);
            verifyForm.setError('code', { message: 'That code is wrong or has expired' });
        } finally {
            setIsLoading(false);
        }
    };

    // Signing in again with an unconfirmed email sends a fresh code
    const resendVerificationCode = async () => {
        if (!pendingVerification) return;
        setIsLoading(true);
        try {
            await signIn('password', { ...pendingVerification, flow: 'signIn' });
            verifyForm.reset();
        } catch (error) {
            console.error(error);
            verifyForm.setError('code', { message: "Couldn't send a new code. Try again in a moment." });
        } finally {
            setIsLoading(false);
        }
    };

    const cancelVerification = () => {
        setPendingVerification(null);
        verifyForm.reset();
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            // Use full page navigation to ensure server-side profile cleanup
            window.location.href = '/';
        } catch (error) {
            console.error(error);
        }
    };

    return {
        signInForm,
        signUpForm,
        verifyForm,
        handleSignIn,
        handleSignUp,
        handleVerifyEmail,
        resendVerificationCode,
        cancelVerification,
        verifyingEmail: pendingVerification?.email ?? null,
        handleSignOut,
        isLoading,
    };
};

export const usePasswordReset = () => {
    const { signIn } = useAuthActions();
    const [isLoading, setIsLoading] = useState(false);
    // The email a reset code was asked for
    const [email, setEmail] = useState<string | null>(null);

    const requestForm = useForm<resetRequestData>({
        resolver: zodResolver(resetRequestSchema),
        defaultValues: {
            email: '',
        },
    });

    const resetForm = useForm<resetData>({
        resolver: zodResolver(resetSchema),
        defaultValues: {
            code: '',
            newPassword: '',
        },
    });

    const handleRequestCode = async (data: resetRequestData) => {
        setIsLoading(true);
        try {
            await signIn('password', { email: data.email, flow: 'reset' });
        } catch (error) {
            // Not shown, so the page doesn't reveal which emails have an account
            console.error(error);
        } finally {
            setEmail(data.email);
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (data: resetData) => {
        if (!email) return;
        setIsLoading(true);
        try {
            const { signingIn } = await signIn('password', {
                email,
                code: data.code,
                newPassword: data.newPassword,
                flow: 'reset-verification',
            });
            if (!signingIn) throw new Error('The code was not accepted');
            // Use full page navigation to ensure server-side profile fetch
            window.location.href = '/dashboard';
        } catch (error) {
            console.error(error);
            resetForm.setError('code', { message: 'That code is wrong or has expired' });
        } finally {
            setIsLoading(false);
        }
    };

    const startOver = () => {
        setEmail(null);
        resetForm.reset();
    };

    return { requestForm, resetForm, email, handleRequestCode, handleResetPassword, startOver, isLoading };
};
