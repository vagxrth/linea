import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { ResendOTP } from "./otp";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    // An email and password account confirms its email with an emailed code before it can sign in,
    // and a forgotten password is reset with one
    Password({
      verify: ResendOTP({
        id: "resend-otp-verify",
        subject: "Your Linea verification code",
        purpose: "confirm your email for Linea",
      }),
      reset: ResendOTP({
        id: "resend-otp-reset",
        subject: "Your Linea password reset code",
        purpose: "reset your Linea password",
      }),
    }),
  ],
});
