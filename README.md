# Jamaica Kingsmen

An independent CPL 2026 supporter site for Jamaica Kingsmen, hosted free on GitHub Pages.

## Automatic updates

The scheduled workflow in `.github/workflows/update-data.yml` refreshes the site's JSON feed every two hours and can also be run manually from the repository's Actions tab. It reads completed results and upcoming fixtures from Cricket West Indies, and current squad totals from the Jamaica Kingsmen squad leaderboard on Statz Cricket.

The updater validates each source before writing. If a provider is unavailable or changes its page structure, the workflow fails safely and the last verified dataset remains online.

## Hosting

GitHub Pages should be configured to deploy from the `main` branch and repository root. The site does not require a server, database, paid API, npm install, Vercel account, or OpenAI subscription.

## Local refresh

Run `node scripts/update-data.mjs`, then serve the repository directory with any static web server.

