# Email/password accounts

The app requires a Supabase account before opening the garden editor. Sign-in,
sign-up, session restoration and sign-out are implemented. Saved gardens require
the [garden storage migrations](saved-gardens.md). Owners can also
[share gardens](sharing.md) with existing users by confirmed email address.

## Using an account

- Choose **Create an account**, enter an email and a password of at least eight
  characters, then confirm the password. Supabase can enforce additional password
  requirements configured in the project.
- If email confirmation is required, the app asks you to check your inbox and
  returns to the sign-in form. After confirming the email, sign in with the same
  email and password. A valid confirmation redirect can also restore the session
  automatically through the Supabase client.
- Existing users sign in with email and password. Supabase keeps the session
  across reloads and refreshes it through its client library.
- Open **Account** in the top bar to see the current email and sign out of this
  device. Other device sessions remain signed in.

Garden layouts save to the signed-in account. Sign-out waits for pending saves;
if a save fails, resolve it before signing out. Switching accounts clears editor
selection and the copied-bed buffer and loads the new account's gardens.
Token refreshes for the same user preserve the current editor.
Passwords are submitted to Supabase and are not stored by the app.

## Supabase configuration

The existing ignored `.env` file supplies `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`. Fresh checkouts can use `.env.example` as a
template. Missing configuration displays the account-service error screen.
Restart Vite after changing environment values.

In Supabase Authentication's URL Configuration:

1. Set the Site URL to the deployed web application URL when available.
2. Add `http://localhost:5173/` as an allowed redirect for local testing.
3. Add the production URL and any deliberately used phone/LAN or preview URLs.

Sign-up requests use the current app origin and pathname as the email-confirmation
redirect. Supabase must allow that redirect. Configure email delivery before
opening registration to other users: Supabase's default SMTP service only sends
to project team addresses. A custom SMTP provider is needed for other recipients
when confirmation emails are enabled.

Native Capacitor redirect handling will be configured with the Android/iOS shells.
This step implements the browser flow without changing the project's auth settings
or creating live test users.

## Validation

Run `npm test` for isolated authentication tests using the real Supabase client
with mocked HTTP responses and in-memory storage. Tests cover both sign-up
confirmation modes, sign-in errors, session restoration, sign-out, late responses,
subscription cleanup and password/email input types. They send no live email.

Use a real account to verify email delivery and redirects in the configured
Supabase project. Browser and native device visual checks are separate from the
automated auth tests.

## Official references

- [Password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Auth state changes](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Sign-out scope](https://supabase.com/docs/reference/javascript/auth-signout)
- [Email delivery configuration](https://supabase.com/docs/guides/auth/auth-smtp)
