<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Admin hierarchy: owner role always also holds admin; role/plan changes go only through SECURITY DEFINER RPCs (owner_add_admin, owner_remove_admin, admin_set_plan) that log to admin_logs — clients never write user_roles directly.
- Catalog media: work/chapter images live in the private manga-media bucket and are served via /api/public/media/*; works and chapters use soft delete (deleted_at) so history/favorites survive.
- Social: activities are written only by DB triggers (never by clients) and never include comment text, so spoilers can't leak; comment/follow/like/report limits live in DB triggers.
- Cosmetics: equip/grant only via SECURITY DEFINER RPCs (equip_cosmetic checks ownership for non-unlockable items, admin_grant_cosmetic); clients never write user_cosmetics.
- Billing: provider-agnostic interface in src/lib/billing/provider.server.ts (current impl asaas.server.ts); profiles.plan is a cache recomputed only by sync_profile_plan from subscriptions (webhook-confirmed or provider='manual'), so benefits never activate from client responses; subscriptions never gate reading access.
