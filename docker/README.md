# TeachWise public demo on Render (free)

This puts TeachWise online as a **public portfolio demo** in one container: the Laravel API and the web app on one address, with one-click demo accounts on the sign-in screen. It's separate from [DEPLOY.md](../DEPLOY.md), which is for running TeachWise for real schools.

How the demo works:

- **Fresh data on every start.** The database is SQLite inside the container, rebuilt with the demo schools, people and evaluations each time the server starts.
- **Demo accounts can't be broken.** With `TEACHWISE_PUBLIC_DEMO=true`, visitors can't change passwords or profiles, delete accounts, reset or deactivate people, change the school's settings or logo, or remove schools. Everything else works.
- **Free plan sleep.** Render's free plan sleeps after 15 minutes without visitors and takes about a minute to wake on the next visit. Waking up also resets the demo data.

## Put it online

1. Sign up at [render.com](https://render.com) with your GitHub account.
2. Click **New** → **Blueprint**, pick the **TeachWise** repository, and confirm. Render reads [`render.yaml`](../render.yaml) and builds the [`Dockerfile`](../Dockerfile). The first build takes several minutes.
3. When it says **Live**, open the address Render gives you (like `https://teachwise-demo.onrender.com`).

Every push to `main` deploys again automatically.

## Demo accounts

The sign-in screen has a button for each one. Every demo account uses the password `password`.

| Button | Username | What to try |
|---|---|---|
| Student | `aisha` | Rate teachers, see your history |
| Teacher | `lsantos` | Ratings, trends, anonymous comments, the printable report |
| School admin | `admin` | Classes, evaluation periods, questions, faculty reports |
| TeachWise owner | `owner` | Approve and manage schools |

## Checks

The **Demo container** job in GitHub Actions builds this image on every push and checks it end to end: the web app opens, the API answers, the demo admin can sign in, and the demo password is protected.
