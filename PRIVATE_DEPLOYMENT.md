# Keep the course private

There are two independent controls:

- **Repository visibility** controls who can read the source on GitHub.
- **Website access** controls who can open the running app and download its course assets.

A private repository does **not** automatically make a published website private. A random or unlisted URL, `robots.txt`, or a JavaScript password prompt is not authentication.

## Recommended: private repository + identity-protected hosting

Keep the GitHub repository private. If it is currently public, changing its visibility is a separate action under the repository's settings; this project does not change it automatically. Existing public copies cannot be withdrawn by a visibility change.

A practical hosting option is a static Cloudflare Pages deployment protected by Cloudflare Access, with an allow policy for **only your exact email address** and email one-time PIN sign-in. This requires your Cloudflare account and an appropriate protected hostname. No credentials should be placed in this repository, a frontend file, or a chat message.

Configure the hosting and access control in the provider's current dashboard. Before treating the app as private:

1. Cover the production hostname and every alternate hostname, including the default `pages.dev` address, preview URLs and any custom domain. Pages' preview-access switch alone must not be assumed to cover production. If a default or preview address cannot be protected, disable its public delivery rather than sharing it.
2. Apply the access policy to the whole site, not just `index.html`. The JSON curriculum, PDF, JS, icons and service worker are separate requests and must also be protected.
3. Use an allow rule for your exact email; do not add an “everyone” or bypass rule.
4. In a signed-out/private browser, verify the main page, `assets/course.json` and the PDF all require authentication at every exposed hostname. A page redirect alone is insufficient if raw assets remain public.
5. Sign in with your allowed email on the iPad; check learning and voice playback. Then check Home Screen installation and offline use on that device. Do not assume the provider's login flow works identically inside an installed web app.

**Offline copies remain on an authorized device.** Expiring an online login cannot erase already cached files or a downloaded PDF. Do not install the app on a shared device. Remove the home-screen app and clear the site's Safari data when appropriate. Downloadable progress backups include scratchpad notes.

No website has been deployed and no access policy has been created by this project. Provider setup must be completed and verified before publication is considered private. Cloudflare plan limits and dashboard details may change; check the current product requirements in your account.

## Alternative: keep it entirely on your own devices

Run the static server on your own computer, connect that computer and your iPad to the same private Tailscale network, and use a private HTTPS Tailscale Serve endpoint. Use **Serve**, not the publicly accessible **Funnel** feature. Restrict tailnet access to your devices. This avoids a public website, but the computer must stay awake while the iPad needs to fetch the course. Configure Tailscale on your own machines; nothing in this cloud checkout configures a VPN for you.

A same-Wi-Fi server is a simpler temporary test, but it is not “only me” if other people can reach that LAN server. A local standalone HTML file avoids hosting, but iPad Files/Quick Look is not a dependable app runtime. Safari + a protected HTTPS URL is the recommended iPad experience.
