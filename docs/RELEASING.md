# Releasing SweetSpot

A release is a tagged commit of the `dev` branch (until there is a `main` release branch) that has passed CI,
with a version that the app shows in its footer and that the safety case names.

1. **Check safety relevance.** If the change touches anything listed under *Change control* in the
   [clinical risk management plan](clinical-safety/02-clinical-risk-management-plan.md#change-control), the
   Clinical Safety Officer reviews the hazard log and re-issues the safety case report for the new version
   before release.
2. **Set the version.** Edit `sweetspotVersion` in `package.json` (for example `0.1.0`), and write the release
   notes: what changed, which hazards were reviewed, which issues were closed.
3. **Check CI.** The commit must pass the *Test* workflow: type check, unit tests, and the end-to-end tests of the
   standard and the educational-only builds.
4. **Tag and push.**

   ```shell
   git tag -a v0.1.0 -m "SweetSpot 0.1.0"
   git push origin v0.1.0
   ```

   Never move or delete a published tag; make a new version instead.
5. **Build for deployment** from the tag, with the settings of the deployment (see
   [deployment notes](clinical-safety/06-deployment-and-dtac.md)):

   ```shell
   git checkout v0.1.0
   npm ci
   SWEETSPOT_PERSONAL_DATA=off SWEETSPOT_FEEDBACK_URL=mailto:... npm run build
   ```

   The footer of the built app shows the version and the commit; check it before publishing `dist/`.
6. **Tell deploying organisations** which version is current and what changed, so that they can update their
   local safety case (DCB0160).
