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

type signInData = z.infer<typeof signInSchema>;
type signUpData = z.infer<typeof signUpSchema>

export const useAuth = () => {
    const { signIn, signOut } = useAuthActions();
    const [isLoading, setIsLoading] = useState(false);


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

    const handleSignIn = async (data: signInData) => {
        setIsLoading(true);
        try {
            await signIn('password', {
                email: data.email,
                password: data.password,
                flow: 'signIn',
            });
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
            await signIn('password', {
                email: data.email,
                password: data.password,
                name: `${data.firstName} ${data.lastName}`,
                flow: 'signUp',
            });
            // Use full page navigation to ensure server-side profile fetch
            window.location.href = '/dashboard';
        } catch (error) {
            console.error(error);
            signUpForm.setError('root', { message: 'Failed to create account' });
        } finally {
            setIsLoading(false);
        }
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

    return { signInForm, signUpForm, handleSignIn, handleSignUp, handleSignOut, isLoading };
};