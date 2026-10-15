import { AlertTriangle } from "lucide-react"
import { isSupabaseConfigured, supabaseConfigProblem, supabaseConfigWarning } from "../lib/supabase"
import { SUPABASE_ANON_KEY_VARIABLE, SUPABASE_URL_VARIABLE } from "../lib/supabaseConfig"
import { Btn } from "./kit"

const FALLBACK_MESSAGE =
  `Supabase n'est pas configuré. Ajoutez ${SUPABASE_URL_VARIABLE} et ${SUPABASE_ANON_KEY_VARIABLE} dans le fichier .env, puis redémarrez Vite.`

/**
 * Persistent setup notice for the auth screens.
 *
 * Submitting the form used to be the only way to learn the app had no usable
 * Supabase configuration — the credentials you just typed were then thrown
 * away. This shows the exact variable to fix (and a copy/paste template)
 * as soon as the screen opens, and escalates to a red security notice when a
 * service-role/secret key is sitting in a `VITE_*` variable.
 *
 * `onContinueLocally` is only passed by development builds (see
 * src/lib/localDevMode.ts); it must stay absent in production.
 */
export default function SupabaseSetupNotice({ onContinueLocally }: { onContinueLocally?: () => void }) {
  if (isSupabaseConfigured) {
    // Usable configuration, but the URL and the key may belong to different
    // projects — worth saying before "invalid credentials" gets blamed.
    return supabaseConfigWarning ? (
      <div className="mt-5 flex items-start gap-2 rounded-xl border border-warn/30 bg-warn-50 p-3.5 text-[12.5px] leading-relaxed text-warn">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{supabaseConfigWarning}</span>
      </div>
    ) : null
  }

  const message = supabaseConfigProblem?.message ?? FALLBACK_MESSAGE
  const secretKey = supabaseConfigProblem?.code === "secret-key"
  const localOption = import.meta.env.DEV && !secretKey && !!onContinueLocally
  // `VITE_*` values are inlined at build time, so a deployed site can be
  // unconfigured even when the developer's own .env is perfect. Naming the
  // build date is what makes that distinguishable from "you edited the wrong
  // file" — see docs/ENVIRONMENT.md.
  const buildTime = import.meta.env.VITE_BUILD_TIME

  return (
    <div
      role="alert"
      className={`mt-5 rounded-xl border p-3.5 text-[12.5px] leading-relaxed ${
        secretKey ? "border-serious/20 bg-serious-50 text-serious" : "border-warn/30 bg-warn-50 text-warn"
      }`}
    >
      <p className="flex items-start gap-2 font-semibold">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{secretKey ? "Clé secrète détectée dans le navigateur" : "Configuration Supabase requise"}</span>
      </p>
      <p className="mt-1.5">{message}</p>
      {!secretKey && (
        <p className="mt-1.5 text-[11.5px] opacity-80">
          {buildTime
            ? `Ce bundle a été construit le ${new Date(buildTime).toLocaleString("fr-MA")}. `
            : ""}
          Sur un site déployé, ces variables doivent exister dans l'environnement de <strong>build</strong> (Cloudflare
          Pages → Settings → Variables and secrets, pour <strong>Production</strong> et <strong>Preview</strong>), puis
          un nouveau déploiement doit être lancé. Détails et vérification : <code>docs/ENVIRONMENT.md</code>.
        </p>
      )}
      {!secretKey && (
        <pre className="mt-2.5 overflow-x-auto rounded-md bg-canvas px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-ink">
          {`${SUPABASE_URL_VARIABLE}=https://<référence>.supabase.co\n${SUPABASE_ANON_KEY_VARIABLE}=<clé anon publique>`}
        </pre>
      )}
      {localOption && (
        <div className="mt-3 border-t border-warn/20 pt-3">
          <p>
            Aperçu local : cette option n'existe que sur un serveur de développement. Elle ouvre le tableau de bord avec
            un espace de travail local (données enregistrées dans ce navigateur uniquement), sans compte Supabase et
            sans aucune requête réseau.
          </p>
          <Btn variant="outline" size="sm" className="mt-2.5" onClick={onContinueLocally}>
            Continuer en mode local
          </Btn>
        </div>
      )}
    </div>
  )
}
