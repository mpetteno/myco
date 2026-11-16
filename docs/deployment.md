# Deployment preparation

The browser app has been deployed to Cloudflare Pages, as reported by the project
owner. The frontend deploys from GitHub;
Supabase provides email/password accounts, garden storage and owner-managed
sharing. These settings document the deployment and future updates.

## Supabase configuration

This project already has the required public values in an ignored `.env` file.
For a fresh checkout, copy `.env.example` to `.env.local`, then set:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

A legacy public anon key can also be used as the value of
`VITE_SUPABASE_PUBLISHABLE_KEY`. These values are public browser configuration.
Never use a service-role key or a secret API key in a `VITE_` variable.
Restart Vite after changing environment values.

The shared client is created lazily through `getSupabaseClient()`. The app now
requires authentication and a valid Supabase configuration. See
[authentication setup](authentication.md) for email confirmation, redirect and
SMTP requirements. Apply the [garden storage migrations](saved-gardens.md) before
using or deploying the saved-garden features.

## Cloudflare Pages

To deploy the browser app:

1. Create a Pages project connected to the `mpetteno/myco` GitHub repository.
2. Select the branch you want to publish.
3. Use the repository root as the project directory.
4. Set the build command to `npm run build` and output directory to `dist`.
5. Use Node.js 26, or a supported 22.22.2+/24.15+ release compatible with the development tools.
6. Add the two Supabase environment variables above for the deployment
   environments that should connect to that database.
7. Add the production application URL to Supabase Auth's site URL and allowed
   redirect URLs. Configure local
   and preview redirect URLs deliberately as needed.

Pages can deploy automatically after GitHub pushes and provide preview deployments.
The migrations enable Row Level Security. Garden access is restricted to owners
and their added editors. The app-wide plant and mulch catalogues are readable by signed-in
users and editable only by catalogue administrators. Apply numbered migrations
in order to every Supabase project used by a deployment. See
[catalogue setup](catalogues.md) to provision administrators. No secret key is
needed in the frontend.

## Confirmed account requirements

- Sign-in uses email and password through Supabase Auth.
- Each user can own multiple named gardens.
- Shared members can edit the garden and its beds.
- Only the owner can manage sharing.

Garden rows currently store each layout as an atomic snapshot, with beds in a
JSONB array and a version for concurrent-edit protection. User identities belong
to Supabase Auth. The sharing migration adds garden membership and extends
access policies. Owner-checked database functions add, list and remove editors
without exposing the auth user directory to the browser.

## Capacitor later

Cloudflare hosts the browser version. A future Capacitor build can package the
frontend and connect to the same Supabase backend. Native sign-in redirects and
session handling need to be configured and tested for Android/iOS separately.

## Official references

- [Cloudflare Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Cloudflare React build settings](https://developers.cloudflare.com/pages/framework-guides/deploy-a-react-site/)
- [Cloudflare Pages pricing](https://developers.cloudflare.com/pages/functions/pricing/)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Supabase public API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
