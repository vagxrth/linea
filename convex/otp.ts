import Resend from "@auth/core/providers/resend";

// One-time codes emailed through Resend, for confirming an email address and for resetting a
// password. The Convex deployment needs AUTH_RESEND_KEY (a Resend API key) and AUTH_EMAIL_FROM
// (a sender on a domain verified in Resend, like "Linea <noreply@example.com>").
const CODE_MINUTES = 15

// Eight random digits
const generateCode = () =>
    Array.from(crypto.getRandomValues(new Uint32Array(8)), (n) => n % 10).join("")

export const ResendOTP = ({ id, subject, purpose }: { id: string; subject: string; purpose: string }) =>
    Resend({
        id,
        maxAge: CODE_MINUTES * 60,
        async generateVerificationToken() {
            return generateCode()
        },
        async sendVerificationRequest({ identifier: email, token }) {
            const apiKey = process.env.AUTH_RESEND_KEY
            const from = process.env.AUTH_EMAIL_FROM
            if (!apiKey || !from) {
                throw new Error("Email codes need AUTH_RESEND_KEY and AUTH_EMAIL_FROM set on the Convex deployment")
            }

            const response = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from,
                    to: email,
                    subject,
                    text: `Your code to ${purpose} is ${token}. It expires in ${CODE_MINUTES} minutes.\n\nIf you didn't ask for this code, you can ignore this email.`,
                }),
            })
            if (!response.ok) {
                throw new Error(`Resend couldn't send the code (${response.status}): ${await response.text()}`)
            }
        },
    })
