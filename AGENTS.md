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

- Data lives in the user's external Supabase (shared with "Meu Pedacinho Azul"); client is in src/lib/supabase.ts and app routes are client-only under src/routes/_app — session is in localStorage.
- Follow-ups on appointments are new `evento` records with `parentId`; never update originals — history must stay immutable.
